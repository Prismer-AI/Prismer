/**
 * CitationPopover Component
 * 
 * 悬停时显示引用内容预览
 * 支持从 CitationStore 获取检测数据
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCitationStore, FlatDetection } from '../../store/citationStore';
import { cn } from '@/lib/utils';
import { FileText, Image, Table2, Calculator, ArrowRight, ExternalLink } from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface CitationPopoverProps {
  /** Detection ID */
  detectionId: string;
  /** 触发元素 */
  children: React.ReactNode;
  /** 弹出位置 */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** 延迟显示 (ms) */
  delay?: number;
  /** 自定义类名 */
  className?: string;
}

// ============================================================
// Helper Functions
// ============================================================

const getLabelIcon = (label: string) => {
  switch (label) {
    case 'image':
    case 'figure':
      return <Image className="w-3.5 h-3.5" />;
    case 'table':
      return <Table2 className="w-3.5 h-3.5" />;
    case 'equation':
      return <Calculator className="w-3.5 h-3.5" />;
    default:
      return <FileText className="w-3.5 h-3.5" />;
  }
};

const getLabelColor = (label: string) => {
  switch (label) {
    case 'title':
    case 'sub_title':
      return 'text-blue-600 bg-blue-50';
    case 'image':
    case 'figure':
      return 'text-amber-600 bg-amber-50';
    case 'table':
      return 'text-green-600 bg-green-50';
    case 'equation':
      return 'text-purple-600 bg-purple-50';
    default:
      return 'text-stone-600 bg-stone-50';
  }
};

const formatLabel = (label: string) => {
  return label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// ============================================================
// Component
// ============================================================

export const CitationPopover: React.FC<CitationPopoverProps> = ({
  detectionId,
  children,
  side = 'top',
  delay = 300,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [detection, setDetection] = useState<FlatDetection | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { getDetection, scrollToDetection, setHoveredCitation } = useCitationStore();

  // 获取检测数据
  useEffect(() => {
    const det = getDetection(detectionId);
    setDetection(det || null);
  }, [detectionId, getDetection]);

  // 处理鼠标进入
  const handleMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
      setHoveredCitation(detectionId);
    }, delay);
  }, [delay, detectionId, setHoveredCitation]);

  // 处理鼠标离开
  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(false);
    setHoveredCitation(null);
  }, [setHoveredCitation]);

  // 处理点击跳转
  const handleNavigate = useCallback(() => {
    scrollToDetection(detectionId);
    setIsOpen(false);
  }, [detectionId, scrollToDetection]);

  // 清理 timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 计算弹出位置
  const getPositionClasses = () => {
    switch (side) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  // 动画变体
  const variants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: side === 'top' ? 4 : side === 'bottom' ? -4 : 0,
      x: side === 'left' ? 4 : side === 'right' ? -4 : 0,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      x: 0,
    },
  };

  return (
    <div 
      className={cn("relative inline-flex", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      <AnimatePresence>
        {isOpen && detection && (
          <motion.div
            className={cn(
              "absolute z-50 w-72",
              getPositionClasses()
            )}
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.15 }}
          >
            <div className="bg-white rounded-lg shadow-xl border border-stone-200 overflow-hidden">
              {/* 头部 */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 border-b border-stone-100",
                getLabelColor(detection.label)
              )}>
                {getLabelIcon(detection.label)}
                <span className="text-xs font-medium">
                  {formatLabel(detection.label)}
                </span>
                <span className="text-xs opacity-70">
                  Page {detection.pageNumber}
                </span>
                <span className="flex-1" />
                <span className="text-[10px] font-mono opacity-50">
                  {detection.id}
                </span>
              </div>
              
              {/* 内容预览 */}
              <div className="p-3 max-h-40 overflow-y-auto">
                {detection.label === 'equation' ? (
                  <pre className="text-xs font-mono text-stone-700 whitespace-pre-wrap break-all bg-stone-50 p-2 rounded">
                    {detection.text.slice(0, 300)}
                    {detection.text.length > 300 && '...'}
                  </pre>
                ) : detection.label === 'table' ? (
                  <div className="text-xs text-stone-600 italic">
                    <Table2 className="w-8 h-8 mx-auto mb-2 text-stone-400" />
                    <p className="text-center">Table content</p>
                    {detection.metadata?.caption && (
                      <p className="mt-2 text-stone-700 not-italic">
                        {detection.metadata.caption}
                      </p>
                    )}
                  </div>
                ) : detection.label === 'image' || detection.label === 'figure' ? (
                  <div className="text-xs text-stone-600">
                    {detection.metadata?.image_path ? (
                      <div className="text-center">
                        <Image className="w-8 h-8 mx-auto mb-2 text-stone-400" />
                        <p className="text-[10px] font-mono text-stone-400">
                          {detection.metadata.image_path}
                        </p>
                      </div>
                    ) : (
                      <p className="text-center italic">Figure</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {detection.text.slice(0, 200)}
                    {detection.text.length > 200 && '...'}
                  </p>
                )}
              </div>
              
              {/* 操作按钮 */}
              <div className="px-3 py-2 bg-stone-50 border-t border-stone-100">
                <button
                  onClick={handleNavigate}
                  className={cn(
                    "w-full flex items-center justify-center gap-2",
                    "px-3 py-1.5 rounded text-xs font-medium",
                    "bg-indigo-500 text-white hover:bg-indigo-600",
                    "transition-colors"
                  )}
                >
                  <ExternalLink className="w-3 h-3" />
                  Go to source
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CitationPopover;
