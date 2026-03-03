/**
 * Timeline Store
 *
 * Manages timeline events, playback state, and state snapshots.
 */

import { create } from 'zustand';
import type { ExtendedTimelineEvent, StateSnapshot, ComponentStates, Task, DiffChange } from '../types';
import type { ComponentType } from '@/lib/events/types';
import type { TaskPanelHeight } from '@/types/workspace';
import { useLayoutStore } from './layoutStore';
import { useComponentStore } from './componentStore';
import { useChatStore } from './chatStore';
import { useTaskStore } from './taskStore';

const MAX_SNAPSHOTS = 50;

/** State saved before entering history view — restored on exit */
interface PreHistoryState {
  layout: {
    chatExpanded: boolean;
    chatPanelWidth: number;
    taskPanelHeight: TaskPanelHeight;
  };
  activeComponent: ComponentType;
  componentStates: ComponentStates;
  activeDiff: { component: ComponentType; file?: string; changes: DiffChange[] } | null;
  tasks: Task[];
}

interface TimelineState {
  timeline: ExtendedTimelineEvent[];
  currentTimelinePosition: number;
  isTimelinePlaying: boolean;
  stateSnapshots: StateSnapshot[];
  currentSnapshotId: string | null;
  /** Whether the user is viewing a historical snapshot (not the latest state) */
  isViewingHistory: boolean;
  /** Saved state before entering history view, for restoration on exit */
  _preHistoryState: PreHistoryState | null;
}

interface TimelineActions {
  addTimelineEvent: (event: ExtendedTimelineEvent) => void;
  setTimelineEvents: (events: ExtendedTimelineEvent[]) => void;
  seekTimeline: (position: number) => void;
  playTimeline: () => void;
  pauseTimeline: () => void;
  setTimeline: (events: ExtendedTimelineEvent[]) => void;
  addTimelineEventIfNew: (event: ExtendedTimelineEvent) => boolean;
  captureSnapshot: () => StateSnapshot;
  restoreSnapshot: (snapshotId: string) => void;
  addSnapshot: (snapshot: StateSnapshot) => void;
  setStateSnapshots: (snapshots: StateSnapshot[]) => void;
  addSnapshotIfNew: (snapshot: StateSnapshot) => boolean;
  /** Exit history view mode and return to the latest state */
  exitHistoryView: () => void;
  resetTimeline: () => void;
}

const initialTimelineState: TimelineState = {
  timeline: [],
  currentTimelinePosition: 0,
  isTimelinePlaying: false,
  stateSnapshots: [],
  currentSnapshotId: null,
  isViewingHistory: false,
  _preHistoryState: null,
};

export const useTimelineStore = create<TimelineState & TimelineActions>()(
  (set, get) => ({
    ...initialTimelineState,

    addTimelineEvent: (event) => {
      set((state) => ({
        timeline: [...state.timeline, event].sort((a, b) => a.timestamp - b.timestamp),
      }));
    },

    setTimelineEvents: (events) => {
      set({ timeline: events.sort((a, b) => a.timestamp - b.timestamp) });
    },

    seekTimeline: (position) => {
      set({ currentTimelinePosition: Math.max(0, Math.min(100, position)) });
    },

    playTimeline: () => {
      set({ isTimelinePlaying: true });
    },

    pauseTimeline: () => {
      set({ isTimelinePlaying: false });
    },

    setTimeline: (events) => {
      set({ timeline: events.sort((a, b) => a.timestamp - b.timestamp) });
    },

    addTimelineEventIfNew: (event) => {
      const state = get();
      if (state.timeline.some((e) => e.id === event.id)) {
        return false;
      }
      set((prev) => ({
        timeline: [...prev.timeline, event].sort((a, b) => a.timestamp - b.timestamp),
      }));
      return true;
    },

    captureSnapshot: () => {
      const layoutState = useLayoutStore.getState();
      const componentState = useComponentStore.getState();
      const chatState = useChatStore.getState();
      const taskState = useTaskStore.getState();
      const snapshot: StateSnapshot = {
        id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        layout: {
          chatExpanded: layoutState.chatExpanded,
          chatPanelWidth: layoutState.chatPanelWidth,
          taskPanelHeight: layoutState.taskPanelHeight,
          activeComponent: componentState.activeComponent,
        },
        components: { ...componentState.componentStates },
        diff: componentState.activeDiff || undefined,
        chat: {
          messageCount: chatState.messages.length,
        },
        tasks: taskState.tasks.map((t) => ({ ...t })),
      };

      set((prev) => {
        const updated = [...prev.stateSnapshots, snapshot];
        return {
          stateSnapshots: updated.length > MAX_SNAPSHOTS
            ? updated.slice(updated.length - MAX_SNAPSHOTS)
            : updated,
        };
      });

      return snapshot;
    },

    restoreSnapshot: (snapshotId) => {
      const state = get();
      const snapshot = state.stateSnapshots.find((s) => s.id === snapshotId);
      if (!snapshot) return;

      // Save current state before entering history view (only on first restore)
      if (!state.isViewingHistory) {
        const layoutState = useLayoutStore.getState();
        const componentState = useComponentStore.getState();
        const taskState = useTaskStore.getState();
        set({
          _preHistoryState: {
            layout: {
              chatExpanded: layoutState.chatExpanded,
              chatPanelWidth: layoutState.chatPanelWidth,
              taskPanelHeight: layoutState.taskPanelHeight,
            },
            activeComponent: componentState.activeComponent,
            componentStates: { ...componentState.componentStates },
            activeDiff: componentState.activeDiff,
            tasks: taskState.tasks.map((t) => ({ ...t })),
          },
        });
      }

      // 1. Restore layout
      useLayoutStore.setState({
        chatExpanded: snapshot.layout.chatExpanded,
        chatPanelWidth: snapshot.layout.chatPanelWidth,
        taskPanelHeight: snapshot.layout.taskPanelHeight,
      });

      // 2. Restore component states
      useComponentStore.setState({
        activeComponent: snapshot.layout.activeComponent,
        componentStates: snapshot.components as ComponentStates,
        activeDiff: snapshot.diff || null,
      });

      // 3. Restore chat visible boundary (gray out future messages)
      if (snapshot.chat) {
        useChatStore.getState().restoreToMessageIndex(snapshot.chat.messageCount);
      }

      // 4. Restore tasks
      if (snapshot.tasks) {
        useTaskStore.getState().setTasks(snapshot.tasks);
      }

      // 5. Mark as viewing history
      set({
        currentSnapshotId: snapshotId,
        isViewingHistory: true,
      });
    },

    addSnapshot: (snapshot) => {
      set((prev) => ({
        stateSnapshots: [...prev.stateSnapshots, snapshot],
      }));
    },

    setStateSnapshots: (snapshots) => {
      set({ stateSnapshots: snapshots });
    },

    addSnapshotIfNew: (snapshot) => {
      const state = get();
      if (state.stateSnapshots.some((s) => s.id === snapshot.id)) {
        return false;
      }
      set((prev) => ({
        stateSnapshots: [...prev.stateSnapshots, snapshot],
      }));
      return true;
    },

    exitHistoryView: () => {
      const preState = get()._preHistoryState;

      // Restore chat to show all messages
      useChatStore.getState().exitHistoryView();

      // Restore layout, components, and tasks to pre-history state
      if (preState) {
        useLayoutStore.setState(preState.layout);
        useComponentStore.setState({
          activeComponent: preState.activeComponent,
          componentStates: preState.componentStates,
          activeDiff: preState.activeDiff || null,
        });
        useTaskStore.getState().setTasks(preState.tasks);
      }

      set({
        isViewingHistory: false,
        currentSnapshotId: null,
        _preHistoryState: null,
      });
    },

    resetTimeline: () => {
      set(initialTimelineState);
    },
  })
);
