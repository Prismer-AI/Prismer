# Open-Source Extraction Design

> Date: 2026-03-01
> Branch: feat/opensource-backup
> Status: Proposal — pending approach selection

## Background

Prismer.AI (PISA-OS) is a full-stack research platform covering paper discovery, reading, data analysis, writing, and AI-assisted research. The open-source version only needs the **Workspace** module — the AI agent-powered research environment with chat, editors, and timeline.

Current codebase contains 7+ modules (Discovery, Assets, Mobile, Admin, Playground, Auth, Workspace). The goal is to produce a clean open-source release containing only Workspace and its dependencies.

### Existing Design Documents

- `docs/OPENSOURCE_ARCHITECTURE.md` — API Path Compatibility strategy (container mimics cloud API)
- `docs/CONTAINER_FRONTEND_FEASIBILITY.md` — workspace-ui SPA extraction feasibility (~2.5 weeks)

---

## Module Analysis

### Safely Removable (Zero Workspace Dependency)

| Module | Path | Description |
|--------|------|-------------|
| Discovery pages | `src/app/discovery/` | Paper search, categories, statistics |
| Assets pages | `src/app/assets/` | File management, collections, uploads |
| Mobile pages | `src/app/mobile/` | Mobile-specific views (6 sub-routes) |
| Admin pages | `src/app/admin/` | Service monitoring dashboard |
| Playground pages | `src/app/playground/` | Component showcase |
| Papers API | `src/app/api/v2/papers/`, `api/papers/` | Paper CRUD |
| Notebooks API | `src/app/api/v2/notebooks/` | Notebook API |
| Stats API | `src/app/api/v2/stats/` | Statistics API |
| OCR API | `src/app/api/ocr/` | OCR processing |
| AI API | `src/app/api/ai/` | AI chat/translate |
| GitHub API | `src/app/api/github/` | GitHub import |
| Upload API | `src/app/api/upload/`, `api/v2/upload/` | File upload |
| Templates API | `src/app/api/templates/` | LaTeX templates |
| Paper service | `src/lib/services/paper.service.ts` | Paper data service |
| Parser service | `src/lib/services/parser.service.ts` | PDF parsing service |
| Upload service | `src/lib/services/upload.service.ts` | Upload service |
| Remote Paper | `src/lib/services/remote-paper.service.ts` | Remote paper fetching |
| Cloud SDK | `src/lib/cloud/` | @prismer/sdk client |
| Remote DB | `src/lib/remote-db.ts` | Remote MySQL client |
| PaperCard | `src/app/global/components/PaperCard.tsx` | Paper card component |
| ReaderOverlay | `src/app/global/components/ReaderOverlay.tsx` | PDF reader overlay |
| PaperNode | `src/components/editors/paperNode/` | Citation node editor |
| Mobile store | `src/store/mobileStore.ts` | Mobile state |
| Discovery store | `src/app/discovery/store/` | Discovery state |
| Assets stores | `src/app/assets/store/` | Assets state |

### Requires Simplification (Indirect Coupling)

| Module | Change Required |
|--------|-----------------|
| `AppSidebar.tsx` | Remove Discovery/Assets tabs, keep only Workspace + UserMenu |
| `MainLayout.tsx` | Remove ReaderOverlay, UploadModal, useDiscovery imports |
| `uiStore.ts` | Remove `discovery`/`asset` from LibraryTab type |
| `readerStore.ts` | Can be removed entirely (workspace PDF doesn't depend on it) |
| `workspace.service.ts` | Remove collectionService dynamic imports (already has try/catch) |
| `nacos-config.ts` | Simplify to env-only mode |
| `library/page.tsx` | Simplify to direct redirect to `/workspace` |

### Must Keep (Workspace Core)

| Module | Description |
|--------|-------------|
| Auth system | Login/register/OAuth (workspace requires user identity) |
| Workspace API | Sessions, messages, tasks, timeline, component states |
| Agents API | Agent lifecycle management |
| Container API | Container proxy for Jupyter/LaTeX/Gateway |
| IM Bridge API | Agent communication bridge |
| Skills/Config API | Skill and config template management |
| LaTeX/Jupyter API | Editor service proxies |
| LLM API | Usage tracking |
| Health API | Service health checks |
| All editors/previews | 8 editor components (PDF, LaTeX, Jupyter, Code, AI Editor, AG Grid, 3D, Gallery) |
| Sync layer | `src/lib/sync/` — core sync engine |
| Prisma (workspace models) | Database ORM |

### Database Models to Remove

Remove from `prisma/schema.prisma`:
- `Paper`, `OcrTask`, `Figure` (paper discovery)
- `Notebook`, `Note`, `NoteCitation` (notes system)
- `Favorite`, `Like`, `Comment` (social features)
- `Activity`, `UserPaperState` (user behavior tracking)
- `Upload` (file upload tracking)
- Related relations from `User` model

### Risk Points

- **PDF Reader subsystem** (70+ files): Internal references to `discoveryStore`'s `Paper` type and `flowStore`. Requires type extraction to shared location before removing Discovery.
- **readerStore** imports `Paper` type from `discoveryStore` — needs type relocation.

---

## Three Approaches

### Approach A: Trim Next.js Repository

**Strategy**: Delete non-workspace modules from the Next.js codebase, resulting in a slimmed-down full-stack application.

```
What open-source users get:
├── Next.js full-stack app (trimmed)    ← Requires Node.js
├── Prisma + SQLite                     ← Requires database
├── docker-compose.yml                  ← OpenClaw container
└── .env.example
```

**User runs**: `npm install && npm run dev` + `docker compose up` (OpenClaw agent)

| Dimension | Assessment |
|-----------|------------|
| Dev effort | ~3 days |
| Deployment complexity | Medium (Node.js + DB + Docker) |
| Risk | Low (mostly deletions) |
| Time to ship | Fast |
| SSR support | Yes |
| API completeness | Full (all workspace APIs native) |

**Pros**:
- Minimal code changes — mostly deletions + minor simplifications
- All workspace functionality preserved as-is (SSR, API routes, auth)
- Low risk — removed modules have zero workspace imports

**Cons**:
- Users must install Node.js, configure database, set up environment variables
- Repository still includes infrastructure code (auth, prisma, S3) that feels heavy for a "simple" open-source tool
- Two processes to manage (Next.js + Docker)

---

### Approach B: Extract SPA + Extend Gateway (Original Design)

**Strategy**: Extract workspace frontend into a Vite SPA, bundle it inside the container image, and extend container-gateway to serve static files and mimic Next.js API endpoints.

```
What open-source users get:
└── docker-compose.yml
    └── Single container with:
        ├── workspace-ui (Vite SPA)          ← Gateway serves static files
        ├── container-gateway (extended)     ← Mimics 40+ Next.js API endpoints
        ├── SQLite                           ← Local persistence
        └── OpenClaw Agent                   ← AI agent backend
```

**User runs**: `docker compose up` — single command, done.

| Dimension | Assessment |
|-----------|------------|
| Dev effort | ~2.5 weeks |
| Deployment complexity | Low (Docker only) |
| Risk | Medium (Gateway must faithfully replicate API behavior) |
| Time to ship | Slow |
| SSR support | No (SPA mode) |
| API completeness | Tiered (Tier 1-2 first, stubs for Tier 3) |

**Pros**:
- Simplest possible deployment — one Docker command
- No external dependencies (Node.js, DB, S3 not needed)
- Clean separation: open-source = container, cloud = full platform

**Cons**:
- Gateway needs to implement 40+ API endpoints (Tier 1: 8, Tier 2: 7, Tier 3: 8 stubs)
- Loses SSR (SPA mode, slower initial load)
- Higher risk: API behavior mismatch between Gateway and Next.js could cause subtle bugs
- Larger development effort

**Reference**: See `docs/OPENSOURCE_ARCHITECTURE.md` for full API tier breakdown and `docs/CONTAINER_FRONTEND_FEASIBILITY.md` for module inventory.

---

### Approach C: Two-Phase (Recommended)

**Strategy**: Phase 1 delivers a trimmed Next.js repo (Approach A) for immediate usability. Phase 2 evolves it into a container-embedded SPA (Approach B) for single-command deployment.

```
Phase 1 (Week 1):
├── Trimmed Next.js app           ← Quick, functional open-source release
├── docker-compose.yml            ← Web + Agent orchestration
└── .env.example                  ← Simplified config

Phase 2 (Weeks 2-4):
└── docker-compose.yml
    └── Single container          ← Ultimate simplicity
        ├── workspace-ui SPA
        ├── extended Gateway
        └── OpenClaw Agent
```

| Dimension | Assessment |
|-----------|------------|
| Dev effort | ~3 days (Phase 1) + ~2.5 weeks (Phase 2) |
| Deployment complexity | Medium → Low |
| Risk | Low → Medium |
| Time to first release | Fast (Phase 1 ships in days) |
| SSR support | Yes (Phase 1) → No (Phase 2) |

**Pros**:
- Ship a usable open-source version quickly (Phase 1)
- Phase 1 validates which APIs workspace truly needs at runtime — informing Gateway implementation
- Reduces Phase 2 risk: trimmed codebase makes SPA extraction clearer
- Users get two deployment options: developer mode (Next.js) and production mode (Docker-only)

**Cons**:
- Total effort is slightly more than either approach alone
- Two deployment modes to maintain (though Phase 1 becomes "developer mode")

**Why recommended**: Phase 1 is a strict prerequisite for understanding Phase 2. Trimming the codebase first reveals the true workspace API surface, which directly feeds into Gateway API design. Attempting Phase 2 first means implementing Gateway APIs against an untested module boundary.

---

## Decision Matrix

| Criteria | A: Trim Repo | B: SPA + Gateway | C: Two-Phase |
|----------|:---:|:---:|:---:|
| Time to first release | ++ | - | ++ |
| Deployment simplicity | + | ++ | ++ (eventual) |
| Development risk | ++ | - | + |
| Maintenance burden | + | + | - |
| User experience | + | ++ | ++ (eventual) |
| **Overall** | **Good** | **Good** | **Best** |

---

## Pending Decision

Select one approach to proceed with implementation planning:
- **A**: Fast trim, slightly heavier deployment
- **B**: Skip to single-command deployment, longer timeline
- **C**: Ship fast, then iterate toward simplicity
