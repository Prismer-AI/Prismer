/**
 * Sync Control Matrix Types
 *
 * 同步控制矩阵类型定义
 * 用于配置多端数据同步策略
 */

// ============================================================
// Endpoint Types
// ============================================================

/** 端点类型 - 可扩展 */
export type EndpointType =
  | 'server'   // 服务端（权威源）
  | 'desktop'  // 桌面客户端
  | 'mobile'   // 移动客户端
  | 'web'      // Web 客户端
  | 'agent'    // AI Agent
  | 'cli'      // 命令行客户端
  | 'monitor'; // 监控客户端（只读）

/** 所有端点类型列表（用于遍历） */
export const ALL_ENDPOINTS: EndpointType[] = [
  'server', 'desktop', 'mobile', 'web', 'agent', 'cli', 'monitor'
];

// ============================================================
// Access Mode Types
// ============================================================

/** 访问权限模式 */
export type AccessMode =
  | 'owner'      // 权威源，负责生成和管理
  | 'read'       // 只读
  | 'write'      // 只写（如发送交互）
  | 'readwrite'  // 读写
  | 'partial'    // 部分（按能力过滤）
  | 'none';      // 不参与

// ============================================================
// Persistence Types
// ============================================================

/** 持久化策略 */
export type PersistenceStrategy =
  | 'database'   // 持久化到数据库 (SQLite/PostgreSQL)
  | 'memory'     // 仅内存（服务端重启丢失）
  | 'cache'      // 缓存（Redis 等，带 TTL）
  | 'file'       // JSON 文件
  | 'none';      // 不持久化

/** 持久化配置 */
export interface PersistenceConfig {
  strategy: PersistenceStrategy;
  table?: string;          // 数据库表名（strategy='database' 时）
  ttl?: number;            // 过期时间(ms)，用于 cache/memory
  maxItems?: number;       // 最大条目数（用于 timeline/snapshots）
  compression?: boolean;   // 是否压缩（用于大数据）
}

// ============================================================
// Sync Direction Types
// ============================================================

/** 同步方向 */
export type SyncDirection =
  | 'broadcast'     // 服务端 → 所有客户端
  | 'request'       // 客户端 → 服务端
  | 'bidirectional' // 双向
  | 'p2p'           // 点对点（特殊场景）
  | 'none';         // 不同步

/** 冲突解决策略 */
export type ConflictStrategy =
  | 'server_wins'   // 服务端优先
  | 'latest_wins'   // 时间戳最新优先
  | 'merge'         // 尝试合并（如 Set 操作）
  | 'ask_user';     // 询问用户

/** 同步配置 */
export interface SyncConfig {
  direction: SyncDirection;
  conflictStrategy: ConflictStrategy;
  throttleMs?: number;     // 节流时间（防抖动）
  batchSize?: number;      // 批量大小
  debounceMs?: number;     // 防抖时间
  priority?: number;       // 优先级（0 最高）
}

// ============================================================
// Endpoint Access Configuration
// ============================================================

/** 端点访问配置 */
export interface EndpointAccessConfig {
  access: AccessMode;
  filter?: string[];                    // 能力过滤器
  transform?: string;                   // 数据转换器名称
  requiredCapabilities?: string[];      // 执行所需能力
}

/** 端点配置映射 */
export type EndpointConfigMap = {
  [K in EndpointType]?: EndpointAccessConfig;
};

// ============================================================
// Interaction Signal Types
// ============================================================

/** 交互信号配置 */
export interface InteractionSignalConfig {
  canTrigger: EndpointType[];           // 哪些端可以触发
  targetEndpoints: EndpointType[];      // 信号发送目标
  signalTypes?: string[];               // 支持的信号类型
  requiresAck?: boolean;                // 是否需要确认
}

// ============================================================
// Sync Rule Definition
// ============================================================

/** 同步规则定义 */
export interface SyncRule {
  /** 数据类型标识（唯一） */
  dataType: string;

  /** 人类可读描述 */
  description: string;

  /** 端点访问配置 */
  endpoints: EndpointConfigMap;

  /** 持久化配置 */
  persistence: PersistenceConfig;

  /** 同步配置 */
  sync: SyncConfig;

  /** 交互信号配置（可选） */
  interactionSignals?: InteractionSignalConfig;

  /** 是否启用 */
  enabled?: boolean;

  /** 版本（用于迁移） */
  version?: number;
}

// ============================================================
// Sync Control Matrix
// ============================================================

/** 同步控制矩阵 */
export interface SyncControlMatrix {
  /** 矩阵版本 */
  version: string;

  /** 规则列表 */
  rules: SyncRule[];

  /** 全局配置 */
  globalConfig?: {
    defaultThrottleMs?: number;
    defaultTimeout?: number;
    enableDebugLogging?: boolean;
  };
}

// ============================================================
// Runtime Types
// ============================================================

/** 客户端信息 */
export interface ClientInfo {
  clientId: string;
  clientType: EndpointType;
  capabilities: string[];
  platform: string;
  version?: string;
  connectedAt: number;
}

/** 客户端连接 */
export interface ClientConnection extends ClientInfo {
  sessionId: string;
  ws: unknown;  // WebSocket 实例，类型在运行时确定
}

/** 会话状态 */
export interface SessionState {
  sessionId: string;
  messages: unknown[];
  tasks: unknown[];
  participants: unknown[];
  completedInteractions: string[];
  timeline: unknown[];
  stateSnapshots: unknown[];
  componentStates: Record<string, unknown>;
  agentState: AgentState;
  createdAt: number;
  updatedAt: number;
}

/** Agent 状态 */
export interface AgentState {
  status: 'idle' | 'starting' | 'running' | 'completed' | 'waiting_interaction' | 'paused' | 'error';
  currentStep?: number;
  totalSteps?: number;
  stepMessage?: string;
  stepDetail?: string;
  waitingFor?: {
    componentId: string;
    possibleActions: string[];
  };
  error?: string;
}

// ============================================================
// Message Protocol Types
// ============================================================

/** 服务端 → 客户端消息 */
export type ServerToClientMessage =
  | { type: 'FULL_STATE'; payload: SessionState }
  | { type: 'STATE_DELTA'; payload: StateDelta }
  | { type: 'UI_DIRECTIVE'; payload: UIDirective }
  | { type: 'AGENT_STATUS'; payload: AgentState }
  | { type: 'ERROR'; payload: { code: string; message: string } }
  | { type: 'ACK'; payload: { messageId: string; success: boolean } };

/** 客户端 → 服务端消息 */
export type ClientToServerMessage =
  | { type: 'REGISTER_CLIENT'; payload: Omit<ClientInfo, 'clientId' | 'connectedAt'> }
  | { type: 'USER_MESSAGE'; payload: { content: string; metadata?: unknown } }
  | { type: 'USER_INTERACTION'; payload: { componentId: string; actionId: string; data?: unknown } }
  | { type: 'USER_COMMAND'; payload: { command: 'reset' | 'pause' | 'resume'; args?: unknown } }
  | { type: 'REQUEST_FULL_STATE' }
  | { type: 'COMPONENT_EVENT'; payload: ComponentEventPayload }
  | { type: 'SYNC_DATA'; payload: { dataType: string; data: unknown } };

/** 状态增量 */
export interface StateDelta {
  messages?: { added?: unknown[]; updated?: unknown[]; removed?: string[] };
  tasks?: unknown[];
  participants?: unknown[];
  completedInteractions?: { added?: string[]; removed?: string[] };
  timeline?: { added?: unknown[] };
  stateSnapshots?: { added?: unknown[] };
  componentStates?: Record<string, unknown>;
  agentState?: Partial<AgentState>;
}

/** UI 指令 */
export interface UIDirective {
  id: string;
  type: UIDirectiveType;
  payload: unknown;
  targetCapabilities?: string[];
  delay?: number;
}

/** UI 指令类型 */
export type UIDirectiveType =
  | 'SWITCH_COMPONENT'
  | 'LOAD_DOCUMENT'
  | 'SHOW_NOTIFICATION'
  | 'UPDATE_TASK_STATUS'
  | 'HIGHLIGHT_MESSAGE'
  | 'HIGHLIGHT_ELEMENT'
  | 'SCROLL_TO'
  | 'PLAY_ANIMATION'
  // 代码编辑器指令
  | 'UPDATE_CODE'
  | 'EXECUTE_CODE'
  | 'TERMINAL_OUTPUT'
  // 数据网格指令
  | 'UPDATE_DATA_GRID'
  // Jupyter 指令
  | 'UPDATE_NOTEBOOK'
  | 'EXECUTE_CELL'
  // LaTeX 指令
  | 'UPDATE_LATEX'
  | 'COMPILE_LATEX'
  // PDF 阅读器指令
  | 'SEND_PDF_CHAT'
  | 'PDF_CHAT_RESPONSE'
  // 消息控制
  | 'CLEAR_MESSAGES'
  // 组件状态
  | 'UPDATE_COMPONENT_STATE';

/** 组件事件载荷 */
export interface ComponentEventPayload {
  component: string;
  type: 'ready' | 'contentLoaded' | 'actionComplete' | 'actionFailed' | 'stateChanged';
  payload?: {
    action?: string;
    result?: unknown;
    error?: string;
    state?: unknown;
  };
  timestamp: number;
}

// ============================================================
// Utility Types
// ============================================================

/** 深度 Partial 类型 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** 数据类型字符串常量 */
export const DATA_TYPES = {
  MESSAGES: 'messages',
  TASKS: 'tasks',
  PARTICIPANTS: 'participants',
  COMPLETED_INTERACTIONS: 'completedInteractions',
  TIMELINE: 'timeline',
  STATE_SNAPSHOTS: 'stateSnapshots',
  COMPONENT_STATES: 'componentStates',
  ACTIVE_COMPONENT: 'activeComponent',
  AGENT_STATE: 'agentState',
  UI_DIRECTIVE: 'uiDirective',
  LAYOUT_STATE: 'layoutState',
} as const;

export type DataType = typeof DATA_TYPES[keyof typeof DATA_TYPES];
