/**
 * Workspace Types — Re-export Hub
 *
 * Re-exports shared types from src/types/ for backward compatibility.
 * New code should import directly from '@/types' or '@/types/<domain>'.
 *
 * This file also defines workspace-local types (demo flow, interactions)
 * that are not used outside the workspace module.
 */

// ============================================================
// Re-exports from src/types/ (backward compatibility)
// ============================================================

// Component infrastructure
export type { ComponentType } from '@/lib/events/types';

// Task types
export type { TaskStatus, SubTask, TaskOutput, Task } from '@/types/task';

// Message & chat types
export type {
  ParticipantType,
  ParticipantStatus,
  ParticipantRole,
  Participant,
  AgentActionType,
  AgentAction,
  MessageContentType,
  ChatMessage,
  InteractiveComponentType,
  ButtonVariant,
  ButtonConfig,
  ButtonGroupComponent,
  ChoiceOption,
  ChoiceCardComponent,
  StatItem,
  SummaryCardComponent,
  ProgressCardComponent,
  InputFieldComponent,
  CodeBlockComponent,
  InteractiveComponent,
  AgentHandoff,
  UIDirectiveType,
  UIDirective,
  ExtendedChatMessage,
} from '@/types/message';

// Timeline types
export type {
  TimelineActionType,
  TimelineEvent,
  DiffChangeType,
  DiffChange,
  Highlight,
  ExtendedTimelineEvent,
  StateSnapshot,
} from '@/types/timeline';

// Workspace types
export type {
  TaskPanelHeight,
  LayoutConfig,
  Workspace,
  PdfReaderState,
  LatexEditorState,
  CodePlaygroundState,
  JupyterNotebookState,
  AiEditorState,
  AgGridState,
  ComponentStates,
  AgentWorkflowState,
  AsyncOperationType,
  AsyncOperation,
  DisabledComponentType,
  ActiveComponentType,
} from '@/types/workspace';
export { DISABLED_COMPONENTS } from '@/types/workspace';

// ============================================================
// Workspace-local types (not re-exported from src/types/)
// ============================================================

// --- Needed imports for local types ---
import type { ExtendedChatMessage } from '@/types/message';
import type { UIDirective } from '@/types/message';
import type { ExtendedTimelineEvent } from '@/types/timeline';

/** Demo step */
export interface DemoStep {
  id: string;
  order: number;
  title: string;
  description: string;
  messages: ExtendedChatMessage[];
  timelineEvents: ExtendedTimelineEvent[];
  expectedDuration: number;
}

/** Demo flow configuration */
export interface DemoFlowConfig {
  id: string;
  name: string;
  description: string;
  steps: DemoStep[];
  totalDuration: number;
}

/** Interaction event */
export interface InteractionEvent {
  componentId: string;
  actionId: string;
  data?: unknown;
  timestamp: number;
}

/** Interaction response */
export interface InteractionResponse {
  messages?: ExtendedChatMessage[];
  uiDirectives?: UIDirective[];
  timelineEvents?: ExtendedTimelineEvent[];
}
