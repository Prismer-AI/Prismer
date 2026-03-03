/**
 * 标签解析器
 * 
 * 支持两种格式:
 * 1. 单论文标签: [[p1_text_0]]
 * 2. 跨论文标签: [[A:p1_text_0]]
 */

import { TagParseResult, TagType } from '../types/citation';

// ============================================================
// 正则表达式模式
// ============================================================

/**
 * 跨论文标签模式: [[A:p1_text_0]] 或 [[A:p1_image_0]]
 * 捕获组: [1] = 论文别名 (A, B, C...), [2] = detection ID
 */
const CROSS_PAPER_PATTERN = /\[\[([A-Z]):(p\d+_\w+_\d+)\]\]/g;

/**
 * 单论文标签模式: [[p1_text_0]]
 * 捕获组: [1] = detection ID
 */
const LOCAL_PATTERN = /\[\[(p\d+_\w+_\d+)\]\]/g;

/**
 * 通用标签模式 (用于替换): 匹配任何 [[...]] 格式
 */
const ANY_TAG_PATTERN = /\[\[([A-Z]:)?(p\d+_\w+_\d+)\]\]/g;

// ============================================================
// CitationTagParser 类
// ============================================================

export class CitationTagParser {
  /**
   * 解析内容中的所有标签
   * 
   * @param content - 要解析的内容
   * @returns 解析结果数组
   */
  parse(content: string): TagParseResult[] {
    const results: TagParseResult[] = [];
    const processedRanges: Array<{ start: number; end: number }> = [];
    
    // 1. 先解析跨论文标签 (优先级更高)
    const crossPaperRegex = new RegExp(CROSS_PAPER_PATTERN.source, 'g');
    let match: RegExpExecArray | null;
    
    while ((match = crossPaperRegex.exec(content)) !== null) {
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;
      
      results.push({
        type: 'cross-paper',
        paperAlias: match[1],
        detectionId: match[2],
        raw: match[0],
        startIndex,
        endIndex,
      });
      
      processedRanges.push({ start: startIndex, end: endIndex });
    }
    
    // 2. 再解析单论文标签 (排除已处理的范围)
    const localRegex = new RegExp(LOCAL_PATTERN.source, 'g');
    
    while ((match = localRegex.exec(content)) !== null) {
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;
      
      // 检查是否与已处理的跨论文标签重叠
      const isOverlapping = processedRanges.some(
        range => startIndex >= range.start && endIndex <= range.end
      );
      
      if (!isOverlapping) {
        results.push({
          type: 'local',
          detectionId: match[1],
          raw: match[0],
          startIndex,
          endIndex,
        });
      }
    }
    
    // 3. 按位置排序
    results.sort((a, b) => a.startIndex - b.startIndex);
    
    return results;
  }
  
  /**
   * 解析并替换内容中的标签
   * 
   * @param content - 要处理的内容
   * @param replacer - 替换函数
   * @returns 替换后的内容
   */
  parseAndReplace(
    content: string,
    replacer: (tag: TagParseResult, index: number) => string
  ): string {
    const tags = this.parse(content);
    
    if (tags.length === 0) return content;
    
    // 从后向前替换，避免索引偏移问题
    let result = content;
    for (let i = tags.length - 1; i >= 0; i--) {
      const tag = tags[i];
      const replacement = replacer(tag, i);
      result = result.slice(0, tag.startIndex) + replacement + result.slice(tag.endIndex);
    }
    
    return result;
  }
  
  /**
   * 检查内容是否包含标签
   */
  hasTag(content: string): boolean {
    return ANY_TAG_PATTERN.test(content);
  }
  
  /**
   * 统计标签数量
   */
  countTags(content: string): { local: number; crossPaper: number; total: number } {
    const tags = this.parse(content);
    const local = tags.filter(t => t.type === 'local').length;
    const crossPaper = tags.filter(t => t.type === 'cross-paper').length;
    return { local, crossPaper, total: tags.length };
  }
  
  /**
   * 提取所有唯一的 detection IDs
   */
  extractDetectionIds(content: string): string[] {
    const tags = this.parse(content);
    const ids = new Set(tags.map(t => t.detectionId));
    return Array.from(ids);
  }
  
  /**
   * 提取所有唯一的论文别名
   */
  extractPaperAliases(content: string): string[] {
    const tags = this.parse(content);
    const aliases = new Set(
      tags
        .filter(t => t.type === 'cross-paper' && t.paperAlias)
        .map(t => t.paperAlias!)
    );
    return Array.from(aliases);
  }
}

// ============================================================
// 容错处理器
// ============================================================

export class CitationErrorHandler {
  /**
   * 清理和修复 AI 生成的标签格式错误
   */
  sanitize(content: string): string {
    let sanitized = content;
    
    // 错误1: 缺少方括号 → cite:p1_text_0 或 ref:p1_text_0
    // 修复: 包裹方括号
    sanitized = sanitized.replace(
      /(?<!\[)(?:cite|ref):(p\d+_\w+_\d+)(?!\])/gi,
      '[[$1]]'
    );
    
    // 错误2: 连续标签无空格 → [[p1]][[p2]]
    // 修复: 添加空格
    sanitized = sanitized.replace(
      /\]\]\[\[/g,
      ']] [['
    );
    
    // 错误3: 错误的前缀格式 → [A:p1_text_0] (单方括号)
    // 修复: 双方括号
    sanitized = sanitized.replace(
      /(?<!\[)\[([A-Z]:(p\d+_\w+_\d+))\](?!\])/g,
      '[[$1]]'
    );
    
    // 错误4: 单论文格式缺少括号 → [p1_text_0]
    // 修复: 双方括号
    sanitized = sanitized.replace(
      /(?<!\[)\[(p\d+_\w+_\d+)\](?!\])/g,
      '[[$1]]'
    );
    
    // 错误5: 多余空格 → [[ p1_text_0 ]] 或 [[ A:p1_text_0 ]]
    // 修复: 移除空格
    sanitized = sanitized.replace(
      /\[\[\s*([A-Z]:)?\s*(p\d+_\w+_\d+)\s*\]\]/g,
      (_, prefix, id) => prefix ? `[[${prefix}${id}]]` : `[[${id}]]`
    );
    
    // 错误6: 冒号前后有空格 → [[A : p1_text_0]]
    // 修复: 移除空格
    sanitized = sanitized.replace(
      /\[\[([A-Z])\s*:\s*(p\d+_\w+_\d+)\]\]/g,
      '[[$1:$2]]'
    );
    
    return sanitized;
  }
  
  /**
   * 验证标签格式是否正确
   */
  validateFormat(tag: string): boolean {
    // 跨论文格式
    if (/^\[\[[A-Z]:p\d+_\w+_\d+\]\]$/.test(tag)) return true;
    // 单论文格式
    if (/^\[\[p\d+_\w+_\d+\]\]$/.test(tag)) return true;
    return false;
  }
}

// ============================================================
// 单例导出
// ============================================================

export const citationTagParser = new CitationTagParser();
export const citationErrorHandler = new CitationErrorHandler();
