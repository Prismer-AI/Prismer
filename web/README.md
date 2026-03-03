<p align="center">
  <img src="public/prismerlogo.jpeg" alt="Prismer.AI" width="120" />
</p>

<h1 align="center">Prismer.AI</h1>

<p align="center">
  <strong>The Open Academic Research Operating System</strong>
</p>

<p align="center">
  <em>Discover → Read → Analyze → Write → Review — all in one workspace</em>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#container-agent">Container Agent</a> •
  <a href="#open-source-plan">Open Source</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Features

Prismer.AI covers the full academic research lifecycle with an AI-native workspace:

| Module | Description |
|--------|-------------|
| **Paper Discovery** | arXiv, Semantic Scholar, Google Scholar integration with reading history |
| **PDF Reader** | Multi-document tabs, OCR data integration, paper context provider, AI chat |
| **Jupyter Notebook** | Python/R kernel, cell execution, matplotlib/plotly rendering, artifacts panel |
| **LaTeX Editor** | Multi-file project support, live KaTeX preview, template library (IEEE/ACM/Nature), server-side compilation |
| **Code Playground** | WebContainer-based Node.js runtime, multi-file editor, integrated terminal |
| **Data Grid** | AG Grid integration for CSV/JSON/Excel data exploration and analysis |
| **Notes Editor** | Rich text (AI Editor) for experiment notes, auto-save |
| **Bento Gallery** | Image gallery for figures, plots, and visualizations |
| **Agent Workspace** | Chat panel with session management, directive-driven UI, artifact enrichment |

### Agent-Powered Research

Each workspace is backed by an **OpenClaw AI Agent** running in a Docker container with 26 specialized tools:

- **LaTeX**: `latex_compile`, `update_latex`, `latex_project`, `latex_project_compile`
- **Jupyter**: `jupyter_execute`, `jupyter_notebook`, `update_notebook`
- **PDF**: `load_pdf`, `navigate_pdf`, `get_paper_context`
- **Code**: `code_execute`, `update_code`
- **Data**: `data_list`, `data_load`, `data_query`, `data_save`
- **UI**: `switch_component`, `send_ui_directive`, `update_notes`, `update_gallery`
- **Research**: `arxiv_to_prompt`, `context_search`, `context_load`, `save_artifact`
- **Sync**: `get_workspace_state`, `sync_files_to_workspace`

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 + React 19 (React Compiler enabled) |
| State | Zustand 5 (workspace-isolated stores with localStorage persistence) |
| Styling | Tailwind CSS 4 + shadcn/ui (Radix primitives, new-york style) |
| ORM | Prisma 6 (SQLite dev / MySQL prod) |
| Auth | NextAuth v5 (JWT strategy — Google, GitHub, email) |
| Desktop/Mobile | Tauri 2 (Rust backend, iOS 13+, Android SDK 24+) |
| Validation | Zod 4 |
| Agent | OpenClaw (containerized, 26 tools via prismer-workspace plugin v0.5.0) |

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (Next.js)                          │
│                                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │ Discovery  │  │   Assets     │  │        Workspace             │ │
│  │ /discovery │  │   /assets    │  │  ┌────────┐  ┌───────────┐  │ │
│  └───────────┘  └──────────────┘  │  │  Chat   │  │ WindowView│  │ │
│                                    │  │  Panel  │  │ (8 editor │  │ │
│                                    │  │(session │  │ components│  │ │
│                                    │  │ mgmt)   │  │ + tabs)   │  │ │
│                                    │  └────────┘  └───────────┘  │ │
│                                    └──────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  Bridge API (/api/v2/im/bridge/:wsId)
                           │  Directive SSE (/api/agents/:id/directive/stream)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Container (v5.0-openclaw)                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  container-gateway.mjs (:3000)  ← unified reverse proxy      │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  /api/v1/latex/*   → LaTeX Server   (:8080)                  │  │
│  │  /api/v1/jupyter/* → Jupyter        (:8888)                  │  │
│  │  /api/v1/prover/*  → Prover         (:8081)                  │  │
│  │  /api/v1/arxiv/*   → arXiv Server   (:8082)                  │  │
│  │  /api/v1/gateway/* → OpenClaw Agent (:18900)                 │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  OpenClaw Agent                                               │  │
│  │  ├── prismer-workspace plugin (26 tools)                      │  │
│  │  ├── prismer-im plugin (IM bridge)                            │  │
│  │  └── Skills (find-skills, templates)                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Source Layout

```
src/
├── app/
│   ├── api/              # REST API routes (v2/ for new, root for legacy)
│   ├── discovery/        # Paper discovery (landing page)
│   ├── assets/           # Collections, uploads, notebooks
│   ├── workspace/        # Agent workspace (chat + window viewer)
│   │   ├── components/   # WorkspaceView, WorkspaceChat, WindowViewer
│   │   ├── hooks/        # useContainerChat, useDirectiveStream, useHealthMonitor
│   │   └── stores/       # chatStore, componentStore, layoutStore, taskStore, agentInstanceStore
│   ├── global/           # Shared layouts (MainLayout, AppSidebar), stores (uiStore)
│   └── mobile/           # Mobile-specific views (Tauri iOS/Android)
├── components/
│   ├── editors/          # PDF reader, Jupyter, LaTeX, code playground, AG Grid, gallery
│   ├── ui/               # shadcn/ui components
│   └── shared/           # AssetBrowser, ActionCard, etc.
├── lib/
│   ├── container/        # Docker/K8s orchestrator, version management
│   ├── services/         # Paper, auth, upload, asset, workspace services
│   ├── directive/        # Directive queue for agent → UI communication
│   └── storage/          # Workspace-isolated localStorage manager
├── types/                # TypeScript types (message, workspace, paperContext)
└── generated/prisma/     # Generated Prisma Client (never edit)
docker/
├── base/                 # Base image: Ubuntu 24.04 + TeXLive + Python + Jupyter + Node 22
├── Dockerfile.openclaw   # Agent layer: OpenClaw + plugins + gateway
├── plugin/
│   ├── prismer-workspace/ # 26-tool workspace plugin (v0.5.0)
│   └── prismer-im/       # IM channel plugin (v0.2.0)
├── gateway/              # container-gateway.mjs (v1.1.0)
├── scripts/prismer-tools/ # Python CLI tools (4 commands)
├── config/               # OpenClaw + skill configs
└── templates/            # Agent templates (academic-researcher, data-scientist, etc.)
tests/
├── unit/                 # Vitest (jsdom)
├── layer1/               # Playwright: container + API (real agent)
├── layer2/               # Playwright: mock frontend rendering
├── layer3/               # Playwright: full E2E
├── fixtures/             # Mock directives, agent responses
└── helpers/              # Setup, API client, trace collector
docs/
├── ARCH.md               # Full engineering architecture
├── ROADMAP.md            # Phased delivery plan
├── TODO.md               # Current task tracker
├── DESIGN.md             # UI/UX design spec
├── SCHEME.md             # Database schema (37 Prisma models)
├── CONTAINER_PROTOCOL.md # Container change checklist
├── OPENSOURCE_ARCHITECTURE.md # Open-source API compatibility design
└── WINDOWVIEW_*.md       # WindowView convergence, status, design
```

---

## Quick Start

### Prerequisites

- **Node.js 20+** (22 recommended)
- **npm** (not pnpm)
- **Docker** (for agent containers — optional for frontend-only dev)

### Development

```bash
# Clone and install
git clone <repo-url>
cd library
npm install

# Initialize database (SQLite for dev)
npm run db:generate
npm run db:push

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Root `/` redirects to `/discovery`.

### Environment Variables

Minimal `.env` for development:

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

Runtime config (API keys, model settings) loads from Nacos (`nacos.prismer.app`) with `.env` fallback. See `src/lib/nacos-config.ts`.

### Running with Agent Container

```bash
# Build the agent container (requires Docker)
cd docker
docker build -f Dockerfile.openclaw \
  --build-arg BASE_IMAGE=prismer-academic:v5.0 \
  -t docker.prismer.dev/prismer-academic:v5.0-openclaw .

# Run via docker-compose (dev mode — frontend on :3000, container on :16888)
docker compose -f docker-compose.dev.yml up -d

# Health check
curl http://localhost:16888/api/v1/health
```

### Commands

```bash
# Development
npm run dev                    # Next.js dev server (:3000)
npm run build                  # prisma generate && next build
npm run lint                   # ESLint

# Database
npm run db:generate            # Generate Prisma Client
npm run db:push                # Push schema to database
npm run db:studio              # Open Prisma Studio GUI

# Tests
npm run test:unit              # Vitest unit tests
npm run test:layer1            # Container protocol tests (needs Docker)
npm run test:layer2            # Mock rendering tests
npm run test:layer3            # Full E2E tests
npm run test:e2e               # All Playwright tests
npm run test:report            # Open HTML report

# Desktop (Tauri)
npm run tauri:dev              # Desktop dev
npm run tauri:ios:sim          # iOS simulator
```

---

## Container Agent

### Communication Flow

```
Frontend → Bridge API (/api/v2/im/bridge/:wsId) → Container Gateway (:3000) → OpenClaw Agent
                                                                                     ↓
Frontend ← Directive SSE (/api/agents/:id/directive/stream) ← Plugin emits directives
```

1. User sends message via **Chat Panel**
2. **Bridge API** forwards to container via gateway
3. **OpenClaw Agent** reasons and invokes tools (e.g., `update_latex`, `jupyter_execute`)
4. Tools emit **UI Directives** (SWITCH_COMPONENT, UPDATE_LATEX, JUPYTER_CELL_RESULT, etc.)
5. **Directive SSE Stream** pushes directives to frontend in real-time
6. Frontend **executes directives** — switches components, updates content, shows results

### Container Components

| Component | Version | Description |
|-----------|---------|-------------|
| Base Image | v5.0 | Ubuntu 24.04 + TeXLive + Python/uv + R + Coq + Lean4 + Jupyter + Node 22 |
| Container Image | v5.0-openclaw | Base + OpenClaw runtime + plugins + gateway |
| prismer-workspace | 0.5.0 | 26 workspace tools (SSoT: `docker/plugin/prismer-workspace/version.ts`) |
| prismer-im | 0.2.0 | IM channel plugin (SSoT: `docker/plugin/prismer-im/version.ts`) |
| container-gateway | 1.1.0 | Unified reverse proxy (SSoT: `docker/gateway/version.mjs`) |
| prismer-tools | 0.1.0 | 4 Python CLI tools (SSoT: `docker/scripts/prismer-tools/version.py`) |

Version SSoT (frontend): `src/lib/container/version.ts`
Compatibility matrix: `docker/compatibility.json`
Change protocol: `docs/CONTAINER_PROTOCOL.md`

---

## Open Source Plan

### Strategy: API Path Compatibility

**The core idea**: instead of splitting the codebase, make the container gateway mimic the Cloud API. The frontend code stays 100% unchanged — only the container-side gateway needs extension.

```
Cloud Mode:   Browser → Next.js API → Container Gateway → Agent
Local Mode:   Browser → Container Gateway (mimics Next.js API) → Agent
```

See `docs/OPENSOURCE_ARCHITECTURE.md` for the full design, including:
- 4-tier API endpoint classification (8 must-have, 7 nice-to-have, 8 stubs, 5 not needed)
- Gateway extension code examples
- SQLite integration plan for local persistence
- Work breakdown (~3 weeks estimated)

### Key Tasks for Open Source

| Task | Effort | Description |
|------|--------|-------------|
| workspace-ui extraction | 3d | Extract workspace frontend as embeddable SPA (`@prismer/workspace-ui`) |
| Gateway Tier 1 APIs | 4d | Bridge chat/history/SSE, agent health, container proxy, workspace agent |
| Gateway Tier 2 APIs | 2d | Notes, component states, context, file sync, LaTeX compile |
| Gateway Tier 3 stubs | 1d | Agent start/stop/logs, tasks/timeline/snapshots |
| SQLite integration | 2d | Message/state/directive persistence in container |
| Static file serving | 0.5d | Serve workspace-ui build from gateway |
| Testing (dual-mode) | 2d | Run existing L1/L2 tests in both Cloud and Local modes |

### Version Baseline

| Component | Version | Local Mode Status |
|-----------|---------|-------------------|
| Container Image | v5.0-openclaw | Base image, use as-is |
| prismer-workspace | 0.5.0 | Zero-modification needed |
| prismer-im | 0.2.0 | Not loaded in Local mode (no Cloud IM) |
| container-gateway | 1.1.0 | Needs Cloud API compat routes |
| prismer-tools | 0.1.0 | No changes needed |

---

## Testing

4-layer test infrastructure:

| Layer | Type | Command | Description |
|-------|------|---------|-------------|
| Unit | Vitest (jsdom) | `npm run test:unit` | Store logic, directive mapping, API handlers |
| L1 | Playwright | `npm run test:layer1` | Container protocol, bridge, directive delivery |
| L2 | Playwright | `npm run test:layer2` | Mock frontend rendering (directives injected via `window.__executeDirective`) |
| L3 | Playwright | `npm run test:layer3` | Full E2E: real agent → real rendering |

**Always run Playwright with `--trace on`** for Trace Viewer files:

```bash
npx playwright test --project=layer2 --trace on
npx playwright show-trace tests/output/traces/<trace>.zip
```

---

## Contributing

### Getting Started

1. Read `docs/ARCH.md` for the full architecture
2. Read `docs/TODO.md` for current tasks
3. Read `docs/CONTAINER_PROTOCOL.md` before any container changes
4. Read `docs/OPENSOURCE_ARCHITECTURE.md` for the open-source API design

### Branch Strategy

```
main            ← production (protected)
  └── develop   ← integration/staging
        └── feat/xxx   ← feature branches → merge to develop
        └── fix/xxx    ← bugfix branches  → merge to develop
```

Branch names: lowercase with hyphens (`feat/workspace-integration`, `fix/chat-history`).

### Areas We Need Help

- **Gateway API Compatibility**: Implement Tier 1-3 API routes in `container-gateway.mjs` for Local mode
- **workspace-ui Extraction**: Package workspace frontend as standalone SPA with Vite
- **SQLite Integration**: Replace Prisma/MySQL with SQLite for container-local persistence
- **Editor Components**: Improve PDF reader, LaTeX editor, Jupyter notebook UX
- **Testing**: Expand L1/L2/L3 test coverage, especially for Local mode

---

## Documentation

| Document | Purpose |
|----------|---------|
| `docs/ARCH.md` | Engineering architecture, source layout, data flow |
| `docs/ROADMAP.md` | Phased delivery plan (Phase 0-5) |
| `docs/TODO.md` | Current status and tasks |
| `docs/DESIGN.md` | UI/UX design spec |
| `docs/SCHEME.md` | Database schema (37 Prisma models) |
| `docs/CONTAINER_PROTOCOL.md` | Container change checklists |
| `docs/OPENSOURCE_ARCHITECTURE.md` | Open-source API compatibility design |
| `docs/WINDOWVIEW_*.md` | WindowView component design, status, convergence |
| `docs/MVP_FULL_CHAIN.md` | MVP scenario chain (T0-T3) |
| `docker/VERSIONS.md` | Container component version tracking |
| `CLAUDE.md` | AI coding assistant instructions (Claude Code) |

---

## License

Prismer.AI is available under dual licensing:

- **Open Source Components** (`@prismer/*` packages): MIT License
- **Prismer.AI Platform**: [Business Source License](LICENSE.md)

---

<p align="center">
  <strong>Built for researchers, by researchers.</strong>
</p>

<p align="center">
  <sub>Stop fighting your tools. Start doing research.</sub>
</p>
