'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Page } from 'react-pdf';
import { cn } from '@/lib/utils';

interface Annotation {
  id: string;
  type: 'highlight' | 'note' | 'drawing';
  page: number;
  positions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  content: string;
  timestamp: number;
  color?: string;
}

interface TextLayerProps {
  pageNumber: number;
  scale: number;
  rotation: number;
  pageWidth: number;
  pageHeight: number;
  annotations?: Annotation[];
  onTextSelect?: (selectedText: string, position: { boundingRect: DOMRect; rects: DOMRect[] }) => void;
  className?: string;
}

export const TextLayer: React.FC<TextLayerProps> = ({
  pageNumber,
  scale,
  rotation,
  pageWidth,
  pageHeight,
  annotations = [],
  onTextSelect,
  className = '',
}) => {
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isTextLayerReady, setIsTextLayerReady] = useState(false);

  // 获取选中文本的位置信息
  const getSelectionPosition = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const boundingRect = range.getBoundingClientRect();
    const rects: DOMRect[] = [];

    // 收集所有选中文本片段的位置
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      const clientRects = range.getClientRects();
      for (let j = 0; j < clientRects.length; j++) {
        rects.push(clientRects[j]);
      }
    }

    return {
      boundingRect,
      rects,
    };
  };

  // 处理文本选择
  const handleTextSelection = useCallback((e: MouseEvent) => {
    if (!isTextLayerReady) return;

    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      const position = getSelectionPosition();
      if (position) {
        onTextSelect?.(selectedText, position);
      }
    }
  }, [isTextLayerReady, onTextSelect]);

  // 渲染高亮
  const renderHighlights = useCallback(() => {
    if (!textLayerRef.current || !isTextLayerReady) return null;

    // 只渲染highlight类型的annotations
    const highlightAnnotations = annotations.filter(ann => ann.type === 'highlight');

    return highlightAnnotations.map((annotation) => {
      if (annotation.page !== pageNumber) return null;

      return annotation.positions.map((position, index) => (
        <div
          key={`${annotation.id}-${index}`}
          className="absolute pointer-events-none"
          style={{
            left: position.x,
            top: position.y,
            width: position.width,
            height: position.height,
            backgroundColor: annotation.color || '#ffeb3b',
            opacity: 0.3,
            mixBlendMode: 'multiply',
          }}
        />
      ));
    });
  }, [annotations, pageNumber, isTextLayerReady]);

  // 监听文本层加载完成
  const handleTextLayerRendered = useCallback(() => {
    setIsTextLayerReady(true);
  }, []);

  useEffect(() => {
    const textLayer = textLayerRef.current;
    if (!textLayer) return;

    // 监听文本选择事件
    textLayer.addEventListener('mouseup', handleTextSelection);
    
    // 监听文本层渲染完成事件
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          handleTextLayerRendered();
          observer.disconnect();
          break;
        }
      }
    });

    observer.observe(textLayer, {
      childList: true,
      subtree: true,
    });

    return () => {
      textLayer.removeEventListener('mouseup', handleTextSelection);
      observer.disconnect();
    };
  }, [handleTextSelection, handleTextLayerRendered]);

  return (
    <div
      ref={textLayerRef}
      className={cn(
        'text-layer absolute top-0 left-0 pointer-events-auto select-text',
        className
      )}
      style={{
        width: pageWidth,
        height: pageHeight,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        zIndex: 2,
        // 统一使用文本光标，提升选择体验
        cursor: 'text',
      }}
      data-layer="text"
    >
      <Page
        pageNumber={pageNumber}
        scale={1}
        rotate={rotation}
        className="text-overlay"
        renderAnnotationLayer={false}
        renderTextLayer={true}
        width={pageWidth}
        height={pageHeight}
        onLoadSuccess={() => setIsTextLayerReady(false)}
        onRenderTextLayerSuccess={handleTextLayerRendered}
        loading={null}
        error={null}
      />
      {renderHighlights()}
    </div>
  );
}; 