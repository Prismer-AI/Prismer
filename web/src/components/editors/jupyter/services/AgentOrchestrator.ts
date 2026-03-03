/**
 * AgentOrchestrator - Agent 编排服务
 * 
 * 集中管理 Agent 逻辑：
 * - 处理用户查询
 * - 构建上下文
 * - 调用 LLM API
 * - 安全检查
 */

import type {
  Cell,
  CodeCell,
  AgentAction,
  AgentStatus,
  AgentMode,
  CompiledContext,
  Output,
} from '../types';

export interface AgentConfig {
  apiEndpoint: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentOrchestratorEvents {
  onStatusChange?: (status: AgentStatus) => void;
  onAction?: (action: AgentAction) => void;
  onThinking?: (message: string) => void;
  onError?: (error: Error) => void;
}

interface SafetyCheckResult {
  safe: boolean;
  warnings: string[];
  blocked: boolean;
  reason?: string;
}

/**
 * AgentOrchestrator 类
 */
export class AgentOrchestrator {
  private config: AgentConfig;
  private events: AgentOrchestratorEvents;
  private abortController: AbortController | null = null;
  private mode: AgentMode = 'interactive';

  constructor(config: AgentConfig, events: AgentOrchestratorEvents = {}) {
    this.config = {
      model: 'gpt-4',
      maxTokens: 4096,
      temperature: 0.7,
      ...config,
    };
    this.events = events;
  }

  /**
   * 设置 Agent 模式
   */
  setMode(mode: AgentMode): void {
    this.mode = mode;
  }

  /**
   * 处理用户查询
   */
  async processQuery(
    query: string,
    context: {
      cells: Cell[];
      activeCellId?: string | null;
      kernelStatus: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    }
  ): Promise<AsyncGenerator<AgentAction>> {
    this.abortController = new AbortController();
    this.events.onStatusChange?.('thinking');

    const compiledContext = this.buildContext(context.cells, context.activeCellId);
    
    return this.streamResponse(query, compiledContext, context.conversationHistory || []);
  }

  /**
   * 取消当前操作
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.events.onStatusChange?.('idle');
  }

  /**
   * 构建上下文
   */
  buildContext(cells: Cell[], activeCellId?: string | null): CompiledContext {
    const codeCells = cells.filter((c): c is CodeCell => c.type === 'code');
    
    // 最近 5 个 cell 完整内容
    const recentCells = codeCells.slice(-5);
    
    // 其余 cell 只保留摘要
    const olderCells = codeCells.slice(0, -5);
    const summaries = olderCells.map(cell => ({
      id: cell.id,
      summary: this.summarizeCell(cell),
    }));

    // 提取变量信息
    const variables = this.extractVariables(codeCells);

    // 提取错误信息
    const errors = this.extractErrors(codeCells);

    return {
      recentCells: recentCells.map(c => ({
        id: c.id,
        source: c.source,
        outputs: this.summarizeOutputs(c.outputs),
        executionState: c.executionState,
      })),
      summaries,
      variables,
      errors,
      activeCellId: activeCellId || undefined,
      totalCells: cells.length,
    };
  }

  /**
   * 流式响应
   */
  private async *streamResponse(
    query: string,
    context: CompiledContext,
    history: Array<{ role: string; content: string }>
  ): AsyncGenerator<AgentAction> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10), // 最近 10 轮对话
        { role: 'user', content: query },
      ];

      // 调用 API
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          stream: true,
        }),
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                this.events.onThinking?.(content);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 解析完整响应并提取 actions
      const actions = this.parseResponse(fullContent);
      for (const action of actions) {
        // 安全检查
        if (action.type === 'create_cell' || action.type === 'update_cell') {
          const safetyCheck = this.checkCodeSafety(action.code || '');
          if (safetyCheck.blocked) {
            yield {
              type: 'explain',
              description: `⚠️ Code blocked: ${safetyCheck.reason}`,
            };
            continue;
          }
          if (safetyCheck.warnings.length > 0) {
            action.warnings = safetyCheck.warnings;
          }
        }
        
        yield action;
        this.events.onAction?.(action);
      }

      this.events.onStatusChange?.('idle');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this.events.onStatusChange?.('idle');
        return;
      }
      this.events.onError?.(error as Error);
      this.events.onStatusChange?.('error');
      throw error;
    }
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(context: CompiledContext): string {
    return `You are an AI assistant helping with Jupyter Notebook tasks.

## Current Notebook State
- Total cells: ${context.totalCells}
- Active cell: ${context.activeCellId || 'none'}
${context.errors.length > 0 ? `- Errors: ${context.errors.join(', ')}` : ''}

## Recent Cells
${context.recentCells.map((c, i) => `
### Cell ${i + 1} (${c.id})
\`\`\`python
${c.source}
\`\`\`
Output: ${c.outputs}
Status: ${c.executionState}
`).join('\n')}

## Variables
${context.variables.length > 0 
  ? context.variables.map(v => `- ${v.name}: ${v.type}${v.shape ? ` (${v.shape})` : ''}`).join('\n')
  : 'No variables detected'}

## Instructions
1. Analyze the user's request
2. Provide helpful explanations
3. When suggesting code, wrap it in a special format:

\`\`\`action:create_cell
# Your Python code here
print("Hello")
\`\`\`

Or to update an existing cell:

\`\`\`action:update_cell:CELL_ID
# Updated code
\`\`\`

4. Be concise but thorough
5. Consider data science best practices
6. Warn about potential issues

Current mode: ${this.mode === 'interactive' ? 'Interactive (user confirms before execution)' : 'Autonomous (auto-execute with safety checks)'}`;
  }

  /**
   * 解析响应提取 actions
   */
  private parseResponse(content: string): AgentAction[] {
    const actions: AgentAction[] = [];
    
    // 提取代码块
    const codeBlockRegex = /```action:(create_cell|update_cell|execute_cell)(?::([^\n]+))?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const [, actionType, cellId, code] = match;
      
      actions.push({
        type: actionType as AgentAction['type'],
        cellId: cellId?.trim(),
        code: code?.trim(),
      });
    }

    // 如果没有找到特殊格式，尝试提取普通代码块
    if (actions.length === 0) {
      const simpleCodeRegex = /```(?:python)?\n([\s\S]*?)```/g;
      while ((match = simpleCodeRegex.exec(content)) !== null) {
        const code = match[1].trim();
        if (code && !code.startsWith('#') && code.length > 10) {
          actions.push({
            type: 'create_cell',
            code,
            description: 'Suggested code',
          });
        }
      }
    }

    // 添加解释 action（响应文本）
    const textContent = content
      .replace(/```[\s\S]*?```/g, '')
      .trim();
    
    if (textContent) {
      actions.unshift({
        type: 'explain',
        description: textContent,
      });
    }

    return actions;
  }

  /**
   * 安全检查
   */
  checkCodeSafety(code: string): SafetyCheckResult {
    const warnings: string[] = [];
    let blocked = false;
    let reason: string | undefined;

    // 危险模式检测
    const dangerousPatterns = [
      { pattern: /os\.system\s*\(/i, reason: 'System command execution' },
      { pattern: /subprocess\./i, reason: 'Subprocess execution' },
      { pattern: /eval\s*\(/i, reason: 'Eval usage' },
      { pattern: /exec\s*\(/i, reason: 'Exec usage' },
      { pattern: /__import__\s*\(/i, reason: 'Dynamic import' },
      { pattern: /open\s*\([^)]*['"][wa]['"]/, reason: 'File write operation' },
      { pattern: /shutil\.rmtree/i, reason: 'Directory deletion' },
      { pattern: /rm\s+-rf/i, reason: 'Recursive deletion command' },
    ];

    for (const { pattern, reason: patternReason } of dangerousPatterns) {
      if (pattern.test(code)) {
        if (this.mode === 'interactive') {
          warnings.push(patternReason);
        } else {
          // 自主模式下阻止危险代码
          blocked = true;
          reason = patternReason;
          break;
        }
      }
    }

    // 警告模式
    const warningPatterns = [
      { pattern: /!pip\s+install/i, reason: 'Package installation' },
      { pattern: /requests\.(get|post|put|delete)/i, reason: 'Network request' },
      { pattern: /\.to_sql\s*\(/i, reason: 'Database write' },
      { pattern: /\.drop\s*\(/i, reason: 'Data deletion' },
    ];

    for (const { pattern, reason: patternReason } of warningPatterns) {
      if (pattern.test(code)) {
        warnings.push(patternReason);
      }
    }

    return {
      safe: !blocked && warnings.length === 0,
      warnings,
      blocked,
      reason,
    };
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  private summarizeCell(cell: CodeCell): string {
    const lines = cell.source.split('\n');
    const firstLine = lines[0] || '';
    const hasOutput = cell.outputs.length > 0;
    const hasError = cell.executionState === 'error';
    
    return `${firstLine.slice(0, 50)}${lines.length > 1 ? '...' : ''} [${hasError ? 'error' : hasOutput ? 'executed' : 'pending'}]`;
  }

  private summarizeOutputs(outputs: Output[]): string {
    if (outputs.length === 0) return 'No output';
    
    const types = outputs.map(o => {
      switch (o.type) {
        case 'stream': return `stream:${o.name}`;
        case 'execute_result': return 'result';
        case 'display_data': return 'display';
        case 'error': return `error:${o.ename}`;
        default: return 'unknown';
      }
    });
    
    return types.join(', ');
  }

  private extractVariables(cells: CodeCell[]): Array<{ name: string; type: string; shape?: string }> {
    // 简单的变量提取（通过正则匹配赋值语句）
    const variables: Array<{ name: string; type: string; shape?: string }> = [];
    const seen = new Set<string>();

    for (const cell of cells) {
      // 匹配 DataFrame 创建
      const dfMatches = cell.source.matchAll(/(\w+)\s*=\s*pd\.(read_\w+|DataFrame)/g);
      for (const match of dfMatches) {
        if (!seen.has(match[1])) {
          variables.push({ name: match[1], type: 'DataFrame' });
          seen.add(match[1]);
        }
      }

      // 匹配 numpy array
      const npMatches = cell.source.matchAll(/(\w+)\s*=\s*np\.(array|zeros|ones|arange)/g);
      for (const match of npMatches) {
        if (!seen.has(match[1])) {
          variables.push({ name: match[1], type: 'ndarray' });
          seen.add(match[1]);
        }
      }

      // 匹配普通变量
      const varMatches = cell.source.matchAll(/^(\w+)\s*=\s*(?!.*(?:def|class|import))/gm);
      for (const match of varMatches) {
        if (!seen.has(match[1]) && !match[1].startsWith('_')) {
          variables.push({ name: match[1], type: 'unknown' });
          seen.add(match[1]);
        }
      }
    }

    return variables.slice(0, 20); // 限制数量
  }

  private extractErrors(cells: CodeCell[]): string[] {
    return cells
      .filter(c => c.executionState === 'error')
      .flatMap(c => c.outputs)
      .filter((o): o is Output & { type: 'error' } => o.type === 'error')
      .map(o => `${o.ename}: ${o.evalue}`)
      .slice(0, 5);
  }
}

/**
 * 创建 AgentOrchestrator 实例
 */
export function createAgentOrchestrator(
  config: AgentConfig,
  events?: AgentOrchestratorEvents
): AgentOrchestrator {
  return new AgentOrchestrator(config, events);
}
