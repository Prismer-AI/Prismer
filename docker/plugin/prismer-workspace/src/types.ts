/**
 * Prismer Workspace Skill - Type Definitions
 *
 * @description
 * Type definitions for the Prismer Workspace Skill Plugin.
 * Provides tools for academic research operations.
 */

// ============================================================
// Tool Parameter Types
// ============================================================

/**
 * LaTeX compile tool parameters
 */
export interface LatexCompileParams {
  /** LaTeX source content */
  content: string;
  /** Output filename (without extension) */
  filename?: string;
  /** Compile engine: pdflatex, xelatex, lualatex */
  engine?: 'pdflatex' | 'xelatex' | 'lualatex';
}

/**
 * LaTeX compile result
 */
export interface LatexCompileResult {
  success: boolean;
  pdfUrl?: string;
  pdfDataUrl?: string;
  log?: string;
  error?: string;
}

/**
 * Jupyter execute cell parameters
 */
export interface JupyterExecuteCellParams {
  /** Code to execute */
  code: string;
  /** Kernel name (default: python3) */
  kernel?: string;
}

/**
 * Jupyter execute result
 */
export interface JupyterExecuteResult {
  success: boolean;
  outputs?: JupyterOutput[];
  error?: string;
}

/**
 * Jupyter output types
 */
export interface JupyterOutput {
  type: 'stream' | 'execute_result' | 'display_data' | 'error';
  content: unknown;
}

/**
 * Jupyter notebook operations
 */
export interface JupyterNotebookParams {
  /** Notebook path */
  path: string;
  /** Operation type */
  operation: 'create' | 'read' | 'update' | 'delete' | 'list';
  /** Content for create/update */
  content?: unknown;
}

/**
 * PDF load parameters
 */
export interface PdfLoadParams {
  /** PDF file path or URL */
  source: string;
  /** Page to navigate to */
  page?: number;
}

/**
 * Component switch parameters
 */
export interface SwitchComponentParams {
  /** Target component */
  component:
    | 'pdf-reader'
    | 'latex-editor'
    | 'jupyter-notebook'
    | 'code-playground'
    | 'ai-editor'
    | 'ag-grid'
    | 'bento-gallery'
    | 'three-viewer';
  /** Initial data for the component */
  data?: Record<string, unknown>;
}

/**
 * UI directive parameters
 */
export interface UIDirectiveParams {
  /** Directive type */
  type: string;
  /** Directive payload */
  payload: Record<string, unknown>;
}

/**
 * arXiv paper conversion parameters
 */
export interface ArxivToPromptParams {
  /** arXiv paper ID (e.g., "2303.08774") */
  arxiv_id: string;
  /** Remove LaTeX comments (default: true) */
  remove_comments?: boolean;
  /** Remove appendix sections (default: false) */
  remove_appendix?: boolean;
  /** Extract abstract only */
  abstract_only?: boolean;
  /** Extract a specific section by name */
  section?: string;
  /** List all sections instead of converting */
  list_sections?: boolean;
  /** Only include figure paths (not figure content) */
  figure_paths?: boolean;
}

/**
 * arXiv paper conversion result
 */
export interface ArxivToPromptResult {
  /** Flattened LaTeX content or abstract */
  content?: string;
  /** Paper abstract (when abstract_only) */
  abstract?: string;
  /** List of section names (when list_sections) */
  sections?: string[];
  /** arXiv paper ID */
  arxiv_id: string;
  /** Whether result was served from cache */
  cached?: boolean;
}

/**
 * Update notes editor parameters
 */
export interface UpdateNotesParams {
  /** HTML content to set in the editor */
  content: string;
}

/**
 * Update LaTeX editor parameters
 */
export interface UpdateLatexParams {
  /** Filename (default: main.tex) */
  file?: string;
  /** LaTeX source code */
  content: string;
}

/**
 * LaTeX project file CRUD parameters
 */
export interface LatexProjectParams {
  /** Operation type */
  operation: 'list' | 'read' | 'write' | 'delete';
  /** File path relative to project root (e.g., "main.tex", "chapters/intro.tex") */
  path?: string;
  /** File content (required for write operation) */
  content?: string;
}

/**
 * LaTeX project compile parameters
 */
export interface LatexProjectCompileParams {
  /** Main .tex file to compile (default: "main.tex") */
  mainFile?: string;
  /** LaTeX engine (default: "pdflatex") */
  engine?: 'pdflatex' | 'xelatex' | 'lualatex';
  /** Run bibtex/biber between passes (default: false) */
  runBibtex?: boolean;
}

/**
 * LaTeX project file info
 */
export interface LatexProjectFile {
  path: string;
  type: 'tex' | 'bib' | 'sty' | 'cls' | 'other';
  size: number;
}

/**
 * LaTeX project compile result
 */
export interface LatexProjectCompileResult {
  success: boolean;
  pdfBase64?: string;
  log?: string;
  errors?: string[];
  warnings?: string[];
}

/**
 * Update Jupyter notebook parameters
 */
export interface UpdateNotebookParams {
  /** Array of cells to add/update */
  cells: Array<{ type: string; source: string }>;
  /** Whether to execute code cells (default: false) */
  execute?: boolean;
}

/**
 * Save artifact to workspace collection parameters
 */
export interface SaveArtifactParams {
  /** Display title for the artifact */
  title: string;
  /** Artifact type */
  type: 'image' | 'pdf' | 'data' | 'notebook';
  /** Base64-encoded content or URL */
  content: string;
  /** MIME type (e.g., image/png, application/pdf) */
  mimeType?: string;
}

/**
 * Update gallery with images
 */
export interface UpdateGalleryParams {
  /** Array of images to add to gallery */
  images: Array<{
    title: string;
    description?: string;
    url: string;
  }>;
}

/**
 * Execute code in container parameters
 */
export interface CodeExecuteParams {
  /** Code to execute */
  code: string;
  /** Language: python or node */
  language: 'python' | 'node';
}

/**
 * Code execution result
 */
export interface CodeExecuteResult {
  /** Execution output */
  output: string;
}

/**
 * Update code playground parameters
 */
export interface UpdateCodeParams {
  /** Array of files to display in the code editor */
  files: Array<{
    /** Filename (e.g., "main.py", "index.js") */
    name: string;
    /** File content */
    content: string;
    /** Language for syntax highlighting (auto-detected from extension if omitted) */
    language?: string;
  }>;
  /** Which file to show initially (defaults to first file) */
  selectedFile?: string;
}

/**
 * Update data grid parameters
 */
export interface UpdateDataGridParams {
  /** Array of row data objects */
  data: Array<Record<string, unknown>>;
  /** Column definitions (auto-generated from data keys if omitted) */
  columns?: Array<{
    /** Column field name (must match a key in data objects) */
    field: string;
    /** Display header name */
    headerName?: string;
    /** Column width in pixels */
    width?: number;
    /** Whether this column is sortable (default: true) */
    sortable?: boolean;
    /** Whether this column is filterable (default: true) */
    filter?: boolean;
  }>;
  /** Display title for the data grid */
  title?: string;
}

// ============================================================
// Data Tool Types
// ============================================================

/** Supported data file formats */
export type DataFileFormat = 'csv' | 'xlsx' | 'json' | 'parquet' | 'tsv';

/** Column dtype info from pandas */
export interface DataColumnInfo {
  name: string;
  dtype: string;
  nonNullCount: number;
  nullCount: number;
}

/** Metadata about a loaded dataset */
export interface DatasetMeta {
  filename: string;
  format: DataFileFormat;
  rows: number;
  columns: number;
  columnInfo: DataColumnInfo[];
  sizeBytes: number;
  preview: string;
}

/** data_load tool parameters */
export interface DataLoadParams {
  /** File path relative to /workspace/data/ */
  filename: string;
  /** Sheet name for XLSX files (default: first sheet) */
  sheet?: string;
  /** Maximum rows to send to frontend (default: 5000) */
  maxRows?: number;
  /** CSV delimiter (default: auto-detect) */
  delimiter?: string;
  /** CSV encoding (default: utf-8) */
  encoding?: string;
}

/** data_load tool result */
export interface DataLoadResult {
  meta: DatasetMeta;
  truncated: boolean;
  totalRows: number;
}

/** data_query tool parameters */
export interface DataQueryParams {
  /** Python pandas code to execute. Variable `df` is pre-loaded. */
  code: string;
  /** If true, send resulting DataFrame to AG Grid (default: true) */
  updateGrid?: boolean;
  /** Maximum rows to send to frontend (default: 5000) */
  maxRows?: number;
}

/** data_query tool result */
export interface DataQueryResult {
  preview: string;
  resultType: 'dataframe' | 'scalar' | 'error';
  shape?: [number, number];
  value?: string;
  gridUpdated: boolean;
}

/** data_save tool parameters */
export interface DataSaveParams {
  /** Output filename relative to /workspace/data/ */
  filename: string;
  /** Output format (inferred from extension if omitted) */
  format?: DataFileFormat;
  /** Whether to include DataFrame index (default: false) */
  includeIndex?: boolean;
}

/** data_save tool result */
export interface DataSaveResult {
  filename: string;
  format: DataFileFormat;
  sizeBytes: number;
  rows: number;
}

/** data_list tool parameters */
export interface DataListParams {
  /** Glob pattern to filter files (default: *) */
  pattern?: string;
}

/** data_list file entry */
export interface DataFileEntry {
  filename: string;
  format: DataFileFormat | 'unknown';
  sizeBytes: number;
  lastModified: number;
}

/** data_list tool result */
export interface DataListResult {
  files: DataFileEntry[];
  directory: string;
}

// ============================================================
// Paper Context Tool Types
// ============================================================

/**
 * get_paper_context tool parameters
 */
export interface GetPaperContextParams {
  /** arXiv ID or upload sourceId (e.g., "2512.25072v1", "upload_abc123") */
  source: string;
  /** Which data to include (default: ["metadata", "summary"]) */
  include?: Array<'metadata' | 'summary' | 'full_markdown' | 'detections'>;
  /** Limit to specific pages (for detections) */
  pages?: number[];
}

/**
 * get_paper_context tool result
 */
export interface GetPaperContextResult {
  /** OCR data availability level */
  ocrLevel: 'L3_hires' | 'L2_fast' | 'L1_raw';
  /** Paper metadata (title, authors, abstract, etc.) */
  metadata?: Record<string, unknown> | null;
  /** Markdown content (full or summary) */
  markdown?: string;
  /** Page detections (bounding boxes, labels, text) */
  detections?: unknown[];
  /** Total pages */
  totalPages?: number;
}

/**
 * navigate_pdf tool parameters
 */
export interface NavigatePdfParams {
  /** Page number to navigate to */
  page: number;
  /** Optional detection ID to highlight */
  detectionId?: string;
  /** Optional highlight region */
  highlightRegion?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

// ============================================================
// Cloud SDK Context API Tool Types
// ============================================================

/**
 * context_search tool parameters
 */
export interface ContextSearchParams {
  /** Search query (natural language) */
  query: string;
  /** Number of results to search through (default: 10) */
  topK?: number;
  /** Number of results to return (default: 5) */
  returnTopK?: number;
  /** Content format: hqcc (compressed), raw, or both */
  format?: 'hqcc' | 'raw' | 'both';
}

/**
 * context_search tool result
 */
export interface ContextSearchResult {
  results: Array<{
    url: string;
    title: string;
    content: string;
    cached: boolean;
    relevanceScore?: number;
  }>;
  totalResults: number;
}

/**
 * context_load tool parameters
 */
export interface ContextLoadParams {
  /** URL or array of URLs to load */
  source: string | string[];
  /** Content format: hqcc (compressed) or raw */
  format?: 'hqcc' | 'raw';
}

/**
 * context_load tool result
 */
export interface ContextLoadResult {
  items: Array<{
    url: string;
    title: string;
    content: string;
    cached: boolean;
  }>;
}

// ============================================================
// Workspace Context Types
// ============================================================

/**
 * get_workspace_state tool parameters
 */
export interface GetWorkspaceStateParams {
  /** Sections to include (default: all) */
  include?: Array<'files' | 'editors' | 'tasks' | 'messages' | 'timeline'>;
}

/**
 * get_workspace_state tool result
 */
export interface WorkspaceStateResult {
  workspace: {
    id: string;
    name: string;
    description?: string;
    status: string;
    template: string;
  };
  agent?: {
    id: string;
    name: string;
    status: string;
    model?: string;
  } | null;
  activeComponent?: string | null;
  files?: Array<{
    path: string;
    hash: string;
    updatedAt: string;
  }>;
  editors?: Record<string, unknown>;
  tasks?: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    progress: number;
  }>;
  recentMessages?: Array<{
    role: string;
    name: string;
    summary: string;
    contentType: string;
    at: string;
  }>;
  timeline?: Array<{
    component: string;
    action: string;
    description: string;
    actor?: string;
    timestamp: number;
  }>;
}

/**
 * sync_files_to_workspace tool parameters
 */
export interface SyncFilesToWorkspaceParams {
  /** Files to sync to workspace frontend */
  files: Array<{
    /** Relative file path (e.g., "main.tex", "chapters/intro.tex") */
    path: string;
    /** File content */
    content: string;
  }>;
  /** Target component to notify (e.g., "latex-editor") */
  targetComponent?: string;
}

// ============================================================
// Skill Configuration
// ============================================================

/**
 * Skill configuration
 */
export interface PrismerWorkspaceConfig {
  /** Next.js API base URL */
  apiBaseUrl: string;
  /** Agent instance ID */
  agentId: string;
  /** Workspace session ID (for context sync) */
  workspaceId?: string;
  /** Enabled tools (all enabled if not specified) */
  enabledTools?: string[];
  /** Prismer API key for Cloud SDK (open-source: from openclaw.json, production: from env) */
  prismerApiKey?: string;
}

/**
 * Resolved skill configuration
 */
export interface ResolvedPrismerWorkspaceConfig extends PrismerWorkspaceConfig {
  /** Full API URL for container proxy */
  containerProxyUrl: string;
  /** Whether local LaTeX is available */
  hasLocalLatex: boolean;
  /** Whether Jupyter is available */
  hasJupyter: boolean;
}

// ============================================================
// Tool Result Types
// ============================================================

/**
 * Generic tool result
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * UI action result
 */
export interface UIActionResult {
  success: boolean;
  directiveId?: string;
  error?: string;
}
