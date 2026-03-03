/**
 * Chat Session Store
 * 
 * 独立于文档的聊天会话管理
 * - 支持多论文对话
 * - 会话持久化
 * - 切换论文不丢失对话
 */

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { v4 as uuidv4 } from 'uuid';
import {
  Citation,
  MessageContext,
  PaperAliasMap,
} from '../types/citation';
import { citationMapper, paperAliasAssigner, citationTagParser } from '../services/citationSystem';
import { createUserIsolatedStorage } from '@/lib/storage/userStorageManager';

// Stable empty arrays to avoid infinite loop in selectors
const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_SESSIONS: ChatSession[] = [];

// ============================================================
// 类型定义
// ============================================================

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  
  /** 原始内容 (保留 AI 生成的标签) */
  rawContent: string;
  
  /** 解析后的引用列表 */
  citations: Citation[];
  
  /** 消息上下文 */
  messageContext: MessageContext;
  
  /** 消息关联的论文 */
  targetPaperIds?: string[];
  
  timestamp: number;
}

/**
 * 上下文配置
 */
export interface ChatContextConfig {
  mode: 'single' | 'multi' | 'selective';
  selectedDetections?: string[];
  maxContextLength: number;
  includeFigures: boolean;
}

/**
 * 聊天会话
 */
export interface ChatSession {
  id: string;
  title: string;
  
  /** 关联的论文 ID 列表 */
  paperIds: string[];
  
  /** 论文别名映射 (会话级别，稳定不变) */
  paperAliasMap: PaperAliasMap;
  
  /** 消息历史 */
  messages: ChatMessage[];
  
  /** 上下文配置 */
  contextConfig: ChatContextConfig;
  
  createdAt: number;
  updatedAt: number;
  archived: boolean;
}

// ============================================================
// Store 状态
// ============================================================

interface ChatSessionState {
  /** 会话列表 */
  sessions: ChatSession[];
  
  /** 当前活动会话 ID */
  activeSessionId: string | null;
  
  /** 流式响应内容 */
  streamingMessage: string;
  
  /** 加载状态 */
  isLoading: boolean;
  
  /** 错误信息 */
  error: string | null;
}

interface ChatSessionActions {
  // 会话管理
  createSession: (title: string, paperIds?: string[]) => ChatSession;
  deleteSession: (id: string) => void;
  archiveSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  
  // 切换会话
  setActiveSession: (id: string | null) => void;
  getActiveSession: () => ChatSession | null;
  
  // 论文关联
  addPaperToSession: (sessionId: string, paperId: string) => void;
  removePaperFromSession: (sessionId: string, paperId: string) => void;
  
  // 消息管理
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp' | 'citations'>) => void;
  updateLastMessage: (content: string) => void;
  appendToStreamingMessage: (chunk: string) => void;
  finishStreamingMessage: () => void;
  clearStreamingMessage: () => void;
  
  // 状态管理
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 工具方法
  getSessionForPaper: (paperId: string) => ChatSession | null;
  createOrGetSessionForPaper: (paperId: string, paperTitle?: string) => ChatSession;
}

// ============================================================
// 默认值
// ============================================================

const DEFAULT_CONTEXT_CONFIG: ChatContextConfig = {
  mode: 'single',
  maxContextLength: 50000,
  includeFigures: true,
};

// ============================================================
// Store 实现
// ============================================================

export const useChatSessionStore = create<ChatSessionState & ChatSessionActions>()(
  devtools(
    persist(
      (set, get) => ({
        // 初始状态
        sessions: [],
        activeSessionId: null,
        streamingMessage: '',
        isLoading: false,
        error: null,
        
        // ============================================================
        // 会话管理
        // ============================================================
        
        createSession: (title, paperIds = []) => {
          const id = uuidv4();
          const now = Date.now();
          
          // 分配论文别名
          const paperAliasMap = paperAliasAssigner.assignAliases(paperIds);
          
          const newSession: ChatSession = {
            id,
            title,
            paperIds,
            paperAliasMap,
            messages: [],
            contextConfig: { ...DEFAULT_CONTEXT_CONFIG },
            createdAt: now,
            updatedAt: now,
            archived: false,
          };
          
          set(state => ({
            sessions: [...state.sessions, newSession],
            activeSessionId: id,
          }));
          
          return newSession;
        },
        
        deleteSession: (id) => {
          set(state => ({
            sessions: state.sessions.filter(s => s.id !== id),
            activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          }));
        },
        
        archiveSession: (id) => {
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === id ? { ...s, archived: true, updatedAt: Date.now() } : s
            ),
          }));
        },
        
        updateSession: (id, updates) => {
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
            ),
          }));
        },
        
        // ============================================================
        // 切换会话
        // ============================================================
        
        setActiveSession: (id) => {
          set({ activeSessionId: id, streamingMessage: '' });
        },
        
        getActiveSession: () => {
          const { sessions, activeSessionId } = get();
          if (!activeSessionId) return null;
          return sessions.find(s => s.id === activeSessionId) || null;
        },
        
        // ============================================================
        // 论文关联
        // ============================================================
        
        addPaperToSession: (sessionId, paperId) => {
          set(state => ({
            sessions: state.sessions.map(s => {
              if (s.id !== sessionId) return s;
              if (s.paperIds.includes(paperId)) return s;
              
              // 更新论文列表和别名映射
              const newPaperIds = [...s.paperIds, paperId];
              const newAliasMap = paperAliasAssigner.assignAliases(
                newPaperIds,
                s.paperAliasMap
              );
              
              return {
                ...s,
                paperIds: newPaperIds,
                paperAliasMap: newAliasMap,
                updatedAt: Date.now(),
              };
            }),
          }));
        },
        
        removePaperFromSession: (sessionId, paperId) => {
          // 注意：通常不建议移除论文，因为会影响历史消息的标签解析
          set(state => ({
            sessions: state.sessions.map(s => {
              if (s.id !== sessionId) return s;
              return {
                ...s,
                paperIds: s.paperIds.filter(id => id !== paperId),
                // 保留别名映射，不删除
                updatedAt: Date.now(),
              };
            }),
          }));
        },
        
        // ============================================================
        // 消息管理
        // ============================================================
        
        addMessage: (messageData) => {
          const session = get().getActiveSession();
          if (!session) {
            console.warn('[ChatSessionStore] No active session');
            return;
          }
          
          // 解析标签并映射为 Citations
          const tags = citationTagParser.parse(messageData.rawContent);
          const citations = citationMapper.mapToCitations(tags, messageData.messageContext);
          
          const message: ChatMessage = {
            ...messageData,
            id: uuidv4(),
            citations,
            timestamp: Date.now(),
          };
          
          set(state => ({
            sessions: state.sessions.map(s => {
              if (s.id !== session.id) return s;
              return {
                ...s,
                messages: [...s.messages, message],
                updatedAt: Date.now(),
              };
            }),
          }));
        },
        
        updateLastMessage: (content) => {
          const session = get().getActiveSession();
          if (!session || session.messages.length === 0) return;
          
          const lastMessage = session.messages[session.messages.length - 1];
          
          // 重新解析引用
          const tags = citationTagParser.parse(content);
          const citations = citationMapper.mapToCitations(tags, lastMessage.messageContext);
          
          set(state => ({
            sessions: state.sessions.map(s => {
              if (s.id !== session.id) return s;
              const messages = [...s.messages];
              messages[messages.length - 1] = {
                ...lastMessage,
                rawContent: content,
                citations,
              };
              return { ...s, messages, updatedAt: Date.now() };
            }),
          }));
        },
        
        appendToStreamingMessage: (chunk) => {
          set(state => ({
            streamingMessage: state.streamingMessage + chunk,
          }));
        },
        
        finishStreamingMessage: () => {
          const { streamingMessage, getActiveSession } = get();
          const session = getActiveSession();
          
          if (!session || !streamingMessage) return;
          
          // 确定消息上下文
          const messageContext: MessageContext = session.paperIds.length > 1
            ? {
                mode: 'multi',
                paperAliasMap: session.paperAliasMap,
              }
            : {
                mode: 'single',
                defaultPaperId: session.paperIds[0],
              };
          
          // 添加 assistant 消息
          get().addMessage({
            role: 'assistant',
            rawContent: streamingMessage,
            messageContext,
          });
          
          set({ streamingMessage: '' });
        },
        
        clearStreamingMessage: () => {
          set({ streamingMessage: '' });
        },
        
        // ============================================================
        // 状态管理
        // ============================================================
        
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        
        // ============================================================
        // 工具方法
        // ============================================================
        
        getSessionForPaper: (paperId) => {
          const { sessions } = get();
          // 查找包含该论文的最近更新的会话
          const matchingSessions = sessions
            .filter(s => s.paperIds.includes(paperId) && !s.archived)
            .sort((a, b) => b.updatedAt - a.updatedAt);
          return matchingSessions[0] || null;
        },
        
        createOrGetSessionForPaper: (paperId, paperTitle) => {
          let session = get().getSessionForPaper(paperId);
          
          if (!session) {
            const title = paperTitle
              ? `Chat: ${paperTitle.slice(0, 30)}${paperTitle.length > 30 ? '...' : ''}`
              : `Chat: ${paperId}`;
            session = get().createSession(title, [paperId]);
          } else {
            // 确保会话是活动的
            get().setActiveSession(session.id);
          }
          
          return session;
        },
      }),
      {
        name: 'chat-session-storage',
        version: 1,
        // 使用用户隔离存储，未登录用户不保存聊天记录
        storage: createUserIsolatedStorage('chat-session-storage', true),
        partialize: (state) => ({
          sessions: state.sessions,
          activeSessionId: state.activeSessionId,
        }),
        migrate: (persistedState: any, version: number) => {
          // Handle migration from older versions
          if (version === 0) {
            // Clear old data if structure is incompatible
            return { sessions: [], activeSessionId: null };
          }
          return persistedState as ChatSessionState;
        },
      }
    ),
    { name: 'ChatSessionStore' }
  )
);

// ============================================================
// Hooks
// ============================================================

/**
 * 获取活动会话
 */
export function useActiveSession(): ChatSession | null {
  return useChatSessionStore(state => {
    if (!state.activeSessionId) return null;
    return state.sessions.find(s => s.id === state.activeSessionId) || null;
  });
}

/**
 * 获取活动会话的消息
 */
export function useSessionMessages(): ChatMessage[] {
  return useChatSessionStore(
    useShallow(state => {
      if (!state.activeSessionId) return EMPTY_MESSAGES;
      const session = state.sessions.find(s => s.id === state.activeSessionId);
      return session?.messages ?? EMPTY_MESSAGES;
    })
  );
}

/**
 * 获取非归档会话列表
 */
export function useActiveSessions(): ChatSession[] {
  return useChatSessionStore(
    useShallow(state => {
      const filtered = state.sessions.filter(s => !s.archived);
      if (filtered.length === 0) return EMPTY_SESSIONS;
      return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
    })
  );
}

/**
 * 清除所有聊天会话（用于登出时）
 */
export function clearAllChatSessions(): void {
  useChatSessionStore.setState({
    sessions: [],
    activeSessionId: null,
    streamingMessage: '',
    isLoading: false,
    error: null,
  });
}
