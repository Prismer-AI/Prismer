/**
 * Context Builder
 * 
 * 构建多论文上下文用于 AI 对话
 * - 支持单论文和多论文模式
 * - Token 预算管理
 * - 智能压缩
 */

import { PaperContext, PageDetection, Detection, PaperMetadata } from '@/types/paperContext';
import { PaperAliasMap } from '../types/citation';
import { paperAliasAssigner } from './citationMapper';
import { ChatMessage } from '../store/chatSessionStore';

// ============================================================
// 类型定义
// ============================================================

/**
 * 论文上下文输入
 */
export interface PaperContextInput {
  id: string;
  title: string;
  context: PaperContext;
  priority: 'primary' | 'reference';
}

/**
 * 上下文构建选项
 */
export interface ContextBuildOptions {
  /** 目标论文列表 */
  papers: PaperContextInput[];
  
  /** 用户选择 */
  selection?: {
    paperId: string;
    detectionIds: string[];
    expandRadius?: number;
  };
  
  /** 会话历史 */
  conversationHistory?: ChatMessage[];
  historyLimit?: number;
  
  /** Token 限制 */
  maxTokens: number;
  
  /** 包含选项 */
  includeFigures: boolean;
  includeEquations: boolean;
  includeReferences: boolean;
}

/**
 * 构建结果
 */
export interface BuiltContext {
  /** 系统提示词 */
  systemPrompt: string;
  
  /** 用户上下文 */
  paperContext: string;
  
  /** 论文别名映射 */
  paperAliasMap: PaperAliasMap;
  
  /** 估算 Token 数 */
  estimatedTokens: number;
  
  /** 模式 */
  mode: 'single' | 'multi';
  
  /** Detection ID 到论文的映射 */
  detectionToPaper: Map<string, string>;
}

// ============================================================
// 常量
// ============================================================

const TOKENS_PER_CHAR = 0.25; // 粗略估算

const SECTION_PRIORITIES: Record<string, number> = {
  title: 1.0,
  abstract: 0.95,
  introduction: 0.9,
  method: 0.8,
  methods: 0.8,
  results: 0.8,
  discussion: 0.75,
  conclusion: 0.85,
  references: 0.3,
  appendix: 0.2,
};

// ============================================================
// ContextBuilder 类
// ============================================================

export class ContextBuilder {
  /**
   * 构建完整上下文
   */
  build(options: ContextBuildOptions): BuiltContext {
    const { papers } = options;
    const isMultiPaper = papers.length > 1;
    
    // 分配论文别名
    const paperIds = papers.map(p => p.id);
    const paperAliasMap = paperAliasAssigner.assignAliases(paperIds);
    
    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(papers, paperAliasMap, isMultiPaper);
    
    // 构建论文上下文
    const { paperContext, detectionToPaper } = this.buildPaperContext(
      papers,
      paperAliasMap,
      options
    );
    
    // 估算 Token
    const totalChars = systemPrompt.length + paperContext.length;
    const estimatedTokens = Math.ceil(totalChars * TOKENS_PER_CHAR);
    
    return {
      systemPrompt,
      paperContext,
      paperAliasMap,
      estimatedTokens,
      mode: isMultiPaper ? 'multi' : 'single',
      detectionToPaper,
    };
  }
  
  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(
    papers: PaperContextInput[],
    aliasMap: PaperAliasMap,
    isMultiPaper: boolean
  ): string {
    const lines: string[] = [];
    
    // 角色定义
    lines.push('# Role');
    lines.push('');
    lines.push('You are an expert academic paper analyst. Your task is to help users understand and analyze research papers.');
    lines.push('');
    
    // 论文标识
    lines.push('# Papers in This Session');
    lines.push('');
    
    for (const paper of papers) {
      const alias = paperAliasAssigner.getAliasForPaper(paper.id, aliasMap);
      const priority = paper.priority === 'primary' ? '(primary)' : '(reference)';
      lines.push(`- **${alias}**: "${paper.title}" ${priority}`);
    }
    lines.push('');
    
    // 引用格式
    lines.push('# Citation Format');
    lines.push('');
    
    if (isMultiPaper) {
      lines.push('When citing content from papers, use this format: `[[Paper:detection_id]]`');
      lines.push('');
      lines.push('Examples:');
      lines.push('- `[[A:p1_text_0]]` - cites paragraph 0 on page 1 of Paper A');
      lines.push('- `[[B:p3_image_0]]` - cites image 0 on page 3 of Paper B');
      lines.push('');
      lines.push('**IMPORTANT**: Always include the paper identifier prefix to distinguish sources.');
    } else {
      lines.push('When citing content, use this format: `[[detection_id]]`');
      lines.push('');
      lines.push('Examples:');
      lines.push('- `[[p1_text_0]]` - cites paragraph 0 on page 1');
      lines.push('- `[[p3_image_0]]` - cites image 0 on page 3');
    }
    lines.push('');
    
    // 输出要求
    lines.push('# Output Guidelines');
    lines.push('');
    lines.push('1. Provide accurate, well-structured responses');
    lines.push('2. Cite specific sections using the format above');
    lines.push('3. Use multiple citations when appropriate');
    lines.push('4. If information is not in the provided context, say so');
    lines.push('');
    
    return lines.join('\n');
  }
  
  /**
   * 构建论文上下文
   */
  private buildPaperContext(
    papers: PaperContextInput[],
    aliasMap: PaperAliasMap,
    options: ContextBuildOptions
  ): { paperContext: string; detectionToPaper: Map<string, string> } {
    const lines: string[] = [];
    const detectionToPaper = new Map<string, string>();
    const isMultiPaper = papers.length > 1;
    
    // 计算每篇论文的 token 预算
    const primaryPapers = papers.filter(p => p.priority === 'primary');
    const referencePapers = papers.filter(p => p.priority === 'reference');
    
    const primaryBudget = Math.floor(options.maxTokens * 0.7 / Math.max(primaryPapers.length, 1));
    const referenceBudget = Math.floor(options.maxTokens * 0.25 / Math.max(referencePapers.length, 1));
    
    for (const paper of papers) {
      const alias = paperAliasAssigner.getAliasForPaper(paper.id, aliasMap);
      const budget = paper.priority === 'primary' ? primaryBudget : referenceBudget;
      
      lines.push('---');
      lines.push('');
      lines.push(`## [Paper ${alias}] ${paper.title}`);
      lines.push('');
      
      // 构建论文内容
      const content = this.buildSinglePaperContext(
        paper,
        alias || 'A',
        budget,
        options,
        isMultiPaper,
        detectionToPaper
      );
      
      lines.push(content);
      lines.push('');
    }
    
    return {
      paperContext: lines.join('\n'),
      detectionToPaper,
    };
  }
  
  /**
   * 构建单篇论文的上下文
   */
  private buildSinglePaperContext(
    paper: PaperContextInput,
    alias: string,
    tokenBudget: number,
    options: ContextBuildOptions,
    isMultiPaper: boolean,
    detectionToPaper: Map<string, string>
  ): string {
    const lines: string[] = [];
    const charBudget = Math.floor(tokenBudget / TOKENS_PER_CHAR);
    let currentChars = 0;
    
    const { context } = paper;
    
    // 添加元数据
    if (context.metadata) {
      const meta = context.metadata;
      lines.push(`**Authors**: ${meta.authors?.join(', ') || 'Unknown'}`);
      if (meta.arxivId) lines.push(`**ArXiv**: ${meta.arxivId}`);
      lines.push('');
      currentChars += 200; // 估算
    }
    
    // 处理 detections
    if (context.detections && context.detections.length > 0) {
      const allDetections: Array<{ detection: Detection; pageNum: number }> = [];
      
      for (const pageDetection of context.detections) {
        for (const detection of pageDetection.detections) {
          allDetections.push({
            detection,
            pageNum: pageDetection.page_number,
          });
        }
      }
      
      // 按优先级排序
      const sortedDetections = this.prioritizeDetections(allDetections, options);
      
      // 添加 detections
      let currentSection = '';
      
      for (const { detection, pageNum } of sortedDetections) {
        if (currentChars >= charBudget) break;
        
        // 过滤类型
        if (!options.includeFigures && detection.label === 'image') continue;
        if (!options.includeEquations && detection.label === 'equation') continue;
        if (!options.includeReferences && detection.label === 'reference') continue;
        
        // 获取内容
        const text = detection.raw_text || detection.text || '';
        if (!text || text.length < 10) continue;
        
        // 构建 ID
        const detectionId = detection.id || `p${pageNum}_${detection.label}_0`;
        const fullId = isMultiPaper ? `${alias}:${detectionId}` : detectionId;
        
        // 记录映射
        detectionToPaper.set(detectionId, paper.id);
        
        // 检查是否需要新的章节标题
        const sectionLabel = this.getSectionLabel(detection.label);
        if (sectionLabel && sectionLabel !== currentSection) {
          currentSection = sectionLabel;
          lines.push(`### ${sectionLabel}`);
          lines.push('');
        }
        
        // 添加内容
        const truncatedText = text.slice(0, 1000); // 单个 detection 最大长度
        lines.push(`${fullId}: ${truncatedText}`);
        lines.push('');
        
        currentChars += truncatedText.length + 50;
      }
    } else if (context.markdown) {
      // 使用 Markdown 作为后备
      const truncated = context.markdown.slice(0, charBudget);
      lines.push(truncated);
    }
    
    return lines.join('\n');
  }
  
  /**
   * 按优先级排序 detections
   */
  private prioritizeDetections(
    detections: Array<{ detection: Detection; pageNum: number }>,
    options: ContextBuildOptions
  ): Array<{ detection: Detection; pageNum: number }> {
    return [...detections].sort((a, b) => {
      // 如果有选择，优先选中的
      if (options.selection) {
        const aSelected = options.selection.detectionIds.includes(a.detection.id || '');
        const bSelected = options.selection.detectionIds.includes(b.detection.id || '');
        if (aSelected && !bSelected) return -1;
        if (bSelected && !aSelected) return 1;
      }
      
      // 按类型优先级
      const aPriority = this.getLabelPriority(a.detection.label);
      const bPriority = this.getLabelPriority(b.detection.label);
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // 按页码
      return a.pageNum - b.pageNum;
    });
  }
  
  /**
   * 获取标签优先级
   */
  private getLabelPriority(label: string): number {
    switch (label) {
      case 'title': return 1.0;
      case 'sub_title': return 0.9;
      case 'text': return 0.7;
      case 'equation': return 0.6;
      case 'table': return 0.6;
      case 'image': return 0.5;
      case 'reference': return 0.2;
      default: return 0.5;
    }
  }
  
  /**
   * 获取章节标签
   */
  private getSectionLabel(label: string): string | null {
    switch (label) {
      case 'title': return 'Title';
      case 'sub_title': return null; // 使用实际标题
      case 'text': return null;
      case 'equation': return 'Equations';
      case 'table': return 'Tables';
      case 'image': return 'Figures';
      case 'reference': return 'References';
      default: return null;
    }
  }
  
  /**
   * 构建会话历史上下文
   */
  buildConversationContext(
    messages: ChatMessage[],
    limit: number = 10
  ): string {
    const recentMessages = messages.slice(-limit);
    
    const lines: string[] = [];
    lines.push('# Conversation History');
    lines.push('');
    
    for (const msg of recentMessages) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      // 去除标签以节省 token
      const content = msg.rawContent.replace(/\[\[.*?\]\]/g, '[citation]');
      const truncated = content.slice(0, 500);
      lines.push(`**${role}**: ${truncated}`);
      lines.push('');
    }
    
    return lines.join('\n');
  }
}

// ============================================================
// 单例导出
// ============================================================

export const contextBuilder = new ContextBuilder();
