# Jupyter Agent UI 重构设计文档

## 1. 问题分析

### 1.1 当前问题

1. **Artifacts 不更新**
   - 执行代码后产物（图片、DataFrame、图表）没有被自动检测和收集
   - ArtifactsPanel 是静态的，没有订阅 cell 输出事件
   - 缺少从 Output 中提取 Artifact 的逻辑

2. **UI 布局分散**
   - 功能入口不清晰
   - 侧边栏切换体验不佳
   - AI 对话区域位置不合理

3. **Agent 能力不足**
   - 缺少 inline chat（行内对话）
   - 缺少自动补全集成
   - 工具调用不够直观

### 1.2 参考设计 (NBI - Notebook Intelligence)

```
┌─────────────────────────────────────────────────────────────────┐
│ Toolbar                                                         │
├─────────────────────────────────────────────────────────────────┤
│                                           │                     │
│   Notebook Cells                          │   Right Panel       │
│   ┌─────────────────────────────────┐     │   ┌───────────────┐ │
│   │ [1] Code Cell                   │     │   │ Agent Chat    │ │
│   │     ✨ Inline Chat Button       │     │   │               │ │
│   │     Auto-complete              │     │   │ Artifacts     │ │
│   └─────────────────────────────────┘     │   │               │ │
│   ┌─────────────────────────────────┐     │   │ Variables     │ │
│   │ [2] Output with Artifacts       │     │   │               │ │
│   │     📊 Chart  📷 Image  📋 Table│     │   └───────────────┘ │
│   └─────────────────────────────────┘     │                     │
│                                           │                     │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 新 UI 架构设计

### 2.1 整体布局

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Header Bar                                                                │
│ [Logo] [Server: localhost:8888] [Connect] | [Run All] [Stop] [Restart]   │
│        [Undo] [Redo] | [AI ✨] [Interactive/Auto] | [Python 3 | idle] ⚙️  │
├────────────┬─────────────────────────────────────────────┬───────────────┤
│ Left Panel │              Main Editor                    │  Right Panel  │
│            │                                             │               │
│ 📁 Files   │  ┌─────────────────────────────────────┐   │ 💬 AI Chat    │
│ 📦 Packages│  │ Cell [1]  [Code ▼] [▶] [✨] [⋮]     │   │ ───────────── │
│ 🔗 Sessions│  │ ┌─────────────────────────────────┐ │   │ [Conversation]│
│            │  │ │ import pandas as pd             │ │   │               │
│            │  │ │ df = pd.read_csv('data.csv')   │ │   │ [Query Input] │
│            │  │ └─────────────────────────────────┘ │   │               │
│            │  │ Output:                             │   │ ───────────── │
│            │  │ ┌─────────────────────────────────┐ │   │ 📊 Artifacts  │
│            │  │ │ [Table Preview] [📥]            │ │   │ ┌───────────┐ │
│            │  │ └─────────────────────────────────┘ │   │ │ 🖼️ img_1  │ │
│            │  └─────────────────────────────────────┘   │ │ 📊 chart_1│ │
│            │                                             │ │ 📋 df_1   │ │
│            │  ┌─────────────────────────────────────┐   │ └───────────┘ │
│            │  │ Cell [2]  [Code ▼] [▶] [✨] [⋮]     │   │               │
│            │  │ ┌─────────────────────────────────┐ │   │ ───────────── │
│            │  │ │ # Inline Chat Popover           │ │   │ 🔍 Variables  │
│            │  │ │ ┌───────────────────────┐       │ │   │ ┌───────────┐ │
│            │  │ │ │ ✨ "plot histogram"   │       │ │   │ │ df: DF    │ │
│            │  │ │ │ [Generate] [Cancel]   │       │ │   │ │ x: array  │ │
│            │  │ │ └───────────────────────┘       │ │   │ └───────────┘ │
│            │  │ └─────────────────────────────────┘ │   │               │
│            │  └─────────────────────────────────────┘   │               │
│            │                                             │               │
│            │  [+ Code] [+ Markdown] [+ AI Cell]          │               │
├────────────┴─────────────────────────────────────────────┴───────────────┤
│ Status Bar: [Kernel: idle] [Memory: 256MB] [Artifacts: 3] [Cells: 5]     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件结构

```
JupyterWorkspace/
├── Header/
│   ├── ServerSelector
│   ├── ConnectionStatus
│   ├── ExecutionControls
│   ├── HistoryControls (Undo/Redo)
│   ├── AIControls
│   └── KernelStatus
│
├── LeftPanel/ (可折叠)
│   ├── FileExplorer
│   ├── PackageManager
│   └── SessionManager
│
├── MainEditor/
│   ├── CellList (可拖拽)
│   │   └── Cell/
│   │       ├── CellHeader (type selector, actions, AI button)
│   │       ├── CodeEditor (Monaco + autocomplete)
│   │       ├── InlineChatPopover (✨ 按钮触发)
│   │       └── OutputArea (自动提取 Artifacts)
│   │
│   └── AddCellBar
│
├── RightPanel/ (可折叠, 多 Tab)
│   ├── ChatTab
│   │   ├── ConversationThread
│   │   └── QueryInput
│   ├── ArtifactsTab (实时更新)
│   │   ├── ArtifactGrid
│   │   └── ArtifactPreview
│   └── VariablesTab
│
└── StatusBar/
    ├── KernelInfo
    ├── MemoryUsage
    ├── ArtifactCount
    └── CellCount
```

## 3. 关键功能设计

### 3.1 Artifacts 实时收集系统

```typescript
// 架构：Output -> ArtifactDetector -> ArtifactStore -> ArtifactsPanel

interface ArtifactCollector {
  // 订阅 cell 输出事件
  subscribeToOutputs(): void;
  
  // 从 Output 中检测并提取 Artifact
  detectArtifacts(cellId: string, output: Output): DetectedArtifact[];
  
  // 添加到 Store
  addArtifact(artifact: DetectedArtifact): void;
}

// 检测规则
const ARTIFACT_DETECTORS = {
  // 图片检测
  image: (output: Output) => {
    if (output.type === 'display_data' || output.type === 'execute_result') {
      const data = output.data;
      if (data['image/png'] || data['image/jpeg'] || data['image/svg+xml']) {
        return { type: 'image', ... };
      }
    }
    return null;
  },
  
  // DataFrame 检测
  dataframe: (output: Output) => {
    if (output.data?.['text/html']?.includes('dataframe')) {
      return { type: 'dataframe', ... };
    }
    return null;
  },
  
  // Plotly 图表检测
  chart: (output: Output) => {
    if (output.data?.['application/vnd.plotly.v1+json']) {
      return { type: 'chart', ... };
    }
    return null;
  },
};
```

### 3.2 Inline Chat (行内 AI 对话)

```typescript
interface InlineChatProps {
  cellId: string;
  position: { line: number; column: number };
  onGenerate: (code: string) => void;
  onCancel: () => void;
}

// 触发方式
// 1. 点击 Cell 工具栏的 ✨ 按钮
// 2. 快捷键 Cmd/Ctrl + G
// 3. 输入 /ai 触发

// UI 示意
/*
┌─────────────────────────────────────┐
│ ✨ What would you like to do?       │
│ ┌─────────────────────────────────┐ │
│ │ plot a histogram of column 'x' │ │
│ └─────────────────────────────────┘ │
│ [Generate] [Cancel]    Cmd+Enter   │
└─────────────────────────────────────┘
*/
```

### 3.3 智能自动补全

```typescript
interface AutoCompleteProvider {
  // Jupyter 内核补全
  kernelComplete(code: string, cursorPos: number): Promise<CompletionItem[]>;
  
  // AI 补全 (可选)
  aiComplete(code: string, context: string): Promise<CompletionItem[]>;
  
  // 合并结果
  mergeCompletions(kernel: CompletionItem[], ai: CompletionItem[]): CompletionItem[];
}

// Monaco Editor 集成
const completionProvider: monaco.languages.CompletionItemProvider = {
  provideCompletionItems: async (model, position) => {
    const code = model.getValue();
    const offset = model.getOffsetAt(position);
    
    // 并行获取补全
    const [kernelItems, aiItems] = await Promise.all([
      provider.kernelComplete(code, offset),
      provider.aiComplete(code, getContext()),
    ]);
    
    return { suggestions: provider.mergeCompletions(kernelItems, aiItems) };
  },
};
```

### 3.4 Agent 工具系统

```typescript
// 内置工具定义
const BUILT_IN_TOOLS: AgentTool[] = [
  {
    name: 'notebook-edit',
    description: 'Edit notebook cells',
    schema: {
      type: 'object',
      properties: {
        cellId: { type: 'string' },
        action: { enum: ['create', 'update', 'delete', 'move'] },
        content: { type: 'string' },
      },
    },
    execute: async (params) => {
      // 调用 store actions
    },
  },
  {
    name: 'notebook-execute',
    description: 'Execute notebook cells',
    schema: {
      type: 'object',
      properties: {
        cellIds: { type: 'array', items: { type: 'string' } },
        all: { type: 'boolean' },
      },
    },
    execute: async (params) => {
      // 调用 execution manager
    },
  },
  {
    name: 'file-read',
    description: 'Read files from workspace',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
    },
    execute: async (params) => {
      // 通过 Jupyter contents API 读取
    },
  },
  {
    name: 'command-execute',
    description: 'Execute shell commands',
    schema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
      },
    },
    execute: async (params) => {
      // 在 kernel 中执行 !command
    },
  },
];
```

## 4. 组件实现计划

### Phase 1: Artifacts 实时收集 (优先)

| 任务 | 文件 | 说明 |
|------|------|------|
| 1.1 | `hooks/useArtifactCollector.ts` | 监听输出事件，提取 Artifacts |
| 1.2 | `store/artifactStore.ts` | Artifacts 状态管理 |
| 1.3 | `components/ArtifactsPanel.tsx` | 重写，订阅 store |
| 1.4 | `components/OutputArea.tsx` | 输出时触发 Artifact 检测 |

### Phase 2: 右侧面板重构

| 任务 | 文件 | 说明 |
|------|------|------|
| 2.1 | `components/RightPanel.tsx` | 统一的右侧面板容器 |
| 2.2 | `components/RightPanel/ChatTab.tsx` | AI 对话 Tab |
| 2.3 | `components/RightPanel/ArtifactsTab.tsx` | Artifacts Tab |
| 2.4 | `components/RightPanel/VariablesTab.tsx` | 变量检查 Tab |

### Phase 3: Inline Chat

| 任务 | 文件 | 说明 |
|------|------|------|
| 3.1 | `components/InlineChatPopover.tsx` | 行内对话弹窗 |
| 3.2 | `hooks/useInlineChat.ts` | 快捷键和触发逻辑 |
| 3.3 | `components/CodeCell.tsx` | 集成 Inline Chat |

### Phase 4: 自动补全增强

| 任务 | 文件 | 说明 |
|------|------|------|
| 4.1 | `services/CompletionService.ts` | 补全服务 |
| 4.2 | `hooks/useMonacoCompletion.ts` | Monaco 集成 |

### Phase 5: 左侧面板

| 任务 | 文件 | 说明 |
|------|------|------|
| 5.1 | `components/LeftPanel.tsx` | 左侧面板容器 |
| 5.2 | `components/LeftPanel/FileExplorer.tsx` | 文件浏览器 |

### Phase 6: 工具栏和状态栏

| 任务 | 文件 | 说明 |
|------|------|------|
| 6.1 | `components/HeaderBar.tsx` | 重构顶部工具栏 |
| 6.2 | `components/StatusBar.tsx` | 新增底部状态栏 |

## 5. 新增文件结构

```
src/components/editors/jupyter/
├── components/
│   ├── layout/
│   │   ├── JupyterWorkspace.tsx      # 新的主容器
│   │   ├── HeaderBar.tsx             # 顶部工具栏
│   │   ├── LeftPanel.tsx             # 左侧面板
│   │   ├── RightPanel.tsx            # 右侧面板
│   │   └── StatusBar.tsx             # 底部状态栏
│   │
│   ├── panels/
│   │   ├── ChatPanel.tsx             # AI 对话面板
│   │   ├── ArtifactsPanel.tsx        # Artifacts 面板 (重写)
│   │   ├── VariablesPanel.tsx        # 变量面板
│   │   ├── PackagesPanel.tsx         # 包管理面板
│   │   ├── SessionsPanel.tsx         # Session 面板
│   │   └── FilesPanel.tsx            # 文件面板
│   │
│   ├── editor/
│   │   ├── CellList.tsx              # Cell 列表 (拖拽)
│   │   ├── CodeCell.tsx              # 代码 Cell (重构)
│   │   ├── MarkdownCell.tsx          # Markdown Cell
│   │   ├── OutputArea.tsx            # 输出区域 (带 Artifact 检测)
│   │   └── InlineChatPopover.tsx     # 行内 AI 对话
│   │
│   └── common/
│       ├── ArtifactThumbnail.tsx     # Artifact 缩略图
│       ├── ArtifactPreview.tsx       # Artifact 预览
│       └── ToolButton.tsx            # 工具按钮
│
├── hooks/
│   ├── useArtifactCollector.ts       # Artifact 收集 Hook
│   ├── useInlineChat.ts              # Inline Chat Hook
│   ├── useMonacoCompletion.ts        # 补全 Hook
│   └── usePanelLayout.ts             # 面板布局 Hook
│
├── store/
│   ├── notebookStore.ts              # (已有)
│   ├── artifactStore.ts              # Artifact Store (新增)
│   └── layoutStore.ts                # 布局 Store (新增)
│
└── services/
    ├── ArtifactDetector.ts           # Artifact 检测器 (新增)
    └── CompletionService.ts          # 补全服务 (新增)
```

## 6. Artifacts 实时更新方案

### 6.1 事件流

```
Cell Execute
    ↓
JupyterService.execute()
    ↓
Kernel Output (stream/execute_result/display_data)
    ↓
OutputArea.appendOutput()
    ↓
ArtifactDetector.detect(output)
    ↓
artifactStore.addArtifact()
    ↓
ArtifactsPanel (自动更新)
```

### 6.2 Store 设计

```typescript
// store/artifactStore.ts
import { create } from 'zustand';

interface ArtifactStore {
  artifacts: Map<string, DetectedArtifact>;
  
  // Actions
  addArtifact: (artifact: DetectedArtifact) => void;
  removeArtifact: (id: string) => void;
  clearCellArtifacts: (cellId: string) => void;
  clearAll: () => void;
  
  // Selectors
  getArtifactsByCell: (cellId: string) => DetectedArtifact[];
  getArtifactsByType: (type: ArtifactType) => DetectedArtifact[];
}

export const useArtifactStore = create<ArtifactStore>((set, get) => ({
  artifacts: new Map(),
  
  addArtifact: (artifact) => set((state) => {
    const newArtifacts = new Map(state.artifacts);
    newArtifacts.set(artifact.id, artifact);
    return { artifacts: newArtifacts };
  }),
  
  // ... other actions
}));
```

### 6.3 检测器实现

```typescript
// services/ArtifactDetector.ts
export class ArtifactDetector {
  detect(cellId: string, output: Output, outputIndex: number): DetectedArtifact | null {
    // 图片检测
    if (output.type === 'display_data' || output.type === 'execute_result') {
      const data = output.data as MimeBundle;
      
      // PNG
      if (data['image/png']) {
        return this.createImageArtifact(cellId, outputIndex, 'image/png', data['image/png']);
      }
      
      // SVG
      if (data['image/svg+xml']) {
        return this.createImageArtifact(cellId, outputIndex, 'image/svg+xml', data['image/svg+xml']);
      }
      
      // Plotly
      if (data['application/vnd.plotly.v1+json']) {
        return this.createChartArtifact(cellId, outputIndex, data['application/vnd.plotly.v1+json']);
      }
      
      // DataFrame (HTML 表格)
      if (data['text/html'] && this.isDataFrame(data['text/html'])) {
        return this.createDataFrameArtifact(cellId, outputIndex, data['text/html']);
      }
    }
    
    return null;
  }
  
  private isDataFrame(html: string): boolean {
    return html.includes('dataframe') || 
           html.includes('<table') && html.includes('<thead');
  }
}
```

## 7. 行动计划

### 第一阶段：修复 Artifacts (立即执行)

```bash
# 1. 创建 Artifact Store
# 2. 创建 ArtifactDetector 服务
# 3. 修改 OutputArea，添加检测逻辑
# 4. 重写 ArtifactsPanel，订阅 Store
```

### 第二阶段：右侧面板重构

```bash
# 1. 创建统一的 RightPanel 组件
# 2. 实现 Tab 切换
# 3. 迁移 Chat/Artifacts/Variables
```

### 第三阶段：Inline Chat

```bash
# 1. 创建 InlineChatPopover 组件
# 2. 集成快捷键
# 3. 连接 AI 服务
```

### 第四阶段：布局优化

```bash
# 1. 添加左侧面板
# 2. 添加状态栏
# 3. 面板拖拽调整大小
```

## 8. 技术要点

### 8.1 响应式面板布局

```typescript
// 使用 CSS Grid + 可调整大小
const layoutCSS = `
  display: grid;
  grid-template-columns: ${leftPanelWidth}px 1fr ${rightPanelWidth}px;
  grid-template-rows: auto 1fr auto;
`;

// 拖拽调整大小
import { Resizable } from 're-resizable';
```

### 8.2 虚拟化长列表

```typescript
// Artifacts 列表虚拟化
import { useVirtualizer } from '@tanstack/react-virtual';
```

### 8.3 快捷键系统

```typescript
// 统一的快捷键管理
const SHORTCUTS = {
  'cmd+g': 'showInlineChat',
  'cmd+enter': 'runCell',
  'cmd+shift+enter': 'runCellAndAdvance',
  'cmd+z': 'undo',
  'cmd+shift+z': 'redo',
};
```

## 9. 预期效果

1. **Artifacts 实时更新**：执行代码后，右侧 Artifacts 面板立即显示新产物
2. **直观的 AI 交互**：点击 ✨ 按钮即可在当前位置唤起 AI
3. **清晰的功能分区**：左侧管理（文件/包/会话），中间编辑，右侧 AI+产物
4. **流畅的操作体验**：拖拽排序、快捷键、自动补全

---

**下一步**：开始实现 Phase 1 - Artifacts 实时收集
