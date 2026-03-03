/**
 * ContextBuilder - 上下文构建服务
 * 
 * 负责：
 * - 分层摘要（最近 cell 完整，旧 cell 摘要）
 * - 增量更新（脏标记、缓存）
 * - 变量信息提取
 * - Token 估算
 */

import type { 
  Cell, 
  CodeCell, 
  Output, 
  CompiledContext,
  ArtifactSummary,
} from '../types';
import type { DetectedArtifact } from './ArtifactManager';

// ============================================================
// 类型定义
// ============================================================

export interface ContextConfig {
  // 分层策略
  recentCellCount: number;      // 完整包含的最近 cell 数量
  maxSummaryLength: number;     // 摘要最大长度
  maxTotalTokens: number;       // 上下文最大 token 数
  
  // 变量信息
  includeVariables: boolean;
  maxVariables: number;
  
  // 产物信息
  includeArtifacts: boolean;
  maxArtifacts: number;
  
  // 增量更新
  enableCaching: boolean;
  cacheExpiry: number;          // 缓存过期时间（毫秒）
}

export interface CellVersion {
  cellId: string;
  version: number;
  hash: string;
  summary?: string;
}

export interface ContextCache {
  versions: Map<string, CellVersion>;
  lastBuild: number;
  compiledContext?: CompiledContext;
}

// ============================================================
// ContextBuilder 类
// ============================================================

export class ContextBuilder {
  private config: ContextConfig;
  private cache: ContextCache;
  private isDirty = true;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingCallbacks: Array<(context: CompiledContext) => void> = [];

  constructor(config?: Partial<ContextConfig>) {
    this.config = {
      recentCellCount: 5,
      maxSummaryLength: 100,
      maxTotalTokens: 8000,
      includeVariables: true,
      maxVariables: 20,
      includeArtifacts: true,
      maxArtifacts: 10,
      enableCaching: true,
      cacheExpiry: 30000,  // 30 秒
      ...config,
    };

    this.cache = {
      versions: new Map(),
      lastBuild: 0,
    };
  }

  /**
   * 标记为脏（需要重新构建）
   */
  markDirty(): void {
    this.isDirty = true;
  }

  /**
   * 构建上下文（带防抖）
   */
  buildContextDebounced(
    cells: Cell[],
    artifacts: DetectedArtifact[],
    activeCellId?: string | null,
    delay = 300
  ): Promise<CompiledContext> {
    return new Promise((resolve) => {
      this.pendingCallbacks.push(resolve);

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        const context = this.buildContext(cells, artifacts, activeCellId);
        this.pendingCallbacks.forEach(cb => cb(context));
        this.pendingCallbacks = [];
        this.debounceTimer = null;
      }, delay);
    });
  }

  /**
   * 构建上下文
   */
  buildContext(
    cells: Cell[],
    artifacts: DetectedArtifact[],
    activeCellId?: string | null
  ): CompiledContext {
    // 检查缓存
    if (this.config.enableCaching && !this.isDirty) {
      const cacheAge = Date.now() - this.cache.lastBuild;
      if (cacheAge < this.config.cacheExpiry && this.cache.compiledContext) {
        return this.cache.compiledContext;
      }
    }

    const codeCells = cells.filter((c): c is CodeCell => c.type === 'code');
    
    // 分层：最近 N 个 cell 完整，其余摘要
    const recentCount = this.config.recentCellCount;
    const recentCells = codeCells.slice(-recentCount);
    const olderCells = codeCells.slice(0, -recentCount);

    // 构建最近 cell 的完整信息
    const recentCellsData = recentCells.map(cell => ({
      id: cell.id,
      source: cell.source,
      outputs: this.summarizeOutputs(cell.outputs),
      executionState: cell.executionState,
    }));

    // 构建旧 cell 的摘要（使用增量更新）
    const summaries = olderCells.map(cell => {
      const cached = this.getCachedSummary(cell);
      if (cached) {
        return { id: cell.id, summary: cached };
      }
      
      const summary = this.generateCellSummary(cell);
      this.cacheSummary(cell, summary);
      return { id: cell.id, summary };
    });

    // 提取变量信息
    const variables = this.config.includeVariables
      ? this.extractVariables(codeCells).slice(0, this.config.maxVariables)
      : [];

    // 提取错误信息
    const errors = this.extractErrors(codeCells);

    // 产物摘要
    const artifactSummaries = this.config.includeArtifacts
      ? this.formatArtifactSummaries(artifacts).slice(0, this.config.maxArtifacts)
      : [];

    const context: CompiledContext = {
      recentCells: recentCellsData,
      summaries,
      variables,
      errors,
      activeCellId: activeCellId || undefined,
      totalCells: cells.length,
      artifacts: artifactSummaries,
      estimatedTokens: this.estimateTokens(recentCellsData, summaries, variables),
    };

    // 更新缓存
    this.cache.compiledContext = context;
    this.cache.lastBuild = Date.now();
    this.isDirty = false;

    return context;
  }

  /**
   * 生成 Cell 摘要
   */
  private generateCellSummary(cell: CodeCell): string {
    const lines = cell.source.split('\n').filter(l => l.trim());
    
    // 提取关键信息
    const imports: string[] = [];
    const definitions: string[] = [];
    const operations: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // 导入语句
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        const match = trimmed.match(/(?:import|from)\s+(\w+)/);
        if (match) imports.push(match[1]);
      }
      // 函数定义
      else if (trimmed.startsWith('def ')) {
        const match = trimmed.match(/def\s+(\w+)/);
        if (match) definitions.push(`fn:${match[1]}`);
      }
      // 类定义
      else if (trimmed.startsWith('class ')) {
        const match = trimmed.match(/class\s+(\w+)/);
        if (match) definitions.push(`class:${match[1]}`);
      }
      // 变量赋值
      else if (trimmed.match(/^\w+\s*=\s*/)) {
        const match = trimmed.match(/^(\w+)\s*=/);
        if (match) operations.push(`${match[1]}=...`);
      }
    }

    // 构建摘要
    const parts: string[] = [];
    if (imports.length > 0) {
      parts.push(`imports: ${imports.slice(0, 3).join(', ')}${imports.length > 3 ? '...' : ''}`);
    }
    if (definitions.length > 0) {
      parts.push(`defines: ${definitions.slice(0, 2).join(', ')}`);
    }
    if (operations.length > 0) {
      parts.push(`assigns: ${operations.slice(0, 3).join(', ')}`);
    }

    // 添加执行状态
    if (cell.executionState === 'error') {
      parts.push('[ERROR]');
    } else if (cell.executionCount) {
      parts.push(`[${cell.executionCount}]`);
    }

    const summary = parts.join(' | ');
    return summary.slice(0, this.config.maxSummaryLength);
  }

  /**
   * 获取缓存的摘要
   */
  private getCachedSummary(cell: CodeCell): string | undefined {
    if (!this.config.enableCaching) return undefined;

    const cached = this.cache.versions.get(cell.id);
    if (!cached) return undefined;

    const currentHash = this.hashCell(cell);
    if (cached.hash !== currentHash) return undefined;

    return cached.summary;
  }

  /**
   * 缓存摘要
   */
  private cacheSummary(cell: CodeCell, summary: string): void {
    if (!this.config.enableCaching) return;

    const existing = this.cache.versions.get(cell.id);
    this.cache.versions.set(cell.id, {
      cellId: cell.id,
      version: (existing?.version ?? 0) + 1,
      hash: this.hashCell(cell),
      summary,
    });
  }

  /**
   * 计算 Cell 哈希
   */
  private hashCell(cell: CodeCell): string {
    const content = `${cell.source}|${cell.executionState}|${cell.executionCount}`;
    // 简单哈希
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * 摘要化输出
   */
  private summarizeOutputs(outputs: Output[]): string {
    if (outputs.length === 0) return 'No output';

    const summaries: string[] = [];
    
    for (const output of outputs) {
      switch (output.type) {
        case 'stream':
          const lines = output.text.split('\n').length;
          summaries.push(`${output.name}: ${lines} lines`);
          break;
        case 'execute_result':
          const types = Object.keys(output.data);
          summaries.push(`result: ${types.join(', ')}`);
          break;
        case 'display_data':
          const displayTypes = Object.keys(output.data);
          summaries.push(`display: ${displayTypes.join(', ')}`);
          break;
        case 'error':
          summaries.push(`ERROR: ${output.ename}`);
          break;
      }
    }

    return summaries.join('; ');
  }

  /**
   * 提取变量信息
   */
  private extractVariables(
    cells: CodeCell[]
  ): Array<{ name: string; type: string; shape?: string }> {
    const variables: Array<{ name: string; type: string; shape?: string }> = [];
    const seen = new Set<string>();

    // 反向遍历，获取最新的变量定义
    for (let i = cells.length - 1; i >= 0; i--) {
      const cell = cells[i];
      if (cell.executionState !== 'success') continue;

      // DataFrame 检测
      const dfMatches = cell.source.matchAll(/(\w+)\s*=\s*pd\.(read_\w+|DataFrame)\([^)]*\)/g);
      for (const match of dfMatches) {
        if (!seen.has(match[1])) {
          variables.push({ name: match[1], type: 'DataFrame' });
          seen.add(match[1]);
        }
      }

      // NumPy array 检测
      const npMatches = cell.source.matchAll(/(\w+)\s*=\s*np\.(array|zeros|ones|arange|linspace)\([^)]*\)/g);
      for (const match of npMatches) {
        if (!seen.has(match[1])) {
          variables.push({ name: match[1], type: 'ndarray' });
          seen.add(match[1]);
        }
      }

      // 列表检测
      const listMatches = cell.source.matchAll(/(\w+)\s*=\s*\[/g);
      for (const match of listMatches) {
        if (!seen.has(match[1]) && !match[1].startsWith('_')) {
          variables.push({ name: match[1], type: 'list' });
          seen.add(match[1]);
        }
      }

      // 字典检测
      const dictMatches = cell.source.matchAll(/(\w+)\s*=\s*\{/g);
      for (const match of dictMatches) {
        if (!seen.has(match[1]) && !match[1].startsWith('_')) {
          variables.push({ name: match[1], type: 'dict' });
          seen.add(match[1]);
        }
      }
    }

    return variables;
  }

  /**
   * 提取错误信息
   */
  private extractErrors(cells: CodeCell[]): string[] {
    const errors: string[] = [];

    for (const cell of cells) {
      if (cell.executionState !== 'error') continue;

      for (const output of cell.outputs) {
        if (output.type === 'error') {
          errors.push(`${output.ename}: ${output.evalue}`);
        }
      }
    }

    return errors.slice(-5);  // 最近 5 个错误
  }

  /**
   * 格式化产物摘要
   */
  private formatArtifactSummaries(
    artifacts: DetectedArtifact[]
  ): ArtifactSummary[] {
    return artifacts.map(a => ({
      id: a.id,
      type: a.type,
      name: `${a.type}_${a.id.slice(0, 8)}`,
      cellId: a.cellId,
      createdAt: a.createdAt,
      description: this.describeArtifact(a),
    }));
  }

  /**
   * 描述产物
   */
  private describeArtifact(artifact: DetectedArtifact): string {
    switch (artifact.type) {
      case 'image':
        return `Image (${artifact.mimeType})`;
      case 'dataframe':
        const { rows, columns } = artifact.metadata;
        return `Table (${rows || '?'}×${columns || '?'})`;
      case 'chart':
        return `Chart: ${artifact.metadata.title || 'Untitled'}`;
      default:
        return artifact.type;
    }
  }

  /**
   * 估算 Token 数量
   */
  private estimateTokens(
    recentCells: Array<{ source: string; outputs: string }>,
    summaries: Array<{ summary: string }>,
    variables: Array<{ name: string; type: string }>
  ): number {
    // 粗略估算：4 字符 ≈ 1 token
    let charCount = 0;

    for (const cell of recentCells) {
      charCount += cell.source.length + cell.outputs.length;
    }

    for (const { summary } of summaries) {
      charCount += summary.length;
    }

    for (const v of variables) {
      charCount += v.name.length + v.type.length + 10;
    }

    return Math.ceil(charCount / 4);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = {
      versions: new Map(),
      lastBuild: 0,
    };
    this.isDirty = true;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    cachedCells: number;
    lastBuild: number;
    isDirty: boolean;
  } {
    return {
      cachedCells: this.cache.versions.size,
      lastBuild: this.cache.lastBuild,
      isDirty: this.isDirty,
    };
  }
}

/**
 * 创建 ContextBuilder 实例
 */
export function createContextBuilder(
  config?: Partial<ContextConfig>
): ContextBuilder {
  return new ContextBuilder(config);
}

export default ContextBuilder;
