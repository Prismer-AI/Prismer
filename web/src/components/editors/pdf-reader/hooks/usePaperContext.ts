/**
 * usePaperContext Hook
 * 
 * 管理论文上下文的加载和状态
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PDFSource,
  PaperContext,
  PaperLoadingState,
  createPDFSource,
  createEmptyPaperContext,
} from '@/types/paperContext';
import { getDefaultPaperContextProvider } from '../services/paperContextProvider';

export interface UsePaperContextOptions {
  /** 自动加载 OCR 数据 */
  autoLoadOCR?: boolean;
  /** OCR 数据基础路径 */
  ocrBasePath?: string;
}

export interface UsePaperContextReturn {
  /** 论文上下文 */
  context: PaperContext;
  /** 加载状态 */
  loadingState: PaperLoadingState;
  /** 是否有 OCR 数据 */
  hasOCRData: boolean;
  /** 错误信息 */
  error: string | null;
  /** 加载论文 */
  loadPaper: (source: PDFSource) => Promise<void>;
  /** 从文件路径加载 */
  loadFromFile: (filePath: string, arxivId?: string) => Promise<void>;
  /** 从 URL 加载 */
  loadFromUrl: (url: string, arxivId?: string) => Promise<void>;
  /** 从 ArXiv ID 加载 */
  loadFromArxiv: (arxivId: string) => Promise<void>;
  /** 重新加载 OCR 数据 */
  reloadOCRData: () => Promise<void>;
  /** 清除上下文 */
  clearContext: () => void;
}

/**
 * 论文上下文 Hook
 */
export function usePaperContext(
  initialSource?: PDFSource,
  options: UsePaperContextOptions = {}
): UsePaperContextReturn {
  const { autoLoadOCR = true } = options;
  
  const [context, setContext] = useState<PaperContext>(() => 
    initialSource 
      ? createEmptyPaperContext(initialSource)
      : createEmptyPaperContext(createPDFSource.fromFile(''))
  );
  
  const [error, setError] = useState<string | null>(null);

  const provider = useMemo(() => getDefaultPaperContextProvider(), []);

  /**
   * 加载论文
   */
  const loadPaper = useCallback(async (source: PDFSource) => {
    setError(null);
    setContext(prev => ({
      ...prev,
      source,
      loadingState: 'loading_pdf',
    }));

    try {
      const loadedContext = await provider.loadContext(source);
      setContext(loadedContext);
      
      if (loadedContext.error) {
        setError(loadedContext.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load paper';
      setError(errorMessage);
      setContext(prev => ({
        ...prev,
        loadingState: 'error',
        error: errorMessage,
      }));
    }
  }, [provider]);

  /**
   * 从文件路径加载
   */
  const loadFromFile = useCallback(async (filePath: string, arxivId?: string) => {
    const source = createPDFSource.fromFile(filePath, arxivId);
    await loadPaper(source);
  }, [loadPaper]);

  /**
   * 从 URL 加载
   */
  const loadFromUrl = useCallback(async (url: string, arxivId?: string) => {
    const source = createPDFSource.fromUrl(url, arxivId);
    await loadPaper(source);
  }, [loadPaper]);

  /**
   * 从 ArXiv ID 加载
   */
  const loadFromArxiv = useCallback(async (arxivId: string) => {
    const source = createPDFSource.fromArxiv(arxivId);
    await loadPaper(source);
  }, [loadPaper]);

  /**
   * 重新加载 OCR 数据
   */
  const reloadOCRData = useCallback(async () => {
    if (!context.source.arxivId) {
      setError('No ArXiv ID available for OCR data');
      return;
    }

    setContext(prev => ({ ...prev, loadingState: 'loading_ocr' }));

    try {
      const ocrData = await provider.loadOCRData(context.source.arxivId);
      
      if (ocrData) {
        setContext(prev => ({
          ...prev,
          metadata: ocrData.metadata,
          detections: ocrData.detections,
          markdown: ocrData.ocrResult?.markdown_content || '',
          pages: ocrData.ocrResult?.pages || [],
          hasOCRData: true,
          loadingState: 'ready',
        }));
      } else {
        setContext(prev => ({
          ...prev,
          hasOCRData: false,
          loadingState: 'ready',
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load OCR data';
      setError(errorMessage);
      setContext(prev => ({
        ...prev,
        loadingState: 'error',
        error: errorMessage,
      }));
    }
  }, [context.source.arxivId, provider]);

  /**
   * 清除上下文
   */
  const clearContext = useCallback(() => {
    setContext(createEmptyPaperContext(createPDFSource.fromFile('')));
    setError(null);
  }, []);

  /**
   * 当 source 变化时重新加载
   * 使用 arxivId 或 path 作为稳定的依赖值，避免对象引用变化导致的无限循环
   */
  const sourceKey = initialSource?.arxivId || initialSource?.path || '';
  
  useEffect(() => {
    if (initialSource && autoLoadOCR && sourceKey) {
      console.log('[usePaperContext] Source changed, loading paper:', sourceKey);
      loadPaper(initialSource);
    }
  }, [sourceKey, autoLoadOCR, loadPaper, initialSource]);

  return {
    context,
    loadingState: context.loadingState,
    hasOCRData: context.hasOCRData,
    error,
    loadPaper,
    loadFromFile,
    loadFromUrl,
    loadFromArxiv,
    reloadOCRData,
    clearContext,
  };
}

/**
 * 从 pdfData prop 创建 PDFSource
 * 兼容现有的 PDFReader 组件接口
 */
export function createSourceFromPdfData(pdfData: {
  source_path?: string;
  pdf_url?: string;
  arxiv_id?: string;
  sents?: unknown;
}): PDFSource {
  const arxivId = pdfData.arxiv_id;
  
  // 优先使用 source_path
  if (pdfData.source_path) {
    // 判断是 URL 还是文件路径
    if (pdfData.source_path.startsWith('http')) {
      return createPDFSource.fromUrl(pdfData.source_path, arxivId);
    }
    return createPDFSource.fromFile(pdfData.source_path, arxivId);
  }
  
  // 其次使用 pdf_url
  if (pdfData.pdf_url) {
    return createPDFSource.fromUrl(pdfData.pdf_url, arxivId);
  }
  
  // 如果有 arxiv_id，使用 ArXiv 源
  if (arxivId) {
    return createPDFSource.fromArxiv(arxivId);
  }
  
  // 默认返回空文件源
  return createPDFSource.fromFile('');
}

