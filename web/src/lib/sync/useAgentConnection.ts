/**
 * useAgentConnection Hook
 *
 * 通用的 Agent 连接 Hook，支持桌面端和移动端
 *
 * 特点：
 * 1. 客户端能力声明 - 服务端基于能力过滤数据和指令
 * 2. 统一消息协议 - FULL_STATE / STATE_DELTA / UI_DIRECTIVE
 * 3. 可扩展的数据类型 - 基于同步控制矩阵
 * 4. 类型安全 - 完整的 TypeScript 支持
 *
 * 使用方式:
 * ```tsx
 * // 桌面端
 * const { isConnected, sendUserMessage } = useAgentConnection({
 *   clientType: 'desktop',
 *   capabilities: ['full_ui', 'pdf_viewer', 'code_playground'],
 * });
 *
 * // 移动端
 * const { isConnected, sendUserMessage } = useAgentConnection({
 *   clientType: 'mobile',
 *   capabilities: ['chat_ui', 'task_bar', 'notifications'],
 * });
 * ```
 */

'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type {
  EndpointType,
  SessionState,
  AgentState,
  StateDelta,
  UIDirective,
  ServerToClientMessage,
  ClientToServerMessage,
  ComponentEventPayload,
} from './types';
import {
  createMessageDeduplicator,
  createReconnectManager,
  throttle,
} from './syncUtils';

// ============================================================
// Configuration Types
// ============================================================

/** 客户端能力 */
export type ClientCapability =
  // UI 能力
  | 'full_ui'           // 完整 UI（桌面端）
  | 'chat_ui'           // 聊天界面
  | 'task_bar'          // 任务栏
  | 'notifications'     // 通知
  // 组件能力
  | 'pdf_viewer'        // PDF 阅读器
  | 'code_playground'   // 代码编辑器
  | 'data_grid'         // 数据表格
  | 'chart'             // 图表
  | 'whiteboard'        // 白板
  | 'timeline_viewer'   // 时间线查看器
  // 自定义能力
  | (string & {});

/** Hook 配置选项 */
export interface UseAgentConnectionOptions {
  /** 客户端类型 */
  clientType: EndpointType;
  /** 客户端能力列表 */
  capabilities: ClientCapability[];
  /** 会话 ID */
  sessionId?: string;
  /** 服务器 URL */
  serverUrl?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 重连延迟（毫秒） */
  reconnectDelay?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
  /** 消息去重缓存大小 */
  dedupeCacheSize?: number;
  /** 状态更新节流（毫秒） */
  stateUpdateThrottle?: number;
  /** 调试模式 */
  debug?: boolean;
  /** 自定义消息处理器 */
  onMessage?: (message: ServerToClientMessage) => void;
  /** UI 指令处理器 */
  onUIDirective?: (directive: UIDirective) => void;
  /** 连接状态变化回调 */
  onConnectionChange?: (isConnected: boolean) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/** Hook 返回值 */
export interface AgentConnectionResult {
  /** 是否已连接 */
  isConnected: boolean;
  /** Agent 状态 */
  agentStatus: AgentState;
  /** 客户端 ID */
  clientId: string;
  /** 会话状态 */
  sessionState: SessionState | null;
  /** 发送用户消息 */
  sendUserMessage: (content: string, metadata?: unknown) => void;
  /** 发送用户交互 */
  sendUserInteraction: (componentId: string, actionId: string, data?: unknown) => void;
  /** 发送命令 */
  sendCommand: (command: 'reset' | 'pause' | 'resume', args?: unknown) => void;
  /** 请求完整状态 */
  requestFullState: () => void;
  /** 同步组件事件 */
  syncComponentEvent: (component: string, eventType: string, data?: unknown) => void;
  /** 同步自定义数据 */
  syncData: (dataType: string, data: unknown) => void;
  /** 断开连接 */
  disconnect: () => void;
  /** 重新连接 */
  reconnect: () => void;
}

// ============================================================
// Default Configuration
// ============================================================

// iOS 模拟器无法访问 localhost，需要使用主机 IP
// 检测是否在 Tauri iOS 环境中
const getDefaultServerUrl = (): string => {
  if (process.env.NEXT_PUBLIC_AGENT_SERVER_URL) {
    return process.env.NEXT_PUBLIC_AGENT_SERVER_URL;
  }
  
  // 在浏览器中检测平台
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // 如果不是 localhost，使用当前主机地址（适用于 iOS 访问 Mac）
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `ws://${host}:3456`;
    }
  }
  
  return 'ws://localhost:3456';
};

const DEFAULT_SERVER_URL = getDefaultServerUrl();
const DEFAULT_SESSION_ID = 'default';
const DEFAULT_RECONNECT_DELAY = 1000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_DEDUPE_CACHE_SIZE = 1000;
const DEFAULT_STATE_UPDATE_THROTTLE = 100;

const DEFAULT_AGENT_STATE: AgentState = {
  status: 'idle',
  currentStep: 0,
  totalSteps: 0,
};

// ============================================================
// Hook Implementation
// ============================================================

export function useAgentConnection(options: UseAgentConnectionOptions): AgentConnectionResult {
  const {
    clientType,
    capabilities,
    sessionId = DEFAULT_SESSION_ID,
    serverUrl = DEFAULT_SERVER_URL,
    enabled = true,
    reconnectDelay = DEFAULT_RECONNECT_DELAY,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    dedupeCacheSize = DEFAULT_DEDUPE_CACHE_SIZE,
    stateUpdateThrottle = DEFAULT_STATE_UPDATE_THROTTLE,
    debug = process.env.NODE_ENV === 'development',
    onMessage,
    onUIDirective,
    onConnectionChange,
    onError,
  } = options;

  // ==================== State ====================

  const [isConnected, setIsConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentState>(DEFAULT_AGENT_STATE);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientIdRef = useRef<string>(generateClientId());
  const isUnmountedRef = useRef(false);

  // Performance utilities
  const deduplicatorRef = useRef(
    createMessageDeduplicator({ maxSize: dedupeCacheSize, ttl: 60000 })
  );
  const reconnectManagerRef = useRef(
    createReconnectManager({
      initialDelay: reconnectDelay,
      maxRetries: maxReconnectAttempts,
      backoffFactor: 1.5,
    })
  );

  // Throttled state setters
  const throttledSetSessionState = useMemo(
    () => throttle(setSessionState, stateUpdateThrottle),
    [stateUpdateThrottle]
  );

  // Memoize capabilities array to prevent unnecessary reconnects
  const capabilitiesKey = useMemo(() => capabilities.sort().join(','), [capabilities]);

  // ==================== Logging ====================

  const log = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log(`[AgentConnection:${clientType}]`, ...args);
    }
  }, [debug, clientType]);

  // ==================== Message Handling ====================

  const handleServerMessage = useCallback((event: MessageEvent) => {
    try {
      const message: ServerToClientMessage = JSON.parse(event.data);
      
      log(`← ${message.type}`);
      
      // 自定义处理器
      onMessage?.(message);

      switch (message.type) {
        case 'FULL_STATE':
          // 完整状态同步
          const fullState = message.payload as SessionState;
          setSessionState(fullState);
          setAgentStatus(fullState.agentState);
          log(`Full state: ${fullState.messages.length} messages, ${fullState.tasks.length} tasks`);
          break;

        case 'STATE_DELTA':
          // 增量状态更新 (使用节流)
          const delta = message.payload as StateDelta;
          throttledSetSessionState(prev => applyDelta(prev, delta));
          if (delta.agentState) {
            setAgentStatus(prev => ({ ...prev, ...delta.agentState }));
          }
          break;

        case 'UI_DIRECTIVE':
          // UI 指令
          const directive = message.payload as UIDirective;
          handleUIDirectiveInternal(directive, capabilities, onUIDirective, log);
          break;

        case 'AGENT_STATUS':
          // Agent 状态
          setAgentStatus(message.payload as AgentState);
          break;

        case 'ERROR':
          // 错误
          const error = new Error(String(message.payload));
          console.error('[AgentConnection] Server error:', message.payload);
          onError?.(error);
          break;
      }
    } catch (err) {
      console.error('[AgentConnection] Error parsing message:', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [capabilities, onMessage, onUIDirective, onError, log]);

  // ==================== Connection Management ====================

  const connect = useCallback(() => {
    if (!enabled || isUnmountedRef.current) return;
    
    // 清理现有连接
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      log(`Connecting to ${serverUrl}?session=${sessionId}...`);
      const ws = new WebSocket(`${serverUrl}?session=${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        
        log('Connected! Registering client...');
        
        // 重置重连计数器
        reconnectManagerRef.current.reset();
        
        // 发送注册消息
        const registerMessage: ClientToServerMessage = {
          type: 'REGISTER_CLIENT',
          payload: {
            clientType,
            capabilities,
            platform: getPlatform(),
            version: '1.0.0',
          },
        };
        ws.send(JSON.stringify(registerMessage));
        
        setIsConnected(true);
        onConnectionChange?.(true);
      };

      ws.onmessage = handleServerMessage;

      ws.onclose = (event) => {
        log(`Disconnected (code: ${event.code})`);
        setIsConnected(false);
        onConnectionChange?.(false);
        wsRef.current = null;

        // 自动重连（非主动关闭，使用指数退避）
        if (!isUnmountedRef.current && enabled && event.code !== 1000) {
          const delay = reconnectManagerRef.current.scheduleReconnect(connect);
          if (delay !== null) {
            log(`Will reconnect in ${delay}ms (attempt ${reconnectManagerRef.current.getRetryCount()})...`);
          } else {
            log('Max reconnect attempts reached');
            onError?.(new Error('Max reconnect attempts reached'));
          }
        }
      };

      ws.onerror = (error) => {
        console.error('[AgentConnection] WebSocket error:', error);
        // onError 不在这里调用，因为 onclose 会被触发
      };

    } catch (err) {
      console.error('[AgentConnection] Connection error:', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
      
      // 重连
      if (!isUnmountedRef.current && enabled) {
        reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
      }
    }
  }, [enabled, serverUrl, sessionId, clientType, capabilities, reconnectDelay, handleServerMessage, onConnectionChange, onError, log]);

  const disconnect = useCallback(() => {
    log('Disconnecting...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, [log]);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  // ==================== Send Methods ====================

  const send = useCallback((message: ClientToServerMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log(`→ ${message.type}`);
      wsRef.current.send(JSON.stringify(message));
    } else {
      log(`Cannot send ${message.type}: not connected`);
    }
  }, [log]);

  const sendUserMessage = useCallback((content: string, metadata?: unknown) => {
    send({
      type: 'USER_MESSAGE',
      payload: { content, metadata },
    });
  }, [send]);

  const sendUserInteraction = useCallback((componentId: string, actionId: string, data?: unknown) => {
    send({
      type: 'USER_INTERACTION',
      payload: { componentId, actionId, data },
    });
  }, [send]);

  const sendCommand = useCallback((command: 'reset' | 'pause' | 'resume', args?: unknown) => {
    send({
      type: 'USER_COMMAND',
      payload: { command, args },
    });
  }, [send]);

  const requestFullState = useCallback(() => {
    send({ type: 'REQUEST_FULL_STATE' });
  }, [send]);

  const syncComponentEvent = useCallback((component: string, eventType: string, data?: unknown) => {
    send({
      type: 'COMPONENT_EVENT',
      payload: {
        component,
        type: eventType as ComponentEventPayload['type'],
        payload: data ? { state: data } : undefined,
        timestamp: Date.now(),
      },
    });
  }, [send]);

  const syncData = useCallback((dataType: string, data: unknown) => {
    send({
      type: 'SYNC_DATA',
      payload: { dataType, data },
    });
  }, [send]);

  // ==================== Lifecycle ====================

  useEffect(() => {
    isUnmountedRef.current = false;
    
    if (enabled) {
      connect();
    }

    return () => {
      isUnmountedRef.current = true;
      
      // 清理重连
      reconnectManagerRef.current.cancel();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // 清理去重器
      deduplicatorRef.current.destroy();
      
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, [enabled, serverUrl, sessionId, capabilitiesKey]); // 使用 capabilitiesKey 而非 capabilities

  // ==================== Return ====================

  return {
    isConnected,
    agentStatus,
    clientId: clientIdRef.current,
    sessionState,
    sendUserMessage,
    sendUserInteraction,
    sendCommand,
    requestFullState,
    syncComponentEvent,
    syncData,
    disconnect,
    reconnect,
  };
}

// ============================================================
// Helper Functions
// ============================================================

function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getPlatform(): string {
  if (typeof window === 'undefined') return 'server';
  
  const ua = navigator.userAgent;
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios';
  if (ua.includes('Android')) return 'android';
  if (ua.includes('Mac')) return 'macos';
  if (ua.includes('Windows')) return 'windows';
  if (ua.includes('Linux')) return 'linux';
  return 'web';
}

function applyDelta(prev: SessionState | null, delta: StateDelta): SessionState | null {
  if (!prev) return null;

  const updated = { ...prev };

  // Messages
  if (delta.messages) {
    if (delta.messages.added) {
      updated.messages = [...prev.messages, ...delta.messages.added];
    }
    if (delta.messages.removed) {
      const removedIds = new Set(delta.messages.removed);
      updated.messages = prev.messages.filter((m: any) => !removedIds.has(m.id));
    }
  }

  // Tasks
  if (delta.tasks) {
    updated.tasks = delta.tasks;
  }

  // Completed Interactions
  if (delta.completedInteractions) {
    const current = new Set(prev.completedInteractions);
    if (delta.completedInteractions.added) {
      delta.completedInteractions.added.forEach(id => current.add(id));
    }
    updated.completedInteractions = Array.from(current);
  }

  // Timeline
  if (delta.timeline) {
    if (delta.timeline.added) {
      updated.timeline = [...prev.timeline, ...delta.timeline.added];
    }
  }

  // State Snapshots
  if (delta.stateSnapshots) {
    if (delta.stateSnapshots.added) {
      updated.stateSnapshots = [...prev.stateSnapshots, ...delta.stateSnapshots.added];
    }
  }

  // Component States
  if (delta.componentStates) {
    updated.componentStates = { ...prev.componentStates, ...delta.componentStates };
  }

  // Agent State
  if (delta.agentState) {
    updated.agentState = { ...prev.agentState, ...delta.agentState };
  }

  updated.updatedAt = Date.now();
  return updated;
}

function handleUIDirectiveInternal(
  directive: UIDirective,
  capabilities: string[],
  customHandler?: (directive: UIDirective) => void,
  log?: (...args: unknown[]) => void
): void {
  // 空值检查
  if (!directive) {
    log?.('Received null/undefined directive');
    return;
  }

  // 检查能力
  if (directive.targetCapabilities && directive.targetCapabilities.length > 0) {
    const canExecute = directive.targetCapabilities.some(cap => capabilities.includes(cap));
    if (!canExecute) {
      log?.(`Ignoring directive ${directive.type} - missing capability`);
      return;
    }
  }

  // 自定义处理器
  if (customHandler) {
    customHandler(directive);
    return;
  }

  // 默认处理
  switch (directive.type) {
    case 'SWITCH_COMPONENT':
      if (capabilities.includes('full_ui')) {
        window.dispatchEvent(new CustomEvent('agent:switch-component', {
          detail: directive.payload,
        }));
      }
      break;

    case 'LOAD_DOCUMENT':
      if (capabilities.includes('full_ui') || capabilities.includes('pdf_viewer')) {
        window.dispatchEvent(new CustomEvent('agent:load-document', {
          detail: directive.payload,
        }));
      }
      break;

    case 'EXECUTE_CODE':
      if (capabilities.includes('code_playground')) {
        window.dispatchEvent(new CustomEvent('agent:execute-code', {
          detail: directive.payload,
        }));
      }
      break;

    case 'SHOW_NOTIFICATION':
      // 所有客户端都能显示通知
      window.dispatchEvent(new CustomEvent('agent:notification', {
        detail: directive.payload,
      }));
      break;

    case 'HIGHLIGHT_MESSAGE':
      window.dispatchEvent(new CustomEvent('agent:highlight-message', {
        detail: directive.payload,
      }));
      break;

    case 'UPDATE_TASK_STATUS':
      window.dispatchEvent(new CustomEvent('agent:task-status', {
        detail: directive.payload,
      }));
      break;

    case 'CLEAR_MESSAGES':
      window.dispatchEvent(new CustomEvent('agent:clear-messages', {
        detail: directive.payload,
      }));
      break;

    default:
      // 自定义指令
      window.dispatchEvent(new CustomEvent(`agent:directive:${directive.type}`, {
        detail: directive.payload,
      }));
  }
}

// ============================================================
// Utility Hooks
// ============================================================

/**
 * 订阅 Agent 事件的 Hook
 */
export function useAgentEvent<T = unknown>(
  eventType: string,
  handler: (data: T) => void
): void {
  useEffect(() => {
    const listener = (event: CustomEvent<T>) => {
      handler(event.detail);
    };

    window.addEventListener(`agent:${eventType}` as any, listener);
    return () => {
      window.removeEventListener(`agent:${eventType}` as any, listener);
    };
  }, [eventType, handler]);
}

/**
 * 桌面端快捷配置
 */
export function useDesktopAgentConnection(sessionId?: string) {
  return useAgentConnection({
    clientType: 'desktop',
    capabilities: ['full_ui', 'pdf_viewer', 'code_playground', 'data_grid', 'chart', 'timeline_viewer', 'notifications'],
    sessionId,
  });
}

/**
 * 移动端快捷配置
 */
export function useMobileAgentConnection(sessionId?: string) {
  return useAgentConnection({
    clientType: 'mobile',
    capabilities: ['chat_ui', 'task_bar', 'notifications'],
    sessionId,
  });
}

export default useAgentConnection;
