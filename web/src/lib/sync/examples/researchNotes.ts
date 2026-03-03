/**
 * Research Notes - 示例扩展数据类型
 *
 * 这个文件演示如何向同步系统添加新的数据类型。
 * "研究笔记" 是一个简单的卡片数据类型，支持多端同步和持久化。
 *
 * 步骤:
 * 1. 定义数据类型接口
 * 2. 创建同步规则
 * 3. 在 Store 中添加状态和 Actions
 * 4. 注册到同步矩阵
 * 5. 在服务端添加持久化支持
 */

import type { SyncRule, EndpointType } from '../types';
import { SyncRuleBuilder } from '../SyncMatrixEngine';

// ============================================================
// 1. 数据类型定义
// ============================================================

/** 研究笔记 */
export interface ResearchNote {
  /** 唯一 ID */
  id: string;
  /** 创建者 */
  creatorId: string;
  /** 标题 */
  title: string;
  /** 内容 (Markdown) */
  content: string;
  /** 标签 */
  tags: string[];
  /** 关联的消息 ID */
  linkedMessageIds?: string[];
  /** 关联的任务 ID */
  linkedTaskIds?: string[];
  /** 颜色标记 */
  color?: 'default' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';
  /** 是否置顶 */
  pinned?: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/** 研究笔记状态 */
export interface ResearchNotesState {
  /** 笔记列表 */
  notes: ResearchNote[];
  /** 当前选中的笔记 ID */
  activeNoteId: string | null;
  /** 过滤标签 */
  filterTags: string[];
  /** 排序方式 */
  sortBy: 'createdAt' | 'updatedAt' | 'title';
  /** 排序方向 */
  sortOrder: 'asc' | 'desc';
}

/** 研究笔记事件 */
export type ResearchNoteEvent =
  | { type: 'note_created'; note: ResearchNote }
  | { type: 'note_updated'; noteId: string; changes: Partial<ResearchNote> }
  | { type: 'note_deleted'; noteId: string }
  | { type: 'note_linked'; noteId: string; messageId?: string; taskId?: string };

// ============================================================
// 2. 同步规则定义
// ============================================================

/**
 * 研究笔记同步规则
 *
 * 特点:
 * - 服务端是权威源
 * - 桌面端和移动端都可以读写
 * - 持久化到数据库
 * - 双向同步
 * - 支持合并冲突
 */
export const researchNotesSyncRule: SyncRule = {
  dataType: 'researchNotes',
  description: '研究笔记卡片',
  endpoints: {
    server: { access: 'owner' },
    desktop: { access: 'readwrite' },
    mobile: { access: 'readwrite' },
    web: { access: 'readwrite' },
    agent: { access: 'read' },  // Agent 可以读取笔记但不能修改
  },
  persistence: {
    strategy: 'database',
    table: 'research_notes',
  },
  sync: {
    direction: 'bidirectional',
    conflictStrategy: 'merge',
    throttleMs: 1000,  // 笔记不需要实时同步，1秒节流
  },
  interactionSignals: {
    canTrigger: ['desktop', 'mobile', 'web'],
    targetEndpoints: ['server', 'agent'],
    signalTypes: ['note_created', 'note_updated', 'note_deleted', 'note_linked'],
  },
};

/**
 * 使用 SyncRuleBuilder 创建规则（另一种方式）
 */
export function createResearchNotesRule(): SyncRule {
  return new SyncRuleBuilder('researchNotes', '研究笔记卡片')
    .serverOwned()
    .endpoint('desktop', 'readwrite')
    .endpoint('mobile', 'readwrite')
    .endpoint('web', 'readwrite')
    .endpoint('agent', 'read')
    .persist('database', { table: 'research_notes' })
    .bidirectional('merge')
    .throttle(1000)
    .interactions({
      canTrigger: ['desktop', 'mobile', 'web'],
      targetEndpoints: ['server', 'agent'],
    })
    .build();
}

// ============================================================
// 3. Store Actions
// ============================================================

/**
 * 研究笔记 Store Actions
 *
 * 这些 actions 应该添加到 WorkspaceStore 中
 */
export interface ResearchNotesActions {
  // 批量设置 (用于 FULL_STATE)
  setResearchNotes: (notes: ResearchNote[]) => void;

  // 增量更新 (用于 STATE_DELTA)
  addResearchNote: (note: ResearchNote) => void;
  updateResearchNote: (id: string, changes: Partial<ResearchNote>) => void;
  deleteResearchNote: (id: string) => void;

  // 本地操作
  setActiveNote: (id: string | null) => void;
  setFilterTags: (tags: string[]) => void;
  setSortBy: (sortBy: ResearchNotesState['sortBy']) => void;
  setSortOrder: (order: ResearchNotesState['sortOrder']) => void;

  // 链接
  linkNoteToMessage: (noteId: string, messageId: string) => void;
  linkNoteToTask: (noteId: string, taskId: string) => void;
}

/**
 * 创建研究笔记的 Store 切片
 *
 * 示例：如何在 Zustand Store 中添加这个数据类型
 *
 * ```typescript
 * // 在 workspaceStore.ts 中:
 * import { createResearchNotesSlice } from '@/lib/sync/examples/researchNotes';
 *
 * export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set, get) => ({
 *   ...initialState,
 *   ...createResearchNotesSlice(set, get),
 *   // ... 其他 actions
 * }));
 * ```
 */
export function createResearchNotesSlice(
  set: (state: any) => void,
  get: () => any
): ResearchNotesState & ResearchNotesActions {
  return {
    // Initial state
    notes: [],
    activeNoteId: null,
    filterTags: [],
    sortBy: 'updatedAt',
    sortOrder: 'desc',

    // Actions
    setResearchNotes: (notes) => {
      set({ notes });
    },

    addResearchNote: (note) => {
      set((state: any) => {
        // ID 去重
        if (state.notes.some((n: ResearchNote) => n.id === note.id)) {
          return state;
        }
        return { notes: [...state.notes, note] };
      });
    },

    updateResearchNote: (id, changes) => {
      set((state: any) => ({
        notes: state.notes.map((n: ResearchNote) =>
          n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n
        ),
      }));
    },

    deleteResearchNote: (id) => {
      set((state: any) => ({
        notes: state.notes.filter((n: ResearchNote) => n.id !== id),
        activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
      }));
    },

    setActiveNote: (id) => {
      set({ activeNoteId: id });
    },

    setFilterTags: (tags) => {
      set({ filterTags: tags });
    },

    setSortBy: (sortBy) => {
      set({ sortBy });
    },

    setSortOrder: (order) => {
      set({ sortOrder: order });
    },

    linkNoteToMessage: (noteId, messageId) => {
      set((state: any) => ({
        notes: state.notes.map((n: ResearchNote) =>
          n.id === noteId
            ? {
                ...n,
                linkedMessageIds: [...(n.linkedMessageIds || []), messageId],
                updatedAt: Date.now(),
              }
            : n
        ),
      }));
    },

    linkNoteToTask: (noteId, taskId) => {
      set((state: any) => ({
        notes: state.notes.map((n: ResearchNote) =>
          n.id === noteId
            ? {
                ...n,
                linkedTaskIds: [...(n.linkedTaskIds || []), taskId],
                updatedAt: Date.now(),
              }
            : n
        ),
      }));
    },
  };
}

// ============================================================
// 4. 辅助函数
// ============================================================

/**
 * 创建新笔记
 */
export function createResearchNote(
  title: string,
  content: string = '',
  options: Partial<Omit<ResearchNote, 'id' | 'createdAt' | 'updatedAt'>> = {}
): ResearchNote {
  const now = Date.now();
  return {
    id: `note-${now}-${Math.random().toString(36).slice(2, 9)}`,
    creatorId: 'user',
    title,
    content,
    tags: [],
    color: 'default',
    pinned: false,
    ...options,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 获取笔记的所有标签
 */
export function getAllTags(notes: ResearchNote[]): string[] {
  const tagSet = new Set<string>();
  notes.forEach(note => {
    note.tags.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}

/**
 * 过滤和排序笔记
 */
export function filterAndSortNotes(
  notes: ResearchNote[],
  state: Pick<ResearchNotesState, 'filterTags' | 'sortBy' | 'sortOrder'>
): ResearchNote[] {
  let result = [...notes];

  // 过滤
  if (state.filterTags.length > 0) {
    result = result.filter(note =>
      state.filterTags.some(tag => note.tags.includes(tag))
    );
  }

  // 置顶优先
  result.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  // 排序
  result.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    let comparison = 0;
    switch (state.sortBy) {
      case 'createdAt':
        comparison = a.createdAt - b.createdAt;
        break;
      case 'updatedAt':
        comparison = a.updatedAt - b.updatedAt;
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
    }

    return state.sortOrder === 'asc' ? comparison : -comparison;
  });

  return result;
}

// ============================================================
// 5. 导出
// ============================================================

export default {
  // Types
  // (exported at top level)

  // Sync Rule
  researchNotesSyncRule,
  createResearchNotesRule,

  // Store
  createResearchNotesSlice,

  // Helpers
  createResearchNote,
  getAllTags,
  filterAndSortNotes,
};
