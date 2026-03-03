"use client";

/**
 * Cross Paper Citation Tag
 * 
 * 显示跨论文的引用标签
 * 支持：显示论文来源、点击跳转、悬浮预览
 */

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ExternalLink, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMultiDocumentStore } from "../../store/multiDocumentStore";
import { useCitationStore } from "../../store/citationStore";
import { Detection, DetectionLabel, getLabelDisplayName } from "@/types/paperContext";

// ============================================================================
// Types
// ============================================================================

interface CrossPaperCitationTagProps {
  /** 论文 ID */
  paperId: string;
  /** 论文标题 */
  paperTitle?: string;
  /** Detection ID */
  detectionId: string;
  /** 页码 */
  pageNumber: number;
  /** Detection 类型 */
  detectionType?: DetectionLabel;
  /** 简短序号显示 */
  displayIndex?: number;
  /** 是否为当前活动文档 */
  isCurrentPaper?: boolean;
  /** 点击回调 */
  onClick?: () => void;
}

// ============================================================================
// Color Configuration
// ============================================================================

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  text: { bg: "bg-stone-100", text: "text-stone-700", border: "border-stone-300" },
  title: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300" },
  sub_title: { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-300" },
  image: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300" },
  figure: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300" },
  table: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  equation: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
  reference: { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-300" },
};

const DEFAULT_COLOR = { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300" };

// ============================================================================
// Component
// ============================================================================

export const CrossPaperCitationTag: React.FC<CrossPaperCitationTagProps> = ({
  paperId,
  paperTitle,
  detectionId,
  pageNumber,
  detectionType,
  displayIndex,
  isCurrentPaper = false,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const { openDocument, setActiveDocument, documents, activeDocumentId } = useMultiDocumentStore();
  const { scrollToDetection } = useCitationStore();

  // 获取颜色配置
  const colors = detectionType ? (TYPE_COLORS[detectionType] || DEFAULT_COLOR) : DEFAULT_COLOR;

  // 处理点击
  const handleClick = useCallback(() => {
    // 如果提供了自定义点击回调，使用它
    if (onClick) {
      onClick();
      return;
    }

    // 检查论文是否已打开
    const isOpen = documents.has(paperId);

    if (isOpen) {
      // 如果已打开，切换到该文档并滚动
      if (activeDocumentId !== paperId) {
        setActiveDocument(paperId);
      }
      
      // 滚动到目标 detection
      setTimeout(() => {
        scrollToDetection(detectionId);
      }, 100);
    } else {
      // 如果未打开，先打开论文
      const source = {
        type: "url" as const,
        path: `/api/ocr/${paperId}/pdf`,
        arxivId: paperId,
      };
      
      openDocument(source);
      
      // 等待文档加载后滚动
      setTimeout(() => {
        scrollToDetection(detectionId);
      }, 500);
    }
  }, [
    onClick,
    paperId,
    detectionId,
    pageNumber,
    documents,
    activeDocumentId,
    openDocument,
    setActiveDocument,
    scrollToDetection,
  ]);

  // 短标题显示
  const shortPaperTitle = paperTitle 
    ? (paperTitle.length > 20 ? paperTitle.slice(0, 20) + "..." : paperTitle)
    : paperId;

  return (
    <span className="inline-flex items-center">
      <motion.button
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium",
          "border transition-all cursor-pointer",
          colors.bg, colors.text, colors.border,
          "hover:shadow-sm hover:scale-[1.02]",
          isCurrentPaper && "ring-1 ring-indigo-400"
        )}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* 类型图标 */}
        {detectionType && (
          <span className="opacity-70">
            {detectionType === "image" || detectionType === "figure" ? "🖼️" :
             detectionType === "table" ? "📊" :
             detectionType === "equation" ? "📐" :
             detectionType === "title" || detectionType === "sub_title" ? "📌" :
             "📝"}
          </span>
        )}
        
        {/* 显示序号或页码 */}
        {displayIndex !== undefined ? (
          <span>{displayIndex}</span>
        ) : (
          <span>p{pageNumber}</span>
        )}

        {/* 跨论文指示器 */}
        {!isCurrentPaper && (
          <ChevronRight className="w-3 h-3 opacity-50" />
        )}
      </motion.button>

      {/* 悬浮提示 */}
      <AnimatePresence>
        {isHovered && !isCurrentPaper && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute z-50 mt-1 px-2 py-1 bg-stone-900 text-white text-xs rounded shadow-lg max-w-xs"
            style={{ transform: "translateY(100%)" }}
          >
            <div className="flex items-center gap-1 mb-1">
              <FileText className="w-3 h-3" />
              <span className="font-medium">{shortPaperTitle}</span>
            </div>
            <div className="text-stone-300">
              Page {pageNumber} • {detectionType ? getLabelDisplayName(detectionType) : "Content"}
            </div>
            <div className="text-stone-400 mt-1 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Click to open
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

export default CrossPaperCitationTag;

