/**
 * Timeline Types
 *
 * Timeline events and extended timeline with state snapshots.
 */

import type { ComponentType } from '@/lib/events/types';
import type { ParticipantType } from './message';

// ============================================================
// Timeline Types
// ============================================================

export type TimelineActionType =
  | 'edit' | 'create' | 'delete' | 'navigate' | 'execute'
  | 'workflow_start' | 'workflow_step' | 'workflow_complete' | 'workflow_error'
  | 'agent_thinking' | 'agent_tool_call' | 'agent_response' | 'agent_handoff'
  | 'user_input' | 'user_decision' | 'user_feedback'
  | 'state_snapshot' | 'checkpoint' | 'rollback';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  componentType: ComponentType;
  action: TimelineActionType;
  description: string;
  snapshot?: string;
  actorId?: string;
  actorType?: ParticipantType;
}

// ============================================================
// State Snapshot & Diff Types
// ============================================================

export type DiffChangeType = 'insert' | 'delete' | 'modify';

export interface DiffChange {
  type: DiffChangeType;
  range: { start: number; end: number };
  oldContent?: string;
  newContent?: string;
}

export interface Highlight {
  id: string;
  range: { start: number; end: number };
  color: string;
  note?: string;
}

// ============================================================
// Extended Timeline Event
// ============================================================

export interface ExtendedTimelineEvent extends TimelineEvent {
  stateSnapshot?: StateSnapshot;
  messageId?: string;
  duration?: number;
}

// Forward reference — StateSnapshot depends on ComponentStates from workspace.ts
import type { ComponentStates, TaskPanelHeight } from './workspace';
import type { Task } from './task';

export interface StateSnapshot {
  id: string;
  timestamp: number;
  layout: {
    chatExpanded: boolean;
    chatPanelWidth: number;
    taskPanelHeight: TaskPanelHeight;
    activeComponent: ComponentType;
  };
  components: ComponentStates;
  diff?: {
    component: ComponentType;
    file?: string;
    changes: DiffChange[];
  };
  /** Chat state at snapshot time — message count for boundary-based restore */
  chat?: {
    messageCount: number;
  };
  /** Task state at snapshot time — full task list for restore */
  tasks?: Task[];
}
