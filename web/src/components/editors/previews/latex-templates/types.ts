// ============================================================
// LaTeX Template System - Type Definitions
// ============================================================

/**
 * Template category types
 */
export type TemplateCategory =
  | "conference"      // 会议论文
  | "journal"         // 期刊论文
  | "thesis"          // 学位论文
  | "cv"              // 简历
  | "presentation"    // 演示文稿 (Beamer)
  | "report"          // 报告
  | "book"            // 书籍
  | "letter"          // 信件
  | "poster"          // 海报
  | "other";          // 其他

/**
 * Template source type
 */
export type TemplateSourceType = "builtin" | "github" | "overleaf" | "url" | "local";

/**
 * GitHub source configuration
 */
export interface GitHubSource {
  owner: string;
  repo: string;
  branch?: string;           // 默认 main
  path?: string;             // 仓库内路径，默认根目录
  mainFile?: string;         // 主文件，默认 main.tex
}

/**
 * Overleaf source configuration
 */
export interface OverleafSource {
  templateId: string;        // 如 'rdtrwgypxxzb'
  templateSlug: string;      // 如 'cvpr-2026-submission-template'
  webUrl: string;            // 完整 URL
}

/**
 * Template source information
 */
export interface TemplateSource {
  type: TemplateSourceType;
  github?: GitHubSource;
  overleaf?: OverleafSource;
  url?: string;              // ZIP 文件 URL
}

/**
 * Template metadata
 */
export interface TemplateMetadata {
  id: string;                    // 唯一标识符
  name: string;                  // 模板名称
  description: string;           // 模板描述
  category: TemplateCategory;    // 分类
  tags: string[];                // 标签
  thumbnail?: string;            // 缩略图 URL
  
  // 来源信息
  source: TemplateSource;
  
  // 版本信息
  version?: string;
  lastUpdated?: string;
  
  // 元信息
  author?: string;
  license?: string;
  documentClass?: string;        // article, report, book, beamer 等
  
  // 统计
  downloads?: number;
  stars?: number;
}

/**
 * Template file type
 */
export type TemplateFileType = "tex" | "bib" | "sty" | "cls" | "bst" | "image" | "other";

/**
 * Single template file
 */
export interface TemplateFile {
  path: string;                 // 相对路径
  name: string;                 // 文件名
  type: TemplateFileType;
  content?: string;             // 文本内容（仅文本文件）
  binaryUrl?: string;           // 二进制文件 URL（图片等）
  size?: number;                // 文件大小
}

/**
 * Template files collection
 */
export interface TemplateFiles {
  mainFile: string;             // 主 .tex 文件名
  files: TemplateFile[];        // 所有文件
}

/**
 * Category information for display
 */
export interface CategoryInfo {
  id: TemplateCategory;
  name: string;
  nameZh: string;               // 中文名
  icon: string;
  description: string;
  count?: number;
}

/**
 * Template catalog (root structure)
 */
export interface TemplateCatalog {
  version: string;
  lastUpdated: string;
  categories: CategoryInfo[];
  templates: TemplateMetadata[];
}

/**
 * Template search/filter options
 */
export interface TemplateFilters {
  category?: TemplateCategory;
  tags?: string[];
  source?: TemplateSourceType;
  documentClass?: string;
  query?: string;
}

// ============================================================
// GitHub API Types
// ============================================================

/**
 * GitHub repository information
 */
export interface GitHubRepo {
  name: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  defaultBranch: string;
  topics: string[];
  htmlUrl: string;
  owner: {
    login: string;
    avatarUrl: string;
  };
}

/**
 * GitHub repository content item
 */
export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir";
  downloadUrl: string | null;
  htmlUrl: string;
}

/**
 * GitHub API search result
 */
export interface GitHubSearchResult {
  totalCount: number;
  incompleteResults: boolean;
  items: GitHubRepo[];
}

/**
 * GitHub import options
 */
export interface GitHubImportOptions {
  branch?: string;
  path?: string;
  mainFile?: string;
  includeImages?: boolean;
  maxFileSize?: number;         // 单文件最大大小 (bytes)
  maxTotalSize?: number;        // 总最大大小 (bytes)
}

// ============================================================
// Service Response Types
// ============================================================

/**
 * Generic service response
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Template download progress
 */
export interface DownloadProgress {
  total: number;
  loaded: number;
  percentage: number;
  currentFile?: string;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  files: TemplateFiles;
  warnings?: string[];
  skippedFiles?: string[];
}

// ============================================================
// Constants
// ============================================================

/**
 * Category definitions with metadata
 */
export const CATEGORIES: CategoryInfo[] = [
  {
    id: "conference",
    name: "Conference Papers",
    nameZh: "会议论文",
    icon: "🎯",
    description: "Templates for academic conference submissions",
  },
  {
    id: "journal",
    name: "Journal Articles",
    nameZh: "期刊论文",
    icon: "📰",
    description: "Templates for journal paper submissions",
  },
  {
    id: "thesis",
    name: "Thesis & Dissertation",
    nameZh: "学位论文",
    icon: "🎓",
    description: "Templates for bachelor, master, and PhD theses",
  },
  {
    id: "cv",
    name: "CV & Resume",
    nameZh: "简历",
    icon: "📋",
    description: "Professional CV and resume templates",
  },
  {
    id: "presentation",
    name: "Presentations",
    nameZh: "演示文稿",
    icon: "📊",
    description: "Beamer and other presentation templates",
  },
  {
    id: "report",
    name: "Reports",
    nameZh: "报告",
    icon: "📝",
    description: "Technical reports and project documentation",
  },
  {
    id: "book",
    name: "Books",
    nameZh: "书籍",
    icon: "📚",
    description: "Book and textbook templates",
  },
  {
    id: "letter",
    name: "Letters",
    nameZh: "信件",
    icon: "✉️",
    description: "Formal and cover letter templates",
  },
  {
    id: "poster",
    name: "Posters",
    nameZh: "海报",
    icon: "🖼️",
    description: "Academic poster templates",
  },
  {
    id: "other",
    name: "Other",
    nameZh: "其他",
    icon: "📄",
    description: "Miscellaneous LaTeX templates",
  },
];

/**
 * Supported text file extensions
 */
export const TEXT_FILE_EXTENSIONS = [
  ".tex", ".bib", ".sty", ".cls", ".bst", 
  ".txt", ".md", ".json", ".yaml", ".yml",
  ".cfg", ".def", ".dtx", ".ins", ".ltx"
];

/**
 * Supported image file extensions
 */
export const IMAGE_FILE_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", 
  ".pdf", ".eps", ".ps"
];

/**
 * Files to ignore when importing
 */
export const IGNORED_FILES = [
  ".git", ".gitignore", ".github",
  "node_modules", "__pycache__",
  ".DS_Store", "Thumbs.db",
  "*.aux", "*.log", "*.out", "*.toc",
  "*.bbl", "*.blg", "*.fls", "*.fdb_latexmk",
  "*.synctex.gz"
];

/**
 * Default import options
 */
export const DEFAULT_IMPORT_OPTIONS: GitHubImportOptions = {
  branch: "main",
  path: "",
  mainFile: "main.tex",
  includeImages: true,
  maxFileSize: 5 * 1024 * 1024,      // 5MB per file
  maxTotalSize: 50 * 1024 * 1024,    // 50MB total
};

/**
 * Get file type from extension
 */
export function getFileType(filename: string): TemplateFileType {
  const ext = filename.toLowerCase().split(".").pop() || "";
  
  if (ext === "tex" || ext === "ltx") return "tex";
  if (ext === "bib") return "bib";
  if (ext === "sty") return "sty";
  if (ext === "cls") return "cls";
  if (ext === "bst") return "bst";
  if (IMAGE_FILE_EXTENSIONS.some(e => e.slice(1) === ext)) return "image";
  
  return "other";
}

/**
 * Check if file is a text file
 */
export function isTextFile(filename: string): boolean {
  const ext = "." + (filename.toLowerCase().split(".").pop() || "");
  return TEXT_FILE_EXTENSIONS.includes(ext);
}

/**
 * Check if file should be ignored
 */
export function shouldIgnoreFile(filename: string): boolean {
  const name = filename.split("/").pop() || filename;
  
  return IGNORED_FILES.some(pattern => {
    if (pattern.startsWith("*.")) {
      return name.endsWith(pattern.slice(1));
    }
    return name === pattern || filename.includes(`/${pattern}/`);
  });
}
