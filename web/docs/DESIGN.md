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

# DESIGN — Interface Design Specification

> Last updated: 2026-02-15
> Covers: Desktop (web), Mobile (Tauri iOS), component hierarchy

---

## 1. Desktop Layout

### Overall Structure

```
┌──────────────────────────────────────────────────────────────────┐
│ MainLayout                                                       │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│ AppSide  │  Content Area                                         │
│ bar      │  (varies by route)                                    │
│          │                                                       │
│ [Logo]   │  Discovery: PaperGrid + HeroCarousel                  │
│          │  Assets: CollectionGrid + AssetSection                 │
│ [Tabs]   │  Workspace: WorkspaceView (see section 3)             │
│ Discovery│                                                       │
│ Assets   │                                                       │
│ Workspace│                                                       │
│          │                                                       │
│ [User]   │                                                       │
├──────────┴───────────────────────────────────────────────────────┤
│ ReaderOverlay (PDF reader modal, overlays any page)              │
│ UploadModal (file upload dialog)                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Sidebar (AppSidebar)

- **Collapsible**: expands (240px) / collapses (60px icon-only)
- **3 tabs**: Discovery (Compass icon), Assets (FolderOpen icon), Workspace (Cpu icon)
- **Tab content**: expands below active tab when sidebar is open
  - Discovery: DiscoverySection (search history, chat sessions)
  - Assets: AssetSection (collections, upload button)
  - Workspace: WorkspaceTabButton with dropdown (see section 4)
- **Bottom**: UserMenu (compact when collapsed)

### Content Area Behavior

| Route | Overflow | Reason |
|-------|----------|--------|
| `/discovery` | `overflow-y-auto` | Scrollable paper feed |
| `/assets` | `overflow-y-auto` | Scrollable asset grid |
| `/workspace` | `overflow-hidden` | WorkspaceView manages own layout |

---

## 2. Mobile Layout (Tauri iOS)

### Structure

```
┌────────────────────────────┐
│ Header: [Menu] Title [...]│  ← MobileChat header
├────────────────────────────┤
│                            │
│  MessageList               │
│  (flex-1, scrollable)      │
│                            │
│                            │
├────────────────────────────┤
│ ActionBar (if interactive)  │
├────────────────────────────┤
│ ChatInput                  │
│ [safe-area-inset-bottom]   │
└────────────────────────────┘
```

### Viewport Handling

```css
.mobile-viewport {
  height: 100vh;     /* fallback for older browsers */
  height: 100dvh;    /* dynamic viewport height (respects keyboard) */
}
```

- `html, body { height: 100%; margin: 0; }` — establish height chain for WKWebView
- Bottom padding: `max(4px, env(safe-area-inset-bottom, 4px))` — respect iOS home indicator
- No overscroll: `.no-overscroll { overscroll-behavior: none; }` — prevent iOS rubber-banding

### Navigation Drawer (MobileDrawer)

- Left-side slide-out drawer (framer-motion)
- Menu items: Discovery, Assets, Workspace (active)
- Discovery/Assets show "Coming Soon" toast
- Backdrop click to close

---

## 3. Workspace Page — Bot Instance Container

### Product Concept

```
One WorkspaceView = One Bot Instance = One OpenClaw Connection
```

Each workspace represents an independent research session with its own:
- Chat history (messages)
- Task list (with subtasks)
- Editor states (which document is loaded in which editor)
- Timeline (audit log of all actions)
- Agent connection (WebSocket to agent-server / OpenClaw)

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ConnectionIndicator: [●] Connected to "My Research" · bot-a3│
├──────────┬──────┬────────────────────────────────────────────┤
│          │resize│                                            │
│ Workspace│handle│  WindowViewer                              │
│ Chat     │ (1px)│                                            │
│          │      │  ┌────────────────────────────────────┐    │
│ ┌──────┐ │      │  │ ComponentTabs                      │    │
│ │Task  │ │      │  │ [PDF][LaTeX][Jupyter][Code][...]   │    │
│ │Panel │ │      │  ├────────────────────────────────────┤    │
│ │(coll)│ │      │  │                                    │    │
│ ├──────┤ │      │  │ Active Editor Component            │    │
│ │      │ │      │  │ (one of 8 types)                   │    │
│ │Msg   │ │      │  │                                    │    │
│ │List  │ │      │  ├────────────────────────────────────┤    │
│ │      │ │      │  │ Timeline                           │    │
│ ├──────┤ │      │  │ [▶ 02:35 ──●──────── 05:00]       │    │
│ │Action│ │      │  └────────────────────────────────────┘    │
│ │Bar   │ │      │                                            │
│ ├──────┤ │      │  ┌────────────────────────────────────┐    │
│ │Chat  │ │      │  │ DiffViewer (if active diff)        │    │
│ │Input │ │      │  └────────────────────────────────────┘    │
│ └──────┘ │      │                                            │
├──────────┴──────┴────────────────────────────────────────────┤
│ (Chat collapsed: SiriOrb + TaskBubble overlay on left)       │
└──────────────────────────────────────────────────────────────┘
```

### Chat Panel (Left)

- **Width**: resizable 280-600px (drag handle)
- **TaskPanel**: collapsible (compact/default/expanded heights)
- **MessageList**: scrollable, supports agent messages with actions, code blocks, markdown
- **ActionBar**: renders InteractiveComponents from latest message (buttons, options, forms)
- **ChatInput**: text input with @mention support

### WindowViewer (Right)

- **ComponentTabs**: 8 editor types
  - `pdf-reader` — PDF with OCR, AI chat, annotations
  - `latex-editor` — LaTeX with CodeMirror 6, KaTeX preview, PDF compile
  - `jupyter-notebook` — Jupyter server connection, Python/R execution
  - `code-playground` — WebContainer browser-native Node.js
  - `ai-editor` — Rich text editor (AiEditor)
  - `ag-grid` — Data table (AG Grid)
  - `bento-gallery` — Image gallery
  - `three-viewer` — 3D viewer (Three.js)
- **Timeline**: playback bar with seek, play/pause, event markers
- **DiffViewer**: shows code changes when agent edits files

### Collapsed State

When chat is collapsed:
- SiriOrb (animated agent indicator) appears bottom-left of WindowViewer
- TaskBubble shows current task progress
- Click either to expand chat

---

## 4. Connection Indicator (NEW — Phase 1)

### States

| State | Visual | Animation |
|-------|--------|-----------|
| Connected | Green dot | Scale pulse (1→1.2→1, 2s loop) |
| Connecting | Yellow dot | Border rotate (360deg, 1.5s linear) |
| Disconnected | Red dot | None |
| Error | Red X | None |

### Popover Content

```
┌──────────────────────────────────────┐
│ My Research Project                  │
│ Bot Instance: a3f7                   │
│ Status: Connected (2m 35s)           │
│                                      │
│ [Reconnect]  [Disconnect]            │
└──────────────────────────────────────┘
```

### Position

Top bar of WorkspaceView, height 40px:
```
[●] Connected to "My Research Project" · bot-a3f7     [workspace settings ▾]
```

---

## 4.1 Workspace UX States (Readiness Gate)

The workspace has 4 distinct UX states based on agent readiness (`agentInstanceStatus` + `bridgeConnected`):

### State Diagram

```
                  ┌─────────────┐
 page load ──────►│ Idle/Stopped │◄──── agent stopped
                  └──────┬──────┘
                    Start │
                         ▼
                  ┌──────────────┐
                  │   Starting   │ (SSE progress overlay)
                  └──────┬───────┘
                    done │
                         ▼
                  ┌──────────────┐
                  │  Connecting  │ (brief spinner, bridge check)
                  └──────┬───────┘
                  bridge │ ok
                         ▼
                  ┌──────────────┐
                  │    Ready     │ (auto-dismiss gate, full interaction)
                  └──────────────┘

   Any state → Error (retry available)
```

### Visual States

| State | Overlay | Chat | Editors | Health Monitor |
|-------|---------|------|---------|----------------|
| **Ready** | None | Enabled | Enabled | Polling 60s |
| **Starting** | AgentStartupOverlay (step progress) | Disabled + banner | Blurred overlay | Not started |
| **Idle/Stopped** | "Agent Not Running" + Start button | Disabled + banner | Blurred overlay | Not started |
| **Error** | Error display + Retry button | Disabled + banner | Blurred overlay | Stopped |
| **Connecting** | Brief spinner "Connecting to agent..." | Disabled + banner | Blurred overlay | Waiting |

### WorkspaceReadinessGate Component

Full-screen overlay (`z-50`) shown when `!isReady && !gateDismissed && workspaceId !== 'default'`.

- **Idle state**: Server icon, "Agent Not Running", Start Agent button, agent info (orchestrator + version), skip link
- **Starting state**: Delegates to `AgentStartupOverlay` (8-step SSE progress)
- **Error state**: Red XCircle, error message, Retry + Dismiss buttons
- **Connecting state**: Blue spinner, "Connecting to agent...", skip link

Auto-dismisses when `isReady` becomes `true` (1.5s delay for health data to populate).

### Health Monitoring

`useHealthMonitor` polls `/api/agents/:id/health` every 60s when `status === 'running'`:
- Stores results in `agentInstanceStore.healthStatus`
- After 3 consecutive failures: toast warning + set status to `error`
- ConnectionIndicator auto-displays health data (no manual click needed)
- Small amber badge on status dot when unhealthy

### Chat Disabled State

When `disabled` prop is true:
- Inline amber banner: "Agent is not connected" with AgentStatusBadge
- ChatInput: static placeholder ("Start the agent to chat..."), no typewriter animation
- Attachment, voice, send buttons all disabled with `opacity-40`
- Textarea shows `cursor-not-allowed`

### Per-Workspace Store Isolation

Each workspace has isolated Zustand store data via workspace-scoped localStorage keys.

**Storage key format**: `user-${userId}:${baseName}:ws-${workspaceId}`

**Initialization sequence** (`initializeWorkspace()` in `syncActions.ts`):
1. Reset all stores to clean initial state
2. Point storage adapters to the new workspaceId
3. Rehydrate from workspace-scoped localStorage (cached state)
4. Load fresh data from API (overwrites stale cache)

**Isolated stores** (all use `skipHydration: true`):
- `componentStore` — active editor, per-component states
- `chatStore` — messages, participants, completed interactions
- `taskStore` — tasks, active task
- `layoutStore` — chat panel width, task panel height
- `agentInstanceStore` — agent binding, gateway URL, health status

**Non-isolated stores** (no persist, reset on workspace switch):
- `timelineStore` — timeline events, snapshots
- `demoStore` — demo flow state

### Agent Scheduler Panel

Entry point: **⏰ button** in WorkspaceChat ActionBar (next to existing action buttons).

**Job List View:**
```
┌─────────────────────────────────────┐
│ ⏰ Scheduled Tasks            [+ New] │
├─────────────────────────────────────┤
│ 📋 Cron Jobs  │  🪝 Hooks  │  💓 Heartbeat │
├─────────────────────────────────────┤
│ ☑ Daily arXiv scan       every day 9:00  │
│   → "Check new papers in cs.AI"           │
│   Last run: 2h ago  Next: tomorrow 9:00   │
│   [Edit] [Pause] [Delete]                 │
│                                           │
│ ☑ Weekly lit review      every Mon 10:00  │
│   → "Summarize this week's highlights"    │
│   Last run: 3d ago  Next: Mon 10:00       │
│   [Edit] [Pause] [Delete]                 │
│                                           │
│ ☐ Experiment check       every 30min      │
│   (paused) → "Check Jupyter kernel status"│
│   [Edit] [Resume] [Delete]               │
└─────────────────────────────────────┘
```

**New Job Dialog:**
```
┌─────────────────────────────────────┐
│ New Scheduled Task                    │
├─────────────────────────────────────┤
│ Name: [________________________]      │
│                                       │
│ Schedule:                             │
│  ○ Interval  [30] [minutes ▾]        │
│  ○ Daily at  [09:00]                 │
│  ○ Weekly    [Mon ▾] at [10:00]      │
│  ○ Cron expr [_____________________] │
│                                       │
│ Prompt:                               │
│ ┌─────────────────────────────────┐  │
│ │ Check for new papers in cs.AI   │  │
│ │ and summarize key findings.     │  │
│ └─────────────────────────────────┘  │
│                                       │
│ Session: ○ Main (continue context)    │
│          ● Isolated (fresh each run)  │
│                                       │
│ Timezone: [Asia/Shanghai ▾]           │
│                                       │
│         [Cancel]  [Create Task]       │
└─────────────────────────────────────┘
```

**Hooks Tab:** Lists active hooks with event type, handler description, and enable/disable toggle. Hooks are defined by the agent's skill plugins and cannot be created from UI — only toggled.

**Heartbeat Tab:** Single toggle for enabling/disabling the agent's periodic heartbeat (default 30min). When enabled, the agent wakes up periodically to check its environment and decide if any action is needed. Shows last heartbeat time and next scheduled check.

### Component Event → Agent Communication

Component events (tab switches, document loads) are forwarded silently:
- Frontend sends `{ metadata: { isSystemEvent: true, component, eventType } }` to bridge
- Bridge stores component context in memory (5-min TTL)
- Next user message gets context injected: `[Context: Active component: latex-editor, last event: ready]`
- Agent responses can embed structured UI via `prismer-ui` / `prismer-task` fenced blocks

### Directive Push Channel (Plugin → Frontend)

Real-time UI directives from the container plugin during tool execution:

```
Container Plugin → POST /api/agents/:id/directive → DirectiveQueue (in-memory)
                                                          ↓
Frontend ← EventSource /api/agents/:id/directive/stream ← SSE push
                  ↓
         useDirectiveStream() → mapPluginDirective() → executeDirective()
```

- **Plugin types (UPPERCASE)**: SWITCH_COMPONENT, LATEX_COMPILE_COMPLETE, JUPYTER_CELL_RESULT, PDF_LOAD_DOCUMENT
- **Frontend types (lowercase)**: switch_component, update_content, load_document, etc.
- SSE auto-reconnects on error; heartbeat every 30s
- Only connected when `agentStatus === 'running'`

### Workspace Collection Binding

Each workspace auto-creates a collection on creation for file sync:
- `collectionId` stored in workspace `settings` JSON field
- Agent-generated files (compiled PDFs, Jupyter outputs) sync to S3 → collection
- Notes auto-saved every 5s to collection as note assets

---

## 5. Workspace Sidebar Management (NEW — Phase 1)

### Dropdown Menu

When sidebar is **expanded**, clicking Workspace tab shows dropdown:

```
┌─────────────────────────────────────┐
│ ✓ My Research Project               │  ← current (checkmark)
│   Paper Writing Workspace           │
│   VLA Benchmark Analysis            │
├─────────────────────────────────────┤
│ + New Workspace...                  │
│   Manage Workspaces...              │
└─────────────────────────────────────┘
```

When sidebar is **collapsed**, the Cpu icon triggers the same dropdown on hover.

### Create Workspace Dialog

```
┌─────────────────────────────────────────┐
│ New Workspace                     [×]   │
├─────────────────────────────────────────┤
│ Name:                                   │
│ ┌─────────────────────────────────────┐ │
│ │ My Research Project                 │ │
│ └─────────────────────────────────────┘ │
│ Description (optional):                 │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│             [Cancel]  [Create]          │
└─────────────────────────────────────────┘
```

### Manage Workspaces Dialog

```
┌──────────────────────────────────────────────┐
│ Manage Workspaces                      [×]   │
├──────────────────────────────────────────────┤
│ [+ New Workspace]                            │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ My Research Project            [Edit]    │ │
│ │ Updated: Feb 15, 2026                    │ │
│ │                            [Delete]      │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ VLA Benchmark Analysis         [Edit]    │ │
│ │ Updated: Feb 12, 2026                    │ │
│ │                            [Delete]      │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│                              [Close]         │
└──────────────────────────────────────────────┘
```

### 5.4 Public Workspace（公开工作空间）

工作空间可以设为 Public，任何人（含未登录用户）可查看。

**Workspace 头部增加公开控件：**

```
┌──────────────────────────────────────────────────────┐
│ 📄 Meta-Analysis on LLM Reasoning          [Private ▾] │
│     by @alice · ⭐ 127 · 🍴 34 · Updated 2h ago      │
├──────────────────────────────────────────────────────┤
│ [Private ▾] 下拉：                                    │
│   ○ Private — 仅自己和协作者可见                       │
│   ○ Public  — 任何人可查看、Fork、评论                 │
│   ○ Unlisted — 有链接可访问，不出现在 Discovery       │
└──────────────────────────────────────────────────────┘
```

**Guest / Read-Only 视图（未登录 / 非 Owner）：**

```
┌──────────────────────────────────────────────────────┐
│ Chat Panel (read-only)  │  WindowViewer (read-only)  │
│ ┌────────────────────┐  │ ┌────────────────────────┐ │
│ │ Message history     │  │ │ PDF / Jupyter / LaTeX  │ │
│ │ (可滚动，不可发送)   │  │ │ (可查看，不可编辑)     │ │
│ │                    │  │ │                        │ │
│ │ [登录后可评论]      │  │ │ Timeline (只读)        │ │
│ └────────────────────┘  │ └────────────────────────┘ │
│ ┌────────────────────┐  │                            │
│ │ ⭐ Star  🍴 Fork   │  │ [申请协作] [举报]         │
│ │ 💬 Comment         │  │                            │
│ └────────────────────┘  │                            │
└──────────────────────────────────────────────────────┘
```

**社交交互：**

| 操作 | 需要登录 | 说明 |
|------|---------|------|
| 查看 | 否 | 完整的 read-only 工作空间 |
| Star | 是 | 收藏，影响 trending 排序 |
| Fork | 是 | 复制为自己的 private workspace（含论文集、分析、草稿） |
| Comment | 是 | 评论区在 Chat Panel 底部，与 Agent 对话分开 |
| 申请协作 | 是 | Owner 审批后获得编辑权限 |

**Discovery 集成：**

Discovery 首页增加 "Trending Workspaces" 板块，与论文并列展示：

```
Discovery
├── 🔥 Trending Workspaces
│   ├── [Meta-Analysis on LLM Reasoning] ⭐127 🍴34 by @alice
│   ├── [CRISPR Off-Target Prediction] ⭐89 🍴22 by @bob
│   └── [Dark Matter Simulation] ⭐76 🍴15 by @carol
├── 📄 Recent Papers (arXiv / PubMed)
└── 🏷️ By Category
```

---

## 6. Component Library

### shadcn/ui Components Used

All UI components follow shadcn/ui (new-york style) with Lucide icons:
- Dialog, AlertDialog — modals and confirmations
- DropdownMenu — sidebar workspace dropdown
- Popover — connection indicator details
- Button, Input, Textarea — form controls
- Toast (Sonner) — notifications
- Tabs — component tabs in WindowViewer

### Animation Library

framer-motion for:
- Sidebar collapse/expand
- Chat panel show/hide (AnimatePresence)
- WindowViewer layout transitions (motion.div with layout prop)
- Connection indicator pulse/spin

**Caution**: Do NOT nest `<AnimatePresence>` components with React 19 Compiler. Inner animations may fail to fire. Use plain `<div>` for inner containers if parent already uses AnimatePresence.

---

## 7. Color & Style Conventions

| Element | Active | Inactive | Disabled |
|---------|--------|----------|----------|
| Sidebar tab | `bg-blue-50 text-blue-700 border-blue-200` | `text-slate-600 hover:bg-slate-50` | `text-slate-300` |
| Connection dot | green-500 / yellow-500 / red-500 | - | - |
| Chat panel | `bg-white rounded-2xl shadow-sm border-slate-200` | - | - |
| WindowViewer tabs | `bg-violet-50 text-violet-700` | `text-slate-500` | - |

### Typography

- Headings: `font-bold text-slate-900`
- Body: `text-slate-600`
- Metadata: `text-xs text-slate-400`
- Code: monospace via `font-mono`
