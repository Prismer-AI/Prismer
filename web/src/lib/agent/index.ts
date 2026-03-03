/**
 * Agent Service Module
 *
 * @description
 * Phase 3: OpenClaw Agent 集成层
 * 提供统一的 Agent 服务抽象，支持 Demo 和 OpenClaw 后端
 *
 * @example
 * ```typescript
 * import { createAgentService, AgentServiceFactory } from '@/lib/agent';
 *
 * // 自动选择服务类型
 * const service = createAgentService('agent-123', 'ws://localhost:18900');
 *
 * // 启动会话
 * const state = await service.startSession({
 *   agentId: 'agent-123',
 *   userId: 'user-1',
 *   workspaceId: 'ws-1',
 * });
 *
 * // 订阅事件
 * const unsubscribe = service.subscribe(state.sessionId, (event) => {
 *   console.log('Event:', event);
 * });
 *
 * // 发送消息
 * await service.sendMessage(state.sessionId, 'Hello!');
 * ```
 */

// Types
export type {
  AgentService,
  AgentEvent,
  AgentEventType,
  AgentEventHandler,
  SessionConfig,
  TaskConfig,
  UserInteraction,
  MessageDelta,
  ToolCall,
  InteractionRequest,
  AgentServiceFactoryConfig,
  CreateServiceOptions,
} from './types';

export { createAgentEvent } from './types';

// Services
export { DemoAgentService } from './DemoAgentService';
export { OpenClawAgentService, type OpenClawConfig } from './OpenClawAgentService';

// Factory
export {
  AgentServiceFactory,
  getAgentService,
  createDemoService,
  createOpenClawService,
  createAgentService,
} from './AgentServiceFactory';

// Event Mapping
export {
  agentEventToSyncMessage,
  MessageAccumulator,
  ToolCallTracker,
  AgentEventStreamHandler,
} from './eventMapper';
