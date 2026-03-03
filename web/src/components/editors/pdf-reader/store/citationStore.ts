/**
 * Citation Store
 * 
 * 管理双向索引相关的状态：检测数据、引用高亮、导航等
 * 支持多文档：每个文档有独立的检测数据索引
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  Detection,
  BoundingBox,
  PageDetection,
  PaperMetadata,
} from '@/types/paperContext';

// ============================================================
// Types
// ============================================================

/**
 * 扁平化的检测数据 (添加 pageNumber 和 paperId)
 */
export interface FlatDetection extends Detection {
  pageNumber: number;
  paperId?: string;
}

/**
 * 单个文档的检测数据
 */
interface DocumentDetectionData {
  detectionIndex: Map<string, FlatDetection>;
  pageDetections: Map<number, FlatDetection[]>;
  metadata: PaperMetadata | null;
}

/**
 * Citation Store 状态
 */
interface CitationState {
  // 当前活动的论文 ID
  activePaperId: string | null;
  
  // 多文档检测数据缓存: paperId -> DocumentDetectionData
  documentCache: Map<string, DocumentDetectionData>;
  
  // 当前文档的 Detection 索引 (快速访问)
  detectionIndex: Map<string, FlatDetection>;
  
  // 当前文档按页分组的检测数据
  pageDetections: Map<number, FlatDetection[]>;
  
  // 当前文档元数据
  metadata: PaperMetadata | null;
  
  // 当前激活的引用 (高亮显示)
  activeCitations: string[];
  
  // 悬停的引用 (预览)
  hoveredCitation: string | null;
  
  // 数据加载状态
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  
  // 页面尺寸缓存 (用于坐标转换)
  pageDimensions: Map<number, { width: number; height: number }>;
}

/**
 * Citation Store 操作
 */
interface CitationActions {
  // 多文档管理
  setActivePaper: (paperId: string) => void;
  loadDetectionsForPaper: (paperId: string, pages: PageDetection[]) => void;
  
  // 数据加载 (向后兼容)
  loadDetections: (pages: PageDetection[], paperId?: string) => void;
  setMetadata: (metadata: PaperMetadata) => void;
  setPageDimensions: (pageNumber: number, dimensions: { width: number; height: number }) => void;
  
  // 检测数据查询
  getDetection: (id: string) => FlatDetection | undefined;
  getPageDetections: (pageNumber: number) => FlatDetection[];
  getDetectionsByLabel: (label: string) => FlatDetection[];
  searchDetections: (query: string) => FlatDetection[];
  
  // 跨文档检测查询
  getDetectionFromAnyPaper: (detectionId: string) => { detection: FlatDetection; paperId: string } | null;
  
  // 引用高亮管理
  setActiveCitations: (ids: string[]) => void;
  addActiveCitation: (id: string) => void;
  removeActiveCitation: (id: string) => void;
  clearActiveCitations: () => void;
  
  // 悬停管理
  setHoveredCitation: (id: string | null) => void;
  
  // 导航
  scrollToDetection: (id: string) => void;
  
  // 临时高亮 (自动清除)
  flashCitation: (id: string, duration?: number) => void;
  
  // 重置
  reset: () => void;
  resetCurrentPaper: () => void;
}

// ============================================================
// Initial State
// ============================================================

const initialState: CitationState = {
  activePaperId: null,
  documentCache: new Map(),
  detectionIndex: new Map(),
  pageDetections: new Map(),
  metadata: null,
  activeCitations: [],
  hoveredCitation: null,
  isLoaded: false,
  isLoading: false,
  error: null,
  pageDimensions: new Map(),
};

// ============================================================
// Store
// ============================================================

export const useCitationStore = create<CitationState & CitationActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // 设置活动论文
      setActivePaper: (paperId: string) => {
        const state = get();
        
        // 如果已经是活动论文，不做任何事
        if (state.activePaperId === paperId) return;
        
        // 检查缓存中是否有该论文的数据
        const cached = state.documentCache.get(paperId);
        
        if (cached) {
          // 从缓存恢复数据
          set({
            activePaperId: paperId,
            detectionIndex: cached.detectionIndex,
            pageDetections: cached.pageDetections,
            metadata: cached.metadata,
            isLoaded: true,
          });
          console.log(`[CitationStore] Switched to cached paper: ${paperId}`);
        } else {
          // 标记为需要加载
          set({
            activePaperId: paperId,
            detectionIndex: new Map(),
            pageDetections: new Map(),
            metadata: null,
            isLoaded: false,
          });
        }
      },

      // 为特定论文加载检测数据
      loadDetectionsForPaper: (paperId: string, pages: PageDetection[]) => {
        get().loadDetections(pages, paperId);
      },

      // 加载检测数据 (支持多文档)
      loadDetections: (pages: PageDetection[], paperId?: string) => {
        set({ isLoading: true, error: null });
        
        const effectivePaperId = paperId || get().activePaperId || 'default';
        
        try {
          const detectionIndex = new Map<string, FlatDetection>();
          const pageDetections = new Map<number, FlatDetection[]>();
          
          for (const page of pages) {
            const pageNumber = page.page_number;
            const flatDetections: FlatDetection[] = [];
            
            for (const detection of page.detections) {
              const flatDetection: FlatDetection = {
                ...detection,
                pageNumber,
                paperId: effectivePaperId,
              };
              
              // 添加到索引
              detectionIndex.set(detection.id, flatDetection);
              flatDetections.push(flatDetection);
            }
            
            // 按页分组
            pageDetections.set(pageNumber, flatDetections);
          }
          
          // 保存到缓存
          const documentCache = new Map(get().documentCache);
          documentCache.set(effectivePaperId, {
            detectionIndex,
            pageDetections,
            metadata: get().metadata,
          });
          
          set({
            activePaperId: effectivePaperId,
            documentCache,
            detectionIndex,
            pageDetections,
            isLoaded: true,
            isLoading: false,
          });
          
          console.log(`[CitationStore] Loaded ${detectionIndex.size} detections for paper: ${effectivePaperId}`);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load detections',
            isLoading: false,
          });
        }
      },

      // 设置元数据
      setMetadata: (metadata: PaperMetadata) => {
        set({ metadata });
      },

      // 设置页面尺寸
      setPageDimensions: (pageNumber: number, dimensions: { width: number; height: number }) => {
        set((state) => {
          const newDimensions = new Map(state.pageDimensions);
          newDimensions.set(pageNumber, dimensions);
          return { pageDimensions: newDimensions };
        });
      },

      // 获取单个检测
      getDetection: (id: string) => {
        return get().detectionIndex.get(id);
      },

      // 获取页面检测数据
      getPageDetections: (pageNumber: number) => {
        return get().pageDetections.get(pageNumber) || [];
      },

      // 按标签获取检测
      getDetectionsByLabel: (label: string) => {
        const results: FlatDetection[] = [];
        get().detectionIndex.forEach((detection) => {
          if (detection.label === label) {
            results.push(detection);
          }
        });
        return results;
      },

      // 搜索检测内容
      searchDetections: (query: string) => {
        const lowerQuery = query.toLowerCase();
        const results: FlatDetection[] = [];
        get().detectionIndex.forEach((detection) => {
          if (detection.text.toLowerCase().includes(lowerQuery)) {
            results.push(detection);
          }
        });
        return results;
      },

      // 从任意论文中获取检测数据 (用于跨文档引用)
      getDetectionFromAnyPaper: (detectionId: string) => {
        const state = get();
        
        // 先检查当前活动文档
        const current = state.detectionIndex.get(detectionId);
        if (current) {
          return { detection: current, paperId: state.activePaperId || 'default' };
        }
        
        // 遍历所有缓存的文档
        for (const [paperId, data] of state.documentCache.entries()) {
          const detection = data.detectionIndex.get(detectionId);
          if (detection) {
            return { detection, paperId };
          }
        }
        
        return null;
      },

      // 设置激活引用
      setActiveCitations: (ids: string[]) => {
        set({ activeCitations: ids });
      },

      // 添加激活引用
      addActiveCitation: (id: string) => {
        set((state) => {
          if (state.activeCitations.includes(id)) {
            return state;
          }
          return { activeCitations: [...state.activeCitations, id] };
        });
      },

      // 移除激活引用
      removeActiveCitation: (id: string) => {
        set((state) => ({
          activeCitations: state.activeCitations.filter((c) => c !== id),
        }));
      },

      // 清除所有激活引用
      clearActiveCitations: () => {
        set({ activeCitations: [] });
      },

      // 设置悬停引用
      setHoveredCitation: (id: string | null) => {
        set({ hoveredCitation: id });
      },

      // 滚动到检测位置
      scrollToDetection: (id: string) => {
        const state = get();
        const detection = state.detectionIndex.get(id);
        
        console.log('[CitationStore] scrollToDetection:', { 
          requestedId: id, 
          found: !!detection,
          pageNumber: detection?.pageNumber,
          text: detection?.text?.slice(0, 50),
        });
        
        if (!detection) {
          console.warn(`[CitationStore] Detection not found: ${id}`);
          return;
        }
        
        // 触发事件让 PDF Viewer 处理滚动
        window.dispatchEvent(
          new CustomEvent('pdf-scroll-to-detection', {
            detail: {
              detectionId: id,
              pageNumber: detection.pageNumber,
              bbox: detection.boxes[0],
            },
          })
        );
        
        // 高亮该检测
        get().flashCitation(id);
      },

      // 临时高亮
      flashCitation: (id: string, duration = 3000) => {
        const { addActiveCitation, removeActiveCitation } = get();
        addActiveCitation(id);
        
        setTimeout(() => {
          removeActiveCitation(id);
        }, duration);
      },

      // 重置当前论文数据 (保留缓存)
      resetCurrentPaper: () => {
        set({
          activePaperId: null,
          detectionIndex: new Map(),
          pageDetections: new Map(),
          metadata: null,
          activeCitations: [],
          hoveredCitation: null,
          isLoaded: false,
          isLoading: false,
          error: null,
        });
      },

      // 完全重置 (清除所有缓存)
      reset: () => {
        set(initialState);
      },
    }),
    { name: 'citation-store' }
  )
);

// ============================================================
// Selectors
// ============================================================

/**
 * 选择器：获取特定页面的激活引用
 */
export const selectActiveCitationsForPage = (pageNumber: number) => (state: CitationState) => {
  const pageDetectionIds = state.pageDetections.get(pageNumber)?.map((d) => d.id) || [];
  return state.activeCitations.filter((id) => pageDetectionIds.includes(id));
};

/**
 * 选择器：检查某个检测是否被激活
 */
export const selectIsDetectionActive = (id: string) => (state: CitationState) => {
  return state.activeCitations.includes(id);
};

/**
 * 选择器：检查某个检测是否被悬停
 */
export const selectIsDetectionHovered = (id: string) => (state: CitationState) => {
  return state.hoveredCitation === id;
};

/**
 * 选择器：获取检测统计信息
 */
export const selectDetectionStats = (state: CitationState) => {
  const stats = {
    total: state.detectionIndex.size,
    byLabel: {} as Record<string, number>,
    byPage: {} as Record<number, number>,
  };
  
  state.detectionIndex.forEach((detection) => {
    // 按标签统计
    stats.byLabel[detection.label] = (stats.byLabel[detection.label] || 0) + 1;
    // 按页统计
    stats.byPage[detection.pageNumber] = (stats.byPage[detection.pageNumber] || 0) + 1;
  });
  
  return stats;
};

// ============================================================
// Utilities
// ============================================================

/**
 * 从 detection ID 解析页码
 * @example "p1_text_0" -> 1
 */
export function parsePageFromDetectionId(id: string): number | null {
  const match = id.match(/^p(\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 从 detection ID 解析类型
 * @example "p1_text_0" -> "text"
 */
export function parseTypeFromDetectionId(id: string): string | null {
  const match = id.match(/^p\d+_(\w+)_\d+$/);
  return match ? match[1] : null;
}

/**
 * 检查是否为有效的 detection ID 格式
 */
export function isValidDetectionId(id: string): boolean {
  return /^p\d+_\w+_\d+$/.test(id);
}

