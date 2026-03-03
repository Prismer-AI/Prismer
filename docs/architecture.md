# Architecture

## What Is Prismer

Prismer is an open-source, self-hosted academic research workspace. It puts **paper reading, data analysis, LaTeX writing, code execution, and AI agent orchestration** into a single environment that runs entirely inside a Docker container.

A researcher opens a workspace, describes a research task in the chat panel, and an AI agent drives the full workflow — searching arXiv, loading PDFs, writing LaTeX, executing Python, and generating figures — while the researcher reviews and steers.

## System Overview

```
┌─────────────── Host Machine ───────────────────────────────────────────────┐
│                                                                            │
│  ┌──────────────────────────── Next.js Frontend ────────────────────────┐  │
│  │                                                                      │  │
│  │  ┌────────────────┐  ┌──────────────────────────────────────────┐   │  │
│  │  │  Chat Panel     │  │  WindowViewer (tabbed editors)           │   │  │
│  │  │  ┌────────────┐ │  │  ┌────────┬────────┬────────┬────────┐  │   │  │
│  │  │  │ Messages   │ │  │  │  PDF   │ LaTeX  │Jupyter │  Code  │  │   │  │
│  │  │  │ Tasks      │ │  │  │ Reader │ Editor │Notebook│Playgnd │  │   │  │
│  │  │  │ Agent Ctrl │ │  │  ├────────┴────────┴────────┴────────┤  │   │  │
│  │  │  │ Input      │ │  │  │  + AG Grid | Gallery | 3D | Notes │  │   │  │
│  │  │  └────────────┘ │  │  ├───────────────────────────────────┤  │   │  │
│  │  │                 │  │  │  Timeline                          │  │   │  │
│  │  └────────────────┘  └──────────────────────────────────────────┘   │  │
│  │                              │                                      │  │
│  │            API Routes        │   Zustand Stores (7 domain stores)   │  │
│  │      /api/v2/im/bridge/*     │   Directive Queue (EventEmitter)     │  │
│  │      /api/workspace/*        │   SyncMatrixEngine                   │  │
│  │      /api/container/*        │                                      │  │
│  └──────────────────────────────┼──────────────────────────────────────┘  │
│                                 │                                         │
│                    WebSocket + REST (host.docker.internal:16888)           │
│                                 │                                         │
│  ┌──────────────────────────────┼──────────────────────────────────────┐  │
│  │              Docker Container (single, Ubuntu 24.04)                │  │
│  │                              │                                      │  │
│  │  ┌─────────────── Container Gateway (:3000 → host :16888) ──────┐  │  │
│  │  │  Reverse proxy — routes /api/v1/* to internal services        │  │  │
│  │  │  Health aggregation, stats, WebSocket relay                   │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │         │            │            │            │          │         │  │
│  │    ┌────┴───┐  ┌─────┴────┐ ┌─────┴────┐ ┌────┴───┐ ┌───┴───┐    │  │
│  │    │ LaTeX  │  │ Jupyter  │ │ OpenClaw │ │ Prover │ │ arXiv │    │  │
│  │    │ :8080  │  │ :8888    │ │ :18900   │ │ :8081  │ │ :8082 │    │  │
│  │    │        │  │          │ │          │ │        │ │       │    │  │
│  │    │pdflatex│  │ Python/R │ │ Agent    │ │ Coq    │ │ Paper │    │  │
│  │    │xelatex │  │ kernels  │ │ runtime  │ │ Z3     │ │ fetch │    │  │
│  │    │lualatex│  │          │ │ 26 tools │ │ Lean4  │ │       │    │  │
│  │    └────────┘  └──────────┘ └──────────┘ └────────┘ └───────┘    │  │
│  │                                                                    │  │
│  │  /workspace/  — persistent volume for projects, notebooks, output  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

**Stack**: Next.js 16 (App Router, standalone mode), React 19 with React Compiler, TypeScript 5 (strict), Tailwind CSS 4, shadcn/ui (Radix), Zustand 5.

### Pages

The frontend has a single primary route: `/workspace/[workspaceId]`. The root `/` redirects to the default workspace or creates one.

### Workspace Layout

The workspace is a horizontal split-panel containing:

| Panel | Purpose |
|-------|---------|
| **Chat Panel** (left) | User ↔ Agent conversation, task progress, interactive action cards |
| **WindowViewer** (right) | Tabbed editor container with 8 component types + timeline |

### Editor Components

Eight editor types mount inside `WindowViewer`, one active at a time:

| Component | Technology | What It Does |
|-----------|-----------|--------------|
| `pdf-reader` | PDF.js + custom UI | Multi-document view, OCR data, AI chat, annotations |
| `latex-editor` | Monaco Editor + KaTeX | Multi-file LaTeX project, live preview, template library (CVPR, ACL, NeurIPS) |
| `jupyter-notebook` | JupyterLab services | Cell execution against container kernel, plot rendering |
| `code-playground` | WebContainer API | Browser-native Node.js runtime, React/Vue templates, terminal |
| `ai-editor` | AiEditor library | Rich text with AI slash commands (continue, translate, summarize) |
| `ag-grid` | AG Grid | Data tables for CSV/JSON/Parquet analysis results |
| `bento-gallery` | Custom masonry grid | Image gallery for figures and visualizations |
| `three-viewer` | Three.js | 3D model viewer (currently disabled) |

### State Management

Seven independent Zustand stores, composed into a single workspace store:

| Store | Manages |
|-------|---------|
| `chatStore` | Messages, participants, thinking status, tool calls |
| `taskStore` | Current task, subtasks, progress |
| `componentStore` | Active editor, per-component state, diffs |
| `layoutStore` | Panel widths, collapse state, sidebar |
| `timelineStore` | Timeline events, snapshots, replay position |
| `agentInstanceStore` | Agent ID, workspace binding, health, sync session |
| `demoStore` | Demo flow controller |

Each store uses workspace-isolated `localStorage` persistence to prevent cross-workspace leaks.

### API Routes

| Route Group | Purpose |
|-------------|---------|
| `/api/v2/im/bridge/[workspaceId]` | Main chat endpoint — POST user message → forward to container agent via WebSocket; returns directive stream |
| `/api/workspace/[id]/*` | Workspace CRUD, messages, tasks, component states, timeline, files, notes, collection |
| `/api/agents/[id]/*` | Agent lifecycle (start, stop, health, logs), directive queue, artifacts |
| `/api/container/[agentId]/*` | Reverse proxy to container services (gateway, jupyter, latex, exec) |
| `/api/skills/*` | Skill discovery and installation |

### Data Flow: User Message → Agent Action → UI Update

```
1. User types message in Chat Panel
2. POST /api/v2/im/bridge/[workspaceId]
3. → WebSocket to OpenClaw Gateway inside container
4. → Agent processes with LLM + calls workspace tools
5. → Tool writes directive JSON to /workspace/.openclaw/directives/
6. → directiveQueue.enqueue() in Next.js process
7. → useDirectiveStream() hook picks up directive
8. → Zustand store update → component re-renders
   Examples:
     SWITCH_COMPONENT(latex-editor) → WindowViewer switches tab
     UPDATE_NOTES(html) → AiEditor content updates
     COMPILE_COMPLETE(pdf) → PDF viewer loads compiled output
     CELL_RESULT(output) → Jupyter notebook shows execution result
```

## Container Architecture

Everything runs in a **single Docker container** (Ubuntu 24.04, ~14–16 GB).

### Base Image (`prismer-academic:v5.0`)

Built from `docker/base/Dockerfile`:

| Layer | What's Installed |
|-------|-----------------|
| **Build tools** | gcc, cmake, pandoc, ghostscript, poppler, imagemagick |
| **LaTeX** | TeXLive medium (pdflatex, xelatex, lualatex, latexmk, biber) |
| **Python 3.12** | numpy, scipy, pandas, matplotlib, torch (CPU), transformers, spacy, jupyter |
| **R** | r-base, tidyverse, ggplot2, knitr, rmarkdown |
| **Formal methods** | Coq, Z3, Lean 4 |
| **Node.js 22** | npm, pnpm, esbuild |
| **Other** | gnuplot, graphviz, ffmpeg, octave, bibutils |

### OpenClaw Layer (`Dockerfile.openclaw`)

Adds the agent runtime on top of the base image:

- **OpenClaw** agent orchestration framework
- **Plugins**: `prismer-im` (IM channel) + `prismer-workspace` (26 workspace tools)
- **Container Gateway** (`container-gateway.mjs`) — zero-dependency Node.js reverse proxy
- **Workspace templates**: academic-researcher, data-scientist, mathematician, finance-researcher, paper-reviewer, cs-researcher
- **Skills**: academic-jupyter, academic-latex, academic-search, academic-workflow, etc.

### Internal Services

| Service | Port | Description |
|---------|------|-------------|
| Container Gateway | 3000 (→ host 16888) | Unified reverse proxy, health checks, stats |
| LaTeX Server | 8080 | Python HTTP server wrapping pdflatex/xelatex/lualatex |
| Prover Server | 8081 | Coq + Z3 theorem proving service |
| arXiv Server | 8082 | Paper fetching and markdown conversion |
| Jupyter Server | 8888 | Python/R notebook kernel |
| OpenClaw Gateway | 18900 (loopback only) | Agent runtime, WebSocket API |

Only port 3000 is exposed externally. The Container Gateway routes requests to internal services via path prefix (`/api/v1/latex/*` → `:8080`, etc.).

### Agent System

The agent runs inside OpenClaw with the following configuration:

**Persona files** (in `docker/config/workspace/`):
- `SOUL.md` — Identity, values, and behavioral guidelines
- `AGENTS.md` — Tool usage instructions (always prefer workspace tools over file I/O)
- `IDENTITY.md` — Per-template persona (name, expertise, personality)
- `TOOLS.md` — Reference of all 40+ available tools

**Workspace Plugin** (`prismer-workspace` v0.5.0) — 26 tools:

| Category | Tools |
|----------|-------|
| LaTeX | `latex_project` (CRUD), `latex_project_compile` |
| Jupyter | `jupyter_execute`, `jupyter_notebook`, `update_notebook` |
| PDF | `load_pdf`, `navigate_pdf`, `get_paper_context` |
| Notes | `update_notes` |
| Data | `data_list`, `data_load`, `data_query`, `data_save` |
| Code | `code_execute`, `update_code` |
| Gallery | `update_gallery` |
| Research | `arxiv_to_prompt`, `context_search`, `context_load` |
| UI Control | `switch_component`, `send_ui_directive` |
| Workspace | `get_workspace_state`, `sync_files_to_workspace` |

Content-producing tools automatically emit `SWITCH_COMPONENT` + content directives, so the agent does not need to explicitly switch tabs.

## Sync Infrastructure

The `SyncMatrixEngine` (`web/src/lib/sync/`) defines rules-based data sync:

- **Who** can access **what** data in **what** direction (read/write/bidirectional)
- Per-endpoint filtering (desktop, mobile, agent, monitor)
- Field-level sync config per component type
- Conflict resolution strategies (server_wins, latest_wins, merge)

Transport uses WebSocket with reconnection, deduplication, and throttling.

## Database

Prisma 6 with SQLite (development) or MySQL (production). 37 models across:

| Domain | Key Models |
|--------|-----------|
| Auth | User, Account, Session (NextAuth-compatible) |
| Papers | Paper, OcrTask, Figure |
| Workspace | WorkspaceSession, Message, Task, Timeline, ComponentState, Snapshot, File |
| Agent | AgentInstance, AgentConfig, Container, ConfigDeployment |
| IM | IMUser, IMConversation, IMMessage, IMParticipant |

## Deployment Options

### Docker Compose Profiles

| Profile | File | Use Case |
|---------|------|----------|
| **Dev** | `docker-compose.dev.yml` | Local development, connects to host Next.js |
| **Production** | `docker-compose.openclaw.yml` | Standalone deployment with full agent stack |
| **Lite** | `docker-compose.lite.yml` | Lightweight (~4 GB), fast build (<20 min) |

All profiles map to host port **16888** → container port **3000**.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | LLM provider authentication |
| `AGENT_DEFAULT_MODEL` | Default model (e.g., `gpt-4o`, `claude-sonnet-4`) |
| `DATABASE_URL` | SQLite or MySQL connection string |
| `PRISMER_API_BASE_URL` | Next.js frontend URL (for container → host communication) |
| `OPENCLAW_GATEWAY_TOKEN` | Agent WebSocket authentication |
| `LOCAL_MODE` | Enable lightweight mode (skip cloud features) |

## Design Principles

### 1. Single-Container Simplicity

All services (LaTeX, Jupyter, Coq, Agent) run in one container. No microservice orchestration required. Researchers run `docker compose up` and have a complete environment.

### 2. Directive Protocol

Agent actions are decoupled from the frontend via a directive protocol. The agent writes structured JSON directives; the frontend interprets them. This means:
- Agent implementation can change without frontend changes
- Multiple frontends (web, mobile via Tauri) can consume the same directive stream
- Directives are auditable and replayable

### 3. Workspace Isolation

Each workspace is a self-contained research session with its own:
- Chat history and agent instance
- Component states (persisted per-workspace in localStorage + database)
- File system (`/workspace/` volume in container)
- Timeline of events

### 4. Composition Over Monolith

State management uses 7 independent Zustand stores composed together, rather than one giant store. Each store can be tested, replaced, or extended independently.

### 5. Citation Verification

Every reference passes through verification before appearing in output:

```
Citation → CrossRef → Semantic Scholar → arXiv → ✓ Verified
```

## SDK

Three official SDKs under `sdk/` (all MIT-licensed, usable independently):

| SDK | Package | Features |
|-----|---------|----------|
| TypeScript | `@prismer/sdk` | Context API, Parse API, IM API, Realtime (WS + SSE), Webhooks, CLI |
| Python | `prismer` | Sync + Async clients, batch processing, Pydantic models |
| Go | `prismer-sdk-go` | Functional options pattern, Go 1.21+ |
