"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";

/**
 * CustomSelectionLayer - 智能文本选择层
 * 
 * 解决 PDF.js 原生文本选择的问题：
 * 1. 从空白处开始选择时产生"反选"（选择了不想要的内容）
 * 2. 选择方向与视觉方向不一致
 * 
 * 工作原理：
 * 1. 在 TextLayer 上方覆盖一个透明层
 * 2. 智能检测用户意图：
 *    - 如果点击在交互式元素上（annotation, image, table），让事件穿透
 *    - 如果点击在空白处或文本上，启动文本选择
 * 3. 使用 Range API 程序化地创建选择（精确到字符级别）
 * 
 * 兼容性设计：
 * - 支持与 AnnotationLayer 交互（点击高亮）
 * - 支持与 SentenceLayer 交互（句子选择）
 * - 预留与 ImageLayer/TableLayer 的交互（TODO）
 */

// 交互式元素的选择器列表
const INTERACTIVE_SELECTORS = [
  '[data-annotation-id]',     // 标注元素
  '[data-sentence-id]',       // 句子元素
  '[data-image-id]',          // 图像元素（预留）
  '[data-table-id]',          // 表格元素（预留）
  '.annotation-item',         // 标注项
  '.sentence-box',            // 句子框
  '.interactive-element',     // 通用交互元素
  '.linkAnnotation',          // PDF 内部链接（页面跳转、外部链接）
  '.linkAnnotation a',        // PDF 链接的 anchor 元素
  '.internalLink',            // PDF.js 内部链接
  'a[data-internal-link]',    // 内部链接标记
];

interface SelectionArea {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface CustomSelectionLayerProps {
  pageWidth: number;
  pageHeight: number;
  scale: number;
  textLayerRef: React.RefObject<HTMLDivElement>;
  onTextSelect?: (text: string, position: { boundingRect: DOMRect; rects: DOMRect[] }) => void;
  className?: string;
}

export const CustomSelectionLayer: React.FC<CustomSelectionLayerProps> = ({
  pageWidth,
  pageHeight,
  scale,
  textLayerRef,
  onTextSelect,
  className = "",
}) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionArea, setSelectionArea] = useState<SelectionArea | null>(null);
  // 记录绝对坐标的起点和终点
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const endPointRef = useRef<{ x: number; y: number } | null>(null);

  // 获取所有文本 span 元素及其位置
  const getTextSpans = useCallback(() => {
    if (!textLayerRef.current) return [];
    
    // 查找 .textLayer 中的所有 span
    const textLayer = textLayerRef.current.querySelector('.textLayer');
    if (!textLayer) return [];
    
    const spans = textLayer.querySelectorAll('span');
    const spanInfos: Array<{
      element: HTMLSpanElement;
      rect: DOMRect;
      text: string;
    }> = [];
    
    spans.forEach((span) => {
      const text = span.textContent || '';
      if (text.trim()) {
        const rect = span.getBoundingClientRect();
        spanInfos.push({ element: span as HTMLSpanElement, rect, text });
      }
    });
    
    return spanInfos;
  }, [textLayerRef]);

  // 检查矩形是否与选择区域相交
  const isRectIntersecting = useCallback((
    rect: DOMRect,
    selection: { left: number; top: number; right: number; bottom: number }
  ) => {
    return !(
      rect.right < selection.left ||
      rect.left > selection.right ||
      rect.bottom < selection.top ||
      rect.top > selection.bottom
    );
  }, []);

  // 使用二分查找计算点在 span 中的精确字符位置
  const getCharacterIndexAtPoint = useCallback((
    span: HTMLSpanElement, 
    pointX: number
  ): number => {
    const textNode = span.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;
    
    const text = textNode.textContent || '';
    if (!text) return 0;
    
    // 使用二分查找找到最接近 pointX 的字符位置
    let left = 0;
    let right = text.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      
      // 创建一个从开始到 mid 的 Range
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, mid);
      
      const rangeRect = range.getBoundingClientRect();
      
      if (rangeRect.right < pointX) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return left;
  }, []);

  // 根据选择区域查找相交的文本元素
  const findIntersectingSpans = useCallback((area: SelectionArea) => {
    const spans = getTextSpans();
    const layerRect = layerRef.current?.getBoundingClientRect();
    if (!layerRect || spans.length === 0) return [];

    // 计算选择区域的绝对坐标
    const selectionRect = {
      left: layerRect.left + Math.min(area.startX, area.endX),
      top: layerRect.top + Math.min(area.startY, area.endY),
      right: layerRect.left + Math.max(area.startX, area.endX),
      bottom: layerRect.top + Math.max(area.startY, area.endY),
    };

    // 过滤相交的 span，并按视觉位置排序（从上到下，从左到右）
    const intersecting = spans.filter(({ rect }) => 
      isRectIntersecting(rect, selectionRect)
    );

    // 按视觉顺序排序：先按 y 坐标（行），再按 x 坐标（列）
    intersecting.sort((a, b) => {
      const rowThreshold = 5; // 行判断阈值（像素）
      const rowDiff = a.rect.top - b.rect.top;
      if (Math.abs(rowDiff) > rowThreshold) {
        return rowDiff;
      }
      return a.rect.left - b.rect.left;
    });

    return intersecting;
  }, [getTextSpans, isRectIntersecting]);

  // 程序化创建文本选择（精确到字符级别）
  const createSelection = useCallback((
    spans: Array<{ element: HTMLSpanElement; rect: DOMRect; text: string }>,
    startPoint: { x: number; y: number } | null,
    endPoint: { x: number; y: number } | null
  ) => {
    if (spans.length === 0) {
      window.getSelection()?.removeAllRanges();
      return;
    }

    const selection = window.getSelection();
    if (!selection) return;

    // 检查是否是单击（起点和终点太接近，没有实际拖动）
    if (startPoint && endPoint) {
      const distance = Math.sqrt(
        Math.pow(endPoint.x - startPoint.x, 2) + 
        Math.pow(endPoint.y - startPoint.y, 2)
      );
      if (distance < 5) {
        selection.removeAllRanges();
        return;
      }
    }

    selection.removeAllRanges();

    try {
      const range = document.createRange();
      
      // spans 已经按视觉顺序排序（从上到下，从左到右）
      const topSpan = spans[0];
      const bottomSpan = spans[spans.length - 1];
      
      const topTextNode = topSpan.element.firstChild;
      const bottomTextNode = bottomSpan.element.firstChild;
      
      if (!topTextNode || !bottomTextNode) return;

      // 判断选择方向：
      // 正向选择：从上到下（或同行从左到右）
      // 反向选择：从下到上（或同行从右到左）
      const isForwardSelection = startPoint && endPoint && 
        (startPoint.y < endPoint.y - 5 || 
         (Math.abs(startPoint.y - endPoint.y) <= 5 && startPoint.x < endPoint.x));

      // 根据选择方向确定哪个点对应哪个 span
      // 正向选择：startPoint 对应 topSpan，endPoint 对应 bottomSpan
      // 反向选择：startPoint 对应 bottomSpan，endPoint 对应 topSpan
      const topPoint = isForwardSelection ? startPoint : endPoint;
      const bottomPoint = isForwardSelection ? endPoint : startPoint;

      // 计算 topSpan 的字符偏移（选择的开始位置）
      let topOffset = 0;
      if (topPoint) {
        const topRect = topSpan.rect;
        const isOnSameRow = Math.abs(topPoint.y - (topRect.top + topRect.height / 2)) < topRect.height;
        if (isOnSameRow && topPoint.x > topRect.left) {
          topOffset = getCharacterIndexAtPoint(topSpan.element, topPoint.x);
        }
      }
      
      // 计算 bottomSpan 的字符偏移（选择的结束位置）
      let bottomOffset = bottomTextNode.textContent?.length || 0;
      if (bottomPoint) {
        const bottomRect = bottomSpan.rect;
        const isOnSameRow = Math.abs(bottomPoint.y - (bottomRect.top + bottomRect.height / 2)) < bottomRect.height;
        if (isOnSameRow && bottomPoint.x < bottomRect.right && bottomPoint.x > bottomRect.left) {
          bottomOffset = getCharacterIndexAtPoint(bottomSpan.element, bottomPoint.x);
        } else if (isOnSameRow && bottomPoint.x <= bottomRect.left) {
          // 点在 bottomSpan 左边，选择到该 span 的开始
          bottomOffset = 0;
        }
      }
      
      // 确保 offset 不超出范围
      topOffset = Math.max(0, Math.min(topOffset, topTextNode.textContent?.length || 0));
      bottomOffset = Math.max(0, Math.min(bottomOffset, bottomTextNode.textContent?.length || 0));
      
      // 对于同一个 span 的情况，确保 topOffset < bottomOffset
      if (topSpan.element === bottomSpan.element) {
        if (topOffset === bottomOffset) {
          selection.removeAllRanges();
          return;
        }
        if (topOffset > bottomOffset) {
          [topOffset, bottomOffset] = [bottomOffset, topOffset];
        }
      }
      
      range.setStart(topTextNode, topOffset);
      range.setEnd(bottomTextNode, bottomOffset);
      selection.addRange(range);
    } catch (error) {
      console.warn("Failed to create selection:", error);
    }
  }, [getCharacterIndexAtPoint]);

  // 检查点击目标是否是交互式元素
  const isInteractiveElement = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof Element)) return false;
    
    // 检查目标元素或其祖先是否匹配交互式选择器
    for (const selector of INTERACTIVE_SELECTORS) {
      if (target.closest(selector)) {
        return true;
      }
    }
    
    return false;
  }, []);

  // 查找点击位置下的交互式元素（通过坐标）
  const findInteractiveElementAtPoint = useCallback((x: number, y: number): Element | null => {
    // 临时隐藏 CustomSelectionLayer 以检测下方的元素
    const layer = layerRef.current;
    if (!layer) return null;
    
    const originalPointerEvents = layer.style.pointerEvents;
    layer.style.pointerEvents = 'none';
    
    const elementBelow = document.elementFromPoint(x, y);
    
    layer.style.pointerEvents = originalPointerEvents;
    
    if (!elementBelow) return null;
    
    // 检查是否是交互式元素
    for (const selector of INTERACTIVE_SELECTORS) {
      const interactive = elementBelow.closest(selector);
      if (interactive) {
        return interactive;
      }
    }
    
    return null;
  }, []);

  // 处理鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只处理左键

    // 检查是否点击在交互式元素上
    const interactiveElement = findInteractiveElementAtPoint(e.clientX, e.clientY);
    
    if (interactiveElement) {
      // 让事件穿透到下层的交互式元素
      // 不阻止默认行为，不启动选择
      console.log('[CustomSelectionLayer] Click on interactive element, passing through:', interactiveElement);
      
      // 对于链接元素，直接触发其原生行为
      const linkElement = interactiveElement.closest('a') as HTMLAnchorElement;
      if (linkElement) {
        // 临时禁用选择层
        const layer = layerRef.current;
        if (layer) {
          layer.style.pointerEvents = 'none';
        }
        
        // 如果是内部链接（hash 或 page=），让 PDF.js 处理
        const href = linkElement.getAttribute('href') || '';
        if (href.startsWith('#') || href.includes('page=')) {
          // 内部链接：直接点击
          linkElement.click();
        } else if (href.startsWith('http')) {
          // 外部链接：在新标签页打开
          window.open(href, '_blank', 'noopener,noreferrer');
        } else {
          // 其他链接：直接点击
          linkElement.click();
        }
        
        // 恢复 pointer-events
        requestAnimationFrame(() => {
          if (layer) {
            layer.style.pointerEvents = 'auto';
          }
        });
        return;
      }
      
      // 非链接的交互式元素，模拟点击
      const layer = layerRef.current;
      if (layer) {
        layer.style.pointerEvents = 'none';
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
        });
        interactiveElement.dispatchEvent(clickEvent);
        
        // 恢复 pointer-events
        requestAnimationFrame(() => {
          if (layer) {
            layer.style.pointerEvents = 'auto';
          }
        });
      }
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    // 记录绝对坐标
    startPointRef.current = { x: e.clientX, y: e.clientY };
    endPointRef.current = { x: e.clientX, y: e.clientY };

    // 清除之前的选择
    window.getSelection()?.removeAllRanges();

    setIsSelecting(true);
    setSelectionArea({
      startX,
      startY,
      endX: startX,
      endY: startY,
    });

    e.preventDefault(); // 防止默认的文本选择行为
  }, [findInteractiveElementAtPoint]);

  // 处理鼠标移动
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !selectionArea) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    // 更新终点的绝对坐标
    endPointRef.current = { x: e.clientX, y: e.clientY };

    const newArea = { ...selectionArea, endX, endY };
    setSelectionArea(newArea);

    // 实时查找相交的文本并创建精确选择
    const intersecting = findIntersectingSpans(newArea);
    createSelection(intersecting, startPointRef.current, endPointRef.current);
  }, [isSelecting, selectionArea, findIntersectingSpans, createSelection]);

  // 处理鼠标释放
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !selectionArea) {
      setIsSelecting(false);
      setSelectionArea(null);
      return;
    }

    // 最终确定选择
    const intersecting = findIntersectingSpans(selectionArea);
    createSelection(intersecting, startPointRef.current, endPointRef.current);

    // 触发回调
    const selection = window.getSelection();
    if (selection && selection.toString().trim() && onTextSelect) {
      const range = selection.getRangeAt(0);
      const boundingRect = range.getBoundingClientRect();
      const rects: DOMRect[] = [];
      const clientRects = range.getClientRects();
      for (let i = 0; i < clientRects.length; i++) {
        rects.push(clientRects[i]);
      }
      onTextSelect(selection.toString().trim(), { boundingRect, rects });
    }

    setIsSelecting(false);
    setSelectionArea(null);
    startPointRef.current = null;
    endPointRef.current = null;
  }, [isSelecting, selectionArea, findIntersectingSpans, createSelection, onTextSelect]);

  // 监听全局鼠标释放（防止鼠标移出层外）
  useEffect(() => {
    if (!isSelecting) return;

    const handleGlobalMouseUp = () => {
      setIsSelecting(false);
      setSelectionArea(null);
      startPointRef.current = null;
      endPointRef.current = null;
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isSelecting]);

  return (
    <div
      ref={layerRef}
      className={`custom-selection-layer absolute top-0 left-0 ${className}`}
      style={{
        width: pageWidth * scale,
        height: pageHeight * scale,
        // zIndex 层级说明：
        // - TextLayer: 2
        // - AnnotationLayer: 5
        // - CustomSelectionLayer: 6 (略高于 AnnotationLayer)
        // - InteractionLayer: 10
        // - SentenceLayer: 15
        // - 未来的 ImageLayer/TableLayer: 根据需要调整
        zIndex: 6,
        cursor: "text",
        // 拦截鼠标事件，但会智能检测并让交互式元素的事件穿透
        pointerEvents: "auto",
        background: "transparent",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      data-layer="custom-selection"
    >
      {/* 
        智能选择层 - 兼容性设计：
        1. 检测点击目标，如果是交互式元素则让事件穿透
        2. 否则启动文本选择
        3. 使用 data-* 属性标识不同类型的交互式元素
        
        添加新的交互层时：
        - 在 INTERACTIVE_SELECTORS 中添加对应的选择器
        - 确保新层的元素有正确的 data-* 属性
      */}
    </div>
  );
};

