/**
 * NotebookStore - 统一状态管理
 * 使用 Zustand + Slice Pattern
 * 
 * Phase 5 增强：
 * - Cell 位置管理（move/swap）
 * - 复制/粘贴/剪切
 * - 撤销/重做
 * - Cell 类型切换
 * - Agent 编辑状态
 */

import { create } from 'zustand';
import { immer } from '@/lib/zustand-immer-lite';
import type {
  Cell,
  CellType,
  CodeCell,
  MarkdownCell,
  Output,
  KernelStatus,
  AgentStatus,
  AgentMode,
  NotebookMetadata,
} from '../types';
import { emit } from './eventBus';

// ============================================================
// 工具函数
// ============================================================

function generateId(): string {
  return crypto.randomUUID();
}

function createCodeCell(source = '', createdBy: 'user' | 'agent' = 'user'): CodeCell {
  return {
    id: generateId(),
    type: 'code',
    source,
    language: 'python',
    executionCount: null,
    executionState: 'idle',
    outputs: [],
    createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {},
  };
}

function createMarkdownCell(source = ''): MarkdownCell {
  return {
    id: generateId(),
    type: 'markdown',
    source,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {},
  };
}

function cloneCell(cell: Cell): Cell {
  return JSON.parse(JSON.stringify({
    ...cell,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

// ============================================================
// History 类型（撤销/重做）
// ============================================================

interface HistoryState {
  cells: Cell[];
  activeCellId: string | null;
}

interface PendingEdit {
  source: string;
  from: 'agent';
  status: 'pending' | 'confirmed' | 'rejected';
  timestamp: string;
}

// ============================================================
// Store 类型定义
// ============================================================

interface CellsSlice {
  // 状态
  cells: Cell[];
  activeCellId: string | null;
  selectedCellIds: string[];
  metadata: NotebookMetadata;
  
  // 基础操作
  addCell: (cell: Partial<Cell> & { type: Cell['type'] }, afterId?: string) => string;
  addCodeCell: (source?: string, afterId?: string, createdBy?: 'user' | 'agent') => string;
  addMarkdownCell: (source?: string, afterId?: string) => string;
  updateCell: (id: string, updates: Partial<Cell>) => void;
  deleteCell: (id: string) => void;
  deleteCells: (ids: string[]) => void;
  setActiveCell: (id: string | null) => void;
  setCellSource: (id: string, source: string) => void;
  setCellOutputs: (id: string, outputs: Output[]) => void;
  appendCellOutput: (id: string, output: Output) => void;
  clearCellOutputs: (id: string) => void;
  clearAllOutputs: () => void;
  
  // 位置操作
  moveCell: (cellId: string, targetIndex: number) => void;
  moveCellUp: (cellId: string) => void;
  moveCellDown: (cellId: string) => void;
  swapCells: (cellId1: string, cellId2: string) => void;
  reorderCells: (startIndex: number, endIndex: number) => void;
  
  // 类型切换
  changeCellType: (cellId: string, newType: 'code' | 'markdown') => void;
  
  // 选择
  selectCell: (cellId: string, multi?: boolean) => void;
  selectRange: (startId: string, endId: string) => void;
  clearSelection: () => void;
  
  // 复制/粘贴
  clipboard: Cell | null;
  cutCell: (cellId: string) => void;
  copyCell: (cellId: string) => void;
  pasteCell: (afterId?: string) => string | null;
  duplicateCell: (cellId: string) => string;
}

interface HistorySlice {
  // 撤销/重做
  history: HistoryState[];
  historyIndex: number;
  maxHistorySize: number;
  
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

interface ExecutionSlice {
  kernelId: string | null;
  kernelStatus: KernelStatus;
  executionQueue: string[];
  currentExecutingCellId: string | null;
  
  setKernelId: (id: string | null) => void;
  setKernelStatus: (status: KernelStatus) => void;
  queueExecution: (cellId: string) => void;
  startExecution: (cellId: string) => void;
  completeExecution: (cellId: string, success: boolean, executionCount: number) => void;
  clearQueue: () => void;
}

interface AgentSlice {
  agentStatus: AgentStatus;
  agentMode: AgentMode;
  contextCellId: string | null;
  conversationHistory: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    contextCellId?: string;
  }>;
  pendingEdits: Map<string, PendingEdit>;
  
  setAgentStatus: (status: AgentStatus) => void;
  setAgentMode: (mode: AgentMode) => void;
  setContextCellId: (cellId: string | null) => void;
  addConversation: (role: 'user' | 'assistant', content: string, contextCellId?: string) => void;
  clearConversation: () => void;
  
  // Agent 编辑状态
  proposeEdit: (cellId: string, newSource: string) => void;
  confirmEdit: (cellId: string) => void;
  rejectEdit: (cellId: string) => void;
  getPendingEdit: (cellId: string) => PendingEdit | undefined;
}

// 合并的 Store 类型
export type NotebookStore = CellsSlice & HistorySlice & ExecutionSlice & AgentSlice;

// ============================================================
// Store 实现
// ============================================================

export const useNotebookStore = create<NotebookStore>()(
  immer((set, get) => ({
    // ============ Cells Slice ============
    cells: [],
    activeCellId: null,
    selectedCellIds: [],
    metadata: {
      kernelspec: {
        name: 'python3',
        display_name: 'Python 3',
        language: 'python',
      },
    },
    clipboard: null,
    
    addCell: (cellData, afterId) => {
      get().pushHistory();
      const id = cellData.id || generateId();
      const now = new Date().toISOString();
      
      const cell: Cell = {
        ...cellData,
        id,
        createdAt: now,
        updatedAt: now,
        metadata: cellData.metadata || {},
      } as Cell;
      
      set((state) => {
        if (afterId) {
          const index = state.cells.findIndex((c) => c.id === afterId);
          if (index !== -1) {
            state.cells.splice(index + 1, 0, cell);
          } else {
            state.cells.push(cell);
          }
        } else {
          state.cells.push(cell);
        }
        state.activeCellId = id;
      });
      
      emit('cell:added', { cellId: id });
      return id;
    },
    
    addCodeCell: (source = '', afterId, createdBy = 'user') => {
      const cell = createCodeCell(source, createdBy);
      return get().addCell(cell, afterId);
    },
    
    addMarkdownCell: (source = '', afterId) => {
      const cell = createMarkdownCell(source);
      return get().addCell(cell, afterId);
    },
    
    updateCell: (id, updates) => {
      set((state) => {
        const cell = state.cells.find((c) => c.id === id);
        if (cell) {
          Object.assign(cell, updates, { updatedAt: new Date().toISOString() });
        }
      });
    },
    
    deleteCell: (id) => {
      get().pushHistory();
      set((state) => {
        const index = state.cells.findIndex((c) => c.id === id);
        if (index !== -1) {
          state.cells.splice(index, 1);
          if (state.activeCellId === id) {
            state.activeCellId = state.cells[index]?.id || state.cells[index - 1]?.id || null;
          }
          state.selectedCellIds = state.selectedCellIds.filter(cid => cid !== id);
        }
      });
      emit('cell:deleted', { cellId: id });
    },
    
    deleteCells: (ids) => {
      get().pushHistory();
      set((state) => {
        state.cells = state.cells.filter(c => !ids.includes(c.id));
        if (ids.includes(state.activeCellId || '')) {
          state.activeCellId = state.cells[0]?.id || null;
        }
        state.selectedCellIds = [];
      });
    },
    
    setActiveCell: (id) => {
      set({ activeCellId: id });
    },
    
    setCellSource: (id, source) => {
      set((state) => {
        const cell = state.cells.find((c) => c.id === id);
        if (cell && (cell.type === 'code' || cell.type === 'markdown')) {
          (cell as CodeCell | MarkdownCell).source = source;
          cell.updatedAt = new Date().toISOString();
        }
      });
    },
    
    setCellOutputs: (id, outputs) => {
      set((state) => {
        const cell = state.cells.find((c) => c.id === id);
        if (cell && cell.type === 'code') {
          (cell as CodeCell).outputs = outputs;
        }
      });
    },
    
    appendCellOutput: (id, output) => {
      set((state) => {
        const cell = state.cells.find((c) => c.id === id);
        if (cell && cell.type === 'code') {
          (cell as CodeCell).outputs.push(output);
        }
      });
      emit('cell:output', { cellId: id, output });
    },
    
    clearCellOutputs: (id) => {
      set((state) => {
        const cell = state.cells.find((c) => c.id === id);
        if (cell && cell.type === 'code') {
          (cell as CodeCell).outputs = [];
          (cell as CodeCell).executionCount = null;
          (cell as CodeCell).executionState = 'idle';
        }
      });
    },
    
    clearAllOutputs: () => {
      set((state) => {
        state.cells.forEach((cell) => {
          if (cell.type === 'code') {
            (cell as CodeCell).outputs = [];
            (cell as CodeCell).executionCount = null;
            (cell as CodeCell).executionState = 'idle';
          }
        });
      });
    },
    
    // 位置操作
    moveCell: (cellId, targetIndex) => {
      get().pushHistory();
      set((state) => {
        const currentIndex = state.cells.findIndex(c => c.id === cellId);
        if (currentIndex === -1 || currentIndex === targetIndex) return;
        
        const [cell] = state.cells.splice(currentIndex, 1);
        state.cells.splice(targetIndex, 0, cell);
      });
      emit('cell:moved', { cellId, targetIndex });
    },
    
    moveCellUp: (cellId) => {
      const cells = get().cells;
      const index = cells.findIndex(c => c.id === cellId);
      if (index > 0) {
        get().moveCell(cellId, index - 1);
      }
    },
    
    moveCellDown: (cellId) => {
      const cells = get().cells;
      const index = cells.findIndex(c => c.id === cellId);
      if (index < cells.length - 1) {
        get().moveCell(cellId, index + 1);
      }
    },
    
    swapCells: (cellId1, cellId2) => {
      get().pushHistory();
      set((state) => {
        const index1 = state.cells.findIndex(c => c.id === cellId1);
        const index2 = state.cells.findIndex(c => c.id === cellId2);
        if (index1 !== -1 && index2 !== -1) {
          [state.cells[index1], state.cells[index2]] = [state.cells[index2], state.cells[index1]];
        }
      });
    },
    
    reorderCells: (startIndex, endIndex) => {
      if (startIndex === endIndex) return;
      get().pushHistory();
      set((state) => {
        const [removed] = state.cells.splice(startIndex, 1);
        state.cells.splice(endIndex, 0, removed);
      });
    },
    
    // 类型切换
    changeCellType: (cellId, newType) => {
      get().pushHistory();
      set((state) => {
        const index = state.cells.findIndex(c => c.id === cellId);
        if (index === -1) return;
        
        const cell = state.cells[index];
        const source = (cell as CodeCell | MarkdownCell).source || '';
        const now = new Date().toISOString();
        
        if (newType === 'markdown' && cell.type === 'code') {
          state.cells[index] = {
            id: cell.id,
            type: 'markdown',
            source,
            createdAt: cell.createdAt,
            updatedAt: now,
            metadata: cell.metadata,
          } as MarkdownCell;
        } else if (newType === 'code' && cell.type === 'markdown') {
          state.cells[index] = {
            id: cell.id,
            type: 'code',
            source,
            language: 'python',
            executionCount: null,
            executionState: 'idle',
            outputs: [],
            createdBy: 'user',
            createdAt: cell.createdAt,
            updatedAt: now,
            metadata: cell.metadata,
          } as CodeCell;
        }
      });
      emit('cell:typeChanged', { cellId, newType });
    },
    
    // 选择
    selectCell: (cellId, multi = false) => {
      set((state) => {
        if (multi) {
          if (state.selectedCellIds.includes(cellId)) {
            state.selectedCellIds = state.selectedCellIds.filter(id => id !== cellId);
          } else {
            state.selectedCellIds.push(cellId);
          }
        } else {
          state.selectedCellIds = [cellId];
        }
        state.activeCellId = cellId;
      });
    },
    
    selectRange: (startId, endId) => {
      set((state) => {
        const startIndex = state.cells.findIndex(c => c.id === startId);
        const endIndex = state.cells.findIndex(c => c.id === endId);
        if (startIndex === -1 || endIndex === -1) return;
        
        const [from, to] = startIndex < endIndex 
          ? [startIndex, endIndex] 
          : [endIndex, startIndex];
        
        state.selectedCellIds = state.cells
          .slice(from, to + 1)
          .map(c => c.id);
      });
    },
    
    clearSelection: () => {
      set({ selectedCellIds: [] });
    },
    
    // 复制/粘贴
    cutCell: (cellId) => {
      const cell = get().cells.find(c => c.id === cellId);
      if (cell) {
        set({ clipboard: cloneCell(cell) });
        get().deleteCell(cellId);
      }
    },
    
    copyCell: (cellId) => {
      const cell = get().cells.find(c => c.id === cellId);
      if (cell) {
        set({ clipboard: cloneCell(cell) });
      }
    },
    
    pasteCell: (afterId) => {
      const clipboard = get().clipboard;
      if (!clipboard) return null;
      
      const newCell = cloneCell(clipboard);
      return get().addCell(newCell, afterId || get().activeCellId || undefined);
    },
    
    duplicateCell: (cellId) => {
      const cell = get().cells.find(c => c.id === cellId);
      if (!cell) return '';
      
      const newCell = cloneCell(cell);
      return get().addCell(newCell, cellId);
    },
    
    // ============ History Slice ============
    history: [],
    historyIndex: -1,
    maxHistorySize: 50,
    
    pushHistory: () => {
      set((state) => {
        const currentState: HistoryState = {
          cells: JSON.parse(JSON.stringify(state.cells)),
          activeCellId: state.activeCellId,
        };
        
        // 删除当前位置之后的历史
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push(currentState);
        
        // 限制历史大小
        if (state.history.length > state.maxHistorySize) {
          state.history = state.history.slice(-state.maxHistorySize);
        }
        
        state.historyIndex = state.history.length - 1;
      });
    },
    
    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex <= 0) return;
      
      set((state) => {
        const prevState = state.history[state.historyIndex - 1];
        if (prevState) {
          state.cells = JSON.parse(JSON.stringify(prevState.cells));
          state.activeCellId = prevState.activeCellId;
          state.historyIndex--;
        }
      });
      emit('history:undo', {});
    },
    
    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) return;
      
      set((state) => {
        const nextState = state.history[state.historyIndex + 1];
        if (nextState) {
          state.cells = JSON.parse(JSON.stringify(nextState.cells));
          state.activeCellId = nextState.activeCellId;
          state.historyIndex++;
        }
      });
      emit('history:redo', {});
    },
    
    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,
    
    clearHistory: () => {
      set({ history: [], historyIndex: -1 });
    },
    
    // ============ Execution Slice ============
    kernelId: null,
    kernelStatus: 'disconnected',
    executionQueue: [],
    currentExecutingCellId: null,
    
    setKernelId: (id) => {
      set({ kernelId: id });
      if (id) {
        emit('kernel:connected', { kernelId: id });
      } else {
        emit('kernel:disconnected', {});
      }
    },
    
    setKernelStatus: (status) => {
      set({ kernelStatus: status });
      emit('kernel:status', { status });
    },
    
    queueExecution: (cellId) => {
      set((state) => {
        if (!state.executionQueue.includes(cellId)) {
          state.executionQueue.push(cellId);
        }
      });
    },
    
    startExecution: (cellId) => {
      set((state) => {
        state.currentExecutingCellId = cellId;
        const cell = state.cells.find((c) => c.id === cellId);
        if (cell && cell.type === 'code') {
          (cell as CodeCell).executionState = 'running';
          (cell as CodeCell).outputs = [];
        }
      });
      emit('cell:executing', { cellId });
    },
    
    completeExecution: (cellId, success, executionCount) => {
      set((state) => {
        state.currentExecutingCellId = null;
        state.executionQueue = state.executionQueue.filter((id) => id !== cellId);
        const cell = state.cells.find((c) => c.id === cellId);
        if (cell && cell.type === 'code') {
          (cell as CodeCell).executionState = success ? 'success' : 'error';
          (cell as CodeCell).executionCount = executionCount;
        }
      });
      emit('cell:executed', { cellId, success, executionCount });
    },
    
    clearQueue: () => {
      set({ executionQueue: [], currentExecutingCellId: null });
    },
    
    // ============ Agent Slice ============
    agentStatus: 'idle',
    agentMode: 'interactive',
    contextCellId: null,
    conversationHistory: [],
    pendingEdits: new Map(),
    
    setAgentStatus: (status) => {
      set({ agentStatus: status });
    },
    
    setAgentMode: (mode) => {
      set({ agentMode: mode });
    },
    
    setContextCellId: (cellId) => {
      set({ contextCellId: cellId });
    },
    
    addConversation: (role, content, contextCellId) => {
      set((state) => {
        state.conversationHistory.push({
          id: generateId(),
          role,
          content,
          timestamp: new Date().toISOString(),
          contextCellId,
        });
      });
    },
    
    clearConversation: () => {
      set({ conversationHistory: [], contextCellId: null });
    },
    
    // Agent 编辑状态
    proposeEdit: (cellId, newSource) => {
      set((state) => {
        state.pendingEdits.set(cellId, {
          source: newSource,
          from: 'agent',
          status: 'pending',
          timestamp: new Date().toISOString(),
        });
      });
      emit('cell:pendingEdit', { cellId, newSource });
    },
    
    confirmEdit: (cellId) => {
      const pendingEdit = get().pendingEdits.get(cellId);
      if (!pendingEdit) return;
      
      get().pushHistory();
      set((state) => {
        const cell = state.cells.find(c => c.id === cellId);
        if (cell && (cell.type === 'code' || cell.type === 'markdown')) {
          (cell as CodeCell | MarkdownCell).source = pendingEdit.source;
          cell.updatedAt = new Date().toISOString();
        }
        state.pendingEdits.delete(cellId);
      });
      emit('cell:editConfirmed', { cellId });
    },
    
    rejectEdit: (cellId) => {
      set((state) => {
        state.pendingEdits.delete(cellId);
      });
      emit('cell:editRejected', { cellId });
    },
    
    getPendingEdit: (cellId) => {
      return get().pendingEdits.get(cellId);
    },
  }))
);

// ============================================================
// Selector Hooks
// ============================================================

export function useCells() {
  return useNotebookStore((state) => state.cells);
}

export function useActiveCell() {
  return useNotebookStore((state) => {
    const id = state.activeCellId;
    return id ? state.cells.find((c) => c.id === id) : null;
  });
}

export function useKernelStatus() {
  return useNotebookStore((state) => state.kernelStatus);
}

export function useAgentStatus() {
  return useNotebookStore((state) => state.agentStatus);
}

export function useIsExecuting() {
  return useNotebookStore((state) => state.currentExecutingCellId !== null);
}

export function useSelectedCells() {
  return useNotebookStore((state) => 
    state.cells.filter(c => state.selectedCellIds.includes(c.id))
  );
}

export function usePendingEdit(cellId: string) {
  return useNotebookStore((state) => state.pendingEdits.get(cellId));
}

export function useCanUndo() {
  return useNotebookStore((state) => state.historyIndex > 0);
}

export function useCanRedo() {
  return useNotebookStore((state) => state.historyIndex < state.history.length - 1);
}
