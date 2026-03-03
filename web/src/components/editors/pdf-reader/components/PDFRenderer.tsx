import React, { useRef, useCallback, useEffect, useState } from "react";
import { Document, Page } from "react-pdf";
import { motion, AnimatePresence } from "framer-motion";
import { SentenceLayer } from "./layers/SentenceLayer";
import { ObjectSelectionLayer } from "./layers/ObjectSelectionLayer";
import { TextBlockLayer } from "./layers/TextBlockLayer";
import { CustomSelectionLayer } from "./layers/CustomSelectionLayer";
import { CitationHighlightLayer } from "./layers/CitationHighlightLayer";
import { SearchHighlight } from "./SearchHighlight";
import { PDFStatus } from "./PDFStatus";
import { ReadingMode } from "./PDFToolbar";
import { InteractionMode } from "./PDFToolbarInline";
import { PageDetection, Detection } from "@/types/paperContext";
import { useCitationStore } from "../store/citationStore";
import { TargetLanguage, DEFAULT_LANGUAGE } from "../services/translateService";

/**
 * TODO: [SELECTION_MODE] 文本选择模式开关
 * 
 * 当启用时，使用 CustomSelectionLayer 替代原生 TextLayer 选择
 * 优点：解决从空白处开始选择时的"反选"问题
 * 缺点：可能略微影响性能
 * 
 * 设为 true 启用自定义选择层
 */
const ENABLE_CUSTOM_SELECTION = true;

interface PDFRendererProps {
  pdfUrl: string;
  numPages: number;
  pageNumber: number;
  scale: number;
  loading: boolean;
  error: string;
  readingMode: ReadingMode;
  originalPageSize: { width: number; height: number };
  pdfOptions: any;
  // Event handlers
  onLoadSuccess: ({ numPages }: { numPages: number }) => void;
  onLoadError: (error: Error) => void;
  onPageLoadSuccess: (page: any) => void;
  hoverTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setHoveredWord: (word: any) => void;
  // Text selection and highlighting
  selectedText: any;
  setSelectedText: (text: any) => void;
  // Search
  searchResults: any[];
  currentResultIndex: number;
  // For continuous mode scroll handling
  onPageChange?: (pageNumber: number) => void;
  // PDF internal link navigation
  onItemClick?: (item: {
    pageNumber?: number;
    dest?: unknown;
    url?: string;
  }) => void;
  // Sentence interaction layer
  isSentenceLayerEnabled?: boolean;
  sentences?: any[];
  selectedSentenceIds?: number[];
  onSentenceClick?: (
    sentenceIds: number[],
    position: { x: number; y: number },
    clickedPageNumber?: number
  ) => void;
  // Object selection layer (images, tables, etc.)
  isObjectLayerEnabled?: boolean;
  pageDetections?: PageDetection[];
  /** OCR 图像尺寸 (用于坐标转换)。格式: { width: number, height: number } */
  ocrImageSize?: { width: number; height: number };
  onObjectClick?: (detection: Detection, position: { x: number; y: number }) => void;
  onExplainObject?: (detection: Detection) => void;
  /** Paper ID for constructing image paths */
  paperId?: string;
  /** 交互模式：selection（文本选择）或 translate（段落翻译） */
  interactionMode?: InteractionMode;
}

export const PDFRenderer: React.FC<PDFRendererProps> = ({
  pdfUrl,
  numPages,
  pageNumber,
  scale,
  loading,
  error,
  readingMode,
  originalPageSize,
  pdfOptions,
  onLoadSuccess,
  onLoadError,
  onPageLoadSuccess,
  hoverTimerRef,
  setHoveredWord,
  setSelectedText,
  searchResults,
  currentResultIndex,
  onPageChange,
  onItemClick,
  isSentenceLayerEnabled = false,
  sentences = [],
  selectedSentenceIds = [],
  onSentenceClick,
  isObjectLayerEnabled = false,
  pageDetections = [],
  ocrImageSize,
  onObjectClick,
  onExplainObject,
  paperId,
  interactionMode = "sentence",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const isProgrammaticScroll = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  
  // 组件卸载时清理
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // 清理 timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  // 翻译层状态
  const [translateLanguage, setTranslateLanguage] = useState<TargetLanguage>(DEFAULT_LANGUAGE);
  
  // 根据交互模式决定启用哪个层
  // sentence 模式：启用 CustomSelectionLayer（句子/文本选择）
  // paragraph 模式：启用 TextBlockLayer（段落翻译）
  const isTranslateLayerEnabled = isObjectLayerEnabled && interactionMode === "paragraph";
  const isCustomSelectionEnabled = ENABLE_CUSTOM_SELECTION && interactionMode === "sentence";

  // 处理PDF注释层中的链接，使其在新标签页打开
  React.useEffect(() => {
    const handleLinkAnnotations = () => {
      // 查找所有PDF注释层中的链接
      const annotationLinks = document.querySelectorAll('.linkAnnotation a[href]');
      
      annotationLinks.forEach((link) => {
        const anchor = link as HTMLAnchorElement;
        // 只处理外部链接（不是内部页面跳转链接）
        if (anchor.href && !anchor.href.startsWith('#') && !anchor.href.includes('page=')) {
          anchor.setAttribute('target', '_blank');
          anchor.setAttribute('rel', 'noopener noreferrer');
        }
      });
    };

    // 使用 MutationObserver 监听 DOM 变化，因为 PDF 页面是异步渲染的
    const observer = new MutationObserver(() => {
      handleLinkAnnotations();
    });

    // 开始观察文档变化
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href']
    });

    // 初始处理已存在的链接
    handleLinkAnnotations();

    return () => {
      observer.disconnect();
    };
  }, [pageNumber, scale]); // 当页码或缩放改变时重新处理

  // Handle scroll for continuous mode
  const handleScroll = useCallback(() => {
    if (isProgrammaticScroll.current) return;

    if (readingMode !== "continuous" || !onPageChange) return;

    const container = containerRef.current;
    if (!container) return;

    const containerTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const centerY = containerTop + containerHeight / 2;

    // Find which page is currently in the center of the view
    for (let i = 1; i <= numPages; i++) {
      const pageElement = pageRefs.current[i];
      if (!pageElement) continue;

      const pageTop = pageElement.offsetTop;
      const pageBottom = pageTop + pageElement.offsetHeight;

      if (centerY >= pageTop && centerY <= pageBottom) {
        onPageChange(i);
        break;
      }
    }
  }, [readingMode, numPages, onPageChange]);

  // 使用 ref 存储最新的值 - 同步更新（在每次渲染时直接赋值）
  const lastScrollTargetRef = useRef<{ page: number; time: number } | null>(null);
  const currentPageRef = useRef(pageNumber);
  const readingModeRef = useRef(readingMode);
  const onPageChangeRef = useRef(onPageChange);
  const ocrImageSizeRef = useRef(ocrImageSize);
  
  // 同步更新 ref 值（不使用 useEffect，确保在事件触发前值已更新）
  currentPageRef.current = pageNumber;
  readingModeRef.current = readingMode;
  onPageChangeRef.current = onPageChange;
  ocrImageSizeRef.current = ocrImageSize;

  // 监听 scroll-to-detection 事件 (用于双向索引导航)
  useEffect(() => {
    const handleScrollToDetection = (event: CustomEvent<{
      detectionId: string;
      pageNumber: number;
      bbox?: { x1_px: number; y1_px: number; x2_px: number; y2_px: number };
    }>) => {
      // 安全检查：确保组件仍然挂载
      if (!isMountedRef.current) {
        return;
      }
      
      // 安全检查：确保 event.detail 存在
      if (!event.detail) {
        console.warn('[PDFRenderer] Received scroll event with null detail');
        return;
      }
      
      const { pageNumber: targetPage, bbox, detectionId } = event.detail;
      
      // 安全检查：确保 targetPage 是有效的数字
      if (typeof targetPage !== 'number' || isNaN(targetPage)) {
        console.warn('[PDFRenderer] Invalid targetPage:', targetPage);
        return;
      }
      
      const currentPage = currentPageRef.current;
      const mode = readingModeRef.current;
      const pageChanger = onPageChangeRef.current;
      const imgSize = ocrImageSizeRef.current;
      
      console.log('[PDFRenderer] Received scroll event:', {
        detectionId,
        targetPage,
        currentPage,
        readingMode: mode,
      });
      
      // 如果目标页和当前页相同，直接返回
      if (targetPage === currentPage) {
        console.log('[PDFRenderer] Already on target page, skipping');
        return;
      }
      
      // 防抖：500ms 内相同目标页不重复跳转
      const now = Date.now();
      if (lastScrollTargetRef.current && 
          lastScrollTargetRef.current.page === targetPage &&
          now - lastScrollTargetRef.current.time < 500) {
        console.log('[PDFRenderer] Debounced - same target within 500ms');
        return;
      }
      lastScrollTargetRef.current = { page: targetPage, time: now };
      
      // 获取目标页面元素
      const pageElement = pageRefs.current[targetPage];
      
      // 处理不同阅读模式
      if (mode === 'continuous') {
        // 连续模式：滚动到目标页面
        console.log('[PDFRenderer] Continuous mode - scrolling to page', targetPage);
        if (pageElement) {
          isProgrammaticScroll.current = true;
          
          // 如果有 bbox，计算精确滚动位置
          if (bbox && imgSize) {
            const pageRect = pageElement.getBoundingClientRect();
            const container = containerRef.current;
            
            if (container) {
              // 计算 bbox 在页面中的相对位置
              const relativeTop = bbox.y1_px / imgSize.height;
              const targetScrollY = pageElement.offsetTop + (pageRect.height * relativeTop) - (container.clientHeight / 3);
              
              container.scrollTo({
                top: Math.max(0, targetScrollY),
                behavior: 'smooth'
              });
            }
          } else {
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
          scrollTimeoutRef.current = setTimeout(() => {
            isProgrammaticScroll.current = false;
          }, 1000);
        }
      } else {
        // 单页/双页模式
        console.log('[PDFRenderer] Single/Double mode - changing to page:', targetPage);
        if (pageChanger) {
          // 立即更新 ref，防止连续点击时值过时
          currentPageRef.current = targetPage;
          pageChanger(targetPage);
        }
      }
    };

    window.addEventListener('pdf-scroll-to-detection', handleScrollToDetection as EventListener);
    console.log('[PDFRenderer] Event listener added');
    
    return () => {
      window.removeEventListener('pdf-scroll-to-detection', handleScrollToDetection as EventListener);
      console.log('[PDFRenderer] Event listener removed');
    };
  }, []); // 空依赖数组，只在挂载时添加一次

  // 为每个页面创建 ref 用于 CustomSelectionLayer
  const pageContentRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // 通用页面渲染函数
  const renderPage = (pageNum: number, showPageNumber = false) => (
    <div
      className="relative rounded-2xl overflow-hidden bg-white shadow-lg pdf-page-container"
      style={{
        width: originalPageSize.width * scale,
        height: originalPageSize.height * scale,
      }}
      data-page-number={pageNum}
      onMouseLeave={() => {
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
        }
        setHoveredWord(null);
      }}
    >
      <div 
        ref={(el) => { pageContentRefs.current[pageNum] = el; }}
        className="absolute top-0 left-0 w-full h-full rounded-2xl overflow-hidden"
      >
        <Page
          pageNumber={pageNum}
          scale={scale}
          renderTextLayer
          renderAnnotationLayer
          onLoadSuccess={pageNum === pageNumber ? onPageLoadSuccess : undefined}
          onRenderError={(error) =>
            console.warn(`Page ${pageNum} render error:`, error)
          }
          loading={null}
          error={null}
          className="rounded-2xl overflow-hidden"
          data-page-number={pageNum}
        />
        <SearchHighlight
          searchResults={searchResults}
          currentResultIndex={currentResultIndex}
          pageNumber={pageNum}
          scale={scale}
          pageWidth={originalPageSize.width}
          pageHeight={originalPageSize.height}
        />
        <SentenceLayer
          pageNumber={pageNum}
          pageWidth={originalPageSize.width}
          pageHeight={originalPageSize.height}
          scale={scale}
          sentences={sentences}
          isEnabled={isSentenceLayerEnabled}
          selectedSentenceIds={selectedSentenceIds}
          onSentenceClick={onSentenceClick}
        />
        {/* 对象选择层 - 图像、表格、公式等 */}
        <ObjectSelectionLayer
          pageNumber={pageNum}
          pageWidth={originalPageSize.width}
          pageHeight={originalPageSize.height}
          scale={scale}
          detections={pageDetections.find(d => d.page_number === pageNum) || null}
          ocrImageWidth={ocrImageSize?.width}
          ocrImageHeight={ocrImageSize?.height}
          isEnabled={isObjectLayerEnabled}
          onObjectClick={onObjectClick}
          onExplainObject={onExplainObject}
          paperId={paperId}
          allDetections={pageDetections}
        />
        {/* 文本翻译层 - Hover 1秒自动翻译 */}
        <TextBlockLayer
          pageNumber={pageNum}
          pageWidth={originalPageSize.width}
          pageHeight={originalPageSize.height}
          scale={scale}
          detections={pageDetections.find(d => d.page_number === pageNum) || null}
          ocrImageWidth={ocrImageSize?.width}
          ocrImageHeight={ocrImageSize?.height}
          isEnabled={isTranslateLayerEnabled}
          targetLanguage={translateLanguage}
          onLanguageChange={setTranslateLanguage}
        />
        {/* 引用高亮层 - 显示 AI 双向索引 */}
        <CitationHighlightLayer
          pageNumber={pageNum}
          scale={scale}
          pageDimensions={originalPageSize}
          ocrImageSize={ocrImageSize}
        />
        {/* 自定义选择层 - 文本选择模式 */}
        {isCustomSelectionEnabled && pageContentRefs.current[pageNum] && (
          <CustomSelectionLayer
            pageWidth={originalPageSize.width}
            pageHeight={originalPageSize.height}
            scale={scale}
            textLayerRef={{ current: pageContentRefs.current[pageNum]! }}
            onTextSelect={(text, position) => {
              setSelectedText({
                text,
                position: {
                  x: position.boundingRect.left + window.scrollX,
                  y: position.boundingRect.bottom + window.scrollY + 10,
                },
              });
            }}
          />
        )}
      </div>
      {showPageNumber && (
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {pageNum}
        </div>
      )}
    </div>
  );

  // 单页模式 - 简化版本（移除动画以确保状态稳定）
  const renderSinglePage = () => (
    <div className="max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden scroll-smooth">
      {renderPage(pageNumber)}
    </div>
  );

  // 连续滚动模式
  const renderContinuousPages = () => (
    <div
      ref={containerRef}
      className="space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto scroll-smooth"
      onScroll={handleScroll}
    >
      {Array.from({ length: numPages }, (_, i) => {
        const currentPageNumber = i + 1;
        return (
          <div
            key={`page_${currentPageNumber}`}
            ref={(el) => {
              if (el) {
                pageRefs.current[currentPageNumber] = el;
                // 当目标页面的引用建立时，如果这是我们要滚动到的页面，触发滚动
                if (currentPageNumber === pageNumber) {
                  // 延迟执行以确保DOM完全渲染
                  setTimeout(() => {
                    const container = containerRef.current;
                    if (container && el) {
                      const containerTop = container.scrollTop;
                      const targetTop = el.offsetTop;
                      const containerHeight = container.clientHeight;
                      const targetHeight = el.offsetHeight;

                      const isInView =
                        targetTop >= containerTop &&
                        targetTop + targetHeight <= containerTop + containerHeight;
                      
                      if (!isInView) {
                        isProgrammaticScroll.current = true;
                        container.scrollTo({
                          top: targetTop,
                          behavior: "instant",
                        });
                        if (scrollTimeoutRef.current) {
                          clearTimeout(scrollTimeoutRef.current);
                        }
                        scrollTimeoutRef.current = setTimeout(() => {
                          isProgrammaticScroll.current = false;
                        }, 1000);
                      }
                    }
                  }, 10);
                }
              }
            }}
          >
            {renderPage(currentPageNumber, true)}
          </div>
        );
      })}
    </div>
  );

  // 双页模式 - 添加页面切换动画
  const renderDoublePages = () => {
    const leftPage = pageNumber % 2 === 0 ? pageNumber - 1 : pageNumber;
    const rightPage = leftPage + 1;
    const showLeftPage = leftPage >= 1;
    const showRightPage = rightPage <= numPages;

    return (
      <div className="max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden scroll-smooth">
        <AnimatePresence mode="wait">
          <motion.div
            key={`pages-${leftPage}-${rightPage}`}
            className="flex gap-4 justify-center"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {showLeftPage && renderPage(leftPage, true)}
            {showRightPage && renderPage(rightPage, true)}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };

  const renderContent = () => {
    const renderFunctions = {
      single: renderSinglePage,
      continuous: renderContinuousPages,
      double: renderDoublePages,
    };
    return (renderFunctions[readingMode] || renderSinglePage)();
  };

  return (
    <div className="flex justify-center">
      <div className="bg-[#faf8f5] shadow-lg rounded-2xl border border-[#e5e2dd] overflow-hidden">
        <PDFStatus
          loading={loading}
          error={error}
          pdfUrl={pdfUrl}
          onRetry={() => window.location.reload()}
        />
        <Document
          file={pdfUrl}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          onItemClick={onItemClick}
          loading={null}
          error={null}
          options={pdfOptions}
        >
          {numPages > 0 && !error && renderContent()}
        </Document>
      </div>
    </div>
  );
};
