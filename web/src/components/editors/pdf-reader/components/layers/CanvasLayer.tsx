'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { Page } from 'react-pdf';

interface CanvasLayerProps {
  pageNumber: number;
  scale: number;
  rotation: number;
  onLoadSuccess?: (info: { width: number; height: number }) => void;
  className?: string;
}

export const CanvasLayer: React.FC<CanvasLayerProps> = ({
  pageNumber,
  scale,
  rotation,
  onLoadSuccess,
  className = '',
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // 页面加载成功处理
  const handleLoadSuccess = useCallback((page: any) => {
    const { width, height } = page;
    onLoadSuccess?.({ width, height });
  }, [onLoadSuccess]);

  // 性能优化：使用离屏渲染
  useEffect(() => {
    if (canvasRef.current) {
      // 设置CSS变量以支持硬件加速
      canvasRef.current.style.setProperty('will-change', 'transform');
      canvasRef.current.style.setProperty('transform-style', 'preserve-3d');
    }
  }, []);

  return (
    <div 
      ref={canvasRef}
      className={`canvas-layer relative ${className}`}
      data-layer="canvas"
    >
      <Page
        pageNumber={pageNumber}
        scale={scale}
        rotate={rotation}
        onLoadSuccess={handleLoadSuccess}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        className="pdf-canvas"
        // 性能优化配置
        loading={
          <div className="flex items-center justify-center w-full h-96 bg-gray-50">
            <div className="w-6 h-6 border-2 border-[var(--main-color)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        }
        error={
          <div className="flex items-center justify-center w-full h-96 bg-red-50">
            <p className="text-red-500 text-sm">Failed to render page</p>
          </div>
        }
      />
    </div>
  );
}; 