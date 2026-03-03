/**
 * CitationTag Component
 * 
 * 可点击的引用标签，用于在 AI 生成内容中显示
 * 点击后会高亮并滚动到 PDF 中的源位置
 */

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useCitationStore } from '../../store/citationStore';
import { cn } from '@/lib/utils';
import { Citation, SourceCitation } from '@/types/paperContext';

// ============================================================
// Types
// ============================================================

interface CitationTagProps {
  /** Citation 数据 */
  citation: Citation | SourceCitation;
  /** 显示的索引号 (从 1 开始) */
  index: number;
  /** 点击回调 */
  onClick?: () => void;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================================
// Component
// ============================================================

export const CitationTag: React.FC<CitationTagProps> = ({
  citation,
  index,
  onClick,
  compact = false,
  className,
}) => {
  const { setHoveredCitation, scrollToDetection, flashCitation } = useCitationStore();

  // 获取 detection_id (兼容两种类型)
  const detectionId = 'detection_id' in citation 
    ? citation.detection_id 
    : citation.detection_id;

  // 获取页码
  const pageNumber = 'page_number' in citation 
    ? citation.page_number 
    : citation.pageNumber;

  // 处理鼠标悬停
  const handleMouseEnter = useCallback(() => {
    if (detectionId) {
      setHoveredCitation(detectionId);
    }
  }, [detectionId, setHoveredCitation]);

  const handleMouseLeave = useCallback(() => {
    setHoveredCitation(null);
  }, [setHoveredCitation]);

  // 处理点击
  const handleClick = useCallback(() => {
    if (detectionId) {
      scrollToDetection(detectionId);
    }
    onClick?.();
  }, [detectionId, scrollToDetection, onClick]);

  // 获取显示文本
  const getExcerpt = () => {
    if ('excerpt' in citation) return citation.excerpt;
    if ('text' in citation) return citation.text;
    return '';
  };

  return (
    <motion.button
      className={cn(
        "inline-flex items-center justify-center",
        "rounded font-medium transition-all",
        "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
        "border border-indigo-200 hover:border-indigo-300",
        "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1",
        compact ? "w-5 h-5 text-xs" : "px-1.5 py-0.5 text-xs gap-1",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      title={`Page ${pageNumber}: ${getExcerpt()}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {compact ? (
        index
      ) : (
        <>
          <span className="font-semibold">{index}</span>
          {!compact && pageNumber && (
            <span className="text-indigo-500 text-[10px]">p{pageNumber}</span>
          )}
        </>
      )}
    </motion.button>
  );
};

// ============================================================
// CitationList Component - 显示多个引用
// ============================================================

interface CitationListProps {
  citations: (Citation | SourceCitation)[];
  className?: string;
}

export const CitationList: React.FC<CitationListProps> = ({
  citations,
  className,
}) => {
  if (!citations || citations.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1 mt-2", className)}>
      {citations.map((citation, idx) => (
        <CitationTag
          key={`citation-${idx}`}
          citation={citation}
          index={idx + 1}
          compact
        />
      ))}
    </div>
  );
};

// ============================================================
// Inline Citation - 用于在文本中渲染
// ============================================================

// 根据 detection 类型配置颜色
const CITATION_COLORS: Record<string, { bg: string; hover: string }> = {
  text: { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600' },
  title: { bg: 'bg-violet-500', hover: 'hover:bg-violet-600' },
  sub_title: { bg: 'bg-violet-400', hover: 'hover:bg-violet-500' },
  table: { bg: 'bg-blue-500', hover: 'hover:bg-blue-600' },
  table_caption: { bg: 'bg-blue-400', hover: 'hover:bg-blue-500' },
  equation: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600' },
  image: { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600' },
  image_caption: { bg: 'bg-emerald-400', hover: 'hover:bg-emerald-500' },
  figure: { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600' },
  reference: { bg: 'bg-stone-500', hover: 'hover:bg-stone-600' },
  header: { bg: 'bg-slate-500', hover: 'hover:bg-slate-600' },
  footer: { bg: 'bg-slate-400', hover: 'hover:bg-slate-500' },
  default: { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600' },
};

// 从 detection ID 解析类型 (e.g., "p19_text_2" -> "text")
function parseTypeFromId(id: string): string {
  const match = id.match(/^p\d+_(\w+)_\d+$/);
  return match ? match[1] : 'default';
}

interface InlineCitationProps {
  detectionId: string;
  index: number;
}

export const InlineCitation: React.FC<InlineCitationProps> = ({
  detectionId,
  index,
}) => {
  const { setHoveredCitation, scrollToDetection, getDetection } = useCitationStore();
  const detection = getDetection(detectionId);

  const handleClick = useCallback(() => {
    console.log('[InlineCitation] Clicked:', { index, detectionId, pageNumber: detection?.pageNumber });
    scrollToDetection(detectionId);
  }, [detectionId, scrollToDetection, index, detection?.pageNumber]);

  const pageNumber = detection?.pageNumber || parseInt(detectionId.match(/^p(\d+)_/)?.[1] || '1');
  
  // 获取类型对应的颜色
  const detectionType = detection?.label || parseTypeFromId(detectionId);
  const colors = CITATION_COLORS[detectionType] || CITATION_COLORS.default;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center",
        "w-4 h-4 text-[10px] font-semibold rounded",
        colors.bg, colors.hover,
        "text-white transition-colors cursor-pointer",
        "align-super ml-0.5"
      )}
      onMouseEnter={() => setHoveredCitation(detectionId)}
      onMouseLeave={() => setHoveredCitation(null)}
      onClick={handleClick}
      title={`Page ${pageNumber} (${detectionType})${detection?.text ? `: ${detection.text.slice(0, 50)}...` : ''}`}
    >
      {index}
    </button>
  );
};

export default CitationTag;

