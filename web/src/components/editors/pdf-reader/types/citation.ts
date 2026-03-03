/**
 * 跨论文标签系统 - 类型定义
 * 
 * 设计目标：
 * 1. AI 生成逻辑简单 (单论文: [[p1_text_0]], 多论文: [[A:p1_text_0]])
 * 2. 支持跨论文唯一标识
 * 3. 向后兼容现有标签格式
 */

// ============================================================
// 基础类型
// ============================================================

/**
 * Detection 类型枚举
 */
export type DetectionType = 'text' | 'image' | 'table' | 'equation' | 'title' | 'sub_title' | 'reference';

/**
 * 统一引用标识符 (Universal Reference Identifier)
 * 格式: {paperId}#{detectionId}
 * 示例: 2601.02346v1#p1_text_0
 */
export type UniversalReferenceId = `${string}#${string}`;

/**
 * 论文别名映射
 * 例如: { A: "2601.02346v1", B: "1706.03762" }
 */
export type PaperAliasMap = Record<string, string>;

// ============================================================
// Citation 结构
// ============================================================

/**
 * 统一引用结构
 * 用于 ChatMessage.citations 和 NoteEntry.citations
 */
export interface Citation {
  /** 全局唯一标识符: "{paperId}#{detectionId}" */
  uri: UniversalReferenceId;
  
  /** 论文 ID (arxivId 或其他唯一标识) */
  paperId: string;
  
  /** Detection ID (例如 p1_text_0) */
  detectionId: string;
  
  /** 论文标题 (缓存，避免重复查询) */
  paperTitle?: string;
  
  /** 页码 */
  pageNumber: number;
  
  /** Detection 类型 */
  type: DetectionType;
  
  /** 内容摘要 (前30-50字) */
  excerpt?: string;
  
  /** 在当前上下文中的显示编号 (1, 2, 3...) */
  displayIndex?: number;
  
  /** 论文别名 (多论文模式下的 A, B, C...) */
  paperAlias?: string;
}

// ============================================================
// 标签解析结果
// ============================================================

/**
 * 标签类型
 */
export type TagType = 'local' | 'cross-paper';

/**
 * 标签解析结果
 */
export interface TagParseResult {
  /** 标签类型 */
  type: TagType;
  
  /** 多论文时的别名 (A, B, C...) */
  paperAlias?: string;
  
  /** Detection ID (例如 p1_text_0) */
  detectionId: string;
  
  /** 原始匹配字符串 */
  raw: string;
  
  /** 在原始内容中的起始位置 */
  startIndex: number;
  
  /** 在原始内容中的结束位置 */
  endIndex: number;
}

// ============================================================
// 消息上下文
// ============================================================

/**
 * 消息上下文 - 用于标签解析和映射
 */
export interface MessageContext {
  /** 模式: 单论文或多论文 */
  mode: 'single' | 'multi';
  
  /** 单论文模式下的默认论文 ID */
  defaultPaperId?: string;
  
  /** 多论文模式下的别名映射 */
  paperAliasMap?: PaperAliasMap;
}

// ============================================================
// 验证结果
// ============================================================

/**
 * 引用验证结果
 */
export interface CitationValidationResult {
  /** 是否有效 */
  valid: boolean;
  
  /** 错误类型 */
  error?: 'unknown_paper' | 'unknown_detection' | 'invalid_format';
  
  /** 用户提示 */
  suggestion?: string;
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 创建统一引用标识符
 */
export function createCitationUri(paperId: string, detectionId: string): UniversalReferenceId {
  return `${paperId}#${detectionId}` as UniversalReferenceId;
}

/**
 * 解析统一引用标识符
 */
export function parseCitationUri(uri: UniversalReferenceId): { paperId: string; detectionId: string } | null {
  const parts = uri.split('#');
  if (parts.length !== 2) return null;
  return { paperId: parts[0], detectionId: parts[1] };
}

/**
 * 从 detection ID 提取页码
 * @example extractPageNumber("p1_text_0") => 1
 */
export function extractPageNumber(detectionId: string): number {
  const match = detectionId.match(/p(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * 从 detection ID 提取类型
 * @example extractDetectionType("p1_text_0") => "text"
 */
export function extractDetectionType(detectionId: string): DetectionType {
  if (detectionId.includes('image') || detectionId.includes('figure')) return 'image';
  if (detectionId.includes('table')) return 'table';
  if (detectionId.includes('equation')) return 'equation';
  if (detectionId.includes('title')) return 'title';
  if (detectionId.includes('sub_title')) return 'sub_title';
  if (detectionId.includes('reference')) return 'reference';
  return 'text';
}

/**
 * 创建 Citation 对象
 */
export function createCitation(
  paperId: string,
  detectionId: string,
  options?: Partial<Omit<Citation, 'uri' | 'paperId' | 'detectionId'>>
): Citation {
  return {
    uri: createCitationUri(paperId, detectionId),
    paperId,
    detectionId,
    pageNumber: options?.pageNumber ?? extractPageNumber(detectionId),
    type: options?.type ?? extractDetectionType(detectionId),
    ...options,
  };
}
