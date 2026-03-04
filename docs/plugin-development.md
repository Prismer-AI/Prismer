# Prismer Extension Development Guide

This guide explains how to extend Prismer.AI with new agent behaviors and new workspace tooling. There are two independent extension points, and you may use one or both depending on what you want to build.

- **Agent Templates** (`docker/templates/`) define who the agent is -- its persona, expertise, communication style, and the skill guides it follows. Templates are plain Markdown files; no code is required.
- **OpenClaw Plugins** (`docker/plugin/`) extend what the agent can do -- they register executable tools with the OpenClaw runtime. Plugins are TypeScript packages compiled to CommonJS.

The two systems compose: a template describes *when and how* to use a tool, and a plugin provides the tool's implementation.

---

## 1. Overview of the Extension System

### How an agent starts

When a workspace session begins, the backend writes `openclaw.json` into the container and starts the OpenClaw process. OpenClaw loads:

1. Plugins listed in `openclaw.json -> plugins`, instantiating each via its exported `register()` function.
2. The agent's system prompt, assembled from the config directory (`docker/config/workspace/`): `SOUL.md`, `TOOLS.md`, `AGENTS.md`, and skill manifests.
3. Agent template files mounted into the container (`IDENTITY.md`, `MEMORY.md`, template-level skill manifests).

### Directive pipeline

```
Agent tool call
  -> plugin executeTool()
  -> POST ${apiBaseUrl}/api/agents/${agentId}/directive
  -> in-memory queue (Next.js)
  -> GET /api/agents/:id/directive/stream  (SSE)
  -> useDirectiveStream hook (React)
  -> executeDirective()
  -> componentStore update + CustomEvent
  -> Editor component re-renders
```

Understanding this pipeline matters when you write a plugin that needs to update the UI. Tools that only call external APIs and return data to the agent do not need to touch this pipeline.

### Container internal services

Plugins running inside the container can reach internal services via the Container Gateway (port 3000, exposed as 16888 on the host):

| Route | Backend | Port |
|-------|---------|------|
| `/api/v1/latex/*` | LaTeX server | 8080 |
| `/api/v1/jupyter/*` | Jupyter kernel | 8888 |
| `/api/v1/prover/*` | Coq + Z3 | 8081 |
| `/api/v1/arxiv/*` | arxiv-to-prompt | 8082 |

---

## 2. Creating a New Agent Template

An agent template lives under `docker/templates/<template-id>/`:

```
docker/templates/<template-id>/
  IDENTITY.md        # Who the agent is
  MEMORY.md          # Blank memory scaffold (filled at runtime)
  skills/            # Skill guides for this template
    <skill-id>/
      SKILL.md       # When and how to use a set of tools
```

None of these files contain executable code. They are Markdown injected into the agent's system prompt.

### 2.1 IDENTITY.md

Defines the agent's persona. Required sections:

| Section | Purpose |
|---------|---------|
| Basic Info | Machine-readable name, role, and template ID |
| Persona | Free-form character description |
| Personality | Core traits, communication style, working approach |
| Expertise Areas | Primary competencies and technical skills |
| First Interaction | Greeting the agent uses with new users |

Example:

```markdown
# IDENTITY

## Basic Info
- **Name**: Darwin
- **Role**: Computational Biology Research Partner
- **Template**: computational-biologist

## Persona
I am Darwin, a computational biology assistant. I combine deep knowledge of
molecular biology with practical programming skills in R, Python, and
bioinformatics pipelines.

## Personality
### Core Traits
- Systematic in experimental design
- Careful to distinguish correlation from causation
### Communication Style
- Use standard bioinformatics terminology
- Always pair computational results with biological interpretation

## Expertise Areas
### Primary Competencies
- RNA-seq differential expression analysis
- Genome assembly and annotation
- Single-cell transcriptomics (scRNA-seq)
### Technical Skills
- Python (Biopython, scanpy, anndata)
- R (Bioconductor, DESeq2, edgeR, Seurat)

## First Interaction
"I'm Darwin, your computational biology research partner. Tell me about your
organism, data type, and research question and we'll get started."
```

See `docker/templates/mathematician/IDENTITY.md` and `docker/templates/academic-researcher/IDENTITY.md` for production examples.

### 2.2 MEMORY.md

Provides the initial scaffold that the agent populates as it learns about the user. Keep it blank with labeled placeholders:

```markdown
# MEMORY

## User Profile
| Field | Value |
|-------|-------|
| Name | (To be filled) |
| Institution | (To be filled) |
| Research Field | (To be filled) |

## Active Projects
| Project | Status | Last Updated |
|---------|--------|--------------|
| (No active projects) | - | - |

## Workflow Preferences
- Pipeline Tool: (TBD)
- Reference Genome: (TBD)
```

### 2.3 Skill Guides

A skill guide tells the agent *when* to use a set of tools and *how* to structure its invocations. Each skill is a single `SKILL.md` file:

```
docker/templates/<template-id>/skills/<skill-id>/SKILL.md
```

YAML frontmatter is required:

```markdown
---
name: rna-seq-analysis
description: Differential expression analysis workflow using DESeq2 and edgeR
---

# RNA-seq Analysis Skill

## Tools Used
- `jupyter_execute` - Run R or Python analysis code
- `update_gallery` - Display volcano plots and heatmaps
- `data_load` - Load count matrices into the data grid

## Usage Patterns

### Differential Expression from Count Matrix
When user says: "Run DE analysis between treated and control"
1. Call `jupyter_execute` with DESeq2 R code
2. Call `update_gallery` with volcano plot path
3. Call `data_load` with results table
4. Call `update_notes` with interpretation summary
```

See `docker/templates/academic-researcher/skills/latex-writing/SKILL.md` for a complete production example.

### 2.4 Base system prompt files

Every agent receives these files from `docker/config/workspace/` regardless of template:

| File | Purpose |
|------|---------|
| `SOUL.md` | Core principles: accuracy, ethics, communication style |
| `TOOLS.md` | Full list of all available workspace tools with parameters |
| `AGENTS.md` | Behavioral rules, data analysis workflow, memory instructions |

Your template files are injected after these base files.

---

## 3. Creating a New OpenClaw Plugin

A plugin is a TypeScript package that registers tools with the OpenClaw runtime. Reference implementation: `docker/plugin/prismer-workspace/`.

```
docker/plugin/<plugin-id>/
  openclaw.plugin.json   # Plugin manifest
  index.ts               # Entry point (exports plugin with register())
  package.json
  tsconfig.json
  src/
    tools.ts             # Tool definitions and implementations
    types.ts             # TypeScript types
  skills/                # Optional: plugin-bundled skill registrations
    <skill-id>/
      index.ts
      manifest.json
      SKILL.md
```

### 3.1 openclaw.plugin.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Short description of what this plugin provides",
  "skills": ["skills"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "apiBaseUrl": {
        "type": "string",
        "description": "Next.js API base URL for directive delivery"
      },
      "agentId": {
        "type": "string",
        "description": "Agent instance ID"
      }
    }
  }
}
```

Always use `"additionalProperties": false` in `configSchema`.

### 3.2 Tool definitions (src/tools.ts)

```typescript
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<ToolResult>;
}

let config: MyPluginConfig;

export function setConfig(c: MyPluginConfig): void {
  config = c;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'fetch_sequence',
    description: 'Fetch a sequence from NCBI by accession number',
    parameters: {
      type: 'object',
      required: ['accession'],
      properties: {
        accession: { type: 'string', description: 'NCBI accession number' },
        database: { type: 'string', enum: ['nucleotide', 'protein'] },
      },
    },
    handler: async (params) => {
      const accession = params.accession as string;
      const database = (params.database as string) ?? 'nucleotide';
      try {
        const response = await fetch(
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=${database}&id=${accession}&rettype=fasta&retmode=text`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (!response.ok) {
          return { success: false, error: `NCBI returned HTTP ${response.status}` };
        }
        const fasta = await response.text();
        return { success: true, data: { accession, database, fasta } };
      } catch (err) {
        return { success: false, error: `Failed to fetch: ${err}` };
      }
    },
  },
];

export async function executeTool(
  name: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const def = toolDefinitions.find((t) => t.name === name);
  if (!def) return { success: false, error: `Unknown tool: ${name}` };
  return def.handler(params);
}
```

Rules:
- Never throw from a handler. Always return `{ success: false, error: string }`.
- Use `AbortSignal.timeout()` on every `fetch()` call.

### 3.3 Sending UI directives

If your tool needs to update the frontend:

```typescript
async function sendUIDirective(
  apiBaseUrl: string,
  agentId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/agents/${agentId}/directive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Directive POST failed: ${response.status}`);
}
```

Common directive types (see `docker/config/workspace/TOOLS.md` for the full list):

| Directive | Payload |
|-----------|---------|
| `SWITCH_COMPONENT` | `component` (string) |
| `UPDATE_LATEX` | `file`, `content` |
| `UPDATE_NOTES` | `content` (HTML) |
| `UPDATE_NOTEBOOK` | `cells`, `execute` |
| `GRID_LOAD_DATA` | `columns`, `rows` |

Valid component names: `pdf-reader`, `latex-editor`, `jupyter-notebook`, `code-playground`, `ai-editor`, `ag-grid`, `bento-gallery`, `three-viewer`

### 3.4 Plugin entry point (index.ts)

```typescript
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { setConfig, toolDefinitions, executeTool } from './src/tools.js';

const plugin = {
  id: 'my-plugin',
  name: 'My Plugin',

  register(api: OpenClawPluginApi): void {
    const raw = (api.pluginConfig ?? {}) as Record<string, unknown>;
    setConfig({
      apiBaseUrl: (raw.apiBaseUrl as string) || 'http://host.docker.internal:3000',
      agentId: (raw.agentId as string) || api.id || 'default',
    });

    for (const toolDef of toolDefinitions) {
      api.registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        async execute(_id: string, params: Record<string, unknown>) {
          const result = await executeTool(toolDef.name, params);
          const text = result.success
            ? JSON.stringify(result.data ?? { ok: true })
            : JSON.stringify({ error: result.error });
          return { content: [{ type: 'text' as const, text }] };
        },
      });
    }

    api.logger?.info(
      `[my-plugin] Registered ${toolDefinitions.length} tools`,
    );
  },
};

export default plugin;
```

### 3.5 package.json and tsconfig.json

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": { "build": "tsc" },
  "peerDependencies": { "openclaw": "*" },
  "devDependencies": { "typescript": "^5.0.0" }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["index.ts", "src/**/*.ts", "skills/**/*.ts"]
}
```

---

## 4. Testing Your Extension Locally

### Agent templates

Use the dev compose file:

```bash
# Terminal 1: agent container
docker compose -f docker/docker-compose.dev.yml up

# Terminal 2: frontend
cd web && npm run dev
```

Set `STATIC_AGENT_TEMPLATE=<your-template-id>` in `web/.env`.

Verify:
1. Agent introduces itself with the correct name and role from `IDENTITY.md`
2. Domain-specific requests trigger the right tools (not just text replies)
3. User preferences get written to `MEMORY.md`

### Plugins

```bash
cd docker/plugin/my-plugin
npm run build

docker compose -f docker/docker-compose.dev.yml build
docker compose -f docker/docker-compose.dev.yml up
```

Check container logs for `[my-plugin] Registered N tools`.

### Test layers

| Layer | Coverage | Command |
|-------|----------|---------|
| Unit | Plugin handlers in isolation | `npm test` in plugin dir |
| L1 | Container API integration | `npm run test:layer1` in `web/` |
| L2 | Frontend directive rendering (mocked agent) | `npm run test:layer2` in `web/` |
| L3 | Full E2E, real agent | `npm run test:layer3` in `web/` |

---

## 5. Contributing Your Extension

### Checklist

For agent templates:

- [ ] `IDENTITY.md` has all required sections
- [ ] Template directory name matches the `Template` field in Basic Info
- [ ] `MEMORY.md` uses blank placeholder format
- [ ] Skill guides have YAML frontmatter with `name` and `description`
- [ ] Tested locally with dev compose stack

For plugins:

- [ ] `openclaw.plugin.json` has `"additionalProperties": false`
- [ ] Plugin `id` matches directory name
- [ ] All tools return `{ content: [{ type: 'text', text }] }` from `execute()`
- [ ] Error paths return `{ error: string }` (no thrown exceptions)
- [ ] Every `fetch()` has `AbortSignal.timeout()`
- [ ] `npm run build` succeeds with zero errors

### Reference files

| What | Location |
|------|----------|
| Skill plugin reference | `docker/plugin/prismer-workspace/` |
| Channel plugin reference | `docker/plugin/prismer-im/` |
| Domain specialist template | `docker/templates/mathematician/` |
| Generalist template | `docker/templates/academic-researcher/` |
| Skill guide example | `docker/templates/academic-researcher/skills/latex-writing/SKILL.md` |
| Tool and directive reference | `docker/config/workspace/TOOLS.md` |
| Base behavioral rules | `docker/config/workspace/SOUL.md` and `AGENTS.md` |
