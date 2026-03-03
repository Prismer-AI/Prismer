'use client';

/**
 * StreamingOutput - 流式输出组件
 * 
 * 优化实时输出渲染：
 * - 防抖合并频繁更新
 * - 缓冲区批量追加
 * - 自动滚动到底部
 * - 行数限制
 */

import React, { 
  useState, 
  useEffect, 
  useRef, 
  useCallback, 
  useMemo,
  memo,
} from 'react';
import { ChevronDown, ChevronUp, Trash2, Download } from 'lucide-react';

// ============================================================
// 类型定义
// ============================================================

interface StreamingOutputProps {
  cellId: string;
  initialContent?: string;
  isStreaming?: boolean;
  streamName?: 'stdout' | 'stderr';
  maxLines?: number;
  debounceMs?: number;
  autoScroll?: boolean;
  onClear?: () => void;
}

interface BufferState {
  content: string;
  lineCount: number;
  truncated: boolean;
}

// ============================================================
// 常量
// ============================================================

const DEFAULT_MAX_LINES = 1000;
const DEFAULT_DEBOUNCE_MS = 50;

// ============================================================
// StreamingOutput 组件
// ============================================================

export const StreamingOutput = memo(function StreamingOutput({
  cellId,
  initialContent = '',
  isStreaming = false,
  streamName = 'stdout',
  maxLines = DEFAULT_MAX_LINES,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  autoScroll = true,
  onClear,
}: StreamingOutputProps) {
  const [buffer, setBuffer] = useState<BufferState>({
    content: initialContent,
    lineCount: initialContent.split('\n').length,
    truncated: false,
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const containerRef = useRef<HTMLPreElement>(null);
  const pendingContentRef = useRef<string>('');
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAtBottomRef = useRef(true);

  // 刷新缓冲区到显示
  const flushBuffer = useCallback(() => {
    if (pendingContentRef.current === '') return;

    setBuffer(prev => {
      const newContent = prev.content + pendingContentRef.current;
      const lines = newContent.split('\n');
      
      let finalContent = newContent;
      let truncated = prev.truncated;
      
      // 行数限制
      if (lines.length > maxLines) {
        const trimmedLines = lines.slice(-maxLines);
        finalContent = trimmedLines.join('\n');
        truncated = true;
      }

      pendingContentRef.current = '';

      return {
        content: finalContent,
        lineCount: lines.length,
        truncated,
      };
    });
  }, [maxLines]);

  // 追加内容（带防抖）
  const appendContent = useCallback((text: string) => {
    pendingContentRef.current += text;

    // 清除之前的定时器
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }

    // 设置新的防抖定时器
    flushTimeoutRef.current = setTimeout(flushBuffer, debounceMs);
  }, [flushBuffer, debounceMs]);

  // 自动滚动到底部
  useEffect(() => {
    if (!autoScroll || isCollapsed) return;
    if (!containerRef.current) return;
    if (!isAtBottomRef.current) return;

    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [buffer.content, autoScroll, isCollapsed]);

  // 检测是否在底部
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  // 初始内容变化时重置
  useEffect(() => {
    setBuffer({
      content: initialContent,
      lineCount: initialContent.split('\n').length,
      truncated: false,
    });
    pendingContentRef.current = '';
  }, [initialContent]);

  // 下载输出
  const handleDownload = useCallback(() => {
    const blob = new Blob([buffer.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `output_${cellId.slice(0, 8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [buffer.content, cellId]);

  // 样式
  const isError = streamName === 'stderr';
  const baseClass = isError 
    ? 'text-red-400 bg-red-900/20' 
    : 'text-slate-300';

  if (buffer.content === '' && !isStreaming) {
    return null;
  }

  return (
    <div className="border-t border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1 bg-slate-800/30 border-b border-slate-700/50">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
        >
          {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          <span>{streamName}</span>
          <span className="text-slate-600">
            ({buffer.lineCount} lines{buffer.truncated ? ', truncated' : ''})
          </span>
        </button>

        <div className="flex items-center gap-1">
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              streaming
            </span>
          )}
          <button
            onClick={handleDownload}
            className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300"
            title="Download"
          >
            <Download size={12} />
          </button>
          {onClear && (
            <button
              onClick={onClear}
              className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300"
              title="Clear"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <pre
          ref={containerRef}
          onScroll={handleScroll}
          className={`px-4 py-2 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-[300px] ${baseClass}`}
        >
          {buffer.truncated && (
            <div className="text-slate-500 text-xs mb-2 italic">
              ... (earlier output truncated, showing last {maxLines} lines)
            </div>
          )}
          {buffer.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse ml-1" />
          )}
        </pre>
      )}
    </div>
  );
});

// ============================================================
// useStreamingOutput Hook
// ============================================================

export interface UseStreamingOutputOptions {
  maxLines?: number;
  debounceMs?: number;
}

export function useStreamingOutput(options: UseStreamingOutputOptions = {}) {
  const { maxLines = DEFAULT_MAX_LINES, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  
  const [outputs, setOutputs] = useState<Map<string, BufferState>>(new Map());
  const pendingBuffers = useRef<Map<string, string>>(new Map());
  const flushTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const flush = useCallback((cellId: string) => {
    const pending = pendingBuffers.current.get(cellId);
    if (!pending) return;

    setOutputs(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(cellId) || { content: '', lineCount: 0, truncated: false };
      
      const newContent = existing.content + pending;
      const lines = newContent.split('\n');
      
      let finalContent = newContent;
      let truncated = existing.truncated;
      
      if (lines.length > maxLines) {
        finalContent = lines.slice(-maxLines).join('\n');
        truncated = true;
      }

      newMap.set(cellId, {
        content: finalContent,
        lineCount: Math.min(lines.length, maxLines),
        truncated,
      });

      pendingBuffers.current.delete(cellId);
      return newMap;
    });
  }, [maxLines]);

  const append = useCallback((cellId: string, text: string) => {
    const current = pendingBuffers.current.get(cellId) || '';
    pendingBuffers.current.set(cellId, current + text);

    // Clear existing timeout
    const existingTimeout = flushTimeouts.current.get(cellId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => flush(cellId), debounceMs);
    flushTimeouts.current.set(cellId, timeout);
  }, [flush, debounceMs]);

  const clear = useCallback((cellId: string) => {
    setOutputs(prev => {
      const newMap = new Map(prev);
      newMap.delete(cellId);
      return newMap;
    });
    pendingBuffers.current.delete(cellId);
  }, []);

  const clearAll = useCallback(() => {
    setOutputs(new Map());
    pendingBuffers.current.clear();
    flushTimeouts.current.forEach(timeout => clearTimeout(timeout));
    flushTimeouts.current.clear();
  }, []);

  const getOutput = useCallback((cellId: string) => {
    return outputs.get(cellId);
  }, [outputs]);

  // Cleanup
  useEffect(() => {
    return () => {
      flushTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return {
    outputs,
    append,
    clear,
    clearAll,
    getOutput,
  };
}

export default StreamingOutput;
