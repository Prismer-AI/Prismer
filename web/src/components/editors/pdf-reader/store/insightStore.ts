/**
 * Insight Store
 * 
 * 论文级别的 Quick Insights 管理
 * - 按论文缓存 insights
 * - 支持切换论文时自动切换
 * - 持久化到 IndexedDB
 */

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { PaperContext, PaperInsight } from '@/types/paperContext';
import { Citation } from '../types/citation';
import { createUserIsolatedStorage } from '@/lib/storage/userStorageManager';

// Stable empty array to avoid infinite loop
const EMPTY_INSIGHTS: PaperInsight[] = [];

// ============================================================
// 类型定义
// ============================================================

/**
 * 论文 Insights 缓存
 */
export interface PaperInsightsCache {
  paperId: string;
  paperTitle?: string;
  insights: PaperInsight[];
  generatedAt: number;
  version: string;
}

// ============================================================
// Store 状态
// ============================================================

interface InsightState {
  /** 按论文缓存的 Insights */
  paperInsightsCache: Record<string, PaperInsightsCache>;
  
  /** 当前活动论文 ID */
  currentPaperId: string | null;
  
  /** 加载状态 */
  isLoading: boolean;
  
  /** 错误信息 */
  error: string | null;
}

interface InsightActions {
  // 论文切换
  setCurrentPaper: (paperId: string) => void;
  
  // Insights 管理
  setInsights: (paperId: string, insights: PaperInsight[], paperTitle?: string) => void;
  addInsight: (paperId: string, insight: PaperInsight) => void;
  clearInsights: (paperId: string) => void;
  
  // 缓存管理
  getCachedInsights: (paperId: string) => PaperInsightsCache | null;
  hasValidCache: (paperId: string, maxAge?: number) => boolean;
  clearCache: (paperId?: string) => void;
  
  // 当前论文的快捷访问
  getCurrentInsights: () => PaperInsight[];
  
  // 状态管理
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// ============================================================
// 常量
// ============================================================

/** 缓存版本号，用于失效旧缓存 */
const CACHE_VERSION = '1.0';

/** 默认缓存有效期 (24小时) */
const DEFAULT_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// ============================================================
// Store 实现
// ============================================================

export const useInsightStore = create<InsightState & InsightActions>()(
  devtools(
    persist(
      (set, get) => ({
        // 初始状态
        paperInsightsCache: {},
        currentPaperId: null,
        isLoading: false,
        error: null,
        
        // ============================================================
        // 论文切换
        // ============================================================
        
        setCurrentPaper: (paperId) => {
          const { currentPaperId } = get();
          
          // 如果是同一篇论文，不做任何操作
          if (currentPaperId === paperId) return;
          
          set({ currentPaperId: paperId, error: null });
          
          console.log(`[InsightStore] Switched to paper: ${paperId}`);
        },
        
        // ============================================================
        // Insights 管理
        // ============================================================
        
        setInsights: (paperId, insights, paperTitle) => {
          const cache: PaperInsightsCache = {
            paperId,
            paperTitle,
            insights,
            generatedAt: Date.now(),
            version: CACHE_VERSION,
          };
          
          set(state => ({
            paperInsightsCache: {
              ...state.paperInsightsCache,
              [paperId]: cache,
            },
            error: null,
          }));
          
          console.log(`[InsightStore] Cached ${insights.length} insights for paper: ${paperId}`);
        },
        
        addInsight: (paperId, insight) => {
          set(state => {
            const existing = state.paperInsightsCache[paperId];
            if (!existing) {
              return {
                paperInsightsCache: {
                  ...state.paperInsightsCache,
                  [paperId]: {
                    paperId,
                    insights: [insight],
                    generatedAt: Date.now(),
                    version: CACHE_VERSION,
                  },
                },
              };
            }
            
            return {
              paperInsightsCache: {
                ...state.paperInsightsCache,
                [paperId]: {
                  ...existing,
                  insights: [...existing.insights, insight],
                },
              },
            };
          });
        },
        
        clearInsights: (paperId) => {
          set(state => {
            const newCache = { ...state.paperInsightsCache };
            delete newCache[paperId];
            return { paperInsightsCache: newCache };
          });
        },
        
        // ============================================================
        // 缓存管理
        // ============================================================
        
        getCachedInsights: (paperId) => {
          return get().paperInsightsCache[paperId] || null;
        },
        
        hasValidCache: (paperId, maxAge = DEFAULT_CACHE_MAX_AGE) => {
          const cache = get().paperInsightsCache[paperId];
          if (!cache) return false;
          
          // 版本检查
          if (cache.version !== CACHE_VERSION) return false;
          
          // 时间检查
          const age = Date.now() - cache.generatedAt;
          if (age > maxAge) return false;
          
          // 内容检查
          if (!cache.insights || cache.insights.length === 0) return false;
          
          return true;
        },
        
        clearCache: (paperId) => {
          if (paperId) {
            get().clearInsights(paperId);
          } else {
            set({ paperInsightsCache: {} });
          }
        },
        
        // ============================================================
        // 当前论文快捷访问
        // ============================================================
        
        getCurrentInsights: () => {
          const { currentPaperId, paperInsightsCache } = get();
          if (!currentPaperId) return [];
          return paperInsightsCache[currentPaperId]?.insights || [];
        },
        
        // ============================================================
        // 状态管理
        // ============================================================
        
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
      }),
      {
        name: 'insight-storage',
        version: 1,
        // 使用用户隔离存储，未登录用户不保存 insights 缓存
        storage: createUserIsolatedStorage('insight-storage', true),
        partialize: (state) => ({
          paperInsightsCache: state.paperInsightsCache,
          currentPaperId: state.currentPaperId,
        }),
        migrate: (persistedState: any, version: number) => {
          // Handle migration from older versions
          if (version === 0) {
            // Clear old data if structure is incompatible
            return { paperInsightsCache: {}, currentPaperId: null };
          }
          return persistedState as InsightState;
        },
      }
    ),
    { name: 'InsightStore' }
  )
);

// ============================================================
// Hooks
// ============================================================

/**
 * 获取当前论文的 Insights
 */
export function useCurrentInsights(): PaperInsight[] {
  return useInsightStore(
    useShallow(state => {
      if (!state.currentPaperId) return EMPTY_INSIGHTS;
      return state.paperInsightsCache[state.currentPaperId]?.insights ?? EMPTY_INSIGHTS;
    })
  );
}

/**
 * 获取 Insight 加载状态
 */
export function useInsightLoading(): boolean {
  return useInsightStore(state => state.isLoading);
}

/**
 * 获取 Insight 错误信息
 */
export function useInsightError(): string | null {
  return useInsightStore(state => state.error);
}

/**
 * 获取指定论文的 Insights
 */
export function usePaperInsights(paperId: string): PaperInsight[] {
  return useInsightStore(
    useShallow(state =>
      state.paperInsightsCache[paperId]?.insights ?? EMPTY_INSIGHTS
    )
  );
}

/**
 * 检查指定论文是否有有效缓存
 */
export function useHasInsightCache(paperId: string): boolean {
  return useInsightStore(state => {
    const cache = state.paperInsightsCache[paperId];
    if (!cache) return false;
    if (cache.version !== CACHE_VERSION) return false;
    return cache.insights && cache.insights.length > 0;
  });
}

/**
 * 清除所有 Insights 缓存（用于登出时）
 */
export function clearAllInsights(): void {
  useInsightStore.setState({
    paperInsightsCache: {},
    currentPaperId: null,
    isLoading: false,
    error: null,
  });
}
