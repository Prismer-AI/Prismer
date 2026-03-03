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

# TODO — Development Tracker

> Last updated: 2026-02-27
> WindowView Convergence: All 6 phases complete ✅ (verified 2026-02-21)
> Phase 1 Workspace Management: Complete ✅
> Phase 2 Page Integration: Complete ✅
> Phase 3 OpenClaw Agent Integration: Complete ✅ (incl. Frontend ↔ Container integration)
> Phase 4A Cloud SDK Setup: Complete ✅
> Phase 4B Cloud IM MVP: Complete ✅ (FK constraint fixed, chat↔container verified)
> Phase 4C-F Data Architecture: Planned (persistence, context, files, IM convergence)
> **MVP Validation Sprint: All 4 MVPs implemented ✅ (2026-02-22)**
> **Observability Layer: Unified structured logging across all 3 layers ✅ (2026-02-22)**
> **Gateway Auth + Chat Persistence: Token-only auth, message pipeline verified ✅ (2026-02-23)**
> **🎯 MILESTONE: OpenClaw Agent Full Lifecycle — merged to develop ✅ (2026-02-24)**
> **Container Protocol: Image tag SSoT + 6-type change checklist ✅ (2026-02-25)**
> **Workspace Lifecycle Management: Readiness gate + disabled states + health monitor + task pipeline ✅ (2026-02-25)**
> **Store Isolation: Per-workspace Zustand store isolation + interactiveComponents fix + component event forwarding ✅ (2026-02-25)**
> **Open-Source Architecture: API Path Compatibility design documented ✅ (2026-02-25)**
> **Directive Push Channel: SSE endpoint + real-time plugin→frontend directives ✅ (2026-02-25)**
> **Workspace Collection: Auto-create on workspace init + file sync pipeline ✅ (2026-02-25)**
> **Notes Auto-Save: 5s periodic save to workspace collection ✅ (2026-02-25)**
> **E2E MVP Tasks: LaTeX survey, Jupyter visualization, Notes template — 3 scenarios added ✅ (2026-02-25)**
> **WindowView Action System: Plugin v0.5.0 (26 tools) + Image v4.5 — 4-layer tests 59+ tests ✅ (2026-02-26)**
> **Plugin Rewrite: prismer-workspace v0.5.0 (26 tools, registerTool API) ✅ (2026-02-26)**
> **4-Layer Test System: Unit (~50+) + L1 (21) + L2 (32) + L3 (6) = 59+ tests ✅ (2026-02-27)**
> **Container v4.5: Old image cleanup + version bump + configSchema fix + rebuild ✅ (2026-02-27)**
> **DB Reset: Dev database cleared, fresh schema pushed ✅ (2026-02-27)**
> **Next: Documentation alignment → Enter Phase 5 Open-Source Frontend**
> Reference: `docs/WINDOWVIEW_CONVERGENCE.md`, `docs/ROADMAP.md`, `docs/CONTAINER_PROTOCOL.md`, `docs/ACTION_TAXONOMY.md`

---

## Discovery — Tag/Category System

| # | Task | Status | Notes |
|---|------|--------|-------|
| TAG1 | Improve entire tag/category system | pending | CategoryNav hidden in DiscoveryView (2026-02-25); redesign and re-enable. See `CategoryNav.tsx` + `DiscoveryView.tsx`. |

---

## Phase 1 — Workspace Management (COMPLETED)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1A | Workspace CRUD service | ✅ done | `src/lib/services/workspace.service.ts` — full CRUD with ownership |
| 1A | API routes `/api/workspace` | ✅ done | GET/POST + `[id]` route GET/PATCH/DELETE |
| 1B | Dynamic route `/workspace/[workspaceId]` | ✅ done | Server component with ownership validation |
| 1B | `/workspace` redirect | ✅ done | Redirect to most recent or create default |
| 1C | `ConnectionIndicator.tsx` | ✅ done | 4 states + popover with workspace info |
| 1C | Connection status in WindowViewer | ✅ done | Integrated into ComponentTabs |
| 1D | `WorkspaceTabButton.tsx` | ✅ done | Dropdown menu for workspace selection |
| 1D | `CreateWorkspaceDialog.tsx` | ✅ done | Name/description form |
| 1D | `ManageWorkspacesDialog.tsx` | ✅ done | Edit/delete with confirmation |
| 1D | AppSidebar integration | ✅ done | Replaced TabButton with WorkspaceTabButton |
| 1E | Auto-create default workspace | ✅ done | `getOrCreateDefault()` in service |
| 1E | Handle delete of current workspace | ✅ done | Switch to next or redirect to `/workspace` |
| 1E | Permission validation | ✅ done | Ownership check in all API routes |

---

## Phase 2 — Page Integration (COMPLETED)

> Goal: Seamless Discovery → Assets → Workspace research flow.

### 2A. Discovery → Assets Bridge

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2A.1 | "Save to Assets" button in PaperCard | ✅ done | Expanded view + action bar icon |
| 2A.2 | "Save to Assets" button in PDFReaderTopBar | ✅ done | Library icon with auth check |
| 2A.3 | Deduplication via `getAssetBySourceId()` | ✅ done | AssetStore checks arxivId |
| 2A.4 | Toast notifications on save | ✅ done | Success/error with action links |

### 2B. Assets → Workspace Bridge

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2B.1 | "Open in Workspace" menu item in AssetCard | ✅ done | Sparkles icon in dropdown |
| 2B.2 | Workspace session creation | ✅ done | POST /api/workspace with asset title |
| 2B.3 | URL parameter document loading | ✅ done | `?sessionId=X&documentId=Y` |
| 2B.4 | WorkspaceView reads documentId from URL | ✅ done | `useSearchParams` + componentStore |
| 2B.5 | PDFReaderPreview dynamic source loading | ✅ done | `getPDFSource()` helper for any arxivId |

### 2C. Workspace → Assets Bridge

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2C.1 | "Save to Assets" for LaTeX artifacts | 🔲 pending | Add toolbar button |
| 2C.2 | "Save to Assets" for Jupyter outputs | 🔲 pending | Add toolbar button |
| 2C.3 | Note creation from workspace | 🔲 pending | Create note asset |

### 2D. Shared Paper Context

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2D.1 | documentId as universal key | ✅ done | arxivId used across all pages |
| 2D.2 | Discovery: Paper.arxivId | ✅ done | Primary identifier |
| 2D.3 | Assets: UserAsset.sourceId | ✅ done | Links to arxivId |
| 2D.4 | Workspace: componentStore.documentId | ✅ done | PDF reader state |

---

## MVP Validation Sprint (2026-02-22)

> OpenClaw alignment verified via docs.openclaw.ai/concepts/multi-agent
> Key decision: Workspace ↔ Agent is **strictly 1:1** per OpenClaw architecture. Multi-agent deferred to next phase.

### MVP 1 — Workspace Container Lifecycle Management ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Template defaults for AgentConfig | ✅ done | `getTemplateDefaults()` in workspace.service.ts — systemPrompt, skills, tools from docker/templates/ |
| 1.2 | Template selector in CreateWorkspaceDialog | ✅ done | 3 templates: academic-researcher, data-scientist, paper-reviewer |
| 1.3 | Start API: allow restart from error state | ✅ done | Only rejects `running` / `starting` (was already correct) |

### MVP 2 — Chat Panel Session Management ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Bridge API persists user messages to IM | ✅ done | User messages saved to IMMessage before sending to container |
| 2.2 | Bridge API message history | ✅ done | GET `?include=messages&limit=50` returns IM history |
| 2.3 | useContainerChat loads history on mount | ✅ done | `loadMessageHistory()` fetches from Bridge API GET |
| 2.4 | Session management UI | ✅ done | "New Session" button + message count in header |

### MVP 3 — Backend Skill Management ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Skill install dual-writes AgentConfig | ✅ done | Install/uninstall both update AgentConfig.skills + AgentInstance.installedSkills |
| 3.2 | OpenClaw config skills format alignment | ✅ done | Uses `{ allowBundled, load.extraDirs }` matching openclaw.json |
| 3.3 | ConfigDeployment audit trail | ✅ done | Created on every container start with versioned config snapshot |
| 3.4 | Config PATCH API | ✅ done | PUT handler supports all fields: systemPrompt, modelName, skills, tools |

### MVP 4 — WindowView Container Seed Data ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Wire componentEventForwarder | ✅ done | WorkspaceView mounts forwarder → Bridge API |
| 4.2 | UIDirective handler (full pipeline) | ✅ done | Container → Bridge API → useContainerChat → WorkspaceView → executeDirectives() → componentStore |
| 4.3 | Components respond to container state | ✅ done | Existing useContentSync/useComponentBusEvent + componentStore subscription chain |
| 4.4 | simulate-directive test endpoint | ✅ done | `/api/workspace/:id/simulate-directive` (dev-only) |

### Files Modified

| File | MVP | Change |
|------|-----|--------|
| `src/lib/services/workspace.service.ts` | 1 | Template defaults + TemplateType |
| `src/app/global/components/CreateWorkspaceDialog.tsx` | 1 | Template selector UI |
| `src/app/api/workspace/route.ts` | 1 | Pass templateType to service |
| `src/app/api/skills/[id]/install/route.ts` | 3 | Dual-write AgentConfig.skills |
| `src/app/api/skills/[id]/route.ts` | 3 | Dual-write on uninstall |
| `src/app/api/agents/[id]/start/route.ts` | 3 | ConfigDeployment + skills format |
| `src/lib/container/types.ts` | 3 | OpenClawConfig.skills type expansion |
| `src/app/api/v2/im/bridge/[workspaceId]/route.ts` | 2,4 | User msg persistence + history + directives |
| `src/app/workspace/hooks/useContainerChat.ts` | 2,4 | History loading + directive passthrough |
| `src/app/workspace/components/WorkspaceChat/index.tsx` | 2 | New Session button + msg count |
| `src/app/workspace/components/WorkspaceView.tsx` | 4 | Forwarder wiring + directive execution |
| `src/app/api/workspace/[id]/simulate-directive/route.ts` | 4 | New dev-only test endpoint |

---

## Observability Layer (2026-02-22) ✅

> Unified structured logging with correlation IDs across frontend, TS API, and bridge/sync layers.

### Infrastructure

| # | Task | Status | Notes |
|---|------|--------|-------|
| O.1 | Unified logger utility | ✅ done | `src/lib/logger.ts` — structured key-value logging with severity levels, correlation IDs, ring buffer, child loggers, and timing |
| O.2 | Pre-built module loggers | ✅ done | `frontendLog`, `apiLog`, `syncLog` — named loggers for common modules |
| O.3 | Log ring buffer | ✅ done | Last 200 entries in-memory for debugging, `getRecentLogs()` / `getLogsByModule()` |
| O.4 | Listener API for aggregation | ✅ done | `addLogListener()` for external log forwarding (Datadog, ELK, etc.) |

### Frontend Observability

| # | Task | Status | Notes |
|---|------|--------|-------|
| O.5 | WorkspaceView lifecycle logging | ✅ done | Init, store reset, document loading, component events, directive execution |
| O.6 | useContainerChat logging | ✅ done | Bridge status, history loading, message send/receive with timing, connection status changes |
| O.7 | AgentInstanceStore logging | ✅ done | Binding fetch, start/stop lifecycle, status transitions |
| O.8 | ComponentEventForwarder logging | ✅ done | Event forwarding with component/eventType, registration state |

### Backend API Observability

| # | Task | Status | Notes |
|---|------|--------|-------|
| O.9 | Agent Start API structured logging | ✅ done | Correlation ID, agent lookup, orchestrator resolution, config deployment, mock mode, total duration |
| O.10 | Bridge API POST structured logging | ✅ done | Correlation ID, user msg persistence, WS lifecycle (connect/message/close), agent response, IM persistence |
| O.11 | Bridge API GET logging | ✅ done | Status check, gateway probe, message history load |
| O.12 | Workspace Service logging | ✅ done | Workspace creation with template, agent config/instance creation |

### Bridge/Sync Observability

| # | Task | Status | Notes |
|---|------|--------|-------|
| O.13 | WebSocket message flow tracing | ✅ done | Per-message logging with type, sequence number, auth challenge, directives, final response |
| O.14 | WebSocket timing metrics | ✅ done | Connection duration, response time, message count per session |
| O.15 | Directive extraction logging | ✅ done | Directive type/target logged on extraction from WS stream |

### E2E Test Scenario

| # | Task | Status | Notes |
|---|------|--------|-------|
| O.16 | E2E workspace lifecycle script | ✅ done | `scripts/e2e-workspace-scenario.ts` — 5 phases: create workspace, agent lifecycle, chat communication, directive pipeline, cleanup |

### Files Modified

| File | Change |
|------|--------|
| `src/lib/logger.ts` | **New** — Unified logger with structured output, correlation IDs, ring buffer |
| `src/app/workspace/components/WorkspaceView.tsx` | Structured logging for lifecycle, events, directives |
| `src/app/workspace/hooks/useContainerChat.ts` | Structured logging for bridge communication, history, status |
| `src/app/workspace/stores/agentInstanceStore.ts` | Structured logging for agent lifecycle state |
| `src/app/api/agents/[id]/start/route.ts` | Correlation ID, orchestrator/config/deploy logging |
| `src/app/api/v2/im/bridge/[workspaceId]/route.ts` | Correlation ID, WS flow tracing, IM persistence audit |
| `src/lib/sync/componentEventForwarder.ts` | Structured event forwarding logs |
| `src/lib/services/workspace.service.ts` | Workspace creation and agent setup logging |
| `scripts/e2e-workspace-scenario.ts` | **New** — E2E test scenario script |

---

## Gateway Auth + Chat Persistence Fix (2026-02-23) ✅

> Resolved agent NO_RESPONSE and chat message persistence bugs across bridge API, gateway client, and frontend stores.

### Key Discovery: Token-Only Gateway Auth

OpenClaw gateway in `mode: "local"` accepts connections with **just the gateway token** — no device credentials (Ed25519 signing) needed. This eliminates the unreliable 5-minute device auto-pair wait.

**Auth protocol (local mode):**
1. Connect to `ws://<gateway-url>` (port 18901 proxy → 18900)
2. Receive `connect.challenge` with nonce
3. Send `connect` request with `auth.token` only (no device/signature)
4. Receive `hello-ok` with protocol 3, then `chat.send`

Device-signed auth is optional — only needed for remote/multi-node gateway topologies.

### Bug Fixes

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| G.1 | Bridge API returns NO_RESPONSE | `sendGatewayMessage` required non-null `DeviceCredentials`, but gateway auto-pair was unreliable (5+ min) | Made `device` parameter nullable; use token-only auth when null |
| G.2 | Bridge POST hangs 100s+ | Lazy credential loading with `readDeviceCredentialsWithRetry(maxAttempts:20, delay:5s)` blocked HTTP requests | Removed lazy loading entirely — not needed with token-only auth |
| G.3 | Agent start wastes ~6s on key seeding | `seedDeviceKeyPair` + `readDeviceCredentialsWithRetry` ran on every start | Removed credential seeding step; store only `gatewayToken` in metadata |
| G.4 | `loadWorkspace()` clobbers IM messages | `syncActions.ts` overwrote chatStore with empty WorkspaceMessage results (container workspaces use IM, not legacy table) | Guard: only overwrite if `messages.length > 0` |
| G.5 | `useContainerChat` sender type wrong | `sender.role` vs `sender.type` field name mismatch in IMMessageRecord interface | Fixed to `sender.role` (matches IM schema) |
| G.6 | Duplicate messages on reload | `loadMessageHistory` ran `addMessage` (always adds) instead of `addMessageIfNew` (deduplicates) | Changed to `addMessageIfNew` + removed `messages.length` dependency |

### E2E Verification

| Phase | Result | Duration |
|-------|--------|----------|
| Phase 1: Workspace Creation | ✅ pass | 7.8s |
| Phase 2: Agent Lifecycle | ✅ pass | 25.6s |
| Phase 3: Chat Communication | ✅ pass | 15.0s |
| Phase 4: Directive Pipeline | ✅ pass | 5.8s |
| Phase 5: Cleanup | ✅ pass | 15.6s |
| **Total** | **5/5 pass** | **1.2m** |

### Remaining Issue (Investigated + Fixed)

- **Root cause**: Race condition between `loadWorkspace()` and `useContainerChat.loadMessageHistory()`. Both run concurrently on page mount. `loadWorkspace` used `setMessages()` which REPLACES all messages. If it resolved after `loadMessageHistory`, it could overwrite IM messages with an empty array (legacy endpoint returns empty for container workspaces).
- **Fix**: Changed `loadWorkspace` to use `addMessageIfNew()` merge strategy instead of `setMessages()`. Both code paths now merge non-destructively. Added detailed logging to trace message loading flow.
- **Status**: ✅ Fix verified — E2E shows "2 msgs" after reload (was "1 msgs" before fix). Both user + agent messages display correctly.

### Files Modified

| File | Change |
|------|--------|
| `src/lib/container/openclawGatewayClient.ts` | `sendGatewayMessage` accepts `device: null`, falls back to token-only auth |
| `src/app/api/v2/im/bridge/[workspaceId]/route.ts` | Removed lazy credential loading, removed unused imports |
| `src/app/api/agents/[id]/start/route.ts` | Removed device key seeding step, simplified metadata |
| `src/app/workspace/stores/syncActions.ts` | Merge messages with `addMessageIfNew` instead of destructive `setMessages` |
| `src/app/workspace/hooks/useContainerChat.ts` | Fixed `sender.role`, `addMessageIfNew`, detailed logging, removed stale dependency |
| `e2e/workspace-visual.spec.ts` | Enhanced Phase 3 diagnostics (Zustand store state, bridge check) |

---

## Container Change Protocol (2026-02-25) ✅

> Prevents frontend-container integration breakage. See full protocol: `docs/CONTAINER_PROTOCOL.md`

### Problems Solved

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| Jupyter 503 in E2E | Frontend rendered JupyterNotebook without checking `agentInstanceStatus` | Added status gate in `JupyterNotebookPreview.tsx` |
| k8s image tag drift | `k8sOrchestrator.ts` hardcoded `v4.2` while `start/route.ts` used `v4.3` | Created `src/lib/container/version.ts` as single source of truth |
| Jupyter E2E false negative | Playwright selector mixed CSS + text syntax → detection always failed | Fixed selectors to detect Jupyter-specific UI elements (Run All, Python 3) |

### Changes

| File | Change |
|------|--------|
| `src/lib/container/version.ts` | **New** — Container image version SSoT (`CONTAINER_IMAGE_VERSION`, `CONTAINER_IMAGE_TAG`, `CONTAINER_IMAGE`) |
| `src/lib/container/index.ts` | Export version module |
| `src/app/api/agents/[id]/start/route.ts` | Import `CONTAINER_IMAGE` from version.ts (removed local constant) |
| `src/lib/container/k8sOrchestrator.ts` | Import `CONTAINER_IMAGE` from version.ts (fixed v4.2→v4.3 drift) |
| `docs/CONTAINER_PROTOCOL.md` | **New** — 3-type change protocol (Image, Config, Frontend Integration) |
| `docker/VERSIONS.md` | Added source-of-truth reference to `version.ts` |
| `CLAUDE.md` | Added `CONTAINER_PROTOCOL.md` to documentation table |
| `e2e/workspace-visual.spec.ts` | Added Phase 1 image version check + improved Jupyter tab detection |
| `src/components/editors/previews/JupyterNotebookPreview.tsx` | Agent status gate (prevents 503 when container not running) |
| `src/components/editors/jupyter/components/JupyterNotebook.tsx` | Improved error messages (503/502/network) |

---

## Workspace Container Lifecycle Management (2026-02-25) ✅

> Comprehensive refactoring of workspace readiness, disabled states, health monitoring, and task pipeline.
> Fixes 5 critical bugs: no lifecycle visibility, chat/editors accessible when disconnected, one-shot health checks, no task extraction from agent responses.

### Bug 1: No Container Lifecycle Visibility — FIXED ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| LM1.1 | Add `bridgeConnected` + `useWorkspaceReadiness()` to store | ✅ done | `agentInstanceStore.ts` — derived readiness from status + bridge |
| LM1.2 | Wire `bridgeConnected` into `useContainerChat` | ✅ done | 3 sync points: success, error, catch |
| LM1.3 | Create `WorkspaceReadinessGate` component | ✅ done | 4 states: idle, starting (delegates to AgentStartupOverlay), error, connecting |
| LM1.4 | Replace autostart-only overlay in WorkspaceView | ✅ done | Universal readiness gate: shown whenever `!isReady && !gateDismissed` |
| LM1.5 | Add disabled overlay to WindowViewer | ✅ done | Semi-transparent overlay with "Start the agent to use workspace tools" |

### Bug 2: Chat & Editors Accessible When Disconnected — FIXED ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| LM2.1 | Pass `disabled` prop from WorkspaceView to WorkspaceChat | ✅ done | Inline "Agent is not connected" banner + disabled ChatInput |
| LM2.2 | ChatInput: honor disabled state fully | ✅ done | Static placeholder, disabled attachment/voice buttons, cursor-not-allowed |
| LM2.3 | WindowViewer: disabled overlay blocks editor interaction | ✅ done | `pointer-events: none` equivalent via z-30 overlay |

### Bug 3: Health Checks Not Persistent — FIXED ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| LM3.1 | Add `AgentHealthStatus` + `healthStatus` to store | ✅ done | Includes gateway, container, consecutiveFailures, lastCheckedAt |
| LM3.2 | Create `useHealthMonitor` hook | ✅ done | 60s polling when running, 3 failures → error state + toast |
| LM3.3 | Integrate into WorkspaceView | ✅ done | Replaced one-shot health check with periodic monitor |
| LM3.4 | Enhance ConnectionIndicator | ✅ done | Auto-display store health, relative time, unhealthy warning badge |

### Bug 5: Task/Action Components Never Triggered — PARTIALLY FIXED ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| LM4.1 | Add `parseAgentResponse()` to Bridge API | ✅ done | Extracts `prismer-task`, `prismer-ui` blocks + markdown task lists |
| LM4.2 | Update `useContainerChat` to pass parsed data | ✅ done | Tasks + interactiveComponents in message metadata |
| LM4.3 | Wire task creation from agent responses | ✅ done | WorkspaceView creates tasks via `taskStore.addTask()` |
| LM4.4 | Add `addTask` action to taskStore | ✅ done | Simple append to tasks array |

### Bug 4: Container Data Persistence — DEFERRED

Container-generated files (`.tex`, `.pdf`, `.ipynb`, CSV) are lost on container stop. The `prismer-workspace` plugin provides tools TO the agent (LaTeX, Jupyter, UI control) but no persistence FROM the container. This requires Phase 4C-F infrastructure:
- PersistenceProxy for message/task/timeline sync
- Container workspace file export (S3 or backend storage)
- `/api/workspace/:id/files` endpoint
- Container file watcher → backend storage

### Files Modified

| File | Action | Change |
|------|--------|--------|
| `src/app/workspace/stores/agentInstanceStore.ts` | Modified | +`AgentHealthStatus`, +`bridgeConnected`, +`healthStatus`, +`useWorkspaceReadiness()`, +`useAgentHealth()` |
| `src/app/workspace/hooks/useContainerChat.ts` | Modified | +`setBridgeConnected` sync, +`BridgeParsedTask` types, +metadata passthrough |
| `src/app/workspace/components/WorkspaceReadinessGate.tsx` | **New** | Universal readiness overlay (4 states, auto-dismiss) |
| `src/app/workspace/hooks/useHealthMonitor.ts` | **New** | 60s periodic health polling, 3-failure error escalation |
| `src/app/workspace/components/WorkspaceView.tsx` | Modified | +readiness gate, +disabled props, +health monitor, +task creation from responses |
| `src/app/workspace/components/WindowViewer/index.tsx` | Modified | +`disabled` prop, +blocking overlay |
| `src/app/workspace/components/WorkspaceChat/index.tsx` | Modified | +`disabled` prop, +banner, +ChatInput disabled |
| `src/app/workspace/components/WorkspaceChat/ChatInput.tsx` | Modified | +static placeholder, +disabled buttons |
| `src/app/workspace/components/ConnectionIndicator.tsx` | Modified | +store health display, +relative time, +unhealthy badge |
| `src/app/api/v2/im/bridge/[workspaceId]/route.ts` | Modified | +`parseAgentResponse()` for structured data extraction |
| `src/app/workspace/stores/taskStore.ts` | Modified | +`addTask` action |

---

## Per-Workspace Store Isolation (2026-02-25) ✅

> Fixes 3 critical bugs discovered during user testing: interactiveComponents data path mismatch, unstructured component events, and global store data leaking between workspaces.

### Bug: interactiveComponents Never Visible — FIXED ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| SI-A | Promote interactiveComponents from metadata to message root | ✅ done | `useContainerChat.ts` — ActionBar reads root, not metadata |

### Bug: Agent Cannot Operate UI — FIXED ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| SI-B.1 | Silent system event delivery in Bridge API | ✅ done | `isSystemEvent` → store context in memory, no chat message |
| SI-B.2 | Context injection for user messages | ✅ done | Prepend `[Context: Active component: ...]` to user message |

### Bug: WindowView Data Not Isolated Per Workspace — FIXED ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| SI-C.1 | `createWorkspaceIsolatedStorage()` factory | ✅ done | `userStorageManager.ts` — key format: `user-${userId}:${baseName}:ws-${workspaceId}` |
| SI-C.2 | Update 5 stores: skipHydration + workspace storage | ✅ done | componentStore, chatStore, taskStore, layoutStore, agentInstanceStore |
| SI-C.3 | `initializeWorkspace()` coordinator | ✅ done | `syncActions.ts` — reset → set storage key → rehydrate → load API |
| SI-C.4 | Wire into WorkspaceView | ✅ done | Replace scattered reset+load with `initializeWorkspace()` + workspace switch handler |

### Files Modified

| File | Action | Change |
|------|--------|--------|
| `src/app/workspace/hooks/useContainerChat.ts` | Modified | interactiveComponents promoted to message root |
| `src/lib/storage/userStorageManager.ts` | Modified | +`createWorkspaceIsolatedStorage()` factory |
| `src/app/workspace/stores/componentStore.ts` | Modified | workspace-scoped storage + skipHydration |
| `src/app/workspace/stores/chatStore.ts` | Modified | workspace-scoped storage + skipHydration |
| `src/app/workspace/stores/taskStore.ts` | Modified | workspace-scoped storage + skipHydration |
| `src/app/workspace/stores/layoutStore.ts` | Modified | workspace-scoped storage + skipHydration |
| `src/app/workspace/stores/agentInstanceStore.ts` | Modified | workspace-scoped storage + skipHydration |
| `src/app/workspace/stores/syncActions.ts` | Modified | +`initializeWorkspace()` coordinator |
| `src/app/workspace/stores/index.ts` | Modified | +export `initializeWorkspace` |
| `src/app/workspace/components/WorkspaceView.tsx` | Modified | `initializeWorkspace()` + workspace switch handler |
| `src/app/api/v2/im/bridge/[workspaceId]/route.ts` | Modified | +system event handling, +component context injection |

---

## Directive Push Channel + Workspace Collection + E2E (2026-02-25) ✅

> Implements real-time directive delivery from container plugin to frontend, auto-creates workspace collections, adds file sync pipeline, notes auto-save, and 3 MVP E2E test scenarios.

### WP-D: Directive Push Channel ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| D.1 | In-memory directive queue | ✅ done | `src/lib/directive/queue.ts` — EventEmitter-based, keyed by agentId |
| D.2 | Directive receiver API | ✅ done | `POST /api/agents/:id/directive` — matches plugin contract |
| D.3 | SSE stream endpoint | ✅ done | `GET /api/agents/:id/directive/stream` — real-time push |
| D.4 | Frontend SSE hook | ✅ done | `useDirectiveStream` — maps UPPERCASE→lowercase, auto-reconnect |
| D.5 | Extend executeDirective | ✅ done | +`latex_compile_complete`, +`jupyter_cell_result` cases |
| D.6 | Wire into WorkspaceView | ✅ done | Single hook call |

### WP-E: Workspace Collection ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| E.1 | Auto-create collection | ✅ done | `workspace.service.ts` — collectionId in settings JSON |
| E.2 | Collection API | ✅ done | `GET /api/workspace/:id/collection` |

### WP-F: File Sync Pipeline ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| F.1 | File sync service | ✅ done | `workspace-file-sync.service.ts` — container→S3→collection |
| F.2 | Trigger from directives | ✅ done | Async on LATEX_COMPILE_COMPLETE |

### WP-G: Notes Auto-Save ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| G.1 | Auto-save hook | ✅ done | `useNotesAutoSave` — 5s periodic to collection |
| G.2 | Notes upsert API | ✅ done | `PUT /api/workspace/:id/notes` — upsert pattern |

### WP-H: E2E Tests ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| H.1 | LaTeX survey scenario | ✅ done | Phase 3.5a in E2E spec |
| H.2 | Jupyter visualization scenario | ✅ done | Phase 3.5b in E2E spec |
| H.3 | Notes template scenario | ✅ done | Phase 3.5c in E2E spec |

### New Files

| File | Purpose |
|------|---------|
| `src/lib/directive/queue.ts` | In-memory EventEmitter directive queue |
| `src/app/api/agents/[id]/directive/route.ts` | POST — plugin directive receiver |
| `src/app/api/agents/[id]/directive/stream/route.ts` | GET — SSE stream to frontend |
| `src/app/workspace/hooks/useDirectiveStream.ts` | Frontend SSE subscription + directive mapping |
| `src/app/workspace/hooks/useNotesAutoSave.ts` | 5s periodic notes save to collection |
| `src/app/api/workspace/[id]/collection/route.ts` | GET — workspace collection info |
| `src/app/api/workspace/[id]/notes/route.ts` | PUT — notes content upsert |
| `src/lib/services/workspace-file-sync.service.ts` | Container→S3→collection file sync |

---

## Cloud SDK v1.7 IM Integration (COMPLETED)

Implemented local IM backend providing message persistence for ChatPanel ↔ OpenClaw communication:

**Files Created**:
- `src/lib/services/im.service.ts` — IM service layer (IMUser, IMConversation, IMMessage, workspace binding)
- `src/app/api/v2/im/register/route.ts` — Agent/user registration
- `src/app/api/v2/im/conversations/route.ts` — Conversation list/create
- `src/app/api/v2/im/conversations/[id]/route.ts` — Conversation detail/update
- `src/app/api/v2/im/conversations/[id]/messages/route.ts` — Message history/send
- `src/app/api/v2/im/workspace/[workspaceId]/route.ts` — Workspace-IM binding
- `src/app/workspace/hooks/useIMSync.ts` — Frontend hook for IM persistence

**Files Updated**:
- `src/app/workspace/components/WorkspaceView.tsx` — Added `useIMSync` integration + `USE_IM_PERSISTENCE` flag
- `docker/plugin/prismer-im/src/types.ts` — Updated IMMessageType with SDK v1.7 types

**Architecture**:
```
ChatPanel → useIMSync → /api/v2/im/* → Prisma (IMUser, IMConversation, IMMessage)
    ↓
useDesktopAgent → WebSocket → Agent Server → OpenClaw Container
```

---

## Phase A — Foundation

| # | Task | Status | Notes |
|---|------|--------|-------|
| A1 | Fix `/api/ai/chat` temperature bug | ✅ done | `isReasoningModel()` + `normalizeForReasoningModel()` |
| A2 | Create `src/lib/services/ai-client.ts` | ✅ done | `aiChat()`, `aiChatStream()`, `aiChatStreamCallback()`, intent presets |
| A3 | Fix LaTeX content disappearing on mode switch | ✅ done | CSS hidden + removed theme toggle + cleaned light theme |
| A4 | Create `ComponentToolbar.tsx` | ✅ done | `ComponentToolbar` + `ToolbarButton` + `ToolbarGroup` + `ToolbarSeparator` |

## Phase B — Visual Convergence

| # | Task | Status | Notes |
|---|------|--------|-------|
| B1 | Jupyter: visual + floating sidebar + auto-connect + merge status | ✅ done | bg-slate-900, h-10 toolbar, floating sidebar, auto-connect, compact status |
| B2 | LaTeX: remove AgentChatPanel, fix padding | ✅ done | removed AgentChatPanel + Bot import, h-10 px-3 toolbar, removed self border/rounded |
| B3 | Code Playground: remove theme toggle, remove outer border | ✅ done | always vs-dark, removed Sun/Moon, removed self border/rounded |
| B4 | AG Grid: remove forced dark container, fix padding | ✅ done | removed self border/rounded, h-10 px-3 py-2 toolbar |
| B5 | AI Editor: toolbar scroll, remove self-rounding | ✅ done | CSS `overflow-x: auto; flex-wrap: nowrap`, removed rounded-lg |
| B6 | PDF Reader: no changes needed | ✅ done | already clean wrapper |

## Phase C — LLM Unification

| # | Task | Status | Notes |
|---|------|--------|-------|
| C1 | Migrate components to ai-client.ts | ✅ done | paperAgentService (3 calls), ChatPanel (1 call), AiEditor uses internal proxy |
| C2 | Implement LLMUsageLog in /api/ai/chat | ✅ done | Console logging for non-stream usage, component tracking via `component` param |
| C3 | Validate OPENAI_API_BASE_URL config | ✅ done | Architecture verified: env → getAIConfig() → LLM gateway |

## Phase D — Asset Browser

| # | Task | Status | Notes |
|---|------|--------|-------|
| D1 | Create shared AssetBrowser.tsx | ✅ done | CommandPalette style, dark theme, keyboard nav, `/api/v2/assets` |
| D2 | Integrate into Notes, AG Grid, Jupyter | ✅ done | FolderOpen button + Cmd+O shortcut + `asset:open` event |
| D3 | Enable PDF Reader "Notes" popup option | ✅ done | Send button → `notes:insert` event → AI Editor listener |
| D4 | Artifacts → Notes insertion | ✅ done | "To Notes" button in ArtifactPreview → `notes:insert` event |

## Phase E — State Sync

| # | Task | Status | Notes |
|---|------|--------|-------|
| E1 | Add Jupyter to componentStateConfig.ts | ✅ done | 6 fields: activeCellIndex, cellCount, kernelStatus, sessionId, executionCount, cells |
| E2 | Bridge componentStore → componentEventForwarder | ✅ done | `componentStateBridge.ts` subscribes to store, forwards syncable fields |
| E3 | Replace DOM events with sync engine dispatch | ✅ done | `useComponentBusEvent` hook + bus migration for notes:insert, asset:open |
| E4 | Debounced content sync for LaTeX, Code, Notes | ✅ done | `useContentSync` + `useMultiFieldContentSync` hooks, 1s debounce |

## Phase F — Deep Integration

| # | Task | Status | Notes |
|---|------|--------|-------|
| F1 | Jupyter Cell → Agent Skill | ✅ done | `cellSkills.ts`: 11 skills, 4 categories, skill registry + `formatSkillsForAgent()` |
| F2 | Jupyter Copilot redesign | ✅ done | `copilotService.ts`: 6 actions, context builder, streaming + complete modes, code extraction |
| F3 | LaTeX Copilot via @latex directive | ✅ done | `latexCopilotService.ts`: 7 actions, LaTeX/BibTeX extraction, document-aware context |

---

## Test Regression Checklist

> Last verified: 2026-02-21

### Visual (Code Verified)
- [x] All 6 active components render without self-border/shadow inside WindowViewer
- [x] Component switching (tab click) smooth transition preserved
- [x] No visual "double frame" effect on any component
- [x] Code editors (LaTeX, Playground, Jupyter) have dark bg, document editors (Notes, Reader) have light bg
- [x] Toolbar height consistent (h-10) across all components
- [x] No theme toggle buttons visible in any component

### Functional (Code Verified)
- [x] LaTeX: mode switch (code/split/preview) preserves content — CSS hidden at line 1309
- [x] LaTeX: KaTeX preview renders correctly — preview panel implementation intact
- [ ] LaTeX: PDF compile works through container gateway — requires runtime test
- [x] Code Playground: always vs-dark, theme hardcoded at line 61
- [x] Code Playground: Layout toggle implementation present
- [x] AI Editor: toolbar scroll CSS applied (overflow-x: auto)
- [ ] AI Editor: multi-note create/switch/delete — requires runtime test
- [ ] Jupyter: auto-connects to container on mount — requires runtime test
- [x] Jupyter: floating sidebar implementation confirmed
- [x] AG Grid: no outer border, proper theme styling
- [x] PDF Reader: AI chat uses ai-client.ts with temperature normalization

### AI/LLM (Code Verified)
- [x] Components use ai-client.ts — paperAgentService.ts:18, ChatPanel.tsx:13
- [x] Reasoning models (o1/o3) normalized — isReasoningModel() at route.ts:15-22
- [x] LLMUsageLog console logging — route.ts:154-161

### Build
- [x] Vitest tests pass — 50/50 tests (3 test files)
- [ ] `npx tsc --noEmit` — 50+ pre-existing errors (Prisma, framer-motion, API routes) unrelated to Phase 1.5
- [ ] `npm run build` — requires Prisma generate first
- [ ] `npm run dev` — requires runtime verification

---

## Implementation Log

### 2026-02-21: Phase 1 Complete (Workspace Management)
- **1A Data Layer**:
  - Created `src/lib/services/workspace.service.ts` with full CRUD: `list()`, `getById()`, `getMostRecent()`, `create()`, `update()`, `delete()`, `archive()`, `restore()`, `getOrCreateDefault()`, `count()`, `getNextWorkspace()`
  - Updated `/api/workspace/route.ts` (GET list, POST create)
  - Updated `/api/workspace/[id]/route.ts` (GET single, PATCH update, DELETE with cascading)
  - All routes use NextAuth v5 `auth()` with dev fallback to first user
- **1B Multi-Workspace Routing**:
  - Created `/workspace/[workspaceId]/page.tsx` — server component with ownership validation, returns WorkspaceView with workspaceId prop
  - Updated `/workspace/page.tsx` — redirects to most recent workspace or creates default via `workspaceService.getOrCreateDefault()`
  - WorkspaceView receives `workspaceId` prop, passes to `useDesktopAgent({ sessionId: workspaceId })`
- **1C Connection Status Indicator**:
  - Created `src/app/workspace/components/ConnectionIndicator.tsx` — 4 states: connected (green pulse), connecting (yellow spin), disconnected (red), error
  - Popover shows workspace name, agent ID, connection duration, reconnect/disconnect buttons
  - Integrated into `WindowViewer/ComponentTabs.tsx`
  - WorkspaceView tracks `connectedAt` timestamp and maps `agentStatus` to `ConnectionStatus`
- **1D Sidebar Workspace Management**:
  - Created `WorkspaceTabButton.tsx` — dropdown menu with workspace list, "New Workspace", "Manage All"
  - Created `CreateWorkspaceDialog.tsx` — modal with name/description form, POST to `/api/workspace`
  - Created `ManageWorkspacesDialog.tsx` — list with inline edit, delete confirmation, handles current workspace deletion
  - Updated `AppSidebar.tsx` — replaced TabButton with WorkspaceTabButton, added dialog state
  - Added `dropdown-menu` shadcn component
- **1E Edge Cases**:
  - Auto-create "Default Workspace" via `getOrCreateDefault()` on first visit
  - Delete current workspace → fetch `nextWorkspaceId` from API → redirect or fallback to `/workspace`
  - All API routes validate ownership via `ownerId` filter

### 2026-02-19: Phase A Complete
- A1: Added `isReasoningModel()` and `normalizeForReasoningModel()` to `/api/ai/chat/route.ts`. Reasoning models (o1/o3) get temperature=1, system→user message conversion, stripped unsupported params.
- A2: Created `src/lib/services/ai-client.ts` with `aiChat()`, `aiChatStream()` (AsyncGenerator), `aiChatStreamCallback()` (callback pattern), intent presets (creative/analytical/code/chat/translate), convenience helpers.
- A3: Fixed LaTeX editor: conditional render → CSS hidden for editor panel, removed theme toggle button, removed isDarkTheme state, removed light theme/highlight style, removed Compartment import. Editor always dark.
- A4: Created `src/components/shared/ComponentToolbar.tsx` with `ComponentToolbar` (left/center/right slots), `ToolbarButton`, `ToolbarGroup`, `ToolbarGroupItem`, `ToolbarSeparator`.

### 2026-02-19: Phase B Complete
- B1 (Jupyter): Changed bg to slate-900, h-10 toolbar with px-3 py-2, floating sidebar (absolute positioned rounded-xl), auto-connect on mount, compact connection indicator (merged duplicate), h-5 separators.
- B2 (LaTeX): Removed AgentChatPanel entirely (import + state + button + panel), removed Bot import, removed outer border/rounded-xl, h-10 px-3 py-2 toolbar.
- B3 (Code Playground): Removed theme toggle (Sun/Moon), always vs-dark, removed outer border/rounded-xl.
- B4 (AG Grid): Removed outer border/rounded-xl, h-10 px-3 py-2 toolbar.
- B5 (AI Editor): Added CSS for toolbar horizontal scroll (overflow-x auto, flex-wrap nowrap, hidden scrollbar), removed rounded-lg from container/error states.
- B6 (PDF Reader): No changes needed — wrapper is already clean.

### 2026-02-19: Phase C Complete
- C1: Migrated paperAgentService.ts (3 fetch calls → aiChatStream/aiChat), ChatPanel.tsx (1 fetch call → aiChatStream). Fixed broken /api/ai/command → /api/ai/chat via unified client. AiEditor uses internal proxy (already correct).
- C2: Added timing + usage logging to /api/ai/chat (non-stream). Console logs model, component, token counts, latency. Added `component` field support for client tracking.
- C3: Validated OPENAI_API_BASE_URL architecture: env var → read by getAIConfig() → proxied to NewAPI. No code changes needed.

### 2026-02-19: Phase D Complete
- D1: Created `src/components/shared/AssetBrowser.tsx` — CommandPalette-style modal, keyboard nav (↑↓/Enter/Esc), search via `/api/v2/assets?search=`, type filter, dark theme.
- D2: Integrated AssetBrowser into 3 components:
  - AG Grid: FolderOpen button + Cmd+O shortcut, `asset:open` event dispatch
  - AI Editor: Mini toolbar with Open button + Cmd+O, `notes:insert` event listener for incoming content
  - Jupyter: FolderOpen icon in toolbar + Cmd+O, `asset:open` event dispatch
- D3: Added "Send to Workspace Notes" button (Send icon) in PDF Reader UnifiedRightPanel notes header. Dispatches `notes:insert` CustomEvent with content and source.
- D4: Added "To Notes" button in Jupyter ArtifactPreview modal header. Converts artifact data (image/DataFrame/chart/text) to HTML and dispatches `notes:insert` event. AI Editor listens and appends content with `<hr/>` separator.
- Cross-component event protocol: `notes:insert` for content insertion, `asset:open` for asset loading.

### 2026-02-19: Phase E Complete
- E1: Added `jupyter-notebook` to `componentStateConfig.ts` with 6 fields: `activeCellIndex` (bidirectional), `cellCount` (broadcast), `kernelStatus` (broadcast/mobile-read), `sessionId` (bidirectional), `executionCount` (broadcast), `cells` (bidirectional).
- E2: Created `src/lib/sync/componentStateBridge.ts` — subscribes to `useComponentStore` changes, diffs state per component, filters syncable fields via `filterSyncableState()`, forwards via `forwardComponentEvent()`. Initialized in WorkspaceView.
- E3: Created `src/lib/events/useComponentBusEvent.ts` with `useComponentBusEvent()`, `useComponentBusEvents()`, `useComponentBusDispatch()` hooks. Migrated `notes:insert` → `notesInsert` bus event, `asset:open` → `assetOpen` bus event across ArtifactsPanel, UnifiedRightPanel, AGGridPreview, AiEditorPreview, JupyterNotebook. Added `stateUpdate`, `assetOpen`, `notesInsert` to ComponentEventType.
- E4: Created `src/lib/sync/useContentSync.ts` with `useContentSync()` (single field) and `useMultiFieldContentSync()` (multiple fields). Integrated 1s debounced sync into:
  - LaTeX: syncs `activeFile` + `content` to componentStore
  - Code Playground: syncs `selectedFile` + `mode` + `template`
  - AI Editor: syncs HTML content on change

### 2026-02-19: Phase F Complete
- F1: Created `src/components/editors/jupyter/skills/cellSkills.ts` — 11 agent-invocable skills in 4 categories (cell-management, execution, content, analysis). Each skill maps to a UIDirective type with typed parameters. Registry with `getCellSkill()`, `getCellSkillsByCategory()`, `formatSkillsForAgent()`.
- F2: Created `src/components/editors/jupyter/services/copilotService.ts` — 6 copilot actions (explain, fix, generate, optimize, complete, chat). Action-specific system prompts with data science focus. Context builder assembles notebook context, variables, cell source/output. `copilotStream()` for streaming, `copilotChat()` for complete responses with code block extraction. Quick actions: `explainCell()`, `fixCellError()`, `generateCode()`.
- F3: Created `src/components/editors/previews/latex-agent/services/latexCopilotService.ts` — 7 copilot actions (explain, fix, generate, improve, cite, structure, chat). LaTeX-specific system prompts for academic writing. Context builder with document info (class, packages, bib style), project files, active file tracking. Extracts both LaTeX and BibTeX code blocks separately. Detects target file for apply operations. Quick actions: `explainLatex()`, `fixLatexError()`, `generateLatex()`, `improveLatex()`, `generateCitation()`. Exported via `latex-agent/index.ts`.

### 2026-02-21: Code Verification Complete
All 25 Phase 1.5 implementation items verified against source code:

**Phase A (4/4):** `isReasoningModel()` at route.ts:15-22, `normalizeForReasoningModel()` at route.ts:52-69, `ai-client.ts` 280 lines with full API, LaTeX CSS hidden at line 1309, `ComponentToolbar.tsx` in components/shared/

**Phase B (6/6):** Jupyter bg-slate-900 + floating sidebar, LaTeX no AgentChatPanel, CodePlayground always vs-dark, AGGrid no outer border, AIEditor toolbar scroll CSS, PDFReader clean

**Phase C (3/3):** paperAgentService.ts imports ai-client (line 18), ChatPanel.tsx imports aiChatStream (line 13), env config validated

**Phase D (4/4):** AssetBrowser.tsx exists, integrated in AGGrid/AIEditor/Jupyter via componentEventBus

**Phase E (4/4):** jupyter-notebook in componentStateConfig.ts (lines 125-137), componentStateBridge.ts exists, useComponentBusEvent.ts exists, useContentSync.ts exists

**Phase F (3/3):** cellSkills.ts 11 skills, copilotService.ts 6 actions, latexCopilotService.ts 7 actions

**Build Status:** TypeScript has 50+ pre-existing errors (Prisma generation, framer-motion types, API route params) unrelated to Phase 1.5. No new errors introduced.

### 2026-02-21: Dual-Mode Container Orchestration (Docker + Kubernetes)

Added Kubernetes support alongside existing Docker orchestration. All API routes now use per-agent orchestrator resolution.

**Files Created**:
- `src/lib/container/k8sClient.ts` — K8s API client singleton with 3 auth modes:
  1. Remote cluster (`K8S_CLUSTER_URL` + `K8S_SERVICE_ACCOUNT_TOKEN`)
  2. Kubeconfig file (`K8S_KUBECONFIG_PATH`)
  3. In-cluster (`K8S_IN_CLUSTER=true`)
  - Exports: `getKubeConfig()`, `getCoreV1Api()`, `getK8sExec()`, `getK8sNamespace()`, `getNodeExternalIp()`, `testK8sConnection()`, `ensureNamespace()`, `resetK8sClient()`
- `src/lib/container/k8sOrchestrator.ts` — Full `ContainerOrchestrator` implementation (~500 lines):
  - `createContainer()`: Creates Pod + NodePort Service with env vars, resource limits, readiness/liveness probes
  - `startContainer()`: No-op if running; deletes and recreates if terminated
  - `stopContainer()`: Deletes Pod with gracePeriodSeconds (keeps Service for reuse)
  - `removeContainer()`: Deletes both Pod and Service
  - `getContainerLogs()`: K8s Log API (plain text, no Docker 8-byte header)
  - `deployConfig()`: K8s Exec API with same merge-write logic as Docker
  - `healthCheck()`: Pod status + HTTP probe via NodePort
  - `getGatewayUrl()`: Returns `ws://{nodeIP}:{nodePort}` from NodePort Service
  - `startGatewayProxy()`: No-op (NodePort handles external routing directly)
  - `onEvent()`: K8s Watch API for pod lifecycle events

**Files Modified**:
- `src/lib/container/orchestrator.ts` — Added `K8S_NOT_AVAILABLE` error code, per-type singleton cache, `getOrchestratorForAgent(agentId)` helper
- `src/lib/container/client.ts` — Added `orchestrator` and `nodeAddress` to `ContainerEndpoint`, K8s NodePort URL resolution
- `src/lib/container/index.ts` — Added exports for K8s orchestrator, client, and helpers
- `src/lib/container/autoRecovery.ts` — Added `orchestratorType` to monitor state, per-agent orchestrator in health checks and restarts
- `src/app/api/agents/[id]/start/route.ts` — Full refactor: accepts `orchestrator` body param, `resolveOrchestratorType()` + `resolveGatewayUrl()` helpers, mock fallback for both Docker and K8s
- `src/app/api/agents/[id]/stop/route.ts` — Per-agent orchestrator resolution, handles both `DOCKER_NOT_AVAILABLE` and `K8S_NOT_AVAILABLE`
- `src/app/api/agents/[id]/logs/route.ts` — Per-agent orchestrator resolution
- `src/app/api/agents/[id]/health/route.ts` — Per-agent orchestrator resolution
- `src/app/api/agents/health/route.ts` — Batch health check with per-agent orchestrator
- `next.config.ts` — Added `@kubernetes/client-node` to `serverExternalPackages`
- `package.json` — Added `@kubernetes/client-node` dependency

**K8s Environment Variables**:
```
K8S_CLUSTER_URL=https://120.204.95.194:9443
K8S_SERVICE_ACCOUNT_TOKEN=<token>
K8S_NAMESPACE=prismer-agents
K8S_NODE_EXTERNAL_IP=120.204.95.194
DEFAULT_ORCHESTRATOR=docker
CONTAINER_IMAGE=docker.prismer.dev/prismer-academic:v5.0-openclaw
```

**Key Design Decisions**:
1. Single-container Pod (same unified gateway image as Docker, port 3000)
2. NodePort for dev cluster; production can switch to Ingress/LoadBalancer
3. Deterministic pod naming: `prismer-agent-{agentId}` for easy tracking
4. K8s `startGatewayProxy()` is no-op (NodePort handles routing directly)
5. Config deployment via K8s Exec API with same merge logic as Docker
6. Lazy K8s module imports to avoid bundling on Docker-only setups

**Build Status**: `npx tsc --noEmit` = 0 errors, `npm run build` = passes, K8s connectivity verified (401 with placeholder token confirms cluster reachable at `https://120.204.95.194:9443`).

### 2026-02-21: Frontend ↔ Container Integration (MVP)

Wired the workspace frontend to the real container, added Docker/K8s distinction to management UI, and built a container bridge in agent-server.ts.

**Part 1: Status API + Management UI**
- `src/app/api/agents/[id]/status/route.ts` — Added `orchestrator` field to container response
- `src/app/api/workspace/[id]/agent/route.ts` — Added `orchestrator` to container select
- `src/app/global/components/workspace-card/useWorkspaceAgent.ts` — Added `container` type with `orchestrator` field to `AgentStatusData`
- `src/app/global/components/workspace-card/StatusTab.tsx` — Docker/K8s badge next to container ID

**Part 2: Agent Instance Store + WorkspaceView Wiring**
- `src/app/workspace/stores/agentInstanceStore.ts` — Added `gatewayUrl`, `containerHostPort`, `orchestratorType` to state; new `fetchAgentBinding(workspaceId)` action that calls `GET /api/workspace/${workspaceId}/agent`; `startAgentInstance` now captures `gatewayUrl` from start response; persist config includes `agentInstanceId` and `gatewayUrl`
- `src/app/workspace/components/WorkspaceView.tsx` — Fetches agent binding on mount via `agentInstanceStore.fetchAgentBinding()`; passes `gatewayUrl` as `serverUrl` to `useDesktopAgent`; fixed 3 hardcoded `workspaceId: 'demo'` → uses real `workspaceId` prop

**Part 3: Agent Server Container Bridge**
- `scripts/agent-server.ts` — Added `ContainerBridge` class that connects to OpenClaw container's WebSocket gateway. Per-session routing: auto-detects running container via `GET /api/workspace/${sessionId}/agent`, uses bridge for real containers, falls back to DemoController. New `AGENT_BRIDGE_MODE` env var (`auto`/`demo`/`bridge`). New `/bridges` HTTP endpoint for status.

**Key Architecture Decisions**:
1. agent-server.ts acts as protocol bridge (frontend sync protocol ↔ OpenClaw WebSocket protocol)
2. `useAgentConnection` already supported `serverUrl` param — just needed to pass it through
3. Backward compatible: demo mode works unchanged for workspaces without containers

**Build Status**: `npx tsc --noEmit` = 0 errors, `npm run build` = passes.

### 2026-02-21: Frontend UI Polish & IM Bug Fixes

**LogsTab Overflow Fix** (4th attempt — nuclear approach):
- Root cause: Framer Motion `AnimatePresence` + `motion.div` with `overflow-hidden` and `height: auto` animation overrides all CSS `max-height` constraints on child elements. The motion.div calculates full content height as an inline `style.height`, making nested `max-height` ineffective.
- Fix: Removed `AnimatePresence` + `motion.div` entirely from `WorkspaceCard.tsx`, replaced with plain `<div style={{ maxHeight: '380px', overflowY: 'auto' }}>`. Also added inline `style={{ maxHeight: '200px', overflowY: 'auto' }}` to `<pre>` in `LogsTab.tsx`.

**ComponentTabs 3-Pill Restructure**:
- Restructured from single rounded-xl into 3 separate pills: [Chat toggle] [Component tabs] [Connection + Settings]
- Each pill has its own `rounded-xl`, `border`, `shadow-sm` styling with `gap-2` spacing
- Added Settings button (gear icon) to the right pill for opening workspace settings
- Fixed height inconsistency: changed parent from `items-center` to `items-stretch`, removed fixed heights from left/right pills

**IM Initialization FK Constraint Fix**:
- Error: `Foreign key constraint violated on the foreign key` in `prisma.iMUser.create()`
- Root cause: `IMUser.userId` references `User.id`, but dev fallback user (`dev-user-1`) doesn't exist in User table
- Fix: Added User existence check in `imService.register()` — verifies User exists before setting FK, sets `userId: null` if User not found
- Added detailed error reporting to `POST /api/v2/im/workspace/[workspaceId]` in development mode

**Jupyter CORS Proxy**:
- Changed `JupyterNotebookPreview.tsx` from hardcoded `localhost:8889` to `/api/jupyter` proxy route
- Updated proxy route to accept `?port=XXXX` for dynamic container targeting
- Added Jupyter port 8888 mapping to `dockerOrchestrator.ts` for future containers

**Files Modified**:
- `src/app/global/components/workspace-card/WorkspaceCard.tsx` — Removed Framer Motion, plain div with overflow
- `src/app/global/components/workspace-card/LogsTab.tsx` — Inline maxHeight on `<pre>`
- `src/app/workspace/components/WindowViewer/ComponentTabs.tsx` — 3-pill layout, Settings button, items-stretch
- `src/lib/services/im.service.ts` — FK existence check in register()
- `src/app/api/v2/im/workspace/[workspaceId]/route.ts` — Detailed error reporting
- `src/components/editors/previews/JupyterNotebookPreview.tsx` — Proxy-based URL
- `src/lib/container/dockerOrchestrator.ts` — Jupyter port 8888 mapping

**Known Issues**:
- Chat ↔ container communication: ContainerBridge exists in agent-server.ts but real-time chat with OpenClaw needs runtime verification
- Connection status between management dialog and WindowViewer header are from separate data sources (not synced)
- Existing running containers don't have Jupyter port 8888 mapped (needs container recreation)
- ChatPanel has NOT been refactored to use `@prismer/sdk` directly — IM persistence uses local API routes mirroring SDK patterns; full SDK migration is Phase 4B (IM6/IM7)

### 2026-02-21: Phase 3 — OpenClaw Agent Integration Complete

**3A. Agent Service Abstraction**
- Created `src/lib/agent/types.ts` — AgentService interface with `startSession()`, `endSession()`, `sendMessage()`, `executeTask()`, `handleInteraction()`, `subscribe()`, `healthCheck()`. Defined AgentEvent union type (16 event types), SessionConfig, TaskConfig, UserInteraction.
- Created `src/lib/agent/DemoAgentService.ts` — Backward-compatible demo implementation wrapping DemoFlowController logic. Simulates message streaming, task execution, interaction handling. Event emission to subscribers.
- Created `src/lib/agent/eventMapper.ts` — `agentEventToSyncMessage()` transforms AgentEvent to ServerToClientMessage. MessageAccumulator for streaming content aggregation. ToolCallTracker for tool execution state management.
- Created `src/lib/agent/AgentServiceFactory.ts` — `createAgentService()` factory selecting DemoAgentService or OpenClawAgentService based on `AGENT_MODE` env var.

**3B. OpenClaw Client**
- Created `src/lib/agent/OpenClawAgentService.ts` — Full WebSocket client for OpenClaw Gateway. Connection management with reconnection logic (max 5 retries, exponential backoff). Heartbeat mechanism (30s interval). Request/response pattern with 30s timeout. Event mapping from OpenClaw message types to AgentEvent. Session state tracking.

**3C. Container Lifecycle**
- Created `src/lib/container/autoRecovery.ts` — ContainerAutoRecoveryService class with configurable RecoveryPolicy (maxRetries, retryInterval, backoffFactor, healthCheckInterval). Event handlers for container died/oom/started/stopped. Health monitoring with failure/success threshold tracking. Recovery attempt with exponential backoff.
- Created `src/app/api/agents/health/route.ts` — GET endpoint returning aggregated health status of all agent containers. Lists healthy/unhealthy agents with details.
- Updated `src/lib/container/index.ts` — Added autoRecovery exports.

**3D. Session Persistence**
- Created `src/lib/sync/persistence/types.ts` — SessionPersistence interface with `saveSession()`, `loadSession()`, `listSessions()`, `deleteSession()`, `healthCheck()`. SharedState and SessionMetadata types.
- Created `src/lib/sync/persistence/PrismaSessionPersistence.ts` — Database-backed implementation using WorkspaceSession, Message, Task Prisma models. Serializes SharedState to JSON for storage.
- Created `src/lib/sync/persistence/MemorySessionPersistence.ts` — In-memory implementation with Map storage for development/testing.
- Updated `scripts/sync-server.ts` — Integrated persistence layer, added `SYNC_PERSISTENCE` env toggle.

**3E. LLM Gateway**
- Created `src/lib/llm/types.ts` — LLMProvider, ModelInfo, ChatRequest/Response types. MODEL_PRICING table for 12 models (Claude, GPT-4, DeepSeek) with per-token cost in USD/million.
- Created `src/lib/llm/usageLogger.ts` — `logLLMUsage()` persists to LLMUsageLog model. `extractUsageFromOpenAI()` parses OpenAI response format. `getUserUsageStats()`, `getAgentUsageStats()`, `getGlobalUsageStats()` aggregate stats. `checkCostThreshold()` for budget alerts.
- Updated `src/app/api/ai/chat/route.ts` — Integrated LLM usage logging for non-streaming calls.
- Created `src/app/api/llm/usage/route.ts` — GET usage stats by userId/agentId/global, POST to record usage.
- Created `src/app/api/llm/cost/route.ts` — GET cost monitoring with threshold checking, daily averages, projected monthly costs, and alerts.

### 2026-02-21: Phase 4A (Cloud SDK Setup) Complete
- S1: Added `@prismer/sdk: ^1.7.0` to `package.json` dependencies.
- S2: Created `src/lib/cloud/` directory with 7 files:
  - `client.ts`: Singleton `PrismerClient` factory with `getPrismerClient()`, `setIMToken()`, `getServerClient()` for server-side use.
  - `context.ts`: Context API wrappers — `loadPaperContent()`, `loadPapersBatch()`, `searchPapers()` (with ranking presets), `cacheContent()`, `cacheContentBatch()`, `isContentCached()`, `getCacheStats()`.
  - `parse.ts`: Parse API wrappers — `parsePdf()`, `parseAsync()`, `getParseStatus()`, `getParseResult()`, `parsePdfWithPolling()`, `estimateParsingCost()`.
  - `im.ts`: IM API wrappers — registration (`registerAgent()`, `registerUser()`), messaging (`sendDirectMessage()`, `getDirectMessages()`), groups (`createGroup()`, `sendGroupMessage()`), workspace (`initWorkspaceIM()`, `initGroupWorkspaceIM()`, `addAgentToWorkspace()`), contacts (`listContacts()`, `discoverAgents()`), files (`uploadFile()`, `sendFile()`).
  - `realtime.ts`: Realtime wrappers — `createWebSocketConnection()`, `createSSEConnection()`, `bridgeToSyncEngine()` for sync engine integration, `REALTIME_EVENTS` constants.
  - `webhook.ts`: Webhook handler — `createWebhookHandler()` with HMAC-SHA256 verification, Express/Hono middleware adapters, `verifyWebhookSignature()`, reply builders.
  - `types.ts`: Type re-exports from SDK + application-specific extensions (`PaperContent`, `SearchResult`, `ParsedDocument`, `WorkspaceIMBinding`, `PrismerIMMessage`, `CloudSDKStatus`).
  - `index.ts`: Unified exports for all modules.
- S3: Environment variables documented: `PRISMER_API_KEY`, `PRISMER_BASE_URL` (via .env).

---

## Phase 4 — Cloud SDK Integration

> Reference: `docs/ROADMAP.md` Phase 4, `@prismer/sdk v1.7`

### SDK Setup (Phase 4A) ✅
| # | Task | Status | Notes |
|---|------|--------|-------|
| S1 | Add `@prismer/sdk` to dependencies | ✅ done | Added `@prismer/sdk: ^1.7.0` to package.json |
| S2 | Create `src/lib/cloud/` client wrapper | ✅ done | 7 files: client, context, parse, im, realtime, webhook, types |
| S3 | Configure environment variables | ✅ done | `PRISMER_API_KEY`, `PRISMER_BASE_URL` via .env |

### IM Integration (MVP Complete ✅)
| # | Task | Status | Notes |
|---|------|--------|-------|
| IM1 | IM service layer | ✅ done | `src/lib/services/im.service.ts` — CRUD for IMUser, IMConversation, IMMessage |
| IM2 | IM API routes | ✅ done | `/api/v2/im/register`, `/api/v2/im/conversations`, `/api/v2/im/workspace` |
| IM3 | Workspace-IM binding | ✅ done | `useIMSync` hook — auto-initializes IM conversation for workspace |
| IM4 | Message persistence | ✅ done | User/agent messages persisted via `/api/v2/im/conversations/[id]/messages` |
| IM5 | Plugin type alignment | ✅ done | Prismer IM Plugin types updated for SDK v1.7 message types |
| IM6 | Frontend realtime SDK migration | deferred | agent-server.ts handles full session sync; SDK realtime for future cross-workspace only |
| IM7 | Cloud SDK client integration | deferred | Local IM API routes remain; unified persistence via Phase 4C PersistenceProxy |
| IM8 | File uploads | ready | `uploadFile()`, `sendFile()` (up to 50MB) via cloud wrapper |

### Persistence Foundation (Phase 4C) — NEW
> Goal: Activate existing `PrismaSessionPersistence`, make messages/tasks/timeline survive page refresh.

| # | Task | Status | Notes |
|---|------|--------|-------|
| PF1 | PersistenceProxy class in agent-server.ts | pending | HTTP calls to Next.js REST APIs for save/load |
| PF2 | `/api/workspace/[id]/tasks` route | pending | GET/PUT/PATCH using PrismaSessionPersistence |
| PF3 | `/api/workspace/[id]/timeline` route | pending | GET/POST using PrismaSessionPersistence |
| PF4 | `/api/workspace/[id]/session` route | pending | GET full session state (messages+tasks+timeline+componentStates) |
| PF5 | Implement `/api/workspace/[id]/messages` | pending | GET (paginated) + POST (upsert) — stub exists |
| PF6 | Wire agent-server.ts callbacks → PersistenceProxy | pending | onMessage, onTaskUpdate, onTimelineEvent → save |
| PF7 | Frontend session hydration | pending | Load from `/api/workspace/:id/session` before WebSocket connect |
| PF8 | Simplify useIMSync | pending | Remove persistMessage(), keep read-only + IM init |
| PF9 | Schema: add parentId, status to WorkspaceMessage | pending | Threading + delivery status support |

### Context API Integration (Phase 4D) — NEW
> Goal: Agent can load paper HQCC content and search related papers via Cloud SDK.

| # | Task | Status | Notes |
|---|------|--------|-------|
| CX1 | ContextManager class | pending | `src/lib/context/contextManager.ts` — wraps Cloud SDK context.load(), parsePdf(), search() |
| CX2 | contextStore (Zustand) | pending | activePaper, referencedPapers, isLoadingContext |
| CX3 | Wire PDF reader → ContextManager | pending | COMPONENT_EVENT (document loaded) triggers loadPaper() |
| CX4 | Enrich agent messages with context | pending | ContainerBridge.sendUserMessage() includes HQCC context |
| CX5 | Paper content loading wrapper | ready | `loadPaperContent()` in `src/lib/cloud/context.ts` |
| CX6 | Search with ranking | ready | `searchPapers()` with cache_first preset |
| CX7 | Content caching | ready | `cacheContent()`, `cacheContentBatch()` in cloud wrapper |

### File Pipeline (Phase 4E) — NEW
> Goal: File upload in ChatPanel, container file sync, file message rendering.

| # | Task | Status | Notes |
|---|------|--------|-------|
| FP1 | ChatInput file attachment button | pending | Paperclip icon click → file picker |
| FP2 | ChatInput drag-drop upload | pending | Drag files to ChatInput → auto-upload |
| FP3 | `/api/workspace/[id]/files/upload` route | pending | Binary file upload to S3 via Cloud SDK |
| FP4 | File message rendering in MessageList | pending | Image preview, PDF/code open, download link |
| FP5 | Container file sync (push) | pending | ContainerBridge.pushFileToContainer() via exec |
| FP6 | Container file sync (pull) | pending | Monitor container file events → write to DB |
| FP7 | fileStore (Zustand) | pending | Workspace file state |

### IM Convergence (Phase 4F) — NEW
> Goal: Unified message persistence path, extended sync matrix.

| # | Task | Status | Notes |
|---|------|--------|-------|
| IC1 | Unify to WorkspaceMessage only | pending | Remove IMMessage dual-write for workspace chat |
| IC2 | Add files sync rule to defaultMatrix | pending | server_wins, desktop rw, mobile read, agent rw |
| IC3 | Add context sync rule to defaultMatrix | pending | broadcast, cache with TTL |
| IC4 | Extend SessionState with files/context | pending | `src/lib/sync/types.ts` |
| IC5 | Webhook handler | ✅ done | `createWebhookHandler()` with HMAC verification |
| IC6 | IM6: Frontend SDK realtime | deferred | Not needed — agent-server.ts handles realtime sync |
| IC7 | IM7: Cloud SDK client migration | deferred | Local IM API routes remain for now |

---

## Upcoming Tasks — Plugin & Skill System

> Reference: `docs/API_SCHEMA_ANALYSIS.md`

### Plugin Alignment (Cloud SDK v1.7)
| # | Task | Status | Notes |
|---|------|--------|-------|
| PL1 | Refactor prismer-im to use SDK | pending | Replace custom WebSocket with `client.im.realtime.connectWS()` |
| PL2 | Migrate IM message types | done | `types.ts` updated with SDK v1.7 message types (text, markdown, code, image, file, tool_call, tool_result, system_event, thinking) |
| PL3 | Keep prismer-specific extensions | done | `sendDirective`, `sendSkillEvent` remain custom in `channel.ts` |
| PL4 | Enhance prismer-workspace with SDK | pending | Add Context API, Parse API integration |

### Skill Management System
| # | Task | Status | Notes |
|---|------|--------|-------|
| SK1 | Create find-skills skill | done | `docker/plugin/prismer-workspace/skills/find-skills/` |
| SK2 | Backend: `/api/skills` routes | done | List, search, get, install, uninstall |
| SK3 | Add skills[] to AgentInstance model | done | Added `installedSkills` JSON field |
| SK4 | Create skillStore (frontend) | done | `src/store/skillStore.ts` with selectors |
| SK5 | Create SkillManager components | done | Dialog, Card, Details in `SkillManager/` |
| SK6 | Integrate into workspace settings | done | Package button in WorkspaceChat header |

### Gap Resolution
| # | Task | Status | Notes |
|---|------|--------|-------|
| GAP1 | Add auth proxy for OpenClaw Gateway | pending | `/api/v1/gateway/*` needs token injection |
| GAP2 | Create skill registry API | pending | Local file + future cloud catalog |
| GAP3 | Frontend realtime SDK migration | pending | Replace custom WebSocket in useAgentConnection |

---

## Phase 5 — Open-Source Workspace-UI (NEW)

> Design: `docs/OPENSOURCE_ARCHITECTURE.md`
> Feasibility: `docs/CONTAINER_FRONTEND_FEASIBILITY.md`
> Protocol: `docs/CONTAINER_PROTOCOL.md` Change Type V
> Strategy: API Path Compatibility — Gateway mimics Cloud API, frontend 100% reuse, zero modifications

### 5A.1 Extract & Build workspace-ui Package

| # | Task | Status | Notes |
|---|------|--------|-------|
| OS1 | Create `packages/workspace-ui/` package | pending | Monorepo structure |
| OS2 | Copy workspace components (33+ files) | pending | From `src/app/workspace/components/` |
| OS3 | Copy workspace stores (7 stores) | pending | From `src/app/workspace/stores/` |
| OS4 | Copy workspace hooks & lib | pending | From `src/app/workspace/hooks/`, `lib/` |
| OS5 | Copy editor previews | pending | From `src/components/editors/previews/` |
| OS6 | Copy shadcn/ui primitives | pending | From `src/components/ui/` |
| OS7 | Set up Vite + React 19 + Tailwind 4 | pending | `vite.config.ts`, `tailwind.config.ts` |
| OS8 | Resolve `@/` path aliases | pending | Vite aliases or relative imports |
| OS9 | Build succeeds, SPA loads standalone | pending | `npm run build` → `dist/` |

### 5A.2 Gateway API Compatibility Routes

| # | Task | Status | Notes |
|---|------|--------|-------|
| GW1 | Bridge GET status `/api/v2/im/bridge/:wsId` | pending | Return fixed `connected` status |
| GW2 | Bridge POST chat `/api/v2/im/bridge/:wsId` | pending | Gateway → Agent → directives → response |
| GW3 | Bridge GET history `?include=messages` | pending | SQLite → message list |
| GW4 | Agent health `/api/agents/:id/health` | pending | Fixed `running` response |
| GW5 | Agent status `/api/agents/:id/status` | pending | Fixed running + gateway URL |
| GW6 | Agent directive `/api/agents/:id/directive` | pending | Save directive for plugin compat |
| GW7 | Container proxy jupyter `/api/container/:id/jupyter/*` | pending | Direct proxy to :8888 |
| GW8 | Container proxy latex `/api/container/:id/latex/*` | pending | Direct proxy to :8080 |
| GW9 | Static file serving at `/` | pending | Serve workspace-ui SPA |

### 5A.3 Local Persistence (SQLite)

| # | Task | Status | Notes |
|---|------|--------|-------|
| DB1 | SQLite integration in gateway | pending | `better-sqlite3` or built-in |
| DB2 | Messages table | pending | `id, content, role, sender_id, created_at` |
| DB3 | State table | pending | `key, value (JSON), updated_at` |
| DB4 | Directives table | pending | `id, type, payload, processed, created_at` |

### 5A.4 Container Integration

| # | Task | Status | Notes |
|---|------|--------|-------|
| CI1 | Update Dockerfile.openclaw | pending | `COPY packages/workspace-ui/dist/ /app/frontend/` |
| CI2 | Update docker/VERSIONS.md | pending | Add workspace-ui row |
| CI3 | Update docker/compatibility.json | pending | Add workspace-ui component |
| CI4 | Update docker/versions-manifest.json | pending | Add workspace-ui version |
| CI5 | E2E: Local mode (container :3000) | pending | Chat + editors in browser |
| CI6 | E2E: Dual-mode validation | pending | Same test suite, both modes |

## Phase 4G — Agent Automation (Cron, Hooks, Heartbeat)

> Backend SSoT for agent proactive behavior. Design: `docs/DESIGN.md` Scheduler Panel, `docs/ARCH.md` Section 12.5
> Protocol: `docs/CONTAINER_PROTOCOL.md` Change Type VI

### 4G.1 Backend Cron Job Management

| # | Task | Status | Notes |
|---|------|--------|-------|
| CJ1 | Prisma model: `AgentCronJob` | pending | schedule JSON, payload JSON, delivery JSON, gatewayJobId |
| CJ2 | `GET /api/agents/:id/cron` — list jobs | pending | Filter by agentInstanceId, include next/last run |
| CJ3 | `POST /api/agents/:id/cron` — create job | pending | Validate schedule, persist to DB, deploy to container |
| CJ4 | `PATCH /api/agents/:id/cron/:jobId` — update | pending | Update schedule/payload/enabled, re-deploy |
| CJ5 | `DELETE /api/agents/:id/cron/:jobId` — delete | pending | Remove from DB + container |
| CJ6 | `deployCronJobs()` in orchestrator | pending | Write `jobs.json` to container `/home/user/.openclaw/agent/` |
| CJ7 | Re-deploy cron jobs on container restart | pending | Add to `deployConfig()` sequence in start/route.ts |
| CJ8 | Bidirectional sync: detect agent-created jobs | pending | Poll gateway `/jobs` → compare with DB → persist new entries |

### 4G.2 Hook Management

| # | Task | Status | Notes |
|---|------|--------|-------|
| HK1 | `GET /api/agents/:id/hooks` — list hooks | pending | Read HOOK.md + handler files from container |
| HK2 | `PATCH /api/agents/:id/hooks/:hookId` — toggle | pending | Enable/disable individual hooks |
| HK3 | Persist hook state in `AgentConfig.hooks` | pending | JSON field storing enabled/disabled per hook event |

### 4G.3 Heartbeat Configuration

| # | Task | Status | Notes |
|---|------|--------|-------|
| HB1 | `PATCH /api/agents/:id/heartbeat` — config | pending | Enable/disable + set interval (default 30min) |
| HB2 | Deploy heartbeat as special cron job | pending | kind: interval, sessionTarget: main, payload: systemEvent+wakeMode |

### 4G.4 Scheduler Panel UI

| # | Task | Status | Notes |
|---|------|--------|-------|
| SP1 | ⏰ button in WorkspaceChat ActionBar | pending | Opens SchedulerPanel popover/dialog |
| SP2 | Job list view with tabs | pending | Cron Jobs / Hooks / Heartbeat tabs |
| SP3 | New Job dialog | pending | Name, schedule type, prompt, session, timezone |
| SP4 | Edit/Pause/Resume/Delete actions | pending | Inline actions on each job row |
| SP5 | Hook toggle switches | pending | Read-only list with enable/disable toggles |
| SP6 | Heartbeat toggle + interval slider | pending | Single control for heartbeat config |

---

### 5D. Public Workspace & Social Distribution

> Prerequisite: Phase 5A substantially complete. Design: `docs/DESIGN.md` Section 5.4, `docs/WINDOWVIEW_DESIGN.md` Section 7.4, `docs/BUSINESS_ANALYSIS.md` Section 2.3

#### 5D.1 Visibility & Access Control

| # | Task | Status | Notes |
|---|------|--------|-------|
| PW1 | Add `visibility` field to WorkspaceSession | pending | Enum: `private` / `unlisted` / `public` |
| PW2 | Create WorkspaceStar model | pending | userId + workspaceId, unique constraint |
| PW3 | Create WorkspaceFork model | pending | sourceId + targetId + userId |
| PW4 | Create WorkspaceComment model | pending | Threaded, separate from Agent chat messages |
| PW5 | API: PATCH /api/workspace/:id/visibility | pending | Toggle public/private/unlisted |
| PW6 | Guest access middleware | pending | Unauthenticated read-only for public workspaces |
| PW7 | Rate limiting for public endpoints | pending | Prevent abuse on unauthenticated routes |

#### 5D.2 Social Features

| # | Task | Status | Notes |
|---|------|--------|-------|
| PW8 | Star API + UI button | pending | Toggle + count, affect trending |
| PW9 | Fork API + deep copy logic | pending | Papers (DOI re-fetch), notebooks, drafts, agent config |
| PW10 | Comment API + UI | pending | Threaded comments in Chat Panel bottom section |
| PW11 | Collaboration request flow | pending | Request → notification → Owner approve/reject |
| PW12 | Activity notifications | pending | Forks, stars, comments → Owner notification |

#### 5D.3 Discovery Integration

| # | Task | Status | Notes |
|---|------|--------|-------|
| PW13 | "Trending Workspaces" section in Discovery | pending | Alongside paper feed |
| PW14 | Trending algorithm | pending | Stars + forks + recent activity weighted |
| PW15 | Category/discipline tags for workspaces | pending | Reuse paper category taxonomy |
| PW16 | Search: include public workspaces | pending | Unified search results |

#### 5D.4 Read-Only UI Mode

| # | Task | Status | Notes |
|---|------|--------|-------|
| PW17 | WindowViewer read-only mode | pending | All 8 components: view-only rendering |
| PW18 | Chat Panel read-only | pending | Scrollable history, no input box |
| PW19 | Timeline read-only with replay | pending | Full process playback |
| PW20 | Social action bar | pending | Star / Fork / Comment / Collaborate buttons |
| PW21 | Mobile public workspace view | pending | Read-only mobile layout |
| PW22 | E2E: public workspace access flow | pending | Unauth → view → login → star/fork |