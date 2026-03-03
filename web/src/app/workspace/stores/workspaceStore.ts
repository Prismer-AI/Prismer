/**
 * Workspace Store — Re-export Shim
 *
 * @deprecated This file is kept for backward compatibility.
 * Import from domain-specific stores or from './index' instead:
 * - useLayoutStore, useLayoutState, useChatExpanded
 * - useChatStore, useCompletedInteractions
 * - useTaskStore, useCurrentTask
 * - useComponentStore, useActiveComponent, useComponentState, useActiveDiff
 * - useTimelineStore
 * - useDemoStore, useDemoState
 * - useAgentInstanceStore, useAgentInstance, useAgentInstanceId,
 *   useAgentInstanceStatus, useAgentInstanceActions, useAgentState, useSyncSessionId
 */

export { useWorkspaceStore } from './index';
export { useLayoutState, useChatExpanded } from './layoutStore';
export { useCompletedInteractions } from './chatStore';
export { useCurrentTask } from './taskStore';
export { useActiveComponent, useComponentState, useActiveDiff } from './componentStore';
export { useDemoState } from './demoStore';
export {
  useAgentInstance,
  useAgentInstanceId,
  useAgentInstanceStatus,
  useAgentInstanceActions,
  useAgentState,
  useSyncSessionId,
} from './agentInstanceStore';
