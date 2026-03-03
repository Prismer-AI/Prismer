/**
 * Session Selector Component
 * 
 * 聊天会话选择器
 * - 切换会话
 * - 创建新会话
 * - 管理会话列表
 */

'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  useChatSessionStore,
  useActiveSessions,
  useActiveSession,
  ChatSession,
} from '../../store/chatSessionStore';
import {
  MessageSquare,
  Plus,
  ChevronDown,
  Trash2,
  Archive,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================
// 类型定义
// ============================================================

export interface SessionSelectorProps {
  /** 当前论文 ID (用于自动创建会话) */
  currentPaperId?: string;
  
  /** 当前论文标题 */
  currentPaperTitle?: string;
  
  /** 紧凑模式 */
  compact?: boolean;
  
  /** 额外的 className */
  className?: string;
}

// ============================================================
// 组件实现
// ============================================================

export const SessionSelector: React.FC<SessionSelectorProps> = ({
  currentPaperId,
  currentPaperTitle,
  compact = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  
  const sessions = useActiveSessions();
  const activeSession = useActiveSession();
  const {
    createSession,
    deleteSession,
    archiveSession,
    setActiveSession,
    addPaperToSession,
  } = useChatSessionStore();
  
  // 创建新会话
  const handleCreateSession = useCallback(() => {
    const title = newSessionTitle.trim() || `Chat ${new Date().toLocaleDateString()}`;
    const paperIds = currentPaperId ? [currentPaperId] : [];
    createSession(title, paperIds);
    setNewSessionTitle('');
    setIsCreating(false);
    setIsOpen(false);
  }, [newSessionTitle, currentPaperId, createSession]);
  
  // 选择会话
  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSession(sessionId);
    
    // 如果当前论文不在会话中，自动添加
    if (currentPaperId) {
      const session = sessions.find(s => s.id === sessionId);
      if (session && !session.paperIds.includes(currentPaperId)) {
        addPaperToSession(sessionId, currentPaperId);
      }
    }
    
    setIsOpen(false);
  }, [setActiveSession, currentPaperId, sessions, addPaperToSession]);
  
  // 删除会话
  const handleDeleteSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm('Delete this chat session?')) {
      deleteSession(sessionId);
    }
  }, [deleteSession]);
  
  // 归档会话
  const handleArchiveSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    archiveSession(sessionId);
  }, [archiveSession]);
  
  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };
  
  // 快速创建会话
  const handleQuickCreate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const title = `Chat ${new Date().toLocaleDateString()}`;
    const paperIds = currentPaperId ? [currentPaperId] : [];
    createSession(title, paperIds);
  }, [currentPaperId, createSession]);
  
  return (
    <div className={cn('relative', className)}>
      {/* 触发按钮和快速创建 */}
      <div className="flex items-center gap-1">
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg flex-1',
            'bg-white border border-stone-200',
            'hover:bg-stone-50 transition-colors',
            'text-left',
            compact && 'px-2 py-1.5'
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          <MessageSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-stone-800 truncate">
              {activeSession?.title || 'Select Session'}
            </div>
            {!compact && activeSession && (
              <div className="text-xs text-stone-500">
                {activeSession.messages.length} messages • {activeSession.paperIds.length} paper(s)
              </div>
            )}
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-stone-400 transition-transform',
            isOpen && 'rotate-180'
          )} />
        </button>
        
        {/* 快速新建按钮 */}
        <button
          onClick={handleQuickCreate}
          className={cn(
            'flex items-center justify-center',
            'w-9 h-9 rounded-lg',
            'bg-indigo-600 hover:bg-indigo-700',
            'transition-colors',
            'flex-shrink-0'
          )}
          title="New Session"
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>
      
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
              {/* 创建新会话 */}
              <div className="p-2 border-b border-stone-100">
                {isCreating ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Session title..."
                      value={newSessionTitle}
                      onChange={(e) => setNewSessionTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateSession();
                        if (e.key === 'Escape') setIsCreating(false);
                      }}
                      autoFocus
                      className="flex-1 h-8 px-2 text-sm border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      onClick={handleCreateSession}
                      className="h-8"
                    >
                      Create
                    </Button>
                  </div>
                ) : (
                  <button
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 rounded-md',
                      'text-indigo-600 hover:bg-indigo-50 transition-colors'
                    )}
                    onClick={() => setIsCreating(true)}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">New Session</span>
                  </button>
                )}
              </div>
              
              {/* 会话列表 */}
              <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="p-4 text-center text-stone-500 text-sm">
                    No chat sessions yet
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        'group px-3 py-2',
                        'hover:bg-stone-50 cursor-pointer',
                        activeSession?.id === session.id && 'bg-indigo-50'
                      )}
                      onClick={() => handleSelectSession(session.id)}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className={cn(
                          'w-4 h-4 flex-shrink-0',
                          activeSession?.id === session.id ? 'text-indigo-600' : 'text-stone-400'
                        )} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-stone-800 truncate">
                            {session.title}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-500">
                            <span>{session.messages.length} msgs</span>
                            <span>•</span>
                            <span>{formatTime(session.updatedAt)}</span>
                          </div>
                        </div>
                        
                        {/* 操作按钮 */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            className="p-1 rounded hover:bg-stone-200"
                            onClick={(e) => handleArchiveSession(e, session.id)}
                            title="Archive"
                          >
                            <Archive className="w-3.5 h-3.5 text-stone-500" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-red-100"
                            onClick={(e) => handleDeleteSession(e, session.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                      
                      {/* 关联论文清单 */}
                      {session.paperIds.length > 0 && (
                        <div className="mt-1.5 ml-6 flex flex-wrap gap-1">
                          {session.paperIds.slice(0, 3).map((paperId, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-indigo-100 text-indigo-700 rounded"
                              title={paperId}
                            >
                              📄 {paperId.length > 15 ? paperId.slice(0, 15) + '...' : paperId}
                            </span>
                          ))}
                          {session.paperIds.length > 3 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-stone-100 text-stone-600 rounded">
                              +{session.paperIds.length - 3} more
                            </span>
                          )}
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

export default SessionSelector;
