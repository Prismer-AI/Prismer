/**
 * Workspace Components Exports
 *
 * @description
 * 统一导出 Workspace 模块的所有组件，便于外部导入。
 *
 * 组件分类:
 * - Agent: Agent 状态和控制组件（Phase 1 核心）
 * - Chat: 对话面板相关组件
 * - Task: 任务面板组件
 * - Window: 窗口查看器组件
 * - Timeline: 时间线组件
 * - Interactive: 交互式组件
 * - Diff: 差异对比组件
 */

// Main layout
export { default as WorkspaceView } from './WorkspaceView';

// ============================================================
// Agent Components (Phase 1 - OpenClaw Integration)
// ============================================================
export { AgentStatusBadge } from './AgentStatusBadge';
export { AgentControlPanel } from './AgentControlPanel';
export { ConnectionIndicator } from './ConnectionIndicator';
export type { ConnectionStatus, ConnectionIndicatorProps } from './ConnectionIndicator';

// Chat Panel
export { WorkspaceChat } from './WorkspaceChat';
export { MessageList } from './WorkspaceChat/MessageList';
export { ChatInput } from './WorkspaceChat/ChatInput';

// Task Panel
export { TaskPanel } from './TaskPanel';

// Window Viewer
export { WindowViewer } from './WindowViewer';
export { ComponentTabs } from './WindowViewer/ComponentTabs';

// Timeline
export { Timeline } from './Timeline';

// Chat Toggle (SiriOrb + TaskBubble)
export { ChatToggle } from './ChatToggle';
export { TaskBubble } from './ChatToggle/TaskBubble';

// Interactive Components
export { InteractiveComponentRenderer } from './InteractiveComponents';
export { ButtonGroup } from './InteractiveComponents/ButtonGroup';
export { ChoiceCard } from './InteractiveComponents/ChoiceCard';
export { SummaryCard } from './InteractiveComponents/SummaryCard';
export { ProgressCard } from './InteractiveComponents/ProgressCard';
export { CodeBlock } from './InteractiveComponents/CodeBlock';

// Diff Viewer
export { DiffViewer, InlineDiffHighlight } from './DiffViewer';

// Re-export shared components for convenience
export { ActionCard } from '@/components/shared/ActionCard';
