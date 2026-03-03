/**
 * useAIPaperReader Hook
 * 
 * 集成 AI 功能到 PDF Reader 的高层 Hook
 * 管理 Paper Context、Agent Service 和 AI Store 的协调
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import { usePaperContext } from './usePaperContext';
import { useAIStore } from '../store/aiStore';
import { useCitationStore } from '../store/citationStore';
import {
  getDefaultPaperAgentService,
  createAgentConfigAsync,
} from '../services/paperAgentService';
import { getDefaultSourceMatchingService } from '../services/sourceMatchingService';
import {
  PaperContext,
  PaperInsight,
  InsightType,
  StreamEvent,
  SourceCitation,
  PDFSource,
} from '@/types/paperContext';

import { createEditorEventEmitter } from "@/lib/events";

const emitEvent = createEditorEventEmitter('pdf-reader');

// ============================================================
// Types
// ============================================================

export interface UseAIPaperReaderReturn {
  // Paper Context (full object for components that need it)
  paperContext: PaperContext;
  hasOCRData: boolean;
  isLoadingContext: boolean;
  contextError: string | null;
  
  // Agent
  isAgentReady: boolean;
  agentError: string | null;
  
  // Chat
  askPaper: (question: string) => Promise<void>;
  isChatLoading: boolean;
  
  // Insights
  generateInsights: (types?: InsightType[]) => Promise<void>;
  isInsightsLoading: boolean;
  
  // Source Matching
  findSourceForText: (text: string) => SourceCitation | null;
  
  // Navigation
  navigateToSource: (citation: SourceCitation) => void;
}

// ============================================================
// Hook
// ============================================================

export function useAIPaperReader(
  pdfSource: PDFSource,
  onNavigateToPage?: (pageNumber: number) => void
): UseAIPaperReaderReturn {
  const [isAgentReady, setIsAgentReady] = useState(false);
  
  // Paper Context - 注意：主 PDFReader 组件也会调用 usePaperContext
  // 这里的调用主要是为了同步到 AI Store
  // usePaperContext 内部会自动在 source 变化时重新加载
  const {
    context: paperContext,
    loadingState,
    hasOCRData,
    error: contextError,
  } = usePaperContext(pdfSource, { autoLoadOCR: true });

  // AI Store
  const {
    switchToPaper,
    addChatMessage,
    setChatLoading,
    appendToStreamingMessage,
    finishStreamingMessage,
    setChatError,
    setInsights,
    setInsightsLoading,
    setInsightsError,
    highlightFromCitation,
    setAgentInitialized,
    setAgentError,
    chatLoading,
    insightsLoading,
  } = useAIStore();

  // Services
  const agentService = useMemo(() => getDefaultPaperAgentService(), []);
  const sourceMatchingService = useMemo(() => getDefaultSourceMatchingService(), []);

  // 初始化 Agent
  // 注意：API Key 现在由服务端管理，客户端不需要检查
  useEffect(() => {
    const initAgent = async () => {
      try {
        const config = await createAgentConfigAsync();
        await agentService.initialize(config);
        setIsAgentReady(true);
        setAgentInitialized(true);
        setAgentError(null);
      } catch (error) {
        console.error('Failed to initialize agent:', error);
        setAgentError(error instanceof Error ? error.message : 'Failed to initialize agent');
        setIsAgentReady(false);
      }
    };

    initAgent();
  }, [agentService, setAgentInitialized, setAgentError]);

  // Citation Store
  const {
    loadDetections,
    setMetadata,
    setActivePaper,
  } = useCitationStore();

  // 获取论文 ID
  const paperId = pdfSource.arxivId || pdfSource.path || 'default';

  // 立即切换活动论文 ID（不等待 OCR 加载）
  // 这确保 Chat 和 Insights 组件能够立即切换到对应论文的会话/缓存
  useEffect(() => {
    if (paperId && paperId !== 'default') {
      console.log('[useAIPaperReader] Immediately switching active paper ID:', paperId);
      // 只切换 ID，context 等 OCR 加载后再更新
      switchToPaper(paperId);
    }
  }, [paperId, switchToPaper]);

  // 当 OCR 数据加载完成时，更新完整的 Paper Context
  useEffect(() => {
    if (paperContext && paperId && paperContext.hasOCRData && paperContext.detections.length > 0) {
      console.log('[useAIPaperReader] Updating paper context with OCR data:', paperId, {
        hasOCRData: paperContext.hasOCRData,
        detectionsCount: paperContext.detections.length,
        markdownLength: paperContext.markdown?.length || 0,
      });
      // 更新完整的 context（包含 OCR 数据）
      switchToPaper(paperId, paperContext);
    }
  }, [paperContext, paperId, paperContext?.hasOCRData, paperContext?.detections?.length, switchToPaper]);

  // 加载检测数据到 Citation Store (用于双向索引)
  useEffect(() => {
    if (paperContext.hasOCRData && paperContext.detections.length > 0) {
      console.log('[useAIPaperReader] Loading detections to CitationStore for paper:', paperId);
      
      // 设置活动论文
      setActivePaper(paperId);
      
      // 加载检测数据 (带 paperId)
      loadDetections(paperContext.detections, paperId);
      
      if (paperContext.metadata) {
        setMetadata(paperContext.metadata);
      }
    }
    
    // 不在卸载时重置 - 保留缓存供切换回来使用
  }, [paperContext.hasOCRData, paperContext.detections, paperContext.metadata, paperId, loadDetections, setMetadata, setActivePaper]);

  // 注意：论文加载现在由 usePaperContext 内部的 effect 处理
  // 当 pdfSource.arxivId 或 pdfSource.path 变化时会自动重新加载

  // 发送问题
  const askPaper = useCallback(async (question: string) => {
    if (!isAgentReady || !paperContext.hasOCRData) {
      console.warn('Agent not ready or no OCR data');
      return;
    }

    // 添加用户消息
    addChatMessage({
      role: 'user',
      content: question,
    });

    setChatLoading(true);

    // 添加 AI 响应占位符
    addChatMessage({
      role: 'assistant',
      content: '',
      streaming: true,
    });

    try {
      let responseContent = '';
      await agentService.askPaper(
        question,
        paperContext,
        (event: StreamEvent) => {
          switch (event.type) {
            case 'text_delta':
              responseContent += event.data as string;
              appendToStreamingMessage(event.data as string);
              break;
            case 'text_done':
              finishStreamingMessage();
              // Emit event for demo flow (if in workspace context)
              emitEvent({
                type: 'actionComplete',
                payload: {
                  action: 'ai_chat',
                  result: { question, response: responseContent },
                },
              });
              break;
            case 'citation_found':
              highlightFromCitation(event.data as SourceCitation);
              break;
            case 'error':
              setChatError(event.data as string);
              break;
          }
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      setChatError(error instanceof Error ? error.message : 'Chat failed');
      // Emit failure event
      emitEvent({
        type: 'actionFailed',
        payload: {
          action: 'ai_chat',
          error: error instanceof Error ? error : new Error(String(error)),
        },
      });
    } finally {
      setChatLoading(false);
    }
  }, [
    isAgentReady,
    paperContext,
    agentService,
    addChatMessage,
    setChatLoading,
    appendToStreamingMessage,
    finishStreamingMessage,
    highlightFromCitation,
    setChatError,
  ]);

  // 生成洞察
  const generateInsights = useCallback(async (types?: InsightType[]) => {
    if (!isAgentReady || !paperContext.hasOCRData) {
      console.warn('Agent not ready or no OCR data');
      return;
    }

    setInsightsLoading(true);
    setInsightsError(null);

    try {
      const insights = await agentService.generateInsights(paperContext, types);
      setInsights(insights);
    } catch (error) {
      console.error('Insights generation error:', error);
      setInsightsError(error instanceof Error ? error.message : 'Failed to generate insights');
    } finally {
      setInsightsLoading(false);
    }
  }, [
    isAgentReady,
    paperContext,
    agentService,
    setInsights,
    setInsightsLoading,
    setInsightsError,
  ]);

  // 查找文本来源
  const findSourceForText = useCallback((text: string): SourceCitation | null => {
    if (!paperContext.hasOCRData) return null;
    return sourceMatchingService.matchTextToSource(text, paperContext);
  }, [paperContext, sourceMatchingService]);

  // 导航到来源
  const navigateToSource = useCallback((citation: SourceCitation) => {
    onNavigateToPage?.(citation.pageNumber);
    highlightFromCitation(citation);
  }, [onNavigateToPage, highlightFromCitation]);

  return {
    // Paper Context (full object)
    paperContext,
    hasOCRData: paperContext.hasOCRData,
    isLoadingContext: loadingState === 'loading_pdf' || loadingState === 'loading_ocr',
    contextError,
    
    // Agent
    isAgentReady,
    agentError: useAIStore.getState().agentError,
    
    // Chat
    askPaper,
    isChatLoading: chatLoading,
    
    // Insights
    generateInsights,
    isInsightsLoading: insightsLoading,
    
    // Source Matching
    findSourceForText,
    
    // Navigation
    navigateToSource,
  };
}

