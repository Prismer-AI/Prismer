/**
 * Prismer Workspace Skill - Tool Implementations
 *
 * @description
 * Tool implementations for academic research operations.
 * These tools are exposed to the LLM agent for workspace control.
 */

import type {
  ResolvedPrismerWorkspaceConfig,
  LatexCompileParams,
  LatexCompileResult,
  JupyterExecuteCellParams,
  JupyterExecuteResult,
  JupyterNotebookParams,
  PdfLoadParams,
  SwitchComponentParams,
  UIDirectiveParams,
  ArxivToPromptParams,
  ArxivToPromptResult,
  UpdateNotesParams,
  UpdateLatexParams,
  UpdateNotebookParams,
  SaveArtifactParams,
  UpdateGalleryParams,
  UpdateCodeParams,
  UpdateDataGridParams,
  CodeExecuteParams,
  CodeExecuteResult,
  LatexProjectParams,
  LatexProjectCompileParams,
  LatexProjectCompileResult,
  LatexProjectFile,
  DataLoadParams,
  DataLoadResult,
  DataQueryParams,
  DataQueryResult,
  DataSaveParams,
  DataSaveResult,
  DataListParams,
  DataListResult,
  DataFileEntry,
  DataFileFormat,
  GetPaperContextParams,
  GetPaperContextResult,
  NavigatePdfParams,
  ContextSearchParams,
  ContextSearchResult,
  ContextLoadParams,
  ContextLoadResult,
  GetWorkspaceStateParams,
  WorkspaceStateResult,
  SyncFilesToWorkspaceParams,
  ToolResult,
  UIActionResult,
} from './types';

import { execSync } from 'child_process';
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  statSync,
  existsSync,
} from 'fs';
import path from 'path';

// ============================================================
// API Client
// ============================================================

let _config: ResolvedPrismerWorkspaceConfig | null = null;

/**
 * Set the skill configuration
 */
export function setConfig(config: ResolvedPrismerWorkspaceConfig): void {
  _config = config;
}

/**
 * Get the skill configuration
 */
export function getConfig(): ResolvedPrismerWorkspaceConfig {
  if (!_config) {
    throw new Error('[prismer-workspace] Config not initialized. Call setConfig first.');
  }
  return _config;
}

/**
 * Make API request to container proxy
 */
async function apiRequest<T>(
  service: 'latex' | 'jupyter' | 'gateway' | 'arxiv',
  path: string,
  options: {
    method?: string;
    body?: unknown;
    timeout?: number;
  } = {}
): Promise<T> {
  const config = getConfig();
  const url = `${config.containerProxyUrl}/${service}/${path}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API request failed: ${response.status}`);
  }

  return response.json();
}

// ============================================================
// LaTeX Tools
// ============================================================

/**
 * Compile LaTeX to PDF
 *
 * Side effects: auto-switches UI to latex-editor and sends compile result directive.
 * Agent does NOT need to call switch_component separately.
 */
export async function latexCompile(
  params: LatexCompileParams
): Promise<ToolResult<LatexCompileResult>> {
  try {
    // Auto-switch to latex-editor BEFORE compile (so user sees the editor while waiting)
    await sendUIDirective({
      type: 'SWITCH_COMPONENT',
      payload: { component: 'latex-editor', data: { content: params.content } },
    }).catch(() => {}); // non-fatal

    // Container LaTeX service returns snake_case fields:
    // { success, pdf_path, log, errors, warnings, compile_id }
    const raw = await apiRequest<{
      success: boolean;
      pdf_path?: string;
      log?: string;
      errors?: string[];
      warnings?: string[];
      compile_id?: string;
    }>('latex', 'compile', {
      method: 'POST',
      body: {
        content: params.content,
        filename: params.filename || 'document',
        engine: params.engine || 'pdflatex',
      },
    });

    // Build normalized result
    const pdfPath = raw.pdf_path;
    let pdfDataUrl: string | undefined;

    // Read PDF from disk and convert to base64 for direct frontend rendering
    if (raw.success && pdfPath && existsSync(pdfPath)) {
      const pdfBuffer = readFileSync(pdfPath);
      pdfDataUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
    }

    const result: LatexCompileResult = {
      success: raw.success,
      pdfUrl: pdfPath,
      pdfDataUrl,
      log: raw.log,
    };

    // Send compile result directive so UI updates with PDF preview
    if (result.success && pdfPath) {
      await sendUIDirective({
        type: 'LATEX_COMPILE_COMPLETE',
        payload: {
          pdfUrl: pdfPath,
          pdfDataUrl,
          filename: params.filename || 'document',
        },
      }).catch(() => {});
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// Jupyter Tools
// ============================================================

/**
 * Execute code in Jupyter kernel
 *
 * Side effects: auto-switches UI to jupyter-notebook and sends execution result directive.
 * Agent does NOT need to call switch_component separately.
 */
export async function jupyterExecute(
  params: JupyterExecuteCellParams
): Promise<ToolResult<JupyterExecuteResult>> {
  try {
    // Auto-switch to jupyter-notebook before execution
    await sendUIDirective({
      type: 'SWITCH_COMPONENT',
      payload: { component: 'jupyter-notebook' },
    }).catch(() => {});

    const result = await apiRequest<JupyterExecuteResult>('jupyter', 'api/execute', {
      method: 'POST',
      body: {
        code: params.code,
        kernel: params.kernel || 'python3',
      },
    });

    // Send cell result directive so UI appends output
    await sendUIDirective({
      type: 'JUPYTER_CELL_RESULT',
      payload: { code: params.code, outputs: result.outputs, success: result.success },
    }).catch(() => {});

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Manage Jupyter notebooks
 */
export async function jupyterNotebook(
  params: JupyterNotebookParams
): Promise<ToolResult<unknown>> {
  try {
    const { path, operation, content } = params;

    let result: unknown;

    switch (operation) {
      case 'list':
        result = await apiRequest('jupyter', `api/contents/${path}?content=0`);
        break;

      case 'read':
        result = await apiRequest('jupyter', `api/contents/${path}`);
        break;

      case 'create':
      case 'update':
        result = await apiRequest('jupyter', `api/contents/${path}`, {
          method: 'PUT',
          body: content,
        });
        break;

      case 'delete':
        result = await apiRequest('jupyter', `api/contents/${path}`, {
          method: 'DELETE',
        });
        break;
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// arXiv Tools
// ============================================================

/**
 * Convert an arXiv paper to flattened LaTeX optimized for LLM reading
 */
export async function arxivToPrompt(
  params: ArxivToPromptParams
): Promise<ToolResult<ArxivToPromptResult>> {
  try {
    if (params.list_sections) {
      const result = await apiRequest<ArxivToPromptResult>('arxiv', 'sections', {
        method: 'POST',
        body: { arxiv_id: params.arxiv_id },
      });
      return { success: true, data: result };
    }

    if (params.abstract_only) {
      const result = await apiRequest<ArxivToPromptResult>('arxiv', 'abstract', {
        method: 'POST',
        body: { arxiv_id: params.arxiv_id },
      });
      return { success: true, data: result };
    }

    const result = await apiRequest<ArxivToPromptResult>('arxiv', 'convert', {
      method: 'POST',
      body: {
        arxiv_id: params.arxiv_id,
        remove_comments: params.remove_comments ?? true,
        remove_appendix: params.remove_appendix ?? false,
        figure_paths: params.figure_paths,
      },
    });
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// UI Control Tools
// ============================================================

/**
 * Load a PDF document
 *
 * Side effects: auto-switches to pdf-reader and loads the document.
 * Agent does NOT need to call switch_component separately.
 */
export async function loadPdf(
  params: PdfLoadParams
): Promise<ToolResult<UIActionResult>> {
  // Auto-switch to pdf-reader
  await sendUIDirective({
    type: 'SWITCH_COMPONENT',
    payload: { component: 'pdf-reader' },
  }).catch(() => {});

  return sendUIDirective({
    type: 'PDF_LOAD_DOCUMENT',
    payload: {
      source: params.source,
      page: params.page || 1,
    },
  });
}

/**
 * Get structured paper context from OCR API.
 * Fetches metadata, markdown, and/or detections for a paper
 * without needing to open it in the reader.
 */
export async function getPaperContext(
  params: GetPaperContextParams
): Promise<ToolResult<GetPaperContextResult>> {
  try {
    const config = getConfig();
    const source = params.source;
    const include = params.include || ['metadata', 'summary'];
    const basePath = `${config.apiBaseUrl}/api/ocr/${source}`;

    // Determine what to fetch
    const fetchMetadata = include.includes('metadata') || include.includes('summary');
    const fetchMarkdown = include.includes('summary') || include.includes('full_markdown');
    const fetchDetections = include.includes('detections');

    // Parallel fetch of requested data
    const fetches: Array<Promise<Response>> = [];
    const fetchKeys: string[] = [];

    if (fetchMetadata) {
      fetches.push(fetch(`${basePath}/metadata.json`).catch(() => new Response(null, { status: 404 })));
      fetchKeys.push('metadata');
    }
    if (fetchMarkdown) {
      // Try ocr_result.json first (has structured markdown), fallback to paper.md
      fetches.push(fetch(`${basePath}/paper.md`).catch(() => new Response(null, { status: 404 })));
      fetchKeys.push('markdown');
    }
    if (fetchDetections) {
      fetches.push(fetch(`${basePath}/detections.json`).catch(() => new Response(null, { status: 404 })));
      fetchKeys.push('detections');
    }

    const responses = await Promise.all(fetches);

    let metadata: Record<string, unknown> | null = null;
    let markdown: string | undefined;
    let detections: unknown[] | undefined;
    let ocrLevel: 'L3_hires' | 'L2_fast' | 'L1_raw' = 'L1_raw';

    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      const key = fetchKeys[i];

      if (!res.ok) continue;

      if (key === 'metadata') {
        metadata = await res.json().catch(() => null);
      } else if (key === 'markdown') {
        const text = await res.text().catch(() => '');
        if (text) {
          markdown = include.includes('summary') && !include.includes('full_markdown')
            ? text.substring(0, 4000) + (text.length > 4000 ? '\n\n[... truncated, use full_markdown for complete content]' : '')
            : text;
        }
      } else if (key === 'detections') {
        const raw = await res.json().catch(() => []);
        if (Array.isArray(raw) && raw.length > 0) {
          ocrLevel = 'L3_hires';
          // Filter by pages if specified
          if (params.pages && params.pages.length > 0) {
            detections = raw.filter((d: { page_number?: number }) =>
              params.pages!.includes(d.page_number ?? 0)
            );
          } else {
            detections = raw;
          }
        }
      }
    }

    // Determine OCR level
    if (ocrLevel !== 'L3_hires') {
      ocrLevel = markdown ? 'L2_fast' : 'L1_raw';
    }

    const result: GetPaperContextResult = {
      ocrLevel,
      metadata: metadata || undefined,
      markdown,
      detections,
      totalPages: (metadata as { total_pages?: number })?.total_pages,
    };

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Navigate the PDF reader to a specific page and optionally highlight a region.
 * Sends a PDF_NAVIGATE directive to the frontend.
 */
export async function navigatePdf(
  params: NavigatePdfParams
): Promise<ToolResult<UIActionResult>> {
  return sendUIDirective({
    type: 'PDF_NAVIGATE',
    payload: {
      page: params.page,
      detectionId: params.detectionId,
      highlightRegion: params.highlightRegion,
    },
  });
}

/**
 * Switch the active workspace component
 */
export async function switchComponent(
  params: SwitchComponentParams
): Promise<ToolResult<UIActionResult>> {
  return sendUIDirective({
    type: 'SWITCH_COMPONENT',
    payload: {
      component: params.component,
      data: params.data,
    },
  });
}

/**
 * Send a UI directive to the workspace
 */
export async function sendUIDirective(
  params: UIDirectiveParams
): Promise<ToolResult<UIActionResult>> {
  try {
    const config = getConfig();

    // Send via IM channel plugin
    const result = await fetch(`${config.apiBaseUrl}/api/agents/${config.agentId}/directive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: params.type,
        payload: params.payload,
        timestamp: Date.now(),
      }),
    });

    if (!result.ok) {
      const error = await result.json().catch(() => ({ error: result.statusText }));
      throw new Error(error.error || 'Failed to send directive');
    }

    const data = await result.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// Content Update Tools
// ============================================================

/**
 * Update the Notes editor with HTML content.
 * Auto-switches to ai-editor before sending content.
 */
export async function updateNotes(
  params: UpdateNotesParams
): Promise<ToolResult<UIActionResult>> {
  await sendUIDirective({
    type: 'SWITCH_COMPONENT',
    payload: { component: 'ai-editor' },
  }).catch(() => {});

  return sendUIDirective({
    type: 'UPDATE_NOTES',
    payload: { content: params.content },
  });
}

/**
 * Update the LaTeX editor with source code (without compiling).
 * Auto-switches to latex-editor before sending content.
 */
export async function updateLatex(
  params: UpdateLatexParams
): Promise<ToolResult<UIActionResult>> {
  await sendUIDirective({
    type: 'SWITCH_COMPONENT',
    payload: { component: 'latex-editor' },
  }).catch(() => {});

  return sendUIDirective({
    type: 'UPDATE_LATEX',
    payload: { file: params.file || 'main.tex', content: params.content },
  });
}

// ============================================================
// LaTeX Project Tools
// ============================================================

const LATEX_PROJECT_DIR = '/workspace/latex';

/**
 * Infer file type from extension
 */
function inferLatexFileType(filePath: string): LatexProjectFile['type'] {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.tex': return 'tex';
    case '.bib': return 'bib';
    case '.sty': return 'sty';
    case '.cls': return 'cls';
    default: return 'other';
  }
}

/**
 * Recursively list all files in a directory
 */
function listDirRecursive(dir: string, basePath = ''): LatexProjectFile[] {
  const results: LatexProjectFile[] = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Skip output directory
      if (entry.name === 'output') continue;
      results.push(...listDirRecursive(path.join(dir, entry.name), relativePath));
    } else {
      const stat = statSync(path.join(dir, entry.name));
      results.push({
        path: relativePath,
        type: inferLatexFileType(entry.name),
        size: stat.size,
      });
    }
  }
  return results;
}

/**
 * Manage files in the LaTeX project directory (/workspace/latex/).
 * Supports list, read, write, and delete operations.
 */
export async function latexProject(
  params: LatexProjectParams
): Promise<ToolResult<LatexProjectFile[] | { path: string; content: string } | { deleted: boolean }>> {
  try {
    switch (params.operation) {
      case 'list': {
        const files = listDirRecursive(LATEX_PROJECT_DIR);
        return { success: true, data: files };
      }

      case 'read': {
        if (!params.path) {
          return { success: false, error: 'path is required for read operation' };
        }
        const fullPath = path.join(LATEX_PROJECT_DIR, params.path);
        if (!existsSync(fullPath)) {
          return { success: false, error: `File not found: ${params.path}` };
        }
        const content = readFileSync(fullPath, 'utf-8');
        return { success: true, data: { path: params.path, content } };
      }

      case 'write': {
        if (!params.path) {
          return { success: false, error: 'path is required for write operation' };
        }
        if (params.content === undefined) {
          return { success: false, error: 'content is required for write operation' };
        }
        const fullPath = path.join(LATEX_PROJECT_DIR, params.path);
        mkdirSync(path.dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, params.content, 'utf-8');

        // Auto-switch to latex-editor
        await sendUIDirective({
          type: 'SWITCH_COMPONENT',
          payload: { component: 'latex-editor' },
        }).catch(() => {});

        // Notify frontend of the file change with full project listing
        const projectFiles = listDirRecursive(LATEX_PROJECT_DIR);
        await sendUIDirective({
          type: 'UPDATE_LATEX_PROJECT',
          payload: {
            operation: 'write',
            file: params.path,
            content: params.content,
            projectFiles,
          },
        }).catch(() => {});

        return { success: true, data: { path: params.path, content: params.content } };
      }

      case 'delete': {
        if (!params.path) {
          return { success: false, error: 'path is required for delete operation' };
        }
        const fullPath = path.join(LATEX_PROJECT_DIR, params.path);
        if (!existsSync(fullPath)) {
          return { success: false, error: `File not found: ${params.path}` };
        }
        unlinkSync(fullPath);

        // Notify frontend
        const projectFiles = listDirRecursive(LATEX_PROJECT_DIR);
        await sendUIDirective({
          type: 'DELETE_LATEX_PROJECT_FILE',
          payload: { file: params.path, projectFiles },
        }).catch(() => {});

        return { success: true, data: { deleted: true } };
      }

      default:
        return { success: false, error: `Unknown operation: ${params.operation}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Compile the LaTeX project from /workspace/latex/ directory.
 * Runs pdflatex directly (bypasses :8080 service) to support multi-file projects.
 */
export async function latexProjectCompile(
  params: LatexProjectCompileParams
): Promise<ToolResult<LatexProjectCompileResult>> {
  try {
    const mainFile = params.mainFile || 'main.tex';
    const engine = params.engine || 'pdflatex';
    const mainPath = path.join(LATEX_PROJECT_DIR, mainFile);

    if (!existsSync(mainPath)) {
      return {
        success: false,
        error: `Main file not found: ${mainFile}. Use latex_project(operation: 'list') to see available files.`,
      };
    }

    // Ensure output directory exists
    const outputDir = path.join(LATEX_PROJECT_DIR, 'output');
    mkdirSync(outputDir, { recursive: true });

    // Auto-switch to latex-editor
    await sendUIDirective({
      type: 'SWITCH_COMPONENT',
      payload: { component: 'latex-editor' },
    }).catch(() => {});

    let log = '';
    const compileCmd = `${engine} -interaction=nonstopmode -output-directory=output "${mainFile}"`;

    // First pass
    try {
      const result = execSync(compileCmd, {
        cwd: LATEX_PROJECT_DIR,
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf-8',
      });
      log += result;
    } catch (e: unknown) {
      const execErr = e as { stdout?: string; stderr?: string };
      log += (execErr.stdout || '') + (execErr.stderr || '');
      // pdflatex returns non-zero on warnings, continue to check for PDF
    }

    // Optional bibtex pass
    if (params.runBibtex) {
      const bibName = mainFile.replace(/\.tex$/, '');
      try {
        const bibResult = execSync(`bibtex "output/${bibName}"`, {
          cwd: LATEX_PROJECT_DIR,
          timeout: 60_000,
          encoding: 'utf-8',
        });
        log += '\n--- bibtex ---\n' + bibResult;
      } catch (e: unknown) {
        const execErr = e as { stdout?: string; stderr?: string };
        log += '\n--- bibtex ---\n' + (execErr.stdout || '') + (execErr.stderr || '');
      }
    }

    // Second pass (resolve references)
    try {
      const result = execSync(compileCmd, {
        cwd: LATEX_PROJECT_DIR,
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf-8',
      });
      log += '\n--- pass 2 ---\n' + result;
    } catch (e: unknown) {
      const execErr = e as { stdout?: string; stderr?: string };
      log += '\n--- pass 2 ---\n' + (execErr.stdout || '') + (execErr.stderr || '');
    }

    // Check for output PDF
    const pdfName = mainFile.replace(/\.tex$/, '.pdf');
    const pdfPath = path.join(outputDir, pdfName);

    if (!existsSync(pdfPath)) {
      // Extract errors from log
      const errors = log.split('\n')
        .filter(line => line.startsWith('!') || line.includes('Error'))
        .slice(0, 10);

      return {
        success: true,
        data: {
          success: false,
          log: log.slice(-3000),
          errors: errors.length > 0 ? errors : ['Compilation failed: PDF not generated'],
        },
      };
    }

    // Read PDF and convert to base64
    const pdfBuffer = readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Extract warnings
    const warnings = log.split('\n')
      .filter(line => line.includes('Warning'))
      .slice(0, 10);

    // Send compile complete directive
    await sendUIDirective({
      type: 'LATEX_PROJECT_COMPILE_COMPLETE',
      payload: {
        success: true,
        pdfBase64,
        pdfPath: pdfPath,
        log: log.slice(-2000),
        warnings,
      },
    }).catch(() => {});

    return {
      success: true,
      data: {
        success: true,
        pdfBase64,
        log: log.slice(-2000),
        warnings,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update Jupyter notebook cells (without executing).
 * Auto-switches to jupyter-notebook before sending content.
 */
export async function updateNotebook(
  params: UpdateNotebookParams
): Promise<ToolResult<UIActionResult>> {
  await sendUIDirective({
    type: 'SWITCH_COMPONENT',
    payload: { component: 'jupyter-notebook' },
  }).catch(() => {});

  return sendUIDirective({
    type: 'UPDATE_NOTEBOOK',
    payload: { cells: params.cells, execute: params.execute ?? false },
  });
}

// ============================================================
// Artifact & Gallery Tools
// ============================================================

/**
 * Save a generated artifact to the workspace collection.
 * Posts to the Next.js artifacts API which handles S3 upload + remote DB.
 */
export async function saveArtifact(
  params: SaveArtifactParams
): Promise<ToolResult<UIActionResult>> {
  try {
    const config = getConfig();
    const result = await fetch(`${config.apiBaseUrl}/api/agents/${config.agentId}/artifacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: params.title,
        type: params.type,
        content: params.content,
        mimeType: params.mimeType,
      }),
    });

    if (!result.ok) {
      const error = await result.json().catch(() => ({ error: result.statusText }));
      throw new Error(error.error || 'Failed to save artifact');
    }

    const data = await result.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Add images to the workspace gallery.
 * Auto-switches to bento-gallery before sending.
 */
export async function updateGallery(
  params: UpdateGalleryParams
): Promise<ToolResult<UIActionResult>> {
  await sendUIDirective({
    type: 'SWITCH_COMPONENT',
    payload: { component: 'bento-gallery' },
  }).catch(() => {});

  return sendUIDirective({
    type: 'UPDATE_GALLERY',
    payload: { images: params.images },
  });
}

// ============================================================
// Code Execution Tools
// ============================================================

/**
 * Execute code in the container and display output in Code Playground terminal.
 * Auto-switches UI to code-playground, pushes code into editor, executes via
 * container exec API, and sends terminal output directive.
 */
export async function codeExecute(
  params: CodeExecuteParams
): Promise<ToolResult<CodeExecuteResult>> {
  try {
    const config = getConfig();
    const { code, language } = params;
    const filename = language === 'python' ? 'main.py' : 'main.js';
    const lang = language === 'python' ? 'python' : 'javascript';

    // 1. Switch to code-playground
    await sendUIDirective({
      type: 'SWITCH_COMPONENT',
      payload: { component: 'code-playground' },
    }).catch(() => {});

    // 2. Push code into editor
    await sendUIDirective({
      type: 'UPDATE_CODE',
      payload: {
        files: [{ name: filename, content: code, language: lang }],
        selectedFile: filename,
      },
    }).catch(() => {});

    // 3. Execute via container exec API
    const interpreter = language === 'python' ? 'python3' : 'node';
    const flag = language === 'python' ? '-c' : '-e';

    const res = await fetch(`${config.apiBaseUrl}/api/container/${config.agentId}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: [interpreter, flag, code],
        timeout: 30000,
      }),
    });

    const data = await res.json() as { success: boolean; data?: { output: string }; error?: string };

    if (!data.success) {
      const errorOutput = data.error || 'Execution failed';
      await sendUIDirective({
        type: 'TERMINAL_OUTPUT',
        payload: { output: `❌ ${errorOutput}` },
      }).catch(() => {});
      return { success: false, error: errorOutput };
    }

    const output = data.data?.output || '';

    // 4. Send terminal output directive
    await sendUIDirective({
      type: 'TERMINAL_OUTPUT',
      payload: { output },
    }).catch(() => {});

    return { success: true, data: { output } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// Data Tools (pandas-based file operations)
// ============================================================

const DATA_DIR = '/workspace/data';
const DATA_HELPERS_DIR = '/workspace/.prismer/data_helpers';
const PYTHON3 = '/home/user/.venv/bin/python3';

/**
 * Ensure data helper scripts are deployed.
 */
let _helpersDeployed = false;
function ensureDataHelpers(): void {
  if (_helpersDeployed) return;
  mkdirSync(DATA_HELPERS_DIR, { recursive: true });
  writeFileSync(`${DATA_HELPERS_DIR}/load_data.py`, LOAD_DATA_PY, 'utf-8');
  writeFileSync(`${DATA_HELPERS_DIR}/query_data.py`, QUERY_DATA_PY, 'utf-8');
  writeFileSync(`${DATA_HELPERS_DIR}/save_data.py`, SAVE_DATA_PY, 'utf-8');
  _helpersDeployed = true;
}

/** Python helper: load data file and output JSON */
const LOAD_DATA_PY = `#!/usr/bin/env python3
import pandas as pd
import json, sys, os, math

filepath = sys.argv[1]
max_rows = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
sheet = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != '_' else None
delimiter = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '_' else None
encoding = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] != '_' else 'utf-8'

ext = os.path.splitext(filepath)[1].lower()

try:
    if ext in ('.csv', '.tsv'):
        sep = delimiter or ('\\t' if ext == '.tsv' else ',')
        df = pd.read_csv(filepath, sep=sep, encoding=encoding)
    elif ext in ('.xlsx', '.xls'):
        df = pd.read_excel(filepath, sheet_name=sheet or 0)
    elif ext == '.json':
        df = pd.read_json(filepath)
    elif ext == '.parquet':
        df = pd.read_parquet(filepath)
    else:
        print(json.dumps({"error": f"Unsupported format: {ext}"}))
        sys.exit(1)
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)

total_rows = len(df)
truncated = total_rows > max_rows
df_send = df.head(max_rows) if truncated else df

col_info = []
for col in df.columns:
    col_info.append({
        "name": str(col),
        "dtype": str(df[col].dtype),
        "nonNullCount": int(df[col].notna().sum()),
        "nullCount": int(df[col].isna().sum()),
    })

ag_columns = []
for col in df.columns:
    dtype = str(df[col].dtype)
    col_def = {"field": str(col), "headerName": str(col)}
    if dtype.startswith(('int', 'float')):
        col_def["filter"] = "agNumberColumnFilter"
    else:
        col_def["filter"] = "agTextColumnFilter"
    ag_columns.append(col_def)

try:
    preview = df.head(5).to_markdown(index=False)
except Exception:
    preview = df.head(5).to_string(index=False)

rows = df_send.to_dict(orient='records')
for row in rows:
    for k, v in row.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            row[k] = None

# Save full df as pickle for data_query
df.to_pickle('${DATA_HELPERS_DIR}/_last_df.pkl')

result = {
    "rows": rows,
    "columns": ag_columns,
    "meta": {
        "rows": total_rows,
        "columns": len(df.columns),
        "columnInfo": col_info,
        "sizeBytes": os.path.getsize(filepath),
    },
    "preview": preview,
    "truncated": truncated,
    "totalRows": total_rows,
}

print(json.dumps(result, default=str))
`;

/** Python helper: query loaded DataFrame */
const QUERY_DATA_PY = `#!/usr/bin/env python3
import pandas as pd
import json, sys, math

max_rows = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
update_grid = sys.argv[2] == 'true' if len(sys.argv) > 2 else True
code = sys.argv[3] if len(sys.argv) > 3 else ''

pickle_path = '${DATA_HELPERS_DIR}/_last_df.pkl'

try:
    df = pd.read_pickle(pickle_path)
except Exception as e:
    print(json.dumps({"error": f"No data loaded. Use data_load first. ({e})"}))
    sys.exit(1)

try:
    local_vars = {'df': df, 'pd': pd}
    exec(code, {}, local_vars)
    result_df = local_vars.get('result', local_vars.get('df', df))

    if isinstance(result_df, pd.DataFrame):
        # Save updated df
        result_df.to_pickle(pickle_path)

        total_rows = len(result_df)
        truncated = total_rows > max_rows
        df_send = result_df.head(max_rows) if truncated else result_df

        try:
            preview = result_df.head(10).to_markdown(index=False)
        except Exception:
            preview = result_df.head(10).to_string(index=False)

        rows = df_send.to_dict(orient='records')
        for row in rows:
            for k, v in row.items():
                if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                    row[k] = None

        ag_columns = []
        for col in result_df.columns:
            dtype = str(result_df[col].dtype)
            col_def = {"field": str(col), "headerName": str(col)}
            if dtype.startswith(('int', 'float')):
                col_def["filter"] = "agNumberColumnFilter"
            else:
                col_def["filter"] = "agTextColumnFilter"
            ag_columns.append(col_def)

        output = {
            "resultType": "dataframe",
            "preview": preview,
            "shape": [total_rows, len(result_df.columns)],
            "gridUpdated": update_grid,
        }
        if update_grid:
            output["rows"] = rows
            output["columns"] = ag_columns
            output["truncated"] = truncated
            output["totalRows"] = total_rows

        print(json.dumps(output, default=str))
    elif isinstance(result_df, pd.Series):
        try:
            preview = result_df.to_markdown()
        except Exception:
            preview = result_df.to_string()
        print(json.dumps({
            "resultType": "scalar",
            "preview": preview,
            "value": str(result_df.to_dict()),
            "gridUpdated": False,
        }, default=str))
    else:
        print(json.dumps({
            "resultType": "scalar",
            "preview": str(result_df),
            "value": str(result_df),
            "gridUpdated": False,
        }, default=str))

except Exception as e:
    import traceback
    print(json.dumps({
        "resultType": "error",
        "preview": traceback.format_exc(),
        "gridUpdated": False,
    }))
`;

/** Python helper: save DataFrame to file */
const SAVE_DATA_PY = `#!/usr/bin/env python3
import pandas as pd
import json, sys, os

filename = sys.argv[1]
include_index = sys.argv[2] == 'true' if len(sys.argv) > 2 else False
pickle_path = '${DATA_HELPERS_DIR}/_last_df.pkl'

try:
    df = pd.read_pickle(pickle_path)
except Exception as e:
    print(json.dumps({"error": f"No data loaded. Use data_load first. ({e})"}))
    sys.exit(1)

ext = os.path.splitext(filename)[1].lower()

try:
    if ext == '.csv':
        df.to_csv(filename, index=include_index)
    elif ext == '.tsv':
        df.to_csv(filename, sep='\\t', index=include_index)
    elif ext in ('.xlsx', '.xls'):
        df.to_excel(filename, index=include_index)
    elif ext == '.json':
        df.to_json(filename, orient='records', indent=2)
    elif ext == '.parquet':
        df.to_parquet(filename, index=include_index)
    else:
        df.to_csv(filename, index=include_index)

    print(json.dumps({
        "filename": os.path.basename(filename),
        "sizeBytes": os.path.getsize(filename),
        "rows": len(df),
    }))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;

/**
 * Detect file format from extension.
 */
function detectFormat(filename: string): DataFileFormat | 'unknown' {
  const ext = path.extname(filename).toLowerCase();
  const formatMap: Record<string, DataFileFormat> = {
    '.csv': 'csv', '.tsv': 'tsv', '.xlsx': 'xlsx', '.xls': 'xlsx',
    '.json': 'json', '.parquet': 'parquet',
  };
  return formatMap[ext] || 'unknown';
}

/**
 * List available data files in /workspace/data/.
 */
export async function dataList(
  params: DataListParams
): Promise<ToolResult<DataListResult>> {
  try {
    mkdirSync(DATA_DIR, { recursive: true });

    const entries = readdirSync(DATA_DIR, { withFileTypes: true });
    const files: DataFileEntry[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      const pattern = params.pattern;
      if (pattern && pattern !== '*' && !entry.name.includes(pattern)) continue;

      const fullPath = path.join(DATA_DIR, entry.name);
      const stat = statSync(fullPath);
      files.push({
        filename: entry.name,
        format: detectFormat(entry.name),
        sizeBytes: stat.size,
        lastModified: stat.mtimeMs,
      });
    }

    return {
      success: true,
      data: { files, directory: DATA_DIR },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Load a data file from /workspace/data/ into AG Grid.
 * Uses pandas to read the file, sends data to frontend, returns preview to agent.
 */
export async function dataLoad(
  params: DataLoadParams
): Promise<ToolResult<DataLoadResult>> {
  try {
    ensureDataHelpers();

    const fullPath = path.join(DATA_DIR, params.filename);
    if (!existsSync(fullPath)) {
      return {
        success: false,
        error: `File not found: ${params.filename}. Use data_list to see available files in /workspace/data/.`,
      };
    }

    const maxRows = Math.min(params.maxRows || 5000, 50000);
    const sheet = params.sheet || '_';
    const delimiter = params.delimiter || '_';
    const encoding = params.encoding || '_';

    const cmd = `${PYTHON3} ${DATA_HELPERS_DIR}/load_data.py "${fullPath}" ${maxRows} "${sheet}" "${delimiter}" "${encoding}"`;
    let output: string;
    try {
      output = execSync(cmd, {
        timeout: 60_000,
        maxBuffer: 50 * 1024 * 1024,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (e: unknown) {
      const execErr = e as { stdout?: string; stderr?: string };
      const stderr = execErr.stderr || '';
      return { success: false, error: `pandas load failed: ${stderr.slice(0, 500)}` };
    }

    const result = JSON.parse(output.trim()) as {
      rows: Record<string, unknown>[];
      columns: Array<{ field: string; headerName: string; filter?: string }>;
      meta: { rows: number; columns: number; columnInfo: Array<{ name: string; dtype: string; nonNullCount: number; nullCount: number }>; sizeBytes: number };
      preview: string;
      truncated: boolean;
      totalRows: number;
      error?: string;
    };

    if (result.error) {
      return { success: false, error: result.error };
    }

    const format = detectFormat(params.filename) as DataFileFormat;

    // Switch to ag-grid
    await sendUIDirective({
      type: 'SWITCH_COMPONENT',
      payload: { component: 'ag-grid' },
    }).catch(() => {});

    // Send data to frontend
    await sendUIDirective({
      type: 'UPDATE_DATA_GRID',
      payload: {
        data: result.rows,
        columns: result.columns,
        title: params.filename,
        meta: {
          filename: params.filename,
          format,
          totalRows: result.totalRows,
          displayedRows: result.rows.length,
          truncated: result.truncated,
          columnInfo: result.meta.columnInfo,
        },
      },
    }).catch(() => {});

    return {
      success: true,
      data: {
        meta: {
          filename: params.filename,
          format,
          rows: result.meta.rows,
          columns: result.meta.columns,
          columnInfo: result.meta.columnInfo,
          sizeBytes: result.meta.sizeBytes,
          preview: result.preview,
        },
        truncated: result.truncated,
        totalRows: result.totalRows,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute pandas operations on the loaded DataFrame.
 * The variable `df` is pre-loaded from the last data_load call.
 * Set `result = ...` to define the output DataFrame.
 */
export async function dataQuery(
  params: DataQueryParams
): Promise<ToolResult<DataQueryResult>> {
  try {
    ensureDataHelpers();

    const maxRows = Math.min(params.maxRows || 5000, 50000);
    const updateGrid = params.updateGrid !== false;

    // Write user code to temp file to avoid shell escaping issues
    const codeFile = `${DATA_HELPERS_DIR}/_query_code.py`;
    writeFileSync(codeFile, params.code, 'utf-8');

    // Write a wrapper script that loads the user code from file and runs query_data.py
    const wrapperFile = `${DATA_HELPERS_DIR}/_query_wrapper.py`;
    const wrapperCode = [
      '#!/usr/bin/env python3',
      'import sys',
      `sys.argv = ['query_data.py', '${maxRows}', '${String(updateGrid)}']`,
      `with open('${codeFile}', 'r') as f:`,
      '    sys.argv.append(f.read())',
      `exec(open('${DATA_HELPERS_DIR}/query_data.py').read())`,
    ].join('\n');
    writeFileSync(wrapperFile, wrapperCode, 'utf-8');

    let output: string;
    try {
      output = execSync(`${PYTHON3} ${wrapperFile}`, {
        timeout: 60_000,
        maxBuffer: 50 * 1024 * 1024,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (e: unknown) {
      const execErr = e as { stdout?: string; stderr?: string };
      const stdout = execErr.stdout || '';
      const stderr = execErr.stderr || '';
      // Try to parse stdout even on non-zero exit (python error results)
      if (stdout.trim()) {
        output = stdout;
      } else {
        return { success: false, error: `Query execution failed: ${stderr.slice(0, 500)}` };
      }
    }

    const result = JSON.parse(output.trim()) as {
      resultType: 'dataframe' | 'scalar' | 'error';
      preview: string;
      shape?: [number, number];
      value?: string;
      gridUpdated: boolean;
      rows?: Record<string, unknown>[];
      columns?: Array<{ field: string; headerName: string; filter?: string }>;
      truncated?: boolean;
      totalRows?: number;
      error?: string;
    };

    if (result.error) {
      return { success: false, error: result.error };
    }

    // If grid should be updated and we have rows, send directive
    if (result.gridUpdated && result.rows) {
      await sendUIDirective({
        type: 'SWITCH_COMPONENT',
        payload: { component: 'ag-grid' },
      }).catch(() => {});

      await sendUIDirective({
        type: 'UPDATE_DATA_GRID',
        payload: {
          data: result.rows,
          columns: result.columns,
          title: 'Query Result',
          meta: {
            filename: 'query result',
            format: 'csv',
            totalRows: result.totalRows,
            displayedRows: result.rows.length,
            truncated: result.truncated,
            columnInfo: [],
          },
        },
      }).catch(() => {});
    }

    return {
      success: true,
      data: {
        preview: result.preview,
        resultType: result.resultType,
        shape: result.shape,
        value: result.value,
        gridUpdated: result.gridUpdated && !!result.rows,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save the current DataFrame to a file in /workspace/data/.
 */
export async function dataSave(
  params: DataSaveParams
): Promise<ToolResult<DataSaveResult>> {
  try {
    ensureDataHelpers();
    mkdirSync(DATA_DIR, { recursive: true });

    const fullPath = path.join(DATA_DIR, params.filename);
    const includeIndex = params.includeIndex ? 'true' : 'false';

    const cmd = `${PYTHON3} ${DATA_HELPERS_DIR}/save_data.py "${fullPath}" ${includeIndex}`;
    let output: string;
    try {
      output = execSync(cmd, {
        timeout: 60_000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (e: unknown) {
      const execErr = e as { stdout?: string; stderr?: string };
      return { success: false, error: `Save failed: ${(execErr.stderr || '').slice(0, 500)}` };
    }

    const result = JSON.parse(output.trim()) as {
      filename: string;
      sizeBytes: number;
      rows: number;
      error?: string;
    };

    if (result.error) {
      return { success: false, error: result.error };
    }

    const format = (params.format || detectFormat(params.filename)) as DataFileFormat;

    return {
      success: true,
      data: {
        filename: params.filename,
        format,
        sizeBytes: result.sizeBytes,
        rows: result.rows,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// Code & Data Grid Tools
// ============================================================

/**
 * Update the Code Playground with source files.
 * Auto-switches to code-playground before sending content.
 */
export async function updateCode(
  params: UpdateCodeParams
): Promise<ToolResult<UIActionResult>> {
  await sendUIDirective({
    type: 'SWITCH_COMPONENT',
    payload: { component: 'code-playground' },
  }).catch(() => {});

  return sendUIDirective({
    type: 'UPDATE_CODE',
    payload: { files: params.files, selectedFile: params.selectedFile },
  });
}

/**
 * Update the Data Grid with structured data.
 * Auto-switches to ag-grid before sending content.
 */
export async function updateDataGrid(
  params: UpdateDataGridParams
): Promise<ToolResult<UIActionResult>> {
  await sendUIDirective({
    type: 'SWITCH_COMPONENT',
    payload: { component: 'ag-grid' },
  }).catch(() => {});

  return sendUIDirective({
    type: 'UPDATE_DATA_GRID',
    payload: { data: params.data, columns: params.columns, title: params.title },
  });
}

// ============================================================
// Cloud SDK Context API Tools
// ============================================================

/**
 * Get or create the Prismer API key from config.
 * Priority: process.env.PRISMER_API_KEY > config.prismerApiKey > null
 */
function getPrismerApiKey(): string | null {
  // 1. Environment variable (production: Nacos injection)
  if (process.env.PRISMER_API_KEY) {
    return process.env.PRISMER_API_KEY;
  }
  // 2. Plugin config (open-source: openclaw.json)
  const config = _config;
  if (config?.prismerApiKey) {
    return config.prismerApiKey;
  }
  return null;
}

/**
 * Get Prismer API base URL
 */
function getPrismerBaseUrl(): string {
  return process.env.PRISMER_BASE_URL || 'https://prismer.cloud';
}

/**
 * Search for content using Cloud SDK Context API.
 * Returns semantically relevant results with HQCC-compressed content.
 */
export async function contextSearch(
  params: ContextSearchParams
): Promise<ToolResult<ContextSearchResult>> {
  try {
    const apiKey = getPrismerApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: 'Prismer API key not configured. Set PRISMER_API_KEY env var or prismerApiKey in plugin config.',
      };
    }

    const baseUrl = getPrismerBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/context/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: params.query,
        top_k: params.topK || 10,
        return_top_k: params.returnTopK || 5,
        format: params.format || 'hqcc',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Context search failed: ${response.status}`);
    }

    const data = await response.json();
    const results = (data.results || []).map((r: Record<string, unknown>) => ({
      url: r.url as string,
      title: r.title as string,
      content: (r.hqcc || r.content || r.raw || '') as string,
      cached: r.cached as boolean ?? false,
      relevanceScore: r.relevance_score as number | undefined,
    }));

    return {
      success: true,
      data: {
        results,
        totalResults: data.total || results.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Load content from URL(s) using Cloud SDK Context API.
 * Returns cached content when available (zero cost), otherwise fetches and compresses.
 */
export async function contextLoad(
  params: ContextLoadParams
): Promise<ToolResult<ContextLoadResult>> {
  try {
    const apiKey = getPrismerApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: 'Prismer API key not configured. Set PRISMER_API_KEY env var or prismerApiKey in plugin config.',
      };
    }

    const baseUrl = getPrismerBaseUrl();
    const sources = Array.isArray(params.source) ? params.source : [params.source];

    // Fetch all sources in parallel
    const items = await Promise.all(
      sources.map(async (url) => {
        const response = await fetch(`${baseUrl}/api/v1/context/load`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            url,
            format: params.format || 'hqcc',
          }),
        });

        if (!response.ok) {
          return {
            url,
            title: '',
            content: `[Error: Failed to load ${url}]`,
            cached: false,
          };
        }

        const data = await response.json();
        return {
          url,
          title: (data.title || '') as string,
          content: (data.hqcc || data.content || data.raw || '') as string,
          cached: data.cached as boolean ?? false,
        };
      })
    );

    return {
      success: true,
      data: { items },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// Workspace Context Tools
// ============================================================

/**
 * Get current workspace state from Prismer Backend API.
 * Returns structured data about files, editors, tasks, and recent activity.
 */
async function getWorkspaceState(
  params: GetWorkspaceStateParams
): Promise<ToolResult<WorkspaceStateResult>> {
  const config = getConfig();
  const workspaceId = config.workspaceId;

  if (!workspaceId) {
    return {
      success: false,
      error: 'WORKSPACE_ID not configured. Cannot query workspace state.',
    };
  }

  try {
    const includeParam = params.include
      ? params.include.join(',')
      : 'files,editors,tasks,messages,timeline';

    const url = `${config.apiBaseUrl}/api/workspace/${workspaceId}/context?include=${includeParam}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Backend returned ${response.status}: ${(errorBody as Record<string, string>).error || response.statusText}`,
      };
    }

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || 'Unknown error' };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch workspace state',
    };
  }
}

/**
 * Sync files from container to workspace frontend.
 * Writes files to the workspace DB so the frontend editors can display them.
 */
async function syncFilesToWorkspace(
  params: SyncFilesToWorkspaceParams
): Promise<ToolResult> {
  const config = getConfig();
  const workspaceId = config.workspaceId;

  if (!workspaceId) {
    return {
      success: false,
      error: 'WORKSPACE_ID not configured. Cannot sync files.',
    };
  }

  if (!params.files || params.files.length === 0) {
    return { success: false, error: 'No files provided' };
  }

  try {
    // Uses the existing PUT /api/workspace/:id/files/sync endpoint to upsert files into DB
    const url = `${config.apiBaseUrl}/api/workspace/${workspaceId}/files/sync`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: params.files }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Backend returned ${response.status}: ${(errorBody as Record<string, string>).error || response.statusText}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      data: { synced: params.files.length, ...(result.data || {}) },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync files',
    };
  }
}

// ============================================================
// Tool Definitions for OpenClaw
// ============================================================

/**
 * OpenClaw tool definitions
 */
export const toolDefinitions = [
  // NOTE: latex_compile removed in v0.7.0 — use latex_project_compile instead
  // NOTE: update_latex removed in v0.7.0 — use latex_project("write") instead
  {
    name: 'jupyter_execute',
    description: 'Execute Python code in a Jupyter kernel and return the output. Automatically switches UI to Jupyter notebook and displays results. No need to call switch_component.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The Python code to execute',
        },
        kernel: {
          type: 'string',
          description: 'Kernel name (default: python3)',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'jupyter_notebook',
    description: 'Create, read, update, delete, or list Jupyter notebooks.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the notebook or directory',
        },
        operation: {
          type: 'string',
          enum: ['create', 'read', 'update', 'delete', 'list'],
          description: 'Operation to perform',
        },
        content: {
          type: 'object',
          description: 'Notebook content for create/update operations',
        },
      },
      required: ['path', 'operation'],
    },
  },
  {
    name: 'load_pdf',
    description: 'Load a PDF document. Automatically switches UI to the PDF reader and navigates to the specified page. No need to call switch_component.',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'URL or path to the PDF file',
        },
        page: {
          type: 'number',
          description: 'Page number to navigate to (default: 1)',
        },
      },
      required: ['source'],
    },
  },
  {
    name: 'switch_component',
    description: 'Switch the active workspace component (PDF reader, LaTeX editor, Jupyter, etc.).',
    parameters: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          enum: [
            'pdf-reader',
            'latex-editor',
            'jupyter-notebook',
            'code-playground',
            'ai-editor',
            'ag-grid',
            'bento-gallery',
            'three-viewer',
          ],
          description: 'Target component to switch to',
        },
        data: {
          type: 'object',
          description: 'Initial data for the component',
        },
      },
      required: ['component'],
    },
  },
  {
    name: 'send_ui_directive',
    description: 'Send a UI directive to control workspace components. Use for advanced UI operations.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Directive type (e.g., JUPYTER_ADD_CELL, LATEX_SCROLL_TO_LINE)',
        },
        payload: {
          type: 'object',
          description: 'Directive payload',
        },
      },
      required: ['type', 'payload'],
    },
  },
  {
    name: 'arxiv_to_prompt',
    description:
      'Convert an arXiv paper to flattened LaTeX optimized for LLM reading. ' +
      'Downloads the paper source, flattens multi-file projects, strips comments, ' +
      'and outputs clean text. Can also list sections or extract the abstract.',
    parameters: {
      type: 'object',
      properties: {
        arxiv_id: {
          type: 'string',
          description: 'arXiv paper ID (e.g., "2303.08774" or "2303.08774v2")',
        },
        remove_comments: {
          type: 'boolean',
          description: 'Remove LaTeX comments (default: true)',
        },
        remove_appendix: {
          type: 'boolean',
          description: 'Remove appendix sections (default: false)',
        },
        abstract_only: {
          type: 'boolean',
          description: 'Extract only the abstract',
        },
        section: {
          type: 'string',
          description: 'Extract a specific section by name',
        },
        list_sections: {
          type: 'boolean',
          description: 'List all section names instead of converting',
        },
        figure_paths: {
          type: 'boolean',
          description: 'Only include figure file paths (not figure content)',
        },
      },
      required: ['arxiv_id'],
    },
  },
  {
    name: 'update_notes',
    description:
      'Update the Notes editor content with HTML. Use for creating experiment templates, ' +
      'writing notes, or inserting structured content. Automatically switches to Notes editor.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'HTML content to set in the editor',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'update_notebook',
    description:
      'Add or update cells in the Jupyter notebook without executing. Use for setting up ' +
      'notebook content. Automatically switches to Jupyter.',
    parameters: {
      type: 'object',
      properties: {
        cells: {
          type: 'array',
          description: 'Array of cells with {type: "code"|"markdown", source: string}',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['code', 'markdown'],
                description: 'Cell type',
              },
              source: {
                type: 'string',
                description: 'Cell source content',
              },
            },
            required: ['type', 'source'],
          },
        },
        execute: {
          type: 'boolean',
          description: 'Whether to execute code cells (default: false)',
        },
      },
      required: ['cells'],
    },
  },
  // save_artifact internalized in v0.7.0 — auto-triggered by compile tools and directive middleware
  {
    name: 'update_gallery',
    description:
      'Add images to the workspace gallery for visual display. Switches to gallery view automatically. ' +
      'Use after generating plots or visualizations.',
    parameters: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          description: 'Array of images to display',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Image title',
              },
              description: {
                type: 'string',
                description: 'Image description',
              },
              url: {
                type: 'string',
                description: 'Image URL or base64 data URI',
              },
            },
            required: ['title', 'url'],
          },
        },
      },
      required: ['images'],
    },
  },
  {
    name: 'code_execute',
    description:
      'Execute Python or Node.js code in the agent container and display results in the Code Playground terminal. ' +
      'Automatically switches to code playground, pushes code into editor, executes in container, and shows output. ' +
      'Use for running scripts, data processing, or quick computations.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The source code to execute',
        },
        language: {
          type: 'string',
          enum: ['python', 'node'],
          description: 'Programming language (python or node)',
        },
      },
      required: ['code', 'language'],
    },
  },
  {
    name: 'update_code',
    description:
      'Push source code files to the Code Playground editor. Supports multiple files with syntax highlighting. ' +
      'Automatically switches to the code playground view. Use for showing code examples, scripts, or implementations.',
    parameters: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          description: 'Array of source files to display',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Filename with extension (e.g., "main.py", "index.js")',
              },
              content: {
                type: 'string',
                description: 'File source code content',
              },
              language: {
                type: 'string',
                description: 'Language for syntax highlighting (auto-detected from extension if omitted)',
              },
            },
            required: ['name', 'content'],
          },
        },
        selectedFile: {
          type: 'string',
          description: 'Which file to show initially (defaults to first file)',
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'data_list',
    description:
      'List available data files in /workspace/data/. Returns filenames, sizes, formats, and last modified times. ' +
      'Use this first to discover what datasets are available before loading.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Filter pattern to match filenames (e.g., "experiment" matches "experiment_results.csv")',
        },
      },
    },
  },
  {
    name: 'data_load',
    description:
      'Load a data file (CSV, XLSX, JSON, Parquet, TSV) from /workspace/data/ into the AG Grid viewer. ' +
      'Reads the file using pandas, auto-generates column definitions, and displays data in the grid. ' +
      'Returns a markdown preview of the first rows so you can understand the data structure. ' +
      'For large files, data is truncated to maxRows (default 5000). Use data_query to filter before viewing.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'File path relative to /workspace/data/ (e.g., "experiment.csv", "results.xlsx")',
        },
        sheet: {
          type: 'string',
          description: 'Sheet name for XLSX files (default: first sheet)',
        },
        maxRows: {
          type: 'number',
          description: 'Maximum rows to send to the grid viewer (default: 5000, max: 50000)',
        },
        delimiter: {
          type: 'string',
          description: 'CSV delimiter character (default: auto-detect, comma for .csv, tab for .tsv)',
        },
        encoding: {
          type: 'string',
          description: 'File encoding (default: utf-8)',
        },
      },
      required: ['filename'],
    },
  },
  {
    name: 'data_query',
    description:
      'Execute pandas operations on the currently loaded DataFrame. The variable `df` contains the last loaded data. ' +
      'Write pandas code and assign the result to `result` variable (or modify `df` in place). ' +
      'Returns a markdown preview of the result. By default, sends the result DataFrame to the AG Grid. ' +
      'Examples: "result = df[df[\'score\'] > 90]", "result = df.groupby(\'category\').mean()", "result = df.describe()"',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Python pandas code to execute. Variable `df` is the loaded DataFrame. Set `result = ...` for output.',
        },
        updateGrid: {
          type: 'boolean',
          description: 'Whether to update the AG Grid with the result (default: true)',
        },
        maxRows: {
          type: 'number',
          description: 'Maximum rows to send to grid if updateGrid (default: 5000)',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'data_save',
    description:
      'Save the current DataFrame to a file in /workspace/data/. ' +
      'Format is inferred from the file extension (.csv, .xlsx, .json, .parquet, .tsv). ' +
      'Saves the last loaded or queried DataFrame.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Output filename relative to /workspace/data/ (e.g., "filtered_results.csv", "analysis.xlsx")',
        },
        format: {
          type: 'string',
          enum: ['csv', 'xlsx', 'json', 'parquet', 'tsv'],
          description: 'Output format (inferred from extension if omitted)',
        },
        includeIndex: {
          type: 'boolean',
          description: 'Whether to include the DataFrame index (default: false)',
        },
      },
      required: ['filename'],
    },
  },
  {
    name: 'latex_project',
    description:
      'Manage files in the LaTeX project directory (/workspace/latex/). ' +
      'Use "list" to see all project files, "read" to get file content, ' +
      '"write" to create/update files, "delete" to remove files. ' +
      'For multi-file LaTeX projects with \\input{}, \\bibliography{}, etc.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['list', 'read', 'write', 'delete'],
          description: 'Operation to perform',
        },
        path: {
          type: 'string',
          description: 'File path relative to project root (e.g., "main.tex", "chapters/intro.tex")',
        },
        content: {
          type: 'string',
          description: 'File content (required for write operation)',
        },
      },
      required: ['operation'],
    },
  },
  {
    name: 'latex_project_compile',
    description:
      'Compile the LaTeX project from /workspace/latex/ directory. ' +
      'Supports multi-file projects with \\input{}, \\bibliography{}, \\includegraphics{}. ' +
      'Runs pdflatex directly in the project directory. ' +
      'Automatically switches UI to LaTeX editor and shows compile results.',
    parameters: {
      type: 'object',
      properties: {
        mainFile: {
          type: 'string',
          description: 'Main .tex file to compile (default: "main.tex")',
        },
        engine: {
          type: 'string',
          enum: ['pdflatex', 'xelatex', 'lualatex'],
          description: 'LaTeX engine (default: "pdflatex")',
        },
        runBibtex: {
          type: 'boolean',
          description: 'Run bibtex/biber between compilation passes (default: false)',
        },
      },
    },
  },
  {
    name: 'get_paper_context',
    description:
      'Get structured content from a paper (metadata, markdown text, detection regions). ' +
      'Use this to READ and ANALYZE paper content without opening the PDF reader. ' +
      'Supports arXiv IDs and uploaded papers. Returns OCR-processed data when available, ' +
      'including metadata (title, authors, abstract), full markdown text, and page-level detections. ' +
      'Use "summary" for a truncated overview (4000 chars) or "full_markdown" for complete text.',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'arXiv ID (e.g., "2512.25072v1") or upload source ID (e.g., "upload_abc123")',
        },
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['metadata', 'summary', 'full_markdown', 'detections'],
          },
          description: 'What data to include (default: ["metadata", "summary"])',
        },
        pages: {
          type: 'array',
          items: { type: 'number' },
          description: 'Limit detections to specific page numbers',
        },
      },
      required: ['source'],
    },
  },
  {
    name: 'navigate_pdf',
    description:
      'Navigate the PDF reader to a specific page and optionally highlight a detection region. ' +
      'The PDF must already be loaded (use load_pdf first). ' +
      'Use detectionId to highlight specific elements (figures, tables, equations).',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          description: 'Page number to navigate to',
        },
        detectionId: {
          type: 'string',
          description: 'Detection ID to highlight (e.g., "p5_image_0")',
        },
        highlightRegion: {
          type: 'object',
          description: 'Bounding box to highlight {x1, y1, x2, y2} in pixel coordinates',
          properties: {
            x1: { type: 'number' },
            y1: { type: 'number' },
            x2: { type: 'number' },
            y2: { type: 'number' },
          },
        },
      },
      required: ['page'],
    },
  },
  {
    name: 'context_search',
    description:
      'Search the web for relevant content using semantic search. Returns HQCC-compressed content ' +
      'optimized for LLM analysis. Use for finding papers, documentation, or any web content ' +
      'related to the research topic. Results include relevance scores.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g., "transformer attention mechanism improvements 2025")',
        },
        topK: {
          type: 'number',
          description: 'Number of results to search through (default: 10)',
        },
        returnTopK: {
          type: 'number',
          description: 'Number of results to return (default: 5)',
        },
        format: {
          type: 'string',
          enum: ['hqcc', 'raw', 'both'],
          description: 'Content format: hqcc (LLM-optimized, default), raw (original), both',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'context_load',
    description:
      'Load content from a specific URL. Returns cached content when available (zero cost). ' +
      'Use for loading specific web pages, arXiv abstracts, documentation, or any URL. ' +
      'Content is compressed and optimized for LLM reading.',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'URL to load (e.g., "https://arxiv.org/abs/2512.25072")',
        },
        format: {
          type: 'string',
          enum: ['hqcc', 'raw'],
          description: 'Content format: hqcc (LLM-optimized, default), raw (original)',
        },
      },
      required: ['source'],
    },
  },
  {
    name: 'get_workspace_state',
    description:
      'Get current workspace state including files, editors, tasks, and recent activity. ' +
      'Call this to understand what the user is working on, what files exist in the project, ' +
      'which editor is active, and recent conversation context. ' +
      'Always call this before starting a complex task to understand the workspace context.',
    parameters: {
      type: 'object',
      properties: {
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['files', 'editors', 'tasks', 'messages', 'timeline'],
          },
          description: 'Sections to include in the response (default: all). Use fewer sections for faster response.',
        },
      },
    },
  },
  // sync_files_to_workspace internalized in v0.7.0 — auto-triggered by directive middleware

  // ========== Phase B: Agent Observability Tools (v0.7.0) ==========
  {
    name: 'update_tasks',
    description:
      'Update the task panel in the workspace UI to show current progress. ' +
      'Use this to keep the user informed about what you are doing and your progress. ' +
      'Send a list of tasks with titles, statuses, and optional subtasks. ' +
      'This replaces any previous task list.',
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              status: {
                type: 'string',
                enum: ['pending', 'running', 'completed', 'error'],
                description: 'Task status (default: pending)',
              },
              progress: { type: 'number', description: 'Progress percentage (0-100)' },
              subtasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    status: { type: 'string', enum: ['pending', 'running', 'completed', 'error'] },
                  },
                  required: ['title'],
                },
              },
            },
            required: ['title'],
          },
          description: 'List of tasks to display',
        },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'request_user_confirmation',
    description:
      'Request confirmation from the user before proceeding with a significant action. ' +
      'Use this when about to perform destructive or irreversible operations, ' +
      'when the task is ambiguous and you need clarification, ' +
      'or when the user should explicitly approve an action.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The confirmation message to show the user',
        },
        confirmLabel: {
          type: 'string',
          description: 'Label for the confirm button (default: "Confirm")',
        },
        cancelLabel: {
          type: 'string',
          description: 'Label for the cancel button (default: "Cancel")',
        },
      },
      required: ['message'],
    },
  },
];

/**
 * Tool executor map
 */
export const toolExecutors: Record<string, (params: unknown) => Promise<ToolResult>> = {
  // latex_compile removed in v0.7.0 — use latex_project_compile
  jupyter_execute: (params) => jupyterExecute(params as JupyterExecuteCellParams),
  jupyter_notebook: (params) => jupyterNotebook(params as JupyterNotebookParams),
  load_pdf: (params) => loadPdf(params as PdfLoadParams),
  switch_component: (params) => switchComponent(params as SwitchComponentParams),
  send_ui_directive: (params) => sendUIDirective(params as UIDirectiveParams),
  arxiv_to_prompt: (params) => arxivToPrompt(params as ArxivToPromptParams),
  update_notes: (params) => updateNotes(params as UpdateNotesParams),
  // update_latex removed in v0.7.0 — use latex_project("write")
  update_notebook: (params) => updateNotebook(params as UpdateNotebookParams),
  save_artifact: (params) => saveArtifact(params as SaveArtifactParams),
  update_gallery: (params) => updateGallery(params as UpdateGalleryParams),
  code_execute: (params) => codeExecute(params as CodeExecuteParams),
  update_code: (params) => updateCode(params as UpdateCodeParams),
  update_data_grid: (params) => updateDataGrid(params as UpdateDataGridParams),
  data_list: (params) => dataList(params as DataListParams),
  data_load: (params) => dataLoad(params as DataLoadParams),
  data_query: (params) => dataQuery(params as DataQueryParams),
  data_save: (params) => dataSave(params as DataSaveParams),
  latex_project: (params) => latexProject(params as LatexProjectParams),
  latex_project_compile: (params) => latexProjectCompile(params as LatexProjectCompileParams),
  get_paper_context: (params) => getPaperContext(params as GetPaperContextParams),
  navigate_pdf: (params) => navigatePdf(params as NavigatePdfParams),
  context_search: (params) => contextSearch(params as ContextSearchParams),
  context_load: (params) => contextLoad(params as ContextLoadParams),
  get_workspace_state: (params) => getWorkspaceState(params as GetWorkspaceStateParams),
  sync_files_to_workspace: (params) => syncFilesToWorkspace(params as SyncFilesToWorkspaceParams),
  update_tasks: (params) => updateTasks(params as { tasks: Array<{ title: string; status?: string; progress?: number; subtasks?: Array<{ title: string; status?: string }> }> }),
  request_user_confirmation: (params) => requestUserConfirmation(params as { message: string; confirmLabel?: string; cancelLabel?: string }),
};

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  params: unknown
): Promise<ToolResult> {
  const executor = toolExecutors[toolName];
  if (!executor) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  return executor(params);
}

// ============================================================
// Phase B: Agent Observability Tools (v0.7.0)
// ============================================================

/**
 * Update the task panel via UPDATE_TASKS directive.
 * Sends task list to the frontend for display in the task panel.
 */
async function updateTasks(params: {
  tasks: Array<{
    title: string;
    status?: string;
    progress?: number;
    subtasks?: Array<{ title: string; status?: string }>;
  }>;
}): Promise<ToolResult> {
  if (!params.tasks || params.tasks.length === 0) {
    return { success: false, error: 'At least one task is required' };
  }

  return sendUIDirective({
    type: 'UPDATE_TASKS',
    payload: { tasks: params.tasks },
  });
}

/**
 * Request user confirmation via REQUEST_CONFIRMATION directive.
 * Adds an interactive confirmation message to the chat.
 */
async function requestUserConfirmation(params: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<ToolResult> {
  if (!params.message) {
    return { success: false, error: 'Message is required' };
  }

  const confirmationId = `confirm-${Date.now()}`;
  return sendUIDirective({
    type: 'REQUEST_CONFIRMATION',
    payload: {
      message: params.message,
      confirmLabel: params.confirmLabel || 'Confirm',
      cancelLabel: params.cancelLabel || 'Cancel',
      confirmationId,
    },
  });
}

// ============================================================
// Workspace Context Markdown Generator
// ============================================================

/**
 * Generate WORKSPACE.md content from structured context data.
 * Used by the agent:bootstrap hook to inject workspace state into system prompt.
 */
export function generateWorkspaceMd(ctx: Record<string, unknown>): string {
  const lines: string[] = [];
  const ws = ctx.workspace as { name?: string; description?: string; template?: string } | undefined;

  lines.push('# Workspace State');
  lines.push('');

  if (ws) {
    lines.push(`**Workspace:** ${ws.name || 'Untitled'}`);
    if (ws.description) lines.push(`**Description:** ${ws.description}`);
    if (ws.template) lines.push(`**Template:** ${ws.template}`);
    lines.push('');
  }

  if (ctx.activeComponent) {
    lines.push('## Active Component');
    lines.push(`${ctx.activeComponent}`);
    lines.push('');
  }

  const files = ctx.files as Array<{ path: string; hash?: string }> | undefined;
  if (files && files.length > 0) {
    lines.push('## Project Files');
    lines.push('');
    lines.push('| Path | Hash |');
    lines.push('|------|------|');
    for (const f of files) {
      lines.push(`| ${f.path} | ${(f.hash || '').slice(0, 8)} |`);
    }
    lines.push('');
  }

  const editors = ctx.editors as Record<string, Record<string, unknown>> | undefined;
  if (editors && Object.keys(editors).length > 0) {
    lines.push('## Editor States');
    lines.push('');
    for (const [component, state] of Object.entries(editors)) {
      lines.push(`### ${component}`);
      if (state.activeFile) lines.push(`- Active file: ${state.activeFile}`);
      if (state.fileCount) lines.push(`- File count: ${state.fileCount}`);
      if (state.mainFile) lines.push(`- Main file: ${state.mainFile}`);
      if (state.documentTitle) lines.push(`- Document: ${state.documentTitle}`);
      if (state.currentPage) lines.push(`- Current page: ${state.currentPage}`);
      if (state.cellCount) lines.push(`- Cell count: ${state.cellCount}`);
      lines.push('');
    }
  }

  const tasks = ctx.tasks as Array<{ title: string; status: string }> | undefined;
  if (tasks && tasks.length > 0) {
    lines.push('## Tasks');
    lines.push('');
    for (const t of tasks) {
      const checkbox = t.status === 'completed' ? '[x]' : t.status === 'running' ? '[-]' : '[ ]';
      const suffix = t.status === 'running' ? ' (in progress)' : '';
      lines.push(`- ${checkbox} ${t.title}${suffix}`);
    }
    lines.push('');
  }

  const messages = ctx.recentMessages as Array<{ role: string; summary: string }> | undefined;
  if (messages && messages.length > 0) {
    lines.push('## Recent Conversation');
    lines.push('');
    for (const m of messages) {
      const role = m.role === 'user' ? 'User' : 'Agent';
      lines.push(`- **${role}:** ${m.summary}`);
    }
    lines.push('');
  }

  const timeline = ctx.timeline as Array<{ component: string; action: string; description: string }> | undefined;
  if (timeline && timeline.length > 0) {
    lines.push('## Recent Activity');
    lines.push('');
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i];
      lines.push(`${i + 1}. [${e.component}] ${e.action}: ${e.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
