// ============================================================
// GitHub API Service
// ============================================================

import {
  GitHubRepo,
  GitHubContent,
  GitHubSearchResult,
  GitHubImportOptions,
  TemplateFiles,
  TemplateFile,
  DEFAULT_IMPORT_OPTIONS,
  getFileType,
  isTextFile,
  shouldIgnoreFile,
} from "../types";

/**
 * GitHub API base URL
 */
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com";

/**
 * GitHub API rate limit info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

/**
 * GitHub Service for interacting with GitHub API
 */
export class GitHubService {
  private token?: string;
  
  constructor(token?: string) {
    this.token = token;
  }

  /**
   * Set GitHub token for authenticated requests
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Get request headers
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Pisa-OS-LaTeX-Editor",
    };
    
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  /**
   * Make a GitHub API request
   */
  private async request<T>(endpoint: string): Promise<T> {
    const url = endpoint.startsWith("http") 
      ? endpoint 
      : `${GITHUB_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
        if (rateLimitRemaining === "0") {
          const resetTime = response.headers.get("X-RateLimit-Reset");
          const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : new Date();
          throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}`);
        }
      }
      
      if (response.status === 404) {
        throw new Error("Repository or file not found");
      }
      
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit(): Promise<RateLimitInfo> {
    const data = await this.request<{
      rate: { limit: number; remaining: number; reset: number };
    }>("/rate_limit");
    
    return {
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: new Date(data.rate.reset * 1000),
    };
  }

  /**
   * Search for LaTeX template repositories
   */
  async searchRepositories(
    query: string,
    options: { perPage?: number; page?: number } = {}
  ): Promise<GitHubSearchResult> {
    const { perPage = 20, page = 1 } = options;
    
    // Add LaTeX-related qualifiers to the search
    const searchQuery = encodeURIComponent(
      `${query} latex template language:TeX`
    );
    
    const data = await this.request<{
      total_count: number;
      incomplete_results: boolean;
      items: Array<{
        name: string;
        full_name: string;
        description: string | null;
        stargazers_count: number;
        forks_count: number;
        updated_at: string;
        default_branch: string;
        topics: string[];
        html_url: string;
        owner: {
          login: string;
          avatar_url: string;
        };
      }>;
    }>(`/search/repositories?q=${searchQuery}&per_page=${perPage}&page=${page}&sort=stars`);

    return {
      totalCount: data.total_count,
      incompleteResults: data.incomplete_results,
      items: data.items.map((item) => ({
        name: item.name,
        fullName: item.full_name,
        description: item.description,
        stars: item.stargazers_count,
        forks: item.forks_count,
        updatedAt: item.updated_at,
        defaultBranch: item.default_branch,
        topics: item.topics || [],
        htmlUrl: item.html_url,
        owner: {
          login: item.owner.login,
          avatarUrl: item.owner.avatar_url,
        },
      })),
    };
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    const data = await this.request<{
      name: string;
      full_name: string;
      description: string | null;
      stargazers_count: number;
      forks_count: number;
      updated_at: string;
      default_branch: string;
      topics: string[];
      html_url: string;
      owner: {
        login: string;
        avatar_url: string;
      };
    }>(`/repos/${owner}/${repo}`);

    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      stars: data.stargazers_count,
      forks: data.forks_count,
      updatedAt: data.updated_at,
      defaultBranch: data.default_branch,
      topics: data.topics || [],
      htmlUrl: data.html_url,
      owner: {
        login: data.owner.login,
        avatarUrl: data.owner.avatar_url,
      },
    };
  }

  /**
   * Get repository contents (files and directories)
   */
  async getContents(
    owner: string,
    repo: string,
    path: string = "",
    ref?: string
  ): Promise<GitHubContent[]> {
    const endpoint = `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`;
    
    const data = await this.request<
      Array<{
        name: string;
        path: string;
        sha: string;
        size: number;
        type: "file" | "dir";
        download_url: string | null;
        html_url: string;
      }> | {
        name: string;
        path: string;
        sha: string;
        size: number;
        type: "file";
        download_url: string | null;
        html_url: string;
        content?: string;
      }
    >(endpoint);

    // Handle single file response
    if (!Array.isArray(data)) {
      return [{
        name: data.name,
        path: data.path,
        sha: data.sha,
        size: data.size,
        type: data.type,
        downloadUrl: data.download_url,
        htmlUrl: data.html_url,
      }];
    }

    return data.map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      size: item.size,
      type: item.type,
      downloadUrl: item.download_url,
      htmlUrl: item.html_url,
    }));
  }

  /**
   * Get file content as text
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string> {
    // Use raw.githubusercontent.com for direct file access
    const branch = ref || "main";
    const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${branch}/${path}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        // Try with 'master' branch
        const masterUrl = `${GITHUB_RAW_BASE}/${owner}/${repo}/master/${path}`;
        const masterResponse = await fetch(masterUrl);
        
        if (!masterResponse.ok) {
          throw new Error(`File not found: ${path}`);
        }
        
        return masterResponse.text();
      }
      
      throw new Error(`Failed to fetch file: ${response.status}`);
    }
    
    return response.text();
  }

  /**
   * Recursively get all files in a repository directory
   */
  async getAllFiles(
    owner: string,
    repo: string,
    path: string = "",
    ref?: string,
    options: GitHubImportOptions = {}
  ): Promise<GitHubContent[]> {
    const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options };
    const allFiles: GitHubContent[] = [];
    
    const contents = await this.getContents(owner, repo, path, ref);
    
    for (const item of contents) {
      if (shouldIgnoreFile(item.path)) {
        continue;
      }
      
      if (item.type === "dir") {
        // Recursively get directory contents
        const subFiles = await this.getAllFiles(owner, repo, item.path, ref, opts);
        allFiles.push(...subFiles);
      } else if (item.type === "file") {
        // Check file size
        if (item.size > (opts.maxFileSize || DEFAULT_IMPORT_OPTIONS.maxFileSize!)) {
          console.warn(`Skipping large file: ${item.path} (${item.size} bytes)`);
          continue;
        }
        
        allFiles.push(item);
      }
    }
    
    return allFiles;
  }

  /**
   * Import a complete template from GitHub
   */
  async importTemplate(
    owner: string,
    repo: string,
    options: GitHubImportOptions = {}
  ): Promise<TemplateFiles> {
    const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options };
    
    // Get repository info for default branch
    const repoInfo = await this.getRepository(owner, repo);
    const branch = opts.branch || repoInfo.defaultBranch;
    const basePath = opts.path || "";
    
    // Get all files
    const githubFiles = await this.getAllFiles(owner, repo, basePath, branch, opts);
    
    // Download and process files
    const templateFiles: TemplateFile[] = [];
    let totalSize = 0;
    
    for (const file of githubFiles) {
      // Check total size limit
      if (totalSize + file.size > (opts.maxTotalSize || DEFAULT_IMPORT_OPTIONS.maxTotalSize!)) {
        console.warn(`Reached total size limit, stopping import`);
        break;
      }
      
      const relativePath = basePath 
        ? file.path.replace(basePath + "/", "")
        : file.path;
      
      const templateFile: TemplateFile = {
        path: relativePath,
        name: file.name,
        type: getFileType(file.name),
        size: file.size,
      };
      
      // Download text files
      if (isTextFile(file.name)) {
        try {
          templateFile.content = await this.getFileContent(owner, repo, file.path, branch);
        } catch (error) {
          console.warn(`Failed to download ${file.path}:`, error);
          continue;
        }
      } else if (opts.includeImages && templateFile.type === "image") {
        // Store download URL for images
        templateFile.binaryUrl = file.downloadUrl || undefined;
      } else {
        // Skip other binary files
        continue;
      }
      
      templateFiles.push(templateFile);
      totalSize += file.size;
    }
    
    // Determine main file — match by path first, then by name
    let mainFile = opts.mainFile || "main.tex";

    // Check if specified main file exists (match by path or name)
    const mainFileMatch = templateFiles.find(f => f.path === mainFile || f.name === mainFile);
    if (mainFileMatch) {
      mainFile = mainFileMatch.path;
    } else {
      const texFiles = templateFiles.filter(f => f.type === "tex");

      // Priority: main.tex > paper.tex > template.tex > first .tex file
      const mainCandidates = ["main.tex", "paper.tex", "template.tex"];

      let found = false;
      for (const candidate of mainCandidates) {
        const match = texFiles.find(f => f.name === candidate);
        if (match) {
          mainFile = match.path;
          found = true;
          break;
        }
      }

      // Fall back to first tex file
      if (!found && texFiles.length > 0) {
        mainFile = texFiles[0].path;
      }
    }

    return {
      mainFile,
      files: templateFiles,
    };
  }

  /**
   * Parse a GitHub URL and extract owner/repo
   */
  static parseGitHubUrl(url: string): { owner: string; repo: string; path?: string } | null {
    // Handle various GitHub URL formats
    const patterns = [
      // https://github.com/owner/repo
      /github\.com\/([^\/]+)\/([^\/\?#]+)(?:\/tree\/[^\/]+\/(.+))?/,
      // git@github.com:owner/repo.git
      /git@github\.com:([^\/]+)\/([^\.]+)(?:\.git)?/,
      // owner/repo
      /^([^\/]+)\/([^\/\?#]+)$/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ""),
          path: match[3],
        };
      }
    }
    
    return null;
  }

  /**
   * Validate a GitHub URL
   */
  static isValidGitHubUrl(url: string): boolean {
    return GitHubService.parseGitHubUrl(url) !== null;
  }
}

// Export singleton instance
export const githubService = new GitHubService();
