/**
 * Semantic Scholar API Service
 * 
 * 提供论文引用、被引用、搜索等功能
 * API 文档: https://api.semanticscholar.org/api-docs/
 */

// ============================================================================
// Types
// ============================================================================

export interface S2Author {
  authorId: string | null;
  name: string;
}

export interface S2ExternalIds {
  ArXiv?: string;
  DOI?: string;
  CorpusId?: number;
  PubMed?: string;
  DBLP?: string;
  MAG?: string;
}

export interface S2Paper {
  paperId: string;
  title: string;
  authors: S2Author[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  externalIds: S2ExternalIds | null;
  citationCount?: number;
  referenceCount?: number;
  url?: string;
  openAccessPdf?: {
    url: string;
    status: string;
  } | null;
}

export interface S2Reference {
  citedPaper: S2Paper;
  intents?: string[];
  isInfluential?: boolean;
  contextsWithIntent?: Array<{
    context: string;
    intents: string[];
  }>;
}

export interface S2Citation {
  citingPaper: S2Paper;
  intents?: string[];
  isInfluential?: boolean;
}

export interface S2SearchResult {
  total: number;
  offset: number;
  next?: number;
  data: S2Paper[];
}

export interface S2ReferencesResult {
  offset: number;
  next?: number;
  data: S2Reference[];
}

export interface S2CitationsResult {
  offset: number;
  next?: number;
  data: S2Citation[];
}

// ============================================================================
// API Configuration
// ============================================================================

const S2_API_BASE = "https://api.semanticscholar.org/graph/v1";

// 默认请求的字段
const PAPER_FIELDS = [
  "title",
  "authors",
  "year",
  "venue",
  "abstract",
  "externalIds",
  "citationCount",
  "referenceCount",
  "openAccessPdf",
  "url",
].join(",");

const REFERENCE_FIELDS = [
  "title",
  "authors",
  "year",
  "venue",
  "abstract",
  "externalIds",
  "citationCount",
  "openAccessPdf",
].join(",");

// 限流配置
const RATE_LIMIT_DELAY = 100; // 100ms between requests
let lastRequestTime = 0;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return fetch(url, options);
}

// ============================================================================
// Paper ID Utilities
// ============================================================================

/**
 * 构建 Semantic Scholar paper ID
 * 支持 arXiv ID, DOI, 或直接使用 S2 Paper ID
 */
export function buildPaperId(identifier: string, type: 'arxiv' | 'doi' | 's2' = 'arxiv'): string {
  switch (type) {
    case 'arxiv':
      // 移除可能的 arXiv: 前缀和版本号
      const cleanArxiv = identifier.replace(/^arXiv:/i, '').replace(/v\d+$/, '');
      return `arXiv:${cleanArxiv}`;
    case 'doi':
      return `DOI:${identifier}`;
    case 's2':
      return identifier;
    default:
      return identifier;
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * 获取论文详情
 */
export async function getPaper(paperId: string): Promise<S2Paper | null> {
  try {
    const response = await rateLimitedFetch(
      `${S2_API_BASE}/paper/${encodeURIComponent(paperId)}?fields=${PAPER_FIELDS}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[S2] Paper not found: ${paperId}`);
        return null;
      }
      throw new Error(`S2 API error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error(`[S2] Failed to get paper ${paperId}:`, error);
    return null;
  }
}

/**
 * 获取论文的引用列表 (该论文引用了哪些文献)
 */
export async function getPaperReferences(
  paperId: string,
  options: { offset?: number; limit?: number } = {}
): Promise<S2ReferencesResult | null> {
  const { offset = 0, limit = 100 } = options;
  
  try {
    const url = new URL(`${S2_API_BASE}/paper/${encodeURIComponent(paperId)}/references`);
    url.searchParams.set('fields', REFERENCE_FIELDS);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(limit));
    
    const response = await rateLimitedFetch(url.toString());
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[S2] Paper not found: ${paperId}`);
        return null;
      }
      throw new Error(`S2 API error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error(`[S2] Failed to get references for ${paperId}:`, error);
    return null;
  }
}

/**
 * 获取引用该论文的文献列表 (被引用)
 */
export async function getPaperCitations(
  paperId: string,
  options: { offset?: number; limit?: number } = {}
): Promise<S2CitationsResult | null> {
  const { offset = 0, limit = 100 } = options;
  
  try {
    const url = new URL(`${S2_API_BASE}/paper/${encodeURIComponent(paperId)}/citations`);
    url.searchParams.set('fields', REFERENCE_FIELDS);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(limit));
    
    const response = await rateLimitedFetch(url.toString());
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[S2] Paper not found: ${paperId}`);
        return null;
      }
      throw new Error(`S2 API error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error(`[S2] Failed to get citations for ${paperId}:`, error);
    return null;
  }
}

/**
 * 搜索论文
 */
export async function searchPapers(
  query: string,
  options: { offset?: number; limit?: number } = {}
): Promise<S2SearchResult | null> {
  const { offset = 0, limit = 10 } = options;
  
  try {
    const url = new URL(`${S2_API_BASE}/paper/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('fields', PAPER_FIELDS);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(limit));
    
    const response = await rateLimitedFetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`S2 API error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error(`[S2] Failed to search papers:`, error);
    return null;
  }
}

/**
 * 论文自动完成
 */
export async function autocompletePapers(query: string): Promise<S2Paper[]> {
  if (query.length < 3) return [];
  
  try {
    const response = await rateLimitedFetch(
      `${S2_API_BASE}/paper/autocomplete?query=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      throw new Error(`S2 API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error(`[S2] Autocomplete failed:`, error);
    return [];
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * 批量获取论文详情
 */
export async function batchGetPapers(paperIds: string[]): Promise<Map<string, S2Paper>> {
  const results = new Map<string, S2Paper>();
  
  // S2 API 支持批量请求，但有限制，这里简单处理
  for (const id of paperIds) {
    const paper = await getPaper(id);
    if (paper) {
      results.set(id, paper);
    }
  }
  
  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 从 S2Paper 提取 arXiv ID
 */
export function extractArxivId(paper: S2Paper): string | null {
  return paper.externalIds?.ArXiv || null;
}

/**
 * 从 S2Paper 提取 DOI
 */
export function extractDoi(paper: S2Paper): string | null {
  return paper.externalIds?.DOI || null;
}

/**
 * 获取论文的 PDF URL
 */
export function getPdfUrl(paper: S2Paper): string | null {
  // 优先使用 Open Access PDF
  if (paper.openAccessPdf?.url) {
    return paper.openAccessPdf.url;
  }
  
  // 尝试使用 arXiv PDF
  const arxivId = extractArxivId(paper);
  if (arxivId) {
    return `https://arxiv.org/pdf/${arxivId}.pdf`;
  }
  
  return null;
}

/**
 * 格式化作者列表
 */
export function formatAuthors(authors: S2Author[], maxCount = 3): string {
  if (!authors || authors.length === 0) return "Unknown Authors";
  
  const names = authors.slice(0, maxCount).map(a => a.name);
  if (authors.length > maxCount) {
    names.push(`+${authors.length - maxCount} more`);
  }
  
  return names.join(", ");
}

// ============================================================================
// Export Default Service Object
// ============================================================================

export const semanticScholarService = {
  getPaper,
  getPaperReferences,
  getPaperCitations,
  searchPapers,
  autocompletePapers,
  batchGetPapers,
  buildPaperId,
  extractArxivId,
  extractDoi,
  getPdfUrl,
  formatAuthors,
};

export default semanticScholarService;
