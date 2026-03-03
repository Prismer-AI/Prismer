// ============================================================
// Template Service
// ============================================================

import {
  TemplateCatalog,
  TemplateMetadata,
  TemplateFiles,
  TemplateFilters,
  TemplateCategory,
  GitHubImportOptions,
  ServiceResponse,
  ImportResult,
  CATEGORIES,
} from "../types";
import { GitHubService, githubService } from "./GitHubService";
import { CacheService, cacheService } from "./CacheService";
import catalogData from "../data/catalog.json";

/**
 * Template Service for managing LaTeX templates
 * 
 * Provides template catalog management, GitHub integration,
 * and caching for downloaded templates.
 */
export class TemplateService {
  private catalog: TemplateCatalog;
  private githubService: GitHubService;
  private cacheService: CacheService;

  constructor(github?: GitHubService, cache?: CacheService) {
    this.catalog = catalogData as TemplateCatalog;
    this.githubService = github || githubService;
    this.cacheService = cache || cacheService;
    
    // Enrich catalog with category counts
    this.updateCategoryCounts();
  }

  /**
   * Update category counts based on templates
   */
  private updateCategoryCounts(): void {
    const counts = new Map<TemplateCategory, number>();
    
    for (const template of this.catalog.templates) {
      const count = counts.get(template.category) || 0;
      counts.set(template.category, count + 1);
    }
    
    this.catalog.categories = CATEGORIES.map(cat => ({
      ...cat,
      count: counts.get(cat.id) || 0,
    }));
  }

  /**
   * Get the full template catalog
   */
  getCatalog(): TemplateCatalog {
    return this.catalog;
  }

  /**
   * Get all templates
   */
  getAllTemplates(): TemplateMetadata[] {
    return this.catalog.templates;
  }

  /**
   * Get all categories with counts
   */
  getCategories(): TemplateCatalog["categories"] {
    return this.catalog.categories;
  }

  /**
   * Get a single template by ID
   */
  getTemplateById(id: string): TemplateMetadata | undefined {
    return this.catalog.templates.find(t => t.id === id);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: TemplateCategory): TemplateMetadata[] {
    return this.catalog.templates.filter(t => t.category === category);
  }

  /**
   * Search and filter templates
   */
  searchTemplates(filters: TemplateFilters): TemplateMetadata[] {
    let results = [...this.catalog.templates];

    // Filter by category
    if (filters.category) {
      results = results.filter(t => t.category === filters.category);
    }

    // Filter by source type
    if (filters.source) {
      results = results.filter(t => t.source.type === filters.source);
    }

    // Filter by document class
    if (filters.documentClass) {
      results = results.filter(t => t.documentClass === filters.documentClass);
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(t =>
        filters.tags!.some(tag => 
          t.tags.some(tTag => tTag.toLowerCase().includes(tag.toLowerCase()))
        )
      );
    }

    // Filter by query (search in name, description, tags)
    if (filters.query && filters.query.trim()) {
      const query = filters.query.toLowerCase().trim();
      results = results.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query)) ||
        (t.author && t.author.toLowerCase().includes(query))
      );
    }

    // Sort by stars (descending)
    results.sort((a, b) => (b.stars || 0) - (a.stars || 0));

    return results;
  }

  /**
   * Download a template from the catalog
   * Uses cache to avoid redundant downloads
   */
  async downloadTemplate(id: string, useCache: boolean = true): Promise<ServiceResponse<TemplateFiles>> {
    const template = this.getTemplateById(id);
    
    if (!template) {
      return {
        success: false,
        error: `Template not found: ${id}`,
      };
    }

    // Check cache first
    if (useCache) {
      const cached = this.cacheService.getTemplateFiles(id);
      if (cached) {
        return {
          success: true,
          data: cached,
          message: `Loaded ${cached.files.length} files from cache`,
        };
      }
    }

    try {
      let files: TemplateFiles;

      switch (template.source.type) {
        case "github":
          if (!template.source.github) {
            throw new Error("GitHub source configuration missing");
          }
          
          files = await this.githubService.importTemplate(
            template.source.github.owner,
            template.source.github.repo,
            {
              branch: template.source.github.branch,
              path: template.source.github.path,
              mainFile: template.source.github.mainFile,
            }
          );
          break;

        case "overleaf":
          // For Overleaf templates, return a placeholder with link
          return {
            success: false,
            error: "Overleaf templates require manual download",
            message: `Please visit: ${template.source.overleaf?.webUrl}`,
          };

        case "url":
          // TODO: Implement URL download
          return {
            success: false,
            error: "URL download not yet implemented",
          };

        default:
          return {
            success: false,
            error: `Unsupported source type: ${template.source.type}`,
          };
      }

      // Cache the downloaded files
      this.cacheService.setTemplateFiles(id, files);

      return {
        success: true,
        data: files,
        message: `Successfully downloaded ${files.files.length} files`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.cacheService.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheService.getStats();
  }

  /**
   * Import a template from a GitHub URL
   * Uses cache to avoid redundant downloads
   */
  async importFromGitHub(
    url: string,
    options?: GitHubImportOptions & { useCache?: boolean }
  ): Promise<ServiceResponse<ImportResult>> {
    const parsed = GitHubService.parseGitHubUrl(url);
    
    if (!parsed) {
      return {
        success: false,
        error: "Invalid GitHub URL",
      };
    }

    const useCache = options?.useCache !== false;

    // Check cache first
    if (useCache) {
      const cached = this.cacheService.getGitHubImport(parsed.owner, parsed.repo);
      if (cached) {
        return {
          success: true,
          data: {
            success: true,
            files: cached,
          },
          message: `Loaded ${cached.files.length} files from cache`,
        };
      }
    }

    try {
      const files = await this.githubService.importTemplate(
        parsed.owner,
        parsed.repo,
        {
          ...options,
          path: options?.path || parsed.path,
        }
      );

      // Cache the imported files
      this.cacheService.setGitHubImport(parsed.owner, parsed.repo, files);

      return {
        success: true,
        data: {
          success: true,
          files,
        },
        message: `Imported ${files.files.length} files from ${parsed.owner}/${parsed.repo}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to import from GitHub",
      };
    }
  }

  /**
   * Import from a ZIP file URL
   */
  async importFromUrl(url: string): Promise<ServiceResponse<ImportResult>> {
    // TODO: Implement ZIP file download and extraction
    return {
      success: false,
      error: "URL import not yet implemented",
    };
  }

  /**
   * Parse and import from a local ZIP file
   * Note: This should be called from the browser with File object
   */
  async importFromFile(file: File): Promise<ServiceResponse<ImportResult>> {
    // This is a placeholder - actual implementation would use JSZip
    // and should be handled in the component with browser File API
    
    if (!file.name.endsWith(".zip")) {
      return {
        success: false,
        error: "Only .zip files are supported",
      };
    }

    return {
      success: false,
      error: "File import should be handled in the browser component",
      message: "Use the TemplateImporter component for file uploads",
    };
  }

  /**
   * Get popular/featured templates
   */
  getFeaturedTemplates(limit: number = 8): TemplateMetadata[] {
    return this.catalog.templates
      .filter(t => t.stars && t.stars > 0)
      .sort((a, b) => (b.stars || 0) - (a.stars || 0))
      .slice(0, limit);
  }

  /**
   * Get recent templates
   */
  getRecentTemplates(limit: number = 8): TemplateMetadata[] {
    return this.catalog.templates
      .filter(t => t.lastUpdated)
      .sort((a, b) => {
        const dateA = new Date(a.lastUpdated || 0);
        const dateB = new Date(b.lastUpdated || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, limit);
  }

  /**
   * Get templates by tag
   */
  getTemplatesByTag(tag: string): TemplateMetadata[] {
    const lowerTag = tag.toLowerCase();
    return this.catalog.templates.filter(t =>
      t.tags.some(tTag => tTag.toLowerCase() === lowerTag)
    );
  }

  /**
   * Get all unique tags
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    
    for (const template of this.catalog.templates) {
      for (const tag of template.tags) {
        tagSet.add(tag);
      }
    }
    
    return Array.from(tagSet).sort();
  }

  /**
   * Add a custom template to the catalog (runtime only)
   */
  addTemplate(template: TemplateMetadata): void {
    // Check if already exists
    if (this.getTemplateById(template.id)) {
      throw new Error(`Template with ID ${template.id} already exists`);
    }
    
    this.catalog.templates.push(template);
    this.updateCategoryCounts();
  }

  /**
   * Search GitHub for templates (live search)
   */
  async searchGitHub(query: string): Promise<ServiceResponse<TemplateMetadata[]>> {
    try {
      const result = await this.githubService.searchRepositories(query);
      
      // Convert GitHub repos to template metadata
      const templates: TemplateMetadata[] = result.items.map(repo => ({
        id: `github-${repo.fullName.replace("/", "-")}`,
        name: repo.name,
        description: repo.description || "No description",
        category: "other" as TemplateCategory,
        tags: repo.topics,
        source: {
          type: "github" as const,
          github: {
            owner: repo.owner.login,
            repo: repo.name,
            branch: repo.defaultBranch,
          },
        },
        author: repo.owner.login,
        stars: repo.stars,
        lastUpdated: repo.updatedAt,
      }));

      return {
        success: true,
        data: templates,
        message: `Found ${result.totalCount} repositories`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "GitHub search failed",
      };
    }
  }
}

// Export singleton instance
export const templateService = new TemplateService();
