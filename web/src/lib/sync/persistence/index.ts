/**
 * Session Persistence Module
 *
 * @description
 * Phase 3D: 会话持久化模块
 * 提供会话数据的存储和恢复功能
 */

// Types
export type {
  SessionPersistence,
  SessionMessage,
  SessionTask,
  TimelineEvent,
  StateSnapshot,
  SessionSummary,
  ListSessionsOptions,
  LoadMessagesOptions,
  LoadTimelineOptions,
  PersistenceType,
  PersistenceConfig,
} from './types';

// Implementations
export { MemorySessionPersistence } from './MemorySessionPersistence';
export { PrismaSessionPersistence } from './PrismaSessionPersistence';

// Factory
import type { SessionPersistence, PersistenceConfig } from './types';
import { MemorySessionPersistence } from './MemorySessionPersistence';
import { PrismaSessionPersistence } from './PrismaSessionPersistence';

let _defaultPersistence: SessionPersistence | null = null;

/**
 * 创建持久化实例
 */
export function createPersistence(config: PersistenceConfig): SessionPersistence {
  switch (config.type) {
    case 'memory':
      return new MemorySessionPersistence();
    case 'prisma':
      return new PrismaSessionPersistence();
    default:
      throw new Error(`Unknown persistence type: ${config.type}`);
  }
}

/**
 * 获取默认持久化实例
 */
export function getDefaultPersistence(): SessionPersistence {
  if (!_defaultPersistence) {
    // 根据环境选择默认持久化
    const useDatabase = process.env.NODE_ENV === 'production' ||
      process.env.SYNC_PERSISTENCE === 'prisma';

    _defaultPersistence = createPersistence({
      type: useDatabase ? 'prisma' : 'memory',
    });
  }
  return _defaultPersistence;
}

/**
 * 设置默认持久化实例
 */
export function setDefaultPersistence(persistence: SessionPersistence): void {
  _defaultPersistence = persistence;
}
