import { useState, useEffect, useMemo } from "react";
import { ReadingMode } from "../components/PDFToolbar";

interface LayoutCalculationParams {
  scale: number;
  originalPageSize: { width: number; height: number };
  isTagPanelOpen: boolean;
  isNotesPanelOpen: boolean;
  isGraphPanelOpen: boolean;
  isIndexPanelOpen: boolean;
  rightPanelWidth: number;
  leftPanelWidth: number;
  readingMode: ReadingMode;
}

interface LayoutResult {
  windowWidth: number;
  availableContentWidth: number;
  currentPdfWidth: number;
  spaceNeeded: number;
  needsCompression: boolean;
  rightMargin: number;
  leftMargin: number;
  maxPdfContainerWidth: number;
}

export const useLayoutCalculation = ({
  scale,
  originalPageSize,
  isTagPanelOpen,
  isNotesPanelOpen,
  isGraphPanelOpen,
  rightPanelWidth,
  isIndexPanelOpen,
  leftPanelWidth,
  readingMode,
}: LayoutCalculationParams): LayoutResult => {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 智能挤压策略计算
  const layoutCalculation = useMemo(() => {
    const isAnyRightPanelOpen =
      isTagPanelOpen || isNotesPanelOpen || isGraphPanelOpen;
    const isAnyLeftPanelOpen = isIndexPanelOpen;

    // 计算各组件的实际宽度和位置
    const containerPadding = 32; // 页面左右padding (16px * 2)
    const minGap = 32; // 右侧面板和PDF之间的最小间距

    // 计算PDF内容区域的可用空间
    const availableContentWidth = windowWidth - containerPadding;
    const rightPanelTotalWidth = isAnyRightPanelOpen ? rightPanelWidth : 0;
    const leftPanelTotalWidth = isAnyLeftPanelOpen ? leftPanelWidth : 0;

    // 根据阅读模式计算PDF内容的实际宽度
    let currentPdfWidth: number;
    switch (readingMode) {
      case "single":
      case "continuous":
        currentPdfWidth = originalPageSize.width * scale;
        break;
      case "double":
        // 双页模式：两个页面的宽度 + 页面间距
        const doublePageGap = 16; // 双页之间的间距
        currentPdfWidth = originalPageSize.width * scale * 2 + doublePageGap;
        break;
      default:
        currentPdfWidth = originalPageSize.width * scale;
    }

    // 判断是否需要挤压：当左侧面板 + 右侧面板 + 最小间隙 + PDF当前宽度 > 可用空间时
    const spaceNeeded =
      leftPanelTotalWidth + rightPanelTotalWidth + minGap + currentPdfWidth;
    const needsCompression =
      (isAnyRightPanelOpen || isAnyLeftPanelOpen) && spaceNeeded > availableContentWidth;

    // 计算实际的右边距
    const rightMargin = isAnyRightPanelOpen 
      ? (needsCompression ? rightPanelTotalWidth + minGap : rightPanelTotalWidth + minGap)
      : 0;
    // 计算实际的左边距  
    const leftMargin = isAnyLeftPanelOpen
      ? (needsCompression ? leftPanelTotalWidth + minGap : leftPanelTotalWidth + minGap)
      : 0;

    // 计算PDF容器的最大宽度
    const maxPdfContainerWidth = needsCompression
      ? availableContentWidth -
        rightPanelTotalWidth -
        leftPanelTotalWidth -
        minGap
      : availableContentWidth;

    return {
      windowWidth,
      availableContentWidth,
      currentPdfWidth,
      spaceNeeded,
      needsCompression,
      rightMargin,
      leftMargin,
      maxPdfContainerWidth,
    };
  }, [
    windowWidth,
    scale,
    originalPageSize,
    isTagPanelOpen,
    isNotesPanelOpen,
    isGraphPanelOpen,
    rightPanelWidth,
    leftPanelWidth,
    isIndexPanelOpen,
    readingMode,
  ]);

  return layoutCalculation;
};
