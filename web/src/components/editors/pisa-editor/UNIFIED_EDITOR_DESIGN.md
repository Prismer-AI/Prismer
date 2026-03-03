# Pisa Editor - 统一编辑器组件设计文档

## 概述

本文档分析 `LatexEditorPreview` 和 `CodePlayground` 两个组件的相似性，并提出统一为单一可扩展编辑器组件的设计方案。

---

## 1. 现状分析

### 1.1 组件对比

| 特性 | LaTeX Editor | Code Playground |
|------|--------------|-----------------|
| **编辑器引擎** | CodeMirror 6 | Monaco Editor |
| **预览方式** | KaTeX HTML 渲染 | WebContainer iframe |
| **文件结构** | 扁平数组 `TexFile[]` | 层级 `FilesMap` |
| **运行环境** | 无（即时预览） | WebContainer |
| **特殊功能** | 代码片段、模板管理 | 终端、运行控制 |
| **语言支持** | LaTeX only | JS/TS/Vue 等 |
| **代码行数** | ~1224 行 | ~605 行 + 辅助文件 |

### 1.2 布局结构对比

两者的布局结构高度相似：

```
┌─────────────────────────────────────────────────────────┐
│                      Toolbar                            │
│  [模板/语言选择] [操作按钮] [布局切换] [主题] [导入导出]    │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  File    │              Editor                          │
│  Tree/   │              (CodeMirror / Monaco)           │
│  Tabs    │                                              │
│          ├──────────────────────────────────────────────┤
│          │              Preview                         │
│          │              (HTML / iframe)                 │
│          │                                              │
├──────────┴──────────────────────────────────────────────┤
│                    Footer / Terminal                    │
└─────────────────────────────────────────────────────────┘
```

### 1.3 共同功能

| 功能 | LaTeX Editor | Code Playground | 可复用 |
|------|-------------|-----------------|--------|
| 多文件支持 | ✅ | ✅ | ✅ |
| 文件切换 | ✅ (tabs) | ✅ (tree) | ✅ |
| 主题切换 | ✅ | ✅ | ✅ |
| 布局切换 | ✅ (split/editor/preview) | ✅ (h/v/editor-only) | ✅ |
| 文件导入 | ✅ | ✅ | ✅ |
| 文件导出 | ✅ | ✅ | ✅ |
| 复制内容 | ✅ | ❌ | ⚠️ |
| 代码片段 | ✅ | ❌ | 可扩展 |
| 运行控制 | ❌ (Compile) | ✅ (Run/Stop) | ⚠️ |
| 终端输出 | ❌ | ✅ | 可扩展 |
| 模板管理 | ✅ | ✅ | ✅ |

### 1.4 核心差异

1. **编辑器引擎**
   - LaTeX: CodeMirror 6 (更轻量，LaTeX 语法支持好)
   - Code: Monaco Editor (VS Code 体验，TypeScript 支持好)

2. **预览机制**
   - LaTeX: 客户端 HTML 渲染 (KaTeX)
   - Code: WebContainer + iframe (需要 COEP/COOP headers)

3. **执行模型**
   - LaTeX: 无执行，纯渲染
   - Code: 完整 Node.js 环境

---

## 2. 统一架构设计

### 2.1 核心理念

采用 **插件式架构**，将编辑器核心与语言/预览特性解耦：

```
PisaEditor (核心)
├── EditorCore (编辑器抽象层)
│   ├── CodeMirrorAdapter
│   └── MonacoAdapter
├── PreviewCore (预览抽象层)
│   ├── HtmlPreview (静态渲染)
│   └── IframePreview (WebContainer)
├── FileManager (文件管理)
├── LayoutManager (布局管理)
└── Plugins (插件系统)
    ├── LatexPlugin
    ├── ReactPlugin
    ├── VuePlugin
    ├── MarkdownPlugin
    └── ...
```

### 2.2 类型定义

```typescript
// ============================================================
// 核心类型
// ============================================================

/** 编辑器模式 */
export type EditorMode = 
  | "latex"      // LaTeX 编辑
  | "code"       // 代码编辑 (JS/TS/Vue/React)
  | "markdown"   // Markdown 编辑
  | "custom";    // 自定义

/** 编辑器引擎 */
export type EditorEngine = "codemirror" | "monaco";

/** 预览类型 */
export type PreviewType = 
  | "html"       // 客户端 HTML 渲染
  | "iframe"     // iframe 嵌入
  | "webcontainer" // WebContainer 沙箱
  | "none";      // 无预览

/** 布局模式 */
export type LayoutMode = 
  | "split-h"    // 左右分割
  | "split-v"    // 上下分割
  | "editor"     // 仅编辑器
  | "preview";   // 仅预览

/** 文件数据 */
export interface EditorFile {
  path: string;           // 文件路径
  name: string;           // 文件名
  content: string;        // 文件内容
  language: string;       // 语言类型
  isMain?: boolean;       // 是否主文件
  readOnly?: boolean;     // 只读
}

/** 文件系统 */
export type FileSystem = Map<string, EditorFile>;

/** 编辑器配置 */
export interface PisaEditorConfig {
  mode: EditorMode;
  engine?: EditorEngine;
  preview?: PreviewType;
  theme?: "dark" | "light";
  layout?: LayoutMode;
  readOnly?: boolean;
  initialFiles?: EditorFile[];
}

/** 插件接口 */
export interface EditorPlugin {
  id: string;
  name: string;
  
  // 编辑器配置
  engine: EditorEngine;
  languages: string[];
  
  // 预览配置
  previewType: PreviewType;
  renderPreview?: (content: string, files: FileSystem) => string | Promise<string>;
  
  // 工具栏扩展
  toolbarItems?: ToolbarItem[];
  snippets?: Snippet[];
  
  // 文件模板
  templates?: Template[];
  defaultFiles?: EditorFile[];
  
  // 生命周期
  onInit?: (editor: EditorInstance) => void;
  onFileChange?: (file: EditorFile) => void;
  onDestroy?: () => void;
}

/** 工具栏项 */
export interface ToolbarItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  onClick: () => void;
  group?: "left" | "center" | "right";
}

/** 代码片段 */
export interface Snippet {
  id: string;
  label: string;
  description?: string;
  snippet: string;       // | 表示光标位置
  icon?: React.ComponentType;
}

/** 模板 */
export interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  files: EditorFile[];
  thumbnail?: string;
}
```

### 2.3 组件结构

```
src/components/editors/pisa-editor/
├── index.ts                    # 统一导出
├── PisaEditor.tsx              # 主组件
├── types.ts                    # 类型定义
│
├── core/                       # 核心模块
│   ├── EditorCore.tsx          # 编辑器抽象层
│   ├── PreviewCore.tsx         # 预览抽象层
│   ├── FileManager.ts          # 文件管理
│   ├── LayoutManager.tsx       # 布局管理
│   └── PluginManager.ts        # 插件管理
│
├── adapters/                   # 编辑器适配器
│   ├── CodeMirrorAdapter.tsx   # CodeMirror 6 适配
│   └── MonacoAdapter.tsx       # Monaco Editor 适配
│
├── previews/                   # 预览渲染器
│   ├── HtmlPreview.tsx         # HTML 渲染
│   ├── IframePreview.tsx       # iframe 嵌入
│   └── WebContainerPreview.tsx # WebContainer
│
├── components/                 # UI 组件
│   ├── Toolbar.tsx             # 工具栏
│   ├── FileTree.tsx            # 文件树
│   ├── FileTabs.tsx            # 文件标签
│   ├── Terminal.tsx            # 终端
│   ├── StatusBar.tsx           # 状态栏
│   └── SnippetPalette.tsx      # 片段面板
│
├── plugins/                    # 内置插件
│   ├── latex/                  # LaTeX 插件
│   │   ├── index.ts
│   │   ├── latexPlugin.ts
│   │   ├── katexRenderer.ts
│   │   ├── snippets.ts
│   │   └── templates/          # LaTeX 模板
│   │
│   ├── react/                  # React 插件
│   │   ├── index.ts
│   │   ├── reactPlugin.ts
│   │   └── templates/
│   │
│   ├── vue/                    # Vue 插件
│   │   └── ...
│   │
│   └── markdown/               # Markdown 插件
│       └── ...
│
├── hooks/                      # React Hooks
│   ├── useEditor.ts            # 编辑器状态
│   ├── useFiles.ts             # 文件管理
│   ├── usePreview.ts           # 预览管理
│   └── useWebContainer.ts      # WebContainer
│
├── themes/                     # 主题
│   ├── dark.ts
│   └── light.ts
│
└── utils/                      # 工具函数
    ├── fileUtils.ts
    └── languageUtils.ts
```

### 2.4 主组件 API

```tsx
interface PisaEditorProps {
  // 模式配置
  mode: EditorMode;
  plugin?: EditorPlugin;         // 自定义插件
  
  // 文件配置
  initialFiles?: EditorFile[];
  mainFile?: string;
  
  // 布局配置
  layout?: LayoutMode;
  showFileTree?: boolean;
  showTerminal?: boolean;
  showStatusBar?: boolean;
  
  // 编辑器配置
  theme?: "dark" | "light";
  readOnly?: boolean;
  
  // 回调
  onFilesChange?: (files: FileSystem) => void;
  onFileSelect?: (file: EditorFile) => void;
  onPreviewReady?: (url?: string) => void;
  onError?: (error: Error) => void;
  
  // 样式
  className?: string;
  style?: React.CSSProperties;
}

// 使用示例
<PisaEditor 
  mode="latex"
  layout="split-h"
  theme="dark"
  onFilesChange={handleFilesChange}
/>

<PisaEditor
  mode="code"
  plugin={reactPlugin}
  showTerminal
  layout="split-h"
/>
```

---

## 3. 插件实现示例

### 3.1 LaTeX 插件

```typescript
// plugins/latex/latexPlugin.ts
import { EditorPlugin } from "../../types";
import { renderLatexToHtml } from "./katexRenderer";
import { latexSnippets } from "./snippets";
import { defaultLatexFiles } from "./templates";

export const latexPlugin: EditorPlugin = {
  id: "latex",
  name: "LaTeX Editor",
  
  // 使用 CodeMirror (更好的 LaTeX 支持)
  engine: "codemirror",
  languages: ["latex", "bibtex"],
  
  // HTML 预览 (KaTeX 渲染)
  previewType: "html",
  renderPreview: async (content, files) => {
    return renderLatexToHtml(content);
  },
  
  // 工具栏扩展
  toolbarItems: [
    {
      id: "templates",
      label: "Templates",
      icon: FolderOpen,
      onClick: () => openTemplateManager(),
      group: "left",
    },
    {
      id: "compile",
      label: "Compile",
      icon: Play,
      onClick: () => triggerCompile(),
      group: "right",
    },
  ],
  
  // 代码片段
  snippets: latexSnippets,
  
  // 默认文件
  defaultFiles: defaultLatexFiles,
  
  // 模板系统
  templates: [
    {
      id: "article",
      name: "Article",
      category: "academic",
      files: [...],
    },
    // ...
  ],
};
```

### 3.2 React 插件

```typescript
// plugins/react/reactPlugin.ts
import { EditorPlugin } from "../../types";
import { reactTemplates, defaultReactFiles } from "./templates";

export const reactPlugin: EditorPlugin = {
  id: "react",
  name: "React Playground",
  
  // 使用 Monaco (更好的 TypeScript 支持)
  engine: "monaco",
  languages: ["javascript", "typescript", "javascriptreact", "typescriptreact", "css", "json"],
  
  // WebContainer 预览
  previewType: "webcontainer",
  
  // 工具栏扩展
  toolbarItems: [
    {
      id: "run",
      label: "Run",
      icon: Play,
      onClick: () => startWebContainer(),
      group: "right",
    },
    {
      id: "stop",
      label: "Stop",
      icon: Square,
      onClick: () => stopWebContainer(),
      group: "right",
    },
  ],
  
  // 默认文件
  defaultFiles: defaultReactFiles,
  
  // 模板
  templates: reactTemplates,
};
```

---

## 4. 迁移策略

### 4.1 阶段划分

```
Phase 1: 基础架构 (1-2天)
├── 创建核心类型定义
├── 实现 FileManager
├── 实现 LayoutManager
└── 创建组件骨架

Phase 2: 编辑器适配 (2-3天)
├── 实现 CodeMirrorAdapter
├── 实现 MonacoAdapter
└── 抽象编辑器接口

Phase 3: 预览系统 (1-2天)
├── 实现 HtmlPreview
├── 实现 WebContainerPreview
└── 统一预览接口

Phase 4: 插件系统 (2-3天)
├── 实现 PluginManager
├── 迁移 LaTeX 功能为插件
├── 迁移 React 功能为插件
└── 测试插件热插拔

Phase 5: UI 统一 (1-2天)
├── 统一 Toolbar 组件
├── 统一 FileTree/FileTabs
├── 统一 StatusBar
└── 主题系统

Phase 6: 测试与优化 (1-2天)
├── 功能测试
├── 性能优化
└── 文档完善
```

### 4.2 向后兼容

保留原有组件作为包装器：

```tsx
// 保持向后兼容
export function LatexEditorPreview(props) {
  return <PisaEditor mode="latex" {...props} />;
}

export function CodePlayground(props) {
  return <PisaEditor mode="code" plugin={reactPlugin} {...props} />;
}
```

---

## 5. 收益分析

### 5.1 代码复用

| 模块 | 当前重复代码 | 统一后 |
|------|-------------|--------|
| 布局管理 | ~200 行 × 2 | ~200 行 |
| 文件管理 | ~150 行 × 2 | ~150 行 |
| 主题系统 | ~100 行 × 2 | ~100 行 |
| 工具栏 | ~150 行 × 2 | ~150 行 |
| **总计** | ~1200 行 | ~600 行 |

**预计减少 50% 重复代码**

### 5.2 可扩展性

- 新增语言支持只需添加插件
- 预览方式可自由组合
- 工具栏完全可定制
- 支持第三方插件

### 5.3 维护性

- 统一的 bug 修复路径
- 一致的 UI/UX
- 集中的类型定义
- 更好的测试覆盖

---

## 6. 技术决策

### 6.1 编辑器选择

| 场景 | 推荐引擎 | 原因 |
|------|---------|------|
| LaTeX | CodeMirror 6 | 轻量、LaTeX 语法支持好 |
| TypeScript | Monaco | 原生 TS 支持、IntelliSense |
| Markdown | CodeMirror 6 | 轻量、扩展性好 |
| 通用代码 | Monaco | VS Code 体验 |

### 6.2 状态管理

使用 Zustand 管理全局状态：

```typescript
interface EditorStore {
  // 文件状态
  files: FileSystem;
  activeFile: string | null;
  
  // 编辑器状态
  theme: Theme;
  layout: LayoutMode;
  
  // 预览状态
  previewUrl: string;
  previewError: string | null;
  
  // WebContainer 状态
  containerStatus: ContainerStatus;
  logs: string[];
  
  // Actions
  setActiveFile: (path: string) => void;
  updateFile: (path: string, content: string) => void;
  // ...
}
```

### 6.3 关键依赖

```json
{
  "dependencies": {
    // 编辑器
    "@codemirror/view": "^6.x",
    "@codemirror/state": "^6.x",
    "codemirror-lang-latex": "^1.x",
    "@monaco-editor/react": "^4.x",
    
    // 渲染
    "katex": "^0.16.x",
    "@webcontainer/api": "^1.x",
    
    // 状态管理
    "zustand": "^4.x",
    
    // UI
    "lucide-react": "^0.x"
  }
}
```

---

## 7. 风险与挑战

### 7.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 两个编辑器引擎体积大 | 包大小增加 | 动态导入、按需加载 |
| WebContainer 兼容性 | 部分浏览器不支持 | 优雅降级、错误提示 |
| 插件 API 稳定性 | 频繁变更影响插件 | 严格版本控制、deprecation 周期 |

### 7.2 实施风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 迁移期功能中断 | 用户体验受损 | 保持向后兼容、渐进迁移 |
| 性能回归 | 编辑体验下降 | 性能基准测试、持续监控 |

---

## 8. 结论

### 8.1 推荐方案

**采用插件式统一架构**，原因：

1. **高度相似的布局结构** - 可复用 50%+ 代码
2. **清晰的扩展边界** - 编辑器/预览/工具栏均可插件化
3. **未来扩展需求** - Markdown、Python 等语言支持
4. **维护成本降低** - 统一的 bug 修复和功能迭代

### 8.2 下一步行动

1. **确认设计方案** - 与团队讨论并确定技术选型
2. **创建基础架构** - 按 Phase 1 开始实施
3. **迁移 LaTeX 插件** - 验证插件系统可行性
4. **迁移 Code 插件** - 完成核心功能
5. **发布统一组件** - 替换原有组件

---

*文档版本: 1.0*
*创建日期: 2026-01-18*
*作者: Pisa OS Team*
