/**
 * Storage Persistence Hook
 * 
 * 自动同步 Zustand stores 到 IndexedDB
 * - 自动保存
 * - 启动时加载
 * - 防抖处理
 */

import { useEffect, useRef, useCallback } from 'react';
import { useChatSessionStore, ChatSession } from '../store/chatSessionStore';
import { useNotebookStore, Notebook } from '../store/notebookStore';
import { useInsightStore, PaperInsightsCache } from '../store/insightStore';
import { useStorage, getUserStorageManager } from '@/lib/storage';
import { ChatSession as StorageChatSession, Notebook as StorageNotebook } from '@/lib/storage/types';

// ============================================================
// 类型转换
// ============================================================

/**
 * 将 Store 的 ChatSession 转换为 Storage 格式
 */
function toStorageChatSession(session: ChatSession): StorageChatSession {
  return {
    id: session.id,
    title: session.title,
    paperIds: session.paperIds,
    messages: session.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.rawContent,
      citations: m.citations.map(c => ({
        id: c.uri,
        paperId: c.paperId,
        paperTitle: c.paperTitle || '',
        detectionId: c.detectionId,
        pageNumber: c.pageNumber,
        excerpt: c.excerpt || '',
        createdAt: m.timestamp,
      })),
      timestamp: m.timestamp,
    })),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    archived: session.archived,
  };
}

/**
 * 将 Storage 的 ChatSession 转换为 Store 格式
 */
function fromStorageChatSession(session: StorageChatSession): ChatSession {
  return {
    id: session.id,
    title: session.title,
    paperIds: session.paperIds,
    paperAliasMap: {}, // 会在加载后重新计算
    messages: session.messages.map(m => ({
      id: m.id,
      role: m.role,
      rawContent: m.content,
      citations: (m.citations || []).map(c => ({
        uri: `${c.paperId}#${c.detectionId}` as const,
        paperId: c.paperId,
        detectionId: c.detectionId,
        paperTitle: c.paperTitle,
        pageNumber: c.pageNumber,
        type: 'text' as const, // 默认类型
        excerpt: c.excerpt,
      })),
      messageContext: {
        mode: session.paperIds.length > 1 ? 'multi' : 'single',
        defaultPaperId: session.paperIds[0],
      },
      timestamp: m.timestamp,
    })),
    contextConfig: {
      mode: session.paperIds.length > 1 ? 'multi' : 'single',
      maxContextLength: 50000,
      includeFigures: true,
    },
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    archived: session.archived,
  };
}

/**
 * 将 Store 的 Notebook 转换为 Storage 格式
 */
function toStorageNotebook(notebook: Notebook): StorageNotebook {
  return {
    id: notebook.id,
    name: notebook.name,
    description: notebook.description,
    entries: notebook.entries.map(e => ({
      id: e.id,
      type: e.type,
      content: e.rawContent,
      source: e.source ? {
        id: e.source.uri,
        paperId: e.source.paperId,
        paperTitle: e.source.paperTitle || '',
        detectionId: e.source.detectionId,
        pageNumber: e.source.pageNumber,
        excerpt: e.source.excerpt || '',
        createdAt: e.createdAt,
      } : undefined,
      createdAt: e.createdAt,
      annotation: e.annotation,
    })),
    paperIds: notebook.paperIds,
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt,
    tags: notebook.tags,
  };
}

/**
 * 将 Storage 的 Notebook 转换为 Store 格式
 */
function fromStorageNotebook(notebook: StorageNotebook): Notebook {
  return {
    id: notebook.id,
    name: notebook.name,
    description: notebook.description,
    entries: notebook.entries.map(e => ({
      id: e.id,
      type: e.type,
      rawContent: e.content,
      citations: [], // 可以后续重新解析
      source: e.source ? {
        uri: `${e.source.paperId}#${e.source.detectionId}` as const,
        paperId: e.source.paperId,
        detectionId: e.source.detectionId,
        paperTitle: e.source.paperTitle,
        pageNumber: e.source.pageNumber,
        type: 'text' as const,
        excerpt: e.source.excerpt,
      } : undefined,
      annotation: e.annotation,
      createdAt: e.createdAt,
    })),
    paperIds: notebook.paperIds,
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt,
    tags: notebook.tags,
  };
}

// ============================================================
// Persistence Hook
// ============================================================

/**
 * 自动持久化 Hook
 * 
 * 使用方式:
 * ```tsx
 * function App() {
 *   useStoragePersistence();
 *   // ...
 * }
 * ```
 */
export function useStoragePersistence() {
  const storage = useStorage();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  
  // Store states
  const chatSessions = useChatSessionStore(s => s.sessions);
  const notebooks = useNotebookStore(s => s.notebooks);
  const paperInsightsCache = useInsightStore(s => s.paperInsightsCache);
  
  // 获取用户认证状态
  const storageManager = getUserStorageManager();
  const isLoggedIn = storageManager.isLoggedIn();
  
  // ============================================================
  // 初始加载 (仅登录用户)
  // ============================================================
  
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    
    // 未登录用户不加载持久化数据
    if (!isLoggedIn) {
      console.log('[Persistence] Skip loading: user not logged in');
      return;
    }
    
    async function loadFromStorage() {
      try {
        console.log('[Persistence] Loading from IndexedDB...');
        
        // 加载 Chat Sessions
        const storedSessions = await storage.listChatSessions();
        if (storedSessions.length > 0) {
          const sessions = storedSessions.map(fromStorageChatSession);
          // 直接设置到 store (绕过 persist 中间件避免循环)
          useChatSessionStore.setState({ sessions });
          console.log(`[Persistence] Loaded ${sessions.length} chat sessions`);
        }
        
        // 加载 Notebooks
        const storedNotebooks = await storage.listNotebooks();
        if (storedNotebooks.length > 0) {
          const nbs = storedNotebooks.map(fromStorageNotebook);
          useNotebookStore.setState({ notebooks: nbs });
          console.log(`[Persistence] Loaded ${nbs.length} notebooks`);
        }
        
        // Insights 通过 paperId 按需加载，不在这里全量加载
        
      } catch (error) {
        console.error('[Persistence] Failed to load from storage:', error);
      }
    }
    
    loadFromStorage();
  }, [storage, isLoggedIn]);
  
  // ============================================================
  // 自动保存 Chat Sessions (防抖)
  // ============================================================
  
  const saveChatSessions = useCallback(async () => {
    // 未登录用户不保存
    if (!storageManager.isLoggedIn()) {
      console.log('[Persistence] Skip saving chat sessions: user not logged in');
      return;
    }
    
    try {
      const sessions = useChatSessionStore.getState().sessions;
      for (const session of sessions) {
        await storage.saveChatSession(toStorageChatSession(session));
      }
      console.log(`[Persistence] Saved ${sessions.length} chat sessions`);
    } catch (error) {
      console.error('[Persistence] Failed to save chat sessions:', error);
    }
  }, [storage, storageManager]);
  
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveChatSessions();
    }, 2000); // 2秒防抖
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [chatSessions, saveChatSessions]);
  
  // ============================================================
  // 自动保存 Notebooks (防抖)
  // ============================================================
  
  const saveNotebooks = useCallback(async () => {
    // 未登录用户不保存
    if (!storageManager.isLoggedIn()) {
      console.log('[Persistence] Skip saving notebooks: user not logged in');
      return;
    }
    
    try {
      const nbs = useNotebookStore.getState().notebooks;
      for (const nb of nbs) {
        await storage.saveNotebook(toStorageNotebook(nb));
      }
      console.log(`[Persistence] Saved ${nbs.length} notebooks`);
    } catch (error) {
      console.error('[Persistence] Failed to save notebooks:', error);
    }
  }, [storage, storageManager]);
  
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveNotebooks();
    }, 2000);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [notebooks, saveNotebooks]);
  
  // ============================================================
  // 自动保存 Insights (按论文)
  // ============================================================
  
  const saveInsights = useCallback(async () => {
    try {
      const cache = useInsightStore.getState().paperInsightsCache;
      for (const [paperId, data] of Object.entries(cache)) {
        await storage.savePaperInsights(paperId, data.insights);
      }
      console.log(`[Persistence] Saved insights for ${Object.keys(cache).length} papers`);
    } catch (error) {
      console.error('[Persistence] Failed to save insights:', error);
    }
  }, [storage]);
  
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveInsights();
    }, 3000); // Insights 保存频率更低
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [paperInsightsCache, saveInsights]);
  
  // ============================================================
  // 页面卸载时立即保存
  // ============================================================
  
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 同步保存可能不完整，但尽量尝试
      // Zustand persist 中间件会处理大部分情况
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}

// ============================================================
// 单独的 Insight 加载 Hook
// ============================================================

/**
 * 加载指定论文的 Insights
 * 注意：仅对登录用户从持久化存储加载
 */
export function useLoadPaperInsights(paperId: string | null) {
  const storage = useStorage();
  const setInsights = useInsightStore(s => s.setInsights);
  const getCachedInsights = useInsightStore(s => s.getCachedInsights);
  const storageManager = getUserStorageManager();
  
  useEffect(() => {
    if (!paperId) return;
    
    // 未登录用户不从持久化存储加载
    if (!storageManager.isLoggedIn()) return;
    
    // 如果已有缓存，不重新加载
    if (getCachedInsights(paperId)) return;
    
    const currentPaperId = paperId; // Capture for async closure
    
    async function loadInsights() {
      try {
        const insights = await storage.getPaperInsights(currentPaperId);
        if (insights && insights.length > 0) {
          setInsights(currentPaperId, insights);
          console.log(`[Persistence] Loaded ${insights.length} insights for paper: ${currentPaperId}`);
        }
      } catch (error) {
        console.error(`[Persistence] Failed to load insights for paper ${currentPaperId}:`, error);
      }
    }
    
    loadInsights();
  }, [paperId, storage, setInsights, getCachedInsights, storageManager]);
}
