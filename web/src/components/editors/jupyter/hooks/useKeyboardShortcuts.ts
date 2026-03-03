/**
 * useKeyboardShortcuts - 键盘快捷键 Hook
 * 
 * 提供 Jupyter Notebook 风格的快捷键支持
 */

import { useEffect, useCallback, useRef } from 'react';

// ============================================================
// 类型定义
// ============================================================

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;  // Command on Mac
  action: () => void;
  description: string;
  category?: 'cell' | 'execution' | 'navigation' | 'edit' | 'misc';
  mode?: 'command' | 'edit' | 'any';  // Jupyter 模式
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  mode?: 'command' | 'edit';
  onModeChange?: (mode: 'command' | 'edit') => void;
}

export interface NotebookActions {
  // Cell 操作
  addCellAbove?: () => void;
  addCellBelow?: () => void;
  deleteCell?: () => void;
  cutCell?: () => void;
  copyCell?: () => void;
  pasteCell?: () => void;
  moveUp?: () => void;
  moveDown?: () => void;
  
  // 执行操作
  runCell?: () => void;
  runCellAndAdvance?: () => void;
  runAllCells?: () => void;
  interruptKernel?: () => void;
  restartKernel?: () => void;
  
  // 导航
  selectPrevCell?: () => void;
  selectNextCell?: () => void;
  
  // 编辑
  enterEditMode?: () => void;
  enterCommandMode?: () => void;
  undo?: () => void;
  redo?: () => void;
  
  // 其他
  save?: () => void;
  toggleLineNumbers?: () => void;
  showKeyboardShortcuts?: () => void;
}

// ============================================================
// 默认快捷键配置
// ============================================================

function createDefaultShortcuts(actions: NotebookActions): KeyboardShortcut[] {
  const shortcuts: KeyboardShortcut[] = [];

  // === Cell 操作 (Command Mode) ===
  if (actions.addCellAbove) {
    shortcuts.push({
      key: 'a',
      action: actions.addCellAbove,
      description: 'Add cell above',
      category: 'cell',
      mode: 'command',
    });
  }

  if (actions.addCellBelow) {
    shortcuts.push({
      key: 'b',
      action: actions.addCellBelow,
      description: 'Add cell below',
      category: 'cell',
      mode: 'command',
    });
  }

  if (actions.deleteCell) {
    shortcuts.push({
      key: 'd',
      action: () => {
        // 需要按两次 d
      },
      description: 'Delete cell (press twice)',
      category: 'cell',
      mode: 'command',
    });

    shortcuts.push({
      key: 'x',
      action: actions.deleteCell,
      description: 'Cut cell',
      category: 'cell',
      mode: 'command',
    });
  }

  if (actions.copyCell) {
    shortcuts.push({
      key: 'c',
      action: actions.copyCell,
      description: 'Copy cell',
      category: 'cell',
      mode: 'command',
    });
  }

  if (actions.pasteCell) {
    shortcuts.push({
      key: 'v',
      action: actions.pasteCell,
      description: 'Paste cell below',
      category: 'cell',
      mode: 'command',
    });

    shortcuts.push({
      key: 'v',
      shift: true,
      action: actions.pasteCell,
      description: 'Paste cell above',
      category: 'cell',
      mode: 'command',
    });
  }

  if (actions.moveUp) {
    shortcuts.push({
      key: 'ArrowUp',
      ctrl: true,
      action: actions.moveUp,
      description: 'Move cell up',
      category: 'cell',
      mode: 'command',
    });
  }

  if (actions.moveDown) {
    shortcuts.push({
      key: 'ArrowDown',
      ctrl: true,
      action: actions.moveDown,
      description: 'Move cell down',
      category: 'cell',
      mode: 'command',
    });
  }

  // === 执行操作 ===
  if (actions.runCell) {
    shortcuts.push({
      key: 'Enter',
      ctrl: true,
      action: actions.runCell,
      description: 'Run cell',
      category: 'execution',
      mode: 'any',
    });
  }

  if (actions.runCellAndAdvance) {
    shortcuts.push({
      key: 'Enter',
      shift: true,
      action: actions.runCellAndAdvance,
      description: 'Run cell and advance',
      category: 'execution',
      mode: 'any',
    });
  }

  if (actions.runAllCells) {
    shortcuts.push({
      key: 'Enter',
      ctrl: true,
      shift: true,
      action: actions.runAllCells,
      description: 'Run all cells',
      category: 'execution',
      mode: 'any',
    });
  }

  if (actions.interruptKernel) {
    shortcuts.push({
      key: 'i',
      action: actions.interruptKernel,
      description: 'Interrupt kernel (press twice)',
      category: 'execution',
      mode: 'command',
    });
  }

  if (actions.restartKernel) {
    shortcuts.push({
      key: '0',
      action: actions.restartKernel,
      description: 'Restart kernel (press twice)',
      category: 'execution',
      mode: 'command',
    });
  }

  // === 导航 ===
  if (actions.selectPrevCell) {
    shortcuts.push({
      key: 'ArrowUp',
      action: actions.selectPrevCell,
      description: 'Select previous cell',
      category: 'navigation',
      mode: 'command',
    });

    shortcuts.push({
      key: 'k',
      action: actions.selectPrevCell,
      description: 'Select previous cell',
      category: 'navigation',
      mode: 'command',
    });
  }

  if (actions.selectNextCell) {
    shortcuts.push({
      key: 'ArrowDown',
      action: actions.selectNextCell,
      description: 'Select next cell',
      category: 'navigation',
      mode: 'command',
    });

    shortcuts.push({
      key: 'j',
      action: actions.selectNextCell,
      description: 'Select next cell',
      category: 'navigation',
      mode: 'command',
    });
  }

  // === 模式切换 ===
  if (actions.enterEditMode) {
    shortcuts.push({
      key: 'Enter',
      action: actions.enterEditMode,
      description: 'Enter edit mode',
      category: 'edit',
      mode: 'command',
    });
  }

  if (actions.enterCommandMode) {
    shortcuts.push({
      key: 'Escape',
      action: actions.enterCommandMode,
      description: 'Enter command mode',
      category: 'edit',
      mode: 'edit',
    });
  }

  // === 其他 ===
  if (actions.save) {
    shortcuts.push({
      key: 's',
      ctrl: true,
      action: actions.save,
      description: 'Save notebook',
      category: 'misc',
      mode: 'any',
    });

    shortcuts.push({
      key: 's',
      meta: true,
      action: actions.save,
      description: 'Save notebook (Mac)',
      category: 'misc',
      mode: 'any',
    });
  }

  if (actions.showKeyboardShortcuts) {
    shortcuts.push({
      key: 'h',
      action: actions.showKeyboardShortcuts,
      description: 'Show keyboard shortcuts',
      category: 'misc',
      mode: 'command',
    });
  }

  if (actions.toggleLineNumbers) {
    shortcuts.push({
      key: 'l',
      action: actions.toggleLineNumbers,
      description: 'Toggle line numbers',
      category: 'misc',
      mode: 'command',
    });
  }

  return shortcuts;
}

// ============================================================
// Hook 实现
// ============================================================

export function useKeyboardShortcuts(
  actions: NotebookActions,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, mode = 'command', onModeChange } = options;
  
  const modeRef = useRef(mode);
  const lastKeyRef = useRef<{ key: string; time: number } | null>(null);
  
  // 更新 mode ref
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const shortcuts = createDefaultShortcuts(actions);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // 忽略在输入框中的按键（除了特定快捷键）
    const target = event.target as HTMLElement;
    const isInEditor = target.closest('.monaco-editor') !== null;
    const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    
    // 如果在编辑器中，只处理 edit 模式和 any 模式的快捷键
    const currentMode = (isInEditor || isInInput) ? 'edit' : modeRef.current;

    // 查找匹配的快捷键
    const matchedShortcut = shortcuts.find(shortcut => {
      // 检查模式
      if (shortcut.mode !== 'any' && shortcut.mode !== currentMode) {
        return false;
      }

      // 检查按键
      if (shortcut.key.toLowerCase() !== event.key.toLowerCase()) {
        return false;
      }

      // 检查修饰键
      if (!!shortcut.ctrl !== event.ctrlKey) return false;
      if (!!shortcut.shift !== event.shiftKey) return false;
      if (!!shortcut.alt !== event.altKey) return false;
      if (!!shortcut.meta !== event.metaKey) return false;

      return true;
    });

    if (matchedShortcut) {
      // 处理需要按两次的快捷键
      const now = Date.now();
      if (matchedShortcut.description.includes('press twice')) {
        if (
          lastKeyRef.current?.key === event.key &&
          now - lastKeyRef.current.time < 500
        ) {
          event.preventDefault();
          matchedShortcut.action();
          lastKeyRef.current = null;
        } else {
          lastKeyRef.current = { key: event.key, time: now };
        }
        return;
      }

      event.preventDefault();
      matchedShortcut.action();
    }
  }, [enabled, shortcuts]);

  // 注册事件监听
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  // 模式切换
  const setMode = useCallback((newMode: 'command' | 'edit') => {
    modeRef.current = newMode;
    onModeChange?.(newMode);
  }, [onModeChange]);

  return {
    mode: modeRef.current,
    setMode,
    shortcuts,
  };
}

// ============================================================
// 快捷键帮助组件数据
// ============================================================

export function getShortcutsByCategory(shortcuts: KeyboardShortcut[]) {
  const categories: Record<string, KeyboardShortcut[]> = {
    cell: [],
    execution: [],
    navigation: [],
    edit: [],
    misc: [],
  };

  shortcuts.forEach(shortcut => {
    const category = shortcut.category || 'misc';
    if (categories[category]) {
      categories[category].push(shortcut);
    }
  });

  return categories;
}

export function formatShortcutKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.meta) parts.push('⌘');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  
  let key = shortcut.key;
  if (key === 'ArrowUp') key = '↑';
  if (key === 'ArrowDown') key = '↓';
  if (key === 'ArrowLeft') key = '←';
  if (key === 'ArrowRight') key = '→';
  if (key === 'Enter') key = '↵';
  if (key === 'Escape') key = 'Esc';
  
  parts.push(key.toUpperCase());
  
  return parts.join(' + ');
}

export default useKeyboardShortcuts;
