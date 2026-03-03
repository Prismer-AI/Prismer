# Workspace 设计方案

> 多 Agent 协作工作空间 - 设计文档与行动计划

## 目录

1. [需求分析](#1-需求分析)
2. [现有实现评估](#2-现有实现评估)
3. [架构设计](#3-架构设计)
4. [组件设计](#4-组件设计)
5. [数据模型](#5-数据模型)
6. [后端需求](#6-后端需求)
7. [行动计划](#7-行动计划)
8. [移动端扩展](#8-移动端扩展)

---

## 1. 需求分析

### 1.1 核心需求

| 需求 | 描述 | 优先级 |
|------|------|--------|
| **Chat 组件** | 多人/多 Agent 群聊对话 | P0 |
| **任务面板** | 可展开收起的任务状态展示 | P0 |
| **Window 组件** | 集成多种编辑器/预览组件 | P0 |
| **时间线** | 操作记录与回放 | P1 |
| **协作编辑** | 多人实时编辑 | P1 |
| **数据持久化** | 后端存储对话/任务 | P0 |
| **移动端 IM** | 独立的移动端应用 | P2 |

### 1.2 用户场景

```
科研工作流:
1. 用户发起研究任务 → Agent 开始执行
2. Agent 产出阶段性成果 → 显示在 Window 组件
3. 用户在 Window 中精细编辑 → Copilot 辅助
4. 多人协作讨论 → Chat 群聊
5. 时间线回放 → 查看操作历史
```

---

## 2. 现有实现评估

### 2.1 可复用组件

| 组件 | 路径 | 状态 | 复用方式 |
|------|------|------|----------|
| **SiriOrb** | `src/components/ui/siri-orb.tsx` | ✅ 完整 | 直接复用 |
| **AgentChatPanel** | `src/components/editors/previews/latex-agent/components/AgentChatPanel.tsx` | ⚠️ 需解耦 | 抽取到 shared |
| **ActionCard** | `src/components/editors/previews/latex-agent/components/ActionCard.tsx` | ⚠️ 需解耦 | 抽取到 shared |
| **PDF Reader** | `src/components/editors/previews/PDFReaderPreview.tsx` | ✅ 完整 | 通过 registry |
| **AI Editor** | `src/components/editors/previews/AiEditorPreview.tsx` | ✅ 完整 | 通过 registry |
| **LaTeX Editor** | `src/components/editors/previews/LatexEditorPreview.tsx` | ⚠️ 需关闭内置 chat | 修改后复用 |
| **Code Playground** | `src/components/editors/previews/code-playground/` | ✅ 完整 | 通过 registry |
| **Bento Gallery** | `src/components/editors/previews/BentoGalleryPreview.tsx` | ✅ 完整 | 通过 registry |
| **3D Viewer** | `src/components/editors/previews/ThreeViewerPreview.tsx` | ✅ 完整 | 通过 registry |
| **AG Grid** | `src/components/editors/previews/AGGridPreview.tsx` | ✅ 完整 | 通过 registry |
| **Jupyter Notebook** | `src/components/editors/previews/JupyterNotebookPreview.tsx` | ✅ 完整 | 通过 registry |

### 2.2 需要新开发

| 组件 | 描述 | 复杂度 |
|------|------|--------|
| **WorkspaceChat** | 独立的 Chat 组件 | 高 |
| **TaskPanel** | 三态任务面板 | 中 |
| **WindowViewer** | 多组件切换容器 | 中 |
| **Timeline** | 时间线滑动条 | 中 |
| **后端 API** | 对话/任务存储 | 高 |

### 2.3 现有 Workspace 目录结构

```
src/app/workspace/
├── page.tsx           # 基本空页面
├── layout.tsx         # 布局
└── components/
    ├── index.ts
    └── WorkspaceView.tsx  # 空组件
```

---

## 3. 架构设计

### 3.1 整体布局

#### 状态一：Chat 收起（默认状态）

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Workspace Page                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                       Window Viewer                          │   │
│  │  ┌───────────────────────────────────────────────────────┐   │   │
│  │  │                   Component Tabs                       │   │   │
│  │  │  [📝 AI Editor] [📄 PDF] [📐 LaTeX] [💻 Code]         │   │   │
│  │  │  [🖼️ Gallery] [🧊 3D] [📊 Grid] [📓 Jupyter]          │   │   │
│  │  └───────────────────────────────────────────────────────┘   │   │
│  │                                                               │   │
│  │  ┌───────────────────────────────────────────────────────┐   │   │
│  │  │                                                        │   │   │
│  │  │                                                        │   │   │
│  │  │              Active Component                          │   │   │
│  │  │              (PDF Reader, LaTeX Editor, etc.)          │   │   │
│  │  │                                                        │   │   │
│  │  │                                                        │   │   │
│  │  │                                                        │   │   │
│  │  └───────────────────────────────────────────────────────┘   │   │
│  │                                                               │   │
│  │  ┌───────────────────────────────────────────────────────┐   │   │
│  │  │  ◄◄  ►  ►►  │  00:05:23 / 01:32:45  │  Timeline ━●━●━  │   │   │
│  │  └───────────────────────────────────────────────────────┘   │   │
│  │                                                               │   │
│  │  ┌─────┐ ┌──────────────────────────────────────────────┐    │   │
│  │  │ 🔮  │ │ 📋 Phase 2: 数据分析中... 75% ━━━━━━━━━━━━━━ │    │   │
│  │  └─────┘ └──────────────────────────────────────────────┘    │   │
│  │  ↑ SiriOrb    ↑ 任务状态气泡 (点击展开 Chat)                  │   │
│  │  (左下角)                                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 状态二：Chat 展开（点击 SiriOrb 后）

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Workspace Page                            │
│                                                                     │
│  ┌─────────────────────┐  ┌────────────────────────────────────┐   │
│  │     Chat Panel      │  │         Window Viewer              │   │
│  │   (动画挤压出现)     │  │        (被压缩)                    │   │
│  │                     │  │                                    │   │
│  │  ┌───────────────┐  │  │  ┌──────────────────────────────┐  │   │
│  │  │  Task Panel   │  │  │  │      Component Tabs          │  │   │
│  │  │  (30%/80%)    │  │  │  │  [AI] [PDF] [LaTeX] [Code]   │  │   │
│  │  │               │  │  │  └──────────────────────────────┘  │   │
│  │  │  - Phase 1 ✅ │  │  │                                    │   │
│  │  │  - Phase 2 ▶  │  │  │  ┌──────────────────────────────┐  │   │
│  │  │    - 2.1 ✅   │  │  │  │                              │  │   │
│  │  │    - 2.2 ▶    │  │  │  │    Active Component          │  │   │
│  │  │  - Phase 3 ○  │  │  │  │    (被挤压后的尺寸)           │  │   │
│  │  └───────────────┘  │  │  │                              │  │   │
│  │                     │  │  └──────────────────────────────┘  │   │
│  │  ┌───────────────┐  │  │                                    │   │
│  │  │ Chat Messages │  │  │  ┌──────────────────────────────┐  │   │
│  │  │  👤 分析论文   │  │  │  │        Timeline              │  │   │
│  │  │  🤖 正在处理  │  │  │  │  ◄ ▶ ────●────●──── ►        │  │   │
│  │  │  👤 User 2    │  │  │  └──────────────────────────────┘  │   │
│  │  └───────────────┘  │  │                                    │   │
│  │                     │  └────────────────────────────────────┘   │
│  │  ┌───────────────┐  │                                           │
│  │  │  Input Box    │  │                                           │
│  │  │  [📎][🎤][➤]  │  │                                           │
│  │  └───────────────┘  │                                           │
│  │  [收起 ✕]          │                                           │
│  └─────────────────────┘                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 动画过渡说明

```
【收起 → 展开】
1. 点击 SiriOrb 或任务气泡
2. SiriOrb 淡出消失 (fade-out, 200ms)
3. Chat Panel 从左侧滑入 (slide-in-from-left, 300ms)
4. Window Viewer 宽度压缩 (width transition, 300ms)

【展开 → 收起】
1. 点击 Chat Panel 的 "收起" 按钮
2. Chat Panel 滑出到左侧 (slide-out-to-left, 300ms)
3. Window Viewer 宽度恢复 (width transition, 300ms)
4. SiriOrb 在 Window Viewer 左下角淡入 (fade-in, 200ms)
```

### 3.2 状态管理

```typescript
// stores/workspaceStore.ts
interface WorkspaceState {
  // 布局状态
  chatExpanded: boolean;           // Chat Panel 展开/收起
  taskPanelHeight: 'collapsed' | '30%' | '80%';  // 展开时的 TaskPanel 高度
  chatPanelWidth: number;          // Chat Panel 宽度 (默认 380px)
  
  // 当前工作区
  workspaceId: string | null;
  
  // Chat 状态
  messages: ChatMessage[];
  participants: Participant[];
  
  // Task 状态
  tasks: Task[];
  activeTaskId: string | null;
  currentTask: Task | null;        // 当前运行的任务 (显示在气泡中)
  
  // Window 状态
  activeComponent: ComponentType;
  timeline: TimelineEvent[];
  currentTimelinePosition: number;
  isTimelinePlaying: boolean;
  
  // Actions
  toggleChat: () => void;          // 切换 Chat 展开/收起
  expandChatToTask: (taskId: string) => void;  // 展开并定位到任务
  setTaskPanelHeight: (height: 'collapsed' | '30%' | '80%') => void;
  sendMessage: (content: string) => Promise<void>;
  setActiveComponent: (type: ComponentType) => void;
  seekTimeline: (position: number) => void;
  playTimeline: () => void;
  pauseTimeline: () => void;
}
```

**布局计算**:
```typescript
// Chat 收起时
const layout = {
  chatPanel: { width: 0, visible: false },
  windowViewer: { width: '100%' },
  siriOrb: { visible: true, position: 'bottom-left' },
};

// Chat 展开时
const layoutExpanded = {
  chatPanel: { width: '380px', visible: true },
  windowViewer: { width: 'calc(100% - 380px)' },
  siriOrb: { visible: false },
};
```

### 3.3 组件通信

```
┌──────────────────────────────────────────────────────────────────┐
│                      WorkspaceStore (Zustand)                     │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐   │
│  │ layout   │  │ chat     │  │ task     │  │ window         │   │
│  │ Slice    │  │ Slice    │  │ Slice    │  │ Slice          │   │
│  │          │  │          │  │          │  │                │   │
│  │ expanded │  │ messages │  │ tasks    │  │ activeComponent│   │
│  │ panelH   │  │ partici. │  │ current  │  │ timeline       │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬────────┘   │
│       │             │             │                │             │
└───────┼─────────────┼─────────────┼────────────────┼─────────────┘
        │             │             │                │
        ▼             ▼             ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│                         WorkspaceView                             │
│                                                                   │
│   ┌─────────────────┐                ┌────────────────────────┐  │
│   │ ChatPanel       │  ◄─ 动画切换 ─►  │ WindowViewer          │  │
│   │ (展开时可见)     │                │                        │  │
│   │                 │                │  ┌──────────────────┐  │  │
│   │ ┌─────────────┐ │                │  │ ComponentTabs    │  │  │
│   │ │ TaskPanel   │ │                │  └──────────────────┘  │  │
│   │ └─────────────┘ │                │                        │  │
│   │ ┌─────────────┐ │                │  ┌──────────────────┐  │  │
│   │ │ MessageList │ │                │  │ Active Component │  │  │
│   │ └─────────────┘ │                │  └──────────────────┘  │  │
│   │ ┌─────────────┐ │                │                        │  │
│   │ │ ChatInput   │ │                │  ┌──────────────────┐  │  │
│   │ └─────────────┘ │                │  │ Timeline         │  │  │
│   └─────────────────┘                │  └──────────────────┘  │  │
│                                      │                        │  │
│                                      │  ┌─────┐ ┌──────────┐ │  │
│                                      │  │🔮   │ │任务气泡  │ │  │
│                                      │  └─────┘ └──────────┘ │  │
│                                      │  ↑ ChatToggle (收起时) │  │
│                                      └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                │
                       WebSocket / SSE
                                │
                    ┌───────────┴───────────┐
                    │     Backend API        │
                    │    /api/workspace      │
                    └───────────────────────┘
```

---

## 4. 组件设计

### 4.1 WorkspaceChat 组件

```typescript
// components/WorkspaceChat/index.tsx
interface WorkspaceChatProps {
  workspaceId: string;
  onContentOutput?: (content: string, type: OutputType) => void;
  className?: string;
}

interface ChatMessage {
  id: string;
  workspaceId: string;
  senderId: string;
  senderType: 'user' | 'agent';
  senderName: string;
  senderAvatar?: string;
  content: string;
  contentType: 'text' | 'markdown' | 'code' | 'image' | 'file';
  actions?: AgentAction[];
  timestamp: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  type: 'user' | 'agent';
  status: 'online' | 'offline' | 'busy';
  role: 'owner' | 'member' | 'agent';
}
```

**文件结构** (参见 1.1 目录结构)

### 4.2 TaskPanel 组件

```typescript
// components/TaskPanel/index.tsx
interface TaskPanelProps {
  height: 'collapsed' | '30%' | '80%';
  onHeightChange: (height: 'collapsed' | '30%' | '80%') => void;
  tasks: Task[];
  activeTaskId?: string;
  onTaskClick: (taskId: string) => void;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
  startTime?: string;
  endTime?: string;
  subtasks?: SubTask[];
  outputs?: TaskOutput[];
}

interface SubTask {
  id: string;
  parentId: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
  details?: string;
}

interface TaskOutput {
  id: string;
  taskId: string;
  type: 'text' | 'file' | 'code' | 'image';
  content: string;
  timestamp: string;
  componentTarget?: ComponentType;  // 输出到哪个组件
}
```

**三态设计**:
```
┌────────────────────────────────────────┐
│ COLLAPSED (收起)                       │
│ ┌────────────────────────────────────┐ │
│ │ 📋 Phase 2: 数据分析 ▶ 75% ━━━━━━━ │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 30% HEIGHT (一级大纲)                  │
│ ┌────────────────────────────────────┐ │
│ │ ✅ Phase 1: 数据收集               │ │
│ │ ▶  Phase 2: 数据分析   75%         │ │
│ │ ○  Phase 3: 报告生成               │ │
│ │ ○  Phase 4: 结果验证               │ │
│ └────────────────────────────────────┘ │
│                                        │
│                             [展开 ↑]  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 80% HEIGHT (二级详情)                  │
│ ┌────────────────────────────────────┐ │
│ │ ▼ Phase 2: 数据分析                │ │
│ │   ├─ ✅ 2.1 加载数据集            │ │
│ │   │      已处理 5,000 条记录       │ │
│ │   ├─ ✅ 2.2 数据清洗              │ │
│ │   │      移除 23 条异常值          │ │
│ │   ├─ ▶  2.3 特征工程              │ │
│ │   │      正在计算相关性...         │ │
│ │   ├─ ○  2.4 模型训练              │ │
│ │   └─ ○  2.5 结果评估              │ │
│ │                                    │ │
│ │ ○  Phase 3: 报告生成               │ │
│ └────────────────────────────────────┘ │
│                                        │
│                             [收起 ↓]  │
└────────────────────────────────────────┘
```

### 4.3 WindowViewer 组件

```typescript
// components/WindowViewer/index.tsx
interface WindowViewerProps {
  activeComponent: ComponentType;
  onComponentChange: (type: ComponentType) => void;
  timeline: TimelineEvent[];
  currentPosition: number;
  onSeek: (position: number) => void;
  onPlay: () => void;
  onPause: () => void;
  isPlaying: boolean;
}

type ComponentType = 
  | 'ai-editor'
  | 'pdf-reader'
  | 'latex-editor'
  | 'code-playground'
  | 'bento-gallery'
  | 'three-viewer'
  | 'ag-grid'
  | 'jupyter-notebook';

interface TimelineEvent {
  id: string;
  timestamp: number;           // Unix timestamp
  componentType: ComponentType;
  action: string;              // 'edit' | 'create' | 'delete' | 'navigate'
  description: string;
  snapshot?: string;           // 状态快照 (JSON)
  agentId?: string;
  userId?: string;
}
```

**组件切换标签栏**:
```
┌─────────────────────────────────────────────────────────────┐
│  [📝 AI Editor] [📄 PDF] [📐 LaTeX] [💻 Code]              │
│  [🖼️ Gallery] [🧊 3D] [📊 Grid] [📓 Jupyter]               │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 SiriOrb + 任务气泡组件

```typescript
// components/ChatToggle/index.tsx
interface ChatToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
  currentTask?: Task;
  className?: string;
}
```

**收起状态 UI** (位于 WindowViewer 左下角):
```
┌──────────────────────────────────────────────────────────────────┐
│                        WindowViewer                               │
│                                                                   │
│                    ... 组件内容 ...                               │
│                                                                   │
│  ┌─────┐ ┌──────────────────────────────────────────────────┐    │
│  │     │ │                                                   │    │
│  │ 🔮  │ │ 📋 Phase 2: 数据分析中...  ━━━━━━━━━━━━ 75%      │    │
│  │     │ │ └─ 2.3 正在计算特征相关性                        │    │
│  └─────┘ └──────────────────────────────────────────────────┘    │
│  ↑        ↑                                                       │
│  SiriOrb  任务状态气泡 (可点击展开详情)                           │
│  (48px)   (自适应宽度，最大 400px)                                │
└──────────────────────────────────────────────────────────────────┘
```

**任务气泡状态**:
```typescript
// 气泡根据任务状态变色
const bubbleStyles = {
  running: 'bg-blue-500/90 border-blue-400',    // 运行中 - 蓝色
  completed: 'bg-emerald-500/90 border-emerald-400', // 完成 - 绿色
  error: 'bg-red-500/90 border-red-400',        // 错误 - 红色
  pending: 'bg-slate-500/90 border-slate-400',  // 等待 - 灰色
};
```

**交互行为**:
1. 点击 SiriOrb → 展开完整 Chat Panel
2. 点击气泡 → 展开 Chat Panel 并自动滚动到该任务
3. 悬停气泡 → 显示任务详情 tooltip
4. 任务完成时 → 气泡短暂闪烁 + 绿色打勾动画

### 4.5 Timeline 组件

```typescript
// components/Timeline/index.tsx
interface TimelineProps {
  events: TimelineEvent[];
  currentPosition: number;  // 0-100
  duration: number;         // 总时长（秒）
  isPlaying: boolean;
  onSeek: (position: number) => void;
  onPlay: () => void;
  onPause: () => void;
  playbackSpeed: number;    // 1x, 2x, 4x
  onSpeedChange: (speed: number) => void;
}
```

**时间线 UI**:
```
┌───────────────────────────────────────────────────────────────┐
│ ◄◄  ►  ►►  │  00:05:23 / 01:32:45  │  [1x ▼]  │  🔊 ━━━━    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   ○──────●──────●──────●────────●──────────●───────────────   │
│   │      │      │      │        │          │                  │
│   │      │      │      │        │          └─ 保存报告        │
│   │      │      │      │        └─ 生成图表                   │
│   │      │      │      └─ 运行分析                            │
│   │      │      └─ 加载数据                                   │
│   │      └─ 搜索论文                                          │
│   └─ 开始任务                                                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. 数据模型

### 5.1 数据库 Schema (Prisma)

```prisma
// prisma/schema.prisma

model Workspace {
  id          String   @id @default(cuid())
  name        String
  description String?
  ownerId     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  owner       User     @relation(fields: [ownerId], references: [id])
  members     WorkspaceMember[]
  messages    WorkspaceMessage[]
  tasks       WorkspaceTask[]
  timeline    TimelineEvent[]
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String?
  agentId     String?
  role        String   @default("member") // owner, member, agent
  joinedAt    DateTime @default(now())
  
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  user        User?     @relation(fields: [userId], references: [id])
}

model WorkspaceMessage {
  id          String   @id @default(cuid())
  workspaceId String
  senderId    String
  senderType  String   // user, agent
  senderName  String
  content     String   @db.Text
  contentType String   @default("text")
  actions     Json?
  replyToId   String?
  createdAt   DateTime @default(now())
  
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  replyTo     WorkspaceMessage? @relation("MessageReplies", fields: [replyToId], references: [id])
  replies     WorkspaceMessage[] @relation("MessageReplies")
}

model WorkspaceTask {
  id          String   @id @default(cuid())
  workspaceId String
  parentId    String?  // For subtasks
  title       String
  description String?  @db.Text
  status      String   @default("pending")
  progress    Int      @default(0)
  startedAt   DateTime?
  completedAt DateTime?
  outputs     Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  parent      WorkspaceTask? @relation("TaskHierarchy", fields: [parentId], references: [id])
  subtasks    WorkspaceTask[] @relation("TaskHierarchy")
}

model TimelineEvent {
  id            String   @id @default(cuid())
  workspaceId   String
  timestamp     DateTime @default(now())
  componentType String
  action        String
  description   String
  snapshot      Json?
  actorId       String?
  actorType     String?  // user, agent
  
  workspace     Workspace @relation(fields: [workspaceId], references: [id])
}
```

### 5.2 Redis 缓存结构

```
# 在线状态
workspace:{id}:presence -> Set<userId>

# 消息队列
workspace:{id}:messages:pending -> List<Message>

# 任务状态缓存
workspace:{id}:tasks:active -> Hash<taskId, status>

# 实时协作锁
workspace:{id}:component:{type}:lock -> userId
```

---

## 6. 后端需求

### 6.1 API 端点

```typescript
// REST API
POST   /api/workspace                    // 创建工作区
GET    /api/workspace/:id                // 获取工作区详情
PUT    /api/workspace/:id                // 更新工作区
DELETE /api/workspace/:id                // 删除工作区

GET    /api/workspace/:id/messages       // 获取消息列表
POST   /api/workspace/:id/messages       // 发送消息

GET    /api/workspace/:id/tasks          // 获取任务列表
POST   /api/workspace/:id/tasks          // 创建任务
PUT    /api/workspace/:id/tasks/:taskId  // 更新任务

GET    /api/workspace/:id/timeline       // 获取时间线
POST   /api/workspace/:id/timeline       // 添加时间线事件

GET    /api/workspace/:id/members        // 获取成员列表
POST   /api/workspace/:id/members        // 添加成员
DELETE /api/workspace/:id/members/:mid   // 移除成员

// WebSocket / SSE
GET    /api/workspace/:id/stream         // SSE 实时事件流
WS     /api/workspace/:id/ws             // WebSocket 双向通信
```

### 6.2 实时通信

```typescript
// 事件类型
interface WorkspaceEvent {
  type: 
    | 'message.new'
    | 'message.update'
    | 'task.start'
    | 'task.progress'
    | 'task.complete'
    | 'task.error'
    | 'timeline.event'
    | 'member.join'
    | 'member.leave'
    | 'presence.update';
  workspaceId: string;
  data: unknown;
  timestamp: string;
}
```

### 6.3 Agent 集成

```typescript
// Agent 消息处理
interface AgentMessage {
  workspaceId: string;
  agentId: string;
  type: 'response' | 'action' | 'output';
  content: string;
  action?: {
    type: 'search' | 'analyze' | 'write' | 'execute';
    status: 'start' | 'progress' | 'complete' | 'error';
    data?: unknown;
  };
  output?: {
    type: ComponentType;
    content: string;
    format: 'text' | 'markdown' | 'code' | 'latex' | 'json';
  };
}
```

---

## 7. 行动计划

### Phase 1: 基础架构 (3-4 天)

- [ ] **1.1 目录结构搭建**
  ```
  src/app/workspace/
  ├── page.tsx
  ├── layout.tsx
  ├── components/
  │   ├── WorkspaceView.tsx      # 重构 - 主布局容器
  │   ├── WorkspaceChat/         # 左侧 Chat Panel
  │   │   ├── index.tsx
  │   │   ├── ChatHeader.tsx
  │   │   ├── MessageList.tsx
  │   │   ├── MessageBubble.tsx
  │   │   └── ChatInput.tsx
  │   ├── TaskPanel/             # Chat Panel 内的任务面板
  │   │   ├── index.tsx
  │   │   ├── TaskCard.tsx
  │   │   └── SubTaskList.tsx
  │   ├── ChatToggle/            # SiriOrb + 任务气泡 (收起时显示)
  │   │   ├── index.tsx
  │   │   └── TaskBubble.tsx
  │   ├── WindowViewer/          # 右侧组件容器
  │   │   ├── index.tsx
  │   │   └── ComponentTabs.tsx
  │   └── Timeline/              # 时间线
  │       └── index.tsx
  ├── stores/
  │   └── workspaceStore.ts
  ├── hooks/
  │   ├── useWorkspace.ts
  │   ├── useChat.ts
  │   └── useTimeline.ts
  └── types.ts
  ```

- [ ] **1.2 状态管理**
  - 创建 `workspaceStore.ts` (Zustand)
  - 定义所有状态和 actions
  - 实现持久化逻辑

- [ ] **1.3 类型定义**
  - 定义所有 TypeScript 接口
  - 导出共享类型

### Phase 2: Chat 组件开发 (4-5 天)

- [ ] **2.1 抽取共享组件**
  - 从 `latex-agent` 抽取 `ActionCard` 到 `src/components/shared/`
  - 从 `latex-agent` 抽取 `MessageBubble` 基础组件
  - 保持 LaTeX 编辑器内置 chat 暂时关闭

- [ ] **2.2 WorkspaceChat 核心**
  - 实现 `ChatInput.tsx` (支持 @ 提及、附件)
  - 实现 `MessageList.tsx` (虚拟滚动)
  - 实现 `MessageBubble.tsx` (多发送者样式)

- [ ] **2.3 参与者管理**
  - 实现 `ParticipantList.tsx`
  - 实现在线状态显示
  - 实现 Agent 标识

- [ ] **2.4 SiriOrb + 任务气泡**
  - SiriOrb 位于 **WindowViewer 左下角**（不是页面左下角）
  - SiriOrb 右侧显示当前任务状态气泡
  - 点击 SiriOrb 或气泡展开 Chat Panel
  - 展开时 SiriOrb 淡出消失
  - Chat Panel 从左侧滑入，挤压 WindowViewer
  - 收起时反向动画

### Phase 3: TaskPanel + ChatToggle 组件 (3-4 天)

- [ ] **3.1 ChatToggle (SiriOrb + 气泡)**
  - 实现 SiriOrb 在 WindowViewer 左下角定位
  - 实现任务状态气泡组件
  - 气泡显示当前任务名称、进度、状态
  - 气泡根据状态变色 (running/completed/error)
  - 点击 SiriOrb/气泡展开 Chat Panel

- [ ] **3.2 展开/收起动画**
  - SiriOrb 淡出动画 (200ms)
  - Chat Panel 从左侧滑入 (300ms)
  - WindowViewer 宽度过渡 (300ms)
  - 收起时反向动画

- [ ] **3.3 TaskPanel 三态**
  - 实现收起状态 (只显示当前任务)
  - 实现 30% 状态 (一级大纲)
  - 实现 80% 状态 (二级详情)

- [ ] **3.4 任务展示**
  - 实现任务卡片
  - 实现进度条
  - 实现子任务展开/收起
  - 点击任务切换面板高度
  - 实时状态更新

### Phase 4: WindowViewer 组件 (3-4 天)

- [ ] **4.1 组件容器**
  - 实现标签栏切换
  - 实现组件懒加载
  - 实现组件状态保持

- [ ] **4.2 组件集成**
  - 集成 8 个现有组件
  - 统一 props 接口
  - 实现输出捕获

- [ ] **4.3 时间线**
  - 实现时间线 UI
  - 实现播放/暂停/快进
  - 实现事件标记

### Phase 5: 后端 API (4-5 天)

- [ ] **5.1 数据库模型**
  - 添加 Prisma schema
  - 运行 migration
  - 创建 seed 数据

- [ ] **5.2 REST API**
  - 实现 workspace CRUD
  - 实现 messages API
  - 实现 tasks API

- [ ] **5.3 实时通信**
  - 实现 SSE 端点
  - 实现事件分发
  - 实现心跳检测

### Phase 6: 集成测试 (2-3 天)

- [ ] **6.1 端到端测试**
  - 测试 Chat 流程
  - 测试任务执行
  - 测试时间线回放

- [ ] **6.2 性能优化**
  - 消息虚拟滚动
  - 组件懒加载
  - 缓存策略

- [ ] **6.3 文档完善**
  - API 文档
  - 组件使用指南
  - 部署说明

---

## 8. 移动端扩展 (P2)

### 8.1 技术方案

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **React Native** | 原生性能、代码复用 | 学习成本、双端维护 | ⭐⭐⭐⭐ |
| **Capacitor** | Web 代码复用、快速开发 | 性能一般 | ⭐⭐⭐⭐⭐ |
| **PWA** | 无需安装、自动更新 | 功能受限 | ⭐⭐⭐ |
| **Flutter** | 高性能、统一 UI | 重写代码 | ⭐⭐ |

**推荐: Capacitor + 现有 React 代码**

### 8.2 移动端功能裁剪

```
移动端 IM 核心功能:
✅ Chat 对话 (核心)
✅ 任务状态查看
✅ 推送通知
✅ 文件预览 (简化版)
❌ 完整编辑器
❌ 时间线回放
❌ 协作编辑
```

### 8.3 项目结构

```
pisa-mobile/
├── capacitor.config.ts
├── src/
│   ├── components/
│   │   ├── MobileChat/        # 复用 WorkspaceChat
│   │   └── TaskView/          # 简化版任务面板
│   ├── pages/
│   │   ├── Workspaces.tsx
│   │   ├── Chat.tsx
│   │   └── Settings.tsx
│   └── services/
│       └── push-notifications.ts
├── android/
└── ios/
```

---

## 附录

### A. 视觉风格参考 (Discovery)

```css
/* 基础卡片样式 */
.card {
  @apply bg-white rounded-2xl shadow-md overflow-hidden;
}

/* 动画 */
.card-enter {
  @apply motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4;
}

/* 渐变背景 */
.page-bg {
  @apply bg-gradient-to-br from-slate-50 to-slate-100/50;
}
```

### A.1 Chat Panel 展开/收起动画

```css
/* Chat Panel 从左侧滑入 */
.chat-panel-enter {
  animation: slideInFromLeft 300ms ease-out forwards;
}

.chat-panel-exit {
  animation: slideOutToLeft 300ms ease-in forwards;
}

@keyframes slideInFromLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutToLeft {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-100%);
    opacity: 0;
  }
}

/* SiriOrb 淡入淡出 */
.siri-orb-enter {
  animation: fadeIn 200ms ease-out forwards;
}

.siri-orb-exit {
  animation: fadeOut 200ms ease-in forwards;
}

/* WindowViewer 宽度过渡 */
.window-viewer {
  transition: width 300ms ease-in-out, margin-left 300ms ease-in-out;
}

/* 任务气泡脉冲动画 (任务完成时) */
@keyframes taskCompletePulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(16, 185, 129, 0.5); }
  100% { transform: scale(1); }
}

.task-bubble-complete {
  animation: taskCompletePulse 500ms ease-in-out;
}
```

### B. 组件 Registry ID 映射

```typescript
const componentMap: Record<ComponentType, string> = {
  'ai-editor': 'ai-editor',
  'pdf-reader': 'pdf-reader',
  'latex-editor': 'latex-editor',
  'code-playground': 'code-playground',
  'bento-gallery': 'bento-gallery',
  'three-viewer': 'three-viewer',
  'ag-grid': 'ag-grid',
  'jupyter-notebook': 'jupyter-notebook',
};
```

### C. 预估工时

| Phase | 任务 | 预估天数 |
|-------|------|----------|
| Phase 1 | 基础架构 | 3-4 天 |
| Phase 2 | Chat 组件 | 4-5 天 |
| Phase 3 | TaskPanel | 3-4 天 |
| Phase 4 | WindowViewer | 3-4 天 |
| Phase 5 | 后端 API | 4-5 天 |
| Phase 6 | 集成测试 | 2-3 天 |
| **总计** | | **19-25 天** |

---

*最后更新: 2026-01-29*
