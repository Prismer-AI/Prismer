/**
 * Agent Service Types
 *
 * @description
 * Phase 3A: Agent 服务抽象层类型定义
 * 定义 AgentService 接口和 AgentEvent 类型，用于统一不同 Agent 后端实现
 *
 * 设计原则:
 * - 与 OpenClaw 协议兼容
 * - 与现有 Sync 协议对接
 * - 支持流式事件处理
 */

import type { SessionState, AgentState, UIDirective, StateDelta } from '@/lib/sync/types';

// ============================================================
// Agent Event Types
// ============================================================

/**
 * Agent 事件类型枚举
 */
export type AgentEventType =
  // 生命周期事件
  | 'session_start'
  | 'session_end'
  | 'session_error'
  // Agent 状态变更
  | 'agent_thinking'
  | 'agent_responding'
  | 'agent_waiting'
  | 'agent_idle'
  | 'agent_error'
  // 消息事件
  | 'message_start'
  | 'message_delta'
  | 'message_end'
  // 工具调用事件
  | 'tool_start'
  | 'tool_progress'
  | 'tool_end'
  | 'tool_error'
  // 任务事件
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_failed'
  // UI 指令事件
  | 'ui_directive'
  // 组件状态事件
  | 'component_state_update'
  // 交互请求事件
  | 'interaction_request'
  | 'interaction_response';

/**
 * 消息增量内容
 */
export interface MessageDelta {
  /** 消息 ID */
  messageId: string;
  /** 增量内容类型 */
  type: 'text' | 'code' | 'markdown' | 'thinking';
  /** 增量文本 */
  content: string;
  /** 是否为最后一块 */
  isFinal?: boolean;
}

/**
 * 工具调用信息
 */
export interface ToolCall {
  /** 工具调用 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  arguments: Record<string, unknown>;
  /** 调用状态 */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** 进度 (0-100) */
  progress?: number;
  /** 结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
}

/**
 * 交互请求
 */
export interface InteractionRequest {
  /** 请求 ID */
  id: string;
  /** 目标组件 */
  componentId: string;
  /** 可执行的动作 */
  possibleActions: string[];
  /** 提示信息 */
  prompt?: string;
  /** 超时时间 (ms) */
  timeout?: number;
}

/**
 * Agent 事件基础结构
 */
export interface AgentEventBase {
  /** 事件 ID */
  id: string;
  /** 事件类型 */
  type: AgentEventType;
  /** 会话 ID */
  sessionId: string;
  /** 时间戳 (epoch ms) */
  timestamp: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Agent 事件联合类型
 */
export type AgentEvent =
  | (AgentEventBase & { type: 'session_start'; payload: { sessionId: string; agentId: string } })
  | (AgentEventBase & { type: 'session_end'; payload: { reason: string } })
  | (AgentEventBase & { type: 'session_error'; payload: { code: string; message: string } })
  | (AgentEventBase & { type: 'agent_thinking'; payload: { thought?: string } })
  | (AgentEventBase & { type: 'agent_responding'; payload: { messageId: string } })
  | (AgentEventBase & { type: 'agent_waiting'; payload: InteractionRequest })
  | (AgentEventBase & { type: 'agent_idle'; payload: Record<string, never> })
  | (AgentEventBase & { type: 'agent_error'; payload: { code: string; message: string } })
  | (AgentEventBase & { type: 'message_start'; payload: { messageId: string; senderId: string; senderType: 'agent' | 'user' } })
  | (AgentEventBase & { type: 'message_delta'; payload: MessageDelta })
  | (AgentEventBase & { type: 'message_end'; payload: { messageId: string; content: string; actions?: unknown[] } })
  | (AgentEventBase & { type: 'tool_start'; payload: ToolCall })
  | (AgentEventBase & { type: 'tool_progress'; payload: { toolId: string; progress: number; status?: string } })
  | (AgentEventBase & { type: 'tool_end'; payload: { toolId: string; result: unknown } })
  | (AgentEventBase & { type: 'tool_error'; payload: { toolId: string; error: string } })
  | (AgentEventBase & { type: 'task_created'; payload: { taskId: string; title: string; description?: string } })
  | (AgentEventBase & { type: 'task_updated'; payload: { taskId: string; status: string; progress: number } })
  | (AgentEventBase & { type: 'task_completed'; payload: { taskId: string; outputs?: unknown[] } })
  | (AgentEventBase & { type: 'task_failed'; payload: { taskId: string; error: string } })
  | (AgentEventBase & { type: 'ui_directive'; payload: UIDirective })
  | (AgentEventBase & { type: 'component_state_update'; payload: { componentType: string; state: unknown } })
  | (AgentEventBase & { type: 'interaction_request'; payload: InteractionRequest })
  | (AgentEventBase & { type: 'interaction_response'; payload: { requestId: string; action: string; data?: unknown } });

// ============================================================
// Agent Service Interface
// ============================================================

/**
 * 会话配置
 */
export interface SessionConfig {
  /** 会话 ID (可选，不提供则自动生成) */
  sessionId?: string;
  /** Agent Instance ID */
  agentId: string;
  /** 用户 ID */
  userId: string;
  /** Workspace ID */
  workspaceId: string;
  /** 初始上下文 */
  context?: {
    /** 相关论文 */
    papers?: string[];
    /** 相关笔记 */
    notes?: string[];
    /** 初始消息 */
    initialMessage?: string;
  };
}

/**
 * 任务执行配置
 */
export interface TaskConfig {
  /** 任务标题 */
  title: string;
  /** 任务描述 */
  description?: string;
  /** 任务类型 */
  type?: 'research' | 'writing' | 'analysis' | 'review' | 'general';
  /** 依赖的任务 ID */
  dependencies?: string[];
  /** 优先级 */
  priority?: number;
  /** 超时时间 (ms) */
  timeout?: number;
}

/**
 * 用户交互数据
 */
export interface UserInteraction {
  /** 组件 ID */
  componentId: string;
  /** 动作 ID */
  actionId: string;
  /** 附加数据 */
  data?: unknown;
}

/**
 * Agent 服务接口
 *
 * @description
 * 定义 Agent 后端必须实现的方法。
 * 支持 DemoAgentService (本地演示) 和 OpenClawAgentService (生产环境)。
 */
export interface AgentService {
  /**
   * 服务类型标识
   */
  readonly type: 'demo' | 'openclaw';

  /**
   * 启动会话
   *
   * @param config - 会话配置
   * @returns 会话状态
   */
  startSession(config: SessionConfig): Promise<SessionState>;

  /**
   * 结束会话
   *
   * @param sessionId - 会话 ID
   */
  endSession(sessionId: string): Promise<void>;

  /**
   * 发送用户消息
   *
   * @param sessionId - 会话 ID
   * @param content - 消息内容
   * @param metadata - 元数据
   */
  sendMessage(
    sessionId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;

  /**
   * 执行任务
   *
   * @param sessionId - 会话 ID
   * @param config - 任务配置
   * @returns 任务 ID
   */
  executeTask(sessionId: string, config: TaskConfig): Promise<string>;

  /**
   * 处理用户交互
   *
   * @param sessionId - 会话 ID
   * @param interaction - 交互数据
   */
  handleInteraction(sessionId: string, interaction: UserInteraction): Promise<void>;

  /**
   * 暂停会话
   *
   * @param sessionId - 会话 ID
   */
  pauseSession(sessionId: string): Promise<void>;

  /**
   * 恢复会话
   *
   * @param sessionId - 会话 ID
   */
  resumeSession(sessionId: string): Promise<void>;

  /**
   * 获取会话状态
   *
   * @param sessionId - 会话 ID
   * @returns 会话状态
   */
  getSessionState(sessionId: string): Promise<SessionState | null>;

  /**
   * 订阅事件流
   *
   * @param sessionId - 会话 ID
   * @param handler - 事件处理函数
   * @returns 取消订阅函数
   */
  subscribe(sessionId: string, handler: AgentEventHandler): () => void;

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Agent 事件处理器
 */
export type AgentEventHandler = (event: AgentEvent) => void | Promise<void>;

// ============================================================
// Event to Sync Protocol Mapping
// ============================================================

/**
 * AgentEvent → Sync 协议消息映射配置
 */
export interface EventToSyncMapping {
  /** Agent 事件类型 */
  eventType: AgentEventType;
  /** 对应的 Sync 消息类型 */
  syncType: 'STATE_DELTA' | 'UI_DIRECTIVE' | 'AGENT_STATUS';
  /** 转换函数 */
  transform: (event: AgentEvent) => StateDelta | UIDirective | AgentState;
}

/**
 * 创建 Agent 事件
 */
export function createAgentEvent<T extends AgentEventType>(
  type: T,
  sessionId: string,
  payload: Extract<AgentEvent, { type: T }>['payload']
): Extract<AgentEvent, { type: T }> {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    sessionId,
    timestamp: Date.now(),
    payload,
  } as Extract<AgentEvent, { type: T }>;
}

// ============================================================
// Service Factory Types
// ============================================================

/**
 * Agent 服务工厂配置
 */
export interface AgentServiceFactoryConfig {
  /** 默认服务类型 */
  defaultType: 'demo' | 'openclaw';
  /** Demo 服务配置 */
  demo?: {
    /** 模拟延迟 (ms) */
    simulatedDelay?: number;
    /** 是否启用演示流程 */
    enableDemoFlow?: boolean;
  };
  /** OpenClaw 服务配置 */
  openclaw?: {
    /** Gateway URL */
    gatewayUrl: string;
    /** 认证 Token */
    authToken?: string;
    /** 超时时间 (ms) */
    timeout?: number;
    /** 重试次数 */
    retryCount?: number;
  };
}

/**
 * 服务创建选项
 */
export interface CreateServiceOptions {
  /** 服务类型 (覆盖默认) */
  type?: 'demo' | 'openclaw';
  /** Agent Instance ID */
  agentId: string;
  /** Gateway URL (OpenClaw 专用) */
  gatewayUrl?: string;
}
