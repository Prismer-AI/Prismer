/**
 * Unified Citation Tag Component
 * 
 * 支持单论文和跨论文引用的统一标签组件
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Citation } from '../../types/citation';
import { citationNavigator } from '../../services/citationNavigator';
import { useMultiDocumentStore } from '../../store/multiDocumentStore';
import { useCitationStore } from '../../store/citationStore';
import { FileText, Image, Table2, Calculator, ExternalLink, Loader2 } from 'lucide-react';

// ============================================================
// 类型定义
// ============================================================

export interface UnifiedCitationTagProps {
  /** Citation 对象 */
  citation: Citation;
  
  /** 是否显示论文前缀 (多论文模式) */
  showPaperPrefix?: boolean;
  
  /** 颜色方案: 按类型或按论文着色 */
  colorScheme?: 'type' | 'paper';
  
  /** 尺寸 */
  size?: 'sm' | 'md';
  
  /** 紧凑模式 - 与左侧 InlineCitation 风格一致 */
  compact?: boolean;
  
  /** 额外的 className */
  className?: string;
  
  /** 是否禁用点击 */
  disabled?: boolean;
}

// ============================================================
// 颜色配置
// ============================================================

const TYPE_COLORS: Record<string, { bg: string; text: string; hover: string; border: string }> = {
  text: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    hover: 'hover:bg-indigo-100',
    border: 'border-indigo-200',
  },
  image: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    hover: 'hover:bg-emerald-100',
    border: 'border-emerald-200',
  },
  table: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    hover: 'hover:bg-amber-100',
    border: 'border-amber-200',
  },
  equation: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    hover: 'hover:bg-purple-100',
    border: 'border-purple-200',
  },
  title: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    hover: 'hover:bg-rose-100',
    border: 'border-rose-200',
  },
  reference: {
    bg: 'bg-stone-50',
    text: 'text-stone-700',
    hover: 'hover:bg-stone-100',
    border: 'border-stone-200',
  },
};

const PAPER_COLORS: string[] = [
  'indigo',
  'emerald',
  'amber',
  'purple',
  'rose',
  'cyan',
  'orange',
  'teal',
];

// ============================================================
// 图标映射
// ============================================================

function getTypeIcon(type: string): React.ReactNode {
  switch (type) {
    case 'image':
      return <Image className="w-3 h-3" />;
    case 'table':
      return <Table2 className="w-3 h-3" />;
    case 'equation':
      return <Calculator className="w-3 h-3" />;
    default:
      return <FileText className="w-3 h-3" />;
  }
}

// ============================================================
// 组件实现
// ============================================================

// Compact mode colors - solid background with white text (matches InlineCitation)
const COMPACT_TYPE_COLORS: Record<string, { bg: string; hover: string }> = {
  text: { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600' },
  title: { bg: 'bg-violet-500', hover: 'hover:bg-violet-600' },
  image: { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600' },
  table: { bg: 'bg-blue-500', hover: 'hover:bg-blue-600' },
  equation: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600' },
  reference: { bg: 'bg-stone-500', hover: 'hover:bg-stone-600' },
};

export const UnifiedCitationTag: React.FC<UnifiedCitationTagProps> = ({
  citation,
  showPaperPrefix = false,
  colorScheme = 'type',
  size = 'sm',
  compact = false,
  className,
  disabled = false,
}) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const { documents, activeDocumentId, setActiveDocument } = useMultiDocumentStore();
  const { scrollToDetection } = useCitationStore();
  
  // 获取颜色
  const colors = useMemo(() => {
    if (compact) {
      // Compact mode: solid background with white text
      const compactColors = COMPACT_TYPE_COLORS[citation.type] || COMPACT_TYPE_COLORS.text;
      return {
        bg: compactColors.bg,
        text: 'text-white',
        hover: compactColors.hover,
        border: '',
      };
    }
    
    if (colorScheme === 'type') {
      return TYPE_COLORS[citation.type] || TYPE_COLORS.text;
    } else {
      // 按论文着色
      const paperIndex = Array.from(documents.keys()).indexOf(citation.paperId);
      const colorName = PAPER_COLORS[paperIndex % PAPER_COLORS.length];
      return {
        bg: `bg-${colorName}-50`,
        text: `text-${colorName}-700`,
        hover: `hover:bg-${colorName}-100`,
        border: `border-${colorName}-200`,
      };
    }
  }, [citation.type, citation.paperId, colorScheme, documents, compact]);
  
  // 处理点击
  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled || isNavigating) return;
    
    setIsNavigating(true);
    
    try {
      const { paperId, detectionId } = citation;
      
      // 检查目标论文是否已打开
      const targetDoc = documents.get(paperId);
      
      if (targetDoc) {
        // 切换到目标文档
        if (activeDocumentId !== paperId) {
          setActiveDocument(paperId);
          // 等待文档切换
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        // 滚动到目标位置
        scrollToDetection(detectionId);
      } else {
        // 论文未打开，使用导航器
        await citationNavigator.navigate(citation);
      }
    } catch (error) {
      console.error('[CitationTag] Navigation failed:', error);
    } finally {
      setIsNavigating(false);
    }
  }, [citation, disabled, isNavigating, documents, activeDocumentId, setActiveDocument, scrollToDetection]);
  
  // 构建显示文本
  const displayText = useMemo(() => {
    const { displayIndex, paperAlias, pageNumber } = citation;
    
    if (showPaperPrefix && paperAlias) {
      return `${paperAlias}:${displayIndex || pageNumber}`;
    }
    
    return `${displayIndex || pageNumber}`;
  }, [citation, showPaperPrefix]);
  
  // 构建 tooltip
  const tooltip = useMemo(() => {
    const parts: string[] = [];
    
    if (citation.paperTitle) {
      parts.push(citation.paperTitle);
    }
    
    parts.push(`Page ${citation.pageNumber}`);
    
    if (citation.excerpt) {
      parts.push(citation.excerpt.slice(0, 50) + '...');
    }
    
    return parts.join(' • ');
  }, [citation]);
  
  // 检查是否为当前论文
  const isCurrentPaper = activeDocumentId === citation.paperId;
  const isExternalPaper = !isCurrentPaper && !documents.has(citation.paperId);
  
  // Compact mode styling (matches InlineCitation from left panel)
  // Note: Using citation-tag-compact class for CSS targeting and !important color override
  if (compact) {
    return (
      <motion.button
        className={cn(
          'citation-tag-compact',
          'inline-flex items-center justify-center',
          'w-4 h-4 text-[10px] font-semibold rounded',
          colors.bg,
          colors.hover,
          'transition-colors cursor-pointer',
          'align-super ml-0.5',
          disabled && 'opacity-50 cursor-not-allowed',
          isNavigating && 'opacity-70',
          className
        )}
        onClick={handleClick}
        disabled={disabled || isNavigating}
        title={tooltip}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
      >
        {isNavigating ? (
          <Loader2 className="w-2 h-2 animate-spin text-white" />
        ) : (
          citation.displayIndex || citation.pageNumber
        )}
      </motion.button>
    );
  }
  
  return (
    <motion.button
      className={cn(
        'inline-flex items-center justify-center gap-0.5',
        'rounded font-medium transition-all',
        'border focus:outline-none focus:ring-2 focus:ring-offset-1',
        colors.bg,
        colors.text,
        colors.hover,
        colors.border,
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
        disabled && 'opacity-50 cursor-not-allowed',
        isNavigating && 'opacity-70',
        className
      )}
      onClick={handleClick}
      disabled={disabled || isNavigating}
      title={tooltip}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
    >
      {isNavigating ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <>
          {getTypeIcon(citation.type)}
          <span className="font-semibold">{displayText}</span>
          {isExternalPaper && <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-60" />}
        </>
      )}
    </motion.button>
  );
};

// ============================================================
// 便捷组件：从 detection ID 渲染
// ============================================================

export interface CitationTagFromIdProps {
  /** Detection ID (例如 p1_text_0) */
  detectionId: string;
  
  /** 论文 ID (单论文模式可省略) */
  paperId?: string;
  
  /** 论文别名 (多论文模式，例如 "A", "B") */
  paperAlias?: string;
  
  /** 显示索引 */
  displayIndex?: number;
  
  /** 其他属性 */
  showPaperPrefix?: boolean;
  colorScheme?: 'type' | 'paper';
  size?: 'sm' | 'md';
  compact?: boolean;
  className?: string;
}

export const CitationTagFromId: React.FC<CitationTagFromIdProps> = ({
  detectionId,
  paperId,
  paperAlias,
  displayIndex,
  ...props
}) => {
  const { activeDocumentId } = useMultiDocumentStore();
  const effectivePaperId = paperId || activeDocumentId || 'unknown';
  
  // 从 detectionId 提取信息
  const pageMatch = detectionId.match(/p(\d+)/);
  const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : 0;
  
  let type: 'text' | 'image' | 'table' | 'equation' = 'text';
  if (detectionId.includes('image')) type = 'image';
  else if (detectionId.includes('table')) type = 'table';
  else if (detectionId.includes('equation')) type = 'equation';
  
  const citation: Citation = {
    uri: `${effectivePaperId}#${detectionId}` as `${string}#${string}`,
    paperId: effectivePaperId,
    detectionId,
    pageNumber,
    type,
    displayIndex,
    paperAlias,
  };
  
  return <UnifiedCitationTag citation={citation} showPaperPrefix={!!paperAlias} {...props} />;
};
