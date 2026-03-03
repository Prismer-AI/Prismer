"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { pdfjs } from "react-pdf";
import { IndexPanel } from "./components/IndexPanel";
import { SelectionPopup } from "./components/SelectionPopup";
import { AIRightPanel } from "./components/ai";
import { PDFToolbar, ReadingMode } from "./components/PDFToolbar";
import { PDFToolbarInline, PDFViewState } from "./components/PDFToolbarInline";
import { PDFReaderTopBar } from "./components/PDFReaderTopBar";
import { OpenDocument } from "./components/DocumentTabs";
import { PaperLibraryDialog, PaperMeta } from "./components/PaperLibraryDialog";
import { PDFRenderer } from "./components/PDFRenderer";
import { ShortcutsFloatingButton } from "./components/ShortcutsFloatingButton";
import { useLayoutCalculation } from "./hooks/useLayoutCalculation";
import { useEventHandlers } from "./hooks/useEventHandlers";
import { usePDFSearch } from "./hooks/usePDFSearch";
import { useAIPaperReader } from "./hooks/useAIPaperReader";
import { usePageNavigation } from "./hooks/usePageNavigation";
import { api } from "@/lib/api";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./styles/pdf-reader.css";
import { Apis } from "@/constants/api";
import { useFlowStore } from "@/store/flowStore";
import { BlockType } from "@/types/block";
import { disciplineTemplates } from "./types";
import { PDFSource } from "@/types/paperContext";
// usePaperContext is now called internally by useAIPaperReader

// ============================================================================
// FEATURE FLAGS - OCR Service Dependencies
// ============================================================================

/**
 * TODO: [OCR_SERVICE] 句子级选择功能
 * 
 * 依赖：OCR服务提供句子边界坐标 (sentence boxes)
 * 数据格式：每个句子包含 boxes 数组，每个 box 有 bbox 坐标 [x1, y1, x2, y2]
 * 
 * 当前状态：❌ 不可用 - OCR服务未就绪
 * 启用方式：将此值设为 true，并确保 pdfData.sents.sentences 包含有效数据
 * 
 * 功能说明：
 * - 允许用户以句子为单位选择文本
 * - 支持拖选多个句子
 * - 选择后可进行高亮、标注等操作
 */
const ENABLE_SENTENCE_LAYER = false;

/**
 * [OCR_SERVICE] 图像/表格对象选择功能
 * 
 * 依赖：OCR服务提供图像、表格等对象的边界坐标
 * 数据格式：对象包含 type ('image' | 'table' | 'figure') 和 bbox 坐标
 * 
 * 当前状态：✅ 已启用 - 自动根据 OCR 数据可用性启用
 * 
 * 功能说明：
 * - 允许用户选择 PDF 中的图像、表格等对象
 * - 悬停显示对象类型和操作按钮
 * - 支持 "Explain" 按钮调用 AI 解释对象
 */
const ENABLE_OBJECT_SELECTION = true;

/**
 * [AI_PANEL] AI-Native 右侧面板 (现在是唯一模式)
 * 
 * 功能包括：
 * - Paper Overview：论文概览卡片
 * - Quick Insights：AI 自动生成的论文洞察
 * - Ask Paper：对话式论文问答
 * - Extracts：可追溯的内容提取
 * 
 * 当前状态：✅ 已启用（传统模式已移除）
 */

// ============================================================================

// PDF.js worker configuration - only on client side
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

interface PDFReaderProps {
  pdfSource: PDFSource;
  onClose: () => void;
}

interface SentenceTag {
  id: string;
  color: string;
  comments: {
    id: string;
    content: string;
    author: string;
    timestamp: number;
    likes: number;
    isLiked: boolean;
  }[];
  isLiked: boolean;
  isVisible: boolean;
  likes: number;
  pageNumber: number;
  position: { x: number; y: number };
  sentenceContent: string;
  sentenceIds: number[];
  timestamp: number;
}

const leftPanelWidth = 320;

const PDFReader: React.FC<PDFReaderProps> = ({ onClose, pdfSource: initialPdfSource }) => {
  const { setPendingItems } = useFlowStore();
  
  // 支持动态切换 PDF 源（从论文库选择）
  const [currentPdfSource, setCurrentPdfSource] = useState<PDFSource>(initialPdfSource);
  
  // 当外部传入的 pdfSource 变化时，同步更新内部状态
  const initialSourceKey = initialPdfSource?.arxivId || initialPdfSource?.path || '';
  useEffect(() => {
    if (initialSourceKey) {
      console.log('[PDFReader] External source changed, updating:', initialSourceKey);
      setCurrentPdfSource(initialPdfSource);
    }
  }, [initialSourceKey, initialPdfSource]);
  
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [originalPageSize, setOriginalPageSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  // 阅读模式状态（需要在 usePageNavigation 之前声明）
  const [readingMode, setReadingMode] = useState<ReadingMode>("single");

  // 统一的页面导航 Hook - 解决双页模式翻页等问题
  const {
    pageNumber,
    goToPage,
    goToPrevPage,
    goToNextPage,
    canGoToPrev,
    canGoToNext,
    getDisplayedPages,
  } = usePageNavigation(numPages, readingMode);

  // AI Paper Reader Hook - 加载 Agent 和 Paper Context
  // 这是 paperContext 的唯一来源，确保与 aiStore 同步
  const {
    paperContext,
    hasOCRData,
    isLoadingContext,
    contextError,
    isAgentReady,
  } = useAIPaperReader(currentPdfSource, goToPage);

  // 从 paperContext 获取 PDF URL 和 sentences
  const pdfUrl = useMemo(() => {
    if (!currentPdfSource.path) {
      console.error("path is missing from pdfSource");
      return "";
    }
    return currentPdfSource.path;
  }, [currentPdfSource.path]);

  // 获取 paperId 用于 API 调用
  const paperId = useMemo(() => {
    return currentPdfSource.arxivId || "unknown";
  }, [currentPdfSource.arxivId]);

  // 从 paperContext 获取 sentences（如果有 OCR 数据）
  // NOTE: Currently PageContent doesn't have a sentences property
  // This is a placeholder for future sentence-level interaction
  const sentences = useMemo<Array<{ id: string; content: string; property?: { page?: number } }>>(() => {
    // TODO: Implement sentences extraction when OCR data includes sentence-level information
    return [];
  }, []);

  // 面板状态
  const [isIndexPanelOpen, setIsIndexPanelOpen] = useState(true); // 默认打开左边栏显示 Insight
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true); // 默认打开右边栏
  const [rightPanelWidth, setRightPanelWidth] = useState(380);

  // 多文档管理状态 (Phase 1: 单文档支持)
  const documents: OpenDocument[] = useMemo(() => {
    const title = paperContext?.metadata?.title || currentPdfSource.arxivId || "Untitled";
    return [{
      id: currentPdfSource.arxivId || "doc-1",
      title: title.length > 30 ? title.slice(0, 30) + "..." : title,
      arxivId: currentPdfSource.arxivId,
      isDirty: false,
    }];
  }, [currentPdfSource.arxivId, paperContext?.metadata?.title]);

  const activeDocumentId = documents[0]?.id || null;

  // 笔记编辑器状态
  const [notesContent, setNotesContent] = useState<string>("");

  // 句子交互层状态
  // 注意：受 ENABLE_SENTENCE_LAYER 功能开关控制
  const [isSentenceLayerEnabled, setIsSentenceLayerEnabled] = useState(
    ENABLE_SENTENCE_LAYER // 使用功能开关作为初始值
  );
  const [selectedSentences, setSelectedSentences] = useState<any>(null);

  // 标签系统状态
  const [sentenceTags, setSentenceTags] = useState<SentenceTag[]>([]);

  // PDF大纲状态

  // 快捷键浮动按钮状态
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // 容器引用
  const containerRef = useRef<HTMLDivElement>(null);

  // 注意：useAIPaperReader 已在上方调用，提供 paperContext 和 AI 相关功能

  // 使用布局计算 hook
  const layoutCalculation = useLayoutCalculation({
    scale,
    originalPageSize,
    isTagPanelOpen: isRightPanelOpen,
    isNotesPanelOpen: false,
    isGraphPanelOpen: false,
    isIndexPanelOpen: isIndexPanelOpen,
    leftPanelWidth,
    rightPanelWidth,
    readingMode,
  });

  const { needsCompression, rightMargin, leftMargin, maxPdfContainerWidth } =
    layoutCalculation;

  // 使用事件处理 hook - 传入模式感知的翻页函数
  const eventHandlers = useEventHandlers({
    paperId,
    pageNumber,
    scale,
    numPages,
    goToPrevPage,
    goToNextPage,
    canGoToPrev,
    canGoToNext,
    setScale,
  });

  const {
    selectedText,
    hoverTimerRef,
    setHoveredWord,
    setSelectedText,
  } = eventHandlers;

  // 句子高亮 ID（目前为空，可以从 aiStore 的 extracts 中获取）
  const highlightedSentenceIds: number[] = [];

  // 使用PDF搜索 hook
  const pdfSearch = usePDFSearch({
    pdfUrl,
    currentPageNumber: pageNumber,
    onPageChange: goToPage,
  });

  const {
    searchResults,
    currentResultIndex,
    searchPDF,
    navigateResult,
    clearSearch,
  } = pdfSearch;

  // 处理内容插入到编辑器
  const handleInsertToEditor = useCallback(
    (content: string, type: "text" | "quote" = "quote") => {
      // 确保右侧面板是打开的
      if (!isRightPanelOpen) {
        setIsRightPanelOpen(true);
      }

      // TODO: Implement proper insert to notes functionality
      // Currently AIRightPanel doesn't expose a ref interface for this
      console.log("Insert content to editor:", { content, type });
    },
    [isRightPanelOpen]
  );

  // 加载PDF大纲数据
  useEffect(() => {
    const loadPDFOutline = async () => {
      try {
        const pdf = await pdfjs.getDocument(pdfUrl).promise;
        const outline = await pdf.getOutline();
        if (outline) {
          // 处理每个大纲项，获取页码
          const processedOutline = await Promise.all(
            outline.map(async (item: any) => {
              try {
                const dest = await pdf.getDestination(item.dest);
                if (dest) {
                  const pageNumber = (await pdf.getPageIndex(dest[0])) + 1;
                  return {
                    ...item,
                    pageNumber,
                    items: item.items
                      ? await Promise.all(
                          item.items.map(async (subItem: any) => {
                            try {
                              const subDest = await pdf.getDestination(
                                subItem.dest
                              );
                              if (subDest) {
                                const subPageNumber =
                                  (await pdf.getPageIndex(subDest[0])) + 1;
                                return {
                                  ...subItem,
                                  pageNumber: subPageNumber,
                                };
                              }
                              return subItem;
                            } catch (error) {
                              console.error(
                                "Error processing sub-item:",
                                error
                              );
                              return subItem;
                            }
                          })
                        )
                      : undefined,
                  };
                }
                return item;
              } catch (error) {
                console.error("Error processing outline item:", error);
                return item;
              }
            })
          );
          console.log("PDF outline loaded:", processedOutline);
        }
      } catch (error) {
        console.error("Failed to load PDF outline:", error);
      }
    };

    if (pdfUrl) {
      loadPDFOutline();
    }
  }, [pdfUrl]);

  // 处理句子点击
  const handleSentenceClick = useCallback(
    (
      sentenceIds: (string | number)[],
      position: { x: number; y: number },
      clickedPageNumber?: number
    ) => {
      if (sentenceIds.length === 0) {
        // 清除选择（但保留已保存的标签高亮）
        setSelectedSentences(null);
        // 不清除highlightedSentenceIds，因为那些是已保存的标签
        return;
      }

      // 获取被选中的句子内容
      const stringIds = sentenceIds.map(String);
      const selectedSentenceData = sentences.filter((s) =>
        stringIds.includes(s.id)
      );
      const sentenceContents = selectedSentenceData.map((s) => s.content);

      // 确定正确的页面号：优先使用点击时的页面号，否则使用句子自身的页面号
      const actualPageNumber =
        clickedPageNumber ||
        selectedSentenceData[0]?.property?.page ||
        pageNumber;

      console.log("Sentence click handling:", {
        sentenceIds,
        clickedPageNumber,
        actualPageNumber,
        currentPageNumber: pageNumber,
        readingMode,
      });

      // 设置选中的句子和弹窗位置
      setSelectedSentences({
        ids: sentenceIds,
        contents: sentenceContents,
        position,
        actualPageNumber, // 添加实际页面号
      });
    },
    [sentences, pageNumber, readingMode]
  );

  // 处理句子高亮（创建注释）
  const handleSentenceHighlight = useCallback(
    (color: string) => {
      if (!selectedSentences) return;

      // 使用实际的页面号而不是当前显示的页面号
      const targetPageNumber = selectedSentences.actualPageNumber || pageNumber;

      // 创建一个 sentence tag 来记录高亮
      const newTag = {
        id: `sentence-tag-${Date.now()}`,
        sentenceIds: selectedSentences.ids,
        sentenceContent: selectedSentences.contents.join(" "),
        pageNumber: targetPageNumber,
        position: selectedSentences.position,
        color: color,
        timestamp: Date.now(),
        comments: [],
        isVisible: true,
        likes: 0,
        isLiked: false,
      };

      setSentenceTags((prev) => [...prev, newTag]);
      setSelectedSentences(null);
      handleSentenceClick([], { x: 0, y: 0 }, pageNumber);
    },
    [selectedSentences, pageNumber]
  );

  // 处理标签点击（跳转到PDF位置）
  const handleTagClick = useCallback((tag: any) => {
    // 跳转到标签所在页面
    goToPage(tag.pageNumber);
  }, [goToPage]);

  // 处理标签可见性切换
  const handleTagVisibilityToggle = useCallback((tagId: string) => {
    setSentenceTags((prev) => {
      const updatedTags = prev.map((tag) =>
        tag.id === tagId ? { ...tag, isVisible: !tag.isVisible } : tag
      );

      return updatedTags;
    });
  }, []);

  // 处理标签删除
  const handleTagDelete = useCallback((tagId: string) => {
    setSentenceTags((prev) => prev.filter((tag) => tag.id !== tagId));
  }, []);

  // 处理添加评论
  const handleAddComment = useCallback((tagId: string, content: string) => {
    const newComment = {
      id: `comment-${Date.now()}`,
      content: content,
      author: "Current User", // TODO: Get from user system
      timestamp: Date.now(),
      likes: 0,
      isLiked: false,
    };

    setSentenceTags((prev) =>
      prev.map((tag) =>
        tag.id === tagId
          ? { ...tag, comments: [...tag.comments, newComment] }
          : tag
      )
    );
  }, []);

  // 处理标签点赞
  const handleLikeTag = useCallback((tagId: string) => {
    setSentenceTags((prev) =>
      prev.map((tag) =>
        tag.id === tagId
          ? {
              ...tag,
              isLiked: !tag.isLiked,
              likes: tag.isLiked ? tag.likes - 1 : tag.likes + 1,
            }
          : tag
      )
    );
  }, []);

  // 处理评论点赞
  const handleLikeComment = useCallback((tagId: string, commentId: string) => {
    setSentenceTags((prev) =>
      prev.map((tag) =>
        tag.id === tagId
          ? {
              ...tag,
              comments: tag.comments.map((comment: any) =>
                comment.id === commentId
                  ? {
                      ...comment,
                      isLiked: !comment.isLiked,
                      likes: comment.isLiked
                        ? comment.likes - 1
                        : comment.likes + 1,
                    }
                  : comment
              ),
            }
          : tag
      )
    );
  }, []);

  // 从API加载笔记数据
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const response = await api.get<{ id: number; content: string }>(
          `${Apis["pdf-notes"]}?block_id=${paperId}`
        );
        if (response.id) {
          setNotesContent(response.content);
        }
      } catch (error) {
        console.error("Failed to load notes from API:", error);
      }
    };

    loadNotes();
  }, [paperId]);

  // Memoize PDF options - use local paths to avoid CDN dependencies
  const pdfOptions = useMemo(
    () => ({
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
    }),
    []
  );

  // 处理PDF内部链接点击 - 使用 goToPage（已包含规范化逻辑）
  const handlePDFItemClick = useCallback(
    (item: { pageNumber?: number; dest?: unknown }) => {
      if (item && typeof item.pageNumber === "number") {
        goToPage(item.pageNumber);
      }
    },
    [goToPage]
  );

  // 阅读模式切换处理
  // 注意：usePageNavigation hook 会自动处理模式切换时的页码规范化
  const handleReadingModeChange = useCallback(
    (mode: ReadingMode) => {
      setReadingMode(mode);
    },
    []
  );

  // 计算适合容器的缩放比例
  const calculateFitToWidthScale = useCallback(
    (pageWidth: number): number => {
      if (!pageWidth || !containerRef.current) return 1;

      // 获取容器宽度
      const containerWidth = containerRef.current.clientWidth;
      
      // 计算左右面板占用的宽度
      const leftPanelSpace = isIndexPanelOpen ? leftPanelWidth : 0;
      const rightPanelSpace = isRightPanelOpen ? rightPanelWidth : 0;
      
      // 计算可用宽度
      const padding = 48; // 左右 padding
      const availableWidth = containerWidth - leftPanelSpace - rightPanelSpace - padding;

      // 根据阅读模式调整
      let targetWidth = availableWidth;
      if (readingMode === "double") {
        targetWidth = (availableWidth - 16) / 2;
      }

      targetWidth = Math.max(targetWidth, 300);
      const calculatedScale = targetWidth / pageWidth;

      const minScale = 0.25;
      const maxScale = 2.0;

      return Math.min(Math.max(calculatedScale, minScale), maxScale);
    },
    [isIndexPanelOpen, isRightPanelOpen, rightPanelWidth, readingMode]
  );

  // 处理页面尺寸变化
  const handlePageLoadSuccess = useCallback(
    (page: {
      getViewport: (options: { scale: number }) => {
        width: number;
        height: number;
      };
    }) => {
      try {
        // 获取原始页面尺寸（scale = 1）
        const originalViewport = page.getViewport({ scale: 1 });
        const pageWidth = originalViewport.width;
        const pageHeight = originalViewport.height;

        // 保存原始尺寸
        setOriginalPageSize({
          width: pageWidth,
          height: pageHeight,
        });

        if (scale === 1.0) {
          const autoScale = calculateFitToWidthScale(pageWidth);
          setScale(autoScale);
        }
      } catch (error) {
        console.error("Error getting page viewport:", error);
      }
    },
    [scale, calculateFitToWidthScale]
  );

  // 处理文档加载错误
  const handleLoadError = useCallback(
    (error: Error) => {
      console.error("PDF loading error:", error);
      console.error("PDF URL:", pdfUrl);
      setError(`PDF loading failed: ${error.message}`);
      setLoading(false);
    },
    [pdfUrl]
  );

  // 处理文档加载成功
  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setLoading(false);
      setError("");
      console.log("PDF loaded successfully, pages:", numPages);

      // 延迟一小段时间确保DOM完全渲染后再计算最佳缩放
      setTimeout(() => {
        if (originalPageSize.width > 0 && scale === 1.0) {
          const autoScale = calculateFitToWidthScale(originalPageSize.width);
          setScale(autoScale);
          console.log("Auto-calculated scale after document load:", autoScale);
        }
      }, 100);
    },
    [originalPageSize.width, scale, calculateFitToWidthScale]
  );

  // 检查PDF URL是否有效
  useEffect(() => {
    if (!pdfUrl) {
      setError("Invalid PDF URL: missing file path or API base URL");
      setLoading(false);
    } else {
      setError("");
      setLoading(true);
    }
  }, [pdfUrl]);

  // 添加全局点击事件监听器，确保点击非PDF区域时清除选择状态
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // 检查点击是否在PDF内容区域、工具栏或弹窗内
      const isPDFContent = target.closest("[data-page-number]");
      const isToolbar = target.closest(".pdf-toolbar");
      const isPopup =
        target.closest(".selection-popup") || target.closest('[role="dialog"]');
      const isRightPanel = target.closest(".right-panel");

      // 如果点击在PDF区域外且不在工具栏或弹窗内，清除选择状态
      if (!isPDFContent && !isToolbar && !isPopup && !isRightPanel) {
        setSelectedText(null);
        setSelectedSentences(null);
        setHoveredWord(null);
      }
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // 检查是否在输入框中，如果是则不处理全局快捷键
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";

      if (isInputElement) return;

      // "?" 键切换快捷键面板
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };

    document.addEventListener("click", handleGlobalClick);
    document.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      document.removeEventListener("click", handleGlobalClick);
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [setSelectedText, setHoveredWord]);

  const handleAddToCanvas = useCallback(async () => {
    try {
      // 检查笔记内容是否为空或只包含空白字符（包括换行符）
      if (!notesContent || !notesContent.toString().replace(/\s/g, "").trim()) {
        console.warn("Notes content is empty, cannot add to canvas");
        return;
      }

      // 创建 markdown 文件内容
      const markdownContent = notesContent;
      const fileName = `notes-${Date.now()}.md`;

      const file = new File([markdownContent], fileName, {
        type: "text/markdown",
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "markdown");

      const uploadResponse = await api.post<{
        file_path: string;
        [key: string]: unknown;
      }>(Apis.upload, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const item = {
        type: BlockType.Markdown,
        item: {
          link: uploadResponse.file_path,
          link_type: "s3",
          name: fileName,
        },
      };

      // 创建 block
      const createBlockResponse = await api.post<{
        id: number;
      }>(Apis["create-block"], item);

      await setPendingItems([
        {
          id: createBlockResponse.id,
          type: BlockType.Markdown,
          data: { content: notesContent },
        },
      ]);
      onClose();
    } catch (error) {
      console.error("Failed to add to canvas:", error);
      // 可以在这里添加错误提示
    }
  }, [notesContent, setPendingItems, onClose]);

  // 当面板状态或阅读模式改变时重新计算缩放
  useEffect(() => {
    if (originalPageSize.width > 0) {
      const timeoutId = setTimeout(() => {
        const newScale = calculateFitToWidthScale(originalPageSize.width);
        setScale(newScale);
        console.log("Scale updated due to layout change:", newScale);
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [
    isRightPanelOpen,
    isIndexPanelOpen,
    rightPanelWidth,
    readingMode,
    calculateFitToWidthScale,
    originalPageSize.width,
  ]);

  // PDF 视图状态对象（用于 PDFToolbarInline）
  const pdfViewState: PDFViewState = useMemo(() => ({
    pageNumber,
    numPages,
    scale,
    readingMode,
  }), [pageNumber, numPages, scale, readingMode]);

  // 处理视图状态变化
  const handleViewStateChange = useCallback((state: Partial<PDFViewState>) => {
    if (state.scale !== undefined) setScale(state.scale);
    if (state.readingMode !== undefined) handleReadingModeChange(state.readingMode);
  }, [handleReadingModeChange]);

  // 论文库对话框状态
  const [isPaperLibraryOpen, setIsPaperLibraryOpen] = useState(false);

  // 多文档回调
  const handleSelectDocument = useCallback((_id: string) => {
    // Phase 2: 实现多文档切换
    console.log("Document switch not yet implemented");
  }, []);

  const handleCloseDocument = useCallback((_id: string) => {
    // Phase 2: 实现多文档关闭
    onClose();
  }, [onClose]);

  const handleAddDocument = useCallback(() => {
    // 打开论文库对话框
    setIsPaperLibraryOpen(true);
  }, []);

  const handleSelectPaperFromLibrary = useCallback((paper: PaperMeta) => {
    console.log("Selected paper from library:", paper.arxivId);
    
    // 使用 API 路由获取 PDF（避免直接访问静态文件的问题）
    // 格式：/api/ocr/{arxivId}/pdf
    const pdfPath = paper.pdfPath || `/api/ocr/${paper.arxivId}/pdf`;
    
    // 创建新的 PDF 源
    const newSource: PDFSource = {
      type: "url",
      path: pdfPath,
      arxivId: paper.arxivId,
    };
    
    console.log("New PDF source:", newSource);
    
    // 重置状态
    setLoading(true);
    setError("");
    setNumPages(0);
    setScale(1.0);
    
    // 切换到新的 PDF 源
    setCurrentPdfSource(newSource);
    
    // 关闭论文库对话框
    setIsPaperLibraryOpen(false);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="pdf-reader-container relative h-full w-full bg-stone-200/50 flex flex-col overflow-hidden p-2 gap-2"
    >
      {/* 顶栏 - 文档标签页 + 面板切换 */}
      <PDFReaderTopBar
        documents={documents}
        activeDocumentId={activeDocumentId}
        onSelectDocument={handleSelectDocument}
        onCloseDocument={handleCloseDocument}
        onAddDocument={handleAddDocument}
        onMinimize={onClose}
        isLeftPanelOpen={isIndexPanelOpen}
        onToggleLeftPanel={() => setIsIndexPanelOpen(!isIndexPanelOpen)}
        isRightPanelOpen={isRightPanelOpen}
        onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
      />

      {/* 主内容区域 - 三栏布局 */}
      <div className="flex-1 flex overflow-hidden relative gap-2">
        {/* 左侧面板 - Index Panel (固定宽度) */}
        <IndexPanel
          file={pdfUrl}
          currentPage={pageNumber}
          numPages={numPages}
          onPageChange={goToPage}
          isOpen={isIndexPanelOpen}
          onClose={() => setIsIndexPanelOpen(false)}
          paperContext={paperContext}
          onOpenReferenceInReader={(arxivId) => {
            // 从 API 获取论文 PDF 路径并加载
            handleSelectPaperFromLibrary({
              id: arxivId,
              title: "",
              authors: [],
              arxivId,
              pdfPath: `/data/output/${arxivId}/${arxivId}.pdf`,
              hasOCRData: true,
            });
          }}
        />

        {/* 中间 PDF 容器 (包含内嵌工具栏 + 渲染器) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-xl shadow-sm border border-stone-200/80">
          {/* 内嵌工具栏 - 阅读模式 / 搜索 / 页码 / 缩放 */}
          <PDFToolbarInline
            viewState={pdfViewState}
            onViewStateChange={handleViewStateChange}
            onSearch={searchPDF}
            searchResults={searchResults}
            currentResultIndex={currentResultIndex}
            onNavigateResult={navigateResult}
            onClearSearch={clearSearch}
            onPrevPage={goToPrevPage}
            onNextPage={goToNextPage}
            canGoToPrev={canGoToPrev}
            canGoToNext={canGoToNext}
            className="rounded-t-xl"
          />
          
          {/* PDF 渲染区域 */}
          <div className="flex-1 overflow-auto">
            {pdfUrl ? (
              <PDFRenderer
                pdfUrl={pdfUrl}
                numPages={numPages}
                pageNumber={pageNumber}
                scale={scale}
                loading={loading}
                error={error}
                readingMode={readingMode}
                originalPageSize={originalPageSize}
                pdfOptions={pdfOptions}
                onLoadSuccess={handleLoadSuccess}
                onLoadError={handleLoadError}
                onPageLoadSuccess={handlePageLoadSuccess}
                hoverTimerRef={hoverTimerRef}
                setHoveredWord={setHoveredWord}
                selectedText={selectedText}
                setSelectedText={setSelectedText}
                searchResults={searchResults}
                currentResultIndex={currentResultIndex}
                onPageChange={goToPage}
                onItemClick={handlePDFItemClick}
                // 句子交互层相关props
                // TODO: [OCR_SERVICE] 当 ENABLE_SENTENCE_LAYER = false 时，SentenceLayer 不会渲染
                isSentenceLayerEnabled={ENABLE_SENTENCE_LAYER && isSentenceLayerEnabled}
                sentences={ENABLE_SENTENCE_LAYER ? sentences : []}
                selectedSentenceIds={ENABLE_SENTENCE_LAYER ? highlightedSentenceIds : []}
                onSentenceClick={ENABLE_SENTENCE_LAYER ? handleSentenceClick : undefined}
                // 对象选择层相关props (图像、表格等)
                // 当有 OCR 数据且 detections 不为空时启用
                isObjectLayerEnabled={ENABLE_OBJECT_SELECTION && hasOCRData}
                pageDetections={paperContext?.detections || []}
                // OCR 图像尺寸 (从第一页 meta 获取，用于坐标转换)
                ocrImageSize={paperContext?.pages?.[0]?.meta}
                // Paper ID for image path construction
                paperId={paperId}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-red-600 mb-2">PDF Loading Failed</p>
                  <p className="text-gray-600 text-sm">
                    {error || "Invalid PDF URL"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧 AI 面板 */}
        <AIRightPanel
          isOpen={isRightPanelOpen}
          onClose={() => setIsRightPanelOpen(false)}
          onWidthChange={setRightPanelWidth}
          onNavigateToPage={goToPage}
        />
      </div>

      {/* 选择文本弹窗 */}
      {selectedText && (
        <SelectionPopup
          position={selectedText.position}
          selectedText={selectedText.text}
          pageNumber={pageNumber}
          onClose={() => setSelectedText(null)}
        />
      )}

      {/* 句子选择弹窗 */}
      {selectedSentences && (
        <SelectionPopup
          position={selectedSentences.position}
          selectedText={selectedSentences.contents.join(" ")}
          pageNumber={pageNumber}
          onClose={() => setSelectedSentences(null)}
        />
      )}

      {/* 快捷键浮动按钮 */}
      <ShortcutsFloatingButton
        isIndexPanelOpen={isIndexPanelOpen}
        isOpen={isShortcutsOpen}
        onToggle={setIsShortcutsOpen}
      />

      {/* 论文库对话框 */}
      <PaperLibraryDialog
        isOpen={isPaperLibraryOpen}
        onClose={() => setIsPaperLibraryOpen(false)}
        onSelectPaper={handleSelectPaperFromLibrary}
        openPaperIds={documents.map((d) => d.id)}
      />
    </div>
  );
};

export default PDFReader;

// 多文档版本导出
export { PDFReaderWrapper } from "./PDFReaderWrapper";
export { PDFReaderContent } from "./PDFReaderContent";
export { useMultiDocumentStore } from "./store/multiDocumentStore";
