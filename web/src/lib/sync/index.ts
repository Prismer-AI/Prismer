/**
 * Sync Control Matrix Module
 *
 * 同步控制矩阵模块导出
 *
 * @example
 * ```typescript
 * import {
 *   SyncMatrixEngine,
 *   defaultSyncMatrix,
 *   createSyncMatrixEngine,
 *   rule,
 *   DATA_TYPES,
 * } from '@/lib/sync';
 *
 * // 使用默认矩阵
 * const engine = createSyncMatrixEngine(defaultSyncMatrix);
 *
 * // 检查权限
 * if (engine.canAccess('messages', 'mobile', 'read')) {
 *   // 移动端可以读取消息
 * }
 *
 * // 动态添加规则
 * engine.registerRule(
 *   rule('customData', '自定义数据')
 *     .serverOwned()
 *     .endpoint('desktop', 'readwrite')
 *     .persist('database', { table: 'custom_data' })
 *     .bidirectional()
 *     .build()
 * );
 * ```
 */

// ============================================================
// Types
// ============================================================

export type {
  // Endpoint & Access
  EndpointType,
  AccessMode,
  EndpointAccessConfig,
  EndpointConfigMap,

  // Persistence
  PersistenceStrategy,
  PersistenceConfig,

  // Sync
  SyncDirection,
  ConflictStrategy,
  SyncConfig,

  // Rule
  SyncRule,
  InteractionSignalConfig,
  SyncControlMatrix,

  // Runtime
  ClientInfo,
  ClientConnection,
  SessionState,
  AgentState,

  // Protocol
  ServerToClientMessage,
  ClientToServerMessage,
  StateDelta,
  UIDirective,
  UIDirectiveType,
  ComponentEventPayload,

  // Utility
  DeepPartial,
  DataType,
} from './types';

// ============================================================
// Constants
// ============================================================

export { ALL_ENDPOINTS, DATA_TYPES } from './types';

// ============================================================
// Engine
// ============================================================

export {
  SyncMatrixEngine,
  createSyncMatrixEngine,
  createEmptyMatrix,
  SyncRuleBuilder,
  rule,
} from './SyncMatrixEngine';

// ============================================================
// Default Matrix
// ============================================================

export {
  defaultSyncMatrix,
  getDefaultMatrix,
  getDatabaseTables,
  getDesktopWritableTypes,
  getMobileReadableTypes,
  createResearchNotesRule,
  createWhiteboardRule,
  createPaperCitationsRule,
} from './defaultMatrix';

// ============================================================
// Hooks (Client-side)
// ============================================================

// Low-level hook (无 Store 依赖)
export {
  useAgentConnection,
  useAgentEvent,
  useDesktopAgentConnection,
  useMobileAgentConnection,
} from './useAgentConnection';

export type {
  ClientCapability,
  UseAgentConnectionOptions,
  AgentConnectionResult,
} from './useAgentConnection';

// High-level hooks (workspace-aware) have moved to:
// @/app/workspace/hooks/useWorkspaceAgent
// Import useDesktopAgent, useMobileAgent from there instead.

// ============================================================
// Component State Config
// ============================================================

export {
  componentStateConfigs,
  getComponentConfig,
  shouldSyncField,
  shouldPersistField,
  canMobileAccess,
  filterSyncableState,
  filterPersistableState,
  filterMobileAccessibleState,
  getMobileRelevantComponents,
  filterComponentStatesForMobile,
} from './componentStateConfig';

export type {
  SyncMode,
  MobileAccess,
  FieldSyncConfig,
  ComponentStateSyncConfig,
} from './componentStateConfig';

// ============================================================
// Component Event Forwarder
// ============================================================

export {
  setComponentEventForwarder,
  forwardComponentEvent,
  hasComponentEventForwarder,
} from './componentEventForwarder';

// Component State Bridge
export {
  initComponentStateBridge,
} from './componentStateBridge';

// Content Sync Hooks
export {
  useContentSync,
  useMultiFieldContentSync,
} from './useContentSync';

// ============================================================
// Sync Utilities
// ============================================================

export {
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
} from './syncUtils';

// ============================================================
// Error Handling
// ============================================================

export {
  SyncErrorCode,
  SyncErrorHandler,
  createSyncErrorHandler,
  reconnectStrategy,
  resyncStrategy,
  defaultRecoveryStrategies,
} from './errorHandler';

export type {
  SyncError,
  ErrorHandlerConfig,
  RecoveryStrategy,
  RecoveryContext,
} from './errorHandler';

// ============================================================
// Examples
// ============================================================

export {
  researchNotesSyncRule,
  // createResearchNotesRule 已从 defaultMatrix 导出
  createResearchNotesSlice,
  createResearchNote,
  getAllTags,
  filterAndSortNotes,
} from './examples/researchNotes';

export type {
  ResearchNote,
  ResearchNotesState,
  ResearchNoteEvent,
  ResearchNotesActions,
} from './examples/researchNotes';
