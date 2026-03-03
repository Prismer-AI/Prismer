/**
 * Message & Chat Types
 *
 * Workspace chat messages, participants, interactive components.
 * Used by workspace stores, sync layer, and mobile.
 */

import type { ComponentType } from '@/lib/events/types';
import type { TaskStatus } from './task';

// ============================================================
// Participant Types
// ============================================================

export type ParticipantType = 'user' | 'agent';
export type ParticipantStatus = 'online' | 'offline' | 'busy';
export type ParticipantRole = 'owner' | 'member' | 'agent' | 'collaborator' | 'advisor';

export interface Participant {
  id: string;
  name: string;
  avatar?: string;
  type: ParticipantType;
  status: ParticipantStatus;
  role: ParticipantRole;
}

// ============================================================
// Agent Action Types
// ============================================================

export type AgentActionType =
  | 'search_papers'
  | 'analyze_paper'
  | 'draw_conclusion'
  | 'write_content'
  | 'execute_code'
  | 'thinking';

export interface AgentAction {
  id: string;
  type: AgentActionType;
  status: TaskStatus;
  description: string;
  timestamp: string;
  duration?: number;
  data?: Record<string, unknown>;
}

// ============================================================
// Chat Message Types
// ============================================================

export type MessageContentType = 'text' | 'markdown' | 'code' | 'image' | 'file';

export interface ChatMessage {
  id: string;
  workspaceId: string;
  senderId: string;
  senderType: ParticipantType;
  senderName: string;
  senderAvatar?: string;
  content: string;
  contentType: MessageContentType;
  actions?: AgentAction[];
  timestamp: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Interactive Component Types
// ============================================================

export type InteractiveComponentType =
  | 'button-group'
  | 'choice-card'
  | 'input-field'
  | 'select'
  | 'slider'
  | 'file-picker'
  | 'code-block'
  | 'summary-card'
  | 'progress-card';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonConfig {
  id: string;
  label: string;
  variant: ButtonVariant;
  icon?: string;
  disabled?: boolean;
}

export interface ButtonGroupComponent {
  type: 'button-group';
  id: string;
  buttons: ButtonConfig[];
  layout?: 'horizontal' | 'vertical';
}

export interface ChoiceOption {
  id: string;
  icon?: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface ChoiceCardComponent {
  type: 'choice-card';
  id: string;
  title: string;
  options: ChoiceOption[];
  multiSelect?: boolean;
}

export interface StatItem {
  label: string;
  value: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface SummaryCardComponent {
  type: 'summary-card';
  id: string;
  title?: string;
  stats: StatItem[];
  actions?: ButtonConfig[];
}

export interface ProgressCardComponent {
  type: 'progress-card';
  id: string;
  title: string;
  progress: number;
  status: string;
  steps?: { label: string; completed: boolean }[];
}

export interface InputFieldComponent {
  type: 'input-field';
  id: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
}

export interface CodeBlockComponent {
  type: 'code-block';
  id: string;
  language: string;
  code: string;
  executable?: boolean;
  showLineNumbers?: boolean;
}

export type InteractiveComponent =
  | ButtonGroupComponent
  | ChoiceCardComponent
  | SummaryCardComponent
  | ProgressCardComponent
  | InputFieldComponent
  | CodeBlockComponent;

// ============================================================
// Agent Handoff
// ============================================================

export interface AgentHandoff {
  targetAgent: string;
  reason: string;
  context?: Record<string, unknown>;
}

// ============================================================
// UI Directive Types
// ============================================================

export type UIDirectiveType =
  | 'switch_component'
  | 'load_document'
  | 'update_content'
  | 'highlight_diff'
  | 'scroll_to'
  | 'focus_element'
  | 'open_panel'
  | 'close_panel'
  | 'resize_panel'
  | 'split_view'
  | 'toggle_fullscreen'
  | 'load_dataset'
  | 'refresh_data'
  | 'export_data'
  | 'request_user_input'
  | 'show_confirmation'
  | 'show_progress'
  | 'navigate_to_page'
  | 'navigate_to_cell'
  | 'navigate_to_line'
  | 'show_notification'
  | 'play_animation'
  // Plugin-originated directive types (mapped from UPPERCASE by useDirectiveStream)
  | 'latex_compile_complete'
  | 'jupyter_cell_result'
  | 'update_gallery'
  | 'update_data_grid'
  | 'terminal_output'
  // LaTeX project directives (multi-file)
  | 'update_latex_project'
  | 'delete_latex_project_file'
  | 'latex_project_compile_complete'
  // Agent observability directives (Phase A/B)
  | 'update_tasks'
  | 'request_confirmation'
  | 'operation_status'
  | 'agent_thinking'
  | 'agent_tool_start'
  | 'agent_tool_result';

export interface UIDirective {
  type: UIDirectiveType;
  target?: ComponentType | string;
  delay?: number;
  data?: Record<string, unknown>;
}

// ============================================================
// Artifact Types
// ============================================================

export type ArtifactType =
  | 'notebook'
  | 'latex'
  | 'code'
  | 'data'
  | 'pdf'
  | 'notes'
  | 'image'
  | 'model3d';

export interface ArtifactRef {
  id: string;
  type: ArtifactType;
  name: string;
  description?: string;
  version?: string;
  size?: string;
  previewUrl?: string;
  previewText?: string;
  path?: string;
}

export const ARTIFACT_COMPONENT_MAP: Record<ArtifactType, ComponentType | null> = {
  notebook: 'jupyter-notebook',
  latex: 'latex-editor',
  code: 'code-playground',
  data: 'ag-grid',
  pdf: 'pdf-reader',
  notes: 'ai-editor',
  image: 'bento-gallery',
  model3d: 'three-viewer',
};

// ============================================================
// Extended Chat Message
// ============================================================

export interface ExtendedChatMessage extends ChatMessage {
  interactiveComponents?: InteractiveComponent[];
  uiDirectives?: UIDirective[];
  agentHandoff?: AgentHandoff;
  references?: string[];
  artifacts?: ArtifactRef[];
}
