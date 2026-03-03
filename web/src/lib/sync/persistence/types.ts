/**
 * Session Persistence Types
 *
 * @description
 * Phase 3D: 会话持久化类型定义
 * 定义会话数据的存储和恢复接口
 */

import type { SessionState, ClientInfo } from '../types';

// ============================================================
// Persistence Interface
// ============================================================

/**
 * 会话持久化接口
 */
export interface SessionPersistence {
  /**
   * 保存会话状态
   */
  saveSession(sessionId: string, state: SessionState): Promise<void>;

  /**
   * 加载会话状态
   */
  loadSession(sessionId: string): Promise<SessionState | null>;

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * 列出所有会话
   */
  listSessions(options?: ListSessionsOptions): Promise<SessionSummary[]>;

  /**
   * 保存消息
   */
  saveMessage(sessionId: string, message: SessionMessage): Promise<void>;

  /**
   * 保存消息（批量）
   */
  saveMessages(sessionId: string, messages: SessionMessage[]): Promise<void>;

  /**
   * 加载消息
   */
  loadMessages(sessionId: string, options?: LoadMessagesOptions): Promise<SessionMessage[]>;

  /**
   * 保存任务
   */
  saveTask(sessionId: string, task: SessionTask): Promise<void>;

  /**
   * 保存任务（批量）
   */
  saveTasks(sessionId: string, tasks: SessionTask[]): Promise<void>;

  /**
   * 加载任务
   */
  loadTasks(sessionId: string): Promise<SessionTask[]>;

  /**
   * 保存时间线事件
   */
  saveTimelineEvent(sessionId: string, event: TimelineEvent): Promise<void>;

  /**
   * 保存时间线事件（批量）
   */
  saveTimelineEvents(sessionId: string, events: TimelineEvent[]): Promise<void>;

  /**
   * 加载时间线
   */
  loadTimeline(sessionId: string, options?: LoadTimelineOptions): Promise<TimelineEvent[]>;

  /**
   * 保存组件状态
   */
  saveComponentState(
    sessionId: string,
    componentType: string,
    state: unknown
  ): Promise<void>;

  /**
   * 加载组件状态
   */
  loadComponentStates(sessionId: string): Promise<Record<string, unknown>>;

  /**
   * 保存状态快照
   */
  saveSnapshot(sessionId: string, snapshot: StateSnapshot): Promise<void>;

  /**
   * 加载快照
   */
  loadSnapshots(sessionId: string, limit?: number): Promise<StateSnapshot[]>;

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>;

  /**
   * 关闭连接
   */
  close(): Promise<void>;
}

// ============================================================
// Data Types
// ============================================================

/**
 * 会话消息
 */
export interface SessionMessage {
  id: string;
  senderId: string;
  senderType: 'user' | 'agent';
  senderName: string;
  senderAvatar?: string;
  content: string;
  contentType: 'text' | 'markdown' | 'code' | 'image' | 'file';
  actions?: unknown[];
  interactive?: unknown[];
  uiDirectives?: unknown[];
  references?: string[];
  replyTo?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

/**
 * 会话任务
 */
export interface SessionTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  subtasks?: unknown[];
  outputs?: unknown[];
  dependencies?: string[];
  startTime?: number;
  endTime?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 时间线事件
 */
export interface TimelineEvent {
  id: string;
  timestamp: number;
  componentType: string;
  action: string;
  description: string;
  snapshot?: unknown;
  actorId?: string;
  actorType?: 'user' | 'agent';
  messageId?: string;
  duration?: number;
}

/**
 * 状态快照
 */
export interface StateSnapshot {
  id: string;
  layout?: unknown;
  components?: unknown;
  diff?: unknown;
  timelineEventId?: string;
  createdAt: number;
}

/**
 * 会话摘要
 */
export interface SessionSummary {
  sessionId: string;
  workspaceId: string;
  workspaceName?: string;
  messageCount: number;
  taskCount: number;
  lastActivityAt: number;
  createdAt: number;
  status: 'active' | 'archived';
}

// ============================================================
// Options
// ============================================================

/**
 * 列出会话选项
 */
export interface ListSessionsOptions {
  workspaceId?: string;
  status?: 'active' | 'archived';
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}

/**
 * 加载消息选项
 */
export interface LoadMessagesOptions {
  limit?: number;
  before?: number;
  after?: number;
}

/**
 * 加载时间线选项
 */
export interface LoadTimelineOptions {
  limit?: number;
  since?: number;
  componentType?: string;
}

// ============================================================
// Factory Types
// ============================================================

/**
 * 持久化类型
 */
export type PersistenceType = 'memory' | 'prisma';

/**
 * 持久化配置
 */
export interface PersistenceConfig {
  type: PersistenceType;
  options?: Record<string, unknown>;
}
