/**
 * Text Block Layer
 * 
 * 文本段落交互层
 * - 显示段落边界
 * - Hover 1秒后自动翻译
 * - 显示翻译气泡
 */

"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages, X, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { PageDetection, Detection } from '@/types/paperContext';
import { 
  translateService, 
  TranslationResult, 
  TargetLanguage, 
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
} from '../../services/translateService';

// ============================================================
// Types
// ============================================================

interface TextBlockLayerProps {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  detections: PageDetection | null;
  /** OCR 图像宽度 (用于坐标转换) */
  ocrImageWidth?: number;
  /** OCR 图像高度 (用于坐标转换) */
  ocrImageHeight?: number;
  isEnabled: boolean;
  className?: string;
  /** 当前目标语言 */
  targetLanguage?: TargetLanguage;
  /** 语言变更回调 */
  onLanguageChange?: (language: TargetLanguage) => void;
}

interface TranslationPopupProps {
  block: MergedTextBlock;
  position: { x: number; y: number; width: number; height: number };
  targetLanguage: TargetLanguage;
  onClose: () => void;
  onLanguageChange: (language: TargetLanguage) => void;
}

// ============================================================
// Constants
// ============================================================

const HOVER_DELAY_MS = 2000; // 2秒后触发翻译
const TEXT_LABELS = ['text', 'title', 'sub_title'] as const;

// 合并阈值 - 基于实际 OCR 数据分析
// 段间距通常 27-53px，行间距(截断) 通常 -1 到 19px
const MERGE_CONFIG = {
  /** 垂直间距阈值 (像素) - 小于此值认为是同一段落被截断 */
  // 只合并非常紧密的行（行间距小于 15px）
  verticalGapThreshold: 15,
  /** 水平重叠比例阈值 - 大于此比例认为在同一列 */
  horizontalOverlapRatio: 0.5,
  /** 最小文本长度 */
  minTextLength: 15,
  /** 最大合并块数 - 防止过度合并 */
  maxMergeCount: 3,
};

// ============================================================
// Merged Text Block Type
// ============================================================

interface MergedTextBlock {
  /** 合并后的唯一ID */
  id: string;
  /** 包含的原始检测块 */
  detections: Detection[];
  /** 合并后的文本 */
  text: string;
  /** 合并后的边界框 (OCR 像素坐标) */
  boundingBox: {
    x1_px: number;
    y1_px: number;
    x2_px: number;
    y2_px: number;
  };
}

// ============================================================
// Helper: 合并相邻文本检测块
// ============================================================

/**
 * 检查两个检测块是否应该合并
 */
function shouldMerge(a: Detection, b: Detection): boolean {
  // 只合并 text 类型
  if (a.label !== 'text' || b.label !== 'text') {
    return false;
  }
  
  const aBox = a.boxes[0];
  const bBox = b.boxes[0];
  if (!aBox || !bBox) return false;
  
  const aY1 = aBox.y1_px ?? aBox.y1;
  const aY2 = aBox.y2_px ?? aBox.y2;
  const aX1 = aBox.x1_px ?? aBox.x1;
  const aX2 = aBox.x2_px ?? aBox.x2;
  
  const bY1 = bBox.y1_px ?? bBox.y1;
  const bY2 = bBox.y2_px ?? bBox.y2;
  const bX1 = bBox.x1_px ?? bBox.x1;
  const bX2 = bBox.x2_px ?? bBox.x2;
  
  // 确定上下关系
  const upper = aY1 < bY1 ? { y1: aY1, y2: aY2, x1: aX1, x2: aX2 } : { y1: bY1, y2: bY2, x1: bX1, x2: bX2 };
  const lower = aY1 < bY1 ? { y1: bY1, y2: bY2, x1: bX1, x2: bX2 } : { y1: aY1, y2: aY2, x1: aX1, x2: aX2 };
  
  // 计算垂直间距
  const verticalGap = lower.y1 - upper.y2;
  
  // 如果间距太大，不合并
  if (verticalGap > MERGE_CONFIG.verticalGapThreshold) {
    return false;
  }
  
  // 如果重叠太多（负间距太大），可能是不同列
  if (verticalGap < -50) {
    return false;
  }
  
  // 计算水平重叠
  const overlapLeft = Math.max(aX1, bX1);
  const overlapRight = Math.min(aX2, bX2);
  const horizontalOverlap = Math.max(0, overlapRight - overlapLeft);
  
  const aWidth = aX2 - aX1;
  const bWidth = bX2 - bX1;
  const minWidth = Math.min(aWidth, bWidth);
  
  // 水平重叠不够
  if (horizontalOverlap < minWidth * MERGE_CONFIG.horizontalOverlapRatio) {
    return false;
  }
  
  return true;
}

/**
 * 创建合并后的文本块
 */
function createMergedBlock(detections: Detection[]): MergedTextBlock {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const det of detections) {
    const box = det.boxes[0];
    if (!box) continue;
    const x1 = box.x1_px ?? box.x1;
    const y1 = box.y1_px ?? box.y1;
    const x2 = box.x2_px ?? box.x2;
    const y2 = box.y2_px ?? box.y2;
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }
  
  // 按 Y 坐标排序后合并文本
  const sortedByY = [...detections].sort((a, b) => {
    const aY = a.boxes[0]?.y1_px ?? a.boxes[0]?.y1 ?? 0;
    const bY = b.boxes[0]?.y1_px ?? b.boxes[0]?.y1 ?? 0;
    return aY - bY;
  });
  
  const combinedText = sortedByY
    .map(d => d.text.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return {
    id: detections.map(d => d.id).join('_'),
    detections,
    text: combinedText,
    boundingBox: {
      x1_px: minX,
      y1_px: minY,
      x2_px: maxX,
      y2_px: maxY,
    },
  };
}

/**
 * 合并相邻的文本检测块
 */
function mergeAdjacentTextBlocks(detections: Detection[]): MergedTextBlock[] {
  if (detections.length === 0) return [];
  
  // 按 Y 坐标排序
  const sorted = [...detections].sort((a, b) => {
    const aY = a.boxes[0]?.y1_px ?? a.boxes[0]?.y1 ?? 0;
    const bY = b.boxes[0]?.y1_px ?? b.boxes[0]?.y1 ?? 0;
    return aY - bY;
  });
  
  const merged: MergedTextBlock[] = [];
  const used = new Set<string>();
  
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    
    const group: Detection[] = [sorted[i]];
    used.add(sorted[i].id);
    
    // 尝试合并后续的检测块（限制最大合并数量）
    for (let j = i + 1; j < sorted.length && group.length < MERGE_CONFIG.maxMergeCount; j++) {
      if (used.has(sorted[j].id)) continue;
      
      // 检查是否可以与组内最后一个元素合并
      const lastInGroup = group[group.length - 1];
      if (shouldMerge(lastInGroup, sorted[j])) {
        group.push(sorted[j]);
        used.add(sorted[j].id);
      } else {
        // 如果不能合并，停止尝试（因为已按 Y 排序）
        break;
      }
    }
    
    merged.push(createMergedBlock(group));
  }
  
  // 过滤掉太短的文本
  return merged.filter(block => block.text.length >= MERGE_CONFIG.minTextLength);
}

// ============================================================
// Translation Popup Component
// ============================================================

const TranslationPopup: React.FC<TranslationPopupProps> = ({
  block,
  position,
  targetLanguage,
  onClose,
  onLanguageChange,
}) => {
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // 加载翻译
  useEffect(() => {
    let cancelled = false;

    const loadTranslation = async () => {
      setIsLoading(true);
      setError(null);

      // 检查缓存
      const cached = translateService.getFromCache(block.text, targetLanguage);
      if (cached) {
        setTranslation(cached);
        setIsLoading(false);
        return;
      }

      try {
        const result = await translateService.translate(block.text, targetLanguage);
        if (!cancelled) {
          setTranslation(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Translation failed');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadTranslation();

    return () => {
      cancelled = true;
    };
  }, [block.text, targetLanguage]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage);

  // 使用原文相同的宽度，或至少 300px
  const popupWidth = Math.max(position.width, 350);

  return (
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed z-[100] overflow-hidden flex flex-col rounded-xl"
      style={{
        left: position.x,
        top: position.y,
        width: popupWidth,
        height: position.height, // 使用原文完整高度
        // 毛玻璃效果
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        // 阴影
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200/60 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-medium text-blue-800">Translation</span>
          {block.detections.length > 1 && (
            <span className="text-[10px] text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">
              {block.detections.length} merged
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageSelect(!showLanguageSelect)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-stone-600 hover:bg-white/50 rounded transition-colors"
            >
              <span>{currentLang?.nativeName}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showLanguageSelect && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-stone-200 py-1 z-10 min-w-[120px]"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      onLanguageChange(lang.code);
                      setShowLanguageSelect(false);
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-xs hover:bg-stone-50 transition-colors flex items-center justify-between",
                      lang.code === targetLanguage && "bg-blue-50 text-blue-700"
                    )}
                  >
                    <span>{lang.nativeName}</span>
                    <span className="text-stone-400">{lang.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            <X className="w-3 h-3 text-stone-500" />
          </button>
        </div>
      </div>

      {/* Content - 使用全部面积显示 */}
      <div className="p-4 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full gap-2 text-stone-500">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="text-sm font-medium">Translating...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-500 bg-red-50/50 p-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : translation ? (
          <p className="text-sm text-stone-700 leading-relaxed font-medium">
            {translation.translatedText}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
};

// ============================================================
// Text Block Overlay Component
// ============================================================

interface TextBlockOverlayProps {
  block: MergedTextBlock;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  ocrImageWidth?: number;
  ocrImageHeight?: number;
  onHoverStart: (block: MergedTextBlock, rect: DOMRect) => void;
  onHoverEnd: () => void;
  isHovered: boolean;
}

const TextBlockOverlay: React.FC<TextBlockOverlayProps> = ({
  block,
  pageWidth,
  pageHeight,
  scale,
  ocrImageWidth,
  ocrImageHeight,
  onHoverStart,
  onHoverEnd,
  isHovered,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 默认 OCR 图像尺寸 (与 ObjectSelectionLayer 保持一致)
  const ocrWidth = ocrImageWidth || 1122;
  const ocrHeight = ocrImageHeight || 1584;

  // 转换比例：将 OCR 像素坐标转换为 PDF 页面坐标
  const scaleX = pageWidth / ocrWidth;
  const scaleY = pageHeight / ocrHeight;

  // 使用合并后的边界框
  const box = block.boundingBox;

  // 转换到渲染坐标
  const x = box.x1_px * scaleX * scale;
  const y = box.y1_px * scaleY * scale;
  const width = (box.x2_px - box.x1_px) * scaleX * scale;
  const height = (box.y2_px - box.y1_px) * scaleY * scale;

  const handleMouseEnter = () => {
    // 清除之前的 timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // 1秒后触发翻译
    hoverTimeoutRef.current = setTimeout(() => {
      if (overlayRef.current) {
        onHoverStart(block, overlayRef.current.getBoundingClientRect());
      }
    }, HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // 不立即关闭，让用户有时间移动到 popup
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className={cn(
        "absolute transition-all duration-200 cursor-pointer pointer-events-auto",
        isHovered
          ? "bg-blue-100/40 border border-blue-400 rounded"
          : "hover:bg-blue-100/20 hover:border hover:border-blue-200/50 hover:rounded"
      )}
      style={{
        left: x,
        top: y,
        width: width,
        height: height,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  );
};

// ============================================================
// Main Component
// ============================================================

export const TextBlockLayer: React.FC<TextBlockLayerProps> = ({
  pageNumber,
  pageWidth,
  pageHeight,
  scale,
  detections,
  ocrImageWidth,
  ocrImageHeight,
  isEnabled,
  className,
  targetLanguage = DEFAULT_LANGUAGE,
  onLanguageChange,
}) => {
  const [activeBlock, setActiveBlock] = useState<MergedTextBlock | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<TargetLanguage>(targetLanguage);

  // 过滤文本类型并智能合并被截断的段落
  const mergedBlocks = useMemo(() => {
    if (!detections?.detections) return [];
    
    // 1. 过滤出文本类型的检测
    const textDetections = detections.detections.filter(d => 
      TEXT_LABELS.includes(d.label as typeof TEXT_LABELS[number]) &&
      d.boxes[0] // 确保有边界框
    );
    
    // 2. 智能合并被截断的段落
    return mergeAdjacentTextBlocks(textDetections);
  }, [detections]);

  const handleHoverStart = useCallback((block: MergedTextBlock, rect: DOMRect) => {
    setActiveBlock(block);
    // 使用原文相同位置
    setPopupPosition({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  const handleHoverEnd = useCallback(() => {
    // 延迟关闭，让用户有时间移动到 popup
  }, []);

  const handleClose = useCallback(() => {
    setActiveBlock(null);
    setPopupPosition(null);
  }, []);

  const handleLanguageChange = useCallback((language: TargetLanguage) => {
    setCurrentLanguage(language);
    onLanguageChange?.(language);
  }, [onLanguageChange]);

  if (!isEnabled || mergedBlocks.length === 0) return null;

  return (
    <>
      {/* Text Block Overlays Container */}
      <div 
        className={cn("text-block-layer absolute inset-0 pointer-events-none", className)}
        style={{
          width: pageWidth * scale,
          height: pageHeight * scale,
          zIndex: 35, // 低于 ObjectSelectionLayer (40) 以免遮挡图片/表格
        }}
      >
        {mergedBlocks.map(block => (
          <TextBlockOverlay
            key={block.id}
            block={block}
            pageWidth={pageWidth}
            pageHeight={pageHeight}
            scale={scale}
            ocrImageWidth={ocrImageWidth}
            ocrImageHeight={ocrImageHeight}
            onHoverStart={handleHoverStart}
            onHoverEnd={handleHoverEnd}
            isHovered={activeBlock?.id === block.id}
          />
        ))}
      </div>

      {/* Translation Popup - Fixed position portal */}
      <AnimatePresence>
        {activeBlock && popupPosition && (
          <TranslationPopup
            key={activeBlock.id}
            block={activeBlock}
            position={popupPosition}
            targetLanguage={currentLanguage}
            onClose={handleClose}
            onLanguageChange={handleLanguageChange}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default TextBlockLayer;
