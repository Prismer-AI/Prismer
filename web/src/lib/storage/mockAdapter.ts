/**
 * Mock Storage Adapter
 * 
 * 使用 public/data/output 作为论文数据源
 * Chat Sessions 和 Notebooks 使用 localStorage 临时存储
 */

import type {
  StorageAdapter,
  PaperMeta,
  PaperData,
  OCRResult,
  ChatSession,
  Notebook,
  ReferenceMetadata,
} from './types';
import type { PaperMetadata, PageDetection, PaperInsight } from '@/types/paperContext';

// ============================================================
// Constants
// ============================================================

const BASE_PATH = '/data/output';

// LocalStorage keys
const STORAGE_KEYS = {
  CHAT_SESSIONS: 'pisa_chat_sessions',
  NOTEBOOKS: 'pisa_notebooks',
  PAPER_INSIGHTS: 'pisa_paper_insights',
  REFERENCE_METADATA: 'pisa_reference_metadata',
} as const;

// ============================================================
// Helper Functions
// ============================================================

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

function getFromStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

// ============================================================
// Paper Library Index
// ============================================================

/**
 * 获取已处理论文列表
 * 通过 API 接口获取 public/data/output 目录下的论文
 */
async function fetchPaperIndex(): Promise<string[]> {
  // 首先尝试获取 ocr_statistics.json 中的论文列表
  const stats = await fetchJSON<{
    total_papers: number;
    papers: Array<{ arxiv_id: string }>;
  }>(`${BASE_PATH}/ocr_statistics.json`);
  
  if (stats?.papers) {
    return stats.papers.map(p => p.arxiv_id);
  }
  
  // 备用方案：硬编码一些已知的论文
  // 在实际部署中，应该有一个 API 端点列出所有论文
  return [
    '2601.02346v1',  // Falcon-H1R
    '2512.24968v1',
    '2601.00097v1',
    '2601.00105v1',
    '2601.00121v1',
    '2601.02121v1',
    '2601.02204v1',
  ];
}

// ============================================================
// MockStorageAdapter Implementation
// ============================================================

export class MockStorageAdapter implements StorageAdapter {
  private paperIndexCache: string[] | null = null;
  
  // ==========================================
  // Paper Data
  // ==========================================
  
  async listPapers(): Promise<PaperMeta[]> {
    // 获取论文索引
    if (!this.paperIndexCache) {
      this.paperIndexCache = await fetchPaperIndex();
    }
    
    const papers: PaperMeta[] = [];
    
    // 并行加载所有论文的元数据
    const metadataPromises = this.paperIndexCache.map(async (paperId) => {
      const metadata = await fetchJSON<PaperMetadata>(
        `${BASE_PATH}/${paperId}/metadata.json`
      );
      
      if (metadata) {
        return {
          id: paperId,
          title: metadata.title || paperId,
          authors: metadata.authors || [],
          arxivId: metadata.arxiv_id,
          published: metadata.published,
          abstract: metadata.abstract,
          hasOCRData: true,
          totalPages: metadata.total_pages,
          categories: metadata.categories,
        } as PaperMeta;
      }
      return null;
    });
    
    const results = await Promise.all(metadataPromises);
    
    for (const paper of results) {
      if (paper) {
        papers.push(paper);
      }
    }
    
    // 按发布日期排序（最新的在前）
    papers.sort((a, b) => {
      if (!a.published || !b.published) return 0;
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    });
    
    return papers;
  }
  
  async getPaper(paperId: string): Promise<PaperData | null> {
    try {
      // 并行加载所有数据
      const [metadata, detectionsData, ocrResult, markdown] = await Promise.all([
        fetchJSON<PaperMetadata>(`${BASE_PATH}/${paperId}/metadata.json`),
        fetchJSON<{ pages: PageDetection[] }>(`${BASE_PATH}/${paperId}/detections.json`),
        fetchJSON<OCRResult>(`${BASE_PATH}/${paperId}/ocr_result.json`),
        fetchText(`${BASE_PATH}/${paperId}/paper.md`),
      ]);
      
      if (!metadata) {
        console.warn(`[MockStorageAdapter] Paper not found: ${paperId}`);
        return null;
      }
      
      return {
        meta: {
          id: paperId,
          title: metadata.title || paperId,
          authors: metadata.authors || [],
          arxivId: metadata.arxiv_id,
          published: metadata.published,
          abstract: metadata.abstract,
          hasOCRData: true,
          totalPages: metadata.total_pages,
          categories: metadata.categories,
        },
        metadata,
        markdown: markdown || '',
        detections: detectionsData?.pages || [],
        ocrResult: ocrResult || {
          success: false,
          total_pages: 0,
          total_processing_time: 0,
          markdown_content: '',
          pages: [],
        },
      };
    } catch (error) {
      console.error(`[MockStorageAdapter] Failed to load paper ${paperId}:`, error);
      return null;
    }
  }
  
  async hasPaper(paperId: string): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_PATH}/${paperId}/metadata.json`);
      return response.ok;
    } catch {
      return false;
    }
  }
  
  // ==========================================
  // Chat Sessions (localStorage)
  // ==========================================
  
  async listChatSessions(): Promise<ChatSession[]> {
    const sessions = getFromStorage<ChatSession[]>(STORAGE_KEYS.CHAT_SESSIONS);
    return sessions || [];
  }
  
  async getChatSession(id: string): Promise<ChatSession | null> {
    const sessions = await this.listChatSessions();
    return sessions.find(s => s.id === id) || null;
  }
  
  async saveChatSession(session: ChatSession): Promise<void> {
    const sessions = await this.listChatSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    
    setToStorage(STORAGE_KEYS.CHAT_SESSIONS, sessions);
  }
  
  async deleteChatSession(id: string): Promise<void> {
    const sessions = await this.listChatSessions();
    const filtered = sessions.filter(s => s.id !== id);
    setToStorage(STORAGE_KEYS.CHAT_SESSIONS, filtered);
  }
  
  // ==========================================
  // Notebooks (localStorage)
  // ==========================================
  
  async listNotebooks(): Promise<Notebook[]> {
    const notebooks = getFromStorage<Notebook[]>(STORAGE_KEYS.NOTEBOOKS);
    return notebooks || [];
  }
  
  async getNotebook(id: string): Promise<Notebook | null> {
    const notebooks = await this.listNotebooks();
    return notebooks.find(n => n.id === id) || null;
  }
  
  async saveNotebook(notebook: Notebook): Promise<void> {
    const notebooks = await this.listNotebooks();
    const index = notebooks.findIndex(n => n.id === notebook.id);
    
    if (index >= 0) {
      notebooks[index] = notebook;
    } else {
      notebooks.push(notebook);
    }
    
    setToStorage(STORAGE_KEYS.NOTEBOOKS, notebooks);
  }
  
  async deleteNotebook(id: string): Promise<void> {
    const notebooks = await this.listNotebooks();
    const filtered = notebooks.filter(n => n.id !== id);
    setToStorage(STORAGE_KEYS.NOTEBOOKS, filtered);
  }
  
  // ==========================================
  // Paper Insights Cache (localStorage)
  // ==========================================
  
  async getPaperInsights(paperId: string): Promise<PaperInsight[]> {
    const cache = getFromStorage<Record<string, PaperInsight[]>>(STORAGE_KEYS.PAPER_INSIGHTS);
    return cache?.[paperId] || [];
  }
  
  async savePaperInsights(paperId: string, insights: PaperInsight[]): Promise<void> {
    const cache = getFromStorage<Record<string, PaperInsight[]>>(STORAGE_KEYS.PAPER_INSIGHTS) || {};
    cache[paperId] = insights;
    setToStorage(STORAGE_KEYS.PAPER_INSIGHTS, cache);
  }
  
  // ==========================================
  // Reference Metadata Cache (localStorage)
  // ==========================================
  
  async getReferenceMetadata(identifier: string): Promise<ReferenceMetadata | null> {
    const cache = getFromStorage<Record<string, ReferenceMetadata>>(STORAGE_KEYS.REFERENCE_METADATA);
    return cache?.[identifier] || null;
  }
  
  async saveReferenceMetadata(identifier: string, metadata: ReferenceMetadata): Promise<void> {
    const cache = getFromStorage<Record<string, ReferenceMetadata>>(STORAGE_KEYS.REFERENCE_METADATA) || {};
    cache[identifier] = metadata;
    setToStorage(STORAGE_KEYS.REFERENCE_METADATA, cache);
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let instance: MockStorageAdapter | null = null;

export function getMockStorageAdapter(): MockStorageAdapter {
  if (!instance) {
    instance = new MockStorageAdapter();
  }
  return instance;
}
