"use client";

/**
 * PDF Reader Wrapper
 * 
 * 多文档管理包装组件
 * - 管理多个打开的文档
 * - 处理文档切换
 * - 论文库对话框
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PDFSource, createPDFSource } from "@/types/paperContext";
import { useMultiDocumentStore, selectDocumentList } from "./store/multiDocumentStore";
import { PaperLibraryDialog, PaperMeta } from "./components/PaperLibraryDialog";
import { PDFReaderTopBar } from "./components/PDFReaderTopBar";
import PDFReaderContent from "./PDFReaderContent";
import { OpenDocument } from "./components/DocumentTabs";
import { AssetBrowser, type AssetItem } from "@/components/shared/AssetBrowser";
import { FileText } from "lucide-react";
import { StorageProvider } from "@/lib/storage/provider";

// ============================================================================
// Types
// ============================================================================

interface PDFReaderWrapperProps {
  /** 初始 PDF 源（可选） */
  initialSource?: PDFSource;
  /** 关闭阅读器回调 */
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const PDFReaderWrapper: React.FC<PDFReaderWrapperProps> = ({
  initialSource,
  onClose,
}) => {
  // Multi-document store
  const {
    documents,
    activeDocumentId,
    tabOrder,
    openDocument,
    closeDocument,
    setActiveDocument,
    updateViewState,
    setDocumentNumPages,
    setDocumentContext,
    setDocumentLoadingState,
  } = useMultiDocumentStore();

  // Dialog states
  const [isPaperLibraryOpen, setIsPaperLibraryOpen] = useState(false);
  const [isAssetBrowserOpen, setIsAssetBrowserOpen] = useState(false);

  // Side panel states - left panel collapsed by default for cleaner initial view
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // 获取 reset 函数
  const { reset } = useMultiDocumentStore();
  
  // 记录初始 source 的 key，用于检测变化
  const initialSourceKey = initialSource?.arxivId || initialSource?.path || '';
  
  // 初始化：当组件挂载或 initialSource 变化时，重置 store 并打开新文档
  useEffect(() => {
    if (initialSource && initialSourceKey) {
      console.log('[PDFReaderWrapper] Initializing with source:', initialSourceKey);
      // 重置 store，确保每次从干净状态开始
      reset();
      // 打开新文档
      openDocument(initialSource);
    }
    
    // 组件卸载时重置 store
    return () => {
      console.log('[PDFReaderWrapper] Unmounting, resetting store');
      reset();
    };
  }, [initialSourceKey]); // 只依赖 sourceKey，避免无限循环

  // 获取当前活动文档
  const activeDocument = useMemo(() => {
    if (!activeDocumentId) return null;
    return documents.get(activeDocumentId) || null;
  }, [documents, activeDocumentId]);

  // 转换为 OpenDocument 格式供 DocumentTabs 使用
  const openDocuments: OpenDocument[] = useMemo(() => {
    return tabOrder.map((id) => {
      const doc = documents.get(id);
      if (!doc) return null;
      const title = doc.paperContext?.metadata?.title || doc.source.arxivId || "Untitled";
      return {
        id: doc.id,
        title: title.length > 25 ? title.slice(0, 25) + "..." : title,
        arxivId: doc.source.arxivId,
        isDirty: doc.isDirty,
      };
    }).filter(Boolean) as OpenDocument[];
  }, [tabOrder, documents]);

  // 处理选择论文（从论文库）
  const handleSelectPaper = useCallback((paper: PaperMeta) => {
    // 使用 API 路由获取 PDF（更可靠）
    const pdfPath = paper.pdfPath || `/api/ocr/${paper.arxivId}/pdf`;
    
    const source: PDFSource = {
      type: "url",
      path: pdfPath,
      arxivId: paper.arxivId,
    };
    
    console.log("[PDFReaderWrapper] Opening document:", source);
    openDocument(source);
  }, [openDocument]);

  // 处理关闭文档
  const handleCloseDocument = useCallback((id: string) => {
    const doc = documents.get(id);
    
    // 如果文档有未保存的更改，可以在这里添加确认对话框
    if (doc?.isDirty) {
      // TODO: 添加确认对话框
      console.log("Document has unsaved changes");
    }
    
    closeDocument(id);
    
    // 如果所有文档都关闭了，关闭整个阅读器
    if (documents.size <= 1) {
      onClose();
    }
  }, [documents, closeDocument, onClose]);

  // 处理切换文档
  const handleSelectDocument = useCallback((id: string) => {
    setActiveDocument(id);
  }, [setActiveDocument]);

  // 处理添加文档（从论文库）
  const handleAddDocument = useCallback(() => {
    setIsPaperLibraryOpen(true);
  }, []);

  // 处理从 Assets 添加文档
  const handleAddFromAssets = useCallback(() => {
    setIsAssetBrowserOpen(true);
  }, []);

  // 处理选择 Asset
  const handleSelectAsset = useCallback((asset: AssetItem) => {
    // Parse metadata to get sourceId for the PDF source
    const metadata = (asset as unknown as { metadata?: Record<string, unknown> }).metadata;
    const sourceId = metadata?.sourceId as string | undefined;

    let source: PDFSource;
    if (sourceId) {
      // Upload asset with sourceId — use OCR API path
      source = createPDFSource.fromUrl(`/api/ocr/${sourceId}/pdf`, sourceId);
    } else {
      // Fallback: use asset ID as source
      source = createPDFSource.fromUrl(`/api/v2/assets/${asset.id}/file`);
    }

    console.log("[PDFReaderWrapper] Opening asset:", asset.title, source);
    openDocument(source);
  }, [openDocument]);

  // 如果没有文档，显示空状态
  if (!activeDocument) {
    return (
      <div className="h-full w-full bg-stone-200/50 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <FileText className="w-16 h-16 text-stone-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-stone-600 mb-2">No Document Open</h2>
          <p className="text-stone-500 mb-4">Open a paper from the library to start reading</p>
          <button
            onClick={() => setIsPaperLibraryOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Open Paper Library
          </button>
        </div>
        
        <PaperLibraryDialog
          isOpen={isPaperLibraryOpen}
          onClose={() => setIsPaperLibraryOpen(false)}
          onSelectPaper={handleSelectPaper}
          openPaperIds={tabOrder}
        />
      </div>
    );
  }

  return (
    <div className="pdf-reader-wrapper h-full w-full bg-stone-200/50 flex flex-col overflow-hidden p-2 gap-2">
      {/* 顶栏 */}
      <PDFReaderTopBar
        documents={openDocuments}
        activeDocumentId={activeDocumentId}
        currentArxivId={activeDocument?.source.arxivId}
        currentTitle={activeDocument?.paperContext?.metadata?.title}
        onSelectDocument={handleSelectDocument}
        onCloseDocument={handleCloseDocument}
        onAddDocument={handleAddDocument}
        onAddFromAssets={handleAddFromAssets}
        onMinimize={onClose}
        isLeftPanelOpen={isLeftPanelOpen}
        onToggleLeftPanel={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
        isRightPanelOpen={isRightPanelOpen}
        onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
      />

      {/* 文档内容区域 */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeDocumentId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <PDFReaderContent
              documentId={activeDocument.id}
              pdfSource={activeDocument.source}
              isLeftPanelOpen={isLeftPanelOpen}
              isRightPanelOpen={isRightPanelOpen}
              onToggleLeftPanel={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
              onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 论文库对话框 */}
      <PaperLibraryDialog
        isOpen={isPaperLibraryOpen}
        onClose={() => setIsPaperLibraryOpen(false)}
        onSelectPaper={handleSelectPaper}
        openPaperIds={tabOrder}
      />

      {/* Asset 浏览器对话框 */}
      <AssetBrowser
        isOpen={isAssetBrowserOpen}
        onClose={() => setIsAssetBrowserOpen(false)}
        onSelect={handleSelectAsset}
        filterType="paper"
        title="Open from Assets"
      />
    </div>
  );
};

/**
 * PDFReaderWrapper with StorageProvider
 * 
 * 包装组件，确保 StorageProvider 可用于持久化 hooks
 */
const PDFReaderWrapperWithStorage: React.FC<PDFReaderWrapperProps> = (props) => {
  return (
    <StorageProvider>
      <PDFReaderWrapper {...props} />
    </StorageProvider>
  );
};

export default PDFReaderWrapperWithStorage;

