/**
 * ExecutionManager - 执行管理器
 * 
 * 负责：
 * - 执行队列管理
 * - 自动重试机制
 * - 执行状态追踪
 * - 超时处理
 */

import { SafetyGuard } from './SafetyGuard';
import { JupyterService } from './JupyterService';
import { emit } from '../store/eventBus';
import type { Output, ExecutionState } from '../types';

// ============================================================
// 类型定义
// ============================================================

export interface ExecutionTask {
  id: string;
  cellId: string;
  code: string;
  priority: number;
  createdAt: number;
  status: ExecutionTaskStatus;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  outputs: Output[];
  error?: string;
}

export type ExecutionTaskStatus = 
  | 'pending' 
  | 'running' 
  | 'success' 
  | 'error' 
  | 'timeout' 
  | 'cancelled'
  | 'retrying';

export interface ExecutionResult {
  taskId: string;
  cellId: string;
  success: boolean;
  outputs: Output[];
  executionCount: number;
  duration: number;
  retryCount: number;
  error?: string;
}

export interface ExecutionManagerConfig {
  maxConcurrent: number;
  defaultTimeout: number;
  maxRetries: number;
  retryDelay: number;
  autoRetryOnError: boolean;
}

export interface ExecutionManagerEvents {
  onTaskStart?: (task: ExecutionTask) => void;
  onTaskComplete?: (result: ExecutionResult) => void;
  onTaskError?: (task: ExecutionTask, error: Error) => void;
  onRetry?: (task: ExecutionTask, attempt: number) => void;
  onQueueChange?: (queue: ExecutionTask[]) => void;
}

// ============================================================
// ExecutionManager 类
// ============================================================

export class ExecutionManager {
  private config: ExecutionManagerConfig;
  private events: ExecutionManagerEvents;
  private jupyterService: JupyterService | null = null;
  private safetyGuard: SafetyGuard;
  
  private queue: ExecutionTask[] = [];
  private runningTasks: Map<string, ExecutionTask> = new Map();
  private isProcessing = false;

  constructor(
    config?: Partial<ExecutionManagerConfig>,
    events: ExecutionManagerEvents = {}
  ) {
    this.config = {
      maxConcurrent: 1,  // Jupyter kernel 单线程
      defaultTimeout: 60000,  // 60 秒
      maxRetries: 3,
      retryDelay: 1000,
      autoRetryOnError: true,
      ...config,
    };
    this.events = events;
    this.safetyGuard = new SafetyGuard();
  }

  /**
   * 设置 Jupyter Service
   */
  setJupyterService(service: JupyterService): void {
    this.jupyterService = service;
  }

  /**
   * 设置 Safety Guard
   */
  setSafetyGuard(guard: SafetyGuard): void {
    this.safetyGuard = guard;
  }

  /**
   * 添加执行任务
   */
  enqueue(
    cellId: string,
    code: string,
    options?: {
      priority?: number;
      timeout?: number;
      maxRetries?: number;
    }
  ): string {
    const task: ExecutionTask = {
      id: crypto.randomUUID(),
      cellId,
      code,
      priority: options?.priority ?? 0,
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
      maxRetries: options?.maxRetries ?? this.config.maxRetries,
      timeout: options?.timeout ?? this.config.defaultTimeout,
      outputs: [],
    };

    // 按优先级插入队列
    const insertIndex = this.queue.findIndex(t => t.priority < task.priority);
    if (insertIndex === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(insertIndex, 0, task);
    }

    this.events.onQueueChange?.(this.queue);
    this.processQueue();

    return task.id;
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    // 从队列中移除
    const queueIndex = this.queue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      this.queue[queueIndex].status = 'cancelled';
      this.queue.splice(queueIndex, 1);
      this.events.onQueueChange?.(this.queue);
      return true;
    }

    // 取消正在运行的任务
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      runningTask.status = 'cancelled';
      // 中断 kernel 执行
      this.jupyterService?.interruptKernel();
      return true;
    }

    return false;
  }

  /**
   * 取消所有任务
   */
  cancelAll(): void {
    this.queue.forEach(t => t.status = 'cancelled');
    this.queue = [];
    this.runningTasks.forEach(t => t.status = 'cancelled');
    this.jupyterService?.interruptKernel();
    this.events.onQueueChange?.([]);
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;
    if (this.runningTasks.size >= this.config.maxConcurrent) return;
    if (!this.jupyterService) return;

    this.isProcessing = true;

    try {
      while (
        this.queue.length > 0 && 
        this.runningTasks.size < this.config.maxConcurrent
      ) {
        const task = this.queue.shift();
        if (!task) break;

        // 安全检查
        const safetyCheck = this.safetyGuard.checkCode(task.code);
        if (safetyCheck.blocked) {
          task.status = 'error';
          task.error = `Blocked: ${safetyCheck.reason}`;
          this.events.onTaskError?.(task, new Error(task.error));
          continue;
        }

        // 执行限制检查
        const canExecute = this.safetyGuard.canExecute();
        if (!canExecute.allowed) {
          task.status = 'error';
          task.error = canExecute.reason;
          this.events.onTaskError?.(task, new Error(task.error!));
          continue;
        }

        await this.executeTask(task);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: ExecutionTask): Promise<void> {
    task.status = 'running';
    this.runningTasks.set(task.id, task);
    this.events.onTaskStart?.(task);

    const recordId = this.safetyGuard.recordExecutionStart(task.cellId, task.code);
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(task);
      
      const duration = Date.now() - startTime;
      this.safetyGuard.recordExecutionEnd(recordId, result.success, result.error);

      if (result.success) {
        task.status = 'success';
        task.outputs = result.outputs;
        
        this.events.onTaskComplete?.({
          taskId: task.id,
          cellId: task.cellId,
          success: true,
          outputs: result.outputs,
          executionCount: result.executionCount,
          duration,
          retryCount: task.retryCount,
        });

        emit('cell:executed', {
          cellId: task.cellId,
          success: true,
          executionCount: result.executionCount,
        });
      } else {
        // 检查是否可以重试
        if (this.shouldRetry(task, result.error)) {
          await this.retryTask(task);
        } else {
          task.status = 'error';
          task.error = result.error;
          
          this.events.onTaskComplete?.({
            taskId: task.id,
            cellId: task.cellId,
            success: false,
            outputs: result.outputs,
            executionCount: result.executionCount,
            duration,
            retryCount: task.retryCount,
            error: result.error,
          });

          emit('cell:executed', {
            cellId: task.cellId,
            success: false,
            executionCount: result.executionCount,
          });
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.safetyGuard.recordExecutionEnd(recordId, false, errorMessage);

      if (this.shouldRetry(task, errorMessage)) {
        await this.retryTask(task);
      } else {
        task.status = 'error';
        task.error = errorMessage;
        this.events.onTaskError?.(task, error as Error);
      }
    } finally {
      this.runningTasks.delete(task.id);
      this.processQueue();
    }
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout(task: ExecutionTask): Promise<{
    success: boolean;
    outputs: Output[];
    executionCount: number;
    error?: string;
  }> {
    return new Promise((resolve) => {
      if (!this.jupyterService) {
        resolve({
          success: false,
          outputs: [],
          executionCount: 0,
          error: 'Jupyter service not connected',
        });
        return;
      }

      const outputs: Output[] = [];
      let timeoutId: NodeJS.Timeout | undefined;

      const handle = this.jupyterService.execute(task.cellId, task.code);

      // 收集输出
      handle.onOutput((output) => {
        outputs.push(output);
        task.outputs = outputs;
      });

      // 设置超时
      timeoutId = setTimeout(() => {
        handle.cancel();
        task.status = 'timeout';
        resolve({
          success: false,
          outputs,
          executionCount: 0,
          error: `Execution timeout after ${task.timeout}ms`,
        });
      }, task.timeout);

      // 等待完成
      handle.done
        .then((result) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve({
            success: result.status === 'ok',
            outputs,
            executionCount: result.execution_count,
            error: result.status === 'error' 
              ? `${result.ename}: ${result.evalue}` 
              : undefined,
          });
        })
        .catch((error) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve({
            success: false,
            outputs,
            executionCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
    });
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(task: ExecutionTask, error?: string): boolean {
    if (!this.config.autoRetryOnError) return false;
    if (task.retryCount >= task.maxRetries) return false;
    if (task.status === 'cancelled') return false;
    if (task.status === 'timeout') return false;

    // 某些错误不应该重试
    const nonRetryableErrors = [
      'SyntaxError',
      'IndentationError',
      'NameError',
      'ImportError',
      'ModuleNotFoundError',
    ];

    if (error) {
      for (const errorType of nonRetryableErrors) {
        if (error.includes(errorType)) {
          return false;
        }
      }
    }

    // 检查安全限制
    const canRetry = this.safetyGuard.canRetry(task.cellId);
    return canRetry.allowed;
  }

  /**
   * 重试任务
   */
  private async retryTask(task: ExecutionTask): Promise<void> {
    task.retryCount++;
    task.status = 'retrying';
    task.outputs = [];
    
    this.events.onRetry?.(task, task.retryCount);

    // 延迟后重试
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

    // 重新加入队列首位
    this.queue.unshift(task);
    this.events.onQueueChange?.(this.queue);
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    pending: number;
    running: number;
    total: number;
    tasks: ExecutionTask[];
  } {
    return {
      pending: this.queue.length,
      running: this.runningTasks.size,
      total: this.queue.length + this.runningTasks.size,
      tasks: [...this.queue, ...this.runningTasks.values()],
    };
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): ExecutionTask | undefined {
    return this.queue.find(t => t.id === taskId) || this.runningTasks.get(taskId);
  }
}

/**
 * 创建 ExecutionManager 实例
 */
export function createExecutionManager(
  config?: Partial<ExecutionManagerConfig>,
  events?: ExecutionManagerEvents
): ExecutionManager {
  return new ExecutionManager(config, events);
}

export default ExecutionManager;
