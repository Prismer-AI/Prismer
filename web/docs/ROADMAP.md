<!--
 Copyright 2026 prismer

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

# ROADMAP — Engineering Roadmap

> Last updated: 2026-03-06
> Status: Phase 1-3 complete ✅, Phase 4A complete ✅, Phase 4B IM MVP complete ✅ (with FK fix)
> **Container Image**: v5.0-openclaw (prismer-workspace 0.5.0, gateway 1.1.0). See `docker/VERSIONS.md`.
> **MVP Full Chain**: Plugin v0.5.0 (26 tools), workspace-collection auto-binding, workspace-aware LaTeX compile, artifact save + gallery pipeline. See `docs/MVP_FULL_CHAIN.md`.
> Workspace lifecycle management: Readiness gate + disabled states + health monitor + task pipeline ✅
> **Test Infrastructure**: 4-layer test system — Unit (~50+) + L1 (21) + L2 (32) + L3 (6) = 59+ tests ✅

---

## Overview

```
Phase 0   (DONE)    → Foundation: UI framework, editor components, sync layer
Phase 1   (DONE)    → Workspace: multi-workspace, bot instance, connection UI
Phase 1.5 (DONE)    → WindowView convergence: visual, AI, assets, sync unification
Phase 2   (DONE)    → Integration: Discovery → Assets → Workspace flow
Phase 3   (DONE)    → Agent: Service abstraction, OpenClaw client, container lifecycle, persistence, LLM gateway
Phase 4   (STARTED) → Cloud SDK + Data Architecture: persistence, context, files, IM convergence, agent automation (4A-B ✅, 4C-G pending)
Phase 5             → Ecosystem: npm package extraction, open source
Phase 6             → Agent-Native Software: OpenCode + Skill standard for agent-built custom interactive applications
```

---

## Phase 0 — Foundation (COMPLETED)

**Delivered**:
- Next.js 16 + React 19 app framework
- 3-page structure: Discovery / Assets / Workspace with shared MainLayout
- 8 editor components in WindowViewer (pdf-reader, latex, jupyter, code-playground, ai-editor, ag-grid, bento-gallery, three-viewer)
- WorkspaceChat: chat panel + TaskPanel + ActionBar + InteractiveComponents
- WebSocket sync engine (SyncMatrixEngine, useAgentConnection, useAgentStore)
- Demo flow system (DemoFlowController + VLA research demo)
- Agent server (scripts/agent-server.ts) with demo endpoints
- Mobile layout (Tauri 2 iOS) with MobileChat + MobileDrawer
- Database schema: 37 Prisma models across 7 domains
- Service layer: paper, asset, collection, upload, parser, auth services
- CI/CD: GitLab CI + Docker + ArgoCD

---

## Phase 1 — Workspace Management (COMPLETED)

**Goal**: Workspace = Bot Instance container. Multi-workspace CRUD. Connection state UI.

### 1A. Data Layer
- [x] Workspace CRUD service (`workspace.service.ts`) — full CRUD with ownership validation
- [x] API routes: `GET/POST /api/workspace`, `GET/PATCH/DELETE /api/workspace/[id]`
- [x] Wire WorkspaceSession Prisma model to API with cascading delete

### 1B. Multi-Workspace Routing
- [x] Dynamic route: `/workspace/[workspaceId]/page.tsx` with ownership validation
- [x] `/workspace` redirect to most recent or create default via `getOrCreateDefault()`
- [x] WorkspaceView receives `workspaceId` prop → `useDesktopAgent({ sessionId: workspaceId })`

### 1C. Connection Status Indicator
- [x] `ConnectionIndicator.tsx` component with 4 states
- [x] States: connected (green pulse), connecting (yellow spin), disconnected (red), error
- [x] Popover: workspace name, agent ID, connection duration, reconnect/disconnect buttons
- [x] Integrated into WindowViewer/ComponentTabs

### 1D. Sidebar Workspace Management
- [x] `WorkspaceTabButton.tsx` with dropdown menu (workspace list + New + Manage)
- [x] `CreateWorkspaceDialog.tsx` (name + description form)
- [x] `ManageWorkspacesDialog.tsx` (list, edit, delete with confirmation)
- [x] Replace Workspace TabButton in AppSidebar.tsx

### 1E. Edge Cases
- [x] Auto-create "Default Workspace" on first visit
- [x] Handle delete of current workspace (switch to next via `getNextWorkspace()`)
- [x] Permission validation (user can only access own workspaces)

---

## Phase 1.5 — WindowView Component Convergence (COMPLETED)

**Goal**: Unify 8 WindowViewer editor components into a coherent visual system with shared AI gateway, asset management, and state sync.

**Design doc**: `docs/WINDOWVIEW_CONVERGENCE.md`

### 1.5A. Foundation
- [ ] Fix `/api/ai/chat` temperature bug (reasoning model parameter normalization)
- [ ] Create `ai-client.ts` — unified AI call client for all components
- [ ] Fix LaTeX content disappearing on mode switch (conditional render → CSS hidden)
- [ ] Create `ComponentToolbar.tsx` — standardized toolbar (h-10, px-3 py-2, left/center/right slots)

### 1.5B. Visual Convergence
- [ ] **Jupyter**: remove hardcoded bg-slate-950, floating sidebar, merge connection indicators, auto-connect
- [ ] **LaTeX**: remove theme toggle, remove AgentChatPanel, merge Preview header, TexLive periodic health check
- [ ] **Code Playground**: remove theme toggle, fix layout toggle, add Frontend/Script mode switcher
- [ ] **AG Grid**: remove forced dark container, CSS custom property theme, add dataset tab management
- [ ] **AI Editor**: toolbar horizontal scroll, add multi-note management
- [ ] **PDF Reader**: remove self-owned border/shadow (minimal change)

### 1.5C. LLM Gateway Unification
- [ ] Migrate 5 components to `ai-client.ts`
- [ ] Implement `LLMUsageLog` recording in `/api/ai/chat` (per user, per component)
- [ ] Validate `OPENAI_API_BASE_URL` env config → NewAPI for all environments

### 1.5D. Asset Browser
- [ ] Create shared `AssetBrowser.tsx` (CommandPalette-style file browser)
- [ ] Integrate into Notes, AG Grid, Jupyter toolbars
- [ ] Enable PDF Reader "Notes" selection popup option
- [ ] Artifacts → Notes insertion (Jupyter ArtifactsPanel → AI Editor)

### 1.5E. State Sync Activation
- [ ] Add Jupyter to `componentStateConfig.ts`
- [ ] Bridge `componentStore.updateComponentState()` → `componentEventForwarder`
- [ ] Replace DOM event listeners (`demo:*`, `agent:directive:*`) with sync engine dispatch
- [ ] Debounced content sync for LaTeX, Code Playground, AI Editor

### 1.5F. Deep Integration
- [ ] Jupyter Cell → Agent Skill (cell ops as container agent commands)
- [ ] Jupyter Copilot redesign (inline completion, ghost cell, error auto-fix)
- [ ] LaTeX Copilot via `@latex` directive in Workspace chat → sync engine → editor

---

## Phase 2 — Page Integration

**Goal**: Seamless Discovery → Assets → Workspace research flow.

### 2A. Discovery → Assets Bridge
- [ ] "Add to Assets" action in PaperCard/ReaderOverlay
- [ ] Deduplication check (user already has this paper?)
- [ ] Toast notification on success

### 2B. Assets → Workspace Bridge
- [ ] "Open in Workspace" button on AssetCard
- [ ] Create workspace session with paper pre-loaded
- [ ] Auto-switch to PDF reader with the paper

### 2C. Workspace → Assets Bridge
- [ ] "Save to Assets" for agent-generated artifacts
- [ ] LaTeX output → note asset
- [ ] Jupyter output → notebook asset

### 2D. Shared Paper Context
- [ ] `documentId` as universal key across all three pages
- [ ] Discovery: `documents.id`
- [ ] Assets: `po_user_assets.document_id`
- [ ] Workspace: loaded in PDF reader via `documentId`

---

## Phase 3 — OpenClaw Agent Integration (COMPLETED)

**Goal**: Replace demo server with real OpenClaw agent containers.

### 3A. Agent Service Abstraction ✅
- [x] Define `AgentService` interface: `startSession()`, `executeTask()`, `handleInteraction()`
  - `src/lib/agent/types.ts`: Full interface with SessionConfig, TaskConfig, UserInteraction types
- [x] Wrap DemoController in `DemoAgentService` (backward compatible)
  - `src/lib/agent/DemoAgentService.ts`: Complete implementation with demo flow system
- [x] Define `AgentEvent` → sync protocol message mapping
  - `src/lib/agent/eventMapper.ts`: agentEventToSyncMessage, MessageAccumulator, ToolCallTracker
- [x] `AgentServiceFactory` for runtime service selection
  - `src/lib/agent/AgentServiceFactory.ts`: createAgentService() based on env config

### 3B. OpenClaw Client ✅
- [x] Implement `OpenClawAgentService`
  - `src/lib/agent/OpenClawAgentService.ts`: Full WebSocket client implementation
- [x] WebSocket client for OpenClaw Gateway API
  - Reconnection logic, heartbeat mechanism, request/response with timeouts
- [x] Streaming: OpenClaw events → `AgentEvent` stream → sync broadcast
  - Event handlers for all OpenClaw message types mapped to AgentEvent

### 3C. Container Lifecycle ✅
- [x] **Unified Container Gateway** (v1.1.0) — single port, `/api/v1/{service}/*` routing
  - `container-gateway.mjs`: pure Node.js reverse proxy, zero deps
  - Services: LaTeX(:8080), Prover(:8081), Jupyter(:8888), Gateway(:18900), arXiv(:8082)
  - Aggregated health endpoint, WebSocket relay, Jupyter token injection
  - Performance: health check avg 2.4ms, 306 req/s concurrent
- [x] **Fixed host port 16888** — unified port for dev/standalone/k8s
  - `docker-compose.dev.yml`: `16888:3000`
  - `docker-compose.openclaw.yml`: `16888:3000`
  - `dockerOrchestrator.ts`: `DEFAULT_HOST_PORT = 16888`
- [x] **Dual-mode orchestration** — Docker + Kubernetes
  - `k8sOrchestrator.ts`: Full `ContainerOrchestrator` implementation for K8s
  - `k8sClient.ts`: K8s API client singleton with 3 auth modes (remote/kubeconfig/in-cluster)
  - Per-agent orchestrator resolution via `Container.orchestrator` DB field
  - Pod naming: `prismer-agent-{agentId}`, Service: `prismer-svc-{agentId}`
  - K8s NodePort (30000-32767) for external access, gateway URL: `ws://{nodeIP}:{nodePort}`
  - All API routes (start/stop/logs/health) use per-agent orchestrator selection
  - Auto-recovery supports multi-orchestrator (Docker or K8s per agent)
  - Mock fallback for both `DOCKER_NOT_AVAILABLE` and `K8S_NOT_AVAILABLE`
- [x] **arXiv-to-prompt integration** — paper → flattened LaTeX for LLM reading
  - `arxiv-server.py`: HTTP wrapper on port 8082 (convert, sections, abstract)
  - Added `arxiv_to_prompt` tool to prismer-workspace skill plugin
- [x] **Frontend client simplified** — `buildServiceUrl()` → `http://{host}:{port}/api/v1/${service}/${path}`
  - Docker: host=`localhost`, K8s: host=`nodeAddress` from `K8S_NODE_EXTERNAL_IP`
- [x] AgentInstance ↔ Container (1:1) lifecycle management
  - `src/lib/container/dockerOrchestrator.ts`: Docker container lifecycle
  - `src/lib/container/k8sOrchestrator.ts`: K8s pod + service lifecycle
- [x] Start/stop/restart agent containers
  - Via ContainerOrchestrator interface methods (Docker and K8s)
- [x] Health monitoring + auto-recovery
  - `src/lib/container/autoRecovery.ts`: ContainerAutoRecoveryService with per-agent orchestrator
  - `src/app/api/agents/health/route.ts`: Aggregated health monitoring endpoint
- [x] Resource limits enforcement
  - Memory/CPU limits in ContainerConfig, enforced by DockerOrchestrator and KubernetesOrchestrator

### 3D. Session Persistence ✅
- [x] Define `SessionPersistence` interface
  - `src/lib/sync/persistence/types.ts`: saveSession, loadSession, listSessions, deleteSession
- [x] Implement `PrismaSessionPersistence` using existing schema
  - `src/lib/sync/persistence/PrismaSessionPersistence.ts`: Full Prisma-based implementation
- [x] Implement `MemorySessionPersistence` for development
  - `src/lib/sync/persistence/MemorySessionPersistence.ts`: In-memory fallback
- [x] Integrate persistence into sync-server
  - `scripts/sync-server.ts`: Updated with persistence layer, SYNC_PERSISTENCE env toggle

### 3E. LLM Gateway ✅
- [x] LLM usage tracking (LLMUsageLog model)
  - `src/lib/llm/usageLogger.ts`: logLLMUsage, extractUsageFromOpenAI, logStreamingUsage
  - Integrated into `/api/ai/chat` route
- [x] Multi-provider support (Anthropic, OpenAI)
  - `src/lib/llm/types.ts`: MODEL_PRICING for Claude, GPT-4, DeepSeek models
  - Provider detection and cost calculation per model
- [x] Cost monitoring per user/workspace
  - `src/app/api/llm/usage/route.ts`: Usage statistics API
  - `src/app/api/llm/cost/route.ts`: Cost monitoring with threshold alerts
  - getUserUsageStats, getAgentUsageStats, getGlobalUsageStats, checkCostThreshold

### 3F. Frontend ↔ Container Integration ✅
- [x] **Status API + Management UI** — `orchestrator` field in status/workspace-agent APIs, Docker/K8s badge in StatusTab
- [x] **Agent Instance Store** — `gatewayUrl`, `containerHostPort`, `orchestratorType` in agentInstanceStore; `fetchAgentBinding()` action; persist `agentInstanceId` + `gatewayUrl`
- [x] **WorkspaceView Wiring** — Fetches agent binding on mount, passes `gatewayUrl` to `useDesktopAgent`, fixed 3 hardcoded `workspaceId: 'demo'`
- [x] **Container Bridge** — `ContainerBridge` in agent-server.ts bridges frontend sync protocol ↔ OpenClaw WebSocket protocol, per-session routing (demo vs real container)
- [x] **UI Polish** — LogsTab overflow fixed (removed Framer Motion), ComponentTabs 3-pill layout, Jupyter proxy route, IM FK constraint fix
- [ ] **Runtime verification** — Chat ↔ container real-time communication needs end-to-end testing
- [ ] **Connection status sync** — Management dialog and WindowViewer header use separate data sources
- [x] **Workspace Lifecycle Management** (2026-02-25)
  - `WorkspaceReadinessGate`: Universal overlay (idle/starting/error/connecting states)
  - `useHealthMonitor`: 60s periodic polling, 3-failure escalation to error state
  - `WindowViewer` + `WorkspaceChat` disabled when agent not ready
  - `parseAgentResponse()` extracts structured tasks from agent responses
  - `ChatInput` disabled state with static placeholder, disabled buttons

### Target Architecture: Unified Workspace Data Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Zustand)                  │
│  chatStore ◄──► taskStore ◄──► timelineStore ◄──► contextStore │
│                         │                                       │
│                useDesktopAgent (WebSocket)                      │
└────────────────────────┬───────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│                  agent-server.ts (port 3456)                    │
│                                                                 │
│  SessionStore (memory) ◄──► PersistenceProxy ──► Next.js API   │
│       │                          │                              │
│       │                 /api/workspace/:id/{messages,tasks,     │
│       │                  timeline,files,session}                 │
│       │                          │                              │
│  ContainerBridge ◄── ContextManager (@prismer/sdk)             │
│       │                                                         │
└───────┼─────────────────────────────────────────────────────────┘
        │ WebSocket
┌───────▼─────────────────────────────────────────────────────────┐
│  Container (OpenClaw) ← messages + context + files              │
└─────────────────────────────────────────────────────────────────┘
```

**Source of Truth**: Prisma DB (`WorkspaceMessage`, `WorkspaceTask`, `WorkspaceTimelineEvent`, `WorkspaceFile`).
agent-server.ts persists via PersistenceProxy (HTTP → API → Prisma). Cloud SDK provides external services (Context/Parse/CDN).

**Key design decisions**:
1. **agent-server.ts remains** — handles full session sync (8 component types, UI directives, tasks, timeline). SDK realtime only covers message delivery.
2. **PersistenceProxy pattern** — agent-server.ts calls Next.js REST APIs (avoids Prisma client duplication).
3. **Unified message path** — WorkspaceMessage is sole write path. IMMessage reserved for cross-workspace communication.
4. **ContextManager** — Cloud SDK `context.load()` + `parsePdf()` for paper content, injected into agent prompts.
5. **File sync** — DB ↔ Container via ContainerBridge. Large files via `im.files.upload()` → CDN.

See `docs/ARCH.md` section 6 for detailed data flow diagrams.

### Post-Phase 3 — Infrastructure & Integration Work (COMPLETED)

> Unplanned work that emerged during Phase 3→4 transition (2026-02-22 through 2026-02-27).

#### IM Bridge API & Container Chat ✅
- [x] `/api/v2/im/bridge/[workspaceId]` — Bridge endpoint (POST chat, GET status/history) with component context injection
- [x] `useContainerChat.ts` (448 lines) — Simplified chat hook for container mode (no external IM server)
- [x] `useIMChat.ts` (641 lines) — Full Cloud IM SDK chat hook with registration + WebSocket
- [x] `openclawGatewayClient.ts` (425 lines) — OpenClaw WebSocket client with HMAC-SHA256 challenge auth

#### Plugin Rewrite ✅
- [x] `prismer-workspace` rewritten to OpenClaw `registerTool()` API — 18 individual tools
- [x] Plugin configSchema updated (`openclaw.plugin.json`) — `apiBaseUrl`, `agentId`, `workspaceId`
- [x] Plugin version: 0.4.0 → 0.5.0

#### Version Management System ✅
- [x] SSoT chain: `version.ts` → `compatibility.json` → `versions-manifest.json` → `VERSIONS.md`
- [x] `CONTAINER_PROTOCOL.md` — 6 change-type checklists for container modifications
- [x] Compatibility validation at container startup

#### Container Image v4.4 → v4.5 ✅
- [x] Cleaned old containers/images (v4.2, v4.3, v4.4)
- [x] Fixed `workspaceId` in plugin configSchema (OpenClaw validation error)
- [x] Built v4.5-openclaw — all 5 services healthy

#### 4-Layer Test System ✅
- [x] **Unit** (`tests/unit/`, 8 files, vitest): directive mapping, stores, components, hooks, API handlers
- [x] **Layer 1** (`tests/layer1/`, 5 files, 21 tests): container health, bridge protocol, directive SSE, context API, data tools
- [x] **Layer 2** (`tests/layer2/`, 7 files, 32 tests): T0 identity, T1 LaTeX, T2 Jupyter, T3 Notes, T4 PDF, T5 Context, component CRUD
- [x] **Layer 3** (`tests/layer3/`, 2 files, 6 tests): real agent MVP scenarios (identity, LaTeX, Jupyter, Notes) + data workflow
- [x] Test helpers: `mockAgentReady()`, `forceAgentRunning()`, `injectDirective()`, `api-client.ts`, trace collector
- [x] Playwright config: 3 projects (layer1/layer2/layer3) with separate timeouts and browser settings

#### Demo Orchestrator ✅
- [x] `demoOrchestrator.ts` (578 lines) — multi-step demo flow simulation
- [x] Pre-built content: VIT survey (LaTeX), cosine curve (Jupyter), ablation study (HTML)
- [x] Artifact type system: `latex`, `jupyter`, `pdf`, `web`, `image`, `code`

#### Mobile Restructure ✅
- [x] 3-tab architecture: Command / Files / Me (replaced single chat view)
- [x] New components: `BottomTabBar`, `BottomSheet`, `SafeAreaView`, `MobileHeader`
- [x] Mobile store with platform detection, orientation, safe area insets, keyboard state
- [x] Routes: `/mobile/command`, `/mobile/files`, `/mobile/me`

#### Structured Logging ✅
- [x] `src/lib/logger.ts` (320 lines) — correlation IDs, child loggers, timing support
- [x] Applied across: bridge API, agent start, health monitor, chat hooks, gateway client

---

## Phase 4 — Cloud SDK Integration (IN PROGRESS)

**Goal**: Integrate @prismer/sdk v1.7 for Cloud services (Context, Parse, IM) + unified data persistence.

**Reference**: `docs/API_SCHEMA_ANALYSIS.md` for SDK v1.7 gap analysis.

### 4A. SDK Installation & Setup ✅
- [x] Add `@prismer/sdk` to dependencies
- [x] Create `src/lib/cloud/` client wrapper (7 files)
- [x] Configure environment variables (PRISMER_API_KEY, PRISMER_BASE_URL)
- [x] Add SDK initialization to app startup (singleton pattern)

### 4B. IM System Activation (MVP COMPLETE ✅)
- [x] **IM Service Layer** (`src/lib/services/im.service.ts`)
  - IMUser CRUD: register, getById, getByUsername, updateAgentStatus, discoverAgents
  - IMConversation CRUD: create, getOrCreateDirect, getById, list, addParticipant
  - IMMessage CRUD: send, list, updateStatus, getThread, countUnread
  - Workspace integration: init (1:1), initGroup, addAgent, listAgents
  - **Bug fix**: FK constraint on `IMUser.userId` — added User existence check before setting FK (dev fallback user `dev-user-1` doesn't exist in User table)
- [x] **IM API Routes** (`/api/v2/im/*`)
  - `POST /api/v2/im/register` — Agent/user registration
  - `GET/POST /api/v2/im/conversations` — List/create conversations
  - `GET/PATCH /api/v2/im/conversations/[id]` — Get/update conversation
  - `GET/POST /api/v2/im/conversations/[id]/messages` — Message history/send
  - `GET/POST/PUT /api/v2/im/workspace/[workspaceId]` — Workspace-IM binding (added detailed error reporting in dev mode)
- [x] **Frontend Integration** (`src/app/workspace/hooks/useIMSync.ts`)
  - Auto-initialize IM conversation on workspace load
  - Persist user/agent messages to IM backend
  - Load message history from IM
  - Feature flag: `USE_IM_PERSISTENCE`
- [x] **Prismer IM Plugin Types** (`docker/plugin/prismer-im/src/types.ts`)
  - Updated IMMessageType with SDK v1.7 types: text, markdown, code, image, file, tool_call, tool_result, system_event, thinking
- [ ] Agent-to-agent communication via `client.im.direct.send()`
- [ ] Agent-to-human notification flow via `client.im.groups.send()`
- [ ] File uploads via `client.im.files.upload()` (up to 50MB, multipart)
- [ ] Migrate to Cloud SDK client (replace local API routes)
- Note: `im.realtime.connectWS()` will NOT replace agent-server.ts (see 3F architecture notes)

### 4C. Persistence Foundation (NEW — Phase 0)
Activate existing `PrismaSessionPersistence` for full workspace data persistence.
- [ ] **PersistenceProxy** in agent-server.ts — HTTP calls to Next.js API for persistence
- [ ] **API Routes**: `GET/POST /api/workspace/:id/messages`, `.../tasks`, `.../timeline`, `.../session`
- [ ] **Session hydration** — Frontend loads messages/tasks/timeline from DB on page load
- [ ] **useIMSync simplification** — Remove dual-write, keep IM init only
- [ ] **Schema update** — Add `parentId`, `status` to `WorkspaceMessage`

### 4D. Context API Integration (NEW — Phase 1)
- [ ] **ContextManager** class (`src/lib/context/contextManager.ts`) using Cloud SDK
- [ ] Paper content loading via `client.load(arxivUrl)` → HQCC
- [ ] PDF parse fallback via `client.parsePdf(url)` → `context.save()`
- [ ] Search with ranking via `client.search(query)`
- [ ] **contextStore** (Zustand) — active paper context state
- [ ] Wire PDF reader COMPONENT_EVENT → ContextManager
- [ ] Enrich agent messages with paper context in ContainerBridge

### 4E. File Pipeline (NEW — Phase 2)
- [ ] **File upload UI** in ChatInput.tsx (Paperclip button + drag-drop)
- [ ] **Binary file upload** via `im.files.upload()` for large files → CDN URL
- [ ] **Container file sync** — ContainerBridge.syncFilesOnConnect(), pushFileToContainer()
- [ ] **File message rendering** in MessageList.tsx (image preview, PDF link, etc.)
- [ ] **fileStore** (Zustand) — workspace file state

### 4F. IM Convergence (NEW — Phase 3)
- [ ] Unify message path: WorkspaceMessage only (remove IMMessage dual-write)
- [ ] Extend sync matrix with `files` and `context` rules
- [ ] Extend SessionState type with `files` and `activeContext` fields

### 4G. Agent Automation (Cron, Hooks, Heartbeat)

> Design: `docs/DESIGN.md` Agent Scheduler Panel, `docs/ARCH.md` Section 12.5
> Protocol: `docs/CONTAINER_PROTOCOL.md` Change Type VI

#### 4G.1 Backend Cron Job Management
- [ ] Prisma model: `AgentCronJob` with schedule, payload, delivery, gatewayJobId
- [ ] API: `GET/POST /api/agents/:id/cron` — list + create cron jobs
- [ ] API: `PATCH/DELETE /api/agents/:id/cron/:jobId` — update + delete
- [ ] Container deployment: `deployCronJobs()` writes `jobs.json` to container
- [ ] Bidirectional sync: detect agent-created jobs via gateway `/jobs` endpoint
- [ ] Re-deploy all cron jobs on container restart (DB is SSoT)

#### 4G.2 Hook Management
- [ ] API: `GET /api/agents/:id/hooks` — list hooks from container HOOK.md files
- [ ] API: `PATCH /api/agents/:id/hooks/:hookId` — enable/disable individual hooks
- [ ] Hook state persisted in `AgentConfig.hooks` JSON field

#### 4G.3 Heartbeat Configuration
- [ ] API: `PATCH /api/agents/:id/heartbeat` — enable/disable + interval
- [ ] Heartbeat config deployed as cron job (kind: `interval`, everyMs: 1800000)
- [ ] Container gateway schedule type: `systemEvent` + `wakeMode`

#### 4G.4 Scheduler Panel UI
- [ ] ⏰ button in WorkspaceChat ActionBar
- [ ] Job list view with Cron/Hooks/Heartbeat tabs
- [ ] New Job dialog (name, schedule, prompt, session type, timezone)
- [ ] Edit/Pause/Resume/Delete actions on existing jobs
- [ ] Hook toggle switches
- [ ] Heartbeat enable/disable + interval slider

### 4E. Backend Convergence
- [ ] Replace custom API clients with `@prismer/sdk` patterns
- [ ] TS API routes become thin proxies to Cloud SDK
- [ ] Dual-write period for consistency verification
- [ ] TS API retained for: WebSocket sync, agent session, frontend-specific logic
- [ ] Webhook handler with HMAC-SHA256 verification (`PrismerWebhook`)

---

## Phase 5 — Open-Source & Ecosystem

**Goal**: Open-source the workspace as a standalone container + extract reusable component packages.

**Design doc**: `docs/OPENSOURCE_ARCHITECTURE.md`
**Feasibility**: `docs/CONTAINER_FRONTEND_FEASIBILITY.md`

### 5A. Workspace-UI Package (Priority — ~2.5 weeks)

> Strategy: API Path Compatibility — Gateway mimics Next.js API, frontend code 100% reused with zero modifications.

#### 5A.1 Extract & Build
- [ ] Create `packages/workspace-ui/` monorepo package
- [ ] Copy workspace components, stores, hooks (zero modifications)
- [ ] Set up Vite build with React 19, Tailwind 4, Zustand 5
- [ ] Replace `@/` path aliases with Vite-compatible aliases
- [ ] Copy shadcn/ui primitives
- [ ] Build succeeds, SPA loads standalone

#### 5A.2 Gateway API Compatibility
- [ ] Extend `container-gateway.mjs` with Cloud-compatible routes:
  - `/api/v2/im/bridge/:wsId` — Chat bridge (GET status, POST chat, GET history)
  - `/api/agents/:id/health` — Fixed healthy response
  - `/api/agents/:id/status` — Fixed running response
  - `/api/agents/:id/directive` — Directive storage for plugins
  - `/api/container/:id/jupyter/*` — Direct proxy to :8888
  - `/api/container/:id/latex/*` — Direct proxy to :8080
- [ ] SQLite integration for message/state/directive persistence
- [ ] Static file serving for SPA assets at `/`

#### 5A.3 Container Integration
- [ ] Update `Dockerfile.openclaw` to COPY workspace-ui dist
- [ ] Update `docker/VERSIONS.md`, `compatibility.json`, `versions-manifest.json`
- [ ] E2E: container `:3000` in browser → chat + editors work
- [ ] Same E2E test suite validates both Cloud and Local modes

#### 5A.4 Plugin Compatibility
- [ ] Verify `prismer-workspace` plugin works in Local mode (zero changes expected)
- [ ] Configure Local mode to not load `prismer-im` (not needed)
- [ ] Directive pipeline works: Agent → directive files → Gateway → frontend

### 5B. Component Package Extraction
> Note: Phase 6 (Agent-Native Software) 中成熟的 Agent 生成应用最终沉淀为 `@prismer/mod-*` 标准模块，与此处的组件提取共享分发体系。

- [ ] `@prismer/paper-reader` — PDF reader component
- [ ] `@prismer/latex-editor` — LaTeX editor
- [ ] `@prismer/jupyter-kernel` — Jupyter integration
- [ ] `@prismer/code-sandbox` — WebContainer playground
- [ ] `@prismer/academic-tools` — Citation, search, bibliography
- [ ] `@prismer/agent-protocol` — Agent communication protocol

### 5D. Public Workspace & Social Distribution

> Prerequisite: Phase 5A (workspace-ui) substantially complete.
> Design: `docs/DESIGN.md` Section 5.4, `docs/WINDOWVIEW_DESIGN.md` Section 7.4

#### 5D.1 Visibility & Access Control
- [ ] Workspace visibility enum: `private` | `unlisted` | `public`
- [ ] Schema: `WorkspaceSession.visibility`, `WorkspaceStar`, `WorkspaceFork`, `WorkspaceComment` models
- [ ] API: `PATCH /api/workspace/:id/visibility` — toggle public/private
- [ ] Guest access: unauthenticated read-only route for public workspaces
- [ ] Rate limiting + abuse prevention for public endpoints

#### 5D.2 Social Features
- [ ] Star: `POST /api/workspace/:id/star` — toggle + count
- [ ] Fork: `POST /api/workspace/:id/fork` — deep copy context (papers, notebooks, drafts, agent config)
- [ ] Comment: `POST /api/workspace/:id/comments` — threaded comments (separate from Agent chat)
- [ ] Collaboration request: `POST /api/workspace/:id/collaborate` — request + Owner approve/reject
- [ ] Activity feed: forks, stars, comments → notification to Owner

#### 5D.3 Discovery Integration
- [ ] Discovery tab: "Trending Workspaces" section alongside papers
- [ ] Trending algorithm: stars + forks + recent activity weighted
- [ ] Category/discipline tags for public workspaces
- [ ] Search: include public workspaces in Discovery search results

#### 5D.4 Read-Only UI Mode
- [ ] WindowViewer: all components render in read-only (view annotations, outputs, previews)
- [ ] Chat Panel: scrollable history, no input; comment section at bottom
- [ ] Timeline: full read-only with replay capability
- [ ] Social bar: Star / Fork / Comment / Request Collaborate buttons
- [ ] Mobile: public workspace accessible via mobile read-only view

---

## Phase 6 — Agent-Native Software Standard

**Goal**: 建立一套标准，使 Agent（OpenClaw + OpenCode）能够根据用户需求，**直接构建出可交互的定制化软件**——一个全新的软件品类。用户描述需求，Agent 自主完成前后端开发，产出一个 Agent 可控制、人可交互的完整应用。

**Design doc**: `docs/MODULAR_COMPONENT_ARCHITECTURE.md`

**核心洞察**：Prismer 容器已经具备两个关键的可扩展运行时：
1. **后端**：Container Gateway (`.mjs`) 可以动态加载新 endpoint——Agent 写 `.mjs` 文件即可创建新 API
2. **前端**：Code Playground 已有完整的 React 编译运行能力——Agent 写 React 代码即可创建新 UI

缺的是一个**标准**把它们串起来：Skill 定义能力边界 → OpenCode 执行代码生成 → 容器 endpoint 提供后端 → Code Playground 渲染前端 → Agent 持续控制 → 用户直接交互。

```
┌─────────────────────────────────────────────────────────────┐
│  User: "I need a real-time stock dashboard with alerts"     │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│  OpenClaw Agent — 理解需求，拆解为前端+后端+数据，选择 Skill │
│  ↓ invokes OpenCode (Claude Code CLI) inside container     │
└────────────────────────┬───────────────────────────────────┘
                         ↓
        ┌────────────────┴────────────────┐
        ↓                                 ↓
┌───────────────────┐          ┌────────────────────────┐
│ Backend Endpoint   │          │ Frontend Component      │
│ /api/v1/custom/    │          │ React app in Code       │
│  stock-dashboard   │          │ Playground (HtmlPreview │
│ (.mjs in gateway)  │          │ or WebContainer)        │
└────────┬──────────┘          └──────────┬─────────────┘
         │     postMessage bridge          │
         └──────────── ↔ ─────────────────┘
                       ↕
              ┌────────────────┐
              │ User interacts │  Agent observes & controls
              │ with live app  │  via directive + postMessage
              └────────────────┘
```

### 6A. Container Endpoint Runtime — 可扩展后端 (2 weeks)

**Goal**: Agent 可以通过写 `.mjs` 文件在容器内创建新的 HTTP endpoint，作为定制化应用的后端。

**基础**：`container-gateway.mjs` 已是一个零依赖 Node.js 反向代理，路由到 5 个内部服务。扩展它支持动态 endpoint 加载。

- [ ] **动态 endpoint 加载器**：Gateway 启动时扫描 `/workspace/endpoints/*.mjs`，每个文件 export `{ path, method, handler }`
- [ ] **热重载**：`fs.watch` 监听 endpoint 目录，新增/修改 `.mjs` 自动注册路由，无需重启 Gateway
- [ ] **Endpoint 标准接口**：
  ```javascript
  // /workspace/endpoints/stock-dashboard.mjs
  export const path = '/api/v1/custom/stock-dashboard';
  export const method = 'GET';  // or ['GET', 'POST']
  export async function handler(req, res) {
    // Agent-generated backend logic
    // Has access to: workspace files, container services, fetch()
  }
  ```
- [ ] **安全沙箱**：endpoint 运行在受限上下文——只能访问 `/workspace/` 文件系统、容器内部服务、出站 HTTP
- [ ] **Endpoint 生命周期 API**：Agent 工具 `create_endpoint` / `update_endpoint` / `delete_endpoint` / `list_endpoints`
- [ ] **状态持久化**：endpoint 可读写 `/workspace/data/{endpoint-name}/` 目录，JSON 文件作为轻量存储
- [ ] **Gateway 路由优先级**：内置服务路由 > 自定义 endpoint > 404

### 6B. Code Playground as App Runtime — 可扩展前端 (2 weeks)

**Goal**: Code Playground 从"代码演示工具"升级为"Agent 生成应用的运行时"，Agent 写 React 代码，用户直接看到并交互。

**基础**：Code Playground 已有 WebContainer (Vite+React) 和 HtmlPreview (iframe srcDoc) 两条路径。

- [ ] **App Mode**：新增 `app` 模式（区别于 project/script/presentation），全屏无 chrome，纯 iframe 渲染
- [ ] **postMessage Bridge**：iframe ↔ workspace 双向通信标准
  ```
  Custom App → parent.postMessage({ type: 'prismer:app:event', payload }) → Agent
  Agent → directive → CodePlayground → iframe.postMessage({ type: 'prismer:app:update', payload }) → Custom App
  ```
- [ ] **App ↔ Backend Bridge**：Custom App 内的 `fetch('/api/v1/custom/...')` 自动路由到容器 endpoint（通过 Gateway 代理）
- [ ] **HtmlPreview 增强**：支持 React CDN 模式（<100ms 启动），适合 Agent 快速生成的轻量应用
- [ ] **WebContainer 预热**：后台预启动 WebContainer 实例，减少首次加载到 <5s
- [ ] **App 持久化**：Agent 生成的应用代码保存到 `/workspace/apps/{app-name}/`，下次打开 workspace 自动恢复

### 6C. OpenCode Integration — Agent 的编程能力 (2 weeks)

**Goal**: 让 OpenClaw Agent 能调用 OpenCode（Claude Code CLI）来执行实际的代码生成、调试、迭代，形成"Agent 编程 Agent"的能力。

- [ ] **OpenCode Plugin**：`docker/plugin/opencode/` — 遵循已有 plugin 模式
- [ ] **核心工具集**：
  | Tool | 作用 |
  |------|------|
  | `opencode_generate` | 从需求描述生成完整应用（前端 React + 后端 endpoint） |
  | `opencode_iterate` | 根据用户反馈修改现有应用代码 |
  | `opencode_debug` | 分析运行错误、修复代码 |
  | `opencode_test` | 生成并运行测试验证功能 |
- [ ] **执行路径**：OpenClaw 调用 `claude --print` 在容器内执行，输出写入 `/workspace/apps/` 和 `/workspace/endpoints/`
- [ ] **上下文注入**：将 workspace 上下文（聊天历史、已有数据、用户偏好）作为 context 传递给 OpenCode
- [ ] **迭代循环**：生成 → 预览 → 用户反馈 → Agent 调用 opencode_iterate → 更新，直到满意
- [ ] Layer 1 测试

### 6D. Skill Standard — 能力边界定义 (1 week)

**Goal**: 定义 Skill 标准，让 Agent 知道它能构建什么、怎么构建、输出是什么。Skill 是 Agent 编程能力的"说明书"。

- [ ] **App Builder Skill**：`skills/app-builder/SKILL.md` — 描述完整的应用构建流程
  ```markdown
  ## Tools
  - opencode_generate — Generate full-stack app (React frontend + .mjs backend)
  - opencode_iterate — Modify app based on user feedback
  - create_endpoint — Deploy backend endpoint to Gateway
  - update_code — Push frontend to Code Playground

  ## Constraints
  - Frontend: React 18+, runs in Code Playground iframe
  - Backend: .mjs files, runs in Gateway, access to /workspace/ only
  - Communication: postMessage bridge (app ↔ agent), fetch (app ↔ endpoint)
  - Storage: /workspace/data/{app}/ for persistent state

  ## Workflow
  1. Understand user requirement → decompose into frontend + backend
  2. Generate code via opencode_generate
  3. Deploy endpoint via create_endpoint
  4. Push frontend via update_code (app mode, fullscreen)
  5. User interacts → agent observes via postMessage events
  6. Iterate via opencode_iterate until user satisfied
  ```
- [ ] **领域 Skill 扩展**：基于 App Builder，创建领域特化 Skill
  - `skills/data-dashboard/` — 数据可视化仪表板（Plotly/D3 + 数据查询 endpoint）
  - `skills/form-builder/` — 交互式表单应用（表单渲染 + 提交处理 endpoint）
  - `skills/doc-tool/` — 文档处理工具（PDF/Word 处理 endpoint + 预览前端）
- [ ] **Skill Discovery**：Agent 通过 `find-skills` 发现可用的 App Builder Skill，按需求选择合适的领域 Skill

### 6E. Agent Control Protocol — Agent 持续控制应用 (1 week)

**Goal**: 应用上线后，Agent 不是"交付就走"，而是持续监控和控制运行中的应用——观察用户行为、响应应用事件、主动更新。

- [ ] **Event 上报**：Custom App 通过 postMessage 上报用户交互事件 → Agent 接收并理解
- [ ] **Agent 主动推送**：Agent 通过 directive → Code Playground → postMessage 向运行中的 App 推送数据更新
- [ ] **应用状态同步**：App 状态变更通知 Agent（如表单提交、数据变化），Agent 决定下一步操作
- [ ] **多应用编排**：Agent 同时控制多个自定义应用（如 dashboard + alert panel），应用间通过 Agent 协调
- [ ] **生命周期管理**：Agent 可以启动/暂停/销毁自定义应用，管理 endpoint 和 frontend 资源

### 6F. Module Packaging — 沉淀与复用 (2 weeks)

**Goal**: Agent 构建的成功应用可以沉淀为标准模块，跨 workspace 复用和分发。这是结果而非前提。

- [ ] **App 快照**：将 `/workspace/apps/{name}/` + `/workspace/endpoints/{name}.mjs` 打包为可分发单元
- [ ] **模块标准**：`@prismer/mod-{id}` npm 包格式（frontend + endpoint + skill + manifest）
- [ ] **本地安装**：从快照安装到其他 workspace —— endpoint 自动部署，frontend 自动注册
- [ ] **Cloud 分发**：发布到 Prismer Cloud Skill Registry，其他用户可搜索安装
- [ ] **WindowViewer 集成**：成熟的自定义应用可升级为 WindowViewer tab（与内置组件同等地位）

### Phase 6 Success Metrics

1. **端到端 demo**：用户一句话描述 → Agent 生成前后端 → 用户 <3 分钟内看到可交互应用
2. **迭代效率**：用户反馈 → Agent 修改 → 应用更新，单次迭代 <30s
3. **后端可扩展**：`.mjs` endpoint 热加载，无需重启 Gateway
4. **前端可扩展**：HtmlPreview 路径 <100ms 渲染，WebContainer 路径 <5s（预热后）
5. **Agent 持续控制**：应用上线后 Agent 仍可推送更新、响应事件
6. **可沉淀**：成功的应用可打包分发，其他 workspace 一键安装

---

## Architecture Principles

1. **TS API first**: All backend through TS API + remote MySQL until stable, then converge to Golang
2. **Transport abstraction**: Client hooks never change; only server implementation swaps
3. **One workspace = one bot instance**: Clear 1:1 mapping, independent WebSocket connections
4. **documentId as universal key**: Shared context across Discovery/Assets/Workspace
5. **Schema-driven**: Prisma schema is source of truth; docs/SCHEME.md stays aligned
