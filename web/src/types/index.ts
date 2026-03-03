/**
 * Shared Types — Public API
 *
 * Cross-module type definitions used by workspace, sync, mobile, etc.
 */

// Component infrastructure
export type { ComponentType } from '@/lib/events/types';

// Task types
export type { TaskStatus, SubTask, TaskOutput, Task } from './task';

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
} from './message';

// Timeline types
export type {
  TimelineActionType,
  TimelineEvent,
  DiffChangeType,
  DiffChange,
  Highlight,
  ExtendedTimelineEvent,
  StateSnapshot,
} from './timeline';

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
} from './workspace';
export { DISABLED_COMPONENTS } from './workspace';
