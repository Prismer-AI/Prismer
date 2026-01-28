/**
 * Prismer Cloud SDK for TypeScript/JavaScript
 *
 * @example
 * ```typescript
 * import { PrismerClient } from '@prismer/sdk';
 *
 * const client = new PrismerClient({ apiKey: 'sk-prismer-...' });
 *
 * // Load content from URL
 * const result = await client.load('https://example.com');
 *
 * // Load from query
 * const results = await client.load('latest AI news');
 *
 * // Save content
 * await client.save({
 *   url: 'https://example.com',
 *   hqcc: 'compressed content...'
 * });
 * ```
 */
interface PrismerConfig {
    /** API Key (starts with sk-prismer-) */
    apiKey: string;
    /** Base URL (default: https://prismer.cloud) */
    baseUrl?: string;
    /** Request timeout in ms (default: 30000) */
    timeout?: number;
    /** Custom fetch implementation */
    fetch?: typeof fetch;
}
interface LoadOptions {
    /** Force input type detection: 'url' | 'urls' | 'query' */
    inputType?: 'url' | 'urls' | 'query';
    /** Process uncached URLs (for batch mode) */
    processUncached?: boolean;
    /** Search configuration (only for query mode) */
    search?: {
        /** Number of search results to fetch (default: 15) */
        topK?: number;
    };
    /** Processing configuration */
    processing?: {
        /** Compression strategy */
        strategy?: 'auto' | 'fast' | 'quality';
        /** Max concurrent compressions (default: 3) */
        maxConcurrent?: number;
    };
    /** Return configuration */
    return?: {
        /** Return format: 'hqcc' | 'raw' | 'both' */
        format?: 'hqcc' | 'raw' | 'both';
        /** Number of results to return (default: 5, for query mode) */
        topK?: number;
    };
    /** Ranking configuration (only for query mode) */
    ranking?: {
        /** Ranking preset */
        preset?: 'cache_first' | 'relevance_first' | 'balanced';
        /** Custom ranking weights (0-1 each) */
        custom?: {
            cacheHit?: number;
            relevance?: number;
            freshness?: number;
            quality?: number;
        };
    };
}
/** Ranking factors breakdown */
interface RankingFactors {
    cache: number;
    relevance: number;
    freshness: number;
    quality: number;
}
interface LoadResultItem {
    /** Result rank (1-based, for query mode) */
    rank?: number;
    /** Source URL */
    url: string;
    /** Page title */
    title?: string;
    /** High-quality compressed content */
    hqcc?: string | null;
    /** Raw content (if format='both' or 'raw') */
    raw?: string;
    /** Whether result was from cache */
    cached: boolean;
    /** When content was cached */
    cachedAt?: string;
    /** Whether item was processed in this request (batch mode) */
    processed?: boolean;
    /** Item found in cache or processed (batch mode) */
    found?: boolean;
    /** Error message if processing failed */
    error?: string;
    /** Ranking details (query mode) */
    ranking?: {
        score: number;
        factors: RankingFactors;
    };
    /** Additional metadata */
    meta?: Record<string, any>;
}
/** Cost info for single URL mode */
interface SingleUrlCost {
    credits: number;
    cached: boolean;
}
/** Cost info for batch URL mode */
interface BatchUrlCost {
    credits: number;
    cached: number;
}
/** Cost info for query mode */
interface QueryCost {
    searchCredits: number;
    compressionCredits: number;
    totalCredits: number;
    savedByCache: number;
}
/** Summary for batch URL mode */
interface BatchSummary {
    total: number;
    found: number;
    notFound: number;
    cached: number;
    processed: number;
}
/** Summary for query mode */
interface QuerySummary {
    query: string;
    searched: number;
    cacheHits: number;
    compressed: number;
    returned: number;
}
interface LoadResult {
    /** Request succeeded */
    success: boolean;
    /** Unique request ID */
    requestId?: string;
    /** Processing mode */
    mode?: 'single_url' | 'batch_urls' | 'query';
    /** Single result (for single_url mode) */
    result?: LoadResultItem;
    /** Results array (for batch_urls and query modes) */
    results?: LoadResultItem[];
    /** Summary statistics */
    summary?: BatchSummary | QuerySummary;
    /** Cost breakdown */
    cost?: SingleUrlCost | BatchUrlCost | QueryCost;
    /** Processing time in ms */
    processingTime?: number;
    /** Error info */
    error?: {
        code: string;
        message: string;
    };
}
interface SaveOptions {
    /** Source URL */
    url: string;
    /** High-quality compressed content (required) */
    hqcc: string;
    /** Raw/intermediate content (optional) */
    raw?: string;
    /** Additional metadata */
    meta?: Record<string, any>;
}
interface SaveBatchOptions {
    /** Items to save (max 50) */
    items: SaveOptions[];
}
interface SaveResult {
    success: boolean;
    /** Status: 'created' | 'exists' (single save) */
    status?: string;
    /** URL (single save) */
    url?: string;
    /** Batch results */
    results?: Array<{
        url: string;
        status: string;
    }>;
    /** Batch summary */
    summary?: {
        total: number;
        created: number;
        exists: number;
    };
    error?: {
        code: string;
        message: string;
    };
}
declare class PrismerClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeout;
    private readonly fetchFn;
    constructor(config: PrismerConfig);
    /**
     * Load content from URL(s) or search query
     *
     * The API auto-detects input type:
     * - Single URL: "https://..." → checks cache, fetches & compresses if miss
     * - URL array: ["url1", "url2"] → batch cache check
     * - Query string: "search terms" → searches, caches results, ranks
     *
     * @param input - URL, array of URLs, or search query
     * @param options - Load options
     * @returns Load result with content
     *
     * @example
     * ```typescript
     * // Single URL
     * const result = await client.load('https://example.com');
     * console.log(result.result?.hqcc);
     *
     * // Batch URLs (cache check only by default)
     * const results = await client.load(['url1', 'url2']);
     *
     * // Batch URLs with processing
     * const results = await client.load(['url1', 'url2'], { processUncached: true });
     *
     * // Search query
     * const results = await client.load('latest AI news', {
     *   search: { topK: 15 },
     *   return: { topK: 5, format: 'both' },
     *   ranking: { preset: 'cache_first' }
     * });
     * ```
     */
    load(input: string | string[], options?: LoadOptions): Promise<LoadResult>;
    /**
     * Save content to Prismer cache
     *
     * Requires authentication. Content is stored globally and can be
     * retrieved by any authenticated user via load().
     *
     * @param options - Save options (single item or batch)
     * @returns Save result
     *
     * @example
     * ```typescript
     * // Single save
     * await client.save({
     *   url: 'https://example.com',
     *   hqcc: 'compressed content...',
     *   raw: 'original content...',
     *   meta: { source: 'my-agent' }
     * });
     *
     * // Batch save (max 50 items)
     * await client.save({
     *   items: [
     *     { url: 'url1', hqcc: 'content1' },
     *     { url: 'url2', hqcc: 'content2' },
     *   ]
     * });
     * ```
     */
    save(options: SaveOptions | SaveBatchOptions): Promise<SaveResult>;
    /**
     * Batch save multiple items
     * Convenience method for save({ items: [...] })
     *
     * @param items - Array of save options (max 50)
     */
    saveBatch(items: SaveOptions[]): Promise<SaveResult>;
}

/**
 * Create a new Prismer client
 */
declare function createClient(config: PrismerConfig): PrismerClient;

export { type BatchSummary, type BatchUrlCost, type LoadOptions, type LoadResult, type LoadResultItem, PrismerClient, type PrismerConfig, type QueryCost, type QuerySummary, type RankingFactors, type SaveBatchOptions, type SaveOptions, type SaveResult, type SingleUrlCost, createClient, PrismerClient as default };
