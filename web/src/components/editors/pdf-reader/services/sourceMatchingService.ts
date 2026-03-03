/**
 * Source Matching Service
 * 
 * 将 AI 回答中的引用文本匹配到 PDF 原文位置
 * 实现精准溯源功能
 */

import {
  PaperContext,
  SourceCitation,
  BoundingBox,
  PageDetection,
  ISourceMatchingService,
} from '@/types/paperContext';

/**
 * 模糊匹配选项
 */
interface FuzzyMatchOptions {
  /** 最小匹配分数 (0-1) */
  minScore?: number;
  /** 是否忽略大小写 */
  ignoreCase?: boolean;
  /** 是否忽略空白字符差异 */
  ignoreWhitespace?: boolean;
}

/**
 * 匹配结果
 */
interface MatchResult {
  pageNumber: number;
  score: number;
  matchedText: string;
  bbox?: BoundingBox;
  detection?: PageDetection['detections'][0];
}

/**
 * Source Matching Service 实现
 */
export class SourceMatchingService implements ISourceMatchingService {
  private defaultOptions: FuzzyMatchOptions = {
    minScore: 0.6,
    ignoreCase: true,
    ignoreWhitespace: true,
  };

  /**
   * 将文本匹配到 PDF 位置
   */
  matchTextToSource(
    text: string,
    context: PaperContext,
    options?: FuzzyMatchOptions
  ): SourceCitation | null {
    const opts = { ...this.defaultOptions, ...options };
    const normalizedText = this.normalizeText(text, opts);
    
    if (!normalizedText || normalizedText.length < 10) {
      return null;
    }

    // 首先在 markdown 中搜索
    const pageHits = this.searchInMarkdown(normalizedText, context, opts);
    
    if (pageHits.length === 0) {
      return null;
    }

    // 取最佳匹配
    const bestHit = pageHits.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    // 尝试在 detections 中找到精确位置
    const bbox = this.findBboxForText(
      text,
      bestHit.pageNumber,
      context.detections,
      opts
    );

    return {
      id: `citation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: bestHit.matchedText || text,
      pageNumber: bestHit.pageNumber,
      bbox,
      confidence: bestHit.score,
    };
  }

  /**
   * 批量匹配
   */
  matchMultiple(
    texts: string[],
    context: PaperContext,
    options?: FuzzyMatchOptions
  ): SourceCitation[] {
    return texts
      .map(text => this.matchTextToSource(text, context, options))
      .filter((citation): citation is SourceCitation => citation !== null);
  }

  /**
   * 根据页码和坐标获取文本
   */
  getTextAtPosition(
    pageNumber: number,
    bbox: BoundingBox,
    context: PaperContext
  ): string | null {
    const pageDetections = context.detections.find(
      d => d.page_number === pageNumber
    );
    
    if (!pageDetections) {
      return null;
    }

    // 查找与 bbox 重叠的 detection
    for (const detection of pageDetections.detections) {
      for (const box of detection.boxes) {
        if (this.boxesOverlap(bbox, box)) {
          return detection.raw_text ?? null;
        }
      }
    }

    return null;
  }

  /**
   * 在 markdown 内容中搜索
   */
  private searchInMarkdown(
    text: string,
    context: PaperContext,
    options: FuzzyMatchOptions
  ): MatchResult[] {
    const results: MatchResult[] = [];

    // 按页面搜索
    for (const page of context.pages) {
      const pageContent = this.normalizeText(page.content, options);
      const score = this.calculateMatchScore(text, pageContent);
      
      if (score >= (options.minScore || 0.6)) {
        // 尝试找到最佳匹配的子串
        const matchedText = this.findBestMatchingSubstring(text, page.content);
        
        results.push({
          pageNumber: page.page_number,
          score,
          matchedText: matchedText || text,
        });
      }
    }

    // 按分数排序
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 在 detections 中查找精确 bbox
   */
  private findBboxForText(
    text: string,
    pageNumber: number,
    detections: PageDetection[],
    options: FuzzyMatchOptions
  ): BoundingBox | undefined {
    const pageDetections = detections.find(d => d.page_number === pageNumber);
    if (!pageDetections) return undefined;

    const normalizedText = this.normalizeText(text, options);
    let bestMatch: { detection: PageDetection['detections'][0]; score: number } | null = null;

    for (const detection of pageDetections.detections) {
      // 跳过非文本类型或无文本内容的检测
      if (!['text', 'title', 'sub_title'].includes(detection.label) || !detection.raw_text) {
        continue;
      }

      const detectionText = this.normalizeText(detection.raw_text, options);
      const score = this.calculateMatchScore(normalizedText, detectionText);

      if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { detection, score };
      }
    }

    if (bestMatch && bestMatch.detection.boxes.length > 0) {
      return bestMatch.detection.boxes[0];
    }

    return undefined;
  }

  /**
   * 规范化文本
   */
  private normalizeText(text: string, options: FuzzyMatchOptions): string {
    let normalized = text;
    
    if (options.ignoreCase) {
      normalized = normalized.toLowerCase();
    }
    
    if (options.ignoreWhitespace) {
      // 将多个空白字符替换为单个空格
      normalized = normalized.replace(/\s+/g, ' ').trim();
    }

    // 移除特殊字符
    normalized = normalized.replace(/[^\w\s]/g, '');

    return normalized;
  }

  /**
   * 计算匹配分数 (使用 Jaccard 相似度)
   */
  private calculateMatchScore(query: string, target: string): number {
    if (!query || !target) return 0;

    // 对于短文本，检查是否包含
    if (query.length < 50) {
      if (target.includes(query)) {
        return 1.0;
      }
    }

    // 使用 n-gram 相似度
    const queryGrams = this.getNGrams(query, 3);
    const targetGrams = this.getNGrams(target, 3);

    const intersection = queryGrams.filter(g => targetGrams.includes(g));
    const union = new Set([...queryGrams, ...targetGrams]);

    return union.size > 0 ? intersection.length / union.size : 0;
  }

  /**
   * 获取 n-gram
   */
  private getNGrams(text: string, n: number): string[] {
    const grams: string[] = [];
    for (let i = 0; i <= text.length - n; i++) {
      grams.push(text.slice(i, i + n));
    }
    return grams;
  }

  /**
   * 找到最佳匹配的子串
   */
  private findBestMatchingSubstring(query: string, content: string): string | null {
    // 简单实现：返回包含查询词的句子
    const sentences = content.split(/[.!?]+/);
    const queryWords = query.toLowerCase().split(/\s+/).slice(0, 5);

    let bestSentence: string | null = null;
    let bestScore = 0;

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      let score = 0;
      
      for (const word of queryWords) {
        if (lowerSentence.includes(word)) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence.trim();
      }
    }

    return bestSentence;
  }

  /**
   * 检查两个 bbox 是否重叠
   */
  private boxesOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
    // 使用像素坐标
    return !(
      box1.x2_px < box2.x1_px ||
      box1.x1_px > box2.x2_px ||
      box1.y2_px < box2.y1_px ||
      box1.y1_px > box2.y2_px
    );
  }
}

/**
 * 创建 Source Matching Service 实例
 */
export function createSourceMatchingService(): ISourceMatchingService {
  return new SourceMatchingService();
}

/**
 * 单例实例
 */
let defaultMatchingService: ISourceMatchingService | null = null;

export function getDefaultSourceMatchingService(): ISourceMatchingService {
  if (!defaultMatchingService) {
    defaultMatchingService = new SourceMatchingService();
  }
  return defaultMatchingService;
}


