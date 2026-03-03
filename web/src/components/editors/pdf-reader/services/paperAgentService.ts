/**
 * Paper Agent Service
 * 
 * AI 代理服务，负责处理论文相关的 AI 交互
 * 通过服务端代理 /api/ai/chat 调用 AI API，避免在客户端暴露 API Key
 */

import {
  PaperContext,
  PaperInsight,
  InsightType,
  SourceCitation,
  AgentConfig,
  StreamEvent,
  IPaperAgentService,
  PageDetection,
} from '@/types/paperContext';
import { aiChatStream, aiChat, type AIMessage } from '@/lib/services/ai-client';

/**
 * 默认系统指令
 */
const DEFAULT_INSTRUCTIONS = `You are an expert academic paper reader and research assistant.

Your responsibilities:
1. Answer questions about the paper accurately and comprehensively
2. **ALWAYS** cite specific sources using detection IDs in format: [[detection_id]]
3. Explain complex concepts in simple, accessible terms
4. Point out potential issues, limitations, or areas for future work
5. Help users understand the paper's contribution and significance

## CRITICAL: Citation Format
The paper content below has paragraphs prefixed with detection IDs like [p1_text_0], [p2_text_3], etc.

When you reference ANY information from the paper, you MUST cite the source using double brackets:
- Format: [[p1_text_0]] or [[p3_equation_1]]
- Place citations at the END of the relevant sentence or statement
- Use MULTIPLE different citations when discussing multiple points

### Examples:
✓ GOOD: "The model achieves 70% accuracy [[p5_text_2]] using a hybrid architecture [[p3_text_1]]."
✓ GOOD: "Key limitations include computational cost [[p10_text_0]] and data requirements [[p10_text_3]]."
✗ BAD: "The paper discusses various improvements." (missing citations)
✗ BAD: Using the same citation [[p1_text_0]] for everything

Always base your answers on the actual content of the paper provided.
If you're unsure about something, say so rather than making up information.`;

/**
 * IMRAD 范式的洞察提示词
 */
const INSIGHT_PROMPTS: Record<InsightType, string> = {
  core_problem: `Analyze the **Introduction** section:

1. **Research Gap**: What knowledge gap or problem does this paper identify?
2. **Research Question**: What is the specific research question being addressed?
3. **Motivation**: Why is this problem important?

Format as concise bullet points. 
**MANDATORY**: End EACH bullet point with a citation like [[p1_text_0]]. Use DIFFERENT detection IDs for different points - find the actual IDs from the paper content above.`,
  
  main_method: `Analyze the **Methods** section:

1. **Approach**: What is the main methodology/approach/framework proposed?
2. **Key Innovation**: What makes this approach novel?
3. **Technical Components**: What are the key technical components?

Format as concise bullet points with \`code formatting\` for technical terms.
**MANDATORY**: End EACH bullet point with a citation like [[p3_text_0]]. Use DIFFERENT detection IDs from the Methods section of the paper.`,
  
  key_results: `Analyze the **Results** section:

1. **Key Findings**: What are the main experimental results?
2. **Quantitative Results**: Report key metrics and performance numbers
3. **Comparisons**: How does it compare to baselines?

Format as bullet points. Use **bold** for metrics.
**MANDATORY**: End EACH bullet point with a citation like [[p8_text_0]] or [[p7_table_0]]. Use DIFFERENT detection IDs from the Results section.`,
  
  limitations: `Analyze the **Limitations**:

1. **Acknowledged Limitations**: What limitations do the authors mention?
2. **Scope Boundaries**: What is NOT addressed by this work?
3. **Potential Weaknesses**: What critical weaknesses can you identify?

Format as bullet points.
**MANDATORY**: End EACH bullet point with a citation like [[p15_text_0]]. Use DIFFERENT detection IDs from the Discussion/Limitations section.`,
  
  future_work: `Analyze **Future Work** directions:

1. **Explicit Suggestions**: What future directions do authors suggest?
2. **Open Questions**: What questions remain unanswered?
3. **Extension Opportunities**: How could this work be extended?

Format as bullet points.
**MANDATORY**: End EACH bullet point with a citation like [[p16_text_0]]. Use DIFFERENT detection IDs from the Conclusion/Future Work section.`,
  
  custom: `Provide a comprehensive IMRAD-based analysis of this paper.

**MANDATORY**: Cite every statement with detection IDs like [[p1_text_0]]. Use DIFFERENT IDs for different points.`,
};

/**
 * Paper Agent Service 实现
 * 使用服务端代理 /api/ai/chat
 */
export class PaperAgentService implements IPaperAgentService {
  private config: AgentConfig | null = null;
  private abortController: AbortController | null = null;
  private _isProcessing = false;

  get isProcessing(): boolean {
    return this._isProcessing;
  }

  /**
   * 初始化 Agent
   * 注意：API Key 现在由服务端管理，客户端不需要
   */
  async initialize(config: AgentConfig): Promise<void> {
    this.config = config;
  }

  /**
   * 发送问题并获取流式响应
   */
  async askPaper(
    question: string,
    context: PaperContext,
    onEvent: (event: StreamEvent) => void,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<void> {
    if (!this.config) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    this._isProcessing = true;
    this.abortController = new AbortController();

    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(question, context);

      // 构建消息数组
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];
      
      // 添加对话历史（如果有）
      if (conversationHistory && conversationHistory.length > 0) {
        const maxHistoryMessages = 20;
        const recentHistory = conversationHistory.slice(-maxHistoryMessages);
        
        for (const msg of recentHistory) {
          messages.push({ role: msg.role, content: msg.content });
        }
        
        console.log(`[PaperAgentService] Including ${recentHistory.length} history messages`);
      }
      
      // 添加当前问题
      if (conversationHistory && conversationHistory.length > 0) {
        messages.push({ role: 'user', content: question });
      } else {
        messages.push({ role: 'user', content: userPrompt });
      }

      // 通过统一 AI 客户端发送流式请求
      let fullContent = '';
      for await (const chunk of aiChatStream({
        messages: messages as AIMessage[],
        model: this.config.model,
        temperature: this.config.temperature ?? 0.7,
        maxTokens: this.config.maxTokens ?? 2000,
        signal: this.abortController.signal,
      })) {
        if (chunk.done) break;
        fullContent += chunk.content;
        onEvent({
          type: 'text_delta',
          data: chunk.content,
          timestamp: Date.now(),
        });
      }

      // 提取引用
      const citations = this.extractCitations(fullContent, context);
      if (citations.length > 0) {
        for (const citation of citations) {
          onEvent({
            type: 'citation_found',
            data: citation,
            timestamp: Date.now(),
          });
        }
      }

      onEvent({ type: 'text_done', data: fullContent, timestamp: Date.now() });
      onEvent({ type: 'done', data: { content: fullContent, citations }, timestamp: Date.now() });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Connection')) {
        userFriendlyMessage = '网络错误: 无法连接到 AI 服务。请检查网络连接。';
      } else if (errorMessage.includes('503')) {
        userFriendlyMessage = 'AI 服务未配置。请联系管理员检查服务器配置。';
      }
      
      console.error('[PaperAgentService] Error:', error);
      onEvent({ type: 'error', data: userFriendlyMessage, timestamp: Date.now() });
      throw error;

    } finally {
      this._isProcessing = false;
      this.abortController = null;
    }
  }

  /**
   * 生成论文洞察
   */
  async generateInsights(
    context: PaperContext,
    types: InsightType[] = ['core_problem', 'main_method', 'key_results', 'limitations', 'future_work']
  ): Promise<PaperInsight[]> {
    if (!this.config) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const insights: PaperInsight[] = [];

    for (const type of types) {
      try {
        const insight = await this.generateSingleInsight(type, context);
        if (insight) {
          insights.push(insight);
        }
      } catch (error) {
        console.error(`Failed to generate insight for ${type}:`, error);
      }
    }

    return insights;
  }

  /**
   * 生成单个洞察
   */
  private async generateSingleInsight(
    type: InsightType,
    context: PaperContext
  ): Promise<PaperInsight | null> {
    if (!this.config) return null;

    const systemPrompt = this.buildSystemPrompt(context);
    const insightPrompt = INSIGHT_PROMPTS[type];
    const userPrompt = this.buildUserPrompt(insightPrompt, context);

    // 通过统一 AI 客户端发送请求（非流式）
    const result = await aiChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: this.config.model,
      intent: 'analytical',
      maxTokens: 1500,
    });

    const content = result.content;
    if (!content) return null;

    const citations = this.extractCitations(content, context);

    return {
      id: `insight-${type}-${Date.now()}`,
      type,
      title: this.getInsightTitle(type),
      content,
      citations,
      confidence: 0.8,
      generatedAt: Date.now(),
    };
  }

  /**
   * 获取洞察类型的标题
   */
  private getInsightTitle(type: InsightType): string {
    const titles: Record<InsightType, string> = {
      core_problem: 'Core Problem',
      main_method: 'Main Method',
      key_results: 'Key Results',
      limitations: 'Limitations',
      future_work: 'Future Work',
      custom: 'Insight',
    };
    return titles[type];
  }

  /**
   * 解释图表
   */
  async explainFigure(figureId: string, context: PaperContext): Promise<string> {
    if (!this.config) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const image = context.images.find(img => img.id === figureId);
    if (!image) {
      throw new Error(`Figure ${figureId} not found`);
    }

    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = `Please explain Figure ${figureId} from the paper.
    ${image.caption ? `Caption: ${image.caption}` : ''}
    
    Explain:
    1. What this figure shows
    2. Its significance to the paper's argument
    3. Key observations or insights`;

    const result = await aiChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: this.config.model,
      temperature: 0.5,
      maxTokens: 800,
    });

    return result.content || 'Unable to explain this figure.';
  }

  /**
   * 取消当前请求
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this._isProcessing = false;
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(context: PaperContext): string {
    const baseInstructions = this.config?.instructions || DEFAULT_INSTRUCTIONS;
    
    let systemPrompt = baseInstructions + '\n\n';
    
    if (context.metadata) {
      systemPrompt += `## Paper Information
Title: ${context.metadata.title}
Authors: ${context.metadata.authors.join(', ')}
Published: ${context.metadata.published}
Categories: ${context.metadata.categories.join(', ')}

`;
    }

    return systemPrompt;
  }

  /**
   * 构建用户提示词 (包含论文内容)
   */
  private buildUserPrompt(question: string, context: PaperContext): string {
    let prompt = '';
    
    if (context.detections && context.detections.length > 0) {
      prompt += `## Paper Content (with Detection IDs)\n\n`;
      prompt += `Each paragraph is prefixed with its detection ID in brackets. Use these IDs when citing.\n\n`;
      prompt += this.buildContentWithDetectionIds(context.detections);
      prompt += `\n\n---\n\n`;
    } else if (context.markdown) {
      const maxLength = 50000;
      const truncatedContent = context.markdown.length > maxLength
        ? context.markdown.slice(0, maxLength) + '\n\n[Content truncated due to length...]'
        : context.markdown;
      
      prompt += `## Paper Content\n\n${truncatedContent}\n\n---\n\n`;
    }

    prompt += `## Question\n\n${question}`;

    return prompt;
  }

  /**
   * 构建带 detection ID 的内容
   */
  private buildContentWithDetectionIds(pageDetections: PageDetection[]): string {
    const lines: string[] = [];
    const maxTotalChars = 45000;
    let totalChars = 0;

    const sortedPages = [...pageDetections].sort((a, b) => a.page_number - b.page_number);

    for (const page of sortedPages) {
      const textDetections = page.detections.filter(d => 
        ['title', 'sub_title', 'text', 'equation', 'image_caption', 'table_caption'].includes(d.label)
      );

      for (const detection of textDetections) {
        if (!detection.text || detection.text.trim().length === 0) continue;
        
        const line = `[${detection.id}] ${detection.text}`;
        
        if (totalChars + line.length > maxTotalChars) {
          lines.push('\n[Content truncated due to length...]');
          return lines.join('\n\n');
        }
        
        lines.push(line);
        totalChars += line.length;
      }
    }

    return lines.join('\n\n');
  }

  /**
   * 从响应中提取引用
   */
  private extractCitations(content: string, context: PaperContext): SourceCitation[] {
    const citations: SourceCitation[] = [];
    const seenIds = new Set<string>();
    
    // 匹配 [[detection_id]] 格式
    const detectionIdPattern = /\[\[(p\d+_\w+_\d+)\]\]/g;
    const detectionMatches = content.matchAll(detectionIdPattern);

    for (const match of detectionMatches) {
      const detectionId = match[1];
      
      if (seenIds.has(detectionId)) continue;
      seenIds.add(detectionId);
      
      const pageMatch = detectionId.match(/^p(\d+)_/);
      const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      
      const detectionText = this.findDetectionText(detectionId, context);

      citations.push({
        id: `citation-${Date.now()}-${citations.length}`,
        detection_id: detectionId,
        text: detectionText || `Reference ${detectionId}`,
        pageNumber,
        confidence: detectionText ? 0.95 : 0.7,
      });
    }
    
    // 兼容旧的 [Page X] 格式
    const pagePattern = /\[(?:Section\s+[\w.]+,?\s*)?Page\s+(\d+)\]/gi;
    const pageMatches = content.matchAll(pagePattern);

    for (const match of pageMatches) {
      const pageNumber = parseInt(match[1], 10);
      const pageKey = `page-${pageNumber}`;
      
      if (seenIds.has(pageKey)) continue;
      seenIds.add(pageKey);
      
      const beforeMatch = content.slice(Math.max(0, match.index! - 200), match.index);
      const quotedText = this.extractQuotedText(beforeMatch);

      citations.push({
        id: `citation-${Date.now()}-${citations.length}`,
        text: quotedText || `Reference on Page ${pageNumber}`,
        pageNumber,
        confidence: quotedText ? 0.9 : 0.5,
      });
    }

    return citations;
  }

  /**
   * 从 context 中查找 detection 文本
   */
  private findDetectionText(detectionId: string, context: PaperContext): string | null {
    if (!context.detections) return null;
    
    for (const page of context.detections) {
      for (const detection of page.detections) {
        if (detection.id === detectionId) {
          const text = detection.text || '';
          return text.length > 100 ? text.slice(0, 100) + '...' : text;
        }
      }
    }
    
    return null;
  }

  /**
   * 提取引号中的文本
   */
  private extractQuotedText(text: string): string | null {
    const quotePattern = /[""]([^""]+)[""]|'([^']+)'/g;
    const matches = [...text.matchAll(quotePattern)];
    
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      return lastMatch[1] || lastMatch[2] || null;
    }
    
    return null;
  }
}

/**
 * 创建 Agent Service 实例
 */
export function createPaperAgentService(): IPaperAgentService {
  return new PaperAgentService();
}

/**
 * 单例实例
 */
let defaultAgentService: IPaperAgentService | null = null;

export function getDefaultPaperAgentService(): IPaperAgentService {
  if (!defaultAgentService) {
    defaultAgentService = new PaperAgentService();
  }
  return defaultAgentService;
}

/**
 * 从运行时配置创建 Agent 配置
 * 注意：API Key 现在由服务端管理，客户端只需要模型配置
 */
export async function createAgentConfigAsync(): Promise<AgentConfig> {
  // 检查 AI 服务是否可用
  try {
    const response = await fetch('/api/config/client');
    if (response.ok) {
      const config = await response.json();
      if (!config.aiEnabled) {
        console.warn('[PaperAgentService] AI service not enabled');
      }
    }
  } catch {
    console.warn('[PaperAgentService] Failed to check AI service status');
  }
  
  return {
    model: 'default', // 服务端会使用配置的默认模型
    baseUrl: '/api/ai', // 使用服务端代理
    apiKey: '', // 不再需要，由服务端管理
    instructions: DEFAULT_INSTRUCTIONS,
    temperature: 0.7,
    maxTokens: 2000,
  };
}

/**
 * 同步版本 - 用于 fallback
 * @deprecated 使用 createAgentConfigAsync
 */
export function createAgentConfigFromEnv(): AgentConfig {
  return {
    model: 'default',
    baseUrl: '/api/ai',
    apiKey: '',
    instructions: DEFAULT_INSTRUCTIONS,
    temperature: 0.7,
    maxTokens: 2000,
  };
}
