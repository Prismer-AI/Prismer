/**
 * Workspace Stores — Public API
 *
 * Re-exports all domain stores and provides backward-compatible
 * useWorkspaceStore for gradual migration.
 */

// Domain stores
export { useLayoutStore, useLayoutState, useChatExpanded } from './layoutStore';
export { useChatStore, useCompletedInteractions } from './chatStore';
export { useTaskStore, useCurrentTask } from './taskStore';
export { useComponentStore, useActiveComponent, useComponentState, useActiveDiff } from './componentStore';
export { useTimelineStore } from './timelineStore';
export { useDemoStore, useDemoState } from './demoStore';
export {
  useAgentInstanceStore,
  useAgentInstance,
  useAgentInstanceId,
  useAgentInstanceStatus,
  useAgentInstanceActions,
  useAgentState,
  useSyncSessionId,
} from './agentInstanceStore';

// Cross-store actions
export {
  executeDirective,
  executeDirectives,
  applyStateDelta,
  loadWorkspace,
  sendMessage,
  createTask,
  syncComponentState,
  resetAllStores,
  initializeWorkspace,
} from './syncActions';

// ============================================================
// Backward-compatible aggregated store
// ============================================================
// NOTE: This is a compatibility layer. New code should import
// from the specific domain store directly.

import { useLayoutStore } from './layoutStore';
import { useChatStore } from './chatStore';
import { useTaskStore } from './taskStore';
import { useComponentStore } from './componentStore';
import { useTimelineStore } from './timelineStore';
import { useDemoStore } from './demoStore';
import { useAgentInstanceStore } from './agentInstanceStore';
import * as syncActions from './syncActions';

/**
 * @deprecated Use domain-specific stores instead:
 * - useLayoutStore (layout)
 * - useChatStore (messages, participants)
 * - useTaskStore (tasks)
 * - useComponentStore (activeComponent, componentStates, diff)
 * - useTimelineStore (timeline, snapshots)
 * - useDemoStore (demo flow)
 * - useAgentInstanceStore (agent, workspace ID, sync)
 */
export const useWorkspaceStore = Object.assign(
  // The main selector function — picks from the right store
  function useWorkspaceStore<T>(selector: (state: WorkspaceStoreCompat) => T): T {
    const layout = useLayoutStore();
    const chat = useChatStore();
    const task = useTaskStore();
    const component = useComponentStore();
    const timeline = useTimelineStore();
    const demo = useDemoStore();
    const agent = useAgentInstanceStore();

    const combined: WorkspaceStoreCompat = {
      ...layout,
      ...chat,
      ...task,
      ...component,
      ...timeline,
      ...demo,
      ...agent,
      // Cross-store actions
      executeDirective: syncActions.executeDirective,
      executeDirectives: syncActions.executeDirectives,
      applyStateDelta: syncActions.applyStateDelta,
      loadWorkspace: syncActions.loadWorkspace,
      sendMessage: syncActions.sendMessage,
      createTask: syncActions.createTask,
      syncComponentState: syncActions.syncComponentState,
      reset: syncActions.resetAllStores,
      // Aliases for backward compat
      expandChatToTask: (taskId: string) => {
        layout.expandChatToTask(taskId);
        task.setActiveTaskId(taskId);
      },
    };

    return selector(combined);
  },
  // Static methods for getState/setState/subscribe (used by sync layer and lib code)
  {
    getState: () => {
      const layout = useLayoutStore.getState();
      const chat = useChatStore.getState();
      const task = useTaskStore.getState();
      const component = useComponentStore.getState();
      const timeline = useTimelineStore.getState();
      const demo = useDemoStore.getState();
      const agent = useAgentInstanceStore.getState();

      return {
        ...layout,
        ...chat,
        ...task,
        ...component,
        ...timeline,
        ...demo,
        ...agent,
        executeDirective: syncActions.executeDirective,
        executeDirectives: syncActions.executeDirectives,
        applyStateDelta: syncActions.applyStateDelta,
        loadWorkspace: syncActions.loadWorkspace,
        sendMessage: syncActions.sendMessage,
        createTask: syncActions.createTask,
        syncComponentState: syncActions.syncComponentState,
        reset: syncActions.resetAllStores,
        expandChatToTask: (taskId: string) => {
          useLayoutStore.getState().expandChatToTask(taskId);
          useTaskStore.getState().setActiveTaskId(taskId);
        },
      };
    },
    subscribe: (listener: (state: unknown) => void) => {
      // Subscribe to all stores, fire callback on any change
      const unsubs = [
        useLayoutStore.subscribe(() => listener(useWorkspaceStore.getState())),
        useChatStore.subscribe(() => listener(useWorkspaceStore.getState())),
        useTaskStore.subscribe(() => listener(useWorkspaceStore.getState())),
        useComponentStore.subscribe(() => listener(useWorkspaceStore.getState())),
        useTimelineStore.subscribe(() => listener(useWorkspaceStore.getState())),
        useDemoStore.subscribe(() => listener(useWorkspaceStore.getState())),
        useAgentInstanceStore.subscribe(() => listener(useWorkspaceStore.getState())),
      ];
      return () => unsubs.forEach((unsub) => unsub());
    },
  }
);

// Type for the backward-compatible aggregated state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WorkspaceStoreCompat = Record<string, any>;
