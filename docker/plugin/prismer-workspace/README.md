# @prismer/openclaw-workspace

> OpenClaw Skill Plugin for Prismer.AI Academic Workspace

**Version:** 0.5.0
**Package:** `@prismer/openclaw-workspace`
**Type:** OpenClaw Skill Plugin
**SSoT:** `docker/plugin/prismer-workspace/version.ts`

## Overview

Provides 26 workspace tools that the OpenClaw agent can invoke to control academic research operations. Tools are registered via the `registerTool()` API and organized into 6 categories: content update, execution, data, UI control, workspace context, and academic.

## Tool Categories

### Content Update Tools (7)

| Tool | Target Component | Directive(s) | Description |
|------|-----------------|-------------|-------------|
| `update_latex` | latex-editor | SWITCH + UPDATE_LATEX | Update LaTeX editor content |
| `update_notes` | ai-editor | SWITCH + UPDATE_NOTES | Update Notes editor (HTML) |
| `update_notebook` | jupyter-notebook | SWITCH + UPDATE_NOTEBOOK | Update Jupyter cells |
| `update_gallery` | bento-gallery | SWITCH + UPDATE_GALLERY | Update image gallery |
| `update_code` | code-playground | SWITCH + UPDATE_CODE | Update code playground |
| `save_artifact` | — | API-only | Save artifact to collection |
| `load_pdf` | pdf-reader | SWITCH + PDF_LOAD | Load PDF document |

### Execution Tools (4)

| Tool | Target Component | Directive(s) | Description |
|------|-----------------|-------------|-------------|
| `latex_compile` | latex-editor | SWITCH + COMPILE_COMPLETE | Compile LaTeX to PDF |
| `jupyter_execute` | jupyter-notebook | SWITCH + CELL_RESULT | Execute Python code |
| `code_execute` | code-playground | SWITCH + CODE_RESULT | Execute code in playground |
| `latex_project_compile` | latex-editor | SWITCH + COMPILE_COMPLETE | Compile multi-file LaTeX project |

### Data Tools (4)

| Tool | Target Component | Directive(s) | Description |
|------|-----------------|-------------|-------------|
| `data_list` | ag-grid | — | List data files in workspace |
| `data_load` | ag-grid | SWITCH + UPDATE_DATA_GRID | Load CSV/JSON into grid |
| `data_query` | ag-grid | UPDATE_DATA_GRID | Filter/query loaded data |
| `data_save` | — | API-only | Save data to workspace |

### UI Control Tools (3)

| Tool | Target Component | Directive(s) | Description |
|------|-----------------|-------------|-------------|
| `switch_component` | any | SWITCH_COMPONENT | Switch active workspace tab |
| `send_ui_directive` | any | pass-through | Send raw UI directive |
| `navigate_pdf` | pdf-reader | PDF_NAVIGATE | Navigate PDF to page |

### Workspace Context Tools (5)

| Tool | Target Component | Directive(s) | Description |
|------|-----------------|-------------|-------------|
| `get_workspace_state` | — | API-only | Get workspace state (files, editors, tasks) |
| `sync_files_to_workspace` | — | API-only | Sync container files to frontend |
| `context_search` | — | API-only | Search workspace context |
| `context_load` | — | API-only | Load workspace context |
| `get_paper_context` | — | API-only | Get paper context for LLM |

### Academic Tools (3)

| Tool | Target Component | Directive(s) | Description |
|------|-----------------|-------------|-------------|
| `arxiv_to_prompt` | — | API-only | Convert arXiv paper to LLM text |
| `jupyter_notebook` | jupyter-notebook | API-only | CRUD for notebook files |
| `latex_project` | latex-editor | — | LaTeX project file management |

### Component Targets for `switch_component`

`pdf-reader` | `latex-editor` | `jupyter-notebook` | `code-playground` | `ai-editor` | `ag-grid` | `bento-gallery` | `three-viewer`

## Directive Pipeline

Tools auto-trigger UI directives as side-effects:

```
Tool invocation → sendUIDirective()
  → POST ${apiBaseUrl}/api/agents/${agentId}/directive
  → in-memory queue on Next.js backend
  → SSE /api/agents/:id/directive/stream
  → useDirectiveStream hook → mapPluginDirective()
  → executeDirective() → componentStore + CustomEvent
  → Editor component renders
```

10 of the 14 base tools auto-trigger `SWITCH_COMPONENT` + content directive — the agent doesn't need to call `switch_component` explicitly.

## API Routing

Tools call container-internal services via the Container Gateway (`container-gateway.mjs`):

```
Tool → HTTP → container-gateway.mjs (:3000)
                  ├── /api/v1/latex/*    → :8080 (TeXLive)
                  ├── /api/v1/jupyter/*  → :8888 (Jupyter)
                  ├── /api/v1/prover/*   → :8081 (Coq + Z3)
                  └── /api/v1/arxiv/*    → :8082 (arxiv-to-prompt)
```

External calls (directive delivery, workspace context):

```
Tool → HTTP → ${apiBaseUrl}/api/agents/${agentId}/directive
Tool → HTTP → ${apiBaseUrl}/api/workspace/${workspaceId}/context
Tool → HTTP → ${apiBaseUrl}/api/workspace/${workspaceId}/files/sync-to-container
```

## Builtin Skill: find-skills

Location: `skills/find-skills/`

A builtin skill registry for discovering and managing workspace skills:

| Tool | Description |
|------|-------------|
| `skill_search` | Search skills by query/category |
| `skill_info` | Get detailed skill manifest |
| `skill_install` | Install skill to workspace |
| `skill_list` | List installed skills |
| `skill_uninstall` | Remove skill |
| `skill_update` | Update skills to latest |

### Skill Categories

`latex` | `jupyter` | `pdf` | `citation` | `data` | `writing` | `general`

### Skill Registry Paths

- Local workspace: `/workspace/skills/<skill-id>/manifest.json`
- Builtin: `/home/user/.openclaw/workspace/skills/`
- Cloud (future): Set `PRISMER_SKILL_REGISTRY_URL` env var

## Source Files

| File | Purpose |
|------|---------|
| `index.ts` | Plugin registration |
| `version.ts` | Version SSoT (0.5.0) |
| `src/tools.ts` | 26 tool implementations via `registerTool()` API |
| `src/types.ts` | Tool parameter and result types |
| `src/skill.ts` | Skill definition and lifecycle |
| `openclaw.plugin.json` | Plugin manifest + configSchema |
| `skills/find-skills/index.ts` | Skill registry (search, install, CRUD) |
| `skills/find-skills/manifest.json` | Skill metadata and tool definitions |

## Configuration

`openclaw.plugin.json` configSchema (`additionalProperties: false`):

```json
{
  "apiBaseUrl": "http://host.docker.internal:3000",
  "agentId": "<agent-instance-id>",
  "workspaceId": "<workspace-session-id>"
}
```

These are set by the backend at container startup via `buildOpenClawConfig()` in `src/app/api/agents/[id]/start/route.ts`.

## Build

```bash
cd docker/plugin/prismer-workspace
npm run build    # → dist/
```

## Dependencies

- `openclaw` (peer) — OpenClaw runtime

## Test Coverage

See `docs/WINDOWVIEW_CONVERGENCE.md` §7 for the 4-layer test system:

| Layer | Coverage | Description |
|-------|---------|-------------|
| Unit | 0/26 tools | Plugin has no unit tests (P0 gap) |
| L1 | 7/14 base tools | Container API integration (21 tests) |
| L2 | 7/8 components | Frontend directive rendering (32 tests) |
| L3 | 4 MVP scenarios | Real agent E2E (6 tests) |

## Changelog

### 0.5.0 (2026-02-26)
- **Major rewrite** with `registerTool()` API
- Added 12 tools: `data_list`, `data_load`, `data_query`, `data_save`, `latex_project`, `latex_project_compile`, `get_paper_context`, `navigate_pdf`, `context_search`, `context_load`, `get_workspace_state`, `sync_files_to_workspace`
- Added `workspaceId` to `openclaw.plugin.json` configSchema (fixes container crash)
- Total: 26 tools

### 0.4.0 (2026-02-26)
- Added `code_execute`, `update_code` (code playground integration)
- Total: 14 tools

### 0.3.0 (2026-02-25)
- Added `save_artifact`, `update_gallery`
- Workspace-aware LaTeX compilation
- Total: 12 tools

### 0.2.0 (2026-02-24)
- Added `update_notes`, `update_latex`, `update_notebook`
- Fixed `registerTool` API compatibility
- Total: 10 tools

### 0.1.0 (2026-02-16)
- Initial release with 7 workspace tools
- find-skills builtin skill with 6 registry tools
- Container Gateway API routing integration
