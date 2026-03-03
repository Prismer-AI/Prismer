# WindowView Component Status — Current Implementation Analysis

> **Version:** 3.0 | **Date:** 2026-02-26 | **Branch:** `feat/windowview-integration`
> **Purpose:** Comprehensive code analysis of all 8 WindowView components — internal layout, sync infrastructure, container integration, and multi-instance readiness.
> Help the next development phase with accurate status, gaps, and integration points.
>
> **Companion docs:**
> - `docs/WINDOWVIEW_DESIGN.md` v2.0 — 产品设计（产物工作台、阶段式时间线、Agent 控制分层）
> - `docs/WINDOWVIEW_CONVERGENCE.md` — 视觉统一 & 代码改进跟踪
>
> **Milestone reference:** OpenClaw Agent Full Lifecycle merged to `develop` (2026-02-24).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Component 0: Open / Visual Unification](#2-component-0-open--visual-unification)
3. [Component 1: Notes (AiEditor)](#3-component-1-notes-aieditor)
4. [Component 2: Reader (PDF)](#4-component-2-reader-pdf)
5. [Component 3: LaTeX Editor](#5-component-3-latex-editor)
6. [Component 4: Data (AG Grid)](#6-component-4-data-ag-grid)
7. [Component 5: Code Playground](#7-component-5-code-playground)
8. [Component 6: Jupyter Notebook](#8-component-6-jupyter-notebook)
9. [Supporting Components: Gallery, 3D Viewer](#9-supporting-components-gallery-3d-viewer)
10. [Sync Infrastructure](#10-sync-infrastructure)
11. [Container Integration Layer](#11-container-integration-layer)
12. [Cross-Cutting Concerns](#12-cross-cutting-concerns)
13. [Gap Summary Matrix](#13-gap-summary-matrix)
14. [Next Phase Priorities](#14-next-phase-priorities)

---

## 1. Architecture Overview

### Component Registration

All 8 components are lazy-loaded via dynamic `import()` in `src/app/workspace/components/WindowViewer/index.tsx` (lines 19-28):

```
componentLoaders: Record<ComponentType, () => Promise<{ default: ComponentType }>>
```

| ID | Display Name | Icon | Tab Color | Preview File |
|----|-------------|------|-----------|--------------|
| `ai-editor` | Notes | `FileEdit` | violet-600 | `AiEditorPreview.tsx` (567 lines) |
| `pdf-reader` | Reader | `FileText` | rose-600 | `PDFReaderPreview.tsx` (77 lines) |
| `latex-editor` | LaTeX | `FunctionSquare` | teal-600 | `LatexEditorPreview.tsx` (1,555 lines) |
| `code-playground` | Code | `Code2` | amber-600 | `CodePlaygroundPreview.tsx` (30 lines) → `CodePlayground.tsx` (908 lines) |
| `bento-gallery` | Gallery | `GalleryHorizontal` | pink-600 | `BentoGalleryPreview.tsx` (371 lines) |
| `three-viewer` | 3D | `Box` | blue-600 | `ThreeViewerPreview.tsx` (742 lines) |
| `ag-grid` | Data | `Table2` | emerald-600 | `AGGridPreview.tsx` (709 lines) |
| `jupyter-notebook` | Jupyter | `FileCode2` | orange-600 | `JupyterNotebookPreview.tsx` → `JupyterNotebook.tsx` (1,124 lines) |

### WindowView Vertical Layout

The WindowViewer container uses `flex flex-col h-full`:

```
┌─────────────────────────────────────────────────┐
│ ComponentTabs (一级 tab)              ~44px 固定  │
├─────────────────────────────────────────────────┤
│ Component Area (absolute inset-0)      flex-1    │
│ ┌─────────────────────────────────────────────┐ │
│ │ Component Toolbar (含二级选择器)  ~40px 固定  │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Component Body (编辑器/阅读器/画布)  flex-1  │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Component Status Bar (可选)        ~32px    │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Timeline                           ~44-280px    │
│ (折叠 ~44px / 展开 ~280px)                       │
└─────────────────────────────────────────────────┘
```

Components fill the `absolute inset-0` area via `motion.div`. WindowViewer owns the outer shell (`rounded-2xl` + shadow); components should NOT add their own border/rounded/shadow.

### Component Loading Flow

```
Tab click → onComponentChange(type)
  → WorkspaceView: setActiveComponent()
    → useComponentStore.setState({ activeComponent: type })
      → WindowViewer re-renders
        → useMemo recalculates lazy() wrapper
          → Suspense loads component + Framer Motion fade transition
```

### Multi-Instance Readiness

> **Design reference:** WINDOWVIEW_DESIGN.md v2.0 §3.2 — 每个工作台通过紧凑下拉选择器支持产物多实例

Current state: **only Reader has multi-instance** (`useMultiDocumentStore`). All other components are single-instance. The design calls for compact dropdown selectors (not tab bars) to avoid clashing with components' existing internal navigation.

| Component | Multi-Instance Status | Existing Internal Nav | Selector Integration Strategy |
|-----------|----------------------|----------------------|------------------------------|
| Reader | Has `useMultiDocumentStore` | 顶部文档 tab 条 | 复用已有 tab 条，升级为产物实例管理 |
| LaTeX | Single-instance | 文件 tab (main.tex, bib, sty) | 工程选择器（下拉）在文件 tab 上方 |
| Code | Single-instance | 左侧 FileTree | 项目选择器（下拉）在工具栏左侧 |
| Jupyter | Single-instance | 无 | 笔记本选择器（下拉）在工具栏左侧 |
| Notes | Single-instance | 无 | 笔记选择器（下拉）在工具栏左侧 |
| Data | Single-instance | 无 | 数据集选择器（下拉）在工具栏左侧 |
| Gallery | Single-instance | Pack selector | 复用已有 pack selector |
| 3D | Single-instance | Model selector | 复用已有 model selector |

### Error Handling

Each component is wrapped in `ComponentErrorBoundary` (WindowViewer lines 87-134) that catches render errors and shows a retry UI.

---

## 2. Component 0: Open / Visual Unification

### Current State

The "Open" component refers to how components are activated and how assets connect to workspace editors. There is **no dedicated "Open" component** — the functionality is distributed across:

- `ComponentTabs.tsx` — tab bar with 8 fixed tabs
- `PaperLibraryDialog` — opens inside PDF Reader for paper selection
- Asset Browser modals — embedded in some components (Notes, AG Grid, Code)

### Issues

| Issue | Location | Severity |
|-------|----------|----------|
| **No unified asset → component routing** | Various | HIGH |
| **Tab bar not connected to Asset page** | `ComponentTabs.tsx` | HIGH |
| **No "Open with..." pattern** | Missing | MEDIUM |
| **Visual inconsistency between components** | All previews | MEDIUM |

### Analysis

Opening a paper from `/assets` doesn't route to workspace's PDF Reader. Opening a dataset doesn't route to AG Grid. Each component has its own ad-hoc asset selection (PaperLibraryDialog, asset browser modal, file upload). There is no unified "open asset in component X" flow from outside the workspace.

**What's needed:**
- A routing layer: `openAsset(assetId, assetType) → map to ComponentType → switch tab → load document`
- Integration with `/assets` page navigation (deep link: `/workspace/{id}?open={assetId}`)
- Consistent visual frame for all 8 components (common toolbar pattern, consistent padding/margins)

---

## 3. Component 1: Notes (AiEditor)

**File:** `src/components/editors/previews/AiEditorPreview.tsx` (567 lines)

### Internal Layout

```
┌──────────────────────────────────────────────┐
│ AiEditor Toolbar (~40px, 横向滚动)            │
│ [B][I][U][H1..H6][List][Quote]...[AI tools]  │
├──────────────────────────────────────────────┤
│                                              │
│ Single-column editing area (flex-1)          │
│ (WYSIWYG rich text)                          │
│                                              │
│ min-h-[500px]                                │
└──────────────────────────────────────────────┘
```

- Toolbar: Third-party `aieditor` controls, CSS override for `overflow-x: auto; flex-wrap: nowrap`
- Body: Single WYSIWYG editor, no internal panels or sidebar
- No internal navigation — simplest layout of all 8 components

### Current Implementation

A rich text editor based on the `aieditor` library with 8 AI-powered text manipulation features.

**Data Flow:**
```
useComponentStore('ai-editor').content
  → AiEditor instance (imperative ref)
    → onChange → handleChange() → syncContent() [debounced 1000ms]
      → useComponentStore.updateComponentState()
```

**AI Features (working):**
- 4 slash commands: Continue Writing, Question, Translate, Generate Image
- 8 selection bubble menu actions: Improve, Summarize, Translate (EN/CN), Shorten, Lengthen, Fix Grammar, Continue

**AI Backend Path:**
```
AiEditor → /api/ai/chat (SSE proxy) → OpenAI-compatible API (Nacos config)
```

### Container Integration: NONE

The AI features route through `/api/ai/chat` (HTTP-only, line 162), which proxies to an external LLM (Kimi/GPT via Nacos). This is completely **separate from the OpenClaw container's LLM gateway**.

The container has its own LLM provider configured in `openclaw.json`, but Notes doesn't use it.

### Persistence

| Layer | Status |
|-------|--------|
| Zustand store (client) | Working — `componentStates['ai-editor'].content` |
| IndexedDB/localStorage | Working — via Zustand persist middleware |
| Database sync | **INCOMPLETE** — `useContentSync()` updates store only, no explicit API call to persist |
| Multi-device | **NOT WORKING** — local store only |

### Key Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **AI gateway not unified** | HIGH | Uses `/api/ai/chat` (external LLM) instead of container's OpenClaw gateway |
| **No backend DB persistence** | HIGH | Content only in browser storage; lost on clear/new device |
| **No real-time collaboration** | HIGH | Single-client editing only |
| **No asset browser integration** | MEDIUM | Modal opens but asset loading is a stub |
| **Toolbar CSS hack** | LOW | Custom CSS injection (lines 542-563) for scrollable toolbar; fragile |

### Key Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `initEditor()` | 147-355 | Dynamic import, AI proxy config, editor init |
| `handleChange()` | 478-485 | Debounced content sync |
| `handleAssetSelect()` | 487-494 | Asset event emission (stub) |
| Imperative handle | 134-142 | `getHtml()`, `getText()`, `getMarkdown()`, `setContent()` |

---

## 4. Component 2: Reader (PDF)

**File:** `src/components/editors/previews/PDFReaderPreview.tsx` (77 lines — thin wrapper)

### Internal Layout

```
┌───────────────────────────────────────────────────────────────┐
│ TopBar (~44px) — 文档 tab 条 (multi-doc)                       │
│ [Doc 1] [Doc 2] [+ Add]               [Search] [Settings]    │
├───────────────────────────────────────────────────────────────┤
│ InlineToolbar (~50px) — Page nav + zoom + view mode            │
├──────────┬──────────────────────────────┬─────────────────────┤
│ LeftPanel│     PDF Canvas (flex-1)      │ RightPanel          │
│ (250px   │     (PDF.js rendering)       │ (500px resizable)   │
│ resizable│                              │                     │
│ )        │                              │ - AI Chat           │
│          │                              │ - Notes (stub)      │
│ -Thumbs  │                              │ - Summary           │
│ -Outline │                              │                     │
│ -Metadata│                              │                     │
├──────────┴──────────────────────────────┴─────────────────────┤
│ (no status bar)                                                │
└───────────────────────────────────────────────────────────────┘
```

- Most complex internal layout: 3-column with resizable dividers
- TopBar: Multi-document tabs via `useMultiDocumentStore` — **already multi-instance**
- Left: collapsible thumbnails/outline/metadata panel
- Right: collapsible AI/notes/summary panel
- Both side panels support drag-resize

### Current Implementation

A PDF.js-based reader with multi-document support, OCR data integration, and annotation UI. The preview component is a thin 77-line wrapper that delegates to `PDFReaderWrapper` (dynamic import, SSR disabled).

**Document Resolution:**
```
componentStore['pdf-reader'].documentId
  → getPDFSource(documentId) resolves to:
    - null → hardcoded demo paper (arXiv 2512.25072v1)
    - legacy path → legacyDocumentSources mapping
    - else → treat as arXiv ID
```

**Features Present:**
- PDF.js rendering with page navigation
- Multi-document tabs (via `useMultiDocumentStore`)
- OCR data overlay (from `/api/ocr/{id}/pdf`)
- Left/right panels for annotations/notes (UI exists)
- `PaperLibraryDialog` for paper selection

### Container Integration: NONE

PDF reading is fully client-side. OCR happens via `/api/ocr/` (server-side, not container). No container service is involved.

### Persistence

| Layer | Status |
|-------|--------|
| `documentId` in componentStore | Working |
| Multi-document state | Internal store only (not synced) |
| Highlights/annotations | **NOT PERSISTED** — defined in state type but not saved |
| Reading position | **NOT PERSISTED** — `currentPage` in store but no DB sync |

### Key Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **No data type validation for render mode** | HIGH | No logic to decide "show as PDF" vs "show as text" vs "show OCR overlay" based on input data type |
| **Annotations not persisted** | HIGH | Highlights defined in state type (`PdfReaderState.highlights`) but never saved to DB |
| **No container integration** | MEDIUM | Could use container's PDF tools for OCR, extraction |
| **Sentence-level selection disabled** | MEDIUM | `ENABLE_SENTENCE_LAYER = false` in code — feature exists but turned off |
| **Notes panel "Coming Soon"** | LOW | Panel slot exists but shows placeholder |
| **Static demo document** | LOW | Always falls back to arXiv 2512.25072v1 |

### What's Needed: Data Type Validation

A rendering mode decision layer:

```
Input: assetId / URL / file
  → detect type (PDF binary, arXiv ID, S3 URL, text, HTML, OCR JSON)
    → route to appropriate rendering mode:
       PDF binary → PDF.js viewer
       arXiv ID → fetch PDF → PDF.js viewer
       OCR JSON → overlay mode with text layer
       Text/HTML → fall back to AiEditor?
       Unknown → error state with file info
```

---

## 5. Component 3: LaTeX Editor

**File:** `src/components/editors/previews/LatexEditorPreview.tsx` (1,555 lines)

### Internal Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Toolbar (~40px) — [Templates] [Compile] [Mode] [Theme] ...   │
├──────────────────────────────────────────────────────────────┤
│ File Tabs (~36px) — [main.tex] [references.bib] [style.sty]  │
├────────────────────────────┬─────────────────────────────────┤
│ CodeMirror Editor (w-1/2)  │ Preview Panel (w-1/2)           │
│ (LaTeX syntax highlight)   │ (KaTeX HTML or TeXLive PDF)     │
│                            │                                 │
│ flex-1                     │ flex-1                          │
├────────────────────────────┴─────────────────────────────────┤
│ Status Bar (~40px) — TexLive status, line:col, encoding       │
└──────────────────────────────────────────────────────────────┘
```

- Three layout modes: `editor-only` | `split` (default) | `preview-only`
- File tabs: horizontal tab bar for multi-file `.tex`, `.bib`, `.sty` — but within a single project
- Editor/Preview: 50/50 split, not resizable
- `min-h-[700px]` hardcoded
- Template Manager: full-screen modal overlay (not a panel)

### Current Implementation

A CodeMirror 6 editor with dual preview (KaTeX client-side + TeXLive PDF), multi-file tab support, and a rich template system.

**Data Flow:**
```
componentStore['latex-editor'] → { activeFile, content: JSON.stringify(files) }
  → CodeMirror editor
    → onChange → debounced sync (1000ms) via useMultiFieldContentSync
```

**Features Present:**
- CodeMirror 6 with LaTeX syntax highlighting
- Multi-file tabs (create, close, rename `.tex`, `.bib`, `.sty` files)
- Dual preview:
  - KaTeX mode: client-side, instant — regex-based LaTeX → HTML conversion
  - PDF mode: server-side TeXLive compilation at `/api/latex/compile`
- Template system with 10 categories (conference, journal, thesis, CV, etc.)
- Template Manager modal with GitHub import
- Snippet insertion
- File upload (`.tex`, `.bib`, `.sty`)

**Compilation Path:**
```
POST /api/latex/compile { content, filename }
  → write .tex to temp dir (UUID)
    → pdflatex × 2 (for references)
      → read .pdf → base64 → data URL response
```

### Container Integration: PARTIAL

| Aspect | Status |
|--------|--------|
| Agent directives | Listens for `agent:directive:UPDATE_LATEX`, `agent:directive:COMPILE_LATEX` |
| Event emission | Emits `ready`, `contentLoaded`, `actionComplete`, `actionFailed` |
| Container LaTeX service | **NOT USED** — compilation hardcoded to local macOS path |
| Container proxy route | Exists: `/api/container/{agentId}/latex/[...path]` — but not called |

### Template System

**Location:** `src/components/editors/previews/latex-templates/`

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 390 | 10 categories, metadata types, GitHub import config |
| `TemplateManager.tsx` | — | Gallery modal with search, category filters |
| `TemplateService.ts` | — | Download templates, GitHub import, search |
| `GitHubImporter.tsx` | — | GitHub URL → repo files import |

Template catalog covers: IEEE, ACM, NeurIPS, ICML, Springer, Elsevier, APA thesis, Beamer, etc.

### Key Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **Hardcoded macOS TeXLive path** | CRITICAL | `/Library/TeX/texbin/pdflatex` — won't work on Linux/container |
| **Container LaTeX service unused** | HIGH | Container has LaTeX at `:8080` but editor compiles locally |
| **No file tree UI** | HIGH | Multi-file tabs exist but no hierarchical tree view |
| **No BibTeX compilation** | HIGH | `.bib` files supported as tabs but `bibtex` never invoked |
| **No multi-file compilation** | MEDIUM | Only compiles active `.tex` file; ignores `\input{}`, `\include{}` |
| **Template system data source unclear** | MEDIUM | `catalog.json` exists but loading/caching path not clear |
| **ZIP upload not implemented** | LOW | UI button exists but handler is stub |
| **No DB/backend file storage** | HIGH | Files stored as JSON in componentStore; no backend persistence |
| **Copilot service unused** | MEDIUM | `latex-agent/` directory has copilot service code but no UI integration |

### What's Needed: Container TeXLive Integration

```
Current:  Editor → /api/latex/compile → local pdflatex (macOS only)
Needed:   Editor → /api/container/{agentId}/latex/compile → container TeXLive service (:8080)
```

This enables:
- Cross-platform compilation (container runs Linux)
- Multi-file project compilation (container has full working directory)
- BibTeX support (container can run `bibtex` + `pdflatex` pipeline)
- Version-controlled TeX distribution (container image pins version)

---

## 6. Component 4: Data (AG Grid)

**File:** `src/components/editors/previews/AGGridPreview.tsx` (709 lines)

### Internal Layout

```
┌──────────────────────────────────────────────────────┐
│ Toolbar (~40px) — [Add Row][Delete][Refresh][Export]  │
│ + Quick Filter search bar                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│ AG Grid (flex-1)                                     │
│ (rows, sorting, filtering, pagination)               │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Status Bar (~32px) — Row count, selection count       │
└──────────────────────────────────────────────────────┘
```

- Simplest "data" layout: toolbar + grid + status bar
- No internal panels or sidebar
- AG Grid handles its own column resize and drag
- `min-h-[500px]` hardcoded

### Current Implementation

AG Grid Enterprise with research paper sample data, custom renderers, and basic CRUD operations.

**Data Flow:**
```
Demo mode: generateSampleData() → 15 hardcoded papers
Real workspace: empty grid (no data source)
Agent directive: UPDATE_DATA_GRID → custom data + columns
```

**Features Present:**
- Selection (checkbox), filtering, sorting, pagination (10/20/50/100)
- Custom cell renderers: `StatusCellRenderer` (colored badges), `ImpactCellRenderer` (progress bars)
- Toolbar: Add row, delete selected, refresh, CSV export, clear filters, auto-size
- Asset browser integration (Cmd+O shortcut)
- Quick filter search bar

### Container Integration: MINIMAL

| Aspect | Status |
|--------|--------|
| Agent directives | Listens for `demo:loadData`, `agent:directive:UPDATE_DATA_GRID` |
| Event emission | Emits `contentLoaded` with action + rowCount |
| Container data services | **NOT CONNECTED** |
| Store sync | `useMultiFieldContentSync('ag-grid', 2000)` syncs rowCount, selectedRowIds |

### Key Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **No real data source** | HIGH | Only static sample data; no API/DB/container data loading |
| **No container integration** | HIGH | Can't query/visualize data from container's Python/Jupyter environment |
| **Column definitions hardcoded** | MEDIUM | Can't dynamically define schema from dataset |
| **No CSV/JSON import** | MEDIUM | Export works but no import |
| **No cell validation** | LOW | Editable cells accept any value |
| **No undo/redo** | LOW | Cell edits are permanent |

### What's Needed: Container Data Connection

```
Agent generates data → saves to container workspace
  → directive: load_dataset { source: '/workspace/results.csv', columns: [...] }
    → AG Grid fetches via /api/container/{agentId}/jupyter/files/results.csv
      → Parse CSV/JSON → populate grid
```

---

## 7. Component 5: Code Playground

**File:** `src/components/editors/previews/CodePlaygroundPreview.tsx` (30 lines) →
`src/components/editors/previews/code-playground/CodePlayground.tsx` (908 lines)

### Internal Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Toolbar (~40px) — [Run][Stop][Layout] [Template] [Theme]      │
├──────────┬───────────────────────────┬───────────────────────┤
│ FileTree │ Monaco Editor (flex-1)    │ Preview (flex-1)      │
│ (w-56,   │ (code editing)            │ (iframe / output)     │
│ 224px)   │                           │                       │
│          │                           │                       │
│ Recursive│                           │                       │
│ file nav │                           │                       │
├──────────┴───────────────────────────┴───────────────────────┤
│ Terminal (~144-192px, h-36~h-48)                              │
│ (xterm.js-like output)                                        │
└──────────────────────────────────────────────────────────────┘
```

- Four layout modes: `columns` (default) | `rows` | `code-only` | `preview-only`
- FileTree: fixed `w-56` sidebar, recursive directory navigator
- Terminal: collapsible bottom panel
- Frontend mode: Preview shows dev server iframe
- Script mode: Preview replaced by terminal output (simulated)

### Current Implementation

Dual-mode IDE with Monaco editor, file tree, and terminal:

| Mode | Engine | Templates | Status |
|------|--------|-----------|--------|
| Frontend | WebContainer API | React, Vue, Vanilla | **Working** — full npm + dev server |
| Script | ScriptTerminal | Python, Node | **SIMULATED** — regex-based fake execution |

**Data Flow:**
```
Props/Store → mode, template, initialFiles
  → CodePlayground manages file state (FilesMap)
    → Monaco editor (per-file editing)
    → useWebContainer (frontend mode) OR ScriptTerminal (script mode)
```

**Frontend Mode (Working):**
```
Files → WebContainer.mount() → npm install → npm run dev → iframe preview
```

**Script Mode (NOT Working):**
```
Files → ScriptTerminal.executeCommand(code)
  → Regex parse print()/console.log() statements
    → Display simulated output (no actual execution)
```

### Container Integration: PARTIAL (Directives Only)

| Aspect | Status |
|--------|--------|
| Agent directives | `agent:directive:UPDATE_CODE` — streams code with typing effect |
| Agent directives | `agent:directive:TERMINAL_OUTPUT` — appends to terminal |
| Agent directives | `agent:execute-code` — executes command in terminal |
| Container execution | **NOT CONNECTED** — script mode doesn't use container |
| Event emission | Emits `ready`, `contentLoaded`, `actionComplete`, `actionFailed` |

### Submodule Overview

| File | Lines | Purpose |
|------|-------|---------|
| `CodePlayground.tsx` | 908 | Main IDE component |
| `useWebContainer.ts` | 301 | WebContainer lifecycle hook |
| `ScriptTerminal.tsx` | 423 | Terminal emulator (simulated execution) |
| `FileTree.tsx` | 336 | Recursive file navigator |
| `templates.ts` | 538 | React/Vue/Vanilla/Python/Node templates |
| `types.ts` | 129 | Type definitions |

### Key Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **Script mode is fully mocked** | CRITICAL | Python/Node code is NOT executed; only `print()`/`console.log()` parsed via regex |
| **No container code execution** | HIGH | Container has Python runtime but CodePlayground doesn't call it |
| **No file creation/deletion UI** | MEDIUM | Props exist in FileTree but no add/delete buttons |
| **Mode switching requires restart** | MEDIUM | Can't switch frontend ↔ script without losing state |
| **No syntax validation/linting** | LOW | Monaco editor has basic syntax highlight but no error detection |
| **Terminal limited to 200 lines** | LOW | Old output discarded |

### What's Needed: Container Execution

```
Script mode:
  Code → POST /api/container/{agentId}/jupyter/api/kernels → kernel session
    → Execute via Jupyter kernel protocol (WebSocket)
      → Stream stdout/stderr to ScriptTerminal

Or simpler:
  Code → POST /api/container/{agentId}/gateway/execute
    → OpenClaw executes in container → returns output
      → Display in terminal
```

The frontend mode (WebContainer) works well for browser-based development and should remain as-is. Script mode needs to route execution to the container's Python/Node runtime.

---

## 8. Component 6: Jupyter Notebook

**File:** `src/components/editors/previews/JupyterNotebookPreview.tsx` →
`src/components/editors/jupyter/components/JupyterNotebook.tsx` (1,124 lines)

### Internal Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Toolbar (~40px) — [Connect][+Code][+Md][RunAll][Clear][Copilot]│
├──────────────────────────────────────────┬───────────────────┤
│                                          │ Floating Sidebar  │
│ Cell List (flex-1, scrollable)           │ (w-80, absolute)  │
│ ┌──────────────────────────────────────┐ │                   │
│ │ [1] Code Cell (editable + outputs)   │ │ 4 panels:         │
│ ├──────────────────────────────────────┤ │ - Variables       │
│ │ [2] Markdown Cell (rendered)         │ │ - Packages        │
│ ├──────────────────────────────────────┤ │ - Sessions        │
│ │ [3] Agent Cell (AI response)         │ │ - Artifacts       │
│ ├──────────────────────────────────────┤ │                   │
│ │ [4] Code Cell (executing...)         │ │                   │
│ └──────────────────────────────────────┘ │                   │
│ (DraggableCellList / VirtualizedCellList)│                   │
├──────────────────────────────────────────┴───────────────────┤
│ (no status bar — kernel status in toolbar)                    │
└──────────────────────────────────────────────────────────────┘
```

- Cell list: vertical scroll, each cell independently editable
- Floating sidebar: `absolute right-0 top-0 bottom-0 w-80` with 4 toggleable panels
- Sidebar is NOT a fixed split — it overlays the cell list
- No file tabs — single notebook per session currently
- Uses both `DraggableCellList` (drag-reorder) and `VirtualizedCellList` (react-window for large notebooks)

### Current Implementation

Full Jupyter notebook implementation with 4 cell types, kernel management, and artifact collection.

**Cell Types:**
| Type | Purpose | Key Fields |
|------|---------|------------|
| `QueryCell` | User question | content, attachments |
| `AgentCell` | AI response | content, thinking, suggestedCode, status |
| `CodeCell` | Executable code | source, language, executionCount, outputs |
| `MarkdownCell` | Rich text | source, rendered |

**Execution Path:**
```
Cell "Run" → handleExecuteCell(cellId)
  → JupyterService.executeCode(source) via WebSocket
    → Kernel returns stream: stdout, execute_result, display_data, error
      → appendCellOutput(cellId, output)
        → completeExecution(cellId)
```

**Server Connection:**
```
Option A: /api/jupyter/[...path] → JUPYTER_SERVER_URL env var (default localhost:8888)
Option B: /api/container/{agentId}/jupyter/[...path] → container's Jupyter service
```

### Container Integration: DEEP (Dual-Mode)

| Aspect | Status |
|--------|--------|
| Container Jupyter | Working — proxy route `/api/container/{agentId}/jupyter/` |
| Kernel management | Via `@jupyterlab/services` (ServerConnection + KernelManager) |
| WebSocket execution | Full kernel protocol (execute_request → outputs) |
| Agent orchestrator | Referenced but incomplete (AgentOrchestrator, SafetyGuard, ContextBuilder) |
| Artifact collection | Working — images, dataframes, charts captured in `artifactStore` |

### Submodule Overview

| File | Approx Lines | Purpose |
|------|-------------|---------|
| `JupyterNotebook.tsx` | 1,124 | Main notebook component |
| `CodeCell.tsx` | ~400 | Code cell with execution |
| `QueryCell.tsx` | ~250 | User question input |
| `AgentCell.tsx` | ~300 | AI response display |
| `OutputArea.tsx` | ~500 | Cell output rendering (text, image, JSON, error) |
| `ConversationThread.tsx` | ~350 | Chat interface |
| `DraggableCellList.tsx` | ~200 | Drag-and-drop reorder |
| `ArtifactsPanel.tsx` | ~400 | Collected outputs panel |
| `VariableInspector.tsx` | ~250 | Kernel variable viewer |
| `PackageManager.tsx` | ~200 | pip install/uninstall |
| `SessionManager.tsx` | ~200 | Kernel lifecycle |
| `VirtualizedCellList.tsx` | ~300 | React window for large notebooks |

### Key Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **No `.ipynb` save/export** | HIGH | Cells not serialized to standard notebook format; can't import/export |
| **Multi-notebook management missing** | HIGH | Only one notebook per workspace session |
| **Environment management missing** | HIGH | No virtualenv/conda support; uses container's default Python |
| **Notebook content not persisted** | HIGH | Cells in `notebookStore` only; lost on page reload (sync is minimal) |
| **Agent code suggestion not auto-executed** | MEDIUM | `AgentCell.suggestedCode` displayed but requires manual copy |
| **Output rendering limited** | MEDIUM | Basic MIME types only; no Plotly, Matplotlib widget, or rich DataFrame rendering |
| **No checkpoint/snapshot** | MEDIUM | No version history or undo for notebook state |
| **Kernel restart logic unclear** | MEDIUM | Kernel creation works but timeout/crash recovery not visible |

### What's Needed

1. **Multi-notebook management**: Notebook list panel, create/rename/delete notebooks, switch between them
2. **Environment management**: Show installed packages, create virtual environments, kernel selection
3. **`.ipynb` serialization**: Convert `notebookStore.cells[]` ↔ standard Jupyter notebook JSON format
4. **Container HA**: Kernel health monitoring, auto-restart on crash, session recovery

---

## 9. Supporting Components: Gallery, 3D Viewer

### Bento Gallery

**File:** `src/components/editors/previews/BentoGalleryPreview.tsx` (371 lines)

**Internal Layout:**

```
┌──────────────────────────────────────────────────────┐
│ Toolbar (~44px) — [Add Image] [Pack Selector] [Config]│
├──────────────────────────────────────────────────────┤
│ Config Panel (可选展开, ~120px)                        │
│ — Layout / Columns / Gap / Aspect ratio controls      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Masonry Grid (flex-1, scrollable)                    │
│ (images with hover overlays: title, delete, select)  │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Bottom Bar (~32px) — Image count, selected info       │
└──────────────────────────────────────────────────────┘
│ Lightbox Overlay (full-screen modal on image click)   │
```

Masonry-style image gallery with default academic images (Swin Transformer diagrams, attention maps). Features: add/remove images, lightbox viewer, title/description editing. Uses `picsum.photos` for random images.

**Integration status:** Minimal. Store sync for `selectedImageId` only. Has pack selector (can serve as multi-instance selector base). No container integration. No asset management integration.

### Three Viewer

**File:** `src/components/editors/previews/ThreeViewerPreview.tsx` (742 lines)

**Internal Layout:**

```
┌──────────────────────────────────────────────────────┐
│ Toolbar (~40px) — [Model Selector] [Wireframe] [Env]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Three.js Canvas (flex-1)                             │
│ (OrbitControls, Environment, Lighting)               │
│                                                      │
│ ┌─────────────────────┐                              │
│ │ ModelInfo (floating) │ ← absolute, collapsible      │
│ │ vertices, faces, bbox│                              │
│ └─────────────────────┘                              │
├──────────────────────────────────────────────────────┤
│ Bottom Bar (~32px) — Render stats, file info          │
└──────────────────────────────────────────────────────┘
```

React Three Fiber + Drei 3D model viewer. Features: 6 sample glTF models, wireframe/solid toggle, 10 environment presets, grid/shadow toggles, model info panel (vertices, faces, bbox).

**Integration status:** Minimal. Store sync for `modelId` only. Has model selector (can serve as multi-instance selector base). Supports `.gltf`/`.glb`/`.obj` file upload (local blob URL). No container integration.

Both components are functional as standalone viewers but have no data pipeline from container or asset management.

---

## 10. Sync Infrastructure

### Component State Config

**File:** `src/lib/sync/componentStateConfig.ts` (322 lines)

Per-component, per-field sync configuration:

| Field Config | Meaning |
|-------------|---------|
| `sync: 'bidirectional'` | Two-way sync between frontend and server |
| `sync: 'broadcast'` | Server → all clients (read-only) |
| `sync: 'local'` | Client-only, not synced |
| `persistence: true` | Saved to database |
| `mobileAccess: 'read' / 'write' / 'none'` | Mobile permission |

**Summary per component:**

| Component | Bidirectional Fields | Broadcast Fields | Local Fields |
|-----------|---------------------|------------------|-------------|
| pdf-reader | documentId, currentPage, highlights | totalPages | zoom |
| latex-editor | activeFile, content | — | cursorPosition, compiledPdfUrl |
| code-playground | mode, template, selectedFile | — | terminalOutput, previewUrl |
| jupyter-notebook | activeCellIndex, cells, sessionId | cellCount, kernelStatus, executionCount | — |
| ai-editor | content, documentId | — | — |
| ag-grid | selectedRowIds, filterModel, sortModel | — | — |
| bento-gallery | selectedImageId | — | — |
| three-viewer | modelId | — | cameraPosition |

**All components have `mobileRelevant: false`.**

### Sync Matrix (Multi-Device Rules)

**File:** `src/lib/sync/defaultMatrix.ts`

| Data Type | Desktop | Mobile | Agent | Persistence |
|-----------|---------|--------|-------|-------------|
| messages | readwrite | readwrite | read | database |
| tasks | read | read | readwrite | database |
| timeline | readwrite | read | readwrite | database (max 1000) |
| componentStates | readwrite | partial (filter) | read | database |
| activeComponent | readwrite | none | — | memory |
| agentState | read | read | write | memory |
| uiDirective | partial (full_ui) | partial (notifications) | write | none |

### Event Forwarding

**File:** `src/lib/sync/componentEventForwarder.ts` (61 lines)

Global pattern: components call `forwardComponentEvent(type, event, data)` → forwarder sends to Bridge API as system event.

**File:** `src/lib/sync/componentStateBridge.ts`

Subscribes to `useComponentStore` changes → detects field-level diffs → forwards syncable fields → debounced DB persistence (3s).

---

## 11. Container Integration Layer

### Proxy Architecture

**File:** `src/lib/container/client.ts` (237 lines)

```
Frontend → /api/container/{agentId}/{service}/[...path]
  → resolveContainerEndpoint(agentId) → AgentInstance with container metadata
    → buildContainerServiceUrl(endpoint, service, path)
      → http://localhost:{hostPort}/api/v1/{service}/{path}   (Docker)
      → http://{nodeAddress}:{hostPort}/api/v1/{service}/{path} (K8s)
        → proxyToContainer() → fetch with 30s timeout
```

**Available service proxy routes:**

| Service | Proxy Route | Container Port |
|---------|-------------|----------------|
| Gateway | `/api/container/{agentId}/gateway/[...path]` | :18900 |
| Jupyter | `/api/container/{agentId}/jupyter/[...path]` | :8888 |
| LaTeX | `/api/container/{agentId}/latex/[...path]` | :8080 |

**Error codes:** `AGENT_NOT_FOUND` (404), `CONTAINER_NOT_RUNNING` (503), `URL_RESOLUTION_FAILED` (500), `REQUEST_TIMEOUT` (504), `CONNECTION_FAILED` (502).

### UI Directive Pipeline

**Types:** `src/types/message.ts` (lines 183-212) — 21 directive types defined.

**Execution:** `src/app/workspace/stores/syncActions.ts` (lines 49-121)

| Directive | Status | Action |
|-----------|--------|--------|
| `switch_component` | Working | `setActiveComponent(target)` |
| `load_document` | Working | `updateComponentState('pdf-reader', { documentId })` |
| `update_content` | Working | `updateComponentState(target, data)` |
| `highlight_diff` | Working | `setActiveDiff({ component, file, changes })` |
| `open_panel` | Working | Chat expand / task panel resize |
| `close_panel` | Working | Chat collapse / task panel collapse |
| `show_notification` | Partial | Console log only (no toast) |
| `scroll_to` | Stub | Logged but no-op |
| `focus_element` | Stub | Logged but no-op |
| `play_animation` | Stub | Logged but no-op |
| `navigate_to_page` | Not impl | — |
| `navigate_to_cell` | Not impl | — |
| `navigate_to_line` | Not impl | — |
| `load_dataset` | Not impl | — |
| `resize_panel` | Not impl | — |
| `split_view` | Not impl | — |
| Others | Not impl | — |

### Agent Communication Flow

```
User sends message → POST /api/v2/im/bridge/{workspaceId}
  → Bridge relays to OpenClaw gateway (WebSocket)
    → Agent processes → responds with text + uiDirectives[]
      → Bridge returns response to frontend
        → useContainerChat hook processes:
          1. Add message to chat
          2. If uiDirectives present → executeDirectives()
            → Sequential directive execution (with delays)
              → Store updates → Component re-renders
```

### E2E Verified Communication Path (2026-02-24)

Full end-to-end test confirmed the following path works:

```
Bridge POST → getBridgeForWorkspace(workspaceId)
  → prisma.agentInstance.findFirst({ where: { workspaceId }, include: { container: true } })
    → Resolve gatewayUrl: ws://localhost:{hostPort mapped to container 18901}
      → sendGatewayMessage() via WebSocket:
        1. connect.challenge (nonce from gateway)
        2. connect request (token auth, no device credentials needed in local mode)
        3. hello-ok (authenticated, protocol 3)
        4. chat.send (sessionKey, message, idempotencyKey)
        5. Streaming events: agent[lifecycle.start] → agent[assistant.delta]* → chat[delta]* → agent[lifecycle.end] → chat[final]
        6. WebSocket close
      → Returns { content: string, directives: [] }
```

**Performance (4 real scenarios):**

| Scenario | Response Time | Content |
|----------|--------------|---------|
| Agent identity | 8.4s | 568 chars — lists research capabilities |
| Jupyter execution | 14.4s | 74 chars — Fibonacci numbers (0-indexed) |
| LaTeX compilation | 22.8s | 464 chars — compiled abstract to PDF |
| arXiv lookup | 9.9s | 983 chars — identified GPT-4 paper |

**Note on directives:** Bridge returns `directives: []` because auto-directives fire inside the workspace skill plugin as HTTP side-effects (`POST /api/agents/{agentId}/directive`), not through the WebSocket response. Frontend directive reception requires a separate channel.

### Container Gateway Stats (v1.1.0)

The container gateway (`docker/gateway/container-gateway.mjs`) v1.1.0 provides observability:

```
GET /api/v1/stats → {
  uptime, total_requests, total_errors, error_rate,
  services: { [name]: { requests, errors, latency_avg_ms, latency_max_ms, status_codes } },
  tokens: { total_requests, prompt_tokens, completion_tokens, total_tokens, models: { [id]: { ... } } },
  websockets: { upgrades, active }
}
```

**Current limitation:** LLM calls go through OpenClaw's internal gateway (port 18900), bypassing the container gateway's proxy. Token usage tracking requires either hooking into OpenClaw gateway logs or routing LLM calls through the container gateway.

### Workspace Plugin v0.5.0 — 26 Tools

`docker/plugin/prismer-workspace/src/tools.ts` 提供 26 个 tool（原 12 基础 + 14 扩展），其中原 12 工具中 10 个自动发送 directive：

| Tool | Auto-Directives | API 调用 | L1 测试 | L2 测试 |
|------|----------------|---------|--------|--------|
| `latex_compile` | SWITCH_COMPONENT(latex-editor) + COMPILE_COMPLETE | `latex/compile` | ❌ | ❌ |
| `jupyter_execute` | SWITCH_COMPONENT(jupyter-notebook) + CELL_RESULT | `jupyter/api/execute` | ✅ | ❌ |
| `jupyter_notebook` | — (CRUD only) | `jupyter/api/contents/*` | ❌ | ❌ |
| `load_pdf` | SWITCH_COMPONENT(pdf-reader) + PDF_LOAD | — | ❌ | ❌ |
| `switch_component` | SWITCH_COMPONENT(target) | — | ✅ | ✅ |
| `send_ui_directive` | pass-through | `/api/agents/{id}/directive` | ❌ | ❌ |
| `arxiv_to_prompt` | — (API only) | `arxiv/sections,abstract,convert` | ❌ | ❌ |
| `update_notes` | SWITCH_COMPONENT(ai-editor) + UPDATE_NOTES | `/api/agents/{id}/directive` | ✅ | ✅ |
| `update_latex` | SWITCH_COMPONENT(latex-editor) + UPDATE_LATEX | `/api/agents/{id}/directive` | ✅ | ✅ |
| `update_notebook` | SWITCH_COMPONENT(jupyter-notebook) + UPDATE_NOTEBOOK | `/api/agents/{id}/directive` | ✅ | ✅ |
| `save_artifact` | — (API only) | `/api/agents/{id}/artifacts` | ✅ | ❌ |
| `update_gallery` | SWITCH_COMPONENT(bento-gallery) + UPDATE_GALLERY | `/api/agents/{id}/directive` | ✅ | ❌ |

**L1** = `tests/layer1/*.spec.ts` API/基础设施验证 | **L2** = `tests/layer2/*.spec.ts` 前端渲染验证 | **L3** = `tests/layer3/*.spec.ts` 真实 Agent E2E

Content-producing skills auto-trigger SWITCH_COMPONENT + content directive as side-effect，Agent 不需要显式调用 `switch_component`，节省 token 并实现流畅 UI 转场。

**测试体系**: Unit (8 files) + L1 (5 files, 21 tests) + L2 (7 files, 32 tests) + L3 (2 files, 6 tests) = 59+ tests。详见 `WINDOWVIEW_CONVERGENCE.md` §7。

---

## 12. Cross-Cutting Concerns

### Robustness

| Area | Current State | Gap |
|------|--------------|-----|
| Component crashes | Error boundary with retry | No crash reporting to server |
| WebSocket disconnection | Reconnect with exponential backoff | No offline queue |
| Container unavailability | Mock mode fallback | Mock mode doesn't test real functionality |
| API errors | Try-catch in most handlers | No structured error logging to monitoring |
| Data loss prevention | Debounced store sync | Unsaved changes lost if browser crashes within debounce window |

### Observability

| Layer | Current | Gap |
|-------|---------|-----|
| API routes | `createLogger()` with structured fields | Good — keep expanding |
| Container lifecycle | 7-step startup logging | Good |
| Component events | `forwardComponentEvent()` to Bridge | Events logged but no aggregation/dashboard |
| User interactions | None | No analytics or interaction tracking |
| Performance metrics | None | No component load time, render time, or API latency tracking |

### Multi-Device Sync

| Capability | Status |
|------------|--------|
| Sync rules defined | Yes — `defaultMatrix.ts` with per-endpoint access |
| Mobile filtering | Yes — `filterMobileAccessibleState()` |
| Real-time sync transport | **NOT IMPLEMENTED** — rules exist but no WebSocket broadcast between clients |
| Conflict resolution | Defined (server_wins, latest_wins, merge) but **NOT IMPLEMENTED** |
| Offline sync | **NOT IMPLEMENTED** |

### Agent UI Control

| Capability | Status |
|------------|--------|
| Switch components | Working |
| Load documents | Working |
| Update content | Working |
| Show diffs | Working |
| Panel control | Working |
| Fine-grained navigation | Not implemented (scroll_to, navigate_to_page/cell/line) |
| Data loading | Not implemented (load_dataset) |
| User interaction | Not implemented (request_user_input, show_confirmation) |

---

## 13. Gap Summary Matrix

### 13.1 组件集成状态

| Component | Container Integration | Backend Persistence | AI Gateway Unified | Agent Directives | Multi-Instance | Robustness |
|-----------|----------------------|--------------------|--------------------|------------------|---------------|------------|
| Notes | None | Partial (store only) | No (uses /api/ai/chat) | UPDATE_NOTES | None | Medium |
| Reader | None | Partial (documentId only) | N/A | load_document | **Has** (multi-doc store) | Low |
| LaTeX | Partial (directives only) | Partial (store only) | N/A | UPDATE_LATEX, COMPILE_COMPLETE | None (multi-file ≠ multi-instance) | Low |
| Data | None | None | N/A | UPDATE_DATA_GRID | None | Low |
| Code | Partial (directives only) | None | N/A | UPDATE_CODE, TERMINAL_OUTPUT | None | Medium |
| Jupyter | Deep (kernel protocol) | Partial (cells store) | N/A | CELL_RESULT, UPDATE_NOTEBOOK | None | Medium |
| Gallery | Partial (directives) | Minimal | N/A | UPDATE_GALLERY | Partial (pack selector) | Low |
| 3D | None | Minimal | N/A | None | Partial (model selector) | Low |

**Legend:** None = no integration | Partial = some fields | Deep = full protocol | Minimal = 1-2 fields | **Has** = working multi-instance

### 13.2 四层测试覆盖（per-component view）

> 参见 `WINDOWVIEW_CONVERGENCE.md` §7 了解 Unit/L1/L2/L3 定义

| Component | Unit | L1 API 集成 | L2 前端渲染 | L3 E2E | 全链路 |
|-----------|------|------------|------------|--------|-------|
| **Notes** (ai-editor) | ✅ store | ✅ bridge | ✅ t3-notes | ✅ mvp T3 | ✅ |
| **Reader** (pdf-reader) | ❌ | ❌ | ✅ t4-pdf-reader | ❌ | ⚠️ |
| **LaTeX** (latex-editor) | ❌ | ✅ directive | ✅ t1-latex | ✅ mvp T1 | ✅ |
| **Data** (ag-grid) | ❌ | ✅ data-tools | ✅ component-crud | ✅ data-workflow | ✅ |
| **Code** (code-playground) | ❌ | ❌ | ✅ component-crud | ❌ | ⚠️ |
| **Jupyter** (jupyter-notebook) | ❌ | ✅ directive | ✅ t2-jupyter | ✅ mvp T2 | ✅ |
| **Gallery** (bento-gallery) | ❌ | ❌ | ✅ t2-jupyter | ❌ | ⚠️ |
| **3D** (three-viewer) | ❌ | ❌ | ❌ | ❌ | ❌ |

**全链路 = L1 + L2 + L3 全部通过**

**覆盖总结**:
- 全链路验证: **4/8** 组件 (Notes, LaTeX, Data, Jupyter)
- 至少 L2 覆盖: **7/8** 组件 (+ Reader, Code, Gallery)
- 零覆盖: **1/8** 组件 (3D — 已禁用)

---

## 14. Next Phase Priorities

> Aligned with WINDOWVIEW_DESIGN.md v3.0 design decisions.

### P0: 产物工作台核心 (Design D2, D3)

1. **Artifact instance selector (二级导航)** — 每个工作台添加紧凑下拉选择器，支持产物多实例。Reader 复用已有 multi-doc，其他 7 个组件新增。参考 DESIGN §3.2 各组件整合策略表。
2. **Workspace ↔ Collection 自动绑定** — Prisma schema 新增 `WorkspaceSession → Collection` FK。创建 Workspace 时自动创建同名 Collection。DESIGN §5.2。
3. **Asset → WindowView 路由** — `openArtifactInWorkspace(assetId, assetType)` 统一入口，根据类型路由到对应工作台 + 创建实例。DESIGN §5.3。
4. **Backend persistence layer** — `PUT /api/workspace/{id}/component/{type}/state` API for all components.

### P0: 容器集成 (Infrastructure)

5. **Container LaTeX compilation** — Switch from hardcoded macOS `pdflatex` to container's LaTeX service (`:8080`).
6. **Script execution via container** — Route Code Playground's script mode to container's Jupyter kernel or OpenClaw execute endpoint.
7. **Unify AI gateway** — Route Notes' AI features through `/api/ai/chat` with model-aware parameter normalization (reasoning model compatibility).

### P1: 时间线 & Agent 控制 (Design D4, D6)

8. **Tag-based timeline** — 时间线重写为带 tag 的事件流 + 自适应密度 + tag 过滤。不预设阶段，Agent 通过 tag 组织事件。DESIGN §4.3。
9. **Agent Intent Panel** — Chat 或 WindowView 顶部展示 Agent 当前意图、暂停/跳过/接管按钮。DESIGN §6.3。
10. **Artifact lifecycle** — 产物状态机 `draft → review → approved → archived`，Agent 产出自动注册。DESIGN §3.4。

### P1: Component Gaps

11. **PDF data type validation** — Rendering mode decision based on input data type (PDF, arXiv, OCR, text).
12. **LaTeX file tree + multi-file compilation** — Hierarchical file view, `\input{}`/`\include{}` resolution, BibTeX pipeline.
13. **Jupyter multi-notebook + `.ipynb` export** — Notebook list, standard format serialization.
14. **AG Grid data pipeline** — Load data from container workspace files (CSV, JSON).

### P1: 测试覆盖补齐 (四层测试体系)

> 详见 `WINDOWVIEW_CONVERGENCE.md` §7 四层测试体系

15. **Plugin 单测 (Unit)** — 为 `tools.ts` 26 个 tool 添加 vitest 测试，覆盖参数验证、directive 构建、错误路径。当前 0/26 覆盖。
16. **v0.5.0 新增 tools L1 覆盖** — `tests/layer1/` 补充 latex_project, context_*, navigate_pdf, sync_files 等 12 个新 tool 的 API 集成测试。
17. **L3 扩展** — `tests/layer3/` 补充 code_execute、latex_project_compile E2E 场景。当前仅 6 个测试。
18. **3D Viewer 基础覆盖** — three-viewer 当前已禁用，启用后需补充 L2 渲染测试。

### P2: Polish & Robustness

20. **Directive completion** — Implement remaining 11 stub/unimplemented directives.
21. **Real-time multi-device sync** — WebSocket broadcast between clients using existing sync rules.
22. **Component crash reporting** — Forward error boundary catches to server logging.
23. **Performance observability** — Component load times, API latency, render metrics.
24. **Visual unification** — Consistent toolbar, spacing, and theme across all 8 components.

### P3: Advanced (Design Reservations)

25. **Sidecar Agent observation** — Intent-level, triggered by user comments/rejects. DESIGN §6.4. (设计预留)
26. **Project layer** — Multi-workspace grouping. DESIGN §7.1. (设计预留)
27. **Sub-Agent** — DESIGN §7.2. (设计预留，不实现)
23. **Team** — DESIGN §7.3. (设想预留，不实现)
24. **Jupyter environment management** — virtualenv/conda, kernel selection, package management.
25. **Offline mode** — Queue operations when container unavailable, replay on reconnect.
