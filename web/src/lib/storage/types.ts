/**
 * Storage Layer Type Definitions
 * 
 * 定义存储适配器接口和相关类型
 * 所有存储操作都通过统一接口进行，支持 Mock 和 IndexedDB 实现
 */

import type {
  PaperMetadata,
  PageDetection,
  PaperInsight,
  SourceCitation,
  BoundingBox,
} from '@/types/paperContext';

// ============================================================
// Paper Data Types
// ============================================================

/**
 * 论文元信息 (列表展示用)
 */
export interface PaperMeta {
  /** 论文 ID (arxiv_id 或自定义 ID) */
  id: string;
  /** 论文标题 */
  title: string;
  /** 作者列表 */
  authors: string[];
  /** ArXiv ID (如果有) */
  arxivId?: string;
  /** 发布日期 */
  published?: string;
  /** 摘要 */
  abstract?: string;
  /** 是否有 OCR 数据 */
  hasOCRData: boolean;
  /** 总页数 */
  totalPages?: number;
  /** 分类 */
  categories?: string[];
}

/**
 * OCR 结果
 */
export interface OCRResult {
  success: boolean;
  total_pages: number;
  total_processing_time: number;
  markdown_content: string;
  message?: string;
  pages: Array<{
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
  }>;
}

/**
 * 论文完整数据
 */
export interface PaperData {
  /** 元信息 */
  meta: PaperMeta;
  /** 完整元数据 */
  metadata: PaperMetadata;
  /** Markdown 全文 */
  markdown: string;
  /** 检测结果 */
  detections: PageDetection[];
  /** OCR 结果 */
  ocrResult: OCRResult;
}

// ============================================================
// Chat Session Types
// ============================================================

/**
 * 跨论文引用
 */
export interface CrossPaperCitation {
  /** 唯一标识 */
  id: string;
  /** 论文 ID */
  paperId: string;
  /** 论文标题 */
  paperTitle: string;
  /** Detection ID */
  detectionId: string;
  /** 页码 */
  pageNumber: number;
  /** 引用的原文片段 */
  excerpt: string;
  /** 边界框 */
  bbox?: BoundingBox;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 聊天消息
 */
export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: CrossPaperCitation[];
  timestamp: number;
}

/**
 * 聊天会话
 */
export interface ChatSession {
  /** 会话 ID */
  id: string;
  /** 会话标题 */
  title: string;
  /** 关联的论文 ID 列表 */
  paperIds: string[];
  /** 消息历史 */
  messages: StoredChatMessage[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 是否归档 */
  archived: boolean;
}

// ============================================================
// Notebook Types
// ============================================================

/**
 * 笔记条目类型
 */
export type NoteEntryType = 
  | 'text'
  | 'highlight'
  | 'figure'
  | 'table'
  | 'equation'
  | 'insight'
  | 'chat_excerpt';

/**
 * 笔记条目
 */
export interface NoteEntry {
  /** 条目 ID */
  id: string;
  /** 条目类型 */
  type: NoteEntryType;
  /** 内容 (HTML/Markdown) */
  content: string;
  /** 来源引用 */
  source?: CrossPaperCitation;
  /** 原始 Insight */
  originalInsight?: PaperInsight;
  /** 创建时间 */
  createdAt: number;
  /** 用户备注 */
  annotation?: string;
}

/**
 * 笔记本
 */
export interface Notebook {
  /** 笔记本 ID */
  id: string;
  /** 笔记本名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 笔记条目 */
  entries: NoteEntry[];
  /** 关联的论文 ID */
  paperIds: string[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 标签 */
  tags: string[];
}

// ============================================================
// Reference Metadata Types
// ============================================================

/**
 * 引用元数据 (从外部 API 获取)
 */
export interface ReferenceMetadata {
  /** 标识符 (arxiv_id 或 doi) */
  identifier: string;
  /** 标题 */
  title: string;
  /** 作者 */
  authors: string[];
  /** 摘要 */
  abstract?: string;
  /** 年份 */
  year?: number;
  /** 引用数 */
  citationCount?: number;
  /** 期刊/会议 */
  venue?: string;
  /** PDF URL */
  pdfUrl?: string;
  /** ArXiv ID */
  arxivId?: string;
  /** 获取时间 */
  fetchedAt: number;
}

// ============================================================
// Storage Adapter Interface
// ============================================================

/**
 * 存储适配器接口
 * 
 * 所有存储操作的统一抽象
 * 支持 Mock (public/data/output) 和 IndexedDB 实现
 */
export interface StorageAdapter {
  // ==========================================
  // Paper Data (OCR 预处理数据)
  // ==========================================
  
  /** 列出所有可用论文 */
  listPapers(): Promise<PaperMeta[]>;
  
  /** 获取论文完整数据 */
  getPaper(paperId: string): Promise<PaperData | null>;
  
  /** 检查论文是否存在 */
  hasPaper(paperId: string): Promise<boolean>;
  
  // ==========================================
  // Chat Sessions
  // ==========================================
  
  /** 列出所有聊天会话 */
  listChatSessions(): Promise<ChatSession[]>;
  
  /** 获取单个聊天会话 */
  getChatSession(id: string): Promise<ChatSession | null>;
  
  /** 保存聊天会话 */
  saveChatSession(session: ChatSession): Promise<void>;
  
  /** 删除聊天会话 */
  deleteChatSession(id: string): Promise<void>;
  
  // ==========================================
  // Notebooks
  // ==========================================
  
  /** 列出所有笔记本 */
  listNotebooks(): Promise<Notebook[]>;
  
  /** 获取单个笔记本 */
  getNotebook(id: string): Promise<Notebook | null>;
  
  /** 保存笔记本 */
  saveNotebook(notebook: Notebook): Promise<void>;
  
  /** 删除笔记本 */
  deleteNotebook(id: string): Promise<void>;
  
  // ==========================================
  // Paper Insights Cache
  // ==========================================
  
  /** 获取论文缓存的 Insights */
  getPaperInsights(paperId: string): Promise<PaperInsight[]>;
  
  /** 保存论文 Insights */
  savePaperInsights(paperId: string, insights: PaperInsight[]): Promise<void>;
  
  // ==========================================
  // Reference Metadata Cache
  // ==========================================
  
  /** 获取引用元数据 */
  getReferenceMetadata(identifier: string): Promise<ReferenceMetadata | null>;
  
  /** 保存引用元数据 */
  saveReferenceMetadata(identifier: string, metadata: ReferenceMetadata): Promise<void>;
}
