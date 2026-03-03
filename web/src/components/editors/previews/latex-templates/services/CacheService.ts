// ============================================================
// Template Cache Service
// ============================================================

import type { TemplateFiles, TemplateMetadata } from "../types";

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache configuration
 */
interface CacheConfig {
  defaultTTL: number;       // Default time-to-live in milliseconds
  maxEntries: number;       // Maximum number of entries
  storageKey: string;       // localStorage key prefix
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 24 * 60 * 60 * 1000,  // 24 hours
  maxEntries: 50,
  storageKey: "latex-template-cache",
};

/**
 * Template Cache Service
 * 
 * Provides caching for template files and metadata to reduce API calls
 * and improve performance.
 */
export class CacheService {
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  /**
   * Generate cache key for template files
   */
  private getFilesKey(templateId: string): string {
    return `files:${templateId}`;
  }

  /**
   * Generate cache key for template metadata
   */
  private getMetaKey(templateId: string): string {
    return `meta:${templateId}`;
  }

  /**
   * Generate cache key for GitHub repo
   */
  private getGitHubKey(owner: string, repo: string): string {
    return `github:${owner}/${repo}`;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, data: T, ttl: number = this.config.defaultTTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    this.memoryCache.set(key, entry);

    // Enforce max entries limit
    if (this.memoryCache.size > this.config.maxEntries) {
      this.evictOldest();
    }

    // Persist to storage
    this.saveToStorage();
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.memoryCache.delete(key);
      this.saveToStorage();
      return null;
    }

    return entry.data;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.memoryCache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const deleted = this.memoryCache.delete(key);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.memoryCache.clear();
    this.saveToStorage();
  }

  /**
   * Evict oldest entries to make room
   */
  private evictOldest(): void {
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 20% of entries
    const toRemove = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.memoryCache.delete(entries[i][0]);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.saveToStorage();
    }

    return removed;
  }

  // ============================================================
  // Template-specific methods
  // ============================================================

  /**
   * Cache template files
   */
  setTemplateFiles(templateId: string, files: TemplateFiles): void {
    this.set(this.getFilesKey(templateId), files);
  }

  /**
   * Get cached template files
   */
  getTemplateFiles(templateId: string): TemplateFiles | null {
    return this.get<TemplateFiles>(this.getFilesKey(templateId));
  }

  /**
   * Cache template metadata
   */
  setTemplateMetadata(templateId: string, metadata: TemplateMetadata): void {
    this.set(this.getMetaKey(templateId), metadata);
  }

  /**
   * Get cached template metadata
   */
  getTemplateMetadata(templateId: string): TemplateMetadata | null {
    return this.get<TemplateMetadata>(this.getMetaKey(templateId));
  }

  /**
   * Cache GitHub import result
   */
  setGitHubImport(owner: string, repo: string, files: TemplateFiles): void {
    // Shorter TTL for GitHub imports (1 hour)
    this.set(this.getGitHubKey(owner, repo), files, 60 * 60 * 1000);
  }

  /**
   * Get cached GitHub import
   */
  getGitHubImport(owner: string, repo: string): TemplateFiles | null {
    return this.get<TemplateFiles>(this.getGitHubKey(owner, repo));
  }

  // ============================================================
  // Storage persistence
  // ============================================================

  /**
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    try {
      if (typeof window === "undefined") return;

      const entries = Array.from(this.memoryCache.entries());
      const data = JSON.stringify(entries);
      localStorage.setItem(this.config.storageKey, data);
    } catch (error) {
      // Storage might be full or unavailable
      console.warn("Failed to save cache to storage:", error);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      if (typeof window === "undefined") return;

      const data = localStorage.getItem(this.config.storageKey);
      if (!data) return;

      const entries: [string, CacheEntry<unknown>][] = JSON.parse(data);
      
      // Filter out expired entries while loading
      const now = Date.now();
      for (const [key, entry] of entries) {
        if (now < entry.expiresAt) {
          this.memoryCache.set(key, entry);
        }
      }
    } catch (error) {
      console.warn("Failed to load cache from storage:", error);
    }
  }

  // ============================================================
  // Statistics
  // ============================================================

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    size: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const entries = Array.from(this.memoryCache.values());
    
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const entry of entries) {
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
      if (newest === null || entry.timestamp > newest) {
        newest = entry.timestamp;
      }
    }

    return {
      entries: this.memoryCache.size,
      size: new Blob([JSON.stringify(Array.from(this.memoryCache.entries()))]).size,
      oldestEntry: oldest ? new Date(oldest) : null,
      newestEntry: newest ? new Date(newest) : null,
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();
