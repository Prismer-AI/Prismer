/**
 * usePageNavigation - 统一的页面导航 Hook
 * 
 * 解决的问题：
 * 1. 双页模式下键盘翻页需要点击两次的 bug
 * 2. 不同导航方式语义不一致的问题
 * 3. 页码状态在不同阅读模式下的规范化
 * 
 * 核心原则：
 * - 双页模式下 pageNumber 始终为奇数（左页页码）
 * - 所有导航方法都是模式感知的
 * - 提供统一的 API 给所有调用方
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

export type ReadingMode = 'single' | 'continuous' | 'double';

export interface PageNavigationAPI {
  // 状态
  pageNumber: number;
  
  // 核心导航方法
  goToPage: (targetPage: number) => void;
  goToPrevPage: () => void;
  goToNextPage: () => void;
  
  // 直接设置（兼容旧 API）
  setPageNumber: (page: number) => void;
  
  // 辅助方法
  normalizePageNumber: (page: number) => number;
  getDisplayedPages: () => number[];
  canGoToPrev: boolean;
  canGoToNext: boolean;
}

export function usePageNavigation(
  numPages: number,
  readingMode: ReadingMode,
  initialPage: number = 1
): PageNavigationAPI {
  const [pageNumber, setPageNumberInternal] = useState(initialPage);

  /**
   * 规范化页码
   * - 确保在有效范围内 [1, numPages]
   * - 双页模式下确保是奇数（左页）
   */
  const normalizePageNumber = useCallback((page: number): number => {
    // 边界检查
    if (numPages <= 0) return 1;
    const clamped = Math.max(1, Math.min(page, numPages));
    
    // 双页模式：确保是奇数（左页）
    if (readingMode === 'double' && clamped % 2 === 0 && clamped > 1) {
      return clamped - 1;
    }
    
    return clamped;
  }, [readingMode, numPages]);

  /**
   * 跳转到指定页（自动规范化）
   * 这是所有页面导航的统一入口
   */
  const goToPage = useCallback((targetPage: number) => {
    const normalized = normalizePageNumber(targetPage);
    setPageNumberInternal(normalized);
  }, [normalizePageNumber]);

  /**
   * 上一页（模式感知）
   * - 单页/连续模式：-1
   * - 双页模式：-2
   */
  const goToPrevPage = useCallback(() => {
    setPageNumberInternal(prev => {
      const step = readingMode === 'double' ? 2 : 1;
      const newPage = prev - step;
      return normalizePageNumber(newPage);
    });
  }, [readingMode, normalizePageNumber]);

  /**
   * 下一页（模式感知）
   * - 单页/连续模式：+1
   * - 双页模式：+2
   */
  const goToNextPage = useCallback(() => {
    setPageNumberInternal(prev => {
      const step = readingMode === 'double' ? 2 : 1;
      const newPage = prev + step;
      return normalizePageNumber(newPage);
    });
  }, [readingMode, normalizePageNumber]);

  /**
   * 获取当前显示的页面列表
   * - 单页/连续模式：[pageNumber]
   * - 双页模式：[leftPage, rightPage] 或 [leftPage]（如果是最后一页）
   */
  const getDisplayedPages = useCallback((): number[] => {
    if (readingMode === 'double') {
      const leftPage = pageNumber;
      const rightPage = pageNumber + 1;
      if (rightPage <= numPages) {
        return [leftPage, rightPage];
      }
      return [leftPage];
    }
    return [pageNumber];
  }, [readingMode, pageNumber, numPages]);

  /**
   * 是否可以向前翻页
   */
  const canGoToPrev = useMemo(() => {
    return pageNumber > 1;
  }, [pageNumber]);

  /**
   * 是否可以向后翻页
   */
  const canGoToNext = useMemo(() => {
    if (readingMode === 'double') {
      // 双页模式：检查右页之后是否还有页面
      return pageNumber + 2 <= numPages;
    }
    return pageNumber < numPages;
  }, [pageNumber, numPages, readingMode]);

  /**
   * 当阅读模式变化时，规范化当前页码
   * 例如：从单页模式切换到双页模式时，如果当前是偶数页，需要调整为奇数
   */
  useEffect(() => {
    const normalized = normalizePageNumber(pageNumber);
    if (normalized !== pageNumber) {
      setPageNumberInternal(normalized);
    }
  }, [readingMode, normalizePageNumber, pageNumber]);

  /**
   * 当 numPages 变化时（例如 PDF 加载完成），确保页码有效
   */
  useEffect(() => {
    if (numPages > 0 && pageNumber > numPages) {
      setPageNumberInternal(normalizePageNumber(numPages));
    }
  }, [numPages, pageNumber, normalizePageNumber]);

  return {
    pageNumber,
    goToPage,
    goToPrevPage,
    goToNextPage,
    setPageNumber: goToPage, // 兼容旧 API
    normalizePageNumber,
    getDisplayedPages,
    canGoToPrev,
    canGoToNext,
  };
}

export default usePageNavigation;
