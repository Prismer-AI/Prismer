/**
 * Multi-Document Store
 * 
 * 管理多个打开的 PDF 文档的状态
 * 支持：文档打开/关闭、标签切换、独立视图状态
 */

import { create } from "zustand";
import { PDFSource, PaperContext } from "@/types/paperContext";
import { ReadingMode } from "../components/PDFToolbar";

// ============================================================================
// Types
// ============================================================================

export interface DocumentViewState {
  pageNumber: number;
  scale: number;
  readingMode: ReadingMode;
  scrollPosition?: { x: number; y: number };
}

export interface DocumentInstance {
  /** 文档唯一 ID */
  id: string;
  /** PDF 源信息 */
  source: PDFSource;
  /** 论文上下文（加载后填充） */
  paperContext: PaperContext | null;
  /** 视图状态 */
  viewState: DocumentViewState;
  /** 总页数 */
  numPages: number;
  /** 加载状态 */
  loadingState: "idle" | "loading" | "loaded" | "error";
  /** 错误信息 */
  error?: string;
  /** 是否有未保存更改（笔记等） */
  isDirty: boolean;
  /** 打开时间戳 */
  openedAt: number;
}

export interface MultiDocumentState {
  /** 已打开的文档 Map */
  documents: Map<string, DocumentInstance>;
  /** 当前活动文档 ID */
  activeDocumentId: string | null;
  /** 文档标签顺序 */
  tabOrder: string[];
}

export interface MultiDocumentActions {
  /** 打开新文档 */
  openDocument: (source: PDFSource) => string;
  /** 关闭文档 */
  closeDocument: (id: string) => void;
  /** 切换活动文档 */
  setActiveDocument: (id: string) => void;
  /** 更新文档视图状态 */
  updateViewState: (id: string, state: Partial<DocumentViewState>) => void;
  /** 设置文档总页数 */
  setDocumentNumPages: (id: string, numPages: number) => void;
  /** 设置文档 Paper Context */
  setDocumentContext: (id: string, context: PaperContext | null) => void;
  /** 设置文档加载状态 */
  setDocumentLoadingState: (id: string, state: DocumentInstance["loadingState"], error?: string) => void;
  /** 设置文档脏标记 */
  setDocumentDirty: (id: string, isDirty: boolean) => void;
  /** 调整标签顺序 */
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  /** 获取当前活动文档 */
  getActiveDocument: () => DocumentInstance | null;
  /** 重置所有状态 */
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialViewState: DocumentViewState = {
  pageNumber: 1,
  scale: 1.0,
  readingMode: "single",
};

const initialState: MultiDocumentState = {
  documents: new Map(),
  activeDocumentId: null,
  tabOrder: [],
};

// ============================================================================
// Store
// ============================================================================

export const useMultiDocumentStore = create<MultiDocumentState & MultiDocumentActions>(
  (set, get) => ({
    ...initialState,

    openDocument: (source: PDFSource) => {
      const id = source.arxivId || `doc-${Date.now()}`;
      
      // 检查是否已打开
      const existingDoc = get().documents.get(id);
      if (existingDoc) {
        // 如果已打开，直接切换到该文档
        set({ activeDocumentId: id });
        return id;
      }

      const newDocument: DocumentInstance = {
        id,
        source,
        paperContext: null,
        viewState: { ...initialViewState },
        numPages: 0,
        loadingState: "idle",
        isDirty: false,
        openedAt: Date.now(),
      };

      set((state) => {
        const newDocuments = new Map(state.documents);
        newDocuments.set(id, newDocument);
        return {
          documents: newDocuments,
          activeDocumentId: id,
          tabOrder: [...state.tabOrder, id],
        };
      });

      return id;
    },

    closeDocument: (id: string) => {
      set((state) => {
        const newDocuments = new Map(state.documents);
        newDocuments.delete(id);
        
        const newTabOrder = state.tabOrder.filter((tabId) => tabId !== id);
        
        // 如果关闭的是活动文档，切换到下一个
        let newActiveId = state.activeDocumentId;
        if (state.activeDocumentId === id) {
          const closedIndex = state.tabOrder.indexOf(id);
          if (newTabOrder.length > 0) {
            // 优先选择右边的，否则选择左边的
            newActiveId = newTabOrder[Math.min(closedIndex, newTabOrder.length - 1)];
          } else {
            newActiveId = null;
          }
        }

        return {
          documents: newDocuments,
          activeDocumentId: newActiveId,
          tabOrder: newTabOrder,
        };
      });
    },

    setActiveDocument: (id: string) => {
      const doc = get().documents.get(id);
      if (doc) {
        set({ activeDocumentId: id });
      }
    },

    updateViewState: (id: string, state: Partial<DocumentViewState>) => {
      set((prevState) => {
        const doc = prevState.documents.get(id);
        if (!doc) return prevState;

        const newDocuments = new Map(prevState.documents);
        newDocuments.set(id, {
          ...doc,
          viewState: { ...doc.viewState, ...state },
        });
        return { documents: newDocuments };
      });
    },

    setDocumentNumPages: (id: string, numPages: number) => {
      set((prevState) => {
        const doc = prevState.documents.get(id);
        if (!doc) return prevState;

        const newDocuments = new Map(prevState.documents);
        newDocuments.set(id, { ...doc, numPages });
        return { documents: newDocuments };
      });
    },

    setDocumentContext: (id: string, context: PaperContext | null) => {
      set((prevState) => {
        const doc = prevState.documents.get(id);
        if (!doc) return prevState;

        const newDocuments = new Map(prevState.documents);
        newDocuments.set(id, { ...doc, paperContext: context });
        return { documents: newDocuments };
      });
    },

    setDocumentLoadingState: (
      id: string,
      loadingState: DocumentInstance["loadingState"],
      error?: string
    ) => {
      set((prevState) => {
        const doc = prevState.documents.get(id);
        if (!doc) return prevState;

        const newDocuments = new Map(prevState.documents);
        newDocuments.set(id, { ...doc, loadingState, error });
        return { documents: newDocuments };
      });
    },

    setDocumentDirty: (id: string, isDirty: boolean) => {
      set((prevState) => {
        const doc = prevState.documents.get(id);
        if (!doc) return prevState;

        const newDocuments = new Map(prevState.documents);
        newDocuments.set(id, { ...doc, isDirty });
        return { documents: newDocuments };
      });
    },

    reorderTabs: (fromIndex: number, toIndex: number) => {
      set((state) => {
        const newTabOrder = [...state.tabOrder];
        const [movedId] = newTabOrder.splice(fromIndex, 1);
        newTabOrder.splice(toIndex, 0, movedId);
        return { tabOrder: newTabOrder };
      });
    },

    getActiveDocument: () => {
      const { documents, activeDocumentId } = get();
      if (!activeDocumentId) return null;
      return documents.get(activeDocumentId) || null;
    },

    reset: () => {
      set(initialState);
    },
  })
);

// ============================================================================
// Selectors
// ============================================================================

export const selectActiveDocument = (state: MultiDocumentState & MultiDocumentActions) =>
  state.activeDocumentId ? state.documents.get(state.activeDocumentId) || null : null;

export const selectDocumentList = (state: MultiDocumentState & MultiDocumentActions) =>
  state.tabOrder.map((id) => state.documents.get(id)).filter(Boolean) as DocumentInstance[];

export const selectDocumentCount = (state: MultiDocumentState & MultiDocumentActions) =>
  state.documents.size;
