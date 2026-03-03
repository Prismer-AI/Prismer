/**
 * JupyterService - Jupyter Kernel 连接和代码执行服务
 * 
 * 使用 @jupyterlab/services 与远程 Jupyter Server 通信
 */

import {
  KernelManager,
  ServerConnection,
  KernelMessage,
  Kernel,
} from '@jupyterlab/services';
import type { 
  KernelStatus, 
  Output, 
  StreamOutput, 
  ExecuteResultOutput, 
  DisplayDataOutput, 
  ErrorOutput,
  ExecutionHandle,
  ExecuteReply,
} from '../types';

export interface JupyterServiceConfig {
  baseUrl: string;
  token?: string;
  wsUrl?: string;
}

export interface JupyterServiceEvents {
  onKernelStatus?: (status: KernelStatus) => void;
  onOutput?: (cellId: string, output: Output) => void;
}

/**
 * JupyterService 类
 * 封装与 Jupyter Server 的所有通信
 */
export class JupyterService {
  private serverSettings: ServerConnection.ISettings | null = null;
  private kernelManager: KernelManager | null = null;
  private kernel: Kernel.IKernelConnection | null = null;
  private config: JupyterServiceConfig;
  private events: JupyterServiceEvents;
  private executionCount = 0;

  constructor(config: JupyterServiceConfig, events: JupyterServiceEvents = {}) {
    this.config = config;
    this.events = events;
  }

  /**
   * 连接到 Jupyter Server
   */
  async connect(): Promise<void> {
    const token = this.config.token || '';
    
    // 确保 baseUrl 格式正确
    let baseUrl = this.config.baseUrl;
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    
    // 构建 wsUrl，确保包含 token
    let wsUrl = this.config.wsUrl || baseUrl.replace(/^http/, 'ws');
    if (!wsUrl.endsWith('/')) {
      wsUrl += '/';
    }

    console.log('[JupyterService] Connecting with settings:', {
      baseUrl,
      wsUrl,
      hasToken: !!token,
    });

    // 创建服务器连接设置
    this.serverSettings = ServerConnection.makeSettings({
      baseUrl,
      wsUrl,
      token,
      appendToken: true, // 确保 token 添加到所有请求
    });

    // 创建 Kernel 管理器
    this.kernelManager = new KernelManager({
      serverSettings: this.serverSettings,
    });

    // 等待 Kernel 管理器就绪
    await this.kernelManager.ready;
    
    console.log('[JupyterService] Connected to Jupyter Server');
  }

  /**
   * 释放本地连接（不杀 kernel）。
   * Tab 切换、组件卸载时调用，kernel 在服务器端继续运行。
   */
  async disconnect(): Promise<void> {
    if (this.kernel) {
      try { this.kernel.dispose(); } catch { /* ignore */ }
      this.kernel = null;
    }
    this.kernelManager = null;
    this.serverSettings = null;
    console.log('[JupyterService] Local connection disposed (kernel still alive on server)');
  }

  /**
   * 重连到已存在的 kernel（tab 切回时使用）
   */
  async connectToKernel(kernelId: string, name = 'python3'): Promise<string> {
    if (!this.kernelManager) {
      throw new Error('Not connected to Jupyter Server');
    }

    if (this.kernel) {
      try { this.kernel.dispose(); } catch { /* ignore */ }
    }

    this.kernel = this.kernelManager.connectTo({ model: { id: kernelId, name } });

    this.kernel.statusChanged.connect((_, status) => {
      this.events.onKernelStatus?.(this.mapKernelStatus(status));
    });

    // 等待连接就绪
    await (this.kernel as any).ready;

    console.log(`[JupyterService] Reconnected to kernel: ${this.kernel.id}, status: ${this.kernel.status}`);
    return this.kernel.id;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.kernelManager !== null;
  }

  /**
   * 检查 kernel 是否活跃
   */
  isKernelAlive(): boolean {
    return this.kernel !== null && this.kernel.status !== 'dead';
  }

  /**
   * 获取可用的 Kernel 类型
   */
  async getKernelSpecs(): Promise<Array<{ name: string; displayName: string; language: string }>> {
    if (!this.kernelManager || !this.serverSettings) {
      throw new Error('Not connected to Jupyter Server');
    }

    // 直接从 REST API 获取 kernel specs
    try {
      const response = await ServerConnection.makeRequest(
        `${this.serverSettings.baseUrl}api/kernelspecs`,
        {},
        this.serverSettings
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch kernel specs: ${response.status}`);
      }
      
      const data = await response.json() as {
        default: string;
        kernelspecs: Record<string, { 
          name: string; 
          spec: { display_name: string; language: string } 
        }>;
      };
      
      return Object.entries(data.kernelspecs).map(([name, info]) => ({
        name,
        displayName: info.spec?.display_name || name,
        language: info.spec?.language || 'unknown',
      }));
    } catch (error) {
      console.error('Failed to get kernel specs:', error);
      return [{ name: 'python3', displayName: 'Python 3', language: 'python' }];
    }
  }

  /**
   * 启动新的 Kernel
   */
  async startKernel(name = 'python3'): Promise<string> {
    if (!this.kernelManager) {
      throw new Error('Not connected to Jupyter Server');
    }

    // 释放旧连接（不杀 kernel）
    if (this.kernel) {
      try { this.kernel.dispose(); } catch { /* ignore */ }
    }

    // 启动新 kernel
    this.kernel = await this.kernelManager.startNew({ name });
    
    // 订阅状态变化
    this.kernel.statusChanged.connect((_, status) => {
      this.events.onKernelStatus?.(this.mapKernelStatus(status));
    });

    console.log(`[JupyterService] Kernel started: ${this.kernel.id}`);
    return this.kernel.id;
  }

  /**
   * 关闭当前 Kernel
   */
  async shutdownKernel(): Promise<void> {
    if (this.kernel) {
      await this.kernel.shutdown();
      this.kernel = null;
      console.log('[JupyterService] Kernel shutdown');
    }
  }

  /**
   * 中断当前执行
   */
  async interruptKernel(): Promise<void> {
    if (this.kernel) {
      await this.kernel.interrupt();
      console.log('[JupyterService] Kernel interrupted');
    }
  }

  /**
   * 重启 Kernel
   */
  async restartKernel(): Promise<void> {
    if (this.kernel) {
      await this.kernel.restart();
      console.log('[JupyterService] Kernel restarted');
    }
  }

  /**
   * 获取当前 Kernel 状态
   */
  getKernelStatus(): KernelStatus {
    if (!this.kernel) return 'disconnected';
    return this.mapKernelStatus(this.kernel.status);
  }

  /**
   * 获取当前 Kernel ID
   */
  getKernelId(): string | null {
    return this.kernel?.id || null;
  }

  /**
   * 获取当前 Kernel 显示名称（如 Python 3）
   */
  getKernelName(): string | null {
    if (!this.kernel) return null;
    const name = (this.kernel as { name?: string }).name ?? this.kernel.id;
    return name || null;
  }

  /**
   * 列出服务器上所有运行中的 Kernel（用于切换/CRUD）
   */
  async listRunningKernels(): Promise<Array<{ id: string; name: string }>> {
    if (!this.serverSettings) return [];
    try {
      const response = await ServerConnection.makeRequest(
        `${this.serverSettings.baseUrl}api/kernels`,
        {},
        this.serverSettings
      );
      if (!response.ok) return [];
      const data = (await response.json()) as Array<{ id: string; name: string }>;
      return Array.isArray(data) ? data.map((k) => ({ id: k.id, name: k.name || 'python3' })) : [];
    } catch {
      return [];
    }
  }

  /**
   * 执行代码
   */
  execute(cellId: string, code: string): ExecutionHandle {
    if (!this.kernel) {
      throw new Error('No kernel connected');
    }

    const outputs: Output[] = [];
    let resolveComplete: (result: ExecuteReply) => void;
    let rejectComplete: (error: Error) => void;

    const donePromise = new Promise<ExecuteReply>((resolve, reject) => {
      resolveComplete = resolve;
      rejectComplete = reject;
    });

    // 发送执行请求
    const future = this.kernel.requestExecute({
      code,
      silent: false,
      store_history: true,
      allow_stdin: false,
      stop_on_error: true,
    });

    const msgId = future.msg.header.msg_id;

    // 处理 IOPub 消息（输出）
    future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
      const output = this.parseIOPubMessage(msg);
      if (output) {
        outputs.push(output);
        this.events.onOutput?.(cellId, output);
      }
    };

    // 处理执行回复
    future.onReply = (msg: KernelMessage.IExecuteReplyMsg) => {
      const content = msg.content;
      this.executionCount = content.execution_count || this.executionCount + 1;

      const result: ExecuteReply = {
        status: content.status as 'ok' | 'error' | 'aborted',
        execution_count: this.executionCount,
      };

      if (content.status === 'error') {
        result.ename = content.ename;
        result.evalue = content.evalue;
        result.traceback = content.traceback;
      }

      resolveComplete(result);
    };

    // 处理错误
    future.onStdin = () => {
      // 不支持交互式输入
      console.warn('[JupyterService] Stdin request ignored');
    };

    // 创建执行句柄
    const handle: ExecutionHandle = {
      id: msgId,
      cellId,
      onOutput: (callback) => {
        const originalOnOutput = this.events.onOutput;
        this.events.onOutput = (id, output) => {
          if (id === cellId) callback(output);
          originalOnOutput?.(id, output);
        };
      },
      onComplete: (callback) => {
        donePromise.then(callback);
      },
      onError: (callback) => {
        donePromise.then((result) => {
          if (result.status === 'error') {
            callback({
              type: 'error',
              ename: result.ename || 'Error',
              evalue: result.evalue || 'Unknown error',
              traceback: result.traceback || [],
            });
          }
        });
      },
      cancel: () => {
        future.dispose();
        rejectComplete(new Error('Execution cancelled'));
      },
      done: donePromise,
    };

    return handle;
  }

  /**
   * 解析 IOPub 消息为 Output
   */
  private parseIOPubMessage(msg: KernelMessage.IIOPubMessage): Output | null {
    const msgType = msg.header.msg_type;
    const content = msg.content as Record<string, unknown>;

    switch (msgType) {
      case 'stream': {
        return {
          type: 'stream',
          name: content.name as 'stdout' | 'stderr',
          text: content.text as string,
        } satisfies StreamOutput;
      }

      case 'execute_result': {
        return {
          type: 'execute_result',
          executionCount: content.execution_count as number,
          data: content.data as Record<string, unknown>,
          metadata: content.metadata as Record<string, unknown>,
        } satisfies ExecuteResultOutput;
      }

      case 'display_data': {
        return {
          type: 'display_data',
          data: content.data as Record<string, unknown>,
          metadata: content.metadata as Record<string, unknown>,
        } satisfies DisplayDataOutput;
      }

      case 'error': {
        return {
          type: 'error',
          ename: content.ename as string,
          evalue: content.evalue as string,
          traceback: content.traceback as string[],
        } satisfies ErrorOutput;
      }

      case 'status':
      case 'execute_input':
        // 这些消息不作为输出处理
        return null;

      default:
        console.log(`[JupyterService] Unknown message type: ${msgType}`);
        return null;
    }
  }

  /**
   * 映射 Kernel 状态
   */
  private mapKernelStatus(status: Kernel.Status): KernelStatus {
    switch (status) {
      case 'idle':
        return 'idle';
      case 'busy':
        return 'busy';
      case 'starting':
        return 'starting';
      case 'restarting':
        return 'restarting';
      case 'dead':
        return 'dead';
      case 'unknown':
      default:
        return 'disconnected';
    }
  }
}

/**
 * 创建 JupyterService 实例的工厂函数
 */
export function createJupyterService(
  config: JupyterServiceConfig,
  events?: JupyterServiceEvents
): JupyterService {
  return new JupyterService(config, events);
}
