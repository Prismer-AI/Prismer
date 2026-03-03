/**
 * Container Chat Hook
 *
 * Simplified chat hook that communicates directly with container OpenClaw agent
 * via the Bridge API. Does NOT require external IM Server.
 *
 * Architecture:
 * Frontend → Bridge API → Container Gateway → OpenClaw Agent
 *
 * This is a transitional solution until Cloud IM infrastructure is fully deployed.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExtendedChatMessage, UIDirective } from '@/types';
import { useChatStore } from '../stores/chatStore';
import { useAgentInstanceStore } from '../stores/agentInstanceStore';
import { executeDirectives } from '../stores/syncActions';
import { createLogger } from '@/lib/logger';

const log = createLogger('ContainerChat');

// ============================================================
// Types
// ============================================================

export type ContainerConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseContainerChatOptions {
  /** Workspace ID */
  workspaceId: string;
  /** User ID (from auth system) */
  userId?: string;
  /** User display name */
  userDisplayName?: string;
  /** Enable chat (default: true) */
  enabled?: boolean;
  /** Callback when agent response received */
  onAgentResponse?: (message: ExtendedChatMessage) => void;
  /** Callback when connection status changes */
  onStatusChange?: (status: ContainerConnectionStatus) => void;
}

export interface UseContainerChatResult {
  /** Connection status */
  connectionStatus: ContainerConnectionStatus;
  /** Whether connected and ready */
  isConnected: boolean;
  /** Whether container agent is available */
  isAgentAvailable: boolean;
  /** Gateway URL */
  gatewayUrl: string | null;
  /** Send a message to agent and get response */
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<ExtendedChatMessage | null>;
  /** Check bridge status */
  checkStatus: () => Promise<void>;
  /** Load earlier messages (cursor pagination) */
  loadMoreHistory: () => Promise<boolean>;
  /** Whether there are more history messages to load */
  hasMoreHistory: boolean;
  /** Error message if any */
  error: string | null;
  /** True while waiting for agent response after user sent a message */
  isWaitingForResponse: boolean;
}

export interface SendMessageOptions {
  mentions?: string[];
  references?: string[];
}

// ============================================================
// Bridge API Helpers
// ============================================================

interface BridgeStatusResponse {
  ok: boolean;
  data?: {
    status: string;
    workspaceId: string;
    gatewayUrl?: string;
    conversationId?: string;
  };
  error?: { code: string; message: string };
}

interface BridgeDirective {
  type: string;
  target?: string;
  data?: Record<string, unknown>;
  delay?: number;
}

interface BridgeParsedTask {
  title: string;
  subtasks?: Array<{ title: string }>;
}

interface BridgeArtifact {
  id: string;
  type: string;
  name: string;
}

interface BridgeMessageResponse {
  ok: boolean;
  data?: {
    response: string;
    directives?: BridgeDirective[];
    tasks?: BridgeParsedTask[];
    interactiveComponents?: Array<{ type: string; id: string; [key: string]: unknown }>;
    artifacts?: BridgeArtifact[];
    workspaceId: string;
    gatewayUrl?: string;
    /** Whether directives were already executed during SSE streaming */
    directivesExecutedInStream?: boolean;
  };
  error?: { code: string; message: string };
}

async function getBridgeStatus(workspaceId: string): Promise<BridgeStatusResponse | null> {
  try {
    log.debug('Checking bridge status', { workspaceId });
    const response = await fetch(`/api/v2/im/bridge/${workspaceId}`);
    const result = await response.json();
    log.debug('Bridge status response', { workspaceId, status: result?.data?.status, ok: result?.ok });
    return result;
  } catch (err) {
    log.error('Error getting bridge status', { workspaceId, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

interface IMMessageRecord {
  id: string;
  content: string;
  type: string;
  senderId: string;
  createdAt: string;
  sender?: {
    id: string;
    username: string;
    displayName: string;
    role: string;      // IMUser.role: 'human' | 'agent' | 'admin'
    agentCard?: { agentType?: string } | null;
  };
  metadata?: string;
}

async function loadMessageHistory(workspaceId: string): Promise<ExtendedChatMessage[]> {
  try {
    log.info('Loading message history from IM', { workspaceId });
    const start = performance.now();
    const response = await fetch(
      `/api/v2/im/bridge/${workspaceId}?include=messages&limit=50`
    );
    const result = await response.json();
    const fetchDuration = Math.round(performance.now() - start);

    if (!result.ok || !result.data?.messages) {
      log.debug('No message history available', {
        workspaceId,
        ok: result.ok,
        status: result.data?.status,
        fetchDuration_ms: fetchDuration,
      });
      return [];
    }

    const rawMessages = result.data.messages as IMMessageRecord[];
    const messages = rawMessages.map((msg: IMMessageRecord) => ({
      id: msg.id,
      workspaceId,
      senderId: msg.senderId,
      senderType: (msg.sender?.role === 'agent' ? 'agent' : 'user') as 'user' | 'agent',
      senderName: msg.sender?.displayName || 'Unknown',
      content: msg.content,
      contentType: (msg.type === 'markdown' ? 'markdown' : 'text') as 'text' | 'markdown',
      timestamp: msg.createdAt,
    }));

    const userCount = messages.filter(m => m.senderType === 'user').length;
    const agentCount = messages.filter(m => m.senderType === 'agent').length;
    log.info('Message history loaded', {
      workspaceId,
      total: messages.length,
      userMessages: userCount,
      agentMessages: agentCount,
      fetchDuration_ms: fetchDuration,
    });
    return messages;
  } catch (err) {
    log.error('Error loading history', { workspaceId, error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

async function loadOlderHistory(
  workspaceId: string,
  beforeTimestamp: string
): Promise<{ messages: ExtendedChatMessage[]; hasMore: boolean }> {
  try {
    log.info('Loading older history', { workspaceId, beforeTimestamp });
    const response = await fetch(
      `/api/v2/im/bridge/${workspaceId}?include=messages&limit=30&before=${encodeURIComponent(beforeTimestamp)}`
    );
    const result = await response.json();

    if (!result.ok || !result.data?.messages) {
      return { messages: [], hasMore: false };
    }

    const rawMessages = result.data.messages as IMMessageRecord[];
    const messages = rawMessages.map((msg: IMMessageRecord) => ({
      id: msg.id,
      workspaceId,
      senderId: msg.senderId,
      senderType: (msg.sender?.role === 'agent' ? 'agent' : 'user') as 'user' | 'agent',
      senderName: msg.sender?.displayName || 'Unknown',
      content: msg.content,
      contentType: (msg.type === 'markdown' ? 'markdown' : 'text') as 'text' | 'markdown',
      timestamp: msg.createdAt,
    }));

    log.info('Older history loaded', { workspaceId, count: messages.length });
    return { messages, hasMore: messages.length >= 30 };
  } catch (err) {
    log.error('Error loading older history', { workspaceId, error: err instanceof Error ? err.message : String(err) });
    return { messages: [], hasMore: false };
  }
}

async function sendToBridge(
  workspaceId: string,
  content: string,
  senderId?: string,
  senderName?: string,
  options?: SendMessageOptions
): Promise<BridgeMessageResponse | null> {
  try {
    log.info('Sending to bridge', { workspaceId, contentLength: content.length, senderId });
    const start = performance.now();

    // Collect component context metadata for agent awareness
    let metadata: Record<string, unknown> | undefined;
    try {
      const { useComponentStore } = await import('../stores/componentStore');
      const state = useComponentStore.getState();
      const activeType = state.activeComponent;
      const activeState = state.componentStates[activeType] as Record<string, unknown> | undefined;
      metadata = {
        component: activeType,
        eventType: 'user_message',
        data: activeState ? {
          activeFile: activeState.activeFile,
          documentTitle: activeState.documentTitle,
          currentPage: activeState.currentPage,
          cellCount: activeState.cellCount,
          engine: activeState.engine,
          // Include file list summaries (paths only, not content)
          files: Array.isArray(activeState.files)
            ? (activeState.files as Array<{ path?: string; name?: string }>)
                .map(f => ({ path: f.path || f.name }))
            : undefined,
        } : undefined,
      };
    } catch {
      // Non-critical — send without metadata
    }

    if (options?.mentions?.length) {
      metadata = { ...(metadata || {}), mentions: options.mentions };
    }
    if (options?.references?.length) {
      metadata = { ...(metadata || {}), references: options.references };
    }

    const response = await fetch(`/api/v2/im/bridge/${workspaceId}?stream=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
      },
      body: JSON.stringify({ content, senderId, senderName, metadata }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      const result = await response.json();
      const duration = Math.round(performance.now() - start);
      log.info('Bridge JSON response', {
        workspaceId,
        ok: result?.ok,
        responseLength: result?.data?.response?.length || 0,
        directiveCount: result?.data?.directives?.length || 0,
        duration_ms: duration,
      });
      return result;
    }

    if (!response.ok || !response.body) {
      const duration = Math.round(performance.now() - start);
      log.error('Bridge SSE unavailable', { workspaceId, status: response.status, duration_ms: duration });
      return {
        ok: false,
        error: { code: 'BRIDGE_SSE_ERROR', message: `Bridge stream failed: ${response.status}` },
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chatStore = useChatStore.getState();
    let buffer = '';
    let doneSeen = false;
    let streamError: { code: string; message: string } | undefined;
    let finalData: BridgeMessageResponse['data'] | undefined;
    let accumulatedResponse = '';

    while (!doneSeen) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
        if (!block.trim()) continue;

        let eventName = 'message';
        const dataLines: string[] = [];
        for (const rawLine of block.split('\n')) {
          const line = rawLine.trimEnd();
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (dataLines.length === 0) continue;
        let eventData: Record<string, unknown> = {};
        try {
          eventData = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
        } catch {
          continue;
        }

        switch (eventName) {
          case 'thinking': {
            const contentText = eventData.content as string | undefined;
            if (contentText) {
              chatStore.setThinkingStatus(contentText);
              chatStore.setThinkingContent(contentText);
            }
            break;
          }
          case 'tool_start': {
            const toolName = (eventData.toolName as string) || 'unknown';
            const toolCallId = (eventData.toolCallId as string) || `tc-${Date.now()}`;
            chatStore.setThinkingStatus(`Using tool: ${toolName}...`);
            chatStore.startToolCall(toolCallId, toolName);
            break;
          }
          case 'tool_result': {
            const toolCallId = (eventData.toolCallId as string) || '';
            const success = (eventData.success as boolean | undefined) ?? true;
            if (toolCallId) {
              chatStore.endToolCall(toolCallId, success);
            }
            break;
          }
          case 'message_delta': {
            const delta = (eventData.content as string) || '';
            if (delta) {
              accumulatedResponse += delta;
              chatStore.setThinkingStatus('Generating response...');
            }
            break;
          }
          case 'message_complete': {
            const finalResponse = (eventData.content as string) || accumulatedResponse;
            finalData = {
              response: finalResponse,
              directives: eventData.directives as BridgeDirective[] | undefined,
              tasks: eventData.tasks as BridgeParsedTask[] | undefined,
              interactiveComponents: eventData.interactiveComponents as Array<{ type: string; id: string; [key: string]: unknown }> | undefined,
              artifacts: eventData.artifacts as BridgeArtifact[] | undefined,
              workspaceId: (eventData.workspaceId as string) || workspaceId,
              gatewayUrl: eventData.gatewayUrl as string | undefined,
            };
            // Execute directives immediately — don't wait for onAgentResponse round-trip
            if (finalData.directives && finalData.directives.length > 0) {
              log.info('Executing directives from SSE message_complete', {
                count: finalData.directives.length,
                types: finalData.directives.map((d) => d.type),
              });
              executeDirectives(finalData.directives as UIDirective[]);
              finalData.directivesExecutedInStream = true;
            }
            break;
          }
          case 'error': {
            streamError = {
              code: (eventData.code as string) || 'STREAM_ERROR',
              message: (eventData.message as string) || 'Bridge stream error',
            };
            break;
          }
          case 'done': {
            doneSeen = true;
            break;
          }
          default:
            break;
        }
      }
    }

    const duration = Math.round(performance.now() - start);
    if (streamError) {
      log.error('Bridge SSE response error', { workspaceId, code: streamError.code, duration_ms: duration });
      return { ok: false, error: streamError };
    }
    if (finalData) {
      log.info('Bridge SSE response', {
        workspaceId,
        ok: true,
        responseLength: finalData.response.length,
        directiveCount: finalData.directives?.length || 0,
        duration_ms: duration,
      });
      return { ok: true, data: finalData };
    }

    log.warn('Bridge SSE ended without message_complete', { workspaceId, duration_ms: duration });
    return {
      ok: false,
      error: { code: 'STREAM_INCOMPLETE', message: 'Bridge stream ended without final response' },
    };
  } catch (err) {
    log.error('Error sending to bridge', { workspaceId, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// ============================================================
// Hook Implementation
// ============================================================

export function useContainerChat(options: UseContainerChatOptions): UseContainerChatResult {
  const {
    workspaceId,
    userId = 'dev-user-1',
    userDisplayName = 'User',
    enabled = true,
    onAgentResponse,
    onStatusChange,
  } = options;

  // State
  const [connectionStatus, setConnectionStatus] = useState<ContainerConnectionStatus>('disconnected');
  const [isAgentAvailable, setIsAgentAvailable] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  // Chat store
  const addMessage = useChatStore((s) => s.addMessage);

  // Refs
  const mountedRef = useRef(true);
  const checkingRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const connectionStatusRef = useRef(connectionStatus);
  connectionStatusRef.current = connectionStatus;

  // Update connection status with callback
  const updateStatus = useCallback(
    (status: ContainerConnectionStatus) => {
      log.info('Connection status changed', { workspaceId, status });
      setConnectionStatus(status);
      onStatusChange?.(status);
    },
    [onStatusChange, workspaceId]
  );

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Check bridge status
  const checkStatus = useCallback(async () => {
    if (!enabled || !workspaceId || checkingRef.current) return;

    checkingRef.current = true;
    // Only show 'connecting' on initial check (when disconnected/error), not on periodic re-checks
    // This prevents the indicator from flashing yellow every 30s
    if (connectionStatusRef.current === 'disconnected' || connectionStatusRef.current === 'error') {
      updateStatus('connecting');
    }
    setError(null);

    try {
      const result = await getBridgeStatus(workspaceId);

      if (!mountedRef.current) return;

      if (!result || !result.ok) {
        setIsAgentAvailable(false);
        setGatewayUrl(null);
        updateStatus('error');
        setError(result?.error?.message || 'Failed to check bridge status');
        useAgentInstanceStore.getState().setBridgeConnected(false);
        return;
      }

      const status = result.data?.status;
      const isAvailable = status === 'connected';

      setIsAgentAvailable(isAvailable);
      setGatewayUrl(result.data?.gatewayUrl || null);
      updateStatus(isAvailable ? 'connected' : 'disconnected');
      // Sync bridge connectivity to agentInstanceStore for readiness gate
      useAgentInstanceStore.getState().setBridgeConnected(isAvailable);

      log.debug('Bridge status check complete', {
        workspaceId,
        gatewayStatus: status,
        gatewayUrl: result.data?.gatewayUrl,
        isAvailable,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setIsAgentAvailable(false);
      updateStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
      useAgentInstanceStore.getState().setBridgeConnected(false);
    } finally {
      checkingRef.current = false;
    }
  }, [enabled, workspaceId, updateStatus]);

  // Initial status check + load message history from DB
  useEffect(() => {
    if (enabled && workspaceId) {
      checkStatus();

      // Load history from IM database (only once per mount).
      // Uses addMessageIfNew to avoid duplicates since loadWorkspace() may also
      // load messages from the legacy WorkspaceMessage table concurrently.
      if (!historyLoadedRef.current) {
        historyLoadedRef.current = true;
        loadMessageHistory(workspaceId).then((history) => {
          if (!mountedRef.current) {
            log.warn('Component unmounted before history loaded', { workspaceId, historyCount: history.length });
            return;
          }
          const chatStore = useChatStore.getState();
          const existingCount = chatStore.messages.length;
          if (history.length > 0) {
            let added = 0;
            let skipped = 0;
            history.forEach((msg) => {
              if (chatStore.addMessageIfNew(msg)) {
                added++;
              } else {
                skipped++;
              }
            });
            log.info('IM history merged into store', {
              workspaceId,
              loaded: history.length,
              added,
              skipped,
              existingBefore: existingCount,
              totalAfter: chatStore.messages.length,
            });
          } else {
            log.debug('No IM history to restore', { workspaceId, existingMessages: existingCount });
          }
        });
      }
    }
  }, [enabled, workspaceId, checkStatus]);

  // Periodic status check (every 30 seconds)
  useEffect(() => {
    if (!enabled || !workspaceId) return;

    const interval = setInterval(() => {
      if (connectionStatus !== 'connecting') {
        checkStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [enabled, workspaceId, connectionStatus, checkStatus]);

  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  // Send message to agent
  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions): Promise<ExtendedChatMessage | null> => {
      if (!workspaceId) {
        log.warn('sendMessage called without workspaceId');
        return null;
      }

      setIsWaitingForResponse(true);
      {
        const cs = useChatStore.getState();
        cs.setThinkingStatus('Thinking...');
        cs.setThinkingContent(null);
        cs.clearToolCalls();
      }
      // Clear previous synthetic tasks for a fresh run
      {
        const { useTaskStore } = await import('../stores/taskStore');
        useTaskStore.getState().resetTasks();
      }
      try {
      // Create user message
      const messageReferences = [
        ...(options?.mentions || []).map((item) => `@${item}`),
        ...(options?.references || []).map((item) => `#${item}`),
      ];

      const userMessage: ExtendedChatMessage = {
        id: `user-msg-${Date.now()}`,
        workspaceId,
        senderId: userId,
        senderType: 'user',
        senderName: userDisplayName,
        content,
        contentType: 'text',
        timestamp: new Date().toISOString(),
        references: messageReferences.length > 0 ? messageReferences : undefined,
      };

      // Add user message to store
      addMessage(userMessage);

      // Send to bridge (with sender info + workspace context metadata)
      const result = await sendToBridge(workspaceId, content, userId, userDisplayName, options);

      if (!result || !result.ok || !result.data?.response) {
        log.error('Bridge error', { workspaceId, errorCode: result?.error?.code, errorMsg: result?.error?.message });

        // Add error message
        const errorMessage: ExtendedChatMessage = {
          id: `error-msg-${Date.now()}`,
          workspaceId,
          senderId: 'system',
          senderType: 'agent',
          senderName: 'System',
          content: result?.error?.message || 'Failed to get agent response',
          contentType: 'text',
          timestamp: new Date().toISOString(),
          metadata: { isError: true },
        };
        addMessage(errorMessage);
        return null;
      }

      // Create agent response message (with directives, tasks, interactive components, artifacts)
      const agentMessage: ExtendedChatMessage = {
        id: `agent-msg-${Date.now()}`,
        workspaceId,
        senderId: 'container-agent',
        senderType: 'agent',
        senderName: 'Research Claw',
        content: result.data.response,
        contentType: 'markdown',
        timestamp: new Date().toISOString(),
        uiDirectives: result.data.directives as unknown as ExtendedChatMessage['uiDirectives'],
        interactiveComponents: result.data.interactiveComponents as unknown as ExtendedChatMessage['interactiveComponents'],
        artifacts: result.data.artifacts as unknown as ExtendedChatMessage['artifacts'],
        metadata: {
          ...(result.data.tasks ? { tasks: result.data.tasks } : {}),
          ...(result.data.directivesExecutedInStream ? { executedInStream: true } : {}),
        },
      };

      // Add to store
      addMessage(agentMessage);

      // Callback
      onAgentResponse?.(agentMessage);

      return agentMessage;
      } finally {
        setIsWaitingForResponse(false);
        const cs = useChatStore.getState();
        cs.setThinkingStatus(null);
        cs.setThinkingContent(null);
      }
    },
    [workspaceId, userId, userDisplayName, addMessage, onAgentResponse]
  );

  // Load older messages (cursor pagination)
  const loadMoreHistory = useCallback(async (): Promise<boolean> => {
    if (!workspaceId || !hasMoreHistory) return false;

    const chatStore = useChatStore.getState();
    const oldest = chatStore.messages[0];
    if (!oldest) return false;

    const { messages: older, hasMore } = await loadOlderHistory(workspaceId, oldest.timestamp);
    setHasMoreHistory(hasMore);

    if (older.length > 0) {
      // Prepend older messages (deduplicate)
      let added = 0;
      for (const msg of older.reverse()) {
        if (chatStore.addMessageIfNew(msg)) added++;
      }
      log.info('Prepended older history', { workspaceId, added, total: older.length });
      return added > 0;
    }
    return false;
  }, [workspaceId, hasMoreHistory]);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    isAgentAvailable,
    gatewayUrl,
    sendMessage,
    checkStatus,
    loadMoreHistory,
    hasMoreHistory,
    error,
    isWaitingForResponse,
  };
}

export default useContainerChat;
