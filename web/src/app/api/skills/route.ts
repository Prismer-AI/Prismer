/**
 * Skills API - List and Search Skills
 *
 * GET /api/skills - List available skills (local + cloud catalog)
 * GET /api/skills?q=search - Search skills by query
 * GET /api/skills?category=latex - Filter by category
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// Types
// ============================================================

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  author?: string;
  repository?: string;
  tools: SkillTool[];
  dependencies: string[];
  builtin?: boolean;
}

export interface SkillTool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

export type SkillCategory =
  | 'latex'
  | 'jupyter'
  | 'pdf'
  | 'citation'
  | 'data'
  | 'writing'
  | 'general';

export interface SkillSearchResult {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  version: string;
  installed: boolean;
  builtin: boolean;
  tools: string[];
}

// ============================================================
// Built-in Skills Catalog
// ============================================================

const BUILTIN_SKILLS: SkillManifest[] = [
  {
    id: 'prismer-workspace',
    name: 'Prismer Workspace',
    version: '1.0.0',
    description:
      'Core academic workspace tools including LaTeX compilation, Jupyter execution, PDF processing, and UI control',
    category: 'general',
    author: 'Prismer Team',
    builtin: true,
    tools: [
      { name: 'latex_compile', description: 'Compile LaTeX document to PDF', parameters: {} },
      { name: 'latex_preview', description: 'Preview LaTeX output', parameters: {} },
      { name: 'jupyter_execute', description: 'Execute Jupyter notebook cell', parameters: {} },
      { name: 'jupyter_create_cell', description: 'Create new Jupyter cell', parameters: {} },
      { name: 'pdf_extract_text', description: 'Extract text from PDF document', parameters: {} },
      { name: 'pdf_get_sections', description: 'Get PDF document sections', parameters: {} },
      { name: 'ui_show_component', description: 'Show UI component in workspace', parameters: {} },
      { name: 'ui_send_directive', description: 'Send UI directive to frontend', parameters: {} },
      { name: 'arxiv_to_prompt', description: 'Convert arXiv paper to LLM prompt', parameters: {} },
    ],
    dependencies: [],
  },
  {
    id: 'find-skills',
    name: 'Find Skills',
    version: '1.0.0',
    description: 'Discover and manage skills for Prismer.AI workspace',
    category: 'general',
    author: 'Prismer Team',
    builtin: true,
    tools: [
      { name: 'skill_search', description: 'Search for skills', parameters: {} },
      { name: 'skill_info', description: 'Get skill details', parameters: {} },
      { name: 'skill_install', description: 'Install a skill', parameters: {} },
      { name: 'skill_list', description: 'List installed skills', parameters: {} },
      { name: 'skill_uninstall', description: 'Uninstall a skill', parameters: {} },
      { name: 'skill_update', description: 'Update skills', parameters: {} },
    ],
    dependencies: [],
  },
];

// Cloud skills catalog (in production, fetched from registry)
const CLOUD_SKILLS_CATALOG: SkillManifest[] = [
  {
    id: 'latex-cite',
    name: 'LaTeX Citation Manager',
    version: '1.2.0',
    description:
      'Manage citations and bibliography in LaTeX documents. Supports BibTeX, BibLaTeX, and natbib.',
    category: 'citation',
    author: 'Prismer Community',
    repository: 'https://github.com/prismer/skill-latex-cite',
    tools: [
      { name: 'cite_search', description: 'Search for citations in databases', parameters: {} },
      { name: 'cite_format', description: 'Format citation in various styles', parameters: {} },
      { name: 'bib_manage', description: 'Manage bibliography entries', parameters: {} },
    ],
    dependencies: ['prismer-workspace'],
  },
  {
    id: 'bib-sync',
    name: 'Bibliography Sync',
    version: '1.0.0',
    description: 'Sync bibliography with Zotero, Mendeley, or EndNote.',
    category: 'citation',
    author: 'Prismer Community',
    tools: [
      { name: 'bib_connect', description: 'Connect to reference manager', parameters: {} },
      { name: 'bib_sync', description: 'Sync bibliography', parameters: {} },
      { name: 'bib_import', description: 'Import references', parameters: {} },
    ],
    dependencies: ['prismer-workspace'],
  },
  {
    id: 'stats-helper',
    name: 'Statistics Helper',
    version: '2.0.0',
    description:
      'Statistical analysis assistance for academic research. Suggests appropriate tests and interprets results.',
    category: 'data',
    author: 'Prismer Community',
    tools: [
      { name: 'stats_suggest', description: 'Suggest statistical test', parameters: {} },
      { name: 'stats_interpret', description: 'Interpret statistical results', parameters: {} },
      { name: 'stats_visualize', description: 'Create statistical visualization', parameters: {} },
    ],
    dependencies: ['prismer-workspace'],
  },
  {
    id: 'method-gen',
    name: 'Methodology Generator',
    version: '1.1.0',
    description:
      'Generate methodology sections for academic papers based on research design.',
    category: 'writing',
    author: 'Prismer Community',
    tools: [
      { name: 'method_outline', description: 'Generate methodology outline', parameters: {} },
      { name: 'method_draft', description: 'Draft methodology section', parameters: {} },
    ],
    dependencies: ['prismer-workspace'],
  },
  {
    id: 'figure-export',
    name: 'Figure Export',
    version: '1.0.0',
    description:
      'Export figures from PDFs and Jupyter notebooks in publication-ready formats.',
    category: 'pdf',
    author: 'Prismer Community',
    tools: [
      { name: 'figure_extract', description: 'Extract figure from document', parameters: {} },
      { name: 'figure_convert', description: 'Convert figure format', parameters: {} },
      { name: 'figure_optimize', description: 'Optimize for publication', parameters: {} },
    ],
    dependencies: ['prismer-workspace'],
  },
  {
    id: 'table-formatter',
    name: 'Table Formatter',
    version: '1.0.0',
    description: 'Format data tables for LaTeX, Markdown, or HTML output.',
    category: 'latex',
    author: 'Prismer Community',
    tools: [
      { name: 'table_format', description: 'Format table', parameters: {} },
      { name: 'table_convert', description: 'Convert table between formats', parameters: {} },
    ],
    dependencies: ['prismer-workspace'],
  },
  {
    id: 'equation-helper',
    name: 'Equation Helper',
    version: '1.0.0',
    description: 'Help write and format mathematical equations in LaTeX.',
    category: 'latex',
    author: 'Prismer Community',
    tools: [
      { name: 'eq_format', description: 'Format equation', parameters: {} },
      { name: 'eq_convert', description: 'Convert equation notation', parameters: {} },
      { name: 'eq_number', description: 'Number equations', parameters: {} },
    ],
    dependencies: ['prismer-workspace'],
  },
  {
    id: 'data-loader',
    name: 'Data Loader',
    version: '1.0.0',
    description: 'Load and preview various data formats in Jupyter notebooks.',
    category: 'jupyter',
    author: 'Prismer Community',
    tools: [
      { name: 'data_load', description: 'Load data file', parameters: {} },
      { name: 'data_preview', description: 'Preview data structure', parameters: {} },
      { name: 'data_convert', description: 'Convert data format', parameters: {} },
    ],
    dependencies: ['prismer-workspace'],
  },
];

// ============================================================
// Remote Registry (with cache)
// ============================================================

let _cachedRemoteSkills: SkillManifest[] | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCloudSkills(): Promise<SkillManifest[]> {
  // Return cached if fresh
  if (_cachedRemoteSkills && Date.now() - _cacheTimestamp < CACHE_TTL) {
    return _cachedRemoteSkills;
  }

  const registryUrl = process.env.SKILL_REGISTRY_URL;
  if (registryUrl) {
    try {
      const res = await fetch(registryUrl, {
        signal: AbortSignal.timeout(3000),
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const skills = (data.skills || data.data?.skills || []) as SkillManifest[];
        if (skills.length > 0) {
          _cachedRemoteSkills = skills;
          _cacheTimestamp = Date.now();
          return skills;
        }
      }
    } catch {
      // Remote registry unavailable — use hardcoded fallback
    }
  }

  return CLOUD_SKILLS_CATALOG;
}

// ============================================================
// API Handler
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query =
      searchParams.get('q') ||
      searchParams.get('query') ||
      searchParams.get('search');
    const category = searchParams.get('category') as SkillCategory | null;
    const installedOnly = searchParams.get('installed') === 'true';
    const agentIdParam = searchParams.get('agentId');
    const workspaceIdParam = searchParams.get('workspaceId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Resolve installed skill IDs for this agent (agentId or workspaceId)
    let installedIds = new Set<string>();
    if (agentIdParam || workspaceIdParam) {
      const prisma = (await import('@/lib/prisma')).default;
      const agent = agentIdParam
        ? await prisma.agentInstance.findUnique({
            where: { id: agentIdParam },
            select: { installedSkills: true },
          })
        : await prisma.agentInstance.findFirst({
            where: { workspaceId: workspaceIdParam! },
            select: { installedSkills: true },
          });
      if (agent?.installedSkills) {
        try {
          const list = JSON.parse(agent.installedSkills as string) as Array<{ id: string }>;
          list.forEach((s) => installedIds.add(s.id));
        } catch {
          // ignore parse error
        }
      }
      BUILTIN_SKILLS.forEach((s) => installedIds.add(s.id));
    }

    const hasAgentContext = Boolean(agentIdParam || workspaceIdParam);

    // Get all skills (builtin + cloud catalog with remote registry support)
    const cloudSkills = await getCloudSkills();
    let allSkills: SkillManifest[] = [...BUILTIN_SKILLS, ...cloudSkills];

    // Filter by query
    if (query) {
      const q = query.toLowerCase();
      allSkills = allSkills.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tools.some((t) => t.name.toLowerCase().includes(q))
      );
    }

    // Filter by category
    if (category) {
      allSkills = allSkills.filter((s) => s.category === category);
    }

    // Filter installed only (for now, only builtin are "installed")
    if (installedOnly) {
      allSkills = allSkills.filter((s) => s.builtin);
    }

    // Convert to search results (use agent's installed list when agentId/workspaceId provided)
    const results: SkillSearchResult[] = allSkills.slice(0, limit).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      version: s.version,
      installed: hasAgentContext ? installedIds.has(s.id) : (s.builtin || false),
      builtin: s.builtin || false,
      tools: s.tools.map((t) => t.name),
    }));

    return NextResponse.json({
      success: true,
      data: {
        skills: results,
        total: results.length,
        categories: ['latex', 'jupyter', 'pdf', 'citation', 'data', 'writing', 'general'],
      },
    });
  } catch (error) {
    console.error('[API] /api/skills error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch skills' },
      { status: 500 }
    );
  }
}
