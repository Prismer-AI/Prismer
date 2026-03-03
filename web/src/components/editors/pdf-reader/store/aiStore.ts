/**
 * AI Store
 * 
 * 管理 AI 相关的状态：洞察、对话、提取等
 * 支持多文档：每个文档有独立的缓存
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  PaperContext,
  PaperInsight,
  ChatMessage,
  Extract,
  SourceCitation,
  InsightType,
  BoundingBox,
} from '@/types/paperContext';

// ============================================================
// Types
// ============================================================

/**
 * 活动高亮 - 用于在 PDF 中显示引用位置
 */
export interface ActiveHighlight {
  id: string;
  pageNumber: number;
  bbox: BoundingBox;
  color?: string;
  source: 'citation' | 'insight' | 'chat' | 'user';
}

/**
 * 单个论文的 AI 数据缓存
 */
interface PaperAIData {
  insights: PaperInsight[];
  chatMessages: ChatMessage[];
  extracts: Extract[];
}

/**
 * AI Store 状态
 */
interface AIState {
  // 当前活动论文 ID
  activePaperId: string | null;
  
  // 多文档缓存: paperId -> PaperAIData
  paperDataCache: Map<string, PaperAIData>;
  
  // Paper Context (当前文档)
  paperContext: PaperContext | null;
  
  // 洞察 (当前文档)
  insights: PaperInsight[];
  insightsLoading: boolean;
  insightsError: string | null;
  
  // 对话 (当前文档)
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;
  streamingMessage: string;
  
  // 提取/注释 (当前文档)
  extracts: Extract[];
  
  // 活动高亮
  activeHighlights: ActiveHighlight[];
  
  // Chat 引用上下文 - 从选中文本传递到 Chat
  chatReference: {
    text: string;
    pageNumber?: number;
  } | null;
  
  // 待发送问题 - 从其他组件触发自动发送
  pendingQuestion: string | null;
  
  // 右侧面板状态
  rightPanelActiveTab: 'insights' | 'chat' | 'notes';
  rightPanelExpanded: boolean;
  
  // Agent 状态
  agentInitialized: boolean;
  agentError: string | null;
}

/**
 * AI Store 操作
 */
interface AIActions {
  // 多文档管理
  setActivePaper: (paperId: string) => void;
  switchToPaper: (paperId: string, context?: PaperContext) => void;
  savePaperDataToCache: (paperId: string) => void;
  loadPaperDataFromCache: (paperId: string) => void;
  
  // Paper Context
  setPaperContext: (context: PaperContext | null, paperId?: string) => void;
  
  // 洞察操作
  setInsights: (insights: PaperInsight[]) => void;
  addInsight: (insight: PaperInsight) => void;
  updateInsight: (id: string, updates: Partial<PaperInsight>) => void;
  removeInsight: (id: string) => void;
  setInsightsLoading: (loading: boolean) => void;
  setInsightsError: (error: string | null) => void;
  toggleInsightExpanded: (id: string) => void;
  
  // 对话操作
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastMessage: (updates: Partial<ChatMessage>) => void;
  appendToStreamingMessage: (text: string) => void;
  finishStreamingMessage: () => void;
  addCitationToLastMessage: (citation: SourceCitation) => void;
  clearChat: () => void;
  setChatLoading: (loading: boolean) => void;
  setChatError: (error: string | null) => void;
  
  // 提取操作
  addExtract: (extract: Omit<Extract, 'id' | 'createdAt'>) => void;
  updateExtract: (id: string, updates: Partial<Extract>) => void;
  removeExtract: (id: string) => void;
  addTagToExtract: (id: string, tag: string) => void;
  removeTagFromExtract: (id: string, tag: string) => void;
  
  // 高亮操作
  addHighlight: (highlight: Omit<ActiveHighlight, 'id'>) => void;
  removeHighlight: (id: string) => void;
  clearHighlights: () => void;
  highlightFromCitation: (citation: SourceCitation) => void;
  
  // Chat 引用操作
  setChatReference: (reference: AIState['chatReference']) => void;
  clearChatReference: () => void;
  
  // 待发送问题操作
  setPendingQuestion: (question: string | null) => void;
  clearPendingQuestion: () => void;
  
  // 面板操作
  setRightPanelTab: (tab: AIState['rightPanelActiveTab']) => void;
  toggleRightPanelExpanded: () => void;
  
  // Agent 操作
  setAgentInitialized: (initialized: boolean) => void;
  setAgentError: (error: string | null) => void;
  
  // 重置
  reset: () => void;
}

// ============================================================
// Initial State
// ============================================================

const initialState: AIState = {
  activePaperId: null,
  paperDataCache: new Map(),
  paperContext: null,
  insights: [],
  insightsLoading: false,
  insightsError: null,
  chatMessages: [],
  chatLoading: false,
  chatError: null,
  streamingMessage: '',
  extracts: [],
  activeHighlights: [],
  chatReference: null,
  pendingQuestion: null,
  rightPanelActiveTab: 'insights',
  rightPanelExpanded: true,
  agentInitialized: false,
  agentError: null,
};

// ============================================================
// Store
// ============================================================

export const useAIStore = create<AIState & AIActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ============================================================
        // 多文档管理
        // ============================================================
        
        // 设置活动论文 (不切换数据)
        setActivePaper: (paperId: string) => {
          set({ activePaperId: paperId });
        },
        
        // 切换到指定论文 (自动保存当前 + 加载目标)
        switchToPaper: (paperId: string, context?: PaperContext) => {
          const state = get();
          
          // 如果已经是当前论文，只更新 context
          if (state.activePaperId === paperId) {
            if (context) {
              set({ paperContext: context });
            }
            return;
          }
          
          // 保存当前论文数据到缓存
          if (state.activePaperId) {
            get().savePaperDataToCache(state.activePaperId);
          }
          
          // 设置新的活动论文
          set({ activePaperId: paperId });
          
          // 尝试从缓存加载
          const cached = state.paperDataCache.get(paperId);
          if (cached) {
            console.log(`[AIStore] Loading cached data for paper: ${paperId}`);
            set({
              insights: cached.insights,
              chatMessages: cached.chatMessages,
              extracts: cached.extracts,
              paperContext: context || null,
              insightsError: null,
            });
          } else {
            // 清空当前数据，等待新数据
            console.log(`[AIStore] No cache for paper: ${paperId}, clearing state`);
            set({
              insights: [],
              chatMessages: [],
              extracts: [],
              paperContext: context || null,
              insightsError: null,
              insightsLoading: false,
            });
          }
        },
        
        // 保存当前论文数据到缓存
        savePaperDataToCache: (paperId: string) => {
          const state = get();
          const newCache = new Map(state.paperDataCache);
          newCache.set(paperId, {
            insights: state.insights,
            chatMessages: state.chatMessages,
            extracts: state.extracts,
          });
          set({ paperDataCache: newCache });
          console.log(`[AIStore] Saved data to cache for paper: ${paperId}`);
        },
        
        // 从缓存加载论文数据
        loadPaperDataFromCache: (paperId: string) => {
          const cached = get().paperDataCache.get(paperId);
          if (cached) {
            set({
              insights: cached.insights,
              chatMessages: cached.chatMessages,
              extracts: cached.extracts,
            });
            console.log(`[AIStore] Loaded data from cache for paper: ${paperId}`);
          }
        },

        // ============================================================
        // Paper Context
        // ============================================================
        
        setPaperContext: (context, paperId?: string) => {
          const state = get();
          const effectivePaperId = paperId || context?.source?.arxivId || state.activePaperId;
          
          // 如果是新论文，触发切换
          if (effectivePaperId && effectivePaperId !== state.activePaperId) {
            get().switchToPaper(effectivePaperId, context || undefined);
          } else {
            set({ paperContext: context });
          }
        },

        // 洞察操作
        setInsights: (insights) => set({ insights }),
        
        addInsight: (insight) => set((state) => ({
          insights: [...state.insights, insight],
        })),
        
        updateInsight: (id, updates) => set((state) => ({
          insights: state.insights.map((i) =>
            i.id === id ? { ...i, ...updates } : i
          ),
        })),
        
        removeInsight: (id) => set((state) => ({
          insights: state.insights.filter((i) => i.id !== id),
        })),
        
        setInsightsLoading: (loading) => set({ insightsLoading: loading }),
        
        setInsightsError: (error) => set({ insightsError: error }),
        
        toggleInsightExpanded: (id) => set((state) => ({
          insights: state.insights.map((i) =>
            i.id === id ? { ...i, expanded: !i.expanded } : i
          ),
        })),

        // 对话操作
        addChatMessage: (message) => set((state) => ({
          chatMessages: [
            ...state.chatMessages,
            {
              ...message,
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: Date.now(),
            },
          ],
        })),
        
        updateLastMessage: (updates) => set((state) => {
          const messages = [...state.chatMessages];
          if (messages.length > 0) {
            messages[messages.length - 1] = {
              ...messages[messages.length - 1],
              ...updates,
            };
          }
          return { chatMessages: messages };
        }),
        
        appendToStreamingMessage: (text) => set((state) => ({
          streamingMessage: state.streamingMessage + text,
        })),
        
        finishStreamingMessage: () => {
          const { streamingMessage, chatMessages } = get();
          if (streamingMessage) {
            // 更新最后一条消息的内容
            const messages = [...chatMessages];
            if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
              messages[messages.length - 1] = {
                ...messages[messages.length - 1],
                content: streamingMessage,
                streaming: false,
              };
            }
            set({ chatMessages: messages, streamingMessage: '' });
          }
        },
        
        addCitationToLastMessage: (citation) => set((state) => {
          const messages = [...state.chatMessages];
          if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
            const lastMessage = messages[messages.length - 1];
            const citations = lastMessage.citations || [];
            // 避免重复添加相同页码的引用
            if (!citations.some(c => c.pageNumber === citation.pageNumber)) {
              messages[messages.length - 1] = {
                ...lastMessage,
                citations: [...citations, citation],
              };
            }
          }
          return { chatMessages: messages };
        }),
        
        clearChat: () => set({ chatMessages: [], streamingMessage: '' }),
        
        setChatLoading: (loading) => set({ chatLoading: loading }),
        
        setChatError: (error) => set({ chatError: error }),

        // 提取操作
        addExtract: (extract) => set((state) => ({
          extracts: [
            ...state.extracts,
            {
              ...extract,
              id: `extract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              createdAt: Date.now(),
            },
          ],
        })),
        
        updateExtract: (id, updates) => set((state) => ({
          extracts: state.extracts.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        })),
        
        removeExtract: (id) => set((state) => ({
          extracts: state.extracts.filter((e) => e.id !== id),
        })),
        
        addTagToExtract: (id, tag) => set((state) => ({
          extracts: state.extracts.map((e) =>
            e.id === id && !e.tags.includes(tag)
              ? { ...e, tags: [...e.tags, tag] }
              : e
          ),
        })),
        
        removeTagFromExtract: (id, tag) => set((state) => ({
          extracts: state.extracts.map((e) =>
            e.id === id ? { ...e, tags: e.tags.filter((t) => t !== tag) } : e
          ),
        })),

        // 高亮操作
        addHighlight: (highlight) => set((state) => ({
          activeHighlights: [
            ...state.activeHighlights,
            {
              ...highlight,
              id: `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            },
          ],
        })),
        
        removeHighlight: (id) => set((state) => ({
          activeHighlights: state.activeHighlights.filter((h) => h.id !== id),
        })),
        
        clearHighlights: () => set({ activeHighlights: [] }),
        
        highlightFromCitation: (citation) => {
          if (citation.bbox) {
            get().addHighlight({
              pageNumber: citation.pageNumber,
              bbox: citation.bbox,
              color: '#FFD700', // 金色
              source: 'citation',
            });
          }
        },

        // Chat 引用操作
        setChatReference: (reference) => set({ chatReference: reference }),
        clearChatReference: () => set({ chatReference: null }),
        
        // 待发送问题操作
        setPendingQuestion: (question) => set({ pendingQuestion: question }),
        clearPendingQuestion: () => set({ pendingQuestion: null }),
        
        // 面板操作
        setRightPanelTab: (tab) => set({ rightPanelActiveTab: tab }),
        
        toggleRightPanelExpanded: () => set((state) => ({
          rightPanelExpanded: !state.rightPanelExpanded,
        })),

        // Agent 操作
        setAgentInitialized: (initialized) => set({ agentInitialized: initialized }),
        
        setAgentError: (error) => set({ agentError: error }),

        // 重置
        reset: () => set(initialState),
      }),
      {
        name: 'ai-store',
        partialize: (state) => ({
          // 持久化重要状态
          extracts: state.extracts,
          chatMessages: state.chatMessages,  // 持久化聊天记录
          insights: state.insights,           // 持久化洞察结果
          rightPanelActiveTab: state.rightPanelActiveTab,
          rightPanelExpanded: state.rightPanelExpanded,
        }),
      }
    ),
    { name: 'ai-store' }
  )
);

// ============================================================
// Selectors
// ============================================================

/**
 * 获取特定类型的洞察
 */
export const selectInsightsByType = (type: InsightType) => (state: AIState) =>
  state.insights.filter((i) => i.type === type);

/**
 * 获取特定页面的高亮
 */
export const selectHighlightsByPage = (pageNumber: number) => (state: AIState) =>
  state.activeHighlights.filter((h) => h.pageNumber === pageNumber);

/**
 * 获取特定类型的提取
 */
export const selectExtractsByType = (type: Extract['type']) => (state: AIState) =>
  state.extracts.filter((e) => e.type === type);

/**
 * 获取带有特定标签的提取
 */
export const selectExtractsByTag = (tag: string) => (state: AIState) =>
  state.extracts.filter((e) => e.tags.includes(tag));

