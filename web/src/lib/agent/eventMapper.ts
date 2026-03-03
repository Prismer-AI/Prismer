/**
 * Agent Event to Sync Protocol Mapper
 *
 * @description
 * Phase 3A: 将 AgentEvent 映射到 Sync 协议消息
 * 统一处理 Agent 事件到客户端同步消息的转换
 */

import type {
  AgentEvent,
  AgentEventType,
  MessageDelta,
  ToolCall,
  InteractionRequest,
} from './types';
import type {
  ServerToClientMessage,
  StateDelta,
  UIDirective,
  AgentState,
} from '@/lib/sync/types';

// ============================================================
// Event to Sync Message Converter
// ============================================================

/**
 * 将 AgentEvent 转换为 ServerToClientMessage
 */
export function agentEventToSyncMessage(event: AgentEvent): ServerToClientMessage | null {
  switch (event.type) {
    // Agent 状态变更 → AGENT_STATUS
    case 'agent_thinking':
      return {
        type: 'AGENT_STATUS',
        payload: {
          status: 'running',
          waitingFor: undefined,
          error: undefined,
        },
      };

    case 'agent_responding':
      return {
        type: 'AGENT_STATUS',
        payload: {
          status: 'running',
          waitingFor: undefined,
        },
      };

    case 'agent_waiting':
      return {
        type: 'AGENT_STATUS',
        payload: {
          status: 'waiting_interaction',
          waitingFor: {
            componentId: event.payload.componentId,
            possibleActions: event.payload.possibleActions,
          },
        },
      };

    case 'agent_idle':
      return {
        type: 'AGENT_STATUS',
        payload: {
          status: 'idle',
          waitingFor: undefined,
        },
      };

    case 'agent_error':
      return {
        type: 'AGENT_STATUS',
        payload: {
          status: 'error',
          error: event.payload.message,
        },
      };

    // 消息事件 → STATE_DELTA
    case 'message_end':
      return {
        type: 'STATE_DELTA',
        payload: {
          messages: {
            added: [{
              id: event.payload.messageId,
              content: event.payload.content,
              senderId: 'agent',
              senderType: 'agent',
              senderName: 'Research Assistant',
              actions: event.payload.actions,
              createdAt: event.timestamp,
            }],
          },
        },
      };

    // 任务事件 → STATE_DELTA
    case 'task_created':
      return {
        type: 'STATE_DELTA',
        payload: {
          tasks: [{
            id: event.payload.taskId,
            title: event.payload.title,
            description: event.payload.description,
            status: 'pending',
            progress: 0,
          }],
        },
      };

    case 'task_updated':
      return {
        type: 'STATE_DELTA',
        payload: {
          tasks: [{
            id: event.payload.taskId,
            status: event.payload.status,
            progress: event.payload.progress,
          }],
        },
      };

    case 'task_completed':
      return {
        type: 'STATE_DELTA',
        payload: {
          tasks: [{
            id: event.payload.taskId,
            status: 'completed',
            progress: 100,
            outputs: event.payload.outputs,
          }],
        },
      };

    case 'task_failed':
      return {
        type: 'STATE_DELTA',
        payload: {
          tasks: [{
            id: event.payload.taskId,
            status: 'error',
            error: event.payload.error,
          }],
        },
      };

    // UI 指令事件 → UI_DIRECTIVE
    case 'ui_directive':
      return {
        type: 'UI_DIRECTIVE',
        payload: event.payload,
      };

    // 组件状态更新 → STATE_DELTA
    case 'component_state_update':
      return {
        type: 'STATE_DELTA',
        payload: {
          componentStates: {
            [event.payload.componentType]: event.payload.state,
          },
        },
      };

    // 会话事件 → 特殊处理
    case 'session_start':
    case 'session_end':
    case 'session_error':
    case 'message_start':
    case 'message_delta':
    case 'tool_start':
    case 'tool_progress':
    case 'tool_end':
    case 'tool_error':
    case 'interaction_request':
    case 'interaction_response':
      // 这些事件需要特殊处理或不直接映射
      return null;

    default:
      return null;
  }
}

// ============================================================
// Streaming Message Accumulator
// ============================================================

/**
 * 消息流累积器
 * 用于将 message_delta 事件累积成完整消息
 */
export class MessageAccumulator {
  private messages: Map<string, {
    senderId: string;
    senderType: 'agent' | 'user';
    content: string;
    chunks: string[];
    startTime: number;
  }> = new Map();

  /**
   * 开始新消息
   */
  startMessage(messageId: string, senderId: string, senderType: 'agent' | 'user'): void {
    this.messages.set(messageId, {
      senderId,
      senderType,
      content: '',
      chunks: [],
      startTime: Date.now(),
    });
  }

  /**
   * 添加消息增量
   */
  addDelta(delta: MessageDelta): string {
    const message = this.messages.get(delta.messageId);
    if (!message) {
      // 如果没有开始消息，自动创建
      this.startMessage(delta.messageId, 'agent', 'agent');
      return this.addDelta(delta);
    }

    message.chunks.push(delta.content);
    message.content += delta.content;
    return message.content;
  }

  /**
   * 结束消息并获取完整内容
   */
  endMessage(messageId: string): { content: string; duration: number } | null {
    const message = this.messages.get(messageId);
    if (!message) return null;

    const result = {
      content: message.content,
      duration: Date.now() - message.startTime,
    };

    this.messages.delete(messageId);
    return result;
  }

  /**
   * 获取当前累积的内容
   */
  getCurrentContent(messageId: string): string | null {
    return this.messages.get(messageId)?.content ?? null;
  }

  /**
   * 清理所有累积的消息
   */
  clear(): void {
    this.messages.clear();
  }
}

// ============================================================
// Tool Call Tracker
// ============================================================

/**
 * 工具调用追踪器
 * 用于跟踪工具调用状态
 */
export class ToolCallTracker {
  private calls: Map<string, ToolCall> = new Map();

  /**
   * 开始工具调用
   */
  startCall(call: ToolCall): void {
    this.calls.set(call.id, { ...call, status: 'running' });
  }

  /**
   * 更新进度
   */
  updateProgress(toolId: string, progress: number, status?: string): void {
    const call = this.calls.get(toolId);
    if (call) {
      call.progress = progress;
      if (status) {
        call.status = status as ToolCall['status'];
      }
    }
  }

  /**
   * 完成工具调用
   */
  completeCall(toolId: string, result: unknown): void {
    const call = this.calls.get(toolId);
    if (call) {
      call.status = 'completed';
      call.result = result;
      call.progress = 100;
    }
  }

  /**
   * 工具调用失败
   */
  failCall(toolId: string, error: string): void {
    const call = this.calls.get(toolId);
    if (call) {
      call.status = 'failed';
      call.error = error;
    }
  }

  /**
   * 获取工具调用状态
   */
  getCall(toolId: string): ToolCall | undefined {
    return this.calls.get(toolId);
  }

  /**
   * 获取所有活跃的工具调用
   */
  getActiveCalls(): ToolCall[] {
    return Array.from(this.calls.values()).filter(
      call => call.status === 'running' || call.status === 'pending'
    );
  }

  /**
   * 清理已完成的调用
   */
  clearCompleted(): void {
    for (const [id, call] of this.calls) {
      if (call.status === 'completed' || call.status === 'failed') {
        this.calls.delete(id);
      }
    }
  }
}

// ============================================================
// Event Stream Handler
// ============================================================

/**
 * Agent 事件流处理器
 * 将连续的 Agent 事件转换为 Sync 协议消息流
 */
export class AgentEventStreamHandler {
  private messageAccumulator = new MessageAccumulator();
  private toolCallTracker = new ToolCallTracker();
  private eventBuffer: AgentEvent[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private flushIntervalMs: number;

  constructor(
    private onSyncMessage: (message: ServerToClientMessage) => void,
    options?: { flushIntervalMs?: number }
  ) {
    this.flushIntervalMs = options?.flushIntervalMs ?? 100;
  }

  /**
   * 处理 Agent 事件
   */
  handleEvent(event: AgentEvent): void {
    // 处理消息流式事件
    if (event.type === 'message_start') {
      this.messageAccumulator.startMessage(
        event.payload.messageId,
        event.payload.senderId,
        event.payload.senderType
      );
      return;
    }

    if (event.type === 'message_delta') {
      const content = this.messageAccumulator.addDelta(event.payload);
      // 可选：发送实时增量更新
      // this.onSyncMessage({ type: 'STATE_DELTA', payload: { ... } });
      return;
    }

    // 处理工具调用事件
    if (event.type === 'tool_start') {
      this.toolCallTracker.startCall(event.payload);
    } else if (event.type === 'tool_progress') {
      this.toolCallTracker.updateProgress(
        event.payload.toolId,
        event.payload.progress,
        event.payload.status
      );
    } else if (event.type === 'tool_end') {
      this.toolCallTracker.completeCall(event.payload.toolId, event.payload.result);
    } else if (event.type === 'tool_error') {
      this.toolCallTracker.failCall(event.payload.toolId, event.payload.error);
    }

    // 转换并发送其他事件
    const syncMessage = agentEventToSyncMessage(event);
    if (syncMessage) {
      this.onSyncMessage(syncMessage);
    }
  }

  /**
   * 批量处理事件
   */
  handleEvents(events: AgentEvent[]): void {
    events.forEach(event => this.handleEvent(event));
  }

  /**
   * 获取当前状态摘要
   */
  getStateSummary(): {
    pendingMessages: number;
    activeToolCalls: number;
  } {
    return {
      pendingMessages: 0, // TODO: implement
      activeToolCalls: this.toolCallTracker.getActiveCalls().length,
    };
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    this.messageAccumulator.clear();
    this.toolCallTracker.clearCompleted();
    this.eventBuffer = [];
  }
}
