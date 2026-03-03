/**
 * Workspace Agent Hooks
 *
 * Bridges sync infrastructure (lib/sync) with workspace domain stores.
 * This is the proper app-layer integration point — lib/sync provides
 * the WebSocket connection, and this hook wires it to workspace state.
 *
 * Usage:
 * ```tsx
 * // Desktop
 * const { isConnected, sendUserMessage } = useDesktopAgent({ sessionId: 'abc' });
 *
 * // Mobile
 * const { isConnected, sendUserMessage } = useMobileAgent({ sessionId: 'abc' });
 * ```
 */

'use client';

import { useCallback, useMemo } from 'react';
import {
  useAgentConnection,
  type UseAgentConnectionOptions,
  type AgentConnectionResult,
  type ClientCapability,
} from '@/lib/sync/useAgentConnection';
import type { SessionState, StateDelta } from '@/lib/sync/types';
import { useChatStore } from '../stores/chatStore';
import { useTaskStore } from '../stores/taskStore';
import { useTimelineStore } from '../stores/timelineStore';
import { useComponentStore } from '../stores/componentStore';
import { useAgentInstanceStore } from '../stores/agentInstanceStore';
import { applyStateDelta, resetAllStores } from '../stores/syncActions';
import type { ExtendedChatMessage, ExtendedTimelineEvent, StateSnapshot, Task, Participant } from '@/types';
import type { ComponentType } from '@/lib/events/types';

// Re-export UIDirective type from sync types for onUIDirective handler
import type { UIDirective } from '@/lib/sync/types';

// ============================================================
// Types
// ============================================================

export interface UseWorkspaceAgentOptions extends Omit<UseAgentConnectionOptions, 'onMessage' | 'onUIDirective'> {
  autoSync?: boolean;
  onUIDirective?: (directive: UIDirective) => boolean | void;
}

export interface WorkspaceAgentResult extends AgentConnectionResult {
  messages: ExtendedChatMessage[];
  tasks: Task[];
  participants: Participant[];
  completedInteractions: Set<string>;
  timeline: ExtendedTimelineEvent[];
  componentStates: Record<string, unknown>;
  activeComponent: ComponentType;
  setActiveComponent: (component: ComponentType) => void;
  updateComponentState: (component: string, state: unknown) => void;
  reset: () => void;
}

// ============================================================
// Core Hook
// ============================================================

export function useWorkspaceAgent(options: UseWorkspaceAgentOptions): WorkspaceAgentResult {
  const { autoSync = true, onUIDirective: customUIHandler, ...connectionOptions } = options;

  // Domain store selectors
  const messages = useChatStore((s) => s.messages);
  const participants = useChatStore((s) => s.participants);
  const completedInteractions = useChatStore((s) => s.completedInteractions);
  const tasks = useTaskStore((s) => s.tasks);
  const timeline = useTimelineStore((s) => s.timeline);
  const componentStates = useComponentStore((s) => s.componentStates);
  const activeComponent = useComponentStore((s) => s.activeComponent);

  // Actions
  const storeActions = useMemo(() => ({
    setMessages: useChatStore.getState().setMessages,
    setParticipants: useChatStore.getState().setParticipants,
    setCompletedInteractions: useChatStore.getState().setCompletedInteractions,
    setTasks: useTaskStore.getState().setTasks,
    setTimeline: useTimelineStore.getState().setTimeline,
    setStateSnapshots: useTimelineStore.getState().setStateSnapshots,
    setComponentStates: useComponentStore.getState().setComponentStates,
    setActiveComponent: useComponentStore.getState().setActiveComponent,
    updateComponentState: useComponentStore.getState().updateComponentState,
    setAgentState: useAgentInstanceStore.getState().setAgentState,
    setSyncSessionId: useAgentInstanceStore.getState().setSyncSessionId,
  }), []);

  // Handle full state sync
  const handleFullState = useCallback((state: SessionState) => {
    if (!autoSync) return;

    if (state.sessionId) {
      storeActions.setSyncSessionId(state.sessionId);
    }
    if (state.messages?.length) {
      storeActions.setMessages(state.messages as unknown as ExtendedChatMessage[]);
    }
    if (state.tasks?.length) {
      storeActions.setTasks(state.tasks as unknown as Task[]);
    }
    if (state.participants?.length) {
      storeActions.setParticipants(state.participants as unknown as Participant[]);
    }
    if (state.completedInteractions?.length) {
      storeActions.setCompletedInteractions(state.completedInteractions);
    }
    if (state.timeline?.length) {
      storeActions.setTimeline(state.timeline as unknown as ExtendedTimelineEvent[]);
    }
    if (state.stateSnapshots?.length) {
      storeActions.setStateSnapshots(state.stateSnapshots as unknown as StateSnapshot[]);
    }
    if (state.componentStates && Object.keys(state.componentStates).length > 0) {
      storeActions.setComponentStates(state.componentStates as never);
    }
    if (state.agentState) {
      storeActions.setAgentState(state.agentState);
    }
  }, [autoSync, storeActions]);

  // Handle state delta
  const handleStateDelta = useCallback((delta: StateDelta) => {
    if (!autoSync) return;
    applyStateDelta(delta);
  }, [autoSync]);

  // Handle UI directive
  const handleUIDirective = useCallback((directive: UIDirective) => {
    if (customUIHandler) {
      const handled = customUIHandler(directive);
      if (handled === true) return;
    }

    switch (directive.type) {
      case 'SWITCH_COMPONENT': {
        const { component } = directive.payload as { component: string };
        storeActions.setActiveComponent(component as ComponentType);
        break;
      }
      case 'UPDATE_COMPONENT_STATE': {
        const { componentType, state } = directive.payload as { componentType: string; state: unknown };
        storeActions.updateComponentState(componentType as never, state as never);
        break;
      }
    }

    if (typeof window !== 'undefined') {
      const eventName = directive.type === 'SWITCH_COMPONENT' ? 'agent:switch-component'
        : directive.type === 'LOAD_DOCUMENT' ? 'agent:load-document'
        : directive.type === 'EXECUTE_CODE' ? 'agent:execute-code'
        : directive.type === 'CLEAR_MESSAGES' ? 'agent:clear-messages'
        : `agent:directive:${directive.type}`;

      window.dispatchEvent(new CustomEvent(eventName, {
        detail: directive.payload,
      }));
    }
  }, [customUIHandler, storeActions]);

  // Connection
  const connection = useAgentConnection({
    ...connectionOptions,
    onMessage: (message) => {
      if (message.type === 'FULL_STATE') {
        handleFullState(message.payload as SessionState);
      } else if (message.type === 'STATE_DELTA') {
        handleStateDelta(message.payload as StateDelta);
      }
    },
    onUIDirective: handleUIDirective,
  });

  return {
    ...connection,
    messages,
    tasks,
    participants,
    completedInteractions,
    timeline,
    componentStates: componentStates as unknown as Record<string, unknown>,
    activeComponent,
    setActiveComponent: storeActions.setActiveComponent,
    updateComponentState: storeActions.updateComponentState as (component: string, state: unknown) => void,
    reset: resetAllStores,
  };
}

// ============================================================
// Convenience Hooks
// ============================================================

const DESKTOP_CAPABILITIES: ClientCapability[] = [
  'full_ui', 'pdf_viewer', 'code_playground', 'data_grid',
  'chart', 'timeline_viewer', 'notifications',
];

const MOBILE_CAPABILITIES: ClientCapability[] = [
  'chat_ui', 'task_bar', 'notifications',
];

export function useDesktopAgent(options?: Partial<UseWorkspaceAgentOptions>): WorkspaceAgentResult {
  return useWorkspaceAgent({
    clientType: 'desktop',
    capabilities: DESKTOP_CAPABILITIES,
    ...options,
  });
}

export function useMobileAgent(options?: Partial<UseWorkspaceAgentOptions>): WorkspaceAgentResult {
  return useWorkspaceAgent({
    clientType: 'mobile',
    capabilities: MOBILE_CAPABILITIES,
    ...options,
  });
}
