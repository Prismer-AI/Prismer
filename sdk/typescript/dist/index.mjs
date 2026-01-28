// src/index.ts
var PrismerClient = class {
  constructor(config) {
    if (!config.apiKey) {
      throw new Error("apiKey is required");
    }
    if (!config.apiKey.startsWith("sk-prismer-")) {
      console.warn('Warning: API key should start with "sk-prismer-"');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://prismer.cloud").replace(/\/$/, "");
    this.timeout = config.timeout || 3e4;
    this.fetchFn = config.fetch || fetch;
  }
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
  async load(input, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/context/load`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          input,
          inputType: options.inputType,
          processUncached: options.processUncached,
          search: options.search,
          processing: options.processing,
          return: options.return,
          ranking: options.ranking
        }),
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: "HTTP_ERROR",
            message: `Request failed with status ${response.status}`
          }
        };
      }
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: { code: "TIMEOUT", message: "Request timed out" }
        };
      }
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
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
  async save(options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/context/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(options),
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: "HTTP_ERROR",
            message: `Request failed with status ${response.status}`
          }
        };
      }
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: { code: "TIMEOUT", message: "Request timed out" }
        };
      }
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
  /**
   * Batch save multiple items
   * Convenience method for save({ items: [...] })
   * 
   * @param items - Array of save options (max 50)
   */
  async saveBatch(items) {
    return this.save({ items });
  }
};
var index_default = PrismerClient;
function createClient(config) {
  return new PrismerClient(config);
}
export {
  PrismerClient,
  createClient,
  index_default as default
};
