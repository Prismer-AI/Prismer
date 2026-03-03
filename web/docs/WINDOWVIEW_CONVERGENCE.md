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

# WindowView Convergence — Implementation Tracker

> **Version:** 3.1 | **Date:** 2026-02-26
> **Branch:** `feat/windowview-integration`
> **Status:** Plugin v0.5.0 (26 tools); Four-layer test architecture (Unit + L1:21 + L2:32 + L3:6 = 59+ tests); Container Image v4.5
>
> **Companion docs:**
> - `docs/WINDOWVIEW_DESIGN.md` v3.1 — Product design specification (authoritative design document)
> - `docs/WINDOWVIEW_STATUS.md` v2.1 — Technical implementation analysis (code status of each component)

---

## 1. Document Positioning

This document tracks the **implementation status** of WindowView component unification improvements.

- **Design specification** → see WINDOWVIEW_DESIGN.md (artifact workbench, timeline, Agent control, and other product logic)
- **Technical status** → see WINDOWVIEW_STATUS.md (internal layout, code analysis, and container integration for each component)
- **This document** → focuses on "what improvements have been done / what hasn't been done / what to do next"

---

## 2. Unification Goals

WindowViewer hosts 8 editor components, and their independent development has led to 5 systemic issues:

| # | Issue | Goal |
|---|-------|------|
| 1 | **Visual fragmentation** — 6 different border-radius/border/background-color variants | Components have no shell; WindowViewer provides a unified one |
| 2 | **Theme inconsistency** — LaTeX/Code have their own dark mode toggles | Remove in-component toggles; editors use fixed dark theme (semantic choice) |
| 3 | **Inconsistent AI integration** — each calls /api/ai/chat with different parameters | Unified ai-client + parameter normalization |
| 4 | **Fragmented artifact management** — lacking multi-instance support | Compact dropdown selector, artifact multi-instance management |
| 5 | **Idle state sync** — sync engine is ready but components are not connected | componentStore → sync bridge → DB |

---

## 3. Implementation Status (Verified 2026-02-24)

### Phase A — Foundation

| Task | File | Status | Verification Result |
|------|------|--------|---------------------|
| Fix temperature bug | `src/app/api/ai/chat/route.ts` | ✅ Done | `isReasoningModel()` + `normalizeForReasoningModel()` exist (line 24, 59) |
| Create unified AI client | `src/lib/services/ai-client.ts` | ✅ File exists | Need to verify if components actually call it |
| Fix LaTeX content disappearing | `LatexEditorPreview.tsx` | ✅ Done | Conditional rendering changed to CSS hidden |
| Define Toolbar specification | `src/components/shared/ComponentToolbar.tsx` | ✅ File exists | Need to verify if components actually use it |

### Phase B — Visual Convergence

| Component | Change | Status | Verification Result |
|-----------|--------|--------|---------------------|
| **LaTeX** | Remove isDarkTheme + Sun/Moon | ✅ Done | Confirmed no isDarkTheme, no Sun/Moon icon |
| **LaTeX** | Remove shell rounded-xl border | ✅ Done | Confirmed outer div is `flex flex-col h-full bg-white` |
| **LaTeX** | Remove AgentChatPanel | ⚠️ Partial | File `AgentChatPanel.tsx` still exists, but may not be imported |
| **Code Playground** | Fix vs-dark, remove Sun/Moon | ⚠️ Unverified | Need to check code |
| **AG Grid** | Remove shell, unify toolbar | ⚠️ Unverified | Need to check code |
| **AI Editor** | Toolbar horizontal scroll CSS | ⚠️ Unverified | Need to check CSS override |
| **Jupyter** | Floating sidebar, auto-connect, merge state | ⚠️ Unverified | Need to check code |
| **PDF Reader** | Already a clean wrapper | ✅ N/A | Was originally a thin wrapper |

### Phase C — LLM Unification

| Task | Status | Verification Result |
|------|--------|---------------------|
| Migrate components to ai-client.ts | ⚠️ Unverified | Need to check if each component actually imports ai-client |
| LLMUsageLog implementation | ⚠️ Unverified | Documentation claims console logging; need to confirm |
| Environment variable configuration validation | ✅ Done | OPENAI_API_BASE_URL → NewAPI gateway |

### Phase D — Asset Browser

| Task | Status | Verification Result |
|------|--------|---------------------|
| AssetBrowser shared component | ✅ File exists | `src/components/shared/AssetBrowser.tsx` |
| Integrate into Notes, AG Grid, Jupyter | ⚠️ Unverified | Need to check import and usage |
| PDF Reader Notes option | ⚠️ Unverified | Need to check notes:insert event |
| Artifacts → Notes | ⚠️ Unverified | Need to check ArtifactPreview |

### Phase E — State Sync

| Task | Status | Verification Result |
|------|--------|---------------------|
| Jupyter sync configuration | ✅ File exists | `componentStateConfig.ts` |
| componentStore → sync bridge | ✅ File exists | `componentStateBridge.ts` |
| DOM event replacement | ✅ File exists | `useComponentBusEvent.ts` |
| Content sync | ✅ File exists | `useContentSync.ts` |

**Note**: The above 4 items have "file exists" status but it has not been verified whether components are actually connected (i.e., whether sync bridge is called by componentStore, whether DOM events have actually been replaced).

### Phase F — Deep Integration

| Task | Status | Verification Result |
|------|--------|---------------------|
| Jupyter Cell → Agent Skill | ✅ File exists | `cellSkills.ts` |
| Jupyter Copilot redesign | ✅ File exists | `copilotService.ts` |
| LaTeX Copilot | ✅ File exists | `latexCopilotService.ts` |

**Note**: The above 3 items have "file exists" status but it has not been verified whether any component calls these services.

---

## 4. Created Files Index

The following files were created during Phase A-F and are confirmed to exist in the codebase:

| File | Created In | Purpose |
|------|------------|---------|
| `src/components/shared/ComponentToolbar.tsx` | Phase A | Standardized toolbar (left/center/right slots) |
| `src/lib/services/ai-client.ts` | Phase A | Unified AI call client |
| `src/components/shared/AssetBrowser.tsx` | Phase D | Shared file browser (CommandPalette style) |
| `src/lib/sync/componentStateBridge.ts` | Phase E | Store → Sync engine bridge |
| `src/lib/events/useComponentBusEvent.ts` | Phase E | Component event bus hooks |
| `src/lib/sync/useContentSync.ts` | Phase E | Debounced content sync hooks |
| `src/components/editors/jupyter/skills/cellSkills.ts` | Phase F | 11 Jupyter cell skills |
| `src/components/editors/jupyter/services/copilotService.ts` | Phase F | 6 Jupyter copilot actions |
| `src/components/editors/previews/latex-agent/services/latexCopilotService.ts` | Phase F | 7 LaTeX copilot actions |

---

## 5. Visual Specification (Target State)

### 5.1 WindowViewer Owns the Shell, Components Only Handle Content

All components should:
- Remove their own `rounded-*`, `border`, `shadow`
- Fill the WindowViewer's `absolute inset-0` container
- Code editor types use dark background (semantic choice, not a "theme")
- Use `overflow-hidden` to let content clip naturally within the host's border radius

### 5.2 Unified Toolbar Specification

```
Height: h-10 (40px)
Padding: px-3 py-2
Background:
  document types: bg-white/80 backdrop-blur border-b border-slate-200
  editor types:   bg-slate-800/80 backdrop-blur border-b border-slate-700
Buttons: h-7 px-2 text-xs rounded-md
Separator: w-px h-5 bg-current opacity-20
```

### 5.3 Theme Strategy

No global dark mode is introduced. Components fall into two categories:

| Category | Components | Background |
|----------|------------|------------|
| Document types | Notes, Reader, Data | Follow host white background |
| Editor types | LaTeX, Code, Jupyter | Fixed dark background (VS Code convention) |
| Display types | Gallery, 3D | Follow host white background |

---

## 6. Next Steps

### 6.1 Verification Gap (Needs Immediate Completion)

A large number of "⚠️ Unverified" items in Phase B-F need to be verified one by one:

```
Verification method: For each "file exists" item
  1. Confirm the file content is functional code (not a stub/placeholder)
  2. Confirm other files import and use it
  3. If it's a service (e.g., copilotService), confirm there is a UI trigger entry point
```

### 6.2 New Work to Align with DESIGN v2.0

The following are P0 tasks defined by DESIGN v2.0 that have not yet started:

| Task | Design Reference | Dependency |
|------|------------------|------------|
| **Artifact instance selector (secondary navigation)** | DESIGN §3.2 | Refactor componentStore to multi-instance |
| **Workspace ↔ Collection auto-binding** | DESIGN §5.2 | New FK in Prisma schema |
| **Asset → WindowView routing** | DESIGN §3.5 | Secondary selector + type mapping |

### 6.3 Legacy Cleanup

| Task | Description |
|------|-------------|
| Delete or confirm AgentChatPanel.tsx | Phase B claimed it was removed but the file still exists; need to confirm if there are still imports |
| Unify toolbar padding | Some components have been changed to `px-3 py-2`; need to check remaining components |
| Remove hardcoded min-h | LaTeX `min-h-[700px]` and Notes `min-h-[500px]` need to be removed |

---

## 7. Test Architecture (Test Layer Architecture)

> **Last verified**: 2026-02-27 | **Plugin**: v0.5.0 (26 tools) | **Container Image**: v4.5

### 7.1 Test Layer Concept

The test architecture is divided into 4 layers, progressing from unit to end-to-end:

```
Layer 3 — Real Agent E2E          (End-to-end correctness)
    ↑ Real Agent + LLM → Real directive → Browser rendering
Layer 2 — Component / Directive   (UI correctness)
    ↑ Mock Agent → Inject directive → Assert DOM rendering
Layer 1 — API / Infrastructure    (Protocol correctness)
    ↑ Real container API → Bridge / Health / Directive SSE
Unit   — Unit Tests               (Logic correctness)
    ↑ Pure logic tests for Store/Hook/Service/API handlers
```

**Test framework**: Unit = Vitest (jsdom) | Layer 1/2/3 = Playwright

**Run commands**:
```bash
npx vitest                           # Unit tests
npm run test:layer1                  # Layer 1 (timeout: 120s)
npm run test:layer2                  # Layer 2 (timeout: 60s)
npm run test:layer3                  # Layer 3 (timeout: 180s)
npm run test:e2e                     # All layers (Playwright)
```

### 7.2 Overview Table

| Layer | Location | File Count | Test Count | Dependencies | Verification Target |
|-------|----------|------------|------------|--------------|---------------------|
| **Unit** | `tests/unit/` | 8 | ~50+ | No external dependencies (jsdom) | Store / Hook / API handler / Directive mapping |
| **L1** | `tests/layer1/` | 5 | 21 | Running container | Bridge protocol, Health API, Directive SSE, Context API |
| **L2** | `tests/layer2/` | 7 | 32 | Dev server only (mock agent) | Directive injection → Component rendering → Content verification |
| **L3** | `tests/layer3/` | 2 | 6 | Dev server + Container + LLM | Real Agent reasoning → Complete MVP scenarios |
| **Total** | | **22** | **59+** | | |

### 7.3 Unit Tests (Vitest)

**Location**: `tests/unit/` (8 files)
**Configuration**: `vitest.config.ts` → `include: ['tests/unit/**/*.{test,spec}.{ts,tsx}']`
**Setup**: `tests/helpers/setup-vitest.ts` (ResizeObserver, matchMedia mocks)

| File | Coverage Scope |
|------|----------------|
| `directive-mapping.test.ts` | Directive type mapping and schema validation |
| `stores/syncActions.directive.test.ts` | Zustand store directive action handlers |
| `components/AgentControlPanel.test.tsx` | Agent control panel component |
| `components/AgentStatusBadge.test.tsx` | Agent status badge component |
| `hooks/useDirectiveStream.test.ts` | WebSocket directive stream hook |
| `lib/directive-queue.test.ts` | Directive queue deduplication |
| `api/agents.test.ts` | Agent API endpoint handlers |
| `api/workspace-context.test.ts` | Workspace context API handlers |

**Gap**: Plugin code (`docker/plugin/prismer-workspace/`) has no unit tests. Parameter handling, directive construction, and error paths for all 26 tools lack unit test coverage.

### 7.4 Layer 1 — API & Infrastructure Integration (21 tests)

**Location**: `tests/layer1/` (5 files)
**Dependencies**: Running container + Agent. No browser.
**Principle**: Directly call REST API → Verify response structure → Collect SSE directive stream.

| Spec File | Test Count | Verification Target |
|-----------|------------|---------------------|
| `workspace-context.spec.ts` | 9 | Context API (structured state) + Container File Sync |
| `container-health.spec.ts` | 4 | Agent health, Gateway connectivity, Service readiness |
| `bridge-protocol.spec.ts` | 4 | Bridge message send/receive, status check, empty message rejection |
| `directive-delivery.spec.ts` | 3 | SSE directive stream, schema validation, component name validity |
| `data-tools.spec.ts` | 4 | data_list / data_load tool invocation → UPDATE_DATA_GRID directive |

### 7.5 Layer 2 — Component & Directive Interaction (32 tests)

**Location**: `tests/layer2/` (7 files)
**Dependencies**: Dev server (:3000) + Desktop Chrome. **No container, no LLM needed**.
**Principle**: `mockAgentReady()` simulates Agent running state → `injectDirective()` / `injectDirectiveSequence()` injects directives → Assert DOM rendering.

| Spec File | Test Count | Verified MVP Scenario |
|-----------|------------|-----------------------|
| `t0-identity.spec.ts` | 2 | Agent identity message rendering, sender name |
| `t1-latex-survey.spec.ts` | 4 | SWITCH → UPDATE_LATEX → COMPILE_COMPLETE sequence |
| `t2-jupyter-plot.spec.ts` | 4 | SWITCH → UPDATE_NOTEBOOK → UPDATE_GALLERY sequence |
| `t3-notes-template.spec.ts` | 4 | SWITCH → UPDATE_NOTES sequence, template content verification |
| `t4-pdf-reader.spec.ts` | 5 | load_document (arXiv/URL/upload), navigate_to_page, auto-switch |
| `t5-workspace-context.spec.ts` | 3 | Bridge metadata, Context API, Container sync |
| `component-crud.spec.ts` | 5 | 8 component type cycling, AG Grid / Code data injection, rapid switching stability |

**Test helper modules** (`tests/helpers/`):
- `mock-agent.ts` — `mockAgentReady()`, `injectDirective()`, `forceAgentRunning()`
- `trace-collector.ts` — CustomEvent tracing + trace file output
- `playwright-utils.ts` — `waitForWorkspace()`, `waitForActiveComponent()`

**Fixture data** (`tests/fixtures/`):
- `directives/` — Predefined directive payloads (switch, latex, jupyter, notes, code, data-grid, gallery)
- `agent-responses/` — Predefined Agent responses (t0-identity, t1-latex, t2-jupyter, t3-notes)

### 7.6 Layer 3 — E2E MVP Scenarios (6 tests)

**Location**: `tests/layer3/` (2 files)
**Dependencies**: Dev server + Desktop Chrome + Running container + LLM.
**Principle**: Real Agent reasoning → Real tool invocation → Real directive → Browser rendering verification.

| Spec File | Test Count | Verification Scenario |
|-----------|------------|-----------------------|
| `mvp-scenarios.spec.ts` | 4 | T0: Identity response, T1: LaTeX survey + compile, T2: Trigonometric function plotting, T3: Experiment notes template |
| `data-workflow.spec.ts` | 2 | data_load → UPDATE_DATA_GRID, data_query → Filtered data |

**Key Findings**:
- Agent average response 8-22s (including LLM reasoning + tool execution)
- WebSocket auth flow: `connect.challenge → token auth → hello-ok → chat.send → streaming → chat.final`
- Token-only auth is sufficient (device credentials optional for local mode)

### 7.7 Directive Pipeline Alignment

```
Plugin (tools.ts)                    Frontend (syncActions.ts)
─────────────────                    ────────────────────────
sendDirective(SWITCH_COMPONENT)  ──→  setActiveComponent()        ✅ L2 verified
sendDirective(UPDATE_NOTES)      ──→  CustomEvent handler         ✅ L2 t3 verified
sendDirective(UPDATE_LATEX)      ──→  CustomEvent handler         ✅ L2 t1 verified
sendDirective(UPDATE_NOTEBOOK)   ──→  CustomEvent handler         ✅ L2 t2 verified
sendDirective(UPDATE_GALLERY)    ──→  CustomEvent handler         ✅ L2 t2 verified
sendDirective(UPDATE_CODE)       ──→  CustomEvent handler         ✅ L2 component-crud verified
sendDirective(UPDATE_DATA_GRID)  ──→  CustomEvent handler         ✅ L2 component-crud verified
sendDirective(PDF_LOAD)          ──→  updateComponentState()      ✅ L2 t4 verified
sendDirective(COMPILE_COMPLETE)  ──→  CustomEvent handler         ✅ L2 t1 verified
sendDirective(CELL_RESULT)       ──→  CustomEvent handler         ⚠️ Indirect (L2 t2)
```

### 7.8 Auto UI Directive Mechanism

- In `tools.ts`, 10 out of the 12 base tools automatically trigger `SWITCH_COMPONENT` directive during content operations
- Directives are sent via HTTP POST `${apiBaseUrl}/api/agents/${agentId}/directive`
- Bridge POST response contains `directives: []` — directives are side-effects, not returned in WebSocket responses
- Frontend receives them via SSE directive stream (`/api/agents/:id/directive/stream`)

### 7.9 Version Management and Testing

- Each plugin has a `version.ts` SSoT file
- `docker/compatibility.json` defines the compatibility matrix
- Agent startup Step 7 automatically validates versions; mismatches only warn (do not block)
- Container gateway v1.1.0 has a `/api/v1/stats` endpoint (per-service tracking)

### 7.10 Test Coverage Gap

| Priority | Gap | Impact | Recommendation |
|----------|-----|--------|----------------|
| **P0** | Plugin 0/26 unit test coverage | No regression protection for parameter validation and error paths | Add vitest tests for tools.ts |
| **P1** | v0.5.0 newly added 12 extension tools have no L1/L3 coverage | data_list, data_load, data_query, data_save, latex_project, latex_project_compile, get_paper_context, navigate_pdf, context_search, context_load, get_workspace_state, sync_files_to_workspace all lack container integration tests | Add incrementally based on usage frequency |
| **P1** | Layer 3 has only 6 scenarios | Data workflow coverage is low | Add code_execute and latex_project E2E tests |
| **P2** | `send_ui_directive`, `arxiv_to_prompt` have no coverage at any layer | 2 tools are completely untested | Prioritize based on usage frequency |

---

## 8. Change History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-21 | Initial version: 6 Phase design + implementation plan |
| 1.1 | 2026-02-21 | Marked as "All 6 phases COMPLETE" |
| 2.0 | 2026-02-24 | **Rewrite**: Corrected status based on code verification (many "✅" changed to "⚠️ Unverified"); removed design content (migrated to DESIGN.md v2.0); repositioned as implementation tracking document |
| 2.1 | 2026-02-24 | Added §7 E2E test verification results (4/4 scenarios passed); Container→Bridge→Agent full-chain verification; Auto UI directive + gateway stats architecture analysis |
| 3.0 | 2026-02-26 | **§7 rewritten as three-layer test architecture**: Layer 0 (unit tests) / Layer 1 (container integration) / Layer 2 (frontend rendering); 12 tools × 3 layers alignment matrix; Directive pipeline alignment analysis; Plugin v0.3.0 version update; Test coverage gap analysis |
| 3.1 | 2026-02-27 | **§7 rewritten as four-layer test architecture**: Unit (tests/unit/, 8 files) / L1 (tests/layer1/, 5 files, 21 tests) / L2 (tests/layer2/, 7 files, 32 tests) / L3 (tests/layer3/, 2 files, 6 tests); Version alignment: Plugin v0.4.0→v0.5.0 (26 tools), Container Image v4.4→v4.5; Directive pipeline alignment update |
