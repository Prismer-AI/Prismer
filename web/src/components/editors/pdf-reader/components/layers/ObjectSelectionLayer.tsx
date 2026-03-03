/**
 * Object Selection Layer
 * 
 * 显示和交互 PDF 中的对象（图像、表格、公式等）
 * 数据来源于 OCR 检测结果
 */

import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Image as ImageIcon, 
  Table2, 
  FunctionSquare, 
  Sparkles,
  ZoomIn,
  Copy,
  BookmarkPlus,
  X,
} from 'lucide-react';
import { useAIStore } from '../../store/aiStore';
import { PageDetection, Detection } from '@/types/paperContext';

// ============================================================
// Types
// ============================================================

interface ObjectSelectionLayerProps {
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
  onObjectClick?: (detection: Detection, position: { x: number; y: number }) => void;
  onExplainObject?: (detection: Detection) => void;
  className?: string;
  /** Paper ID for constructing image paths */
  paperId?: string;
  /** All page detections for calculating image indices */
  allDetections?: PageDetection[];
}

interface ObjectOverlayProps {
  detection: Detection;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  /** OCR 图像宽度 */
  ocrImageWidth?: number;
  /** OCR 图像高度 */
  ocrImageHeight?: number;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (hovered: boolean) => void;
  onClick: (position: { x: number; y: number }) => void;
  onExplain: () => void;
  onExtract: () => void;
  onZoom: () => void;
}

// ============================================================
// Constants
// ============================================================

// 可交互的对象类型 (基于 DetectionLabel) - 包含所有可能的视觉对象类型
const OBJECT_LABELS = [
  'image', 
  'table', 
  'equation', 
  'figure', 
  'chart', 
  'diagram'
] as const;

const LABEL_CONFIG: Record<string, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  extractType: 'figure' | 'table' | 'equation' | 'highlight';
}> = {
  image: {
    icon: <ImageIcon className="w-4 h-4" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50/80',
    borderColor: 'border-emerald-400',
    label: 'Image',
    extractType: 'figure',
  },
  figure: {
    icon: <ImageIcon className="w-4 h-4" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50/80',
    borderColor: 'border-emerald-400',
    label: 'Figure',
    extractType: 'figure',
  },
  chart: {
    icon: <ImageIcon className="w-4 h-4" />,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50/80',
    borderColor: 'border-teal-400',
    label: 'Chart',
    extractType: 'figure',
  },
  diagram: {
    icon: <ImageIcon className="w-4 h-4" />,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50/80',
    borderColor: 'border-cyan-400',
    label: 'Diagram',
    extractType: 'figure',
  },
  table: {
    icon: <Table2 className="w-4 h-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50/80',
    borderColor: 'border-blue-400',
    label: 'Table',
    extractType: 'table',
  },
  equation: {
    icon: <FunctionSquare className="w-4 h-4" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50/80',
    borderColor: 'border-amber-400',
    label: 'Equation',
    extractType: 'equation',
  },
  // Fallback for other types
  default: {
    icon: <ImageIcon className="w-4 h-4" />,
    color: 'text-stone-600',
    bgColor: 'bg-stone-50/80',
    borderColor: 'border-stone-400',
    label: 'Object',
    extractType: 'highlight',
  },
};

// ============================================================
// Object Overlay Component
// ============================================================

const ObjectOverlay: React.FC<ObjectOverlayProps> = ({
  detection,
  pageNumber,
  pageWidth,
  pageHeight,
  scale,
  ocrImageWidth,
  ocrImageHeight,
  isHovered,
  isSelected,
  onHover,
  onClick,
  onExplain,
  onExtract,
  onZoom,
}) => {
  const box = detection.boxes[0];
  if (!box) return null;

  const config = LABEL_CONFIG[detection.label] || LABEL_CONFIG.image;
  
  // OCR 像素坐标 -> PDF 页面坐标 -> 屏幕坐标
  // OCR 图像尺寸 (e.g., 1224x1584 at 144 DPI) -> PDF 页面尺寸 (e.g., 612x792 at 72 DPI)
  const ocrWidth = ocrImageWidth || 1224; // 默认值
  const ocrHeight = ocrImageHeight || 1584;
  
  // 转换比例：将 OCR 像素坐标转换为 PDF 页面坐标
  const scaleX = pageWidth / ocrWidth;
  const scaleY = pageHeight / ocrHeight;
  
  // 使用 OCR 像素坐标，转换到 PDF 页面坐标，再乘以渲染比例
  const ocrX1 = box.x1_px ?? box.x1;
  const ocrY1 = box.y1_px ?? box.y1;
  const ocrX2 = box.x2_px ?? box.x2;
  const ocrY2 = box.y2_px ?? box.y2;
  
  const left = ocrX1 * scaleX * scale;
  const top = ocrY1 * scaleY * scale;
  const width = (ocrX2 - ocrX1) * scaleX * scale;
  const height = (ocrY2 - ocrY1) * scaleY * scale;
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick({ x: e.clientX, y: e.clientY });
  }, [onClick]);

  const handleExplain = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onExplain();
  }, [onExplain]);

  // 获取非常淡的填充色 (仅用于 isSelected 状态)
  const getLightBgColor = () => {
    switch (detection.label) {
      case 'image': return 'rgba(16, 185, 129, 0.08)'; // emerald
      case 'table': return 'rgba(59, 130, 246, 0.08)'; // blue
      case 'equation': return 'rgba(245, 158, 11, 0.08)'; // amber
      default: return 'rgba(120, 113, 108, 0.08)'; // stone
    }
  };

  return (
    <div
      className={cn(
        'absolute transition-all duration-200 cursor-pointer pointer-events-auto',
        'border-2 rounded-sm',
        // hover: 虚线边框，不填充
        // selected: 实线边框 + 非常淡的填充
        isSelected
          ? config.borderColor
          : isHovered
            ? `border-dashed ${config.borderColor}`
            : 'border-dashed border-indigo-400/60 hover:border-indigo-500/80',
      )}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        // 只有选中时才有填充
        backgroundColor: isSelected ? getLightBgColor() : 'transparent',
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => {
        // 如果已选中，不在 mouse leave 时取消 hover 状态（让操作面板保持）
        if (!isSelected) {
          onHover(false);
        }
      }}
      onClick={handleClick}
      data-object-id={`${detection.label}-${detection.boxes[0]?.x1}-${detection.boxes[0]?.y1}`}
      data-object-overlay="true"
    >
      {/* Label Badge - hover 或 selected 时显示 */}
      {(isHovered || isSelected) && (
        <div
          className={cn(
            'absolute -top-7 left-0',
            'flex items-center gap-1.5 px-2 py-1 rounded-t-md',
            'text-xs font-medium whitespace-nowrap',
            'bg-white/95 backdrop-blur-sm',
            config.color, 'border', config.borderColor,
            'shadow-sm'
          )}
        >
          {config.icon}
          <span>{config.label}</span>
        </div>
      )}

      {/* Action Buttons - 只有 selected 时显示，点击其他地方才消失 */}
      {isSelected && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-stone-200 z-[100]">
          <button
            onClick={handleExplain}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md',
              'text-xs font-medium',
              'bg-indigo-600 text-white',
              'hover:bg-indigo-700 transition-colors'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Explain
          </button>
          {/* Zoom 按钮 - 只对图片类型有效，公式/表格不显示 */}
          {['image', 'figure', 'chart', 'diagram'].includes(detection.label) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onZoom();
              }}
              className={cn(
                'p-1.5 rounded-md',
                'bg-stone-100 border border-stone-200',
                'hover:bg-stone-200 transition-colors'
              )}
              title="Zoom"
            >
              <ZoomIn className="w-4 h-4 text-stone-600" />
            </button>
          )}
          {/* Add to Notes 按钮 - 当前禁用，显示为灰色 */}
          <button
            disabled
            className={cn(
              'p-1.5 rounded-md',
              'bg-stone-50 border border-stone-100',
              'cursor-not-allowed opacity-50'
            )}
            title="Add to notes (coming soon)"
          >
            <BookmarkPlus className="w-4 h-4 text-stone-400" />
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const ObjectSelectionLayer: React.FC<ObjectSelectionLayerProps> = ({
  pageNumber,
  pageWidth,
  pageHeight,
  scale,
  detections,
  ocrImageWidth,
  ocrImageHeight,
  isEnabled,
  onObjectClick,
  onExplainObject,
  className,
  paperId,
  allDetections = [],
}) => {
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  
  const { setRightPanelTab, setPendingQuestion, addExtract } = useAIStore();

  // 全局点击监听器 - 点击其他地方时清除选中状态
  useEffect(() => {
    if (!selectedObjectId) return;
    
    const handleGlobalClick = (e: MouseEvent) => {
      // 检查点击目标是否在当前层内
      const target = e.target as HTMLElement;
      const isInObjectLayer = target.closest('[data-object-selection-layer]');
      const isInObjectOverlay = target.closest('[data-object-overlay]');
      
      // 如果点击不在对象覆盖层内，清除选中
      if (!isInObjectOverlay) {
        setSelectedObjectId(null);
      }
    };
    
    // 使用 capture 阶段确保我们能捕获到事件
    document.addEventListener('mousedown', handleGlobalClick, true);
    
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick, true);
    };
  }, [selectedObjectId]);

  // 过滤出当前页面的对象（图像、表格等）
  const objectDetections = useMemo(() => {
    if (!detections || detections.page_number !== pageNumber) {
      return [];
    }
    
    // 过滤出可交互的对象类型
    return detections.detections.filter(d => 
      OBJECT_LABELS.some(label => d.label === label)
    );
  }, [detections, pageNumber]);

  const getObjectId = useCallback((detection: Detection) => {
    const box = detection.boxes[0];
    return `${detection.label}-${box?.x1}-${box?.y1}`;
  }, []);

  const handleObjectHover = useCallback((detection: Detection, hovered: boolean) => {
    setHoveredObjectId(hovered ? getObjectId(detection) : null);
  }, [getObjectId]);

  const handleObjectClick = useCallback((detection: Detection, position: { x: number; y: number }) => {
    const objectId = getObjectId(detection);
    // 如果点击已选中的对象，则取消选中；否则选中新对象
    if (selectedObjectId === objectId) {
      setSelectedObjectId(null);
    } else {
      setSelectedObjectId(objectId);
    }
    onObjectClick?.(detection, position);
  }, [getObjectId, selectedObjectId, onObjectClick]);

  // 点击容器空白区域时取消选中
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // 只有当点击的是容器本身时才取消选中
    if (e.target === e.currentTarget) {
      setSelectedObjectId(null);
    }
  }, []);

  // 构建图片 URL - 直接使用 detection.id
  const buildImageUrl = useCallback((detection: Detection): string => {
    if (!paperId) return '';
    
    // 使用 API 路由获取图片，格式: /api/ocr/{arxivId}/images/{detection.id}.jpg
    // detection.id 格式示例: "p1_image_0"
    if (detection.id) {
      return `/api/ocr/${paperId}/images/${detection.id}.jpg`;
    }
    
    // Fallback: 尝试从 metadata 获取
    if (detection.metadata?.image_path) {
      return `/api/ocr/${paperId}/${detection.metadata.image_path}`;
    }
    
    return '';
  }, [paperId]);

  const handleExplainObject = useCallback((detection: Detection) => {
    // 生成解释请求
    const labelName = LABEL_CONFIG[detection.label]?.label || detection.label;
    const question = `Please explain this ${labelName.toLowerCase()} on page ${pageNumber}. What does it show and why is it important to the paper?`;
    
    // 设置待发送问题并切换到 chat 面板
    // AskPaperChat 组件会监听 pendingQuestion 并自动发送
    setPendingQuestion(question);
    setRightPanelTab('chat');
    
    onExplainObject?.(detection);
  }, [pageNumber, setPendingQuestion, setRightPanelTab, onExplainObject]);

  // 放大查看对象 (图片/表格)
  const handleZoomObject = useCallback((detection: Detection) => {
    // 对于图片类型，显示放大视图
    if (['image', 'figure', 'chart', 'diagram'].includes(detection.label)) {
      const imageUrl = buildImageUrl(detection);
      if (imageUrl) {
        setZoomedImageUrl(imageUrl);
      }
    }
    // TODO: 对于表格/公式，可以考虑显示更详细的预览
  }, [buildImageUrl]);

  // 提取对象到 Notes
  const handleExtractObject = useCallback((detection: Detection) => {
    const config = LABEL_CONFIG[detection.label] || LABEL_CONFIG.default;
    const labelName = config.label;
    const extractType = config.extractType;
    const box = detection.boxes[0];
    
    // 使用 raw_text 或 metadata 中的信息
    const rawText = detection.raw_text || '';
    
    // 根据类型创建不同格式的内容
    let content = '';
    
    switch (extractType) {
      case 'table':
        // 表格：使用原始文本或markdown格式
        content = rawText || `[Table from Page ${pageNumber}]`;
        break;
      case 'equation':
        // 公式：使用 LaTeX 格式
        content = rawText || `[Equation from Page ${pageNumber}]`;
        break;
      case 'figure':
        // 图片：构建实际的图片路径
        const imagePath = buildImageUrl(detection);
        // 使用 markdown 图片格式
        content = imagePath 
          ? `![${labelName} from Page ${pageNumber}](${imagePath})`
          : `[${labelName} from Page ${pageNumber}]`;
        break;
      default:
        content = rawText || `[${labelName} from Page ${pageNumber}]`;
    }
    
    // 添加到 extracts
    addExtract({
      type: extractType,
      content: content,
      source: {
        id: `object-${Date.now()}`,
        text: `${labelName} on page ${pageNumber}`,
        pageNumber: pageNumber,
        confidence: 1.0,
      },
      tags: [detection.label],
    });
    
    // 切换到 Notes 面板
    setRightPanelTab('notes');
    
    // 清除选中状态
    setSelectedObjectId(null);
  }, [pageNumber, addExtract, setRightPanelTab, buildImageUrl]);

  if (!isEnabled || objectDetections.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          'absolute inset-0 pointer-events-none',
          className
        )}
        style={{
          width: pageWidth * scale,
          height: pageHeight * scale,
          zIndex: 40, // 确保在 PDF 内容之上，高于 textLayer (z-index: 2)
        }}
        onClick={handleContainerClick}
      >
        {objectDetections.map((detection, index) => {
          const objectId = getObjectId(detection);
          return (
            <ObjectOverlay
              key={`${objectId}-${index}`}
              detection={detection}
              pageNumber={pageNumber}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              scale={scale}
              ocrImageWidth={ocrImageWidth}
              ocrImageHeight={ocrImageHeight}
              isHovered={hoveredObjectId === objectId}
              isSelected={selectedObjectId === objectId}
              onHover={(hovered) => handleObjectHover(detection, hovered)}
              onClick={(pos) => handleObjectClick(detection, pos)}
              onExplain={() => handleExplainObject(detection)}
              onExtract={() => handleExtractObject(detection)}
              onZoom={() => handleZoomObject(detection)}
            />
          );
        })}
      </div>

      {/* 图片放大预览模态框 */}
      {zoomedImageUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] pointer-events-auto"
          onClick={() => setZoomedImageUrl(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setZoomedImageUrl(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <img
              src={zoomedImageUrl}
              alt="Zoomed view"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ObjectSelectionLayer;

