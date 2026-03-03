/**
 * Demo Flow Types
 * 
 * 演示流程数据接口定义
 * 所有 mock 数据通过这些接口加载，避免硬编码
 */

import type {
  ExtendedChatMessage,
  ExtendedTimelineEvent,
  DemoFlowConfig,
  Participant,
  Task,
  UIDirective,
  ComponentType,
} from '../types';

// ============================================================
// Data Provider Interface
// ============================================================

/**
 * 演示数据提供者接口
 * 所有 mock 数据必须实现此接口
 */
export interface IDemoDataProvider {
  /** 获取演示流程配置 */
  getDemoFlowConfig(): DemoFlowConfig;
  
  /** 获取参与者列表 */
  getParticipants(): Participant[];
  
  /** 获取初始任务列表 */
  getInitialTasks(): Task[];
  
  /** 获取指定步骤的消息 */
  getStepMessages(stepIndex: number): ExtendedChatMessage[];
  
  /** 获取指定步骤的时间线事件 */
  getStepTimelineEvents(stepIndex: number): ExtendedTimelineEvent[];
  
  /** 处理交互响应 */
  handleInteraction(componentId: string, actionId: string, data?: unknown): InteractionHandlerResult;
}

/**
 * 交互处理结果
 */
export interface InteractionHandlerResult {
  /** 要添加的新消息 */
  messages?: ExtendedChatMessage[];
  /** 要执行的 UI 指令 */
  uiDirectives?: UIDirective[];
  /** 要添加的时间线事件 */
  timelineEvents?: ExtendedTimelineEvent[];
  /** 是否触发下一步 */
  triggerNextStep?: boolean;
}

// ============================================================
// Agent Definitions
// ============================================================

/**
 * Agent 定义
 */
export interface AgentDefinition {
  id: string;
  name: string;
  avatar?: string;
  role: 'research' | 'code' | 'writing' | 'analysis';
  description: string;
}

/**
 * Predefined Agent List
 */
export const DEMO_AGENTS: Record<string, AgentDefinition> = {
  'agent-research': {
    id: 'agent-research',
    name: 'Aria (Research)',
    role: 'research',
    description: 'Research assistant for paper search and analysis',
  },
  'agent-code': {
    id: 'agent-code',
    name: 'Copilot (Code)',
    role: 'code',
    description: 'Code assistant for writing and executing code',
  },
  'agent-writing': {
    id: 'agent-writing',
    name: 'Claude (Writing)',
    role: 'writing',
    description: 'Writing assistant for paper composition',
  },
  'agent-analysis': {
    id: 'agent-analysis',
    name: 'Nova (Analysis)',
    role: 'analysis',
    description: 'Analysis assistant for data analysis and visualization',
  },
};

// ============================================================
// Step Templates
// ============================================================

/**
 * 步骤模板定义
 */
export interface StepTemplate {
  id: string;
  title: string;
  description: string;
  primaryAgent: string;
  targetComponent: ComponentType;
  expectedDuration: number;
}

/**
 * VLA Research Demo Step Templates
 */
export const VLA_DEMO_STEPS: StepTemplate[] = [
  {
    id: 'step-1-init',
    title: 'Agent Initiates',
    description: 'Research Agent detects new papers and asks user',
    primaryAgent: 'agent-research',
    targetComponent: 'ai-editor',
    expectedDuration: 3000,
  },
  {
    id: 'step-2-confirm',
    title: 'User Confirms',
    description: 'User confirms analysis request with benchmark requirements',
    primaryAgent: 'agent-research',
    targetComponent: 'ai-editor',
    expectedDuration: 2000,
  },
  {
    id: 'step-3-pdf',
    title: 'PDF Analysis',
    description: 'Load and analyze VLA-RAIL paper',
    primaryAgent: 'agent-research',
    targetComponent: 'pdf-reader',
    expectedDuration: 5000,
  },
  {
    id: 'step-4-code',
    title: 'Code Experiment',
    description: 'Dispatch Code Agent to write and run benchmark',
    primaryAgent: 'agent-code',
    targetComponent: 'code-playground',
    expectedDuration: 6000,
  },
  {
    id: 'step-5-viz',
    title: 'Jupyter Visualization',
    description: 'Generate performance comparison charts',
    primaryAgent: 'agent-code',
    targetComponent: 'jupyter-notebook',
    expectedDuration: 4000,
  },
  {
    id: 'step-6-summary',
    title: 'Experiment Summary',
    description: 'Summarize results and ask about paper writing',
    primaryAgent: 'agent-research',
    targetComponent: 'ai-editor',
    expectedDuration: 3000,
  },
  {
    id: 'step-7-notes',
    title: 'Reference Notes',
    description: 'User references previous study notes',
    primaryAgent: 'agent-writing',
    targetComponent: 'ai-editor',
    expectedDuration: 2000,
  },
  {
    id: 'step-8-latex',
    title: 'LaTeX Writing',
    description: 'Write experiment section and references to LaTeX',
    primaryAgent: 'agent-writing',
    targetComponent: 'latex-editor',
    expectedDuration: 8000,
  },
  {
    id: 'step-9-final',
    title: 'Final Report',
    description: 'Summarize all work output',
    primaryAgent: 'agent-research',
    targetComponent: 'ai-editor',
    expectedDuration: 3000,
  },
];

// ============================================================
// Utility Types
// ============================================================

/**
 * 生成唯一 ID
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 获取当前时间戳字符串
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}
