# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prismer.AI (PISA-OS) is an open academic research operating system built with Next.js 16, React 19, and TypeScript. It covers the full research lifecycle: paper discovery, reading (PDF with OCR), data analysis (Jupyter), writing (LaTeX), and AI-assisted peer review. It also supports desktop/mobile via Tauri 2.

## Common Commands

```bash
# Development
npm run dev                  # Start Next.js dev server (port 3000)
npm run sync:server          # Start WebSocket agent/sync server (port 3456)
npm run build                # prisma generate && next build
npm run lint                 # ESLint (Next.js core-web-vitals + TypeScript rules)

# Database (SQLite for dev, MySQL for prod)
npm run db:generate          # Generate Prisma Client (output: src/generated/prisma)
npm run db:push              # Push schema to database
npm run db:migrate           # Create migration
npm run db:studio            # Open Prisma Studio GUI

# Verify external services
npm run verify:all           # Check S3, MySQL, Redis, remote connections

# Tauri (desktop/mobile)
npm run tauri:dev            # Desktop dev
npm run tauri:ios:sim        # iOS simulator (iPhone 16 Pro Max)
npm run mobile:start         # Concurrent: sync:server + dev + tauri:ios:sim

# Tests
npx vitest                   # Run all unit tests
npx vitest run src/path/to/test.test.ts  # Run single test file

# E2E (Playwright — ALWAYS use --trace on)
npx playwright test e2e/workspace-visual.spec.ts --trace on       # Visual E2E
npx playwright test --project=container-integration --trace on    # Container E2E
node e2e/real-agent-test.mjs                                      # Real agent E2E
npx playwright show-trace e2e/results/<trace>.zip                 # Trace Viewer (preferred)
npx playwright show-report e2e/playwright-report                  # HTML report

# UI Components (shadcn/ui — new-york style, Lucide icons)
npx shadcn@latest add <component>  # Add new shadcn component to src/components/ui/
```

## Architecture

### Tech Stack
- **Framework:** Next.js 16.1.1 with React 19, React Compiler enabled, standalone output
- **State:** Zustand 5
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **ORM:** Prisma 6 (SQLite dev / MySQL prod), client generated to `src/generated/prisma`
- **Auth:** NextAuth v5 (beta.30) with JWT strategy — Google, GitHub, email providers
- **Desktop/Mobile:** Tauri 2 (Rust backend, iOS 13+, Android SDK 24+)
- **Validation:** Zod 4
- **Toast:** Sonner

### Path Alias
`@/*` maps to `./src/*` (configured in `tsconfig.json`).

### Routing & Navigation

Root `/` redirects to `/library`, which redirects to `/discovery` (the default landing page).

Three main sections share a common layout via `MainLayout` (sidebar + content area):
- **Discovery** (`/discovery`) — paper search, reading history, chat sessions
- **Assets** (`/assets`) — collections, file uploads, notebooks/knowledge hub
- **Workspace** (`/workspace`) — agent-powered research workspace (full-screen split view)

Other routes:
- `/auth` — login/register flow
- `/playground` — component showcase (requires COEP/COOP headers)
- `/admin/monitor` — service monitoring dashboard
- `/mobile` — mobile-specific views with navigation drawer

Key layout files:
- `src/app/global/layouts/MainLayout.tsx` — wraps AppSidebar + content + ReaderOverlay + UploadModal
- `src/app/global/components/AppSidebar.tsx` — three-tab sidebar (Discovery/Assets/Workspace)
- `src/app/global/store/uiStore.ts` — manages `activeTab` state (`LibraryTab` type)

Workspace gets special treatment in MainLayout: content area uses `overflow-hidden` instead of `overflow-y-auto` since WorkspaceView manages its own layout (chat panel + window viewer split).

### Source Layout

- `src/app/` — Next.js App Router pages and API routes
  - `api/` — REST endpoints (see API section below)
  - `global/` — shared layouts, components, and stores used across sections
  - `workspace/` — agent workspace (chat + window viewer + timeline), with its own stores
  - `mobile/` — mobile-specific views with navigation drawer
  - `playground/` — WebContainer-based code playground
- `src/components/` — React components
  - `editors/` — PDF reader, Jupyter notebook, LaTeX (AiEditor), code playground, AG Grid
  - `ui/` — shadcn/ui components
  - `agent/` — Agent chat UI
  - `shared/` — Shared components
- `src/lib/` — Core libraries
  - `sync/` — Multi-client sync engine (see Agent System below)
  - `services/` — Business logic (paper, auth, parser, upload, asset, collection, offline, remote-paper)
  - `prisma.ts` — Prisma Client singleton (always import from `@/lib/prisma`)
  - `nacos-config.ts` — Runtime config from Nacos (fallback to .env)
  - `s3.ts`, `redis.ts` — Infrastructure clients
- `src/store/` — Global Zustand stores
- `src/generated/prisma/` — Generated Prisma Client (never edit directly)
- `scripts/` — Server scripts (agent-server.ts, sync-server.ts, verify-*.ts)
- `prisma/` — Database schema and migrations
- `python/` — Separate Python agent server (uses `uv` package manager, entry: `main.py`)
- `docker/` — Container-side OpenClaw integration (plugins, tools, gateway, config)
  - `plugin/prismer-im/` — IM Channel Plugin (v0.2.0, bridges Prismer Cloud IM ↔ OpenClaw agent)
  - `plugin/prismer-workspace/` — Workspace Skill Plugin (v0.5.0, 26 tools + find-skills skill)
  - `scripts/prismer-tools/` — 4 Python CLIs for container operations (latex, jupyter, component, sync)
  - `gateway/container-gateway.mjs` — Zero-dependency reverse proxy for internal services (:3000)
  - `config/` — OpenClaw runtime config + skill configs
  - `VERSIONS.md` — Component version tracking

### State Management (Zustand Stores)

Stores live in three locations with different scopes:

1. **`src/store/`** — global app stores (e.g., `flowStore.ts`)
2. **`src/app/global/store/`** — layout-level stores shared across main sections (`uiStore`, `readerStore`, `authStore`)
3. **`src/app/workspace/stores/`** — workspace-specific store (`workspaceStore.ts`) with 80+ actions covering layout, chat, tasks, window, timeline, demo flow, diff, and agent sync state. Key selector hooks: `useCurrentTask`, `useActiveDiff`, `useLayoutState`, `useActiveComponent`, `useComponentState`

### API Routes

Two generations of API routes coexist:
- **`api/v2/`** — current pattern for papers, uploads, assets, collections, notebooks, stats
- **`api/`** (no prefix) — legacy and utility endpoints (auth, ai, health, jupyter proxy, latex, ocr, github, workspace, agents, container, config)

New API routes should follow the `api/v2/` convention.

### Database Schema

The Prisma schema (`prisma/schema.prisma`) has 37 models across seven domains (see `docs/SCHEME.md` for full detail):

1. **Users & Auth** — User, Account, Session, VerificationToken (NextAuth-compatible)
2. **Papers & OCR** — Paper, OcrTask, Figure (arXiv-centric with S3 storage)
3. **Notebooks & Notes** — Notebook, Note, NoteCitation (with paper citation links)
4. **Social** — Favorite, Like, Comment, Activity, UserPaperState
5. **Workspace** — WorkspaceSession, Message, Task, Timeline, ComponentState, Snapshot, File (the full workspace state machine)
6. **Agent & IM** — AgentInstance, AgentConfig, Container, ConfigDeployment, and IM models (IMUser, IMConversation, IMMessage, etc.) for agent-to-agent/human communication
7. **Cache** — StatsCache for temporary computed data

JSON fields are stored as `String` with comments indicating the expected JSON structure. Arrays like `authors` and `categories` are JSON-encoded strings.

### Workspace Architecture

The workspace (`/workspace`) is the core research environment. It has a horizontal split layout:
- **Left:** WorkspaceChat (resizable, 280-600px) with MessageList, ChatInput, ActionBar, TaskPanel
- **Right:** WindowViewer with tabbed editor components + Timeline + DiffViewer
- **Collapsed state:** SiriOrb + TaskBubble overlay on bottom-left of WindowViewer

WindowViewer integrates 8 editor components (pdf-reader, latex-editor, jupyter-notebook, code-playground, ai-editor, ag-grid, bento-gallery, three-viewer) — see `src/components/editors/previews/` for implementations.

### Agent System — OpenClaw Adaptor Layer

The agent/sync infrastructure in `src/lib/sync/` is an **adaptation layer** designed to bridge frontend components with an external agent backend (OpenClaw). It provides unified management of:

- **Component state sync** — which components show what data, coordinated across clients
- **Content updates** — document loading, editor content, execution results
- **Timeline events** — ordered record of all actions for replay and audit
- **Agent context engineering** — session state, conversation history, tool invocations
- **User assets & messages** — chat messages, task progress, interaction events

**Key sync files:**
- `SyncMatrixEngine.ts` — rules-based sync controller defining WHO can access WHAT data in WHAT ways
- `defaultMatrix.ts` — sync rules per data type (messages: bidirectional+db, tasks: broadcast, componentStates: bidirectional, etc.)
- `componentStateConfig.ts` — field-level sync config per component type, with mobile access restrictions
- `useAgentConnection.ts` — low-level WebSocket hook (connection lifecycle, message dedup, reconnection)
- `useAgentStore.ts` — high-level hook combining WebSocket + Zustand store + auto-sync handlers
- `componentEventForwarder.ts` — forwards component events (tab switches, document loads) to server

**Convenience hooks:** `useDesktopAgent()` (full_ui capability) and `useMobileAgent()` (chat_ui capability).

**Current state:** `scripts/agent-server.ts` runs a demo server (port 3456) with DemoFlowController for testing the sync pipeline. The transport abstraction means switching to OpenClaw requires no component-layer changes — only the server-side agent implementation changes.

### OpenClaw Container Plugins

The `docker/` directory contains container-side modules that run inside the OpenClaw agent container. See `docker/VERSIONS.md` for current versions and individual README files for full documentation.

**Communication flow:**
```
Frontend → Bridge API (/api/v2/im/bridge/) → Container Gateway (:16888→:3000) → OpenClaw Agent
                                                                                      ↓
Frontend ← Bridge polls directives ← /workspace/.openclaw/directives/*.json ← prismer-* CLI tools
```

**Modules:**

| Module | Type | Entry Point | Description |
|--------|------|-------------|-------------|
| `prismer-im` (v0.2.0) | Channel Plugin | `docker/plugin/prismer-im/` | IM ↔ Agent bridge via `@prismer/sdk` v1.7 |
| `prismer-workspace` (v0.5.0) | Skill Plugin | `docker/plugin/prismer-workspace/` | 26 workspace tools (latex, jupyter, pdf, ui, arxiv, notes, gallery, artifacts, code, data grid, context, sync) |
| `prismer-tools` (v0.1.0) | Python CLIs | `docker/scripts/prismer-tools/` | 4 CLI tools writing JSON directives |
| `container-gateway` (v1.1.0) | Reverse Proxy | `docker/gateway/container-gateway.mjs` | Routes to 5 internal services |

**Directive protocol:** Agent tools write JSON files to `/workspace/.openclaw/directives/` (types: `switch_component`, `update_content`, `compile_complete`, `jupyter_cell`, `add_gallery_image`, `notification`). The Bridge API reads and clears these files after each agent run.

### Configuration

Minimal `.env` contains only build-time variables (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL). All runtime config (API keys, model settings, external service URLs) loads from Nacos (`nacos.prismer.app`) with `.env` as fallback when Nacos is unavailable. Nacos uses separate namespaces for dev/test/prod environments. See `src/lib/nacos-config.ts`.

### Code Playground

The `/playground` route uses WebContainer API (`@webcontainer/api`) for browser-native Node.js execution. Requires Cross-Origin isolation headers (COEP/COOP), configured only for `/playground/:path*` in `next.config.ts` to avoid breaking OAuth flows on other routes.

### Testing

Unified test system under `tests/` with three layers:

```
tests/
├── helpers/         # Shared: setup-vitest, mock-agent, api-client, trace-collector
├── fixtures/        # Mock directives, agent responses, workspace data
├── unit/            # Vitest unit tests (jsdom)
├── layer1/          # Playwright: container + plugin + API (real agent)
├── layer2/          # Playwright: mock frontend rendering + trace
├── layer3/          # Playwright: full E2E, no mocks + trace
└── output/          # .gitignore'd: results, reports, traces, screenshots
```

**Layer 1** (`tests/layer1/`) — Container + Plugin + API. Real container services, OpenClaw infra, directive delivery. Requires running container. Skips gracefully when unavailable.

**Layer 2** (`tests/layer2/`) — Mock Frontend Rendering. Directives injected via `window.__executeDirective`. Tests component content CRUD, state transitions, rendering. Trace recording for timeline replay.

**Layer 3** (`tests/layer3/`) — Full E2E (No Mocks). Frontend initiates, real container inference, full rendering verification. Trace recording for timeline replay.

**MVP Scenarios (T0-T3)** tested in both Layer 2 (mock) and Layer 3 (real):
- T0: Agent identity/capabilities → chat panel reply
- T1: LaTeX survey with CVPR template → editor + compile + PDF
- T2: Jupyter sin/cos/tan plot → notebook + gallery
- T3: Notes experiment template → ai-editor content

**Commands:**
```bash
npm run test:unit       # Vitest unit tests
npm run test:layer1     # Container protocol tests
npm run test:layer2     # Mock rendering tests
npm run test:layer3     # Full E2E tests
npm run test:e2e        # All Playwright tests (L1+L2+L3)
npm run test:report     # Open HTML report
npm run test:coverage   # Unit tests with coverage
```

**Rules**: `tests/output/` is the ONLY test output directory. All generated output is gitignored. Test specs under `tests/` are committed.

### CI/CD & Deployment

GitLab CI (`.gitlab-ci.yml`) with three stages: build (Docker image), deploy (SSH to staging), k8s-deploy (ArgoCD GitOps). Docker compose files are in `docker/`.

Multi-stage Docker build (node:20-alpine): deps → builder → runner. Uses standalone output. Runtime env vars (DATABASE_URL, REDIS_URL, AWS credentials) passed via `docker run -e`. Prisma Client is copied from build stage to `src/generated/`.

### Git Branching & Release Strategy

```
main          ← production release (protected)
  └── develop ← testing/staging release
        └── feat/xxx   ← feature branches
        └── fix/xxx    ← bugfix branches
```

| Branch | Purpose | Merge Target |
|--------|---------|-------------|
| `main` | Production release, always stable | — |
| `develop` | Testing/staging, integration branch | → `main` (via MR) |
| `feat/<name>` | Feature development | → `develop` (via MR) |
| `fix/<name>` | Bug fixes | → `develop` (via MR) |

**Branch rules**:
- Never commit directly to `main` or `develop` — always use merge requests
- Feature branches are created from `develop`, merged back to `develop`
- Bug fix branches are created from `develop`, merged back to `develop`
- `develop` is merged to `main` for production releases
- Branch names use lowercase with hyphens: `feat/workspace-integration`, `fix/chat-history-persistence`

**Release via Git tags** (manual). Tags trigger GitLab CI pipelines for build + deploy:

| Tag Pattern | Target | Deploy Method |
|-------------|--------|---------------|
| `k8s-prod-YYYYMMDD-vX.Y.Z` | K8s prod cluster (EKS `prismer-prod`) | GitOps: build image → update k8s-deploy repo → kubectl apply |
| `k8s-test-YYYYMMDD-vX.Y.Z` | K8s test cluster (EKS `prismer-test`) | GitOps: build image → update k8s-deploy repo → kubectl apply |

**FORBIDDEN**: Do NOT create tags without the `k8s-` prefix (e.g., `prod-*`, `test-*`, `dev-*`). These are legacy patterns and must not be used.

**Version format**: `vX.Y.Z` (semver) — the date prefix `YYYYMMDD` identifies the release date, version resets per day (e.g., `k8s-prod-20260116-v0.0.1`).

**Release workflow**:
1. Feature work on `feat/*` → merge to `develop`
2. Test release: tag `develop` with `k8s-test-YYYYMMDD-vX.Y.Z` → CI deploys to test cluster
3. Merge `develop` → `main` via MR
4. Prod release: tag `main` with `k8s-prod-YYYYMMDD-vX.Y.Z` → CI deploys to prod cluster

## Development Practices

### Observability-First Development

All code MUST include structured logging for production traceability. Use the unified logger (`src/lib/logger.ts`):

```typescript
import { createLogger } from '@/lib/logger';
const log = createLogger('ModuleName');

log.info('Operation completed', { key: 'value', duration_ms: 123 });
log.error('Operation failed', { error: err.message, context: { ... } });

// Child loggers for request correlation
const reqLog = log.child({ correlationId, agentId });
```

Three logging layers — all use the same structured format:
- **API layer**: Request/response lifecycle, status codes, durations
- **Container layer**: Docker orchestration, config deployment, gateway proxy
- **Frontend layer**: Store mutations, WebSocket events, component lifecycle

### E2E Verification

Every significant feature MUST be verified with E2E tests before merge.

**MANDATORY: Always run Playwright with `--trace on`** to generate Trace Viewer files (draggable timeline with screenshots, network, console):

```bash
# Unit tests
npx vitest run src/path/to/test.test.ts

# E2E tests — ALWAYS use --trace on
npx playwright test e2e/workspace-visual.spec.ts --trace on
npx playwright test --project=container-integration --trace on

# Review results — use Trace Viewer (NOT just HTML report)
npx playwright show-trace e2e/results/<trace-file>.zip   # Trace Viewer (preferred)
npx playwright show-report e2e/playwright-report          # HTML report (fallback)
```

**Test suites**:

1. **Playwright visual**: `npx playwright test e2e/workspace-visual.spec.ts --trace on` — 5-phase lifecycle (workspace creation → agent chat → component switching → stop + persistence → cleanup)
2. **Container integration**: `npx playwright test --project=container-integration --trace on` — real agent tool invocation (bridge health → notes/latex/jupyter/gallery directives → artifact save)
3. **Real agent**: `node e2e/real-agent-test.mjs` — real container agent integration (health → bridge → chat scenarios → workspace persistence → gateway stats)
4. **Review**: Open trace files with `npx playwright show-trace` to inspect the timeline, screenshots, network requests, and console logs at each step
5. Reports are generated into `e2e/results/` and `e2e/playwright-report/` (gitignored, regenerate on demand)

## Engineering Documentation

### Documentation System

The `docs/` directory contains canonical documents that serve as the project's living knowledge base:

#### Desktop/Web Documentation (Complete)

| Document | Purpose | When to Read |
|----------|---------|--------------|
| `docs/ARCH.md` | Engineering architecture — tech stack, source layout, data flow, sync layer, Cloud SDK | Before any structural changes or new module work |
| `docs/ROADMAP.md` | Engineering roadmap — phased delivery plan (Phase 0-5) | Before planning new features or prioritizing work |
| `docs/TODO.md` | Current status & short-term tasks — WindowView convergence tracker | Before starting any implementation task |
| `docs/DESIGN.md` | Interface design spec — layouts, components, interactions, visual states | Before any UI/UX work |
| `docs/SCHEME.md` | Database schema alignment — all 37 Prisma models, field specs, relationships | Before any database or API work |
| `docs/REFACTOR.md` | Code structure refactor — completed Phase A-D, dependency fixes, store splits | Before any structural refactoring |
| `docs/WINDOWVIEW_CONVERGENCE.md` | WindowViewer component unification — visual, AI, assets, sync | Before any editor component work |
| `docs/WINDOWVIEW_STATUS.md` | WindowView component-by-component status analysis — gaps, dependencies, container integration | Before starting any WindowView component work |
| `docs/WINDOWVIEW_DESIGN.md` | WindowView product design — artifact-centric model, multi-instance tabs, phase timeline, asset bridge, agent control | Before any WindowView product or UX decisions |
| `docker/VERSIONS.md` | Container integration versions — plugins, tools, gateway, image | Before any container or plugin work |
| `docs/CONTAINER_PROTOCOL.md` | Container change protocol — image, config, frontend integration, plugin version, open-source frontend checklists | Before any container-related change (image, config, proxy, or frontend guard) |
| `docs/OPENSOURCE_ARCHITECTURE.md` | Open-source API path compatibility design — Gateway mimics Cloud API, dual-mode deployment | Before any open-source or embedded frontend work |
| `docs/CONTAINER_FRONTEND_FEASIBILITY.md` | Container-embedded frontend feasibility study — architecture options, chosen plan, migration strategy | Before starting workspace-ui extraction |

#### Mobile Documentation (Planning - v2.0)

| Document | Purpose | When to Read |
|----------|---------|--------------|
| `docs/mobile/MOBILE_ARCH.md` | Mobile engineering architecture — platform strategy, tech stack, source layout | Before any mobile structural work |
| `docs/mobile/MOBILE_DESIGN.md` | Mobile interface design — Command/Files/Me modules, gestures, animations | Before any mobile UI/UX work |
| `docs/mobile/MOBILE_ROADMAP.md` | Mobile roadmap — Phase M0-M5 delivery plan | Before planning mobile features |
| `docs/mobile/MOBILE_TODO.md` | Mobile development tracker — task status by phase | Before starting mobile implementation |

**Mobile vs Desktop Separation:**
- Desktop/Web is feature-complete (Phase 4B IM MVP done)
- Mobile is in planning phase (development on hold)
- Mobile uses 3-tab structure: Command / Files / Me
- Mobile-specific features: Camera OCR, Voice Input, Push Notifications

**Legacy Mobile References (Superseded):**
- `docs/PRD.md` — Genspark PRD v2.0 (partially integrated into v2.0 mobile docs)
- `docs/MOBILE_UX_DESIGN.md` — v1.0 UX design (superseded by `docs/mobile/MOBILE_DESIGN.md`)

### External SDK Documentation

- **Cloud SDK source**: `/Users/prismer/workspace/Prismer/sdk/typescript/` — @prismer/sdk v1.7 full source code (Context, Parse, IM APIs). Refer to this directory when investigating SDK internals, type definitions, or implementation details.

### Documentation Workflow (MANDATORY)

**Before starting work:**
1. Read the relevant doc(s) from the table above to understand current state and conventions
2. Check `docs/TODO.md` for related pending tasks or known issues
3. For Cloud SDK integration, read the SDK README

**After completing work:**
1. Update any doc that was affected by your changes:
   - New/changed architecture → update `ARCH.md`
   - Completed/added tasks → update `TODO.md`
   - Schema changes → update `SCHEME.md`
   - UI changes → update `DESIGN.md`
   - Milestone progress → update `ROADMAP.md`
   - Refactoring work → update `REFACTOR.md`
   - Editor component changes → update `WINDOWVIEW_CONVERGENCE.md`
2. Keep docs factual — verify against the actual codebase, never copy from aspirational or outdated sources
