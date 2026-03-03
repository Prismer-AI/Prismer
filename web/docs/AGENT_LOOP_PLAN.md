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

# Agent Loop 可观测性与交互改进方案

> Last updated: 2026-02-28
> Status: Planning — v2 (含根因分析 + Tool 重构 + 文件中间件修复)
> Plugin baseline: prismer-workspace v0.6.0 (28 tools)
> Companion docs:
> - `docs/ARCH.md` — 工程架构
> - `docs/WINDOWVIEW_CONVERGENCE.md` — WindowViewer 收敛
> - `docs/CONTAINER_PROTOCOL.md` — 容器变更协议
> - `docker/VERSIONS.md` — 组件版本追踪

---

## 0. 根因分析 — "帮我写一个 VLA 综述" 体验复盘

### 0.1 现象描述

用户在本地新建 workspace，发送 "帮我写一个 VLA 模型的综述"，观察到：

1. Agent 一直在 thinking（2-3 分钟），task panel 无任何更新
2. 没有 action bar 让用户确认任何信息
3. 2-3 分钟后直接切换到 latex 组件，编译好的 PDF 在右侧渲染
4. LaTeX 编辑器左侧仍显示初始数据，不是工程文件
5. 输入框 `#` 看不到任何文件
6. Assets 没有新建 collection

### 0.2 全链路断点追踪

```
时间轴：用户发送 "帮我写一个 VLA 综述"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

T=0s     用户点击发送
         ├─ chatStore.addMessage(user_msg)
         ├─ thinkingStatus = "Thinking..."
         └─ POST /api/v2/im/bridge/{workspaceId}   ← 阻塞等待开始
              └─ Bridge → OpenClaw Gateway (WebSocket)
                   └─ Agent 开始 thinking + tool 调用

T=0~180s  ⚠️ 黑洞期 — 前端完全无感知
         │
         │  Bridge API 阻塞等待（90s timeout）
         │  Agent 在容器内执行多个 tool：
         │    1. latex_project("write", "main.tex", content)
         │       ├─ 写入 /workspace/latex/main.tex (容器 FS)
         │       ├─ sendUIDirective(SWITCH_COMPONENT, latex-editor) ← ✅ SSE 到达
         │       └─ sendUIDirective(UPDATE_LATEX_PROJECT, ...) ← ✅ SSE 到达
         │    2. latex_project("write", "refs.bib", ...)  ← 同上
         │    3. latex_project_compile()
         │       ├─ pdflatex → 生成 PDF
         │       ├─ sendUIDirective(SWITCH_COMPONENT) ← ✅
         │       └─ sendUIDirective(LATEX_PROJECT_COMPILE_COMPLETE, {pdfBase64}) ← ✅
         │
         │  ❌ 但 SWITCH_COMPONENT 和 UPDATE_LATEX_PROJECT directives
         │     通过 SSE stream 送达前端时，useDirectiveStream 已激活
         │     → 组件切换成功，PDF 渲染成功
         │
         │  ❌ 但 UPDATE_LATEX_PROJECT directive 中的文件内容
         │     是 CustomEvent 分发给 LaTeX 编辑器，编辑器可能因为
         │     re-mount 或初始化顺序问题而丢失事件
         │
         │  ❌ triggerFileSync() 仅处理 LATEX_COMPILE_COMPLETE
         │     不处理 LATEX_PROJECT_COMPILE_COMPLETE → 文件不同步到 DB
         │

T=180s   Bridge 超时或收到响应
         ├─ Agent 最终文本回复
         ├─ parseAgentResponse() 正则提取 artifacts
         └─ 返回前端 → 显示回复消息

T=180s+  ❌ LaTeX 编辑器左侧文件树
         │  loadProjectFiles() 从 /api/workspace/{id}/files 加载
         │  但 sync_files_to_workspace 从未被调用
         │  → WorkspaceFile DB 为空 → 文件树为空 → 显示初始数据
         │
         ❌ # 文件选择器
         │  依赖 WorkspaceFile DB → 为空
         │
         ❌ Assets / Collection
            save_artifact 从未被 agent 调用
            triggerFileSync 未处理 PROJECT_COMPILE_COMPLETE
            → 无 S3 上传 → 无 Asset 创建 → 无 Collection
```

### 0.3 根因总结

| # | 根因 | 影响 | 层级 |
|---|------|------|------|
| **RC1** | Bridge API 是阻塞 RPC（等 90s）| Thinking/Task/Timeline 全部无中间状态 | Bridge |
| **RC2** | `triggerFileSync()` 仅匹配 `LATEX_COMPILE_COMPLETE`，不匹配 `LATEX_PROJECT_COMPILE_COMPLETE` | 项目编译的 PDF 不同步到 S3/Asset | Directive API |
| **RC3** | `latex_project("write")` 不调用 `sync_files_to_workspace` | 文件写入容器 FS，但 WorkspaceFile DB 为空 | Plugin Tool 设计 |
| **RC4** | LaTeX 编辑器 `loadProjectFiles()` 从 DB 加载，但 directive 更新通过 CustomEvent | 编辑器 re-mount 时丢失 directive 数据，回退到空 DB | 前端状态 |
| **RC5** | Agent 无 `save_artifact` 自动调用逻辑 | 生成内容不入 Asset/Collection | Agent 行为 |
| **RC6** | Tool 粒度过细，Agent 需手动协调 4-5 个 tool | Agent 可能遗漏 sync/save 步骤 | Tool 抽象设计 |
| **RC7** | `#` 文件选择器依赖 WorkspaceFile DB | DB 空 → 选择器空 | 前端 |
| **RC8** | 前端 `sendMessage()` 不传递 mentions/references 到 Bridge | Agent 无法感知用户引用的上下文 | 前端→Bridge |

### 0.4 Tool 抽象设计问题

当前 28 个 tool 的设计存在以下问题：

#### 问题 1: 功能重叠与割裂

```
LaTeX 相关 tool（6个，功能重叠严重）：
├── update_latex        → 推送内容到编辑器（不写容器 FS，不编译）
├── latex_compile       → 编译内联 LaTeX（不写文件，直接编译字符串）
├── latex_project       → 文件 CRUD（写容器 FS + directive）
├── latex_project_compile → 编译项目（从 FS 读 → pdflatex → directive）
├── sync_files_to_workspace → 同步文件到 DB（需手动调用）
└── save_artifact       → 保存到 Asset/Collection（需手动调用）

问题：Agent 写一篇论文需要调用 3-5 个 tool 的特定组合，
遗漏任何一个都会导致数据不一致。
```

#### 问题 2: 双路径数据不一致

```
路径 A: latex_project("write") → 容器 FS + directive
路径 B: update_latex()         → 仅 directive（瞬态）

编辑器有两个数据源：
  1. CustomEvent from directive (瞬态，re-mount 丢失)
  2. WorkspaceFile DB via REST (持久，但依赖 sync_files_to_workspace)

如果 Agent 用路径 A 写文件但不调 sync，
编辑器从 DB 加载时看不到文件。
```

#### 问题 3: 文件中间件断路

```
现有 triggerFileSync() 逻辑（directive/route.ts:56-61）：

if (body.type === 'LATEX_COMPILE_COMPLETE' && body.payload?.pdfUrl) {
  triggerFileSync(agentId, 'latex', body.payload);  // fire-and-forget
}

遗漏了：
❌ LATEX_PROJECT_COMPILE_COMPLETE  → 项目编译完的 PDF
❌ UPDATE_LATEX_PROJECT             → LaTeX 源文件
❌ UPDATE_NOTEBOOK                  → Jupyter notebook
❌ UPDATE_CODE                      → Code playground 文件
❌ UPDATE_GALLERY                   → Gallery 图片
```

---

## 1. 目标概述

实现 Agent Loop 全链路可观测与可控交互，覆盖 7 项核心能力：

| # | 能力 | 简述 |
|---|------|------|
| F1 | Thinking 展示 | Chat Panel 展示 agent loop 推理细节（thinking blocks, tool calls, reasoning chain） |
| F2 | Task Panel 实时更新 | 展示任务规划和执行状况，随 agent loop 实时更新 |
| F3 | Action Bar 用户确认 | Agent 暂停等待用户输入/确认后继续执行 |
| F4 | Timeline 自动记录 | 每个 agent 动作自动记录 timeline 点位 |
| F5 | Timeline 状态恢复 | 点击 timeline 点位恢复前端/内容状态（含 chat panel） |
| F6 | Timeline 分支覆盖 | 从历史点位提问时，覆盖后续历史，单线状态管理 |
| F7 | 组件操作状态 | 获取组件细粒度操作状态（文件写入、编译进度等） |

---

## 2. 现状评估

### 2.1 全层级能力矩阵

```
数据流路径（当前双通道）：
通道 1 (消息): Frontend → Bridge API (阻塞 RPC, 90s) → OpenClaw Gateway → Agent → Response → Bridge → Frontend
通道 2 (指令): Agent Tool → sendUIDirective() → POST /api/agents/{id}/directive → SSE Stream → Frontend
```

| # | 能力 | Plugin | Bridge/Protocol | Sync/Server | Store | UI | 综合 |
|---|------|--------|----------------|-------------|-------|----|------|
| F1 | Thinking 展示 | ❌ 无 tool | ❌ 不解析 thinking | ⚠️ AgentState 有 stepMessage | ⚠️ thinkingStatus 仅 string | ⚠️ 仅动画圆点 | **~25%** |
| F2 | Task Panel | ❌ 无写入 tool | ⚠️ 正则解析 | ✅ tasks broadcast | ✅ taskStore 完整 | ✅ TaskPanel 完整 | **~75%** |
| F3 | Action Bar | ❌ 无 tool | ⚠️ prismer-ui 解析 | ✅ waiting_interaction | ✅ completedInteractions | ✅ ActionBar + Renderer | **~85%** |
| F4 | Timeline 记录 | ❌ 无 tool | ❌ 无自动生成 | ⚠️ 仅 demo 手动添加 | ✅ timelineStore 完整 | ✅ Timeline 完整 | **~60%** |
| F5 | 状态恢复 | N/A | N/A | ⚠️ 快照结构已定义 | ⚠️ restoreSnapshot 空实现 | ⚠️ 点击回调已接 | **~35%** |
| F6 | 分支覆盖 | N/A | N/A | ❌ 无机制 | ❌ 无机制 | ❌ 无 UI | **~5%** |
| F7 | 组件操作状态 | ⚠️ 有 CRUD 无状态推送 | ⚠️ directive 仅推结果 | ⚠️ componentStates 无操作字段 | ⚠️ 无 operationStatus | ❌ 无 indicator | **~30%** |
| **F8** | **文件一致性** | ❌ 不自动 sync DB | ❌ triggerFileSync 仅匹配 1 种 | N/A | ❌ 编辑器双源冲突 | ❌ 文件树空 | **~15%** |

### 2.2 核心瓶颈（按严重程度排序）

**瓶颈 1: Bridge 阻塞 RPC + 文件中间件断路 (RC1+RC2+RC3)**
这是用户体验的最大问题。Bridge POST 阻塞等待 90s，期间 thinking/task/timeline 完全无中间状态。同时 `triggerFileSync()` 仅处理 `LATEX_COMPILE_COMPLETE`，遗漏了 `LATEX_PROJECT_COMPILE_COMPLETE` 和所有其他文件类指令，导致文件不入 DB/S3/Asset。

**瓶颈 2: Tool 抽象割裂 (RC6)**
6 个 LaTeX tool 功能重叠，Agent 需要手动协调 `latex_project("write")` → `latex_project_compile()` → `sync_files_to_workspace()` → `save_artifact()` 的调用序列。遗漏任何一步都导致数据不一致。

**瓶颈 3: 编辑器双数据源冲突 (RC4)**
LaTeX 编辑器有两个数据源：`CustomEvent` from directive (瞬态) 和 `WorkspaceFile DB` via REST (持久)。编辑器 re-mount 时从 DB 加载，但如果 `sync_files_to_workspace` 未被调用，DB 为空，编辑器回退到初始数据。

---

## 3. 改进方案

### 3.0 架构改进总览

```
改进后数据流（三层优化）：

层 1 — Bridge SSE 化（解决 RC1）:
  POST /api/v2/im/bridge/{workspaceId}
  → 返回 Content-Type: text/event-stream
  → 实时推送: thinking | tool_start | tool_result | message_delta | done

层 2 — Tool 合并 + 自动 Side-Effect（解决 RC3/RC6）:
  latex_write_and_compile(files, compile=true)
  → 自动: 写容器 FS → sync to WorkspaceFile DB → 编译 → save artifact → directive
  一个 tool 完成"写+同步+编译+存储"全流程

层 3 — 文件中间件修复（解决 RC2/RC4）:
  Directive API 对所有文件类 directive 自动触发 file sync
  编辑器统一从 WorkspaceFile DB 加载（directive 同时写 DB + 推 event）
```

#### 改进后数据通道

| 通道 | 传输机制 | 职责 | 改动 |
|------|---------|------|------|
| **Bridge SSE** | POST → text/event-stream | 消息 + thinking + tool call 事件 | **新增** 替代阻塞 RPC |
| **Directive SSE** | POST directive → EventSource | 组件切换 + 内容更新 + 编译结果 | **增强** 自动 file sync |
| **REST API** | GET/PUT /api/workspace/{id}/files | 文件持久读写 | 现有，增强为唯一数据源 |

---

### 3.1 P0-Critical: 文件中间件修复 + Tool 重构

> **必须首先解决。** 不修复文件一致性，后续所有改进都无意义。

#### 3.1.1 修复 triggerFileSync — 扩展匹配规则

```typescript
// src/app/api/agents/[id]/directive/route.ts — 修复
// 现有: 仅匹配 LATEX_COMPILE_COMPLETE
// 修复: 匹配所有文件类 directive

const FILE_SYNC_TRIGGERS: Record<string, (payload: any) => FileSyncConfig | null> = {
  // LaTeX
  'LATEX_COMPILE_COMPLETE': (p) => ({
    service: 'latex', fileType: 'pdf',
    url: p.pdfUrl, title: p.filename, mimeType: 'application/pdf',
  }),
  'LATEX_PROJECT_COMPILE_COMPLETE': (p) => ({
    service: 'latex', fileType: 'pdf',
    // pdfBase64 → 先写临时文件 → 再上传 S3
    base64: p.pdfBase64, title: 'compiled.pdf', mimeType: 'application/pdf',
  }),
  // 源文件同步
  'UPDATE_LATEX_PROJECT': (p) => ({
    service: 'workspace-files', fileType: 'latex-source',
    files: [{ path: `latex/${p.file}`, content: p.content }],
    projectFiles: p.projectFiles,
  }),
  'UPDATE_NOTEBOOK': (p) => ({
    service: 'workspace-files', fileType: 'notebook',
    files: [{ path: `notebooks/${p.filename || 'notebook.ipynb'}`, content: JSON.stringify(p.cells) }],
  }),
  'UPDATE_CODE': (p) => ({
    service: 'workspace-files', fileType: 'code',
    files: (p.files || []).map((f: any) => ({ path: `code/${f.name}`, content: f.content })),
  }),
};

// directive POST handler 中
const syncConfig = FILE_SYNC_TRIGGERS[body.type]?.(body.payload);
if (syncConfig) {
  if (syncConfig.files) {
    // 源文件 → 写入 WorkspaceFile DB
    syncFilesToWorkspaceDB(agentId, syncConfig.files).catch(err =>
      log.warn('File DB sync failed', { agentId, error: String(err) })
    );
  }
  if (syncConfig.url || syncConfig.base64) {
    // 产物 → 上传 S3 + 创建 Asset
    triggerFileSync(agentId, syncConfig).catch(err =>
      log.warn('Asset sync failed', { agentId, error: String(err) })
    );
  }
}
```

#### 3.1.2 Tool 重构 — 合并 LaTeX Tool

**现有 6 个 LaTeX tool 合并为 3 个：**

| 现有 Tool | → 合并为 | 理由 |
|-----------|---------|------|
| `update_latex` | 删除 | 被 `latex_project("write")` 取代 |
| `latex_compile` | 删除 | 被 `latex_project_compile` 取代 |
| `latex_project` | 保留，增强 | 自动同步到 WorkspaceFile DB |
| `latex_project_compile` | 保留，增强 | 自动 save_artifact |
| `sync_files_to_workspace` | 保留，内部化 | 不暴露给 Agent，由其他 tool 自动调用 |
| `save_artifact` | 保留，内部化 | 不暴露给 Agent，由 compile tool 自动调用 |

**`latex_project("write")` 增强：自动 DB 同步**

```typescript
// tools.ts — latex_project 增强
case 'write': {
  const fullPath = path.join(LATEX_PROJECT_DIR, params.path);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, params.content, 'utf-8');

  // 1. Directive 推送前端（实时 UI 更新）
  await sendUIDirective({
    type: 'SWITCH_COMPONENT',
    payload: { component: 'latex-editor' },
  });
  await sendUIDirective({
    type: 'UPDATE_LATEX_PROJECT',
    payload: { operation: 'write', file: params.path, content: params.content, projectFiles },
  });

  // 2. ✅ 新增: 自动同步到 WorkspaceFile DB（持久化）
  //    Directive API 的 FILE_SYNC_TRIGGERS 会自动处理
  //    但也可以在 tool 层显式调用确保一致性
  await syncFilesToWorkspaceDB([{ path: `latex/${params.path}`, content: params.content }]);
}
```

**`latex_project_compile` 增强：自动 save_artifact**

```typescript
// tools.ts — latex_project_compile 增强
async function latexProjectCompile(params) {
  // ... 现有编译逻辑 ...

  // 编译成功后:
  if (compileSuccess) {
    // 1. ✅ 现有: 发送 compile complete directive
    await sendUIDirective({
      type: 'LATEX_PROJECT_COMPILE_COMPLETE',
      payload: { success: true, pdfBase64, log, warnings },
    });

    // 2. ✅ 新增: 自动保存 PDF artifact
    //    Directive API 的 FILE_SYNC_TRIGGERS 会处理 S3 上传 + Asset 创建
    //    无需 agent 手动调用 save_artifact
  }
}
```

#### 3.1.3 编辑器数据源统一

```
现有（双源冲突）:
  LaTeX 编辑器 ← CustomEvent (directive, 瞬态)
  LaTeX 编辑器 ← REST /api/workspace/{id}/files (DB, 持久)

改进后（单一数据源 + 实时通知）:
  Directive 到达
    ├─ 1. 自动写入 WorkspaceFile DB（via FILE_SYNC_TRIGGERS）
    └─ 2. CustomEvent 通知编辑器刷新（从 DB 重新加载）

  编辑器 mount/re-mount
    └─ 从 WorkspaceFile DB 加载 ← 唯一数据源
```

**前端改动：**

```typescript
// LatexEditorPreview.tsx — 统一数据源
// 1. mount 时从 DB 加载
useEffect(() => {
  loadProjectFiles();  // GET /api/workspace/{id}/files → 过滤 latex/*
}, [workspaceId]);

// 2. 监听 directive 通知 → 重新从 DB 加载（而非直接用 event data）
useEffect(() => {
  const handler = () => loadProjectFiles();  // 刷新，不是直接替换
  window.addEventListener('agent:directive:UPDATE_LATEX_PROJECT', handler);
  return () => window.removeEventListener('agent:directive:UPDATE_LATEX_PROJECT', handler);
}, []);
```

---

### 3.2 F1 — Thinking 展示

#### 3.2.1 Plugin 层新增

**无需新增 Plugin Tool。** Thinking 来自 OpenClaw 框架层（LLM 返回的 thinking blocks），不由 tool 产生。需在 **Bridge API / Agent Server** 层捕获并转发。

#### 3.2.2 Bridge API 升级

```typescript
// POST /api/v2/im/bridge/[workspaceId] — 升级为 SSE
// Content-Type: text/event-stream

// Event 类型：
event: thinking
data: {"content": "Let me analyze the paper structure...", "seq": 1}

event: tool_start
data: {"toolName": "latex_compile", "toolId": "tc_001", "args": {"file": "main.tex"}}

event: tool_result
data: {"toolId": "tc_001", "success": true, "summary": "PDF compiled (12 pages)"}

event: message_delta
data: {"content": "I've compiled your LaTeX...", "seq": 1}

event: message_complete
data: {"messageId": "msg_123", "content": "...", "artifacts": [...]}

event: done
data: {}
```

#### 3.2.3 Sync Protocol 扩展

`AgentState` 新增字段：

```typescript
interface AgentState {
  // ... 现有字段 ...
  thinking?: {
    content: string;       // 当前 thinking 文本（可多段）
    isStreaming: boolean;   // 是否正在流式输出
  };
  currentToolCall?: {
    id: string;
    name: string;
    args: Record<string, unknown>;
    status: 'executing' | 'completed' | 'failed';
    startedAt: number;
  };
}
```

#### 3.2.4 Store 改造

```typescript
// chatStore.ts 扩展
interface ChatState {
  // 现有
  thinkingStatus: string | null;
  // 新增
  thinkingContent: string | null;         // 完整 thinking 文本
  thinkingBlocks: ThinkingBlock[];         // 结构化推理步骤
  isThinkingStreaming: boolean;
  currentToolCall: ToolCallInfo | null;    // 当前正在执行的 tool
  toolCallHistory: ToolCallInfo[];         // 本轮对话的 tool call 历史
}

interface ThinkingBlock {
  id: string;
  content: string;
  timestamp: number;
  type: 'reasoning' | 'planning' | 'reflection';
}

interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'executing' | 'completed' | 'failed';
  result?: string;
  startedAt: number;
  completedAt?: number;
}
```

#### 3.2.5 UI 改造

**AgentThinkingBubble** 升级为 **AgentThinkingPanel**：

```
┌─ Agent Thinking ─────────────────────────────┐
│  ▸ Analyzing paper structure...              │ ← thinking text (可折叠)
│    ├─ Found 5 sections, 12 figures           │
│    └─ Identifying key equations              │
│                                               │
│  ◆ Using tool: latex_compile                 │ ← tool call indicator
│    └─ main.tex → Compiling... (3s)           │
│                                               │
│  ▸ Planning next steps...                    │ ← 新 thinking block
│    └─ Need to update bibliography            │
└───────────────────────────────────────────────┘
```

- 默认折叠，显示一行摘要 + 展开箭头
- Tool call 显示名称 + 参数摘要 + 执行时间
- 流式输出时底部有打字光标动画
- 用 `<details>` 风格的折叠/展开切换

---

### 3.3 F2 — Task Panel 实时更新

#### 3.3.1 Plugin 新增 Tool

```typescript
// 新增 tool: update_tasks
{
  name: 'update_tasks',
  description: 'Create or update task plan and progress. Call at the start of a multi-step workflow to show the plan, then update status as each step completes.',
  parameters: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            status: { enum: ['pending', 'running', 'completed', 'error'] },
            progress: { type: 'number', minimum: 0, maximum: 100 },
            subtasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  status: { enum: ['pending', 'running', 'completed', 'error'] },
                },
                required: ['id', 'title', 'status'],
              },
            },
          },
          required: ['id', 'title', 'status'],
        },
      },
    },
    required: ['tasks'],
  },
}
```

#### 3.3.2 数据通道

- Tool 执行 → 写入 directive `{ type: 'update_tasks', data: { tasks: [...] } }`
- Bridge API poll → 解析 → SSE `event: tasks_update` 推送前端
- 前端 `taskStore.setTasks(tasks)` 更新

#### 3.3.3 Store / UI

**已完整实现，无需改动：**
- `taskStore`: `addTask`, `updateTask`, `updateSubtaskStatus`, `setActiveTaskId`
- `TaskPanel`: 3 档高度, subtask 列表, 进度条, 状态颜色
- Selector: `useCurrentTask()` 自动跟踪 running task

---

### 3.4 F3 — Action Bar 用户确认

#### 3.4.1 Plugin 新增 Tool

```typescript
// 新增 tool: request_user_confirmation
{
  name: 'request_user_confirmation',
  description: 'Pause agent execution and ask the user a question or request confirmation before proceeding. The agent will wait for the user response.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Question or description for the user' },
      type: {
        enum: ['confirm', 'choice', 'input'],
        description: 'confirm=yes/no, choice=select from options, input=free text',
      },
      options: {
        type: 'array',
        items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' } } },
        description: 'Options for choice type',
      },
      metadata: { type: 'object', description: 'Context data attached to the confirmation request' },
    },
    required: ['prompt', 'type'],
  },
}
```

#### 3.4.2 执行流程

```
Agent calls request_user_confirmation(prompt, type, options)
  │
  ├─ 1. Plugin 写入 directive: { type: 'request_confirmation', data: { ... } }
  ├─ 2. Plugin 设置 agent 状态为 waiting（OpenClaw blocking return）
  │
  ├─ 3. Bridge 读取 directive → SSE push → 前端
  ├─ 4. 前端 agentState.status = 'waiting_interaction'
  ├─ 5. ActionBar 渲染 InteractiveComponent（按钮/选项/输入框）
  │
  ├─ 6. 用户操作 → sendInteraction(componentId, actionId, data)
  ├─ 7. Bridge 转发用户响应 → Container
  ├─ 8. Plugin tool 返回用户的选择
  └─ 9. Agent 继续执行
```

#### 3.4.3 Store / UI

**已完整实现，无需改动：**
- `chatStore.completedInteractions` Set
- `ActionBar.tsx` + `InteractiveComponentRenderer`
- 9 种交互组件类型 (button-group, choice-card 等)
- `USER_INTERACTION` WebSocket 消息类型

**唯一需要的前端改动：** 将 Bridge SSE 的 `confirmation_request` 事件映射到现有的 `interactiveComponents` 消息字段。

---

### 3.5 F4 — Timeline 自动记录

#### 3.5.1 自动化策略（无需 Plugin Tool）

Timeline 事件在 **Agent Server / Bridge API 层自动生成**，不依赖 agent 主动调用 tool。

```typescript
// agent-server.ts / bridge route — 自动拦截层
function autoRecordTimeline(event: {
  type: 'tool_start' | 'tool_complete' | 'tool_error' | 'message_sent' | 'component_switch' | 'user_interaction';
  toolName?: string;
  componentType?: ComponentType;
  description: string;
  actorType: 'user' | 'agent';
  snapshot?: StateSnapshot;  // 自动捕获当前状态
}) {
  const timelineEvent: ExtendedTimelineEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action: mapToAction(event.type),  // tool_start→execute, component_switch→navigate, etc.
    componentType: event.componentType || activeComponent,
    description: event.description,
    timestamp: Date.now(),
    actorType: event.actorType,
    actorId: event.actorType === 'agent' ? agentId : userId,
    snapshot: event.snapshot,
  };

  // 追加到 session timeline
  session.timeline.push(timelineEvent);
  // 广播给所有客户端
  broadcastDelta({ timeline: { added: [timelineEvent] } });
}
```

#### 3.5.2 自动触发点

| 触发时机 | event.type | action | description 模板 |
|---------|-----------|--------|-----------------|
| Agent tool 开始执行 | `tool_start` | `execute` | "Agent: 开始执行 {toolName}" |
| Agent tool 执行完成 | `tool_complete` | `execute` | "Agent: {toolName} 完成 ({duration}ms)" |
| Agent tool 执行失败 | `tool_error` | `execute` | "Agent: {toolName} 失败 — {error}" |
| Agent 发送消息 | `message_sent` | `create` | "Agent: 回复消息" |
| 组件切换 | `component_switch` | `navigate` | "切换到 {componentType}" |
| 用户发送消息 | `user_message` | `create` | "User: 发送消息" |
| 用户交互操作 | `user_interaction` | `edit` | "User: {actionId} on {componentId}" |
| 内容更新 | `content_update` | `edit` | "Agent: 更新 {componentType} 内容" |
| 快照检查点 | `checkpoint` | `checkpoint` | "检查点: {description}" |

#### 3.5.3 Plugin 可选 Tool

为 agent 提供显式标记能力（低优先级）：

```typescript
// 可选 tool: add_timeline_marker
{
  name: 'add_timeline_marker',
  description: 'Add an explicit milestone marker to the timeline. Use for significant workflow transitions.',
  parameters: {
    type: 'object',
    properties: {
      description: { type: 'string' },
      category: { enum: ['milestone', 'checkpoint', 'decision', 'error'] },
    },
    required: ['description'],
  },
}
```

#### 3.5.4 Store / UI

**已完整实现，无需改动：**
- `timelineStore.addTimelineEvent(event)` — 自动去重 + 排序
- Timeline UI: 彩色圆点标记, hover tooltip, 播放/跳转控制

---

### 3.6 F5 — Timeline 状态恢复

#### 3.6.1 快照自动捕获

每个 timeline 事件创建时，自动捕获当前全局状态作为 snapshot：

```typescript
interface StateSnapshot {
  id: string;
  timelineEventId: string;
  timestamp: number;

  // 布局状态
  layout: {
    chatExpanded: boolean;
    chatPanelWidth: number;
    taskPanelHeight: TaskPanelHeight;
    activeComponent: ComponentType;
  };

  // 所有组件状态（深拷贝）
  components: Record<ComponentType, ComponentStateData>;

  // Chat 状态（截断到该时刻）
  chat: {
    messageIds: string[];        // 该时刻已存在的消息 ID 列表
    lastMessageIndex: number;    // messages 数组的截断位置
  };

  // Task 状态
  tasks: Task[];

  // 文件状态（可选，按需捕获）
  files?: Record<string, { contentHash: string; size: number }>;
}
```

#### 3.6.2 快照捕获时机

并非每个 timeline 事件都需要完整快照（性能考量）：

| 事件类型 | 快照策略 |
|---------|---------|
| `tool_complete` | **完整快照** — tool 完成后状态稳定 |
| `component_switch` | **完整快照** — 组件切换是关键转折点 |
| `checkpoint` / `milestone` | **完整快照** — 显式标记点 |
| `tool_start` | **轻量快照** — 仅 layout + activeComponent |
| `message_sent` | **轻量快照** — 仅 chat.lastMessageIndex |
| `content_update` | **差异快照** — 记录 diff 而非全量 |

#### 3.6.3 恢复逻辑实现

```typescript
// timelineStore.ts — restoreSnapshot 完整实现
restoreSnapshot: (snapshotId: string) => {
  const snapshot = get().stateSnapshots.find(s => s.id === snapshotId);
  if (!snapshot) return;

  const { layout, components, chat, tasks } = snapshot;

  // 1. 恢复布局
  useLayoutStore.getState().restoreLayout(layout);

  // 2. 恢复组件状态
  const componentStore = useComponentStore.getState();
  componentStore.setActiveComponent(layout.activeComponent);
  for (const [type, state] of Object.entries(components)) {
    componentStore.setComponentState(type as ComponentType, state);
  }

  // 3. 恢复 Chat（截断到快照时刻的消息）
  if (chat) {
    const chatStore = useChatStore.getState();
    chatStore.restoreToMessageIndex(chat.lastMessageIndex);
  }

  // 4. 恢复 Task
  if (tasks) {
    useTaskStore.getState().setTasks(tasks);
  }

  // 5. 标记当前快照 + timeline 位置
  set({
    currentSnapshotId: snapshotId,
    currentTimelinePosition: calculatePosition(snapshot.timelineEventId),
    isViewingHistory: true,   // 新增标记：正在查看历史
  });
},
```

#### 3.6.4 Chat 恢复策略

```typescript
// chatStore.ts — 新增方法
restoreToMessageIndex: (index: number) => {
  set((state) => ({
    // 不删除消息，而是设置"可见边界"
    visibleMessageBound: index,
    // 后续消息灰化显示（未来内容提示）
    isViewingHistory: true,
  }));
},

exitHistoryView: () => {
  set({
    visibleMessageBound: null,
    isViewingHistory: false,
  });
},
```

**UI 表现：**
- 恢复后，`visibleMessageBound` 之后的消息半透明灰化
- 顶部 banner: "正在查看历史状态 — 点击返回最新"
- 编辑器内容恢复到对应快照

---

### 3.7 F6 — Timeline 分支覆盖（单线模型）

#### 3.7.1 设计决策：单线覆盖，非树形分支

选择单线模型（而非 git-like branching）因为：
- 用户心智模型更简单（类似 Photoshop History）
- 实现复杂度低
- 符合 agent 对话的线性本质

#### 3.7.2 覆盖检测与确认

```typescript
// timelineStore.ts — 新增
interface TimelineState {
  // ... 现有 ...
  isViewingHistory: boolean;     // 是否在查看历史快照
  historyBranchPoint: number;    // 分支起点的 timeline index
}

// 当用户在历史点位发送新消息时触发
checkBranchOverwrite: (currentPosition: number) => {
  const { timeline } = get();
  const futureEvents = timeline.filter(e => getIndex(e) > currentPosition);

  if (futureEvents.length > 0) {
    return {
      needsConfirmation: true,
      eventsToOverwrite: futureEvents.length,
      snapshotsToRemove: futureEvents.filter(e => e.snapshot).length,
    };
  }
  return { needsConfirmation: false };
},

// 用户确认后执行覆盖
executeBranchOverwrite: (branchPoint: number) => {
  set((state) => {
    // 截断 timeline
    const keptEvents = state.timeline.filter(e => getIndex(e) <= branchPoint);
    // 截断 snapshots
    const keptSnapshots = state.stateSnapshots.filter(s =>
      keptEvents.some(e => e.id === s.timelineEventId)
    );
    return {
      timeline: keptEvents,
      stateSnapshots: keptSnapshots,
      isViewingHistory: false,
      historyBranchPoint: -1,
    };
  });
},
```

#### 3.7.3 UI 流程

```
用户点击 Timeline 历史点位
  │
  ├─ 1. restoreSnapshot(snapshotId) — 恢复状态
  ├─ 2. isViewingHistory = true
  ├─ 3. 后续消息灰化, 顶部 banner 显示
  │
  ├─ 用户在 ChatInput 输入新消息
  │     │
  │     ├─ 4. checkBranchOverwrite() → needsConfirmation: true
  │     ├─ 5. 弹出确认 Dialog:
  │     │     ┌─────────────────────────────────────────┐
  │     │     │  ⚠ 覆盖历史                              │
  │     │     │                                          │
  │     │     │  从此点位继续将覆盖后续 N 个操作          │
  │     │     │  和 M 个状态快照。此操作不可撤销。       │
  │     │     │                                          │
  │     │     │  [ 取消 ]              [ 确认覆盖 ]      │
  │     │     └─────────────────────────────────────────┘
  │     │
  │     ├─ 用户点击"确认覆盖"
  │     │     ├─ 6. executeBranchOverwrite(branchPoint)
  │     │     ├─ 7. chatStore.truncateAfter(messageIndex) — 删除后续消息
  │     │     ├─ 8. 正常发送新消息
  │     │     └─ 9. Agent 从当前状态继续执行
  │     │
  │     └─ 用户点击"取消" → 保持历史查看状态
  │
  └─ 用户点击 "返回最新" banner
        ├─ exitHistoryView()
        └─ 恢复到最新状态
```

#### 3.7.4 系统文件同步

当覆盖发生时，容器内文件也需要恢复：

```typescript
// 如果快照包含文件状态
if (snapshot.files) {
  // 调用 sync_files_to_workspace 反向同步
  // 将快照时刻的文件内容推送到容器
  await syncFilesToContainer(snapshot.files);
}
```

**注意事项：**
- LaTeX 工程文件 (`/workspace/latex/*`) 需要恢复到快照版本
- Jupyter notebook 状态需要重置 kernel 或回滚 cell 输出
- 数据文件 (`/workspace/data/*`) 按需恢复（文件可能较大）

---

### 3.8 F7 — 组件细粒度操作状态

#### 3.8.1 Plugin 新增 Tool

```typescript
// 新增 tool: update_operation_status
{
  name: 'update_operation_status',
  description: 'Report fine-grained operation progress for a component. Use during long-running operations like LaTeX compilation, notebook execution, or file sync.',
  parameters: {
    type: 'object',
    properties: {
      component: { enum: ['latex-editor', 'jupyter-notebook', 'code-playground', 'ag-grid', 'bento-gallery'] },
      operation: { type: 'string', description: 'e.g., "compile", "execute_cell", "file_write", "data_load"' },
      status: { enum: ['started', 'progress', 'completed', 'failed'] },
      progress: { type: 'number', minimum: 0, maximum: 100 },
      detail: { type: 'string', description: 'Human-readable status, e.g., "Writing main.tex (2/5 files)"' },
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            status: { enum: ['writing', 'written', 'failed'] },
          },
        },
        description: 'File-level status for multi-file operations',
      },
    },
    required: ['component', 'operation', 'status'],
  },
}
```

#### 3.8.2 现有 Tool 自动注入操作状态

在现有内容 tool 中自动嵌入操作状态 directive，无需 agent 显式调用：

```typescript
// tools.ts — latex_project tool 增强
async function executeLatexProject(params) {
  const { action, filename, content } = params;

  if (action === 'write') {
    // 1. 发送 operation_status: started
    await sendDirective({
      type: 'operation_status',
      data: { component: 'latex-editor', operation: 'file_write', status: 'started', detail: `Writing ${filename}...` },
    });

    // 2. 执行写入
    await writeFile(filename, content);

    // 3. 发送 operation_status: completed
    await sendDirective({
      type: 'operation_status',
      data: { component: 'latex-editor', operation: 'file_write', status: 'completed', detail: `${filename} saved` },
    });
  }
}
```

#### 3.8.3 ComponentState 扩展

```typescript
// componentStateConfig.ts — 每个组件增加 operationStatus 字段
{
  'latex-editor': {
    fields: {
      // 现有字段...
      content: { syncMode: 'bidirectional' },
      activeFile: { syncMode: 'bidirectional' },
      // 新增
      operationStatus: {
        syncMode: 'broadcast',   // 仅服务端→客户端
        mobileAccess: 'read',
      },
    },
  },
}

// operationStatus 结构
interface OperationStatus {
  operation: string;           // 'compile' | 'file_write' | 'execute_cell' | ...
  status: 'idle' | 'started' | 'progress' | 'completed' | 'failed';
  progress?: number;           // 0-100
  detail?: string;             // "Compiling main.tex (pdflatex pass 2/3)"
  files?: FileOpStatus[];      // 文件级别状态
  startedAt?: number;
  estimatedMs?: number;        // 预估剩余时间
}

interface FileOpStatus {
  path: string;
  status: 'pending' | 'writing' | 'written' | 'failed';
  size?: number;
}
```

#### 3.8.4 UI — 操作状态 Overlay

在 WindowViewer 编辑器区域顶部增加操作状态条：

```
┌─ latex-editor ──────────────────────────────────────────────┐
│ ┌─ Operation Status ─────────────────────────────────────┐  │
│ │  ◆ Compiling LaTeX (pdflatex pass 2/3)   ████████░░ 80%│  │
│ │  Files: main.tex ✓  refs.bib ✓  figures/fig1.tex ◆    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│  [LaTeX editor content...]                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- 操作完成后 2s 自动淡出
- 失败时红色高亮 + 保持显示直到下次操作
- 文件列表：✓ 已完成 ◆ 进行中 ✗ 失败

---

## 4. Plugin 变更总览

### 4.1 Tool 重构汇总

#### 删除 Tools (2 个)

| Tool | 原因 | 替代方案 |
|------|------|---------|
| `update_latex` | 仅推 directive 不写 FS，与 `latex_project("write")` 重复 | `latex_project("write")` (已增强自动 DB sync) |
| `latex_compile` | 编译内联字符串，与 `latex_project_compile` 重复 | `latex_project_compile` |

#### 内部化 Tools (2 个 → 不暴露给 Agent)

| Tool | 原因 | 调用方式 |
|------|------|---------|
| `sync_files_to_workspace` | Agent 不应手动管理同步 | 由 `latex_project`/`jupyter_notebook` 自动调用 |
| `save_artifact` | Agent 不应手动管理存储 | 由 compile tool 自动调用；Directive API 自动触发 |

#### 新增 Tools (3 个)

| # | Tool 名称 | 用途 | Directive 类型 |
|---|----------|------|---------------|
| 1 | `update_tasks` | 推送任务规划/进度 | `UPDATE_TASKS` |
| 2 | `request_user_confirmation` | 暂停等待用户确认 | `REQUEST_CONFIRMATION` |
| 3 | `update_operation_status` | 推送组件操作状态 | `OPERATION_STATUS` |

#### 可选 Tools (1 个)

| # | Tool 名称 | 用途 | 优先级 |
|---|----------|------|--------|
| 1 | `add_timeline_marker` | 显式里程碑标记 | P2 |

#### 现有 Tool 增强

| Tool | 增强内容 |
|------|---------|
| `latex_project("write")` | 自动调用 `syncFilesToWorkspaceDB` 写入 WorkspaceFile 表 |
| `latex_project_compile` | 编译成功后自动触发 asset sync（由 Directive API FILE_SYNC_TRIGGERS 处理） |
| `jupyter_execute` | 自动 operation_status + 结果文件 sync |
| `code_execute` | 自动 operation_status + 代码文件 sync |
| `jupyter_notebook("write")` | 自动 sync notebook 到 WorkspaceFile DB |

### 4.2 Tool 数量变化

| 阶段 | 删除 | 内部化 | 新增 | 暴露给 Agent | 总注册数 |
|------|------|--------|------|-------------|---------|
| 当前 v0.6.0 | — | — | — | 28 | 28 |
| Phase 0 (文件修复) | -2 | -2 | — | 24 | 26 (含 2 内部) |
| Phase B (交互 tool) | — | — | +3 | 27 | 29 |
| Phase D (可选) | — | — | +1 | 28 | 30 |

### 4.3 新增 Directive 类型

| Directive 类型 | 来源 | 目标 Store | 文件 Sync |
|---------------|------|-----------|----------|
| `UPDATE_TASKS` | update_tasks tool | taskStore | 否 |
| `REQUEST_CONFIRMATION` | request_user_confirmation tool | chatStore → ActionBar | 否 |
| `OPERATION_STATUS` | update_operation_status / 自动注入 | componentStore | 否 |
| `thinking` | Bridge SSE event (非 directive) | chatStore | 否 |
| `tool_start` / `tool_result` | Bridge SSE event (非 directive) | chatStore + timelineStore | 否 |

### 4.4 FILE_SYNC_TRIGGERS 扩展

| Directive 类型 | 触发的 Sync 动作 | 目标 |
|---------------|-----------------|------|
| `LATEX_COMPILE_COMPLETE` | S3 上传 PDF + Asset 创建 | 现有 ✅ |
| `LATEX_PROJECT_COMPILE_COMPLETE` | base64 → S3 上传 PDF + Asset 创建 | **新增** |
| `UPDATE_LATEX_PROJECT` | WorkspaceFile DB upsert | **新增** |
| `UPDATE_NOTEBOOK` | WorkspaceFile DB upsert | **新增** |
| `UPDATE_CODE` | WorkspaceFile DB upsert | **新增** |
| `UPDATE_GALLERY` (with imageUrl) | S3 上传 + Asset 创建 | **新增** |

---

## 5. 实施计划（重排优先级）

### Phase 0 — 文件一致性修复 (P0-Critical, 立即执行)

> **不修复文件一致性，其他改进无意义。**

**范围：** RC2 (triggerFileSync) + RC3 (auto sync) + RC4 (编辑器双源) + RC6 (Tool 重构)
**预估改动文件：** 6-8 个

| 步骤 | 文件 | 改动 |
|------|------|------|
| 01 | `src/app/api/agents/[id]/directive/route.ts` | 扩展 FILE_SYNC_TRIGGERS 匹配所有文件类 directive |
| 02 | `src/app/api/agents/[id]/directive/route.ts` | 新增 `syncFilesToWorkspaceDB()` 函数（接收 files[] → upsert WorkspaceFile） |
| 03 | `docker/plugin/prismer-workspace/src/tools.ts` | `latex_project("write")` 增加自动 DB sync 调用 |
| 04 | `docker/plugin/prismer-workspace/src/tools.ts` | 删除 `update_latex` 和 `latex_compile` tool 定义 |
| 05 | `docker/plugin/prismer-workspace/src/tools.ts` | `sync_files_to_workspace` 和 `save_artifact` 从 toolDefinitions 移除（保留函数，内部调用） |
| 06 | `docker/plugin/prismer-workspace/index.ts` | 更新 tool count 注释 |
| 07 | `src/components/editors/previews/LatexEditorPreview.tsx` | 统一数据源：mount 从 DB 加载，directive event 触发 DB 刷新 |
| 08 | `docker/plugin/prismer-workspace/version.ts` | 版本升级 → v0.7.0 |

**验证标准：**
```
用户发送 "写 VLA 综述" →
  ✅ Agent 调用 latex_project("write", "main.tex") → WorkspaceFile DB 有记录
  ✅ Agent 调用 latex_project_compile() → PDF 自动上传 S3 + Asset 创建
  ✅ LaTeX 编辑器左侧显示 main.tex 文件内容
  ✅ # 文件选择器能看到 latex/main.tex
  ✅ Asset 页面有新建的 collection + PDF asset
```

### Phase A — Bridge SSE + Thinking (P0-High)

**范围：** F1 (Thinking) + F4 (Timeline 自动记录) + RC1 (Bridge 阻塞)
**预估改动文件：** 8-12 个
**依赖：** Phase 0 完成

| 步骤 | 文件 | 改动 |
|------|------|------|
| A1 | `src/app/api/v2/im/bridge/[workspaceId]/route.ts` | POST 升级为 SSE 流式响应 |
| A2 | `src/lib/sync/types.ts` | AgentState 增加 thinking/toolCall 字段 |
| A3 | `src/app/workspace/stores/chatStore.ts` | 新增 thinkingContent, toolCallHistory 状态 + actions |
| A4 | `src/app/workspace/components/WorkspaceChat/AgentThinkingPanel.tsx` | 新建 — 替代 AgentThinkingBubble |
| A5 | `src/app/workspace/hooks/useContainerChat.ts` | SSE 解析 + 事件分发 |
| A6 | `src/app/api/agents/[id]/directive/route.ts` | directive 到达时自动生成 timeline event |
| A7 | `src/app/workspace/stores/timelineStore.ts` | timeline 事件与快照自动关联 |
| A8 | `src/app/workspace/hooks/useContainerChat.ts` | 将 mentions/references 传入 Bridge 请求 metadata (修复 RC8) |

### Phase B — 任务与确认 (P0)

**范围：** F2 (Task) + F3 (Action Bar)
**预估改动文件：** 4-6 个

| 步骤 | 文件 | 改动 |
|------|------|------|
| B1 | `docker/plugin/prismer-workspace/src/tools.ts` | 新增 update_tasks tool 定义 + 实现 |
| B2 | `docker/plugin/prismer-workspace/src/tools.ts` | 新增 request_user_confirmation tool 定义 + 实现 |
| B3 | `docker/plugin/prismer-workspace/index.ts` | 注册新 tools |
| B4 | `src/app/workspace/stores/syncActions.ts` | directive → store 映射 (UPDATE_TASKS, REQUEST_CONFIRMATION) |
| B5 | `src/app/workspace/hooks/useDirectiveStream.ts` | 新增 directive type 映射 |
| B6 | `docker/plugin/prismer-workspace/version.ts` | 版本升级 → v0.8.0 |

### Phase C — 状态快照与恢复 (P1)

**范围：** F5 (状态恢复)
**预估改动文件：** 6-8 个

| 步骤 | 文件 | 改动 |
|------|------|------|
| C1 | `src/app/workspace/stores/timelineStore.ts` | 快照自动捕获 + restoreSnapshot 完整实现 |
| C2 | `src/app/workspace/stores/chatStore.ts` | restoreToMessageIndex, visibleMessageBound |
| C3 | `src/app/workspace/stores/layoutStore.ts` | restoreLayout action |
| C4 | `src/app/workspace/stores/componentStore.ts` | 批量恢复 componentStates |
| C5 | `src/app/workspace/components/WorkspaceChat/MessageList.tsx` | 历史查看模式 (灰化 + banner) |
| C6 | `src/app/workspace/components/Timeline/index.tsx` | 点击事件 → restoreSnapshot 触发 |

### Phase D — 分支覆盖 + 操作状态 (P2)

**范围：** F6 (分支覆盖) + F7 (操作状态)
**预估改动文件：** 8-10 个

| 步骤 | 文件 | 改动 |
|------|------|------|
| D1 | `src/app/workspace/stores/timelineStore.ts` | checkBranchOverwrite, executeBranchOverwrite |
| D2 | `src/app/workspace/stores/chatStore.ts` | truncateAfter, 覆盖确认逻辑 |
| D3 | `src/app/workspace/components/WorkspaceChat/ChatInput.tsx` | 历���点位发送时触发覆盖确认 |
| D4 | `src/components/ui/confirm-dialog.tsx` | 覆盖确认 Dialog |
| D5 | `docker/plugin/prismer-workspace/src/tools.ts` | 新增 update_operation_status tool |
| D6 | `docker/plugin/prismer-workspace/src/tools.ts` | 现有 tool 注入 operation_status |
| D7 | `src/lib/sync/componentStateConfig.ts` | 每个组件增加 operationStatus 字段 |
| D8 | `src/app/workspace/components/WindowViewer/OperationStatusBar.tsx` | 新建 — 操作状态条组件 |

---

## 6. 验证计划

### 6.1 Phase 0 验证 — 回归测试 (VLA 综述场景)

```bash
# 验证文件一致性修复
# 步骤:
# 1. 新建 workspace
# 2. 发送 "帮我写一个 VLA 模型的综述"
# 3. 验证:
#    - LaTeX 编辑器左侧有 main.tex 文件
#    - PDF 在右侧渲染
#    - # 文件选择器有 latex/main.tex
#    - Assets 有新 collection + PDF
```

### 6.2 新增测试场景

| 层级 | 场景 | 验证内容 |
|------|------|---------|
| Unit | FILE_SYNC_TRIGGERS | 所有 directive 类型 → 正确触发 file sync |
| Unit | Tool 删除回归 | 确认 update_latex/latex_compile 已移除，现有功能无影响 |
| Unit | ThinkingPanel 渲染 | thinking blocks 流式展示, tool call 列表, 折叠/展开 |
| Unit | restoreSnapshot | 快照捕获→恢复→状态一致性 |
| Unit | checkBranchOverwrite | 覆盖检测 + 截断逻辑 |
| L1 | Directive file sync | 发送 UPDATE_LATEX_PROJECT directive → WorkspaceFile DB 有记录 |
| L1 | Compile artifact sync | 发送 LATEX_PROJECT_COMPILE_COMPLETE → S3 有 PDF + Asset 创建 |
| L2 | T4: Thinking Flow | 注入 thinking SSE → Panel 渲染 + 流式动画 |
| L2 | T5: Task Update Flow | 注入 UPDATE_TASKS directive → TaskPanel 状态更新 |
| L2 | T6: Timeline Restore | 创建 3 个 timeline 事件 → 点击第 1 个 → 状态恢复验证 |
| L2 | T7: Branch Overwrite | 恢复到历史 → 发送新消息 → 确认覆盖 → 后续事件清除 |
| L2 | T8: Operation Status | 注入 OPERATION_STATUS → StatusBar 渲染 + 自动消失 |
| L1 | Plugin Tools | update_tasks/request_confirmation/update_operation_status 协议验证 |
| L3 | VLA 综述回归 | 真实 agent "写 VLA 综述" → 全流程验证 |

### 6.3 命令

```bash
# Phase 0 回归
npx playwright test tests/layer1/file-sync.spec.ts --trace on
npx playwright test tests/layer1/directive-triggers.spec.ts --trace on

# Phase A-D 新增测试
npm run test:unit
npx playwright test tests/layer2/t4-thinking.spec.ts --trace on
npx playwright test tests/layer2/t5-tasks.spec.ts --trace on
npx playwright test tests/layer2/t6-timeline-restore.spec.ts --trace on
npx playwright test tests/layer2/t7-branch-overwrite.spec.ts --trace on
npx playwright test tests/layer2/t8-operation-status.spec.ts --trace on
```

---

## 7. 风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Tool 删除破坏现有 Agent Prompt | 已有 agent config 引用 update_latex/latex_compile | 在 SKILL.md 和 system prompt 中移除引用；保留函数但不注册 |
| SSE 连接稳定性 | F1/F4 依赖流式推送 | 降级到 polling + 重连策略 |
| WorkspaceFile DB 写入性能 | 大量文件 sync 阻塞 directive 处理 | fire-and-forget async；批量 upsert |
| 快照数据量过大 | F5 性能问题 | 差异快照 + maxItems=100 + LRU 淘汰 |
| 文件恢复一致性 | F6 容器文件与前端不同步 | 恢复时显式调用 sync_files_to_workspace |
| Plugin 版本兼容 | 新 tool 与旧容器不兼容 | 工具可选化, 缺失时降级 |
| OpenClaw thinking 格式 | 不同 LLM provider 格式不一 | 在 Bridge 层做格式标准化 |
| Timeline 事件爆炸 | 频繁操作产生过多事件 | 合并同类事件 (debounce 500ms), max 1000 |
| 编辑器 DB 刷新闪烁 | directive → DB write → 编辑器 reload 可能闪烁 | 先对比 contentHash，内容相同时跳过 reload |

---

## 8. 版本规划

| 阶段 | Plugin 版本 | 暴露 Tool 数 | 关键变更 |
|------|------------|-------------|---------|
| 当前 | v0.6.0 | 28 | — |
| Phase 0 | v0.7.0 | 24 (-4: 删除 2 + 内部化 2) | 文件一致性修复, Tool 重构 |
| Phase A | v0.7.0 (不变) | 24 | Bridge SSE, Thinking 展示, Timeline 自动记录 |
| Phase B | v0.8.0 | 27 (+3) | update_tasks, request_confirmation, update_operation_status |
| Phase D | v0.8.x | 28 (+1 可选) | add_timeline_marker |

---

## 9. 改进后预期体验

### "帮我写一个 VLA 综述" — 改进后时间轴

```
T=0s   用户发送消息
       ├─ Bridge SSE 连接建立
       └─ 前端开始接收事件流

T=1s   ← SSE event: thinking
       │  "Let me plan a survey on Vision-Language-Action models..."
       └─ AgentThinkingPanel 展示推理过程

T=3s   ← SSE event: tool_start {name: "update_tasks"}
       │  TaskPanel 展开，显示:
       │    ☐ 1. 收集 VLA 相关论文
       │    ☐ 2. 设计论文大纲
       │    ☐ 3. 撰写 LaTeX 内容
       │    ☐ 4. 编译 PDF
       └─ Timeline 记录: "Agent: 创建任务计划"

T=5s   ← SSE event: tool_start {name: "context_search"}
       │  ThinkingPanel: "◆ Using tool: context_search"
       └─ TaskPanel: ☑ 1. 收集 VLA 相关论文 (running)

T=15s  ← SSE event: tool_start {name: "latex_project", args: {action: "write"}}
       │  ThinkingPanel: "◆ Writing main.tex..."
       │  ← Directive SSE: UPDATE_LATEX_PROJECT → DB sync → 编辑器显示内容
       │  ← Directive SSE: SWITCH_COMPONENT → 切换到 latex-editor
       └─ Timeline 记录: "Agent: 写入 main.tex"

T=25s  ← SSE event: tool_start {name: "latex_project_compile"}
       │  ThinkingPanel: "◆ Compiling LaTeX..."
       │  OperationStatusBar: "Compiling (pdflatex pass 1/2)..."
       │  ← Directive SSE: LATEX_PROJECT_COMPILE_COMPLETE → PDF 渲染 + S3 上传 + Asset
       └─ Timeline 记录: "Agent: 编译 PDF"

T=30s  ← SSE event: message_complete
       │  Agent 最终回复: "已完成 VLA 综述..."
       │  TaskPanel: 所有任务 ✅
       │  ThinkingPanel 收起
       │  # 文件选择器: latex/main.tex ✅
       └─ Assets: collection + PDF ✅
```
