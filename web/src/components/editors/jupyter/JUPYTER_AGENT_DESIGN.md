# Jupyter Agent 集成设计文档

## 概述

本文档描述如何在 React 前端实现与远程 Jupyter Server 的通信，并集成 AI Agent 来控制 Notebook 的执行流程。

### 设计原则

1. **MVP 优先** - 先验证核心概念，再扩展功能
2. **复用优先** - 优先使用成熟库（@datalayer/jupyter-react），避免重复造轮子
3. **简单优先** - 单一 Store + Slice Pattern，避免复杂的跨 Store 订阅
4. **安全优先** - 默认交互模式，Agent 生成代码需用户确认执行

## 目录

1. [架构设计](#1-架构设计)
2. [Jupyter Server 通信协议](#2-jupyter-server-通信协议)
3. [Cell 类型设计](#3-cell-类型设计)
4. [Agent 交互流程](#4-agent-交互流程)
5. [组件设计](#5-组件设计)
6. [状态管理](#6-状态管理)
7. [Agent 上下文工程](#7-agent-上下文工程)
8. [产物管理](#8-产物管理)
9. [性能优化](#9-性能优化)
10. [安全设计](#10-安全设计)
11. [实现计划](#11-实现计划)
12. [API 设计](#12-api-设计)
13. [依赖](#13-依赖)
14. [参考资料](#14-参考资料)

---

## 1. 架构设计

### 1.1 系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           React Frontend                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    @datalayer/jupyter-react                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐│ │
│  │  │ Cell UI  │  │ Editor   │  │ Output   │  │ Kernel Connection   ││ │
│  │  │ 组件     │  │ (Monaco) │  │ Renderer │  │ (@jupyterlab/services)│ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐  │
│  │                    Custom Extensions                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │  │
│  │  │ Query Cell   │  │ Agent Cell   │  │ Agent Orchestrator       │ │  │
│  │  │ (用户输入)    │  │ (AI 回复)    │  │ (LLM 调用 + 工具执行)    │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │  │
│  └─────────────────────────────────┼─────────────────────────────────┘  │
│                                    │                                     │
│                    ┌───────────────┴───────────────┐                    │
│                    │      NotebookStore (Zustand)  │                    │
│                    │  ┌─────────┬─────────┬──────┐ │                    │
│                    │  │ cells   │execution│agent │ │ (Slice Pattern)   │
│                    │  └─────────┴─────────┴──────┘ │                    │
│                    └───────────────┬───────────────┘                    │
│                                    │                                     │
│                           ┌────────┴────────┐                           │
│                           │   Event Bus     │ (避免循环订阅)             │
│                           └────────┬────────┘                           │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
    ┌───────────┐           ┌───────────────┐           ┌───────────────┐
    │  LLM API  │           │ Jupyter Server │           │  Storage API  │
    │ (Claude等) │           │ (REST + WS)   │           │  (S3/DB)      │
    └───────────┘           └───────┬───────┘           └───────────────┘
                                    │
                            ┌───────┴───────┐
                            │    Kernel     │ (Docker 隔离)
                            │ (Python/R/...) │
                            └───────────────┘
```

### 1.2 核心模块

| 模块 | 职责 | 实现方式 |
|------|------|----------|
| **Cell UI** | 代码编辑、输出渲染 | 复用 @datalayer/jupyter-react |
| **JupyterService** | Kernel 生命周期、代码执行 | 复用 @jupyterlab/services |
| **AgentOrchestrator** | Agent 决策、工具调用、执行控制 | 自定义实现 |
| **NotebookStore** | 统一状态管理（cells + execution + agent） | Zustand + Slice Pattern |
| **EventBus** | 模块间通信，避免循环依赖 | mitt 或自定义 |

### 1.3 技术选型决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Jupyter 集成 | @datalayer/jupyter-react | 避免重复造轮子，节省 50%+ 开发量 |
| 状态管理 | 单一 Zustand Store | 避免多 Store 循环订阅，使用 Slice 保持逻辑分离 |
| 代码编辑器 | Monaco（库内置） | 已由 jupyter-react 集成 |
| DataFrame 渲染 | AG Grid | 支持行虚拟化，已有集成 |
| Agent 模式 | 默认交互模式 | 安全第一，自主模式需显式开启 |

---

## 2. Jupyter Server 通信协议

### 2.1 REST API

Jupyter Server 提供 REST API 用于管理 Kernel 生命周期：

```typescript
// Kernel 管理 API
interface JupyterRestAPI {
  // 获取可用的 Kernel 类型
  getKernelSpecs(): Promise<KernelSpecs>;
  // GET /api/kernelspecs
  
  // 列出运行中的 Kernels
  listKernels(): Promise<Kernel[]>;
  // GET /api/kernels
  
  // 启动新 Kernel
  startKernel(name: string): Promise<Kernel>;
  // POST /api/kernels { name: "python3" }
  
  // 关闭 Kernel
  shutdownKernel(kernelId: string): Promise<void>;
  // DELETE /api/kernels/{kernel_id}
  
  // 中断执行
  interruptKernel(kernelId: string): Promise<void>;
  // POST /api/kernels/{kernel_id}/interrupt
  
  // 重启 Kernel
  restartKernel(kernelId: string): Promise<void>;
  // POST /api/kernels/{kernel_id}/restart
}
```

### 2.2 WebSocket 消息协议

Kernel 通信通过 WebSocket 进行，使用多路复用的消息通道：

```
WebSocket URL: ws://{host}/api/kernels/{kernel_id}/channels
```

#### 消息通道

| 通道 | 方向 | 用途 |
|------|------|------|
| `shell` | 双向 | 执行请求和回复 |
| `iopub` | Kernel → Client | 输出、状态更新 |
| `stdin` | 双向 | 交互式输入 |
| `control` | 双向 | 控制命令（中断、关机） |

#### 消息格式

```typescript
interface JupyterMessage {
  header: {
    msg_id: string;      // 消息唯一 ID
    msg_type: string;    // 消息类型
    session: string;     // 会话 ID
    username: string;
    date: string;
    version: string;     // 协议版本
  };
  parent_header: {};     // 父消息的 header
  metadata: {};
  content: {};           // 消息内容
  buffers: [];           // 二进制数据（图片等）
  channel: string;       // shell | iopub | stdin | control
}
```

#### 主要消息类型

**执行请求 (shell)**
```typescript
// execute_request
{
  msg_type: "execute_request",
  content: {
    code: "print('Hello')",
    silent: false,
    store_history: true,
    user_expressions: {},
    allow_stdin: true,
    stop_on_error: true
  }
}
```

**执行回复 (shell)**
```typescript
// execute_reply
{
  msg_type: "execute_reply",
  content: {
    status: "ok" | "error" | "aborted",
    execution_count: 1,
    // 如果 error:
    ename?: string,
    evalue?: string,
    traceback?: string[]
  }
}
```

**输出消息 (iopub)**
```typescript
// stream - 标准输出/错误
{
  msg_type: "stream",
  content: {
    name: "stdout" | "stderr",
    text: "Hello\n"
  }
}

// execute_result - 表达式结果
{
  msg_type: "execute_result",
  content: {
    execution_count: 1,
    data: {
      "text/plain": "42",
      "text/html": "<b>42</b>"
    },
    metadata: {}
  }
}

// display_data - 显示数据（图片、HTML 等）
{
  msg_type: "display_data",
  content: {
    data: {
      "image/png": "base64...",
      "text/plain": "<Figure>"
    },
    metadata: {}
  }
}

// error - 执行错误
{
  msg_type: "error",
  content: {
    ename: "NameError",
    evalue: "name 'x' is not defined",
    traceback: ["..."]
  }
}

// status - Kernel 状态
{
  msg_type: "status",
  content: {
    execution_state: "busy" | "idle" | "starting"
  }
}
```

### 2.3 使用 @jupyterlab/services

推荐使用官方库简化通信：

```typescript
import {
  KernelManager,
  ServerConnection,
  Kernel
} from '@jupyterlab/services';

// 配置连接
const serverSettings = ServerConnection.makeSettings({
  baseUrl: 'http://localhost:8888',
  token: 'your-token-here',
  wsUrl: 'ws://localhost:8888'
});

// 创建 Kernel 管理器
const kernelManager = new KernelManager({ serverSettings });

// 启动 Kernel
const kernel = await kernelManager.startNew({ name: 'python3' });

// 执行代码
const future = kernel.requestExecute({ code: 'print("Hello")' });

// 处理输出
future.onIOPub = (msg) => {
  if (msg.header.msg_type === 'stream') {
    console.log(msg.content.text);
  }
};

// 等待完成
await future.done;
```

---

## 3. Cell 类型设计

### 3.1 Cell 类型定义

```typescript
// 基础 Cell 接口
interface BaseCell {
  id: string;
  type: CellType;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

type CellType = 
  | 'query'      // 用户提问
  | 'agent'      // AI 回复（Markdown）
  | 'code'       // 代码
  | 'output';    // 输出（可能合并到 code）

// 用户查询 Cell
interface QueryCell extends BaseCell {
  type: 'query';
  content: string;           // 用户的问题
  attachments?: Attachment[]; // 附件（图片、文件等）
}

// Agent 回复 Cell
interface AgentCell extends BaseCell {
  type: 'agent';
  content: string;           // Markdown 内容
  thinking?: string;         // 思考过程（可选展示）
  suggestedCode?: string;    // 建议的代码（用户可选择插入）
  status: 'pending' | 'streaming' | 'complete' | 'error';
}

// 代码 Cell
interface CodeCell extends BaseCell {
  type: 'code';
  source: string;            // 代码内容
  language: string;          // python, r, julia, etc.
  executionCount: number | null;
  executionState: 'idle' | 'queued' | 'running' | 'success' | 'error';
  outputs: Output[];         // 执行输出
  createdBy: 'user' | 'agent'; // 创建者
}

// 输出类型
type Output = 
  | StreamOutput
  | ExecuteResultOutput
  | DisplayDataOutput
  | ErrorOutput;

interface StreamOutput {
  type: 'stream';
  name: 'stdout' | 'stderr';
  text: string;
}

interface ExecuteResultOutput {
  type: 'execute_result';
  executionCount: number;
  data: MimeBundle;
}

interface DisplayDataOutput {
  type: 'display_data';
  data: MimeBundle;
  metadata: Record<string, unknown>;
}

interface ErrorOutput {
  type: 'error';
  ename: string;
  evalue: string;
  traceback: string[];
}

// MIME 数据包
interface MimeBundle {
  'text/plain'?: string;
  'text/html'?: string;
  'text/markdown'?: string;
  'image/png'?: string;
  'image/jpeg'?: string;
  'image/svg+xml'?: string;
  'application/json'?: unknown;
  'application/javascript'?: string;
  // pandas DataFrame 特殊处理
  'application/vnd.dataframe+json'?: DataFrameData;
}
```

### 3.2 Cell 交互流程

```
用户输入 Query
    │
    ▼
┌─────────────────┐
│   Query Cell    │  用户: "帮我分析这个 CSV 文件中的销售趋势"
└────────┬────────┘
         │
         ▼ (Agent 处理)
┌─────────────────┐
│   Agent Cell    │  AI: "我来帮你分析销售趋势。首先需要..."
│                 │  [建议代码块]
└────────┬────────┘
         │
         ▼ (用户确认 / Agent 自动)
┌─────────────────┐
│   Code Cell     │  import pandas as pd
│                 │  df = pd.read_csv('sales.csv')
│                 │  df.head()
├─────────────────┤
│   [Outputs]     │  [DataFrame 预览表格]
└────────┬────────┘
         │
         ▼ (继续分析)
┌─────────────────┐
│   Code Cell     │  import matplotlib.pyplot as plt
│                 │  df.plot(x='date', y='sales')
├─────────────────┤
│   [Outputs]     │  [图表显示]
└─────────────────┘
```

---

## 4. Agent 交互流程

### 4.1 Agent 能力

Agent 应具备以下能力：

| 能力 | 描述 |
|------|------|
| **理解上下文** | 读取当前 Notebook 中的所有 Cell（代码、输出、变量） |
| **生成代码** | 根据用户请求生成 Python/R 代码 |
| **执行代码** | 控制 Code Cell 的创建和执行 |
| **解读输出** | 分析执行结果，包括错误、图表、数据 |
| **迭代修复** | 检测错误并自动修复代码 |
| **解释结果** | 用自然语言解释分析结果 |

### 4.2 Agent 决策流程

```typescript
interface AgentAction {
  type: 
    | 'respond'          // 直接回复用户
    | 'create_code'      // 创建代码 Cell
    | 'execute_code'     // 执行指定 Cell
    | 'edit_code'        // 修改已有代码
    | 'delete_code'      // 删除 Cell
    | 'request_input'    // 请求用户输入
    | 'complete';        // 任务完成
  
  payload: unknown;
}

// Agent 工具定义 (Function Calling)
const agentTools = [
  {
    name: "create_code_cell",
    description: "Create a new code cell with the given code",
    parameters: {
      code: { type: "string", description: "Python code to execute" },
      insertAfter: { type: "string", description: "Cell ID to insert after" }
    }
  },
  {
    name: "execute_cell",
    description: "Execute a code cell by ID",
    parameters: {
      cellId: { type: "string" }
    }
  },
  {
    name: "get_cell_output",
    description: "Get the output of an executed cell",
    parameters: {
      cellId: { type: "string" }
    }
  },
  {
    name: "get_notebook_context",
    description: "Get current notebook state including variables and outputs",
    parameters: {}
  },
  {
    name: "respond_to_user",
    description: "Send a markdown response to the user",
    parameters: {
      content: { type: "string", description: "Markdown content" }
    }
  }
];
```

### 4.3 Agent 执行模式

#### 模式一：Interactive Mode（交互模式）

Agent 生成代码建议，用户确认后执行：

```
User Query → Agent 生成代码 → 用户确认 → 执行 → 显示结果
```

#### 模式二：Autonomous Mode（自主模式）

Agent 自动执行代码，遇到错误自动修复：

```
User Query → Agent 生成代码 → 自动执行 → 
  ├─ 成功 → 继续下一步
  └─ 失败 → 分析错误 → 修复代码 → 重新执行
```

### 4.4 上下文构建

为 Agent 构建上下文信息：

```typescript
interface NotebookContext {
  // 当前 Cell 历史
  cells: Array<{
    id: string;
    type: CellType;
    source?: string;
    outputs?: string; // 文本化的输出摘要
  }>;
  
  // 当前 Kernel 变量
  variables: Array<{
    name: string;
    type: string;
    shape?: string;  // 对于 DataFrame/Array
    preview?: string; // 前几行预览
  }>;
  
  // 已导入的库
  imports: string[];
  
  // 最近的错误
  lastError?: {
    ename: string;
    evalue: string;
    traceback: string;
  };
}
```

---

## 5. 组件设计

### 5.1 组件层次

```
JupyterNotebook
├── NotebookToolbar
│   ├── KernelSelector
│   ├── KernelStatus
│   ├── RunAllButton
│   └── AgentModeToggle
├── CellList
│   ├── QueryCell
│   ├── AgentCell
│   ├── CodeCell
│   │   ├── CodeEditor (Monaco)
│   │   ├── CellToolbar
│   │   └── OutputArea
│   │       ├── StreamOutput
│   │       ├── RichOutput
│   │       │   ├── HTMLRenderer
│   │       │   ├── ImageRenderer
│   │       │   ├── DataFrameRenderer
│   │       │   ├── PlotRenderer
│   │       │   └── JSONRenderer
│   │       └── ErrorOutput
│   └── AddCellButton
└── QueryInput
    ├── TextArea
    ├── AttachmentButton
    └── SendButton
```

### 5.2 核心组件接口

```typescript
// JupyterNotebook 主组件
interface JupyterNotebookProps {
  // Jupyter Server 配置
  serverUrl: string;
  token?: string;
  
  // 初始 Notebook（可选）
  initialNotebook?: NotebookDocument;
  
  // Agent 配置
  agentConfig?: {
    enabled: boolean;
    mode: 'interactive' | 'autonomous';
    llmProvider: 'openai' | 'anthropic' | 'custom';
    apiKey?: string;
  };
  
  // 回调
  onNotebookChange?: (notebook: NotebookDocument) => void;
  onKernelStatusChange?: (status: KernelStatus) => void;
  
  // 样式
  className?: string;
  theme?: 'light' | 'dark';
}

// CodeCell 组件
interface CodeCellProps {
  cell: CodeCell;
  isActive: boolean;
  
  onExecute: () => void;
  onSourceChange: (source: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

// OutputArea 组件
interface OutputAreaProps {
  outputs: Output[];
  isExecuting: boolean;
  executionCount: number | null;
}

// QueryInput 组件
interface QueryInputProps {
  onSubmit: (query: string, attachments?: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
}
```

### 5.3 输出渲染器

根据 MIME 类型选择渲染器：

```typescript
const mimeRenderers: Record<string, React.ComponentType<{ data: unknown }>> = {
  'text/plain': TextRenderer,
  'text/html': HTMLRenderer,
  'text/markdown': MarkdownRenderer,
  'image/png': ImageRenderer,
  'image/jpeg': ImageRenderer,
  'image/svg+xml': SVGRenderer,
  'application/json': JSONRenderer,
  'application/vnd.plotly.v1+json': PlotlyRenderer,
  'application/vnd.dataframe+json': DataFrameRenderer,
};

// DataFrame 渲染器示例
function DataFrameRenderer({ data }: { data: DataFrameData }) {
  return (
    <div className="overflow-auto max-h-96">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            {data.columns.map(col => (
              <th key={col} className="border px-2 py-1 bg-slate-100">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.data.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border px-2 py-1">
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.truncated && (
        <div className="text-sm text-slate-500 mt-2">
          Showing {data.data.length} of {data.totalRows} rows
        </div>
      )}
    </div>
  );
}
```

---

## 6. 状态管理

### 6.1 设计原则

**问题分析**：多 Store 互相订阅会导致循环更新和内存泄漏。

**解决方案**：
1. **单一 Store + Slice Pattern** - 逻辑分离但物理合并，避免跨 Store 订阅
2. **事件总线** - 模块间通信使用事件，Store 只订阅事件不互相订阅
3. **状态机** - WebSocket 消息处理使用状态机，处理乱序和重复消息

### 6.2 统一 Store 架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      NotebookStore (单一 Store)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ cellsSlice   │  │executionSlice│  │ agentSlice   │  │artifactSlice │ │
│  │              │  │              │  │              │  │              │ │
│  │ • cells[]    │  │ • kernelId   │  │ • status     │  │ • artifacts[]│ │
│  │ • metadata   │  │ • status     │  │ • mode       │  │ • byCell{}   │ │
│  │ • activeId   │  │ • queue[]    │  │ • context    │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        Shared Actions                              │  │
│  │  executeCell() → 更新 execution + cells + artifacts                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ emit/on
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           EventBus (mitt)                                │
│  • cell:executed   • kernel:status   • agent:action   • output:received │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 统一 Store 实现（Slice Pattern）

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import mitt from 'mitt';

// ============ 事件总线 ============
type Events = {
  'cell:executed': { cellId: string; success: boolean };
  'kernel:status': { status: KernelStatus };
  'output:received': { cellId: string; output: Output };
  'agent:action': { action: AgentAction };
};

export const eventBus = mitt<Events>();

// ============ Slice 定义 ============

// Cells Slice
interface CellsSlice {
  cells: Cell[];
  activeCellId: string | null;
  metadata: NotebookMetadata;
  
  addCell: (cell: Cell, afterId?: string) => string;
  updateCell: (id: string, updates: Partial<Cell>) => void;
  deleteCell: (id: string) => void;
  appendOutput: (id: string, output: Output) => void;
}

// Execution Slice
interface ExecutionSlice {
  kernelId: string | null;
  kernelStatus: KernelStatus;
  executionQueue: string[];  // Cell IDs
  currentCellId: string | null;
  
  // 变量只存元信息，详情按需获取
  variablesMeta: Array<{ name: string; type: string; shape?: string }>;
  
  setKernelStatus: (status: KernelStatus) => void;
  queueExecution: (cellId: string) => void;
  dequeueExecution: () => string | undefined;
}

// Agent Slice
interface AgentSlice {
  agentStatus: AgentStatus;
  agentMode: AgentMode;  // 默认 'interactive'
  conversationHistory: ConversationTurn[];
  contextDirty: boolean;  // 脏标记，用于增量更新
  
  setAgentStatus: (status: AgentStatus) => void;
  markContextDirty: () => void;
}

// Artifact Slice（简化版）
interface ArtifactSlice {
  // 只追踪主流 MIME 类型：image, dataframe, plotly
  artifacts: Array<{
    id: string;
    cellId: string;
    type: 'image' | 'dataframe' | 'chart';
    thumbnail?: string;  // 缩略图，用于上下文
  }>;
  
  registerArtifact: (artifact: ArtifactSlice['artifacts'][0]) => void;
}

// ============ 合并 Store ============

type NotebookStore = CellsSlice & ExecutionSlice & AgentSlice & ArtifactSlice;

export const useNotebookStore = create<NotebookStore>()(
  immer((set, get) => ({
    // === Cells Slice ===
    cells: [],
    activeCellId: null,
    metadata: {},
    
    addCell: (cell, afterId) => {
      const id = cell.id || crypto.randomUUID();
      set(state => {
        const index = afterId 
          ? state.cells.findIndex(c => c.id === afterId) + 1
          : state.cells.length;
        state.cells.splice(index, 0, { ...cell, id });
      });
      return id;
    },
    
    updateCell: (id, updates) => {
      set(state => {
        const cell = state.cells.find(c => c.id === id);
        if (cell) Object.assign(cell, updates);
      });
      // 标记上下文需要更新
      get().markContextDirty();
    },
    
    deleteCell: (id) => {
      set(state => {
        state.cells = state.cells.filter(c => c.id !== id);
      });
    },
    
    appendOutput: (id, output) => {
      set(state => {
        const cell = state.cells.find(c => c.id === id);
        if (cell && cell.type === 'code') {
          cell.outputs = [...(cell.outputs || []), output];
        }
      });
    },
    
    // === Execution Slice ===
    kernelId: null,
    kernelStatus: 'disconnected',
    executionQueue: [],
    currentCellId: null,
    variablesMeta: [],
    
    setKernelStatus: (status) => {
      set({ kernelStatus: status });
      eventBus.emit('kernel:status', { status });
    },
    
    queueExecution: (cellId) => {
      set(state => {
        state.executionQueue.push(cellId);
      });
    },
    
    dequeueExecution: () => {
      const queue = get().executionQueue;
      if (queue.length === 0) return undefined;
      const cellId = queue[0];
      set(state => {
        state.executionQueue = state.executionQueue.slice(1);
        state.currentCellId = cellId;
      });
      return cellId;
    },
    
    // === Agent Slice ===
    agentStatus: 'idle',
    agentMode: 'interactive',  // 默认交互模式（安全）
    conversationHistory: [],
    contextDirty: false,
    
    setAgentStatus: (status) => set({ agentStatus: status }),
    markContextDirty: () => set({ contextDirty: true }),
    
    // === Artifact Slice ===
    artifacts: [],
    
    registerArtifact: (artifact) => {
      set(state => {
        state.artifacts.push(artifact);
      });
    },
  }))
);
```

### 6.4 WebSocket 执行状态机

**问题**：Jupyter 消息可能乱序、重复，需要状态机追踪执行状态。

```typescript
type ExecutionState = 
  | 'idle'        // 空闲
  | 'pending'     // 已发送请求，等待 busy
  | 'busy'        // 正在执行
  | 'completing'; // 收到 idle，等待 execute_reply

interface ExecutionStateMachine {
  state: ExecutionState;
  cellId: string | null;
  msgId: string | null;
  outputs: Output[];
  
  transition(event: StateMachineEvent): void;
}

type StateMachineEvent =
  | { type: 'EXECUTE_REQUEST'; cellId: string; msgId: string }
  | { type: 'STATUS_BUSY' }
  | { type: 'OUTPUT'; output: Output }
  | { type: 'STATUS_IDLE' }
  | { type: 'EXECUTE_REPLY'; status: 'ok' | 'error' }
  | { type: 'TIMEOUT' }
  | { type: 'INTERRUPT' };

class CellExecutionStateMachine implements ExecutionStateMachine {
  state: ExecutionState = 'idle';
  cellId: string | null = null;
  msgId: string | null = null;
  outputs: Output[] = [];
  
  private store = useNotebookStore.getState();
  
  transition(event: StateMachineEvent): void {
    switch (this.state) {
      case 'idle':
        if (event.type === 'EXECUTE_REQUEST') {
          this.state = 'pending';
          this.cellId = event.cellId;
          this.msgId = event.msgId;
          this.outputs = [];
        }
        break;
        
      case 'pending':
        if (event.type === 'STATUS_BUSY') {
          this.state = 'busy';
        } else if (event.type === 'TIMEOUT') {
          this.handleError('Execution timeout');
          this.reset();
        }
        break;
        
      case 'busy':
        if (event.type === 'OUTPUT') {
          // 只在 busy 状态接受输出
          this.outputs.push(event.output);
          this.store.appendOutput(this.cellId!, event.output);
        } else if (event.type === 'STATUS_IDLE') {
          this.state = 'completing';
        } else if (event.type === 'INTERRUPT') {
          this.handleInterrupt();
          this.reset();
        }
        break;
        
      case 'completing':
        if (event.type === 'EXECUTE_REPLY') {
          // 执行完成
          this.store.updateCell(this.cellId!, {
            executionState: event.status === 'ok' ? 'success' : 'error',
          });
          eventBus.emit('cell:executed', { 
            cellId: this.cellId!, 
            success: event.status === 'ok' 
          });
          this.reset();
        }
        break;
    }
  }
  
  private reset(): void {
    this.state = 'idle';
    this.cellId = null;
    this.msgId = null;
    this.outputs = [];
  }
  
  private handleError(message: string): void {
    if (this.cellId) {
      this.store.updateCell(this.cellId, { executionState: 'error' });
    }
  }
  
  private handleInterrupt(): void {
    if (this.cellId) {
      this.store.updateCell(this.cellId, { executionState: 'idle' });
    }
  }
}
```

### 6.5 变量同步优化

**问题**：每次执行后全量同步变量太慢，大 DataFrame 的 `head()` 很慢。

**方案**：只同步元信息（name, type, shape），详情按需获取。

```typescript
// 轻量级变量同步 - 只获取元信息
const VARIABLE_META_CODE = `
import json
result = []
for name, val in list(globals().items()):
    if not name.startswith('_') and not callable(val):
        info = {'name': name, 'type': type(val).__name__}
        if hasattr(val, 'shape'):
            info['shape'] = str(val.shape)
        elif hasattr(val, '__len__'):
            try: info['len'] = len(val)
            except: pass
        result.append(info)
print(json.dumps(result))
`;

// 按需获取变量详情（Agent 工具调用时）
async function getVariableDetails(varName: string): Promise<VariableDetails> {
  const code = `
import json
val = ${varName}
result = {'name': '${varName}', 'type': type(val).__name__}
if hasattr(val, 'head'):
    result['preview'] = val.head(5).to_string()
elif hasattr(val, '__repr__'):
    result['preview'] = repr(val)[:500]
print(json.dumps(result))
`;
  // 执行并返回结果
  return executeAndParse(code);
}
```
```

---

## 7. Agent 上下文工程

### 7.1 设计原则

**问题**：100 个 Cell 时每次遍历构建上下文太慢。

**方案**：
1. **分层摘要** - 最近 5 个 Cell 完整，其余只摘要
2. **增量更新 + 脏标记** - 只更新变化部分
3. **防抖** - 快速连续变化时合并更新
4. **图片只传 thumbnail** - 需要完整图片时按需加载

### 7.2 分层上下文策略

```typescript
interface ContextStrategy {
  // 第一层：完整包含（最近 N 个 Cell）
  fullContextCellCount: 5,
  
  // 第二层：摘要（其余 Cell）
  summaryMaxLength: 200,  // 每个 Cell 摘要最大字符数
  
  // 图片处理
  imageThumbnailSize: 256,  // 缩略图尺寸
  includeFullImage: false,  // 默认不包含完整图片
  
  // 变量处理
  variableMetaOnly: true,   // 只包含元信息
  
  // 输出处理
  outputMaxLines: 20,       // 输出最多包含行数
  truncateDataFrame: 5,     // DataFrame 只显示前 5 行
}

/**
 * 构建分层上下文
 */
function buildLayeredContext(
  cells: Cell[],
  strategy: ContextStrategy
): CompiledContext {
  const recentCells = cells.slice(-strategy.fullContextCellCount);
  const olderCells = cells.slice(0, -strategy.fullContextCellCount);
  
  return {
    // 最近的 Cell 完整包含
    recentCells: recentCells.map(c => ({
      id: c.id,
      type: c.type,
      content: c.type === 'code' ? c.source : c.content,
      output: c.type === 'code' 
        ? truncateOutput(c.outputs, strategy.outputMaxLines)
        : undefined,
    })),
    
    // 较早的 Cell 只包含摘要
    olderCellsSummary: olderCells.map(c => ({
      id: c.id,
      type: c.type,
      summary: summarize(c, strategy.summaryMaxLength),
      hasError: c.type === 'code' && c.executionState === 'error',
    })),
    
    // 变量只包含元信息
    variables: getVariablesMeta(),
    
    // 图片只包含缩略图
    images: getImageThumbnails(),
  };
}
```

### 7.3 增量更新机制

```typescript
class IncrementalContextBuilder {
  private cache: CompiledContext | null = null;
  private cellVersions: Map<string, number> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  
  /**
   * 标记需要更新
   */
  markDirty(cellId?: string): void {
    if (cellId) {
      const version = this.cellVersions.get(cellId) || 0;
      this.cellVersions.set(cellId, version + 1);
    }
    
    // 防抖：100ms 内的多次调用合并
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.rebuildContext();
    }, 100);
  }
  
  /**
   * 增量重建上下文
   */
  private rebuildContext(): void {
    const store = useNotebookStore.getState();
    const cells = store.cells;
    
    if (!this.cache) {
      // 首次构建
      this.cache = buildLayeredContext(cells, DEFAULT_STRATEGY);
      return;
    }
    
    // 增量更新：只更新变化的 Cell
    for (const cell of cells) {
      const cachedVersion = this.cellVersions.get(cell.id);
      if (cachedVersion) {
        this.updateCellInContext(cell);
        this.cellVersions.delete(cell.id);
      }
    }
  }
  
  /**
   * 获取当前上下文
   */
  getContext(): CompiledContext {
    if (!this.cache || useNotebookStore.getState().contextDirty) {
      this.rebuildContext();
      useNotebookStore.setState({ contextDirty: false });
    }
    return this.cache!;
  }
}
```

### 7.4 多模态内容处理

```typescript
/**
 * 图片处理：生成缩略图，按需加载完整图片
 */
function processImageForContext(
  imageData: string,
  mimeType: string
): { thumbnail: string; fullImageRef: string } {
  // 生成缩略图
  const thumbnail = generateThumbnail(imageData, 256);
  
  // 完整图片存储引用，按需加载
  const fullImageRef = storeImageTemporarily(imageData);
  
  return { thumbnail, fullImageRef };
}

/**
 * Agent 工具：获取完整图片
 */
const getFullImageTool = {
  name: 'get_full_image',
  description: 'Get full resolution image by reference',
  parameters: {
    imageRef: { type: 'string', required: true }
  },
  execute: async ({ imageRef }) => {
    return loadImageFromRef(imageRef);
  }
};
```

---

## 8. 产物管理

### 8.1 简化设计

**原则**：
1. 只自动检测主流 MIME 类型（image、dataframe、plotly）
2. 其余输出统一作为富文本展示，不单独管理
3. 持久化默认手动触发，大文件（>5MB）不自动上传

### 8.2 简化的产物类型

```typescript
// 只追踪主流类型
type ArtifactType = 'image' | 'dataframe' | 'chart';

interface Artifact {
  id: string;
  type: ArtifactType;
  cellId: string;
  createdAt: string;
  
  // 缩略图/预览（用于上下文和 UI）
  thumbnail?: string;
  preview?: unknown;  // DataFrame 前几行
  
  // 存储状态
  status: 'memory' | 'persisted';
  storageUrl?: string;
}

// 检测产物（只检测主流 MIME）
function detectArtifacts(data: MimeBundle, cellId: string): Artifact[] {
  const artifacts: Artifact[] = [];
  
  // 图片
  const imageKey = ['image/png', 'image/jpeg', 'image/svg+xml']
    .find(k => data[k]);
  if (imageKey) {
    artifacts.push({
      id: crypto.randomUUID(),
      type: 'image',
      cellId,
      createdAt: new Date().toISOString(),
      thumbnail: generateThumbnail(data[imageKey] as string, 256),
      status: 'memory',
    });
  }
  
  // Plotly 图表
  if (data['application/vnd.plotly.v1+json']) {
    artifacts.push({
      id: crypto.randomUUID(),
      type: 'chart',
      cellId,
      createdAt: new Date().toISOString(),
      status: 'memory',
    });
  }
  
  return artifacts;
}
```

### 8.3 手动持久化

```typescript
// 持久化按钮触发，不自动上传
async function persistArtifact(
  artifactId: string,
  options?: { backend?: 'local' | 's3' }
): Promise<string> {
  const store = useNotebookStore.getState();
  const artifact = store.artifacts.find(a => a.id === artifactId);
  
  if (!artifact) throw new Error('Artifact not found');
  
  // 大文件警告
  const size = estimateSize(artifact);
  if (size > 5 * 1024 * 1024) {
    console.warn('Large artifact, consider manual download');
  }
  
  // 上传到存储后端
  const url = await uploadToStorage(artifact, options?.backend || 'local');
  
  store.updateArtifact(artifactId, { 
    status: 'persisted', 
    storageUrl: url 
  });
  
  return url;
}

// 批量下载（导出 Notebook 时可选）
async function downloadArtifactsAsZip(cellIds?: string[]): Promise<Blob> {
  const store = useNotebookStore.getState();
  const artifacts = cellIds 
    ? store.artifacts.filter(a => cellIds.includes(a.cellId))
    : store.artifacts;
  
  const zip = new JSZip();
  for (const artifact of artifacts) {
    const blob = await getArtifactBlob(artifact);
    zip.file(`${artifact.id}.${getExtension(artifact)}`, blob);
  }
  
  return zip.generateAsync({ type: 'blob' });
}
```

---

## 9. 性能优化

### 9.1 关键优化点

| 问题 | 解决方案 |
|------|----------|
| Cell 列表渲染慢 | `react-virtual` 虚拟化，只渲染可见 Cell |
| Output 流式更新卡顿 | 追加而非整体替换 + 防抖合并 |
| DataFrame 渲染卡顿 | AG Grid 行虚拟化 + 分页（50行/页） |
| 图片加载慢 | 缩略图优先 + 懒加载完整图 |
| 组件重渲染 | `React.memo` + 细粒度 selector |

### 9.2 Output 流式追加

```typescript
// 不要整体替换，只追加新内容
function StreamingOutput({ cellId }: { cellId: string }) {
  const outputsRef = useRef<HTMLDivElement>(null);
  const [buffer, setBuffer] = useState<string[]>([]);
  
  useEffect(() => {
    // 订阅该 Cell 的输出事件
    const unsub = eventBus.on('output:received', ({ cellId: id, output }) => {
      if (id !== cellId) return;
      
      if (output.type === 'stream') {
        // 追加到 buffer，防抖刷新
        setBuffer(prev => [...prev, output.text]);
      }
    });
    
    return unsub;
  }, [cellId]);
  
  // 防抖合并多次快速输出
  const debouncedBuffer = useDebouncedValue(buffer, 50);
  
  return (
    <div ref={outputsRef}>
      {debouncedBuffer.map((text, i) => (
        <pre key={i}>{text}</pre>
      ))}
    </div>
  );
}
```

### 9.3 Cell 虚拟化

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedCellList() {
  const cells = useNotebookStore(state => state.cells);
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: cells.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // 根据 Cell 类型和内容估算高度
      const cell = cells[index];
      return estimateCellHeight(cell);
    },
    overscan: 3,  // 额外渲染 3 个不可见 Cell
  });
  
  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <CellComponent cell={cells[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 10. 安全设计

### 10.1 Agent 安全护栏

**默认交互模式**：Agent 生成的代码必须用户确认才能执行。

```typescript
interface AgentSafetyConfig {
  // 模式
  mode: 'interactive' | 'autonomous';
  
  // 自主模式限制
  autonomous: {
    maxConsecutiveExecutions: 5,   // 最多连续执行 5 次
    maxTotalExecutionTime: 60000,  // 最长执行时间 60 秒
    maxRetries: 3,                  // 错误重试最多 3 次
    
    // 危险操作需确认
    dangerousPatterns: [
      /os\.(remove|unlink|rmdir)/,
      /shutil\.rmtree/,
      /subprocess\.(run|call|Popen)/,
      /eval\s*\(/,
      /exec\s*\(/,
      /__import__/,
    ],
    
    // 需要确认的文件操作
    confirmFileWrite: true,
    confirmNetworkRequest: true,
  }
}

class AgentSafetyGuard {
  private executionCount = 0;
  private startTime = 0;
  private retryCount = 0;
  
  async checkBeforeExecution(code: string): Promise<SafetyCheckResult> {
    const config = this.config.autonomous;
    
    // 检查连续执行次数
    if (this.executionCount >= config.maxConsecutiveExecutions) {
      return { 
        allowed: false, 
        reason: 'Max consecutive executions reached',
        requireConfirmation: true 
      };
    }
    
    // 检查总执行时间
    if (Date.now() - this.startTime > config.maxTotalExecutionTime) {
      return { 
        allowed: false, 
        reason: 'Execution time limit exceeded' 
      };
    }
    
    // 检查危险模式
    for (const pattern of config.dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          allowed: false,
          reason: `Dangerous pattern detected: ${pattern}`,
          requireConfirmation: true,
          showDiff: true,  // 显示代码让用户审核
        };
      }
    }
    
    return { allowed: true };
  }
  
  recordExecution(success: boolean): void {
    this.executionCount++;
    if (!success) {
      this.retryCount++;
      if (this.retryCount >= this.config.autonomous.maxRetries) {
        this.pause('Max retries reached');
      }
    } else {
      this.retryCount = 0;
    }
  }
}
```

### 10.2 输出安全过滤

```typescript
import DOMPurify from 'dompurify';

// HTML 输出过滤
function sanitizeHtmlOutput(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'img', 'svg', 'path',
    ],
    ALLOWED_ATTR: [
      'class', 'style', 'src', 'alt', 'width', 'height',
      'd', 'fill', 'stroke', 'viewBox',  // SVG 属性
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  });
}

// 渲染 HTML 输出
function HtmlOutput({ html }: { html: string }) {
  const sanitized = useMemo(() => sanitizeHtmlOutput(html), [html]);
  
  return (
    <div 
      className="html-output"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
```

### 10.3 Kernel 容器隔离

```yaml
# docker-compose.yml
services:
  jupyter-kernel:
    image: jupyter/scipy-notebook
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp:size=1G
    volumes:
      - ./workspace:/home/jovyan/work:rw
    environment:
      - JUPYTER_ENABLE_LAB=no
```

```python
# Kernel 配置
c.KernelManager.shutdown_wait_time = 30
c.MappingKernelManager.cull_idle_timeout = 600  # 10 分钟空闲自动关闭
c.MappingKernelManager.cull_interval = 60
```

---

## 11. 实现计划

### MVP 优先策略

**核心理念**：先验证概念，再扩展功能。

### Phase 1: MVP 验证

**目标**：验证 Jupyter + Agent 核心交互

```
[ ] 最简 JupyterService
    - 使用 @jupyterlab/services
    - Kernel 连接、执行代码
    
[ ] 单个 CodeCell + 文本输出
    - 复用 @datalayer/jupyter-react
    - 基础 Monaco 编辑器
    
[ ] Agent 只生成代码不执行
    - 交互模式
    - 用户确认后手动执行
```

**验收标准**：能够连接 Kernel、执行代码、显示输出、Agent 能生成代码建议。

### Phase 2: 富输出 + 交互 Agent

```
[ ] 富输出渲染
    - 图片（懒加载）
    - DataFrame（AG Grid，分页）
    - Plotly 图表
    - HTML（DOMPurify 过滤）
    
[ ] Agent 交互模式完善
    - 代码确认对话框
    - 代码 Diff 展示
    - 错误解释
    
[ ] 状态机完善
    - WebSocket 消息处理
    - 执行队列
```

### Phase 3: 自主模式 + 产物管理

```
[ ] Agent 自主模式
    - 安全护栏实现
    - 自动重试（限制 3 次）
    - 危险操作拦截
    
[ ] 产物管理
    - 自动检测（image/dataframe/chart）
    - 手动持久化
    - 导出功能
    
[ ] 上下文优化
    - 分层摘要
    - 增量更新
```

### Phase 4: 高级功能

```
[x] 性能优化
    - Cell 虚拟化 (@tanstack/react-virtual)
    - Output 流式优化（防抖 + 缓冲）
    
[ ] 协作功能
    - 多用户编辑
    
[x] 扩展功能
    - 变量检查器 (VariableInspector)
    - 快捷键 (useKeyboardShortcuts)
```

### Phase 5: Cell 管理、Package 管理与多 Session 支持

#### 5.1 问题分析

**当前 Cell 管理的不足：**
1. 缺少 `moveCell(id, targetIndex)` 方法
2. 缺少 `insertCellAt(cell, index)` 方法
3. 没有拖拽排序功能
4. 没有复制/粘贴 cell 功能
5. 缺少撤销/重做 (undo/redo) 功能
6. Cell 位置变更后 Agent 上下文可能不一致

**Package 管理缺失：**
1. 无法查看 Kernel 中已安装的包
2. 无法安装/卸载/更新包
3. 缺少 requirements.txt 导入/导出
4. 缺少依赖冲突检测

**多 Session 管理缺失：**
1. JupyterService 只维护单个 kernel
2. 无法列出现有 sessions
3. 无法切换或连接到已有 kernel
4. 无法管理多个并行 kernel

#### 5.2 Cell 管理增强

##### 5.2.1 Store 扩展

```typescript
interface CellManagementSlice {
  // 位置操作
  moveCell: (cellId: string, targetIndex: number) => void;
  moveCellUp: (cellId: string) => void;
  moveCellDown: (cellId: string) => void;
  swapCells: (cellId1: string, cellId2: string) => void;
  
  // 批量操作
  insertCellAt: (cell: Cell, index: number) => string;
  insertCellsAt: (cells: Cell[], index: number) => string[];
  deleteCells: (cellIds: string[]) => void;
  
  // 复制/粘贴
  clipboard: Cell | null;
  cutCell: (cellId: string) => void;
  copyCell: (cellId: string) => void;
  pasteCell: (afterId?: string) => string | null;
  duplicateCell: (cellId: string) => string;
  
  // 撤销/重做
  history: CellState[];
  historyIndex: number;
  maxHistorySize: number;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // 选择
  selectedCellIds: Set<string>;
  selectCell: (cellId: string, multi?: boolean) => void;
  selectRange: (startId: string, endId: string) => void;
  clearSelection: () => void;
}

interface CellState {
  cells: Cell[];
  activeCellId: string | null;
  timestamp: number;
}
```

##### 5.2.2 拖拽排序组件

```typescript
// components/DraggableCellList.tsx
interface DraggableCellListProps {
  cells: Cell[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  onSelect: (cellId: string) => void;
  renderCell: (cell: Cell, index: number) => React.ReactNode;
}

// 使用 @dnd-kit/sortable 实现拖拽
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
```

##### 5.2.3 Cell 位置指示器

```typescript
// 在 Cell 之间显示当前位置
interface CellPositionIndicator {
  position: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
}

// UI 显示: [1/5] 或拖拽时高亮目标位置
```

#### 5.3 Package 管理

##### 5.3.1 PackageManager 组件

```typescript
// components/PackageManager.tsx
interface PackageManagerProps {
  jupyterService: JupyterService | null;
  isConnected: boolean;
  onInstall?: (packageName: string) => void;
}

interface InstalledPackage {
  name: string;
  version: string;
  summary?: string;
  location?: string;
  requires?: string[];
  homepage?: string;
}
```

##### 5.3.2 Package 操作

```python
# 获取已安装包的 Python 代码
import pkg_resources
import json

def get_installed_packages():
    packages = []
    for pkg in pkg_resources.working_set:
        packages.append({
            "name": pkg.project_name,
            "version": pkg.version,
            "location": pkg.location,
        })
    return json.dumps(packages)

# 安装包
!pip install <package_name> --quiet

# 卸载包
!pip uninstall <package_name> -y

# 检查更新
!pip list --outdated --format=json
```

##### 5.3.3 PackageManager UI 功能

```
[ ] 已安装包列表（搜索、过滤）
[ ] 安装新包（支持版本指定）
[ ] 卸载包（确认对话框）
[ ] 更新包（单个/全部）
[ ] 导出 requirements.txt
[ ] 导入 requirements.txt
[ ] 显示包详情（版本、依赖、homepage）
[ ] 依赖冲突警告
```

#### 5.4 多 Session 管理

##### 5.4.1 Session 数据结构

```typescript
interface JupyterSession {
  id: string;
  name: string;
  path: string;
  type: 'notebook' | 'console';
  kernel: {
    id: string;
    name: string;
    status: KernelStatus;
    last_activity: string;
    execution_state: string;
    connections: number;
  };
}

interface SessionManagerState {
  sessions: JupyterSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;
}
```

##### 5.4.2 JupyterService 扩展

```typescript
interface IMultiSessionJupyterService {
  // Session 管理
  listSessions(): Promise<JupyterSession[]>;
  getSession(sessionId: string): Promise<JupyterSession | null>;
  createSession(options: CreateSessionOptions): Promise<JupyterSession>;
  deleteSession(sessionId: string): Promise<void>;
  
  // Kernel 管理（多 kernel）
  listKernels(): Promise<KernelInfo[]>;
  connectToKernel(kernelId: string): Promise<void>;
  switchKernel(sessionId: string, kernelName: string): Promise<void>;
  
  // 当前 session
  currentSession: JupyterSession | null;
  setCurrentSession(sessionId: string): Promise<void>;
}

interface CreateSessionOptions {
  name: string;
  path: string;
  type: 'notebook' | 'console';
  kernelName?: string;
}
```

##### 5.4.3 SessionManager 组件

```typescript
// components/SessionManager.tsx
interface SessionManagerProps {
  jupyterService: JupyterService | null;
  isConnected: boolean;
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onSessionCreate: (options: CreateSessionOptions) => void;
  onSessionDelete: (sessionId: string) => void;
}

// UI 功能：
// - Session 列表（活动/空闲状态）
// - 创建新 Session
// - 切换 Session
// - 关闭 Session
// - Kernel 状态显示
// - 重命名 Session
```

##### 5.4.4 Session 切换流程

```
1. 用户选择目标 Session
2. 保存当前 Notebook 状态到本地
3. 断开当前 Kernel WebSocket
4. 连接目标 Session 的 Kernel
5. 加载目标 Session 的 Notebook 状态
6. 刷新 Variable Inspector
7. 更新 Agent 上下文
```

#### 5.5 Cell 类型切换

##### 问题
当前 Cell 无法在 `code` 和 `markdown` 之间切换。

##### 解决方案

```typescript
// Store 扩展
interface CellTypeSlice {
  changeCellType: (cellId: string, newType: 'code' | 'markdown') => void;
}

// 切换逻辑
changeCellType: (cellId, newType) => {
  set((state) => {
    const cell = state.cells.find(c => c.id === cellId);
    if (!cell) return;
    
    if (cell.type === 'code' && newType === 'markdown') {
      // Code → Markdown：保留 source
      (cell as any).type = 'markdown';
      delete (cell as any).outputs;
      delete (cell as any).executionCount;
    } else if (cell.type === 'markdown' && newType === 'code') {
      // Markdown → Code：初始化 outputs
      (cell as any).type = 'code';
      (cell as any).outputs = [];
      (cell as any).executionCount = null;
      (cell as any).executionState = 'idle';
    }
  });
};

// UI：Cell 头部添加类型选择器
<select value={cell.type} onChange={e => changeCellType(cell.id, e.target.value)}>
  <option value="code">Code</option>
  <option value="markdown">Markdown</option>
</select>
```

#### 5.6 产物面板 (Artifacts Panel)

##### 问题
产物（图片、DataFrame、图表）没有独立的展示面板，散落在各个 Cell 输出中。

##### 解决方案

```typescript
// components/ArtifactsPanel.tsx
interface ArtifactsPanelProps {
  artifactManager: ArtifactManager;
  cells: Cell[];
  onArtifactClick: (artifact: Artifact) => void;
  onExport: (artifactIds: string[]) => void;
  onPersist: (artifactId: string) => void;
}

// UI 功能：
// - 按类型分组（Images / DataFrames / Charts / Files）
// - 缩略图预览
// - 点击查看大图/详情
// - 批量导出为 ZIP
// - 单个持久化到存储
// - 显示来源 Cell
// - 筛选和搜索

// 产物自动收集：监听 cell:output 事件
on('cell:output', ({ cellId, output }) => {
  const detected = artifactManager.detectArtifacts([output], cellId);
  if (detected.length > 0) {
    detected.forEach(artifact => artifactManager.registerArtifact(artifact));
  }
});
```

##### 产物面板 UI 布局

```
┌─────────────────────────────────────────────┐
│ 📦 Artifacts (12)          [Export] [⚙️]    │
├─────────────────────────────────────────────┤
│ 🖼️ Images (5)                               │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │ img │ │ img │ │ img │ │ img │ │ img │    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │
│                                              │
│ 📊 DataFrames (4)                           │
│ ├─ df_sales [1000 rows × 5 cols] Cell [3]   │
│ ├─ df_users [500 rows × 8 cols] Cell [5]    │
│ └─ ...                                       │
│                                              │
│ 📈 Charts (3)                               │
│ ├─ plotly_chart_1 (scatter) Cell [7]        │
│ └─ ...                                       │
└─────────────────────────────────────────────┘
```

#### 5.7 AI 对话位置与 Cell 上下文对话

##### 问题 1：AI 对话 Cell 位置错误
当前 AgentResponses 渲染在 CodeCells 上方，但 QueryCell 在最下方。
用户 Query → Agent Response 的逻辑应该是响应紧跟在 query 后面。

##### 解决方案 1

```typescript
// 修改渲染顺序：Cell 列表 → Query/Response 对话
<div className="flex-1 overflow-auto p-4">
  {/* 1. Code Cells */}
  {cells.map((cell, index) => (
    <CellRenderer key={cell.id} cell={cell} index={index} />
  ))}
  
  {/* 2. Add Cell Button */}
  <AddCellButton />
  
  {/* 3. AI 对话区域（Query + Responses 交替） */}
  {showAgent && (
    <div className="mt-4 border-t border-slate-700 pt-4">
      <ConversationThread 
        history={conversationHistory}
        agentResponses={agentResponses}
        onExecuteCode={handleAgentExecuteCode}
        onInsertCode={insertCode}
      />
      <QueryCell onSubmit={handleAgentQuery} ... />
    </div>
  )}
</div>
```

##### 问题 2：无法针对特定 Cell 对话
用户应该能选择某个 Cell 并说"解释这个"、"修复这个"、"优化这个"。

##### 解决方案 2

```typescript
// Cell 右键菜单 / 工具栏按钮
interface CellContextAction {
  type: 'explain' | 'fix' | 'optimize' | 'document' | 'ask';
  cellId: string;
}

// CodeCell 添加 AI 操作按钮
<div className="cell-toolbar">
  <button onClick={() => askAboutCell(cell.id, 'explain')}>
    <Sparkles size={14} /> Explain
  </button>
  <button onClick={() => askAboutCell(cell.id, 'fix')}>
    <Wrench size={14} /> Fix
  </button>
  <button onClick={() => askAboutCell(cell.id, 'optimize')}>
    <Zap size={14} /> Optimize
  </button>
</div>

// 处理函数
const askAboutCell = (cellId: string, action: string) => {
  const cell = cells.find(c => c.id === cellId);
  if (!cell || cell.type !== 'code') return;
  
  const codeCell = cell as CodeCellType;
  const prompt = generateCellActionPrompt(action, codeCell);
  
  // 设置当前对话的上下文 Cell
  setContextCellId(cellId);
  handleAgentQuery(prompt);
};

// 生成提示
function generateCellActionPrompt(action: string, cell: CodeCellType): string {
  const templates = {
    explain: `请解释这段代码的功能：\n\`\`\`python\n${cell.source}\n\`\`\``,
    fix: `这段代码出错了，请帮我修复：\n\`\`\`python\n${cell.source}\n\`\`\`\n错误信息：${getLastError(cell)}`,
    optimize: `请优化这段代码的性能：\n\`\`\`python\n${cell.source}\n\`\`\``,
    document: `请为这段代码添加文档和注释：\n\`\`\`python\n${cell.source}\n\`\`\``,
  };
  return templates[action] || `关于这段代码：\n\`\`\`python\n${cell.source}\n\`\`\``;
}
```

#### 5.8 输出区域滚动优化

##### 问题
Output 展开后有 `overflow: auto`，导致嵌套滚动（外层页面滚动 + 内层 output 滚动），UX 很差。

##### 解决方案

```typescript
// OutputArea.tsx 修改
// 移除固定 maxHeight，改用动态高度 + 折叠策略

interface OutputAreaProps {
  outputs: Output[];
  collapsed?: boolean;
  collapseThreshold?: number; // 超过此高度自动折叠
}

// 策略：
// 1. 短输出（< 300px）：直接展示，无滚动
// 2. 中等输出（300-800px）：直接展示，无内部滚动
// 3. 长输出（> 800px）：默认折叠，展开后也无内部滚动（让外层滚动）

function OutputArea({ outputs, collapseThreshold = 800 }: OutputAreaProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      // 超过阈值自动折叠
      if (height > collapseThreshold) {
        setIsCollapsed(true);
      }
    }
  }, [outputs, collapseThreshold]);

  return (
    <div className="border-t border-slate-700">
      {isCollapsed ? (
        <>
          {/* 折叠预览：只显示前 200px */}
          <div className="max-h-[200px] overflow-hidden relative">
            <div ref={contentRef}>
              {outputs.map((o, i) => <OutputRenderer key={i} output={o} />)}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900 to-transparent" />
          </div>
          <button onClick={() => setIsCollapsed(false)}>
            Expand output ({contentHeight}px)
          </button>
        </>
      ) : (
        // 展开状态：无 overflow，让外层滚动
        <div ref={contentRef}>
          {outputs.map((o, i) => <OutputRenderer key={i} output={o} />)}
          {contentHeight > collapseThreshold && (
            <button onClick={() => setIsCollapsed(true)}>Collapse</button>
          )}
        </div>
      )}
    </div>
  );
}
```

#### 5.9 Agent Markdown 渲染增强

##### 问题
AgentCell 的 `MarkdownContent` 只是简单的行解析，不支持完整 Markdown。

##### 解决方案

```typescript
// 使用 react-markdown + remark-gfm + rehype-highlight
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

function AgentMarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <CodeBlock language={match[1]} code={String(children)} />
            ) : (
              <code className={className} {...props}>{children}</code>
            );
          },
          table({ children }) {
            return <div className="overflow-x-auto"><table>{children}</table></div>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// 依赖
// npm install react-markdown remark-gfm rehype-highlight
```

#### 5.10 Agent 与用户 Cell 编辑状态对齐

##### 问题分析

当前状态管理存在的不一致：

| 操作来源 | 当前实现 | 问题 |
|---------|---------|------|
| 用户编辑 | `setCellSource(id, source)` 直接更新 | ✅ 正常 |
| 用户执行 | `executeCell(id)` → `startExecution` → `completeExecution` | ✅ 正常 |
| Agent 创建 | `addCodeCell(code)` → 执行 | ⚠️ 无法区分来源 |
| Agent 更新 | 通过 `update_cell` action → 确认 → ? | ❌ 未实现 |
| Agent 执行 | `executeCode(code)` → 创建 cell → 执行 | ⚠️ 无法区分来源 |

##### 解决方案

```typescript
// 1. Cell 增加 createdBy 和 pendingEdit 字段
interface CodeCell extends BaseCell {
  createdBy: 'user' | 'agent';
  pendingEdit?: {
    source: string;
    from: 'agent';
    status: 'pending' | 'confirmed' | 'rejected';
    timestamp: string;
  };
}

// 2. Store 增加 Agent 编辑相关 actions
interface AgentEditSlice {
  // Agent 提议修改某个 Cell
  proposeEdit: (cellId: string, newSource: string) => void;
  
  // 用户确认 Agent 的修改
  confirmEdit: (cellId: string) => void;
  
  // 用户拒绝 Agent 的修改
  rejectEdit: (cellId: string) => void;
  
  // 获取待确认的编辑
  getPendingEdits: () => Array<{ cellId: string; edit: PendingEdit }>;
}

// 3. 完整的编辑状态流转
proposeEdit: (cellId, newSource) => {
  set((state) => {
    const cell = state.cells.find(c => c.id === cellId);
    if (cell && cell.type === 'code') {
      (cell as CodeCell).pendingEdit = {
        source: newSource,
        from: 'agent',
        status: 'pending',
        timestamp: new Date().toISOString(),
      };
    }
  });
  emit('cell:pendingEdit', { cellId, newSource });
};

confirmEdit: (cellId) => {
  set((state) => {
    const cell = state.cells.find(c => c.id === cellId);
    if (cell && cell.type === 'code' && (cell as CodeCell).pendingEdit) {
      const codeCell = cell as CodeCell;
      codeCell.source = codeCell.pendingEdit!.source;
      codeCell.pendingEdit = undefined;
      codeCell.updatedAt = new Date().toISOString();
    }
  });
  emit('cell:editConfirmed', { cellId });
};

// 4. UI 层显示 pending edit 状态
function CodeCell({ cell, ... }) {
  const hasPendingEdit = cell.pendingEdit?.status === 'pending';
  
  return (
    <div className={hasPendingEdit ? 'ring-2 ring-yellow-500' : ''}>
      {hasPendingEdit && (
        <PendingEditBanner 
          originalSource={cell.source}
          newSource={cell.pendingEdit.source}
          onConfirm={() => confirmEdit(cell.id)}
          onReject={() => rejectEdit(cell.id)}
        />
      )}
      {/* ... */}
    </div>
  );
}
```

##### 状态流转图

```
┌─────────────────────────────────────────────────────────────┐
│                     Cell Edit State Machine                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐     User Edit      ┌─────────┐                │
│  │  Idle   │ ─────────────────> │ Updated │                │
│  │         │ <───────────────── │         │                │
│  └────┬────┘     (direct)       └─────────┘                │
│       │                                                      │
│       │ Agent proposes                                       │
│       ▼                                                      │
│  ┌──────────────┐   Confirm   ┌─────────┐                  │
│  │ Pending Edit │ ──────────> │ Updated │                  │
│  │   (yellow)   │             │         │                  │
│  └──────┬───────┘             └─────────┘                  │
│         │                                                    │
│         │ Reject                                             │
│         ▼                                                    │
│  ┌─────────┐                                                │
│  │  Idle   │ (pending edit discarded)                       │
│  └─────────┘                                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 5.11 完整实现任务清单

```
[ ] Cell 管理增强
    - moveCell/moveCellUp/moveCellDown
    - insertCellAt
    - 复制/粘贴/复制 (clipboard)
    - 撤销/重做 (history)
    - 多选操作
    - 拖拽排序 (@dnd-kit/sortable)
    - Cell 位置指示器
    - Cell 类型切换 (code ↔ markdown)

[ ] Package 管理
    - PackageManager 组件
    - 已安装包列表
    - 安装/卸载/更新包
    - requirements.txt 导入/导出
    - 包详情面板

[ ] 多 Session 管理
    - SessionManager 组件
    - JupyterService 多 Session 扩展
    - Session 列表 UI
    - Session 创建/切换/删除
    - Kernel 状态同步
    
[ ] 产物面板 (Artifacts Panel)
    - ArtifactsPanel 组件
    - 按类型分组展示
    - 缩略图预览
    - 批量导出 ZIP
    - 来源 Cell 关联
    - 侧边栏入口

[ ] AI 对话增强
    - 修复对话位置（Response 在 Query 后）
    - Cell 上下文对话（Explain/Fix/Optimize）
    - Cell 工具栏 AI 按钮
    - ConversationThread 组件

[ ] 输出区域优化
    - 移除嵌套滚动
    - 超长输出自动折叠
    - 展开后无内部 overflow

[ ] Markdown 渲染增强
    - react-markdown + remark-gfm
    - 代码块语法高亮
    - 表格样式

[ ] Agent 编辑状态对齐
    - proposeEdit / confirmEdit / rejectEdit
    - pendingEdit 状态显示
    - Diff 对比视图
    - 状态流转事件

[ ] UI 入口
    - Notebook 工具栏添加 Session 选择器
    - 侧边栏添加 Package 管理入口
    - 侧边栏添加 Artifacts 面板入口
    - Cell 右键菜单增强（移动/复制/粘贴/AI 操作）
    - Cell 头部类型选择器
```

#### 5.12 依赖

```json
{
  "@dnd-kit/core": "^6.0.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.0.0",
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "rehype-highlight": "^7.0.0"
}
```

#### 5.13 API 扩展

##### Session REST API

```
GET  /api/sessions           # 列出所有 sessions
POST /api/sessions           # 创建新 session
GET  /api/sessions/{id}      # 获取 session 详情
PATCH /api/sessions/{id}     # 更新 session（重命名、切换 kernel）
DELETE /api/sessions/{id}    # 删除 session

GET  /api/kernels            # 列出所有运行中的 kernels
POST /api/kernels            # 启动新 kernel
DELETE /api/kernels/{id}     # 关闭 kernel
POST /api/kernels/{id}/interrupt  # 中断 kernel
POST /api/kernels/{id}/restart    # 重启 kernel
```

### 重点测试

1. **WebSocket 消息处理** - 状态机边界条件、乱序消息
2. **状态同步** - 多 Slice 一致性
3. **Agent 安全** - 危险代码检测、执行限制
4. **Cell 管理** - 拖拽排序边界、撤销/重做栈、多选操作
5. **多 Session** - Session 切换状态保持、并发 Kernel 通信
6. **Package 管理** - 安装/卸载错误处理、依赖冲突检测

---

## 12. API 设计

### 12.1 JupyterService

使用 `@jupyterlab/services` 封装，主要提供：

```typescript
interface JupyterService {
  // 连接管理
  connect(serverUrl: string, token?: string): Promise<void>;
  disconnect(): Promise<void>;
  
  // Kernel 管理
  startKernel(name?: string): Promise<string>;  // 返回 kernelId
  shutdownKernel(kernelId: string): Promise<void>;
  interruptKernel(kernelId: string): Promise<void>;
  
  // 代码执行
  execute(kernelId: string, code: string): ExecutionHandle;
  
  // 状态订阅
  onKernelStatus(callback: (status: KernelStatus) => void): () => void;
}
```

### 12.2 AgentOrchestrator

Agent 编排层，集中管理 Agent 逻辑：

```typescript
interface AgentOrchestrator {
  // 处理用户查询
  processQuery(query: string): AsyncGenerator<AgentAction>;
  
  // 取消当前操作
  cancel(): void;
  
  // 安全检查
  checkCodeSafety(code: string): SafetyCheckResult;
  
  // 获取当前上下文
  getContext(): CompiledContext;
}
```

### 12.3 Hooks API

```typescript
// 使用 Notebook Store
function useNotebook() {
  const cells = useNotebookStore(state => state.cells);
  const addCell = useNotebookStore(state => state.addCell);
  const updateCell = useNotebookStore(state => state.updateCell);
  // ...
  return { cells, addCell, updateCell };
}

// 使用 Agent
function useAgent() {
  const status = useNotebookStore(state => state.agentStatus);
  const mode = useNotebookStore(state => state.agentMode);
  // ...
  return { status, mode };
}
```

---

## 13. 依赖

### 必需依赖

```json
{
  "@jupyterlab/services": "^7.0.0",
  "@datalayer/jupyter-react": "^0.x.x",
  "zustand": "^4.5.0",
  "mitt": "^3.0.0",
  "dompurify": "^3.0.0"
}
```

### 可选依赖

```json
{
  "@tanstack/react-virtual": "^3.0.0",
  "ag-grid-react": "^31.0.0",
  "jszip": "^3.10.0",
  "@dnd-kit/core": "^6.0.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.0.0",
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "rehype-highlight": "^7.0.0"
}
```

---

## 14. 参考资料

- [Jupyter Server REST API](https://jupyter-server.readthedocs.io/en/latest/developers/rest-api.html)
- [Jupyter WebSocket Protocols](https://jupyter-server.readthedocs.io/en/latest/developers/websocket-protocols.html)
- [@jupyterlab/services Documentation](https://jupyterlab.readthedocs.io/en/latest/api/modules/services.html)
- [Jupyter Messaging Protocol](https://jupyter-client.readthedocs.io/en/latest/messaging.html)
- [Datalayer Jupyter-UI](https://github.com/datalayer/jupyter-ui)
- [Notebook Intelligence](https://github.com/mbektas/notebook-intelligence)
