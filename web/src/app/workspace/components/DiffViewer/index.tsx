'use client';

/**
 * DiffViewer
 * 
 * 差异查看器 - 用于显示内容变化 (类似 Git Diff)
 * 支持行级和字符级差异显示
 */

import React, { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ArrowRight, FileText, X } from 'lucide-react';
import type { DiffChange } from '../../types';

// ============================================================
// Types
// ============================================================

export interface DiffViewerProps {
  /** 差异变化列表 */
  changes: DiffChange[];
  /** 文件名 */
  fileName?: string;
  /** 是否显示行号 */
  showLineNumbers?: boolean;
  /** 语言 (用于语法高亮) */
  language?: string;
  /** 显示模式 */
  mode?: 'inline' | 'side-by-side' | 'unified';
  /** 关闭回调 */
  onClose?: () => void;
  /** 自定义类名 */
  className?: string;
}

interface ParsedLine {
  type: 'insert' | 'delete' | 'unchanged' | 'context';
  lineNumber?: number;
  content: string;
  highlightRanges?: { start: number; end: number }[];
}

// ============================================================
// Helpers
// ============================================================

/**
 * 解析差异变化为行
 */
function parseChangesToLines(changes: DiffChange[]): ParsedLine[] {
  const lines: ParsedLine[] = [];

  for (const change of changes) {
    switch (change.type) {
      case 'insert':
        if (change.newContent) {
          change.newContent.split('\n').forEach((line, idx) => {
            lines.push({
              type: 'insert',
              lineNumber: change.range.start + idx,
              content: line,
            });
          });
        }
        break;

      case 'delete':
        if (change.oldContent) {
          change.oldContent.split('\n').forEach((line, idx) => {
            lines.push({
              type: 'delete',
              lineNumber: change.range.start + idx,
              content: line,
            });
          });
        }
        break;

      case 'modify':
        // 修改：先显示删除的，再显示新增的
        if (change.oldContent) {
          change.oldContent.split('\n').forEach((line, idx) => {
            lines.push({
              type: 'delete',
              lineNumber: change.range.start + idx,
              content: line,
            });
          });
        }
        if (change.newContent) {
          change.newContent.split('\n').forEach((line, idx) => {
            lines.push({
              type: 'insert',
              lineNumber: change.range.start + idx,
              content: line,
            });
          });
        }
        break;
    }
  }

  return lines;
}

// ============================================================
// Line Components
// ============================================================

const DiffLine = memo(function DiffLine({
  line,
  showLineNumber,
}: {
  line: ParsedLine;
  showLineNumber: boolean;
}) {
  const bgColor = {
    insert: 'bg-green-50',
    delete: 'bg-red-50',
    unchanged: 'bg-transparent',
    context: 'bg-slate-50',
  }[line.type];

  const borderColor = {
    insert: 'border-l-green-500',
    delete: 'border-l-red-500',
    unchanged: 'border-l-transparent',
    context: 'border-l-slate-300',
  }[line.type];

  const textColor = {
    insert: 'text-green-800',
    delete: 'text-red-800',
    unchanged: 'text-slate-700',
    context: 'text-slate-500',
  }[line.type];

  const Icon = line.type === 'insert' ? Plus : line.type === 'delete' ? Minus : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: line.type === 'insert' ? 10 : -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`
        flex items-stretch font-mono text-sm
        border-l-4 ${borderColor} ${bgColor}
      `}
    >
      {/* Line number */}
      {showLineNumber && (
        <div className="w-12 flex-shrink-0 text-right pr-2 py-1 text-slate-400 bg-slate-100/50 select-none">
          {line.lineNumber ?? ''}
        </div>
      )}

      {/* Icon */}
      <div className="w-6 flex-shrink-0 flex items-center justify-center py-1">
        {Icon && <Icon className={`w-3 h-3 ${line.type === 'insert' ? 'text-green-600' : 'text-red-600'}`} />}
      </div>

      {/* Content */}
      <div className={`flex-1 py-1 pr-4 ${textColor} whitespace-pre`}>
        {line.content || ' '}
      </div>
    </motion.div>
  );
});

// ============================================================
// Main Component
// ============================================================

export const DiffViewer = memo(function DiffViewer({
  changes,
  fileName,
  showLineNumbers = true,
  mode = 'unified',
  onClose,
  className = '',
}: DiffViewerProps) {
  const lines = useMemo(() => parseChangesToLines(changes), [changes]);

  const stats = useMemo(() => {
    const inserted = lines.filter((l) => l.type === 'insert').length;
    const deleted = lines.filter((l) => l.type === 'delete').length;
    return { inserted, deleted };
  }, [lines]);

  if (changes.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            {fileName ?? '内容变化'}
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-green-600">
              <Plus className="w-3 h-3" />
              {stats.inserted}
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <Minus className="w-3 h-3" />
              {stats.deleted}
            </span>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {lines.map((line, index) => (
            <DiffLine
              key={`${line.type}-${index}-${line.content.slice(0, 20)}`}
              line={line}
              showLineNumber={showLineNumbers}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {stats.inserted + stats.deleted} 行变化
          </span>
          <span className="flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            {mode === 'unified' ? '统一视图' : mode === 'side-by-side' ? '并排视图' : '内联视图'}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

// ============================================================
// Inline Diff Highlight Component
// ============================================================

export interface InlineDiffHighlightProps {
  /** 旧内容 */
  oldContent: string;
  /** 新内容 */
  newContent: string;
  /** 样式类名 */
  className?: string;
}

/**
 * 内联差异高亮组件 - 用于在文本中高亮显示变化部分
 */
export const InlineDiffHighlight = memo(function InlineDiffHighlight({
  oldContent,
  newContent,
  className = '',
}: InlineDiffHighlightProps) {
  // 简单的字符级 diff 实现
  const parts = useMemo(() => {
    const result: { type: 'same' | 'old' | 'new'; text: string }[] = [];
    
    // 使用 LCS (最长公共子序列) 的简化版本
    let i = 0;
    let j = 0;
    
    while (i < oldContent.length || j < newContent.length) {
      if (i < oldContent.length && j < newContent.length && oldContent[i] === newContent[j]) {
        // 相同字符
        let sameStart = i;
        while (i < oldContent.length && j < newContent.length && oldContent[i] === newContent[j]) {
          i++;
          j++;
        }
        result.push({ type: 'same', text: oldContent.slice(sameStart, i) });
      } else {
        // 找到下一个相同位置
        let foundMatch = false;
        for (let lookAhead = 1; lookAhead <= 10 && !foundMatch; lookAhead++) {
          if (i + lookAhead < oldContent.length && oldContent[i + lookAhead] === newContent[j]) {
            // 删除的部分
            result.push({ type: 'old', text: oldContent.slice(i, i + lookAhead) });
            i += lookAhead;
            foundMatch = true;
          } else if (j + lookAhead < newContent.length && oldContent[i] === newContent[j + lookAhead]) {
            // 新增的部分
            result.push({ type: 'new', text: newContent.slice(j, j + lookAhead) });
            j += lookAhead;
            foundMatch = true;
          }
        }
        
        if (!foundMatch) {
          // 无法匹配，分别处理
          if (i < oldContent.length) {
            result.push({ type: 'old', text: oldContent[i] });
            i++;
          }
          if (j < newContent.length) {
            result.push({ type: 'new', text: newContent[j] });
            j++;
          }
        }
      }
    }
    
    return result;
  }, [oldContent, newContent]);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'same') {
          return <span key={index}>{part.text}</span>;
        }
        if (part.type === 'old') {
          return (
            <span
              key={index}
              className="bg-red-200 text-red-800 line-through"
            >
              {part.text}
            </span>
          );
        }
        return (
          <span
            key={index}
            className="bg-green-200 text-green-800"
          >
            {part.text}
          </span>
        );
      })}
    </span>
  );
});

export default DiffViewer;
