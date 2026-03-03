/**
 * Paper Context Types
 * 
 * 定义论文上下文的核心类型，用于 AI-Native PDF Reader
 * 所有类型都是接口化的，支持扩展和自定义
 */

// ============================================================
// PDF Source Types - 支持文件和链接
// ============================================================

/**
 * PDF 来源类型
 */
export type PDFSourceType = 'file' | 'url' | 'arxiv' | 'blob';

/**
 * PDF 来源接口 - 统一文件和链接的访问方式
 */
export interface PDFSource {
  type: PDFSourceType;
  /** 文件路径或 URL */
  path: string;
  /** ArXiv ID (可选，用于加载预处理的 OCR 数据) */
  arxivId?: string;
  /** Blob 数据 (当 type 为 'blob' 时) */
  blob?: Blob;
}

/**
 * 从不同来源创建 PDFSource 的工厂函数类型
 */
export interface PDFSourceFactory {
  fromFile: (filePath: string, arxivId?: string) => PDFSource;
  fromUrl: (url: string, arxivId?: string) => PDFSource;
  fromArxiv: (arxivId: string) => PDFSource;
  fromBlob: (blob: Blob) => PDFSource;
}

// ============================================================
// OCR Data Types - 来自预处理流水线
// ============================================================

/**
 * 边界框坐标
 */
export interface BoundingBox {
  /** 原始坐标 (PDF 单位) */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 像素坐标 (用于渲染) */
  x1_px: number;
  y1_px: number;
  x2_px: number;
  y2_px: number;
}

/**
 * 检测标签类型
 */
export type DetectionLabel = 
  | 'title' 
  | 'sub_title' 
  | 'text' 
  | 'image' 
  | 'image_caption'
  | 'table'
  | 'table_caption'
  | 'equation'
  | 'reference'
  | 'footer'
  | 'header'
  | 'figure'
  | 'chart'
  | 'diagram';

/**
 * 检测元数据 - 用于图片/表格/公式等特殊内容
 */
export interface DetectionMetadata {
  image_path?: string | null;
  latex?: string | null;
  table_html?: string | null;
  caption?: string | null;
  caption_id?: string | null;
}

/**
 * 单个检测结果 (带唯一ID，支持双向索引)
 */
export interface Detection {
  /** 唯一标识符 - 格式: p{page}_{type}_{index} */
  id: string;
  label: DetectionLabel;
  boxes: BoundingBox[];
  /** 实际文本内容 (Markdown/LaTeX/HTML table) */
  text: string;
  /** 原始文本格式 (兼容旧格式) */
  raw_text?: string;
  /** 检测元数据 */
  metadata?: DetectionMetadata;
}

/**
 * 提取的图片信息
 */
export interface ExtractedImage {
  detection_id: string;
  index: number;
  bbox: BoundingBox;
  width: number;
  height: number;
  image_path: string;
}

/**
 * 页面检测结果
 */
export interface PageDetection {
  page_number: number;
  detections: Detection[];
  /** 提取的图片列表 */
  extracted_images?: ExtractedImage[];
  image_count?: number;
}

/**
 * 页面元信息
 */
export interface PageMeta {
  page: number;
  width: number;
  height: number;
  dpi: number;
}

/**
 * 双向索引信息
 */
export interface BidirectionalIndexingInfo {
  detection_ids_count: number;
  ref_markers_count: number;
  enabled: boolean;
}

/**
 * 论文元数据
 */
export interface PaperMetadata {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  updated?: string;
  pdf_url?: string;
  categories: string[];
  /** OCR 处理时间戳 */
  ocr_timestamp?: string;
  total_pages: number;
  total_processing_time?: number;
  total_detections?: number;
  total_images_extracted?: number;
  page_metas: PageMeta[];
  /** 双向索引信息 */
  bidirectional_indexing?: BidirectionalIndexingInfo;
  /** 扩展字段 */
  [key: string]: unknown;
}

/**
 * 页面内容 (OCR 结果)
 */
export interface PageContent {
  page_number: number;
  content: string;
  meta: {
    width: number;
    height: number;
    dpi: number;
  };
  processing_time?: number;
  detection_count: number;
  image_count: number;
}

/**
 * OCR 完整结果
 */
export interface OCRResult {
  success: boolean;
  total_pages: number;
  total_processing_time: number;
  markdown_content: string;
  message?: string;
  pages: PageContent[];
}

/**
 * 图像资源
 */
export interface ImageAsset {
  id: string;
  page: number;
  filename: string;
  path: string;
  bbox?: BoundingBox;
  caption?: string;
}

// ============================================================
// Paper Context - 完整的论文上下文
// ============================================================

/**
 * OCR 数据可用等级
 * - L3_hires: 完整检测 overlay + 图片提取 + 双向索引 + 全文 markdown
 * - L2_fast: 全文 markdown 可用，无检测 overlay
 * - L1_raw: 无 OCR 数据，PDF.js 直接渲染
 */
export type OCRLevel = 'L3_hires' | 'L2_fast' | 'L1_raw';

/**
 * 论文上下文 - 包含所有预处理数据
 */
export interface PaperContext {
  /** 来源信息 */
  source: PDFSource;
  /** 元数据 */
  metadata: PaperMetadata | null;
  /** Markdown 全文 */
  markdown: string;
  /** 分页内容 */
  pages: PageContent[];
  /** 检测结果 */
  detections: PageDetection[];
  /** 图像资源 */
  images: ImageAsset[];
  /** 是否有预处理数据 */
  hasOCRData: boolean;
  /** OCR 数据可用等级 */
  ocrLevel: OCRLevel;
  /** 加载状态 */
  loadingState: PaperLoadingState;
  /** 错误信息 */
  error?: string;
}

/**
 * 加载状态
 */
export type PaperLoadingState = 
  | 'idle'
  | 'loading_pdf'
  | 'loading_ocr'
  | 'ready'
  | 'error';

// ============================================================
// AI Response Types
// ============================================================

/**
 * 洞察类型
 */
export type InsightType = 
  | 'core_problem'
  | 'main_method'
  | 'key_results'
  | 'limitations'
  | 'future_work'
  | 'custom';

/**
 * 来源引用 (支持双向索引)
 */
export interface SourceCitation {
  id: string;
  /** Detection ID - 用于双向索引 */
  detection_id?: string;
  /** 引用的原文文本 */
  text: string;
  /** 页码 */
  pageNumber: number;
  /** 精确位置 */
  bbox?: BoundingBox;
  /** 章节提示 */
  sectionHint?: string;
  /** 匹配置信度 */
  confidence?: number;
}

/**
 * AI 生成内容中的引用 (用于双向索引)
 */
export interface Citation {
  /** Detection ID */
  detection_id: string;
  /** 页码 */
  page_number: number;
  /** 原文摘录 */
  excerpt: string;
  /** 相关度 0-1 */
  relevance: number;
}

/**
 * 论文洞察
 */
export interface PaperInsight {
  id: string;
  type: InsightType;
  title: string;
  content: string;
  citations: SourceCitation[];
  confidence: number;
  generatedAt: number;
  /** 是否已展开查看详情 */
  expanded?: boolean;
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: SourceCitation[];
  timestamp: number;
  /** 是否正在流式输出 */
  streaming?: boolean;
  /** 工具调用记录 */
  toolCalls?: ToolCallRecord[];
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'success' | 'error';
}

/**
 * 提取类型
 */
export type ExtractType = 
  | 'highlight'
  | 'figure'
  | 'table'
  | 'equation'
  | 'ai_insight';

/**
 * 提取内容
 */
export interface Extract {
  id: string;
  type: ExtractType;
  content: string;
  source: SourceCitation;
  aiExplanation?: string;
  createdAt: number;
  tags: string[];
  /** 用户注释 */
  note?: string;
  /** 高亮颜色 (用于 highlight 类型) */
  color?: string;
}

// ============================================================
// Agent Service Interface
// ============================================================

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** 模型名称 */
  model: string;
  /** API Base URL */
  baseUrl: string;
  /** API Key */
  apiKey: string;
  /** 系统指令 */
  instructions?: string;
  /** 温度 */
  temperature?: number;
  /** 最大 tokens */
  maxTokens?: number;
}

/**
 * 流式事件类型
 */
export type StreamEventType = 
  | 'text_delta'
  | 'text_done'
  | 'tool_call_start'
  | 'tool_call_done'
  | 'citation_found'
  | 'error'
  | 'done';

/**
 * 流式事件
 */
export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: number;
}

/**
 * Paper Agent 服务接口
 */
export interface IPaperAgentService {
  /** 初始化 Agent */
  initialize(config: AgentConfig): Promise<void>;
  
  /** 发送问题并获取流式响应 */
  askPaper(
    question: string,
    context: PaperContext,
    onEvent: (event: StreamEvent) => void,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<void>;
  
  /** 生成论文洞察 */
  generateInsights(
    context: PaperContext,
    types?: InsightType[]
  ): Promise<PaperInsight[]>;
  
  /** 解释图表 */
  explainFigure(
    figureId: string,
    context: PaperContext
  ): Promise<string>;
  
  /** 取消当前请求 */
  cancel(): void;
  
  /** 是否正在处理 */
  isProcessing: boolean;
}

// ============================================================
// Source Matching Interface
// ============================================================

/**
 * 来源匹配服务接口
 */
export interface ISourceMatchingService {
  /** 
   * 将文本匹配到 PDF 位置 
   */
  matchTextToSource(
    text: string,
    context: PaperContext
  ): SourceCitation | null;
  
  /**
   * 批量匹配
   */
  matchMultiple(
    texts: string[],
    context: PaperContext
  ): SourceCitation[];
  
  /**
   * 根据页码和坐标获取文本
   */
  getTextAtPosition(
    pageNumber: number,
    bbox: BoundingBox,
    context: PaperContext
  ): string | null;
}

// ============================================================
// Paper Context Provider Interface
// ============================================================

/**
 * Paper Context Provider 接口
 */
export interface IPaperContextProvider {
  /** 从 PDF Source 加载上下文 */
  loadContext(source: PDFSource): Promise<PaperContext>;
  
  /** 加载 OCR 数据 (如果可用) */
  loadOCRData(arxivId: string): Promise<{
    metadata: PaperMetadata | null;
    ocrResult: OCRResult | null;
    detections: PageDetection[];
  } | null>;
  
  /** 检查是否有预处理数据 */
  hasPreprocessedData(arxivId: string): Promise<boolean>;
}

// ============================================================
// Factory Functions
// ============================================================

/**
 * 创建 PDF Source 的工厂函数
 */
export const createPDFSource: PDFSourceFactory = {
  fromFile: (filePath: string, arxivId?: string): PDFSource => ({
    type: 'file',
    path: filePath,
    arxivId,
  }),
  
  fromUrl: (url: string, arxivId?: string): PDFSource => ({
    type: 'url',
    path: url,
    arxivId,
  }),
  
  fromArxiv: (arxivId: string): PDFSource => ({
    type: 'arxiv',
    // Use local API route to avoid CORS issues
    // The API route will serve the PDF from public/data/output/{arxivId}/
    path: `/api/ocr/${arxivId}/pdf`,
    arxivId,
  }),
  
  fromBlob: (blob: Blob): PDFSource => ({
    type: 'blob',
    path: '',
    blob,
  }),
};

/**
 * 创建空的 Paper Context
 */
export function createEmptyPaperContext(source: PDFSource): PaperContext {
  return {
    source,
    metadata: null,
    markdown: '',
    pages: [],
    detections: [],
    images: [],
    hasOCRData: false,
    ocrLevel: 'L1_raw',
    loadingState: 'idle',
  };
}

/**
 * 检测标签是否为可交互类型
 */
export function isInteractiveLabel(label: DetectionLabel): boolean {
  return ['image', 'table', 'equation'].includes(label);
}

/**
 * 获取检测标签的显示名称
 */
export function getLabelDisplayName(label: DetectionLabel): string {
  const names: Record<DetectionLabel, string> = {
    title: 'Title',
    sub_title: 'Section',
    text: 'Text',
    image: 'Figure',
    image_caption: 'Caption',
    table: 'Table',
    table_caption: 'Table Caption',
    equation: 'Equation',
    reference: 'Reference',
    footer: 'Footer',
    header: 'Header',
    figure: 'Figure',
    chart: 'Chart',
    diagram: 'Diagram',
  };
  return names[label] || label;
}

