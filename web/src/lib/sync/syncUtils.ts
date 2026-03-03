/**
 * Sync Utilities
 *
 * 同步系统的工具函数：节流、批量处理、状态压缩
 */

// ============================================================
// Throttle & Debounce
// ============================================================

/**
 * 创建一个节流函数
 * @param fn 要节流的函数
 * @param delay 延迟时间(ms)
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs = args;

    if (now - lastCall >= delay) {
      fn(...args);
      lastCall = now;
    } else if (!timeoutId) {
      // Schedule trailing call
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          fn(...lastArgs);
          lastCall = Date.now();
        }
        timeoutId = null;
      }, delay - (now - lastCall));
    }
  };
}

/**
 * 创建一个防抖函数
 * @param fn 要防抖的函数
 * @param delay 延迟时间(ms)
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// ============================================================
// Batch Processing
// ============================================================

interface BatchConfig<T> {
  /** 最大批量大小 */
  maxSize: number;
  /** 最大等待时间(ms) */
  maxWait: number;
  /** 处理函数 */
  processor: (items: T[]) => void;
}

/**
 * 创建一个批量处理器
 */
export function createBatchProcessor<T>(config: BatchConfig<T>) {
  const { maxSize, maxWait, processor } = config;
  let batch: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  const flush = () => {
    if (batch.length > 0) {
      processor([...batch]);
      batch = [];
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const add = (item: T) => {
    batch.push(item);

    if (batch.length >= maxSize) {
      flush();
      return;
    }

    if (!timeoutId) {
      timeoutId = setTimeout(flush, maxWait);
    }
  };

  return {
    add,
    flush,
    size: () => batch.length,
  };
}

// ============================================================
// State Compression
// ============================================================

/**
 * 计算两个状态之间的差异
 */
export function computeStateDiff<T extends Record<string, any>>(
  oldState: T,
  newState: T
): Partial<T> {
  const diff: Partial<T> = {};

  for (const key of Object.keys(newState) as (keyof T)[]) {
    const oldValue = oldState[key];
    const newValue = newState[key];

    if (!deepEqual(oldValue, newValue)) {
      diff[key] = newValue;
    }
  }

  return diff;
}

/**
 * 深度比较两个值
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * 合并多个状态增量
 */
export function mergeDeltas<T extends Record<string, any>>(
  ...deltas: Partial<T>[]
): Partial<T> {
  return deltas.reduce((merged, delta) => {
    for (const key of Object.keys(delta) as (keyof T)[]) {
      const existing = merged[key];
      const incoming = delta[key];

      if (Array.isArray(existing) && Array.isArray(incoming)) {
        // 合并数组 (去重)
        merged[key] = [...new Set([...existing, ...incoming])] as any;
      } else if (
        typeof existing === 'object' &&
        existing !== null &&
        typeof incoming === 'object' &&
        incoming !== null
      ) {
        // 深度合并对象
        merged[key] = { ...existing, ...incoming };
      } else {
        // 覆盖
        merged[key] = incoming;
      }
    }
    return merged;
  }, {} as Partial<T>);
}

// ============================================================
// Message Deduplication
// ============================================================

interface DedupeConfig {
  /** 最大缓存大小 */
  maxSize: number;
  /** 过期时间(ms) */
  ttl: number;
}

/**
 * 创建一个消息去重器
 */
export function createMessageDeduplicator(config: DedupeConfig) {
  const { maxSize, ttl } = config;
  const seen = new Map<string, number>();

  const cleanup = () => {
    const now = Date.now();
    for (const [id, timestamp] of seen) {
      if (now - timestamp > ttl) {
        seen.delete(id);
      }
    }
  };

  // 定期清理
  const cleanupInterval = setInterval(cleanup, ttl);

  return {
    /**
     * 检查消息是否重复
     * @returns true 如果消息是新的，false 如果是重复的
     */
    check(messageId: string): boolean {
      if (seen.has(messageId)) {
        return false;
      }

      seen.set(messageId, Date.now());

      // 超过大小限制时清理
      if (seen.size > maxSize) {
        cleanup();
      }

      return true;
    },

    /** 清空缓存 */
    clear(): void {
      seen.clear();
    },

    /** 销毁 */
    destroy(): void {
      clearInterval(cleanupInterval);
      seen.clear();
    },

    /** 当前缓存大小 */
    size(): number {
      return seen.size;
    },
  };
}

// ============================================================
// Reconnection
// ============================================================

interface ReconnectConfig {
  /** 初始延迟(ms) */
  initialDelay: number;
  /** 最大延迟(ms) */
  maxDelay: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 退避因子 */
  backoffFactor: number;
}

const defaultReconnectConfig: ReconnectConfig = {
  initialDelay: 1000,
  maxDelay: 30000,
  maxRetries: 10,
  backoffFactor: 2,
};

/**
 * 创建一个重连管理器
 */
export function createReconnectManager(config: Partial<ReconnectConfig> = {}) {
  const { initialDelay, maxDelay, maxRetries, backoffFactor } = {
    ...defaultReconnectConfig,
    ...config,
  };

  let retryCount = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  const getNextDelay = (): number => {
    const delay = initialDelay * Math.pow(backoffFactor, retryCount);
    return Math.min(delay, maxDelay);
  };

  return {
    /**
     * 安排重连
     * @returns 如果应该重连返回延迟时间，否则返回 null
     */
    scheduleReconnect(onReconnect: () => void): number | null {
      if (retryCount >= maxRetries) {
        return null;
      }

      const delay = getNextDelay();
      retryCount++;

      timeoutId = setTimeout(onReconnect, delay);
      return delay;
    },

    /** 重置重试计数 */
    reset(): void {
      retryCount = 0;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },

    /** 取消计划的重连 */
    cancel(): void {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },

    /** 获取重试次数 */
    getRetryCount(): number {
      return retryCount;
    },

    /** 是否可以继续重试 */
    canRetry(): boolean {
      return retryCount < maxRetries;
    },
  };
}

// ============================================================
// State Validation
// ============================================================

/**
 * 验证会话状态的完整性
 */
export function validateSessionState(state: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!state) {
    errors.push('State is null or undefined');
    return { valid: false, errors };
  }

  if (typeof state.sessionId !== 'string') {
    errors.push('Missing or invalid sessionId');
  }

  if (!Array.isArray(state.messages)) {
    errors.push('Missing or invalid messages array');
  }

  if (!Array.isArray(state.tasks)) {
    errors.push('Missing or invalid tasks array');
  }

  if (!Array.isArray(state.participants)) {
    errors.push('Missing or invalid participants array');
  }

  if (!Array.isArray(state.completedInteractions)) {
    errors.push('Missing or invalid completedInteractions array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 检测状态不一致
 */
export function detectStateInconsistency(
  localState: any,
  serverState: any
): { consistent: boolean; differences: string[] } {
  const differences: string[] = [];

  // 检查消息数量
  if (localState.messages?.length !== serverState.messages?.length) {
    differences.push(
      `Message count mismatch: local=${localState.messages?.length}, server=${serverState.messages?.length}`
    );
  }

  // 检查任务数量
  if (localState.tasks?.length !== serverState.tasks?.length) {
    differences.push(
      `Task count mismatch: local=${localState.tasks?.length}, server=${serverState.tasks?.length}`
    );
  }

  // 检查已完成交互
  const localInteractions = new Set(localState.completedInteractions || []);
  const serverInteractions = new Set(serverState.completedInteractions || []);
  
  if (localInteractions.size !== serverInteractions.size) {
    differences.push(
      `Completed interactions mismatch: local=${localInteractions.size}, server=${serverInteractions.size}`
    );
  }

  return {
    consistent: differences.length === 0,
    differences,
  };
}

// ============================================================
// Exports
// ============================================================

export default {
  throttle,
  debounce,
  createBatchProcessor,
  computeStateDiff,
  deepEqual,
  mergeDeltas,
  createMessageDeduplicator,
  createReconnectManager,
  validateSessionState,
  detectStateInconsistency,
};
