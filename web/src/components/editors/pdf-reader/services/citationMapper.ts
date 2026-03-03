/**
 * 标签映射器
 * 
 * 将 AI 生成的标签转换为完整的 Citation 对象
 */

import {
  Citation,
  TagParseResult,
  MessageContext,
  PaperAliasMap,
  createCitation,
  extractPageNumber,
  extractDetectionType,
} from '../types/citation';
import { citationTagParser } from './citationTagParser';

// ============================================================
// CitationMapper 类
// ============================================================

export class CitationMapper {
  /**
   * 将解析结果转换为 Citation 数组
   * 
   * @param parseResults - 标签解析结果
   * @param context - 消息上下文
   * @returns Citation 数组
   */
  mapToCitations(
    parseResults: TagParseResult[],
    context: MessageContext
  ): Citation[] {
    return parseResults.map((result, index) => {
      let paperId: string;
      let paperAlias: string | undefined;
      
      if (result.type === 'cross-paper' && result.paperAlias) {
        // 跨论文模式: 从别名映射获取 paperId
        paperAlias = result.paperAlias;
        paperId = context.paperAliasMap?.[result.paperAlias] || result.paperAlias;
      } else {
        // 单论文模式: 使用默认 paperId
        paperId = context.defaultPaperId || 'unknown';
      }
      
      return createCitation(paperId, result.detectionId, {
        displayIndex: index + 1,
        paperAlias,
      });
    });
  }
  
  /**
   * 从内容直接解析并映射为 Citations
   * 
   * @param content - 内容字符串
   * @param context - 消息上下文
   * @returns Citation 数组
   */
  parseAndMap(content: string, context: MessageContext): Citation[] {
    const parseResults = citationTagParser.parse(content);
    return this.mapToCitations(parseResults, context);
  }
  
  /**
   * 丰富 Citation 信息
   * 
   * @param citation - 基础 Citation
   * @param enrichment - 附加信息
   * @returns 丰富后的 Citation
   */
  enrichCitation(
    citation: Citation,
    enrichment: {
      paperTitle?: string;
      excerpt?: string;
    }
  ): Citation {
    return {
      ...citation,
      ...enrichment,
    };
  }
  
  /**
   * 批量丰富 Citations
   * 
   * @param citations - Citation 数组
   * @param paperTitles - paperId -> title 映射
   * @param excerpts - detectionId -> excerpt 映射 (按 paperId 分组)
   */
  enrichCitations(
    citations: Citation[],
    paperTitles: Record<string, string>,
    excerpts?: Record<string, Record<string, string>>
  ): Citation[] {
    return citations.map(citation => ({
      ...citation,
      paperTitle: paperTitles[citation.paperId] || citation.paperTitle,
      excerpt: excerpts?.[citation.paperId]?.[citation.detectionId] || citation.excerpt,
    }));
  }
  
  /**
   * 重新分配显示索引
   * 
   * 当需要按特定顺序显示时使用
   */
  reindexCitations(citations: Citation[]): Citation[] {
    return citations.map((citation, index) => ({
      ...citation,
      displayIndex: index + 1,
    }));
  }
  
  /**
   * 去重 Citations (基于 URI)
   */
  deduplicateCitations(citations: Citation[]): Citation[] {
    const seen = new Set<string>();
    return citations.filter(citation => {
      if (seen.has(citation.uri)) return false;
      seen.add(citation.uri);
      return true;
    });
  }
  
  /**
   * 按论文分组 Citations
   */
  groupByPaper(citations: Citation[]): Record<string, Citation[]> {
    return citations.reduce((groups, citation) => {
      const key = citation.paperId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(citation);
      return groups;
    }, {} as Record<string, Citation[]>);
  }
  
  /**
   * 按页码排序 Citations
   */
  sortByPage(citations: Citation[]): Citation[] {
    return [...citations].sort((a, b) => {
      // 首先按论文排序
      if (a.paperId !== b.paperId) {
        return a.paperId.localeCompare(b.paperId);
      }
      // 然后按页码排序
      return a.pageNumber - b.pageNumber;
    });
  }
}

// ============================================================
// 论文别名分配器
// ============================================================

export class PaperAliasAssigner {
  private readonly aliases = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  /**
   * 为论文分配稳定别名
   * 
   * 关键：同一会话中，同一论文的别名必须稳定不变
   * 否则历史消息中的 [[A:xxx]] 会失效
   * 
   * @param paperIds - 论文 ID 列表
   * @param existingMap - 现有的别名映射
   * @returns 更新后的别名映射
   */
  assignAliases(
    paperIds: string[],
    existingMap?: PaperAliasMap
  ): PaperAliasMap {
    const map: PaperAliasMap = { ...existingMap };
    const usedAliases = new Set(Object.keys(map));
    
    for (const paperId of paperIds) {
      // 检查是否已有别名
      const existingAlias = this.getAliasForPaper(paperId, map);
      if (existingAlias) continue;
      
      // 分配新别名
      const nextAlias = this.aliases.find(a => !usedAliases.has(a));
      if (nextAlias) {
        map[nextAlias] = paperId;
        usedAliases.add(nextAlias);
      } else {
        // 超过 26 篇论文，使用 AA, AB, ...
        console.warn('Exceeded 26 papers, using extended aliases');
        const extendedAlias = `P${Object.keys(map).length + 1}`;
        map[extendedAlias] = paperId;
      }
    }
    
    return map;
  }
  
  /**
   * 反向查找：paperId → alias
   */
  getAliasForPaper(paperId: string, map: PaperAliasMap): string | null {
    const entry = Object.entries(map).find(([_, id]) => id === paperId);
    return entry ? entry[0] : null;
  }
  
  /**
   * 正向查找：alias → paperId
   */
  getPaperForAlias(alias: string, map: PaperAliasMap): string | null {
    return map[alias] || null;
  }
  
  /**
   * 移除论文别名
   * 注意：通常不应移除别名，以保持历史消息的有效性
   */
  removeAlias(paperId: string, map: PaperAliasMap): PaperAliasMap {
    const alias = this.getAliasForPaper(paperId, map);
    if (!alias) return map;
    
    const newMap = { ...map };
    delete newMap[alias];
    return newMap;
  }
  
  /**
   * 检查是否为多论文模式
   */
  isMultiPaperMode(map: PaperAliasMap): boolean {
    return Object.keys(map).length > 1;
  }
  
  /**
   * 获取所有论文 ID
   */
  getAllPaperIds(map: PaperAliasMap): string[] {
    return Object.values(map);
  }
}

// ============================================================
// 单例导出
// ============================================================

export const citationMapper = new CitationMapper();
export const paperAliasAssigner = new PaperAliasAssigner();
