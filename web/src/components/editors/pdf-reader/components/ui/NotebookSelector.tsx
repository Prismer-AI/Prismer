/**
 * Notebook Selector Component
 * 
 * 笔记本选择器
 * - 切换笔记本
 * - 创建新笔记本
 * - 管理笔记本列表
 */

'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  useNotebookStore,
  useNotebooks,
  useActiveNotebook,
  Notebook,
} from '../../store/notebookStore';
import {
  BookOpen,
  Plus,
  ChevronDown,
  Trash2,
  Edit,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================
// 类型定义
// ============================================================

export interface NotebookSelectorProps {
  /** 紧凑模式 */
  compact?: boolean;
  
  /** 额外的 className */
  className?: string;
}

// ============================================================
// 组件实现
// ============================================================

export const NotebookSelector: React.FC<NotebookSelectorProps> = ({
  compact = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const notebooks = useNotebooks();
  const activeNotebook = useActiveNotebook();
  const {
    createNotebook,
    deleteNotebook,
    renameNotebook,
    setActiveNotebook,
  } = useNotebookStore();
  
  // 创建新笔记本
  const handleCreateNotebook = useCallback(() => {
    const name = newNotebookName.trim() || `Notebook ${notebooks.length + 1}`;
    createNotebook(name);
    setNewNotebookName('');
    setIsCreating(false);
    setIsOpen(false);
  }, [newNotebookName, notebooks.length, createNotebook]);
  
  // 选择笔记本
  const handleSelectNotebook = useCallback((notebookId: string) => {
    setActiveNotebook(notebookId);
    setIsOpen(false);
  }, [setActiveNotebook]);
  
  // 开始编辑
  const handleStartEdit = useCallback((e: React.MouseEvent, notebook: Notebook) => {
    e.stopPropagation();
    setEditingId(notebook.id);
    setEditingName(notebook.name);
  }, []);
  
  // 保存编辑
  const handleSaveEdit = useCallback(() => {
    if (editingId && editingName.trim()) {
      renameNotebook(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  }, [editingId, editingName, renameNotebook]);
  
  // 删除笔记本
  const handleDeleteNotebook = useCallback((e: React.MouseEvent, notebookId: string) => {
    e.stopPropagation();
    if (confirm('Delete this notebook and all its notes?')) {
      deleteNotebook(notebookId);
    }
  }, [deleteNotebook]);
  
  // 格式化条目数量
  const formatEntryCount = (count: number) => {
    if (count === 0) return 'Empty';
    if (count === 1) return '1 note';
    return `${count} notes`;
  };
  
  return (
    <div className={cn('relative', className)}>
      {/* 触发按钮 */}
      <button
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-white border border-stone-200',
          'hover:bg-stone-50 transition-colors',
          'text-left w-full',
          compact && 'px-2 py-1.5'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-stone-800 truncate">
            {activeNotebook?.name || 'Select Notebook'}
          </div>
          {!compact && activeNotebook && (
            <div className="text-xs text-stone-500">
              {formatEntryCount(activeNotebook.entries.length)}
            </div>
          )}
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 text-stone-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>
      
      {/* 下拉面板 */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 背景遮罩 */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* 面板内容 */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                'absolute top-full left-0 right-0 mt-1 z-50',
                'bg-white rounded-lg border border-stone-200 shadow-lg',
                'max-h-80 overflow-hidden flex flex-col'
              )}
            >
              {/* 创建新笔记本 */}
              <div className="p-2 border-b border-stone-100">
                {isCreating ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Notebook name..."
                      value={newNotebookName}
                      onChange={(e) => setNewNotebookName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateNotebook();
                        if (e.key === 'Escape') setIsCreating(false);
                      }}
                      autoFocus
                      className="flex-1 h-8 px-2 text-sm border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsCreating(false)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateNotebook}
                      className="h-8"
                    >
                      Create
                    </Button>
                  </div>
                ) : (
                  <button
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 rounded-md',
                      'text-amber-600 hover:bg-amber-50 transition-colors'
                    )}
                    onClick={() => setIsCreating(true)}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">New Notebook</span>
                  </button>
                )}
              </div>
              
              {/* 笔记本列表 */}
              <div className="flex-1 overflow-y-auto">
                {notebooks.length === 0 ? (
                  <div className="p-4 text-center text-stone-500 text-sm">
                    No notebooks yet
                  </div>
                ) : (
                  notebooks.map((notebook) => (
                    <div
                      key={notebook.id}
                      className={cn(
                        'group flex items-center gap-2 px-3 py-2',
                        'hover:bg-stone-50 cursor-pointer',
                        activeNotebook?.id === notebook.id && 'bg-amber-50'
                      )}
                      onClick={() => handleSelectNotebook(notebook.id)}
                    >
                      <BookOpen className={cn(
                        'w-4 h-4 flex-shrink-0',
                        activeNotebook?.id === notebook.id ? 'text-amber-600' : 'text-stone-400'
                      )} />
                      
                      <div className="flex-1 min-w-0">
                        {editingId === notebook.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') {
                                  setEditingId(null);
                                  setEditingName('');
                                }
                              }}
                              autoFocus
                              className="flex-1 h-6 px-1 text-sm border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              className="p-1 rounded hover:bg-stone-200"
                              onClick={handleSaveEdit}
                            >
                              <Check className="w-3 h-3 text-green-600" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-stone-800 truncate">
                              {notebook.name}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-500">
                              <span>{formatEntryCount(notebook.entries.length)}</span>
                              {notebook.paperIds.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{notebook.paperIds.length} paper(s)</span>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* 标签指示器 */}
                      {notebook.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          {notebook.tags.slice(0, 2).map((tag, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 text-xs bg-stone-100 text-stone-600 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* 操作按钮 */}
                      {editingId !== notebook.id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            className="p-1 rounded hover:bg-stone-200"
                            onClick={(e) => handleStartEdit(e, notebook)}
                            title="Rename"
                          >
                            <Edit className="w-3.5 h-3.5 text-stone-500" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-red-100"
                            onClick={(e) => handleDeleteNotebook(e, notebook.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotebookSelector;
