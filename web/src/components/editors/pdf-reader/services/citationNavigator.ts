/**
 * 引用导航器
 * 
 * 处理跨论文引用的跳转逻辑
 */

import { Citation, CitationValidationResult } from '../types/citation';
import { PDFSource } from '@/types/paperContext';

// ============================================================
// 类型定义
// ============================================================

/**
 * 导航目标
 */
export interface NavigationTarget {
  paperId: string;
  detectionId: string;
  pageNumber: number;
}

/**
 * 导航结果
 */
export interface NavigationResult {
  success: boolean;
  action: 'switched' | 'scrolled' | 'opened' | 'failed';
  message?: string;
}

/**
 * 文档状态检查器接口
 * 由外部 store 实现
 */
export interface DocumentStateChecker {
  /** 检查论文是否已打开 */
  isDocumentOpen(paperId: string): boolean;
  
  /** 获取当前活动文档 ID */
  getActiveDocumentId(): string | null;
  
  /** 切换到指定文档 */
  switchToDocument(paperId: string): void;
  
  /** 打开新文档 */
  openDocument(source: PDFSource): string;
  
  /** 获取论文标题 */
  getPaperTitle(paperId: string): string | undefined;
}

/**
 * PDF 滚动控制器接口
 * 由外部 citation store 实现
 */
export interface PDFScrollController {
  /** 滚动到指定 detection */
  scrollToDetection(detectionId: string, paperId?: string): void;
  
  /** 高亮指定 detection */
  highlightDetection(detectionId: string, paperId?: string): void;
  
  /** 检查 detection 是否存在 */
  hasDetection(detectionId: string, paperId?: string): boolean;
}

// ============================================================
// CitationNavigator 类
// ============================================================

export class CitationNavigator {
  private documentChecker: DocumentStateChecker | null = null;
  private scrollController: PDFScrollController | null = null;
  
  /**
   * 注册文档状态检查器
   */
  registerDocumentChecker(checker: DocumentStateChecker): void {
    this.documentChecker = checker;
  }
  
  /**
   * 注册滚动控制器
   */
  registerScrollController(controller: PDFScrollController): void {
    this.scrollController = controller;
  }
  
  /**
   * 导航到引用位置
   * 
   * @param citation - 目标引用
   * @returns 导航结果
   */
  async navigate(citation: Citation): Promise<NavigationResult> {
    if (!this.documentChecker || !this.scrollController) {
      return {
        success: false,
        action: 'failed',
        message: 'Navigator not properly initialized',
      };
    }
    
    const { paperId, detectionId, pageNumber } = citation;
    const currentActiveId = this.documentChecker.getActiveDocumentId();
    
    // Case 1: 目标论文是当前活动文档
    if (currentActiveId === paperId) {
      return this.scrollToTarget(detectionId, paperId);
    }
    
    // Case 2: 目标论文已打开但不是当前活动
    if (this.documentChecker.isDocumentOpen(paperId)) {
      this.documentChecker.switchToDocument(paperId);
      
      // 等待文档切换完成后滚动
      await this.waitForDocumentSwitch(paperId);
      return this.scrollToTarget(detectionId, paperId);
    }
    
    // Case 3: 目标论文未打开，需要加载
    return this.openAndNavigate(paperId, detectionId, pageNumber);
  }
  
  /**
   * 检查是否可以导航到目标
   */
  canNavigate(citation: Citation): boolean {
    if (!this.documentChecker) return false;
    
    // 已打开的文档可以导航
    if (this.documentChecker.isDocumentOpen(citation.paperId)) {
      return true;
    }
    
    // 未打开的文档也可以尝试打开
    return true;
  }
  
  /**
   * 验证引用
   */
  validateCitation(
    citation: Citation,
    availableDetections?: Map<string, Set<string>>
  ): CitationValidationResult {
    // 如果没有提供检测数据，假设有效
    if (!availableDetections) {
      return { valid: true };
    }
    
    const paperDetections = availableDetections.get(citation.paperId);
    
    if (!paperDetections) {
      return {
        valid: false,
        error: 'unknown_paper',
        suggestion: `论文 ${citation.paperId} 未加载`,
      };
    }
    
    if (!paperDetections.has(citation.detectionId)) {
      return {
        valid: false,
        error: 'unknown_detection',
        suggestion: `位置 ${citation.detectionId} 不存在`,
      };
    }
    
    return { valid: true };
  }
  
  /**
   * 预加载论文 (用于优化跳转体验)
   */
  async preloadPaper(paperId: string): Promise<void> {
    if (!this.documentChecker) return;
    
    if (this.documentChecker.isDocumentOpen(paperId)) {
      return; // 已加载
    }
    
    // 可以在这里实现预加载逻辑
    // 例如：预获取 PDF 元数据，预加载检测数据等
    console.log(`[CitationNavigator] Preloading paper: ${paperId}`);
  }
  
  // ============================================================
  // 私有方法
  // ============================================================
  
  private scrollToTarget(detectionId: string, paperId: string): NavigationResult {
    if (!this.scrollController) {
      return {
        success: false,
        action: 'failed',
        message: 'Scroll controller not available',
      };
    }
    
    try {
      this.scrollController.scrollToDetection(detectionId, paperId);
      this.scrollController.highlightDetection(detectionId, paperId);
      
      return {
        success: true,
        action: 'scrolled',
      };
    } catch (error) {
      return {
        success: false,
        action: 'failed',
        message: error instanceof Error ? error.message : 'Scroll failed',
      };
    }
  }
  
  private async openAndNavigate(
    paperId: string,
    detectionId: string,
    pageNumber: number
  ): Promise<NavigationResult> {
    if (!this.documentChecker) {
      return {
        success: false,
        action: 'failed',
        message: 'Document checker not available',
      };
    }
    
    try {
      // 构建 PDF 源
      const source: PDFSource = {
        type: 'arxiv',
        arxivId: paperId,
        path: `/api/ocr/${paperId}/pdf`,
      };
      
      // 打开文档
      const newDocId = this.documentChecker.openDocument(source);
      
      // 等待文档加载
      await this.waitForDocumentLoad(paperId);
      
      // 滚动到目标
      return this.scrollToTarget(detectionId, paperId);
      
    } catch (error) {
      return {
        success: false,
        action: 'failed',
        message: error instanceof Error ? error.message : 'Failed to open document',
      };
    }
  }
  
  private waitForDocumentSwitch(paperId: string): Promise<void> {
    return new Promise(resolve => {
      // 简单延迟等待 React 状态更新
      setTimeout(resolve, 100);
    });
  }
  
  private waitForDocumentLoad(paperId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 轮询检查文档是否加载完成
      let attempts = 0;
      const maxAttempts = 50; // 最多等待 5 秒
      
      const checkInterval = setInterval(() => {
        attempts++;
        
        if (this.scrollController?.hasDetection('p1_text_0', paperId)) {
          clearInterval(checkInterval);
          resolve();
          return;
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          // 即使超时也尝试继续
          resolve();
        }
      }, 100);
    });
  }
}

// ============================================================
// 便捷导航函数
// ============================================================

/**
 * 触发导航到指定 detection
 * 通过 CustomEvent 触发，由 PDFRenderer 监听
 */
export function emitScrollToDetection(detectionId: string, paperId?: string): void {
  const event = new CustomEvent('pdf-scroll-to-detection', {
    detail: { detectionId, paperId },
  });
  window.dispatchEvent(event);
}

/**
 * 触发导航到指定页面
 */
export function emitScrollToPage(pageNumber: number, paperId?: string): void {
  const event = new CustomEvent('pdf-scroll-to-page', {
    detail: { pageNumber, paperId },
  });
  window.dispatchEvent(event);
}

// ============================================================
// 单例导出
// ============================================================

export const citationNavigator = new CitationNavigator();
