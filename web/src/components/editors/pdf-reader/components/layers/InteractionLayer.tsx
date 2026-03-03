"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";

interface InteractionLayerProps {
  pageWidth: number;
  pageHeight: number;
  onTextSelect?: (text: string) => void;
  onAreaClick?: (x: number, y: number) => void;
  onAnnotationCreate?: (annotation: {
    type: "highlight" | "note";
    position: { x: number; y: number; width?: number; height?: number };
    content: string;
  }) => void;
  className?: string;
}

interface SelectionArea {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const InteractionLayer: React.FC<InteractionLayerProps> = ({
  pageWidth,
  pageHeight,
  onTextSelect,
  onAreaClick,
  onAnnotationCreate,
  className = "",
}) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionArea, setSelectionArea] = useState<SelectionArea | null>(
    null
  );
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });

  // 处理鼠标点击
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 隐藏上下文菜单
      setShowContextMenu(false);

      onAreaClick?.(x, y);
    },
    [onAreaClick]
  );

  // 处理文本选择
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      onTextSelect?.(selectedText);
    }
  }, [onTextSelect]);

  // 处理鼠标按下（开始区域选择）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      // 左键
      const rect = e.currentTarget.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      setIsSelecting(true);
      setSelectionArea({
        startX,
        startY,
        endX: startX,
        endY: startY,
      });
    }
  }, []);

  // 处理鼠标移动（更新选择区域）
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isSelecting && selectionArea) {
        const rect = e.currentTarget.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        setSelectionArea((prev) =>
          prev
            ? {
                ...prev,
                endX,
                endY,
              }
            : null
        );
      }
    },
    [isSelecting, selectionArea]
  );

  // 处理鼠标释放（完成区域选择）
  const handleMouseUp = useCallback(
    () => {
      if (isSelecting && selectionArea) {
        const minWidth = 10;
        const minHeight = 10;
        const width = Math.abs(selectionArea.endX - selectionArea.startX);
        const height = Math.abs(selectionArea.endY - selectionArea.startY);

        // 如果选择区域足够大，显示创建注释的上下文菜单
        if (width > minWidth && height > minHeight) {
          setContextMenuPosition({
            x: Math.max(selectionArea.startX, selectionArea.endX),
            y: Math.min(selectionArea.startY, selectionArea.endY),
          });
          setShowContextMenu(true);
        }
      }

      setIsSelecting(false);
      handleTextSelection();
    },
    [isSelecting, selectionArea, handleTextSelection]
  );

  // 处理右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setContextMenuPosition({ x, y });
    setShowContextMenu(true);
  }, []);

  // 创建高亮注释
  const createHighlightAnnotation = useCallback(() => {
    if (selectionArea && onAnnotationCreate) {
      const x = Math.min(selectionArea.startX, selectionArea.endX);
      const y = Math.min(selectionArea.startY, selectionArea.endY);
      const width = Math.abs(selectionArea.endX - selectionArea.startX);
      const height = Math.abs(selectionArea.endY - selectionArea.startY);

      onAnnotationCreate({
        type: "highlight",
        position: { x, y, width, height },
        content: 'Highlighted area',
      });
    }

    setShowContextMenu(false);
    setSelectionArea(null);
  }, [selectionArea, onAnnotationCreate]);

  // 创建注释
  const createNoteAnnotation = useCallback(() => {
    if (selectionArea && onAnnotationCreate) {
      const content = prompt("Enter your note content:");
      if (content) {
        onAnnotationCreate({
          type: "note",
          position: {
            x: contextMenuPosition.x,
            y: contextMenuPosition.y,
          },
          content,
        });
      }
    }

    setShowContextMenu(false);
    setSelectionArea(null);
  }, [selectionArea, contextMenuPosition, onAnnotationCreate]);

  // 点击外部关闭上下文菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layerRef.current && !layerRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
        setSelectionArea(null);
      }
    };

    if (showContextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showContextMenu]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowContextMenu(false);
        setSelectionArea(null);
        setIsSelecting(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      ref={layerRef}
      className={`interaction-layer absolute top-0 left-0 ${className}`}
      style={{
        width: pageWidth,
        height: pageHeight,
        zIndex: 10,
        // 使用文本光标，与 TextLayer 保持一致，提升用户体验
        cursor: 'text',
      }}
      data-layer="interaction"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      {/* 选择区域指示器 */}
      {isSelecting && selectionArea && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none"
          style={{
            left: Math.min(selectionArea.startX, selectionArea.endX),
            top: Math.min(selectionArea.startY, selectionArea.endY),
            width: Math.abs(selectionArea.endX - selectionArea.startX),
            height: Math.abs(selectionArea.endY - selectionArea.startY),
          }}
        />
      )}

      {/* 上下文菜单 */}
      {showContextMenu && (
        <div
          className="absolute bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
          style={{
            left: Math.min(contextMenuPosition.x, pageWidth - 150),
            top: Math.min(contextMenuPosition.y, pageHeight - 100),
          }}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
            onClick={createHighlightAnnotation}
          >
            📝 Create Highlight
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
            onClick={createNoteAnnotation}
          >
            💬 Add Note
          </button>
          <hr className="my-1 border-gray-200" />
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setShowContextMenu(false)}
          >
            ❌ Cancel
          </button>
        </div>
      )}
    </div>
  );
};
