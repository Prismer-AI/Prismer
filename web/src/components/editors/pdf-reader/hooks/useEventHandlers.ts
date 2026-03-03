import { useState, useCallback, useRef, useEffect } from "react";

interface EventHandlersParams {
  paperId: string | number;
  pageNumber: number;
  scale: number;
  numPages: number;
  // 新的模式感知翻页函数
  goToPrevPage: () => void;
  goToNextPage: () => void;
  canGoToPrev: boolean;
  canGoToNext: boolean;
  setScale: (scale: number) => void;
}

export const useEventHandlers = ({
  paperId,
  pageNumber,
  scale,
  numPages,
  goToPrevPage,
  goToNextPage,
  canGoToPrev,
  canGoToNext,
  setScale,
}: EventHandlersParams) => {
  const [hoveredWord, setHoveredWord] = useState<{
    text: string;
    position: { x: number; y: number };
  } | null>(null);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    position: { x: number; y: number };
  } | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 辅助函数：从选择范围中找到页面号
  const findPageFromSelection = useCallback((range: Range): number | null => {
    // 获取选择范围的公共祖先容器
    let container = range.commonAncestorContainer;

    // 如果是文本节点，向上找到元素节点
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement!;
    }

    // 向上遍历DOM树，找到包含data-page-number的元素
    let current = container as HTMLElement;
    while (current && current !== document.body) {
      if (current.hasAttribute && current.hasAttribute("data-page-number")) {
        const pageNum = parseInt(
          current.getAttribute("data-page-number") || "0",
          10
        );
        return pageNum > 0 ? pageNum : null;
      }

      // 检查父元素中是否有页面容器
      const pageContainer = current.closest(
        "[data-page-number]"
      ) as HTMLElement;
      if (pageContainer) {
        const pageNum = parseInt(
          pageContainer.getAttribute("data-page-number") || "0",
          10
        );
        return pageNum > 0 ? pageNum : null;
      }

      current = current.parentElement!;
    }

    // 如果找不到，尝试通过位置推算（适用于某些边缘情况）
    const rect = range.getBoundingClientRect();
    const elements = document.elementsFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );

    for (const element of elements) {
      const pageContainer = element.closest(
        "[data-page-number]"
      ) as HTMLElement;
      if (pageContainer) {
        const pageNum = parseInt(
          pageContainer.getAttribute("data-page-number") || "0",
          10
        );
        return pageNum > 0 ? pageNum : null;
      }
    }

    return null;
  }, []);

  // 处理文本选择
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0);

      // 检查选择的文本是否来自PDF内容区域
      const pageNumber = findPageFromSelection(range);
      if (!pageNumber) {
        // 如果选择的文本不在PDF区域内，清除选择状态
        setSelectedText(null);
        return;
      }

      const rect = range.getBoundingClientRect();

      setSelectedText({
        text: selection.toString().trim(),
        position: {
          x: rect.left + window.scrollX,
          y: rect.bottom + window.scrollY + 10,
        },
      });
    } else {
      setSelectedText(null);
    }
  }, [findPageFromSelection]);

  // 处理键盘快捷键
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 如果用户正在输入，不处理快捷键
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // 如果是搜索相关的快捷键，让搜索hook处理
      if (e.ctrlKey && e.key === "f") {
        return; // 让usePDFSearch处理
      }
      if (
        e.key === "[" ||
        e.key === "<" ||
        e.key === "]" ||
        e.key === ">" ||
        e.key === "Escape"
      ) {
        return; // 让usePDFSearch处理
      }

      // 左右方向键翻页 - 使用模式感知的翻页函数
      if (e.key === "ArrowLeft" && canGoToPrev) {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === "ArrowRight" && canGoToNext) {
        e.preventDefault();
        goToNextPage();
      }

      // Shift + + 放大，Shift + - 缩小
      if (e.shiftKey) {
        // 放大：处理 Shift + = (通常是 +)
        if (e.key === "+" || e.key === "=" || e.code === "Equal") {
          e.preventDefault();
          const newScale = Math.min(2.0, scale + 0.1);
          setScale(newScale);
        }
        // 缩小：处理 Shift + - (或 _)
        else if (e.key === "-" || e.key === "_" || e.code === "Minus") {
          e.preventDefault();
          const newScale = Math.max(0.5, scale - 0.1);
          setScale(newScale);
        }
      }
    },
    [scale, canGoToPrev, canGoToNext, goToPrevPage, goToNextPage, setScale]
  );

  // 监听文本选择事件
  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelection);
    return () => document.removeEventListener("mouseup", handleTextSelection);
  }, [handleTextSelection]);

  // 添加和移除键盘事件监听器
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    hoveredWord,
    selectedText,
    hoverTimerRef,
    setHoveredWord,
    setSelectedText,
    handleTextSelection,
    handleKeyDown,
  };
};
