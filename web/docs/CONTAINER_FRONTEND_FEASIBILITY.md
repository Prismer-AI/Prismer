# Container-Embedded Frontend Feasibility Study

> **Proposal**: Package the workspace frontend (Chat Panel + WindowViewer) as an npm package, bake it into the OpenClaw container image, so starting the container also starts a self-contained frontend.

**Date**: 2026-02-25
**Branch**: `feat/windowview-integration`
**Status**: Research / Proposal → Aligned with `docs/OPENSOURCE_ARCHITECTURE.md`

---

## 1. Executive Summary

**Verdict**: Feasible with the **API Path Compatibility** strategy. The workspace frontend is well-isolated in `src/app/workspace/` with 7 self-contained Zustand stores and 33+ components. Instead of rewriting API calls, the container Gateway mimics Cloud API endpoints — so frontend code can be used **100% as-is with zero modifications**.

**Chosen approach**: API Path Compatibility (detailed in `docs/OPENSOURCE_ARCHITECTURE.md`)
- Frontend code: 100% reuse, zero modifications
- Container Gateway: extends existing routes to simulate Cloud API response format
- Two npm packages: `@prismer/workspace-ui` (Vite SPA) + `@prismer/container-gateway` (extended gateway)
- Estimated effort: ~2.5 weeks

---

## 2. Current Architecture (As-Is)

### 2.1 What Runs in the Container Today

The OpenClaw container is **deliberately headless** — the original web UI was replaced by an API-only Container Gateway.

```
Container (docker.prismer.dev/prismer-academic:v5.0-openclaw)
┌──────────────────────────────────────────────────────────┐
│  OpenClaw Agent (:18900)    ← LLM reasoning + skills    │
│  TCP Proxy (:18901)         ← External WS bridge        │
│  Container Gateway (:3000)  ← Unified HTTP reverse proxy │
│  Jupyter (:8888)            ← Interactive notebooks      │
│  LaTeX (:8080)              ← PDF compilation            │
│  Prover (:8081)             ← Formal verification        │
│  arXiv (:8082)              ← Paper conversion           │
└──────────────────────────────────────────────────────────┘
```

### 2.2 What Runs Outside (Prismer Backend + Frontend)

```
Prismer Backend (Next.js :3000)
├── /api/agents/:id/start          ← Container lifecycle
├── /api/agents/:id/health         ← Health + version check
├── /api/v2/im/bridge/:wsId        ← Chat message bridge
├── /api/container/:id/jupyter/*   ← Jupyter proxy
├── /api/container/:id/latex/*     ← LaTeX proxy
├── /api/workspace/:id/agent       ← Agent binding
└── Prisma DB (SQLite/MySQL)       ← Persistence

Prismer Frontend (React 19 SPA, served by Next.js)
├── WorkspaceView                  ← Main layout
│   ├── WorkspaceChat              ← Chat panel (left)
│   └── WindowViewer               ← 8 editor tabs (right)
└── 7 Zustand stores               ← State management
```

### 2.3 Data Flow (Cloud Mode)

```
User → ChatInput → useContainerChat hook
    → POST /api/v2/im/bridge/:workspaceId     (Next.js backend)
    → WebSocket to container gateway :18901     (OpenClaw)
    → Agent processes, returns response + directives
    → Backend persists to IM DB, returns to frontend
    → Frontend executes directives (switch tab, update content, etc.)
```

**Critical path**: Frontend → Backend API → Container Gateway → Agent

---

## 3. Workspace Frontend Analysis

### 3.1 Module Inventory

| Category | Count | Size (approx.) |
|----------|-------|-----------------|
| Components | 33+ files | ~4,500 lines |
| Stores | 7 Zustand stores | ~1,200 lines |
| Hooks | 5 custom hooks | ~800 lines |
| Lib (sync, directives, events) | 8 files | ~600 lines |
| **Total workspace module** | **63 files** | **~7,100 lines** |

### 3.2 Store Architecture (Self-Contained)

All 7 stores are workspace-internal with **zero dependency on global stores**:

| Store | Purpose | DB Dependency |
|-------|---------|---------------|
| `layoutStore` | Chat panel width, task panel height | None |
| `chatStore` | Messages, participants | IM messages (via Bridge API) |
| `taskStore` | Tasks, active task | WorkspaceTask (optional) |
| `componentStore` | Active tab, component states, diffs | ComponentState (optional) |
| `timelineStore` | Timeline events, snapshots | TimelineEvent (optional) |
| `demoStore` | Demo flow orchestration | None |
| `agentInstanceStore` | Agent lifecycle, health, versions | AgentInstance + Container |

### 3.3 API Dependencies

The workspace frontend calls **11 unique REST endpoints**:

| Endpoint | Purpose | Local Mode Handling |
|----------|---------|---------------------|
| `POST /api/v2/im/bridge/:wsId` | Send message, receive directives | Gateway handles locally → Agent |
| `GET /api/v2/im/bridge/:wsId` | Status check, load history | Gateway returns fixed connected |
| `GET /api/v2/im/bridge/:wsId?include=messages` | Message history | Gateway → SQLite |
| `POST /api/agents/:id/start` | Start container (SSE) | N/A (container already running) |
| `POST /api/agents/:id/stop` | Stop container | N/A (container lifecycle external) |
| `GET /api/agents/:id/health` | Health + version check | Gateway always returns healthy |
| `GET /api/workspace/:id/agent` | Get agent binding | Gateway returns simulated response |
| `POST /api/workspace/:id/agent/ensure` | Create agent if missing | Gateway returns simulated response |
| `GET /api/container/:id/jupyter/*` | Jupyter proxy | Gateway directly proxies to :8888 |
| `GET /api/container/:id/latex/*` | LaTeX proxy | Gateway directly proxies to :8080 |
| `POST /api/workspace/:id/messages` | Persist messages | Gateway → SQLite |

### 3.4 Heavy Editor Dependencies

WindowViewer lazy-loads 8 editor components with significant bundle sizes:

| Editor | Package | Size (min) | Container Service |
|--------|---------|-----------|-------------------|
| Code Playground | `@monaco-editor/react` | ~2.5 MB | None (WebContainer) |
| PDF Reader | `react-pdf` + PDF.js | ~800 KB | None (client-side) |
| 3D Viewer | `three` + `@react-three/fiber` | ~600 KB | None |
| Data Grid | `ag-grid` | ~1.2 MB | None |
| Jupyter | `@jupyterlab/services` | ~300 KB | Jupyter :8888 |
| LaTeX | `@codemirror/*` | ~400 KB | LaTeX :8080 |
| AI Editor | `@codemirror/*` (shared) | (shared) | None |
| Gallery | `framer-motion` (shared) | (shared) | None |

**Total editor bundle**: ~5.8 MB (lazy-loaded, tree-shaken in production)

---

## 4. Architecture Options Evaluated

### Option A: Full Next.js App in Container

**Verdict**: Not recommended — +600 MB image size, +512 MB RAM, complex maintenance.

### Option B: Vite SPA + New API Endpoints (Original Proposal)

**Verdict**: Rejected in favor of Option D — requires refactoring 11 endpoints to 4 new ones, API adaptation layer needed.

### Option C: Minimal Chat SPA + Direct WebSocket

**Verdict**: Too limited — agents need UI directive support for full academic workflow.

### Option D: Vite SPA + API Path Compatibility (Chosen)

> Detailed in `docs/OPENSOURCE_ARCHITECTURE.md`

**Core insight**: **Instead of separating code, make the container mimic the Cloud API**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Local Mode (Open-Source Container Standalone)      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Browser                                Container (All-in-One)     │
│   ┌──────────────┐                      ┌────────────────────────┐  │
│   │ workspace-ui │─────────────────────▶│ Gateway :3000           │  │
│   │ (same code)  │                      │                         │  │
│   │              │◀─────────────────────│ Routes (Cloud-compat):  │  │
│   └──────────────┘                      │ /api/v2/im/bridge/* → local│
│         │                               │ /api/container/*  → local │  │
│         │ Same API calls                │ /api/agents/*     → local │  │
│         │ Same response format          │ /api/v1/jupyter   → :8888│  │
│         ▼                               │ /api/v1/latex     → :8080│  │
│   Zero code changes                     │                         │  │
│                                         │ SQLite + OpenClaw Agent  │  │
│                                         └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Why this is better than Option B**:

| Dimension | Option B (New Endpoints) | Option D (API Compatibility) |
|-----------|-------------------------|------------------------------|
| Frontend changes | API adaptation layer needed | **Zero changes** |
| Endpoint count | 4 new gateway endpoints | **Same paths as Cloud** |
| Testing | Need separate test suite | **Same E2E tests, both modes** |
| Maintenance | Two API surfaces to sync | **One frontend, gateway auto-follows** |
| Effort | 4-6 weeks | **~2.5 weeks** |

---

## 5. Chosen Plan: API Path Compatibility (Option D)

### 5.1 Package Structure

**Only 2 npm packages needed**:

#### @prismer/workspace-ui

From existing code, **zero modifications** — package and build with Vite:

```
@prismer/workspace-ui/
├── package.json
├── vite.config.ts            # Vite build config
├── src/
│   ├── components/           # From src/app/workspace/components/
│   ├── stores/               # From src/app/workspace/stores/
│   ├── hooks/                # From src/app/workspace/hooks/
│   ├── editors/              # From src/components/editors/previews/
│   └── types/                # From src/types/
├── dist/                     # Build output → Container /app/frontend/
└── tailwind.config.ts
```

#### @prismer/container-gateway

Extends existing `container-gateway.mjs`:

```
@prismer/container-gateway/
├── package.json
├── src/
│   ├── index.mjs             # Main entry (extends container-gateway.mjs)
│   ├── routes/
│   │   ├── bridge.mjs        # /api/v2/im/bridge/* handler
│   │   ├── container.mjs     # /api/container/* proxy
│   │   └── agents.mjs        # /api/agents/* handler
│   ├── db/
│   │   ├── sqlite.mjs        # SQLite operations
│   │   └── schema.sql        # Messages/state/directives tables
│   ├── agent/
│   │   └── openclaw.mjs      # OpenClaw Agent invocation
│   └── lib/
│       ├── static.mjs        # Static file serving
│       └── sse.mjs           # SSE push (optional)
└── dist/
```

### 5.2 API Endpoint Mapping

Frontend calls the **same paths** in both Cloud and Local modes:

| Endpoint | Cloud Implementation | Local Implementation | Response Format |
|----------|-----------|-----------|---------|
| `GET /api/v2/im/bridge/:wsId` | Bridge API + Prisma | Gateway handles locally | `{ ok, data: { status, gatewayUrl } }` |
| `POST /api/v2/im/bridge/:wsId` | Bridge API → Container | Gateway → Agent | `{ ok, data: { response, directives } }` |
| `GET /api/v2/im/bridge/:wsId?include=messages` | IM Database | SQLite | `{ ok, data: { messages: [...] } }` |
| `GET /api/container/:agentId/jupyter/*` | Proxy to Container | Direct proxy to :8888 | Jupyter API |
| `GET /api/container/:agentId/latex/*` | Proxy to Container | Direct proxy to :8080 | LaTeX API |
| `GET /api/agents/:id/health` | Agent Instance query | Always returns healthy | `{ status: 'running' }` |

### 5.3 Local Persistence (SQLite)

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  role TEXT NOT NULL,              -- 'user' | 'agent'
  sender_id TEXT,
  sender_name TEXT,
  metadata TEXT,                   -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,             -- JSON
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE directives (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,           -- JSON
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 5.4 Dual-Mode Operation

```
Mode 1: Cloud (current — no changes)
┌────────────────────────────────────────────────────────┐
│  Browser → Prismer Cloud (:3000)                        │
│  ├── /workspace → workspace-ui (served by Next.js)     │
│  ├── /api/v2/im/bridge → Backend → Container           │
│  └── /api/container/* → Proxy → Container Gateway      │
└────────────────────────────────────────────────────────┘

Mode 2: Local (open-source container)
┌────────────────────────────────────────────────────────┐
│  Browser → Container Gateway (:3000)                    │
│  ├── / → workspace-ui (static SPA)                     │
│  ├── /api/v2/im/bridge → Gateway handles locally → Agent│
│  └── /api/container/* → Direct proxy to :8888/:8080    │
└────────────────────────────────────────────────────────┘
```

**Key**: Same frontend code, same API paths, same response formats.

---

## 6. Migration Strategy

### Phase 1: Extract & Build (1.5 weeks)

1. Create `packages/workspace-ui/` monorepo package
2. Copy workspace components, stores, hooks (no modifications)
3. Set up Vite build with React 19, Tailwind 4, Zustand 5
4. Replace `@/` path aliases with relative imports or Vite aliases
5. Build succeeds, SPA loads with mock data
6. Copy shadcn/ui primitives (`src/components/ui/`)

### Phase 2: Gateway Extension (1 week)

1. Extend Container Gateway: Cloud-compatible API routes
2. Implement Bridge API handler (SQLite messages, Agent invocation, directive reading)
3. Implement Agent API handler (health, status — always return running)
4. Implement Container proxy handler (direct to :8888, :8080)
5. Add static file serving for SPA assets
6. SQLite integration for message/state/directive persistence

### Phase 3: Integrate & Test (0.5 weeks)

1. Update `Dockerfile.openclaw`: `COPY dist/ /app/frontend/`
2. Update `docker/VERSIONS.md` and `docker/compatibility.json`
3. E2E test: container start → open browser → chat works → editors work
4. Same E2E test suite runs against both Cloud and Local modes

### Phase 4: Dual-Mode (follow-up)

1. Prismer frontend imports `@prismer/workspace-ui` as dependency
2. Unify: Cloud mode serves same SPA via Next.js routes
3. Feature flag: `WORKSPACE_EMBEDDED=true` in container env
4. Version compatibility check applies to workspace-ui package too

---

## 7. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Response format mismatch | High | Medium | Contract tests: same test suite for both modes |
| Bundle size too large | Medium | Medium | Lazy-load editors, tree-shake aggressively |
| SQLite integration complexity | Medium | Low | Minimal schema (3 tables), zero-dependency better-sqlite3 |
| Feature parity gaps | Low | Low | API compatibility means 100% feature reuse |
| Maintenance burden (gateway sync) | Medium | High | API format change → update gateway, tested by E2E |
| Editor compatibility in Vite | Medium | Medium | Test each editor in Vite build separately |

---

## 8. Bundle Size Estimates

| Component | Estimated Size | Loading |
|-----------|---------------|---------|
| Core SPA (stores + chat + layout) | ~150 KB gzipped | Immediate |
| WindowViewer (tabs + shell) | ~50 KB gzipped | Immediate |
| Tailwind CSS | ~30 KB gzipped | Immediate |
| **Initial load** | **~230 KB** | |
| PDF Reader | ~250 KB gzipped | Lazy |
| LaTeX Editor (CodeMirror) | ~120 KB gzipped | Lazy |
| Jupyter Client | ~100 KB gzipped | Lazy |
| Code Playground (Monaco) | ~800 KB gzipped | Lazy |
| 3D Viewer (Three.js) | ~200 KB gzipped | Lazy |
| Data Grid (AG Grid) | ~350 KB gzipped | Lazy |
| **All editors loaded** | **~2.05 MB** | |

Container image size impact: **+15-25 MB** (uncompressed static assets)

---

## 9. Plugin Impact

| Plugin | Cloud Mode | Local Mode | Changes Needed |
|--------|-----------|-----------|----------------|
| prismer-workspace | ✅ Works as-is | ✅ Works as-is | **Zero** |
| prismer-im | ✅ Connects to Cloud IM | ❌ Not needed | Not loaded in Local |
| prismer-tools | ✅ Writes directives | ✅ Writes directives | **Zero** |
| container-gateway | ✅ Reverse proxy | ✅ + API compat + SPA | **Extended** |

---

## 10. Comparison Matrix (Updated)

| Criteria | Option A (Next.js) | Option B (New Endpoints) | Option C (Chat Only) | **Option D (API Compat)** |
|----------|------|------|------|------|
| Feature parity | 100% | ~85% | ~20% | **100%** |
| Frontend changes | None | API adaptation layer | Rewrite | **None** |
| Image size increase | +600 MB | +25 MB | +10 MB | **+25 MB** |
| RAM overhead | +512 MB | +0 MB | +0 MB | **+0 MB (static)** |
| API changes | None | 4 new endpoints | 1 new | **Gateway mimics Cloud** |
| Test reuse | 100% | ~50% | ~10% | **100%** |
| Effort | 2-3 weeks | 4-6 weeks | 2-3 weeks | **~2.5 weeks** |
| Open-source value | Low | High | Medium | **High** |
| **Recommendation** | No | No | No | **Yes** |

---

## 11. Key Files Reference

### Frontend (to be extracted — zero modifications)

| Location | Purpose |
|----------|---------|
| `src/app/workspace/components/` | 33+ UI components |
| `src/app/workspace/stores/` | 7 Zustand stores |
| `src/app/workspace/hooks/` | 5 custom hooks |
| `src/app/workspace/lib/` | Sync, directives, events |
| `src/components/editors/previews/` | 8 editor preview components |
| `src/components/ui/` | shadcn/ui primitives |

### Container (to be extended)

| Location | Purpose |
|----------|---------|
| `docker/gateway/container-gateway.mjs` | Add API compat routes + static serving |
| `docker/Dockerfile.openclaw` | Add `COPY dist/ /app/frontend/` |
| `docker/VERSIONS.md` | Add workspace-ui version |
| `docker/compatibility.json` | Add workspace-ui compatibility |

### New Packages (to be created)

| Location | Purpose |
|----------|---------|
| `packages/workspace-ui/` | Extracted Vite SPA package |
| `packages/workspace-ui/vite.config.ts` | Build configuration |

### Architecture Reference

| Document | Purpose |
|----------|---------|
| `docs/OPENSOURCE_ARCHITECTURE.md` | Full API compatibility design, Gateway route specs, SQLite schema |
| `docs/CONTAINER_PROTOCOL.md` | Change Type V: Open-Source Frontend checklist |

---

## 12. Conclusion

Packaging the workspace frontend into the container is **feasible and architecturally sound**. The API Path Compatibility strategy (`docs/OPENSOURCE_ARCHITECTURE.md`) is the optimal approach because:

1. **Zero frontend modification** — the same React code runs in Cloud and Local modes
2. **API path reuse** — Gateway mimics Cloud API endpoints, so same fetch calls work
3. **Test reuse** — same E2E test suite validates both modes
4. **Minimal effort** — ~2.5 weeks, only Gateway extension needed
5. **Low risk** — failure mode is response format mismatch, caught by contract tests
6. **High open-source value** — standalone container = complete research workspace

The previous Option B (new gateway endpoints) is superseded by Option D (API path compatibility), which achieves the same goal with half the effort and zero frontend changes.
