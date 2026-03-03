/**
 * LaTeX Agent Types
 * 
 * Types for the AI writing assistant that helps with academic paper writing.
 */

// Agent action types
export type AgentActionType = 
  | 'search_papers'      // 搜索相关论文
  | 'analyze_paper'      // 分析论文内容
  | 'draw_conclusion'    // 得出结论
  | 'write_content'      // 写入内容到 LaTeX
  | 'thinking';          // 思考过程

// Status of an action
export type ActionStatus = 'pending' | 'running' | 'completed' | 'error';

// Paper search result
export interface PaperReference {
  id: string;
  title: string;
  authors: string[];
  year: number;
  abstract?: string;
  doi?: string;
  citations?: number;
  source: 'arxiv' | 'semantic_scholar' | 'google_scholar';
}

// Single agent action
export interface AgentAction {
  id: string;
  type: AgentActionType;
  status: ActionStatus;
  description: string;
  timestamp: string;
  duration?: number;
  data?: {
    // For search_papers
    query?: string;
    papers?: PaperReference[];
    // For analyze_paper
    paperId?: string;
    analysis?: string;
    keyPoints?: string[];
    // For draw_conclusion
    conclusion?: string;
    // For write_content
    content?: string;
    section?: string;
    position?: 'append' | 'replace' | 'insert';
    lineNumber?: number;
  };
}

// Chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: AgentAction[];
}

// Agent session state
export interface AgentSession {
  id: string;
  startedAt: string;
  messages: ChatMessage[];
  currentAction?: AgentAction;
  papersSearched: PaperReference[];
}

// Mock data stream event
export interface StreamEvent {
  type: 'action_start' | 'action_progress' | 'action_complete' | 'message' | 'content_write';
  data: {
    actionId?: string;
    action?: AgentAction;
    message?: string;
    content?: string;
    progress?: number;
  };
}

// Writing task configuration
export interface WritingTask {
  id: string;
  instruction: string;
  targetSection?: string;
  context?: string;
}
