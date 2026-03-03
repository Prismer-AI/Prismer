# WindowView Product Design Document

> **Version:** 3.1 | **Date:** 2026-02-24
> **Branch:** `feat/windowview-integration`
> **Companion docs:**
> - `docs/WINDOWVIEW_STATUS.md` — Technical implementation analysis (code status, layout structure, container integration for each component)
> - `docs/WINDOWVIEW_CONVERGENCE.md` — Visual unification & code improvement tracking
> **Scope:** Desktop/Web WindowView + Workspace product logic

---

## Table of Contents

1. [The Essence of Workspace](#1-the-essence-of-workspace)
2. [The Role of WindowView](#2-the-role-of-windowview)
3. [Artifact Multi-Instance](#3-artifact-multi-instance)
4. [Timeline](#4-timeline)
5. [Workspace ↔ Asset Bridge](#5-workspace--asset-bridge)
6. [Agent Control Granularity](#6-agent-control-granularity)
7. [Multi-Workspace / Multi-Agent / Team](#7-multi-workspace--multi-agent--team)
8. [Mobile Positioning](#8-mobile-positioning)
9. [Design Decision Summary](#9-design-decision-summary)

---

## 1. The Essence of Workspace

### 1.1 Definition

Workspace = **OpenClaw Academic Container + Agent + Memory Layer + Accumulated Context**.

```
┌─────────────────────────────────────────────────────────┐
│  Workspace                                               │
│                                                         │
│  ┌───────────────────────┐  ┌────────────────────────┐  │
│  │ OpenClaw Container     │  │ Agent                  │  │
│  │ - Runtime environment  │  │ - LLM reasoning        │  │
│  │   (Python, LaTeX,      │  │ - Skill execution      │  │
│  │   Jupyter, etc)        │  │ - Workflow progression  │  │
│  │ - File system          │  │ - Initialized from      │  │
│  │   /workspace           │  │   template              │  │
│  │ - Services (Gateway,   │  │   (identity/abilities/  │  │
│  │   Jupyter kernel, etc) │  │   toolset)              │  │
│  └───────────────────────┘  └────────────────────────┘  │
│                                                         │
│  ┌───────────────────────┐  ┌────────────────────────┐  │
│  │ Memory Layer           │  │ Accumulated Context     │  │
│  │ - IDENTITY.md          │  │ - Artifacts             │  │
│  │ - MEMORY.md            │  │ - Conversation history  │  │
│  │ - Skills/              │  │ - Decision records      │  │
│  │ - Cross-container      │  │ - Timeline events       │  │
│  │   persistence          │  │ - Component state       │  │
│  │   (survives container  │  │                         │  │
│  │   restarts)            │  │                         │  │
│  └───────────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Four layers, each with its own responsibility**:

| Layer | What it is | Persistence method |
|---|--------|----------|
| **Container** | Runtime environment — provides compute power, toolchain, sandbox | Container image + mounted volumes. Containers can be destroyed and rebuilt; state does not depend on container lifecycle |
| **Agent** | Intelligence layer — LLM reasoning + Skill execution + intent understanding | Initialized from templates (IDENTITY/SOUL/TOOLS) + runtime Skill accumulation |
| **Memory** | Continuously evolving preferences and capabilities — survives across containers and sessions | DB + written to container on deployment. Memory files redeployed on container restart |
| **Context** | All output and interactions accumulated during this research session | DB (messages, timeline, componentState) + container file system (artifacts) |

### 1.2 The frontend is a display tool, with no fixed form

The frontend (Chat Panel + WindowView + Timeline) has one sole responsibility: **to unfold the capabilities and content of the four backend layers for humans to see and use**.

- Chat Panel unfolds the Agent's conversational capability
- WindowView unfolds the artifacts in Context (rendered with corresponding editors/viewers)
- Timeline unfolds the event stream in Context

The frontend does not define research paths or prescribe "what should be done first or next." Research paths are determined by **the Agent (based on templates + user instructions) + the user themselves**.

### 1.3 Generality

Research-type tasks cover an extremely wide range:

- Academic papers (CS/EE, biomedical, social sciences...)
- Investment research (industry analysis, due diligence, secondary market research)
- Student assignments and theses
- Technical reports and white papers
- Data analysis and visualization projects

Each type has a completely different path and artifact combination. Our 8 components (Notes, Reader, LaTeX, Code, Data, Jupyter, Gallery, 3D) are **the current ready-made toolset**, with more to be added in the future. When LLM I/O becomes fast enough, even the interface itself could be dynamically generated.

Therefore: **the design must not assume any specific research workflow or artifact sequence**.

---

## 2. The Role of WindowView

### 2.1 What it is

WindowView is **the visual operation surface for artifacts and capabilities inside the container**.

```
Container files/services  ──→  WindowView components  ──→  Humans can view, edit, review
  .tex files                   LaTeX Editor
  .ipynb files                 Jupyter Notebook
  .py files                   Code Playground
  .csv data                   AG Grid
  .pdf files                  PDF Reader
  ...                         ...
```

It is not "8 tool tabs." It is a **projection** of the container's content. Whatever the Agent produces in the container, WindowView displays. Whatever the user wants to operate on, WindowView provides the corresponding editor.

### 2.2 Current 8 Components

| ID | What it displays | What it operates on |
|----|---------|---------|
| `ai-editor` (Notes) | Rich text notes | Writing, AI-assisted authoring |
| `pdf-reader` (Reader) | PDF documents | Reading, annotation, AI Q&A |
| `latex-editor` (LaTeX) | LaTeX projects | Editing, compiling, previewing |
| `code-playground` (Code) | Code projects | Editing, running, debugging |
| `ag-grid` (Data) | Tabular data | Browsing, filtering, exporting |
| `jupyter-notebook` (Jupyter) | Computational notebooks | Writing code, executing, visualizing |
| `bento-gallery` (Gallery) | Image collections | Browsing, annotating, organizing |
| `three-viewer` (3D) | 3D models | Viewing, rotating, measuring |

**8 is not the upper limit**. As needs grow, new components can be added (e.g., flowchart editor, slides, mind map). The component registration mechanism (`componentLoaders`) already supports dynamic extension.

### 2.3 What WindowView does NOT do

- **Does not define research workflows** — there is no logic like "you should start from Reader then go to LaTeX"
- **Does not manage workflow state** — which stage, how far along — that is the Agent + Memory layer's job
- **Does not distinguish between "Agent output" and "user-created content"** — both are artifacts, treated equally
- **Does not restrict component usage order** — users can switch to any component at any time

---

## 3. Artifact Multi-Instance

### 3.1 Problem

Currently each component has only one instance. If the Agent produces two Jupyter notebooks, or the user wants to open three papers simultaneously, it cannot be done.

### 3.2 Design: Workbench + Artifact Instance Selector

**First-level navigation stays unchanged**: 8 tabs represent workbench types.

**Each workbench internally adds an artifact instance selector** (compact dropdown), allowing the same workbench to host multiple artifacts of the same type.

**Visual design constraint**: Many components already have internal multi-level navigation (LaTeX has file tabs, Reader has document tabs, Code has a file tree). The selector must maintain **visual layering** with existing navigation, without adding clutter.

**Integration strategy per component**:

| Component | Existing internal navigation | Instance selector form | Integration strategy |
|------|------------|-------------|---------|
| **Reader** | Top document tab bar | Reuse existing document tab bar | Upgrade `useMultiDocumentStore` to artifact instance management |
| **LaTeX** | File tabs (main.tex, bib, sty) | Project selector (dropdown) above file tabs | Level 1 = project, Level 2 = file |
| **Code** | Left FileTree | Project selector (dropdown) on left side of toolbar | Level 1 = project, Level 2 = file tree |
| **Jupyter** | None | Notebook selector (dropdown) on left side of toolbar | New addition |
| **Notes** | None | Note selector (dropdown) on left side of toolbar | New addition |
| **Data** | None | Dataset selector (dropdown) on left side of toolbar | New addition |
| **Gallery** | Pack selector | Reuse existing pack selector | Upgrade to artifact instance |
| **3D** | Model selector | Reuse existing model selector | Upgrade to artifact instance |

**Dropdown selector specification**:

```
┌──────────────────────────────┐
│ ▼ main-experiment.ipynb [NEW]│  ← Current instance name + status label
├──────────────────────────────┤
│ ○ main-experiment.ipynb      │
│ ○ baseline-analysis.ipynb    │
│ ● ablation-study.ipynb [NEW] │  ← NEW = Newly produced by Agent
│ ──────────────────────────── │
│ + New                        │
│ ↓ Import from Assets         │
└──────────────────────────────┘
```

- Position: Leftmost in toolbar
- Width: `max-w-[240px]`, truncate
- Height: `h-7`, aligned with toolbar buttons
- Component: shadcn `<DropdownMenu>`

### 3.3 Artifact Model

Artifacts are first-class citizens in Workspace Context:

| Property | Description |
|------|------|
| `id` | Globally unique identifier |
| `type` | Artifact type → determines which workbench renders it |
| `name` | Human-readable name |
| `version` | Linear version number (v1 → v2 → v3) |
| `status` | `draft` / `review` / `approved` / `archived` |
| `content` | Content body (container file system / S3 / DB) |

> **Version management**: Linear version numbers, no Git-style branching. Reasons: (1) No need to burden users with branch merging; (2) Code Playground may already have a git repo internally, and nested git causes confusion; (3) Simple sequential numbers are sufficient.

### 3.4 Artifact Lifecycle

```
Creation (Agent output / User created / Imported from Asset)
  → Register in Workspace Context
    → New item appears in the corresponding workbench selector
      → User operates (edit / review)
        → approve → Archive to Asset Collection
        → reject → Agent regenerates based on feedback
        → edit → Version increments
```

### 3.5 Layout Space

**WindowView vertical space**:

```
┌─────────────────────────────────────────────────┐
│ ComponentTabs (first-level tabs)      ~44px fixed │
├─────────────────────────────────────────────────┤
│ Component content area                 flex-1    │
│ ┌─────────────────────────────────────────────┐ │
│ │ Component toolbar (with instance selector)  │ │
│ │                                 ~40px fixed  │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Component body                   flex-1     │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Component status bar (optional)  ~32px      │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Timeline                           ~44-280px    │
└─────────────────────────────────────────────────┘
```

For internal layout details of each component, see `WINDOWVIEW_STATUS.md` §3-9, Internal Layout subsections.

---

## 4. Timeline

### 4.1 What the Timeline is

The Timeline is **a visualization of the event stream in Workspace Context**. It records "what happened in this Workspace" — nothing more, nothing less.

```
[Event 1: Agent starts task] → [Event 2: Artifact created] → [Event 3: User edits] → [Event 4: Agent completes] → ...
```

### 4.2 Current Problem

The Timeline uses physical time as the primary axis, with events distributed at equal intervals. The longer a task lasts, the more early events get compressed to the left.

### 4.3 Design: Tagged Event Stream

The Timeline is essentially **a tagged, filterable, collapsible event stream**. It does not preset any "stages" or "workflows."

**Event model**:

| Field | Description |
|------|------|
| `timestamp` | When it occurred |
| `actor` | Who triggered it (agent / user) |
| `action` | What happened |
| `tags` | Free-form tag array (both Agent and user can add tags) |
| `artifactId` | Associated artifact (optional, clickable to navigate) |
| `significance` | `routine` / `milestone` / `decision` |
| `annotation` | User annotation (optional) |

**Visual design**:

```
┌─────────────────────────────────────────────────────────────┐
│ Tag Filter:  [All] [#literature] [#experiment] [#writing]    │
│              [milestones only ☐]                              │
├─────────────────────────────────────────────────────────────┤
│ Event Track:                                                 │
│ ──●──●──◆────●──●──●───★──●──●──●──→                       │
│   │     │              │                                     │
│   │     ◆ decision     ★ milestone                          │
│   ● routine                                                  │
├─────────────────────────────────────────────────────────────┤
│ Controls: [◀] [▶] [zoom +/-]                  14:32 / 03:15 │
└─────────────────────────────────────────────────────────────┘
```

**Interactions**:

| Action | Behavior |
|------|------|
| Click tag filter | Show only events with that tag |
| Click event dot | View event details + navigate to associated artifact |
| Click milestone | Restore workspace snapshot |
| Scroll wheel | Zoom time density |

**Tag sources**:
- **Agent auto-tags** — Agent marks events during work (e.g., `#data-analysis`, `#draft-v1`)
- **User manual tags** — Users add tags to events for personal organization
- **System auto-tags** — `#artifact-created`, `#artifact-approved`, and other system events

**Solving event compression**:

Not solved by preset stages, but by **adaptive density + tag filtering**:
- By default, show milestone and decision events (sparse); routine events are auto-merged by density
- Users zoom in for details, zoom out for the big picture
- Use tag filter to focus on a subset of interest

### 4.4 Why not Phase-based

Phases (preset stages) assume all research follows the same pipeline. In reality:

- Investment research has no "experiment design" stage
- Students writing course papers may only have two steps: "search literature → write paper"
- Data engineers may use only Jupyter + Data for the entire workspace
- Some research iterates repeatedly, with no linear stages at all

The Tag system is more flexible than the Phase system: Agents can tag events with any label to organize them, users can add their own tags, and there are no preset fixed pipelines. If a particular Agent template does have a stage concept, it can implement it via tags (`#phase:literature-review`), but that is Agent behavior, not a UI structure enforced by the frontend.

---

## 5. Workspace ↔ Asset Bridge

### 5.1 Problem

Artifacts in Workspace Context and the Asset system are disconnected. Things produced in the Workspace do not automatically appear in Assets.

### 5.2 Design: Workspace Auto-binds a Collection

Each Workspace automatically binds to an Asset Collection upon creation.

```
WorkspaceSession 1:1 Collection
  │
  ├── Artifacts imported from Assets → Reference original Asset
  ├── New artifacts produced by Agent → Create new Asset, add to Collection
  └── Artifacts manually created by user → Create new Asset, add to Collection
```

**User perception**:
- The artifact selector list in WindowView = this Collection filtered by type
- The Assets page shows each Workspace's Collection
- A single Asset can belong to multiple Collections

### 5.3 Asset → WindowView Routing

Any Asset can be opened in WindowView; the system automatically routes to the corresponding workbench based on type:

```
openArtifactInWorkspace(assetId, assetType)
  → Determine target workbench (ComponentType)
  → Switch to that workbench tab
  → Create new instance in artifact selector
  → Load content
```

Type mapping follows simple rules: PDF → Reader, .tex → LaTeX, .ipynb → Jupyter, .csv/.json → Data, etc.

---

## 6. Agent Control Granularity

### 6.1 Problem

Agent control is imperative — Agent says "switch to LaTeX," the frontend switches. It lacks intent expression, process transparency, and human intervention.

### 6.2 Control Layers

| Level | Name | Description | This phase |
|------|------|------|------|
| L0 | Environment level | Internal container operations, invisible to frontend | Yes |
| L1 | Notification level | Inform user what happened | Yes |
| L2 | Presentation level | Present artifact, await review | Yes |
| L3 | Interactive level | Requires user decision | Yes |
| L4 | Collaborative level | Agent and human edit simultaneously | **Design reserved** |

### 6.3 Agent Intent Panel

Display what the Agent is currently doing at the top of Chat or WindowView:

```
┌──────────────────────────────────────────────┐
│ Agent is: Performing data analysis             │
│ ├─ Target: experiment_results.csv              │
│ ├─ Tool: Jupyter                               │
│ └─ [Pause] [Skip] [Take Over]                 │
└──────────────────────────────────────────────┘
```

| Action | Effect |
|------|------|
| Pause | Agent pauses current task |
| Skip | Agent skips current step |
| Take Over | Agent exits, user operates manually |

### 6.4 Skill Auto-Directive (Verified 2026-02-24)

> E2E tests confirmed: UI switching for content operations should be automatically triggered by Skills, not explicitly called by Agent via `switch_component`.

**Principle**: When a Skill performs a content operation, it automatically triggers the relevant UI directive as a side-effect. The Agent does not need to (and should not) waste tokens on explicitly orchestrating UI switches.

**Implemented**:

| Skill | Auto-triggered Directive | Description |
|-------|---------------------|------|
| `latex_compile` | `SWITCH_COMPONENT(latex-editor)` + `LATEX_COMPILE_COMPLETE` | Switch view before compile, notify PDF preview after compile |
| `jupyter_execute` | `SWITCH_COMPONENT(jupyter-notebook)` + `JUPYTER_CELL_RESULT` | Switch view before execution, append output after execution |
| `load_pdf` | `SWITCH_COMPONENT(pdf-reader)` + `PDF_LOAD_DOCUMENT` | Switch view before loading |

**Design rationale**:
- Every content tool should implicitly carry the intent of "show the change." Writing LaTeX means wanting to see the LaTeX editor; executing code means wanting to see the Notebook.
- The Agent only needs to focus on "what to do" (which skill to invoke), not "how to display" (UI switching).
- This association is **part of the Skill definition**, not something the Agent needs to decide every time.
- New Skills should follow this pattern: content operation → automatic UI switch.

### 6.5 Sidecar Agent: Observation → Skill Crystallization

> Sidecar observes at the **intent level**. The most precise timing is **after user comment / reject / edit** — user feedback on unmet expectations is the clearest intent signal.

```
Agent produces artifact
  → User comment: "Citation format should use Author-Year"
    → Sidecar captures: [condition] citation format [behavior] use Author-Year
      → Crystallize as Skill → Automatically use correct format next time
```

Why intent level instead of character level: character-level observation is too noisy (typo ≠ preference), operation-level lacks semantics, intent-level (comment/reject) is the clearest signal actively expressed by users, with minimal performance overhead and privacy intrusion.

**Design reserved, not implemented.**

---

## 7. Multi-Workspace / Multi-Agent / Team

### 7.1 Multi-Workspace

Each Workspace is an independent Container + Agent + Memory + Context. The sidebar lists all Workspaces for switching.

Introduce **Project** as an optional higher-level organization for Workspaces (multiple Workspaces around the same research topic). Projects share a single Asset Collection.

> **Design reserved**. The current sidebar already supports Workspace listing and switching. The Project layer will be added later based on actual needs.

### 7.2 Multi-Agent

One Workspace binds to one Agent (1:1).

> Sub-Agent **design reserved only, not implemented**. Reserved via: `AgentInstance.parentAgentId` optional field.

### 7.3 Team

> **Conceptualized and reserved only, not implemented.** Existing infrastructure (`WorkspaceParticipant`, IM system) is in place, but UX is complex; will be expanded once the product matures.

### 7.4 Public Workspace — Publishing and Sharing

> **Design Decision D14**: Workspaces support three visibility levels (Private / Unlisted / Public). Public Workspaces appear in Discovery Trending, supporting Fork / Star / Comment / collaboration requests.

**Core concept**: A Public Workspace is not sharing a static snapshot — it is making a **living research environment** public. Visitors see real-time Chat history, WindowViewer content, and Timeline progress.

**WindowViewer behavior in public mode**:

| Component | Public mode behavior |
|------|------------|
| PDF Reader | Browsable, annotations visible, cannot add new annotations |
| Jupyter Notebook | Code and output visible, cannot execute Cells |
| LaTeX Editor | Source and preview visible, cannot edit |
| Code Playground | Code visible, cannot run |
| AG Grid | Data visible, cannot modify |
| Timeline | Fully read-only, can replay research process |

**Fork behavior**: Fork copies the workspace's **complete context** to the user's own Private Workspace:
- Paper collections (Paper references, not copying PDF originals — re-fetched via arXiv/DOI)
- Analysis code (Jupyter notebooks)
- Writing drafts (LaTeX source)
- Agent configuration (skill selection, model preferences)
- Not copied: Chat history, Agent instance state

**Relationship with Section 5 (Asset Bridge)**: Fork is essentially "batch importing another Workspace's Assets," reusing the Asset system's import pipeline.

---

## 8. Mobile Positioning

Mobile **does not support WindowView**.

Mobile is a **monitoring dashboard + lightweight review + emergency intervention entry point**:

| Can do | Does not do |
|-------|--------|
| Task monitoring (what Agent is doing, progress) | Any WindowView component |
| Artifact review (approve/reject/comment cards) | Extended editing |
| IM conversation (send instructions to Agent) | File management |
| Notifications (Agent completes key milestones) | |
| Quick decisions (Agent requests a choice) | |

---

## 9. Design Decision Summary

### 9.1 Confirmed Decisions

| # | Decision | Rationale |
|---|------|------|
| D1 | Keep 8 first-level tabs, components are extensible | General-purpose coverage, registration mechanism already supports dynamic extension |
| D2 | Compact dropdown selector for multi-instance | Does not conflict with component internal navigation |
| D3 | Workspace auto-binds Collection | Bridges Asset management |
| D4 | Timeline uses tagged event stream, no preset stages | Does not assume a specific research workflow; tags are more flexible than phases |
| D5 | Artifact versions use linear sequence numbers | No git burden on users, avoids nested git conflicts |
| D6 | Agent control implements L0-L3, L4 reserved | Incremental implementation |
| D7 | Sub-Agent design reserved | Container orchestration is complex |
| D8 | Team conceptualized and reserved | UX is complex, wait for product maturity |
| D9 | Mobile does not support WindowView | Monitoring + review, using card flow |
| D10 | Sidecar intent-level observation, design reserved | Triggered after comment/reject |
| D11 | Split view not implemented | Not urgent, not important |
| D12 | Frontend does not define research workflows | Workflows determined by Agent + user; frontend is just a display tool |
| D13 | Skill content operations auto-trigger UI directives | Agent does not waste tokens on UI orchestration; Skills have built-in side-effects (E2E verified 2026-02-24) |

### 9.2 Implementation Priority

| Priority | Change | Dependencies |
|--------|------|------|
| **P0** | Artifact instance selector (second-level navigation) | componentStore refactored to multi-instance |
| **P0** | Workspace ↔ Collection auto-binding | Prisma schema new FK |
| **P0** | Asset → WindowView routing | Selector + type mapping |
| **P1** | Timeline rewrite (tag event stream + adaptive density) | Event model extension + UI |
| **P1** | Agent Intent Panel | Directive protocol extension |
| **P1** | Artifact lifecycle (draft/review/approved) | Artifact data model |
| **P2** | Project layer | Routing + sidebar |
| **P3** | Mobile artifact card flow | Mobile API + UI |
