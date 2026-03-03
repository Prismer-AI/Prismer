/**
 * 跨论文标签系统 - 统一导出
 * 
 * 使用方式:
 * ```typescript
 * import {
 *   Citation,
 *   citationTagParser,
 *   citationMapper,
 *   citationNavigator,
 *   paperAliasAssigner,
 * } from './services/citationSystem';
 * 
 * // 解析标签
 * const tags = citationTagParser.parse(content);
 * 
 * // 映射为 Citation
 * const citations = citationMapper.mapToCitations(tags, context);
 * 
 * // 导航到引用
 * await citationNavigator.navigate(citation);
 * ```
 */

// 类型导出
export type {
  Citation,
  TagParseResult,
  MessageContext,
  PaperAliasMap,
  DetectionType,
  UniversalReferenceId,
  CitationValidationResult,
  TagType,
} from '../types/citation';

// 工具函数导出
export {
  createCitationUri,
  parseCitationUri,
  extractPageNumber,
  extractDetectionType,
  createCitation,
} from '../types/citation';

// 解析器导出
export {
  CitationTagParser,
  CitationErrorHandler,
  citationTagParser,
  citationErrorHandler,
} from './citationTagParser';

// 映射器导出
export {
  CitationMapper,
  PaperAliasAssigner,
  citationMapper,
  paperAliasAssigner,
} from './citationMapper';

// 导航器导出
export type {
  NavigationTarget,
  NavigationResult,
  DocumentStateChecker,
  PDFScrollController,
} from './citationNavigator';

export {
  CitationNavigator,
  citationNavigator,
  emitScrollToDetection,
  emitScrollToPage,
} from './citationNavigator';
