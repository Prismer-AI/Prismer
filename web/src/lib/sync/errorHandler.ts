/**
 * Sync Error Handler
 *
 * 同步系统的错误处理、状态恢复、不一致检测
 */

import type { SessionState, StateDelta } from './types';
import { validateSessionState, detectStateInconsistency } from './syncUtils';

// ============================================================
// Error Types
// ============================================================

export enum SyncErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'CONNECTION_LOST',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  STATE_MISMATCH = 'STATE_MISMATCH',
  STATE_VALIDATION_FAILED = 'STATE_VALIDATION_FAILED',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface SyncError {
  code: SyncErrorCode;
  message: string;
  timestamp: number;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

// ============================================================
// Error Handler
// ============================================================

export interface ErrorHandlerConfig {
  /** 最大错误历史记录 */
  maxErrorHistory: number;
  /** 错误通知回调 */
  onError?: (error: SyncError) => void;
  /** 恢复成功回调 */
  onRecovery?: (errorCode: SyncErrorCode) => void;
  /** 是否启用自动恢复 */
  enableAutoRecovery: boolean;
  /** 状态不一致阈值（百分比差异） */
  inconsistencyThreshold: number;
}

const defaultConfig: ErrorHandlerConfig = {
  maxErrorHistory: 50,
  enableAutoRecovery: true,
  inconsistencyThreshold: 10,
};

export class SyncErrorHandler {
  private config: ErrorHandlerConfig;
  private errorHistory: SyncError[] = [];
  private recoveryAttempts: Map<SyncErrorCode, number> = new Map();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // ==================== Error Handling ====================

  /**
   * 处理错误
   */
  handleError(
    code: SyncErrorCode,
    message: string,
    details?: Record<string, unknown>
  ): SyncError {
    const error: SyncError = {
      code,
      message,
      timestamp: Date.now(),
      recoverable: this.isRecoverable(code),
      details,
    };

    // 记录错误
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory.shift();
    }

    // 通知
    this.config.onError?.(error);

    console.error(`[SyncError] ${code}: ${message}`, details);

    return error;
  }

  /**
   * 判断错误是否可恢复
   */
  isRecoverable(code: SyncErrorCode): boolean {
    switch (code) {
      case SyncErrorCode.CONNECTION_FAILED:
      case SyncErrorCode.CONNECTION_TIMEOUT:
      case SyncErrorCode.CONNECTION_LOST:
      case SyncErrorCode.STATE_MISMATCH:
        return true;
      case SyncErrorCode.MAX_RETRIES_EXCEEDED:
      case SyncErrorCode.INVALID_MESSAGE:
      case SyncErrorCode.STATE_VALIDATION_FAILED:
      case SyncErrorCode.SERVER_ERROR:
      case SyncErrorCode.UNKNOWN:
        return false;
      default:
        return false;
    }
  }

  // ==================== Recovery ====================

  /**
   * 尝试恢复
   */
  async attemptRecovery(
    code: SyncErrorCode,
    recoveryFn: () => Promise<boolean>
  ): Promise<boolean> {
    if (!this.config.enableAutoRecovery) {
      return false;
    }

    if (!this.isRecoverable(code)) {
      return false;
    }

    const attempts = (this.recoveryAttempts.get(code) || 0) + 1;
    this.recoveryAttempts.set(code, attempts);

    console.log(`[SyncError] Attempting recovery for ${code} (attempt ${attempts})`);

    try {
      const success = await recoveryFn();
      
      if (success) {
        this.recoveryAttempts.delete(code);
        this.config.onRecovery?.(code);
        console.log(`[SyncError] Recovery successful for ${code}`);
      }

      return success;
    } catch (err) {
      console.error(`[SyncError] Recovery failed for ${code}:`, err);
      return false;
    }
  }

  /**
   * 重置恢复计数
   */
  resetRecoveryAttempts(code?: SyncErrorCode): void {
    if (code) {
      this.recoveryAttempts.delete(code);
    } else {
      this.recoveryAttempts.clear();
    }
  }

  // ==================== State Validation ====================

  /**
   * 验证状态
   */
  validateState(state: unknown): SyncError | null {
    const result = validateSessionState(state);
    
    if (!result.valid) {
      return this.handleError(
        SyncErrorCode.STATE_VALIDATION_FAILED,
        'State validation failed',
        { errors: result.errors }
      );
    }

    return null;
  }

  /**
   * 检测状态不一致
   */
  checkStateConsistency(
    localState: SessionState,
    serverState: SessionState
  ): SyncError | null {
    const result = detectStateInconsistency(localState, serverState);

    if (!result.consistent) {
      // 计算差异百分比
      const localCount = localState.messages?.length || 0;
      const serverCount = serverState.messages?.length || 0;
      const diff = Math.abs(localCount - serverCount);
      const threshold = Math.max(localCount, serverCount) * (this.config.inconsistencyThreshold / 100);

      if (diff > threshold) {
        return this.handleError(
          SyncErrorCode.STATE_MISMATCH,
          'Significant state mismatch detected',
          {
            differences: result.differences,
            localMessageCount: localCount,
            serverMessageCount: serverCount,
          }
        );
      }
    }

    return null;
  }

  // ==================== Error History ====================

  /**
   * 获取错误历史
   */
  getErrorHistory(): SyncError[] {
    return [...this.errorHistory];
  }

  /**
   * 获取特定类型的最近错误
   */
  getLastError(code?: SyncErrorCode): SyncError | undefined {
    if (code) {
      return [...this.errorHistory].reverse().find(e => e.code === code);
    }
    return this.errorHistory[this.errorHistory.length - 1];
  }

  /**
   * 清除错误历史
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): Record<SyncErrorCode, number> {
    const stats: Record<string, number> = {};
    
    for (const error of this.errorHistory) {
      stats[error.code] = (stats[error.code] || 0) + 1;
    }

    return stats as Record<SyncErrorCode, number>;
  }
}

// ============================================================
// Recovery Strategies
// ============================================================

export interface RecoveryStrategy {
  /** 策略名称 */
  name: string;
  /** 适用的错误类型 */
  applicableTo: SyncErrorCode[];
  /** 执行恢复 */
  execute: (context: RecoveryContext) => Promise<boolean>;
}

export interface RecoveryContext {
  /** 当前连接状态 */
  isConnected: boolean;
  /** 重新连接函数 */
  reconnect: () => void;
  /** 请求完整状态函数 */
  requestFullState: () => void;
  /** 本地状态 */
  localState: SessionState | null;
  /** 错误处理器 */
  errorHandler: SyncErrorHandler;
}

/**
 * 重连策略
 */
export const reconnectStrategy: RecoveryStrategy = {
  name: 'reconnect',
  applicableTo: [
    SyncErrorCode.CONNECTION_FAILED,
    SyncErrorCode.CONNECTION_TIMEOUT,
    SyncErrorCode.CONNECTION_LOST,
  ],
  execute: async (context) => {
    if (context.isConnected) {
      return true;
    }

    return new Promise((resolve) => {
      context.reconnect();
      
      // 等待连接
      const checkInterval = setInterval(() => {
        if (context.isConnected) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve(true);
        }
      }, 100);

      // 超时
      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 10000);
    });
  },
};

/**
 * 状态重同步策略
 */
export const resyncStrategy: RecoveryStrategy = {
  name: 'resync',
  applicableTo: [SyncErrorCode.STATE_MISMATCH],
  execute: async (context) => {
    if (!context.isConnected) {
      return false;
    }

    context.requestFullState();

    // 等待状态更新
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 2000);
    });
  },
};

/**
 * 默认恢复策略列表
 */
export const defaultRecoveryStrategies: RecoveryStrategy[] = [
  reconnectStrategy,
  resyncStrategy,
];

// ============================================================
// Error Handler Factory
// ============================================================

/**
 * 创建带恢复功能的错误处理器
 */
export function createSyncErrorHandler(
  config?: Partial<ErrorHandlerConfig>,
  strategies: RecoveryStrategy[] = defaultRecoveryStrategies
) {
  const handler = new SyncErrorHandler(config);

  return {
    handler,
    strategies,

    /**
     * 处理错误并尝试恢复
     */
    async handleAndRecover(
      code: SyncErrorCode,
      message: string,
      context: RecoveryContext,
      details?: Record<string, unknown>
    ): Promise<{ error: SyncError; recovered: boolean }> {
      const error = handler.handleError(code, message, details);

      if (!error.recoverable) {
        return { error, recovered: false };
      }

      // 查找适用的恢复策略
      const strategy = strategies.find(s => s.applicableTo.includes(code));
      
      if (!strategy) {
        return { error, recovered: false };
      }

      const recovered = await handler.attemptRecovery(code, () =>
        strategy.execute({ ...context, errorHandler: handler })
      );

      return { error, recovered };
    },
  };
}

export default SyncErrorHandler;
