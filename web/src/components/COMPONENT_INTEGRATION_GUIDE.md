# Pisa OS Component Integration Guide

> 组件封装与集成指南 - 用于 Agent 系统、沙箱、TS 后端和数据库联调

本文档详细描述了 Playground 中已稳定的组件，包括其数据要求、状态管理、接口需求，并提供简单的引用样例代码。

---

## 📋 目录

1. [编辑器组件 (Editors)](#编辑器组件-editors)
   - [AiEditor](#1-aieditor)
   - [PDF Reader](#2-pdf-reader)
   - [Monaco Editor](#3-monaco-editor)
   - [LaTeX Editor](#4-latex-editor)

2. [可视化组件 (Visualization)](#可视化组件-visualization)
   - [Code Playground](#5-code-playground)
   - [Bento Gallery](#6-bento-gallery)
   - [3D Viewer](#7-3d-viewer)

3. [数据管理组件 (Data Management)](#数据管理组件-data-management)
   - [AG Grid](#8-ag-grid)
   - [Jupyter Notebook](#9-jupyter-notebook)

4. [通用集成模式](#通用集成模式)
5. [Agent 系统集成](#agent-系统集成)
6. [API 端点设计](#api-端点设计)

---

## 编辑器组件 (Editors)

### 1. AiEditor

**状态**: `beta` | **位置**: `@/components/editors/previews/AiEditorPreview.tsx`

AI 增强的富文本编辑器，支持智能写作辅助、多种格式导出。

#### 数据类型定义

```typescript
// 编辑器配置
interface AiEditorConfig {
  /** 初始 HTML 内容 */
  content?: string;
  /** 占位符文本 */
  placeholder?: string;
  /** 只读模式 */
  readOnly?: boolean;
  /** 编辑器高度 */
  height?: string | number;
  /** 自定义工具栏按键 */
  toolbarKeys?: string[];
  /** 启用 AI 功能 */
  enableAI?: boolean;
  /** AI 模型标识 */
  aiModel?: string;
}

// 编辑器命令式句柄
interface AiEditorHandle {
  getHtml: () => string;
  getText: () => string;
  getMarkdown: () => string;
  setContent: (html: string) => void;
  clear: () => void;
  focus: () => void;
  getInstance: () => any;
}

// 组件属性
interface AiEditorProps {
  config?: AiEditorConfig;
  onChange?: (content: { html: string; text: string; markdown: string }) => void;
  onReady?: (editor: any) => void;
  onError?: (error: Error) => void;
  className?: string;
}
```

#### 状态管理

- **内部状态**: 编辑器实例 (`useRef`)、加载状态 (`useState`)、错误状态 (`useState`)
- **外部状态**: 通过 `onChange` 回调同步内容变更
- **持久化**: 内容可通过 `getHtml()` / `getMarkdown()` 导出存储

#### API 依赖

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/ai/chat` | POST | AI 写作辅助（流式 SSE） |

#### 使用示例

```tsx
import { AiEditor, AiEditorHandle } from "@/components/editors/previews/AiEditorPreview";
import { useRef, useCallback } from "react";

function DocumentEditor() {
  const editorRef = useRef<AiEditorHandle>(null);

  // 内容变更回调
  const handleChange = useCallback((content) => {
    console.log("Content updated:", content.text.length, "chars");
    // 可在此处触发自动保存
  }, []);

  // 保存到数据库
  const handleSave = async () => {
    const html = editorRef.current?.getHtml();
    const markdown = editorRef.current?.getMarkdown();
    
    await fetch("/api/documents", {
      method: "POST",
      body: JSON.stringify({ html, markdown }),
    });
  };

  return (
    <div className="h-full">
      <AiEditor
        ref={editorRef}
        config={{
          enableAI: true,
          height: 600,
          placeholder: "开始写作...",
        }}
        onChange={handleChange}
      />
      <button onClick={handleSave}>保存</button>
    </div>
  );
}
```

#### Agent 集成点

```typescript
// Agent 可调用的工具定义
const aiEditorTools = {
  // 获取当前文档内容
  getDocumentContent: () => editorRef.current?.getMarkdown(),
  
  // 设置文档内容
  setDocumentContent: (content: string) => {
    editorRef.current?.setContent(content);
  },
  
  // 追加内容
  appendContent: (content: string) => {
    const current = editorRef.current?.getHtml() || "";
    editorRef.current?.setContent(current + content);
  },
};
```

---

### 2. PDF Reader

**状态**: `stable` | **位置**: `@/components/editors/pdf-reader/`

全功能 PDF 阅读器，支持多文档管理、OCR 数据集成、AI 对话。

#### 数据类型定义

```typescript
// PDF 来源类型
type PDFSourceType = 'file' | 'url' | 'arxiv' | 'blob';

interface PDFSource {
  type: PDFSourceType;
  /** 文件路径或 URL */
  path: string;
  /** ArXiv ID (用于加载预处理的 OCR 数据) */
  arxivId?: string;
  /** Blob 数据 (当 type 为 'blob' 时) */
  blob?: Blob;
}

// 论文元数据
interface PaperMetadata {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  categories: string[];
  total_pages: number;
  page_metas: PageMeta[];
}

// 论文上下文 (完整数据)
interface PaperContext {
  source: PDFSource;
  metadata: PaperMetadata | null;
  markdown: string;
  pages: PageContent[];
  detections: PageDetection[];
  images: ImageAsset[];
  hasOCRData: boolean;
  loadingState: 'idle' | 'loading_pdf' | 'loading_ocr' | 'ready' | 'error';
  error?: string;
}

// 组件属性
interface PDFReaderWrapperProps {
  /** 初始 PDF 源 */
  initialSource?: PDFSource;
  /** 关闭回调 */
  onClose: () => void;
}
```

#### 状态管理

使用 Zustand Store 管理多文档状态：

```typescript
// 多文档 Store (位于 @/components/editors/pdf-reader/store/multiDocumentStore.ts)
interface MultiDocumentState {
  documents: Map<string, DocumentState>;
  activeDocumentId: string | null;
  tabOrder: string[];
  
  // Actions
  openDocument: (source: PDFSource) => void;
  closeDocument: (id: string) => void;
  setActiveDocument: (id: string) => void;
  updateViewState: (id: string, state: Partial<ViewState>) => void;
}
```

#### API 依赖

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/ocr/[arxivId]/pdf` | GET | 获取 PDF 文件 |
| `/api/ocr/[arxivId]/metadata` | GET | 获取论文元数据 |
| `/api/ocr/[arxivId]/ocr` | GET | 获取 OCR 检测结果 |
| `/api/ocr/[arxivId]/images/[filename]` | GET | 获取提取的图片 |
| `/api/ai/chat` | POST | 论文 AI 对话 |

#### 使用示例

```tsx
import dynamic from "next/dynamic";
import { createPDFSource, type PDFSource } from "@/types/paperContext";

// 动态导入（避免 SSR 问题）
const PDFReaderWrapper = dynamic(
  () => import("@/components/editors/pdf-reader/PDFReaderWrapper"),
  { ssr: false }
);

function PaperViewer({ arxivId }: { arxivId: string }) {
  // 从 ArXiv ID 创建 PDF 源
  const source = createPDFSource.fromArxiv(arxivId);

  return (
    <div className="h-screen">
      <PDFReaderWrapper
        initialSource={source}
        onClose={() => console.log("Reader closed")}
      />
    </div>
  );
}

// 从 URL 加载
function UrlPaperViewer({ url }: { url: string }) {
  const source = createPDFSource.fromUrl(url);
  // ...
}

// 从 Blob 加载（用户上传）
function UploadedPaperViewer({ file }: { file: File }) {
  const blob = new Blob([file], { type: "application/pdf" });
  const source = createPDFSource.fromBlob(blob);
  // ...
}
```

#### Agent 集成点

```typescript
// Agent 可访问的论文上下文工具
const pdfReaderTools = {
  // 获取当前论文的全文 Markdown
  getPaperContent: (context: PaperContext) => context.markdown,
  
  // 获取特定页面的检测结果
  getPageDetections: (context: PaperContext, pageNum: number) => {
    return context.detections.find(d => d.page_number === pageNum);
  },
  
  // 搜索论文内容
  searchPaper: (context: PaperContext, query: string) => {
    return context.pages.filter(p => 
      p.content.toLowerCase().includes(query.toLowerCase())
    );
  },
  
  // 获取图表信息
  getFigures: (context: PaperContext) => {
    return context.detections.flatMap(d => 
      d.detections.filter(det => det.label === 'image' || det.label === 'figure')
    );
  },
};
```

---

### 3. Monaco Editor

**状态**: `stable` | **位置**: `@/components/editors/previews/MonacoEditorPreview.tsx`

VS Code 内核的代码编辑器，支持多文件、语法高亮、IntelliSense。

#### 数据类型定义

```typescript
// 文件数据
interface FileData {
  language: string;
  content: string;
}

// 文件映射
type Files = Record<string, FileData>;

// 编辑器配置
interface MonacoConfig {
  fontSize?: number;
  theme?: "vs-dark" | "light";
  minimap?: boolean;
  wordWrap?: "on" | "off";
  readOnly?: boolean;
}
```

#### 状态管理

- **文件状态**: `useState<Files>` - 管理多文件内容
- **活动文件**: `useState<string>` - 当前编辑的文件路径
- **编辑器设置**: `useState` - 主题、字号等配置

#### API 依赖

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/ai/complete` | POST | AI 代码补全（可选） |
| `/api/code/format` | POST | 代码格式化（可选） |
| `/api/code/lint` | POST | 代码检查（可选） |

> **注**: Monaco Editor 本身是纯客户端组件，上述 API 为可选的增强功能。

#### 使用示例

```tsx
import Editor, { OnMount } from "@monaco-editor/react";
import { useState, useCallback } from "react";

function CodeEditor() {
  const [files, setFiles] = useState<Files>({
    "main.ts": { language: "typescript", content: "// Start coding..." },
    "styles.css": { language: "css", content: "/* Styles */" },
  });
  const [activeFile, setActiveFile] = useState("main.ts");

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setFiles(prev => ({
        ...prev,
        [activeFile]: { ...prev[activeFile], content: value }
      }));
    }
  }, [activeFile]);

  // 编辑器挂载配置
  const handleMount: OnMount = (editor, monaco) => {
    // 配置 TypeScript
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      jsx: monaco.languages.typescript.JsxEmit.React,
    });
  };

  return (
    <Editor
      height="100%"
      language={files[activeFile]?.language}
      value={files[activeFile]?.content}
      theme="vs-dark"
      onChange={handleChange}
      onMount={handleMount}
      options={{
        fontSize: 14,
        minimap: { enabled: true },
        wordWrap: "on",
      }}
    />
  );
}
```

#### Agent 集成点

```typescript
// Agent 代码生成工具
const monacoTools = {
  // 创建新文件
  createFile: (path: string, content: string, language: string) => {
    setFiles(prev => ({
      ...prev,
      [path]: { content, language }
    }));
  },
  
  // 更新文件内容
  updateFile: (path: string, content: string) => {
    setFiles(prev => ({
      ...prev,
      [path]: { ...prev[path], content }
    }));
  },
  
  // 获取文件内容
  getFileContent: (path: string) => files[path]?.content,
  
  // 列出所有文件
  listFiles: () => Object.keys(files),
};
```

---

### 4. LaTeX Editor

**状态**: `beta` | **位置**: `@/components/editors/previews/LatexEditorPreview.tsx`

Overleaf 风格的 LaTeX 编辑器，支持实时预览、KaTeX 渲染。

#### 数据类型定义

```typescript
// TeX 文件
interface TexFile {
  name: string;
  content: string;
  type: "tex" | "bib" | "sty" | "cls";
}

// 视图布局
type ViewLayout = "split" | "editor" | "preview";

// 模板文件格式
interface TemplateFiles {
  files: {
    name: string;
    content?: string;
    type: "tex" | "bib" | "sty" | "cls";
  }[];
  mainFile: string;
}
```

#### 状态管理

- **文件列表**: `useState<TexFile[]>` - 项目中的所有文件
- **活动文件**: `useState<string>` - 当前编辑的文件名
- **预览内容**: `useState<string>` - 渲染后的 HTML
- **编辑器视图**: `EditorView` ref - CodeMirror 实例

#### API 依赖

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/latex/compile` | POST | 编译 LaTeX 到 PDF |
| `/api/latex/templates` | GET | 获取可用模板列表 |

#### 使用示例

```tsx
import { useState, useCallback } from "react";

function LatexProject() {
  const [files, setFiles] = useState<TexFile[]>([
    {
      name: "main.tex",
      type: "tex",
      content: `\\documentclass{article}
\\begin{document}
Hello, \\LaTeX!
\\end{document}`,
    },
  ]);
  const [activeFile, setActiveFile] = useState("main.tex");

  // 文件更新
  const updateFile = useCallback((name: string, content: string) => {
    setFiles(prev => prev.map(f => 
      f.name === name ? { ...f, content } : f
    ));
  }, []);

  // 编译
  const compile = async () => {
    const response = await fetch("/api/latex/compile", {
      method: "POST",
      body: JSON.stringify({ files, mainFile: "main.tex" }),
    });
    const { pdfUrl } = await response.json();
    // 打开或下载 PDF
  };

  return (
    <div className="grid grid-cols-2 h-full">
      {/* Editor */}
      <div>{/* CodeMirror with LaTeX syntax */}</div>
      {/* Preview */}
      <div>{/* KaTeX rendered preview */}</div>
    </div>
  );
}
```

#### Agent 集成点

```typescript
// Agent 论文写作工具
const latexTools = {
  // 插入 LaTeX 片段
  insertSnippet: (snippet: string) => {
    // 插入到光标位置
  },
  
  // 获取项目文件
  getProjectFiles: () => files,
  
  // 更新主文档
  updateMainDocument: (content: string) => {
    updateFile("main.tex", content);
  },
  
  // 添加参考文献
  addBibEntry: (bibtex: string) => {
    const bibFile = files.find(f => f.type === "bib");
    if (bibFile) {
      updateFile(bibFile.name, bibFile.content + "\n" + bibtex);
    }
  },
};
```

---

## 可视化组件 (Visualization)

### 5. Code Playground

**状态**: `beta` | **位置**: `@/components/editors/previews/code-playground/`

集成 IDE，支持 Monaco Editor + WebContainer + 实时预览。

#### 数据类型定义

```typescript
// 模板类型
type TemplateType = "react" | "vue" | "vanilla" | "custom";

// 布局模式
type LayoutMode = "horizontal" | "vertical" | "editor-only" | "preview-only";

// 容器状态
type ContainerStatus = 
  | "idle" | "booting" | "mounting" 
  | "installing" | "starting" | "ready" | "error";

// 文件数据
interface FileData {
  content: string;
  language: string;
}

// 文件映射
type FilesMap = Record<string, FileData>;

// 回调函数
interface CodePlaygroundCallbacks {
  onFilesChange?: (files: FilesMap) => void;
  onFileSelect?: (path: string) => void;
  onStatusChange?: (status: ContainerStatus) => void;
  onPreviewReady?: (url: string) => void;
  onError?: (error: string) => void;
  onLogsUpdate?: (logs: string[]) => void;
}

// 组件属性
interface CodePlaygroundProps {
  template?: TemplateType;
  initialFiles?: FilesMap;
  layout?: LayoutMode;
  panels?: { showFileTree?: boolean; showTerminal?: boolean };
  theme?: "vs-dark" | "light";
  autoStart?: boolean;
  readOnly?: boolean;
  hideToolbar?: boolean;
  className?: string;
  callbacks?: CodePlaygroundCallbacks;
}

// 命令式句柄
interface CodePlaygroundHandle {
  getFiles: () => FilesMap;
  setFiles: (files: FilesMap) => void;
  getFileContent: (path: string) => string | undefined;
  updateFile: (path: string, content: string) => void;
  start: () => Promise<void>;
  stop: () => void;
  restart: () => void;
  getStatus: () => ContainerStatus;
  getPreviewUrl: () => string;
  exportFiles: () => string;
  importFiles: (json: string) => void;
}
```

#### 使用示例

```tsx
import { CodePlayground, CodePlaygroundHandle } from "@/components/editors/previews/code-playground";
import { useRef, useCallback } from "react";

function InteractiveDemo() {
  const playgroundRef = useRef<CodePlaygroundHandle>(null);

  const handleFilesChange = useCallback((files: FilesMap) => {
    console.log("Files updated:", Object.keys(files));
  }, []);

  const handlePreviewReady = useCallback((url: string) => {
    console.log("Preview available at:", url);
  }, []);

  // Agent 生成代码后更新
  const updateFromAgent = (generatedCode: string) => {
    playgroundRef.current?.updateFile("src/App.jsx", generatedCode);
    playgroundRef.current?.restart();
  };

  return (
    <CodePlayground
      ref={playgroundRef}
      template="react"
      autoStart={true}
      layout="horizontal"
      callbacks={{
        onFilesChange: handleFilesChange,
        onPreviewReady: handlePreviewReady,
      }}
    />
  );
}
```

#### Agent 集成点

```typescript
// Agent 代码沙箱工具
const playgroundTools = {
  // 执行代码（生成 + 运行）
  executeCode: async (files: FilesMap) => {
    playgroundRef.current?.setFiles(files);
    await playgroundRef.current?.start();
    return playgroundRef.current?.getPreviewUrl();
  },
  
  // 获取运行状态
  getStatus: () => playgroundRef.current?.getStatus(),
  
  // 获取终端日志（用于调试）
  getLogs: () => webContainer.logs,
  
  // 停止执行
  stop: () => playgroundRef.current?.stop(),
};
```

---

### 6. Bento Gallery

**状态**: `stable` | **位置**: `@/components/editors/previews/BentoGalleryPreview.tsx`

交互式图片画廊，支持 Bento Grid 布局、拖拽滚动、灯箱预览。

#### 数据类型定义

```typescript
// 图片项
interface ImageItem {
  id: number | string;
  title: string;
  desc: string;
  url: string;
  /** CSS Grid 跨度 (如 "md:col-span-2 md:row-span-2") */
  span?: string;
}

// 组件属性
interface BentoGalleryProps {
  imageItems: ImageItem[];
  title?: string;
  description?: string;
}
```

#### 状态管理

- **图片列表**: `useState<ImageItem[]>` - 画廊中的图片数据
- **选中图片**: `useState<string | null>` - 灯箱展示的图片 ID
- **配置项**: `useState` - 标题、描述等配置

#### API 依赖

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/papers/:arxivId/figures` | GET | 获取论文图片列表 |
| `/api/assets/images` | GET | 获取用户上传的图片 |
| `/api/ai/describe-image` | POST | AI 图片描述生成（可选） |

#### 使用示例

```tsx
import InteractiveImageBentoGallery from "@/components/ui/bento-gallery";

function FigureGallery() {
  const figures: ImageItem[] = [
    {
      id: 1,
      title: "Figure 1",
      desc: "Network Architecture",
      url: "/api/papers/2301.00001/figures/fig1.png",
      span: "md:col-span-2 md:row-span-2",
    },
    {
      id: 2,
      title: "Figure 2",
      desc: "Results Comparison",
      url: "/api/papers/2301.00001/figures/fig2.png",
      span: "md:row-span-1",
    },
  ];

  return (
    <InteractiveImageBentoGallery
      imageItems={figures}
      title="Paper Figures"
      description="All figures from the paper"
    />
  );
}
```

#### Agent 集成点

```typescript
// Agent 图片管理工具
const galleryTools = {
  // 从论文提取图片
  extractFigures: async (paperContext: PaperContext) => {
    return paperContext.images.map((img, idx) => ({
      id: img.id,
      title: `Figure ${idx + 1}`,
      desc: img.caption || "",
      url: img.path,
    }));
  },
  
  // 生成图片描述
  generateCaptions: async (images: ImageItem[]) => {
    // 调用视觉模型生成描述
  },
};
```

---

### 7. 3D Viewer

**状态**: `beta` | **位置**: `@/components/editors/previews/ThreeViewerPreview.tsx`

3D 模型查看器，支持 GLTF/GLB/OBJ 格式，轨道控制、环境贴图。

#### 数据类型定义

```typescript
// 模型信息
interface ModelInfo {
  name: string;
  vertices: number;
  faces: number;
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
}

// 视图模式
type ViewMode = "solid" | "wireframe" | "both";

// 环境预设
type EnvironmentPreset = 
  | "city" | "sunset" | "dawn" | "night" 
  | "warehouse" | "forest" | "apartment" 
  | "studio" | "park" | "lobby";

// 模型属性
interface ModelProps {
  url: string;
  viewMode: ViewMode;
  onLoad: (info: ModelInfo) => void;
}
```

#### 状态管理

- **当前模型**: `useState<string>` - 当前加载的模型 URL
- **模型信息**: `useState<ModelInfo | null>` - 模型统计数据
- **视图设置**: `useState` - 视图模式、网格显示、阴影等
- **相机控制**: `useRef<OrbitControls>` - 轨道控制器引用

#### API 依赖

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/models` | GET | 获取可用模型列表 |
| `/api/models/upload` | POST | 上传 3D 模型文件 |
| `/api/models/:id` | GET | 获取模型文件 |

> **注**: 也可直接加载外部 URL（如 GitHub raw、CDN 等）

#### 使用示例

```tsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF } from "@react-three/drei";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function ModelViewer({ modelUrl }: { modelUrl: string }) {
  return (
    <Canvas camera={{ position: [3, 3, 3] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} />
      <Environment preset="city" />
      <Model url={modelUrl} />
      <OrbitControls />
    </Canvas>
  );
}
```

#### Agent 集成点

```typescript
// Agent 3D 可视化工具
const viewerTools = {
  // 加载模型
  loadModel: (url: string) => {
    setModelUrl(url);
  },
  
  // 获取模型信息
  getModelInfo: () => modelInfo,
  
  // 设置视图模式
  setViewMode: (mode: ViewMode) => {
    setViewMode(mode);
  },
  
  // 重置相机
  resetCamera: () => {
    controlsRef.current?.reset();
  },
  
  // 截图
  captureScreenshot: () => {
    const canvas = document.querySelector('canvas');
    return canvas?.toDataURL('image/png');
  },
  
  // 从论文加载 3D 图表（如果有）
  loadFromPaper: async (paperContext: PaperContext, figureId: string) => {
    const figure = paperContext.images.find(img => img.id === figureId);
    if (figure?.path.endsWith('.glb') || figure?.path.endsWith('.gltf')) {
      setModelUrl(figure.path);
    }
  },
};
```

---

## 数据管理组件 (Data Management)

### 8. AG Grid

**状态**: `stable` | **位置**: `@/components/editors/previews/AGGridPreview.tsx`

高性能数据表格，支持排序、过滤、分页、单元格编辑、CSV 导出。

#### 数据类型定义

```typescript
import { 
  ColDef, 
  GridApi, 
  GridReadyEvent,
  CellValueChangedEvent,
  SelectionChangedEvent,
} from "ag-grid-community";

// 数据行类型（根据业务定义）
interface RowData {
  id: number;
  [key: string]: any;
}

// 列定义
const columnDefs: ColDef[] = [
  { field: "id", headerName: "ID", width: 70 },
  { field: "title", headerName: "Title", flex: 1, editable: true },
  { field: "status", headerName: "Status", cellRenderer: StatusRenderer },
  // ...
];

// 自定义单元格渲染器
function StatusRenderer(props: { value: string }) {
  const colors = {
    "Published": "bg-green-500",
    "Draft": "bg-gray-500",
  };
  return <span className={colors[props.value]}>{props.value}</span>;
}
```

#### 状态管理

- **行数据**: `useState<RowData[]>` - 表格数据
- **选中行**: `useState<RowData[]>` - 当前选中的行
- **Grid API**: `useState<GridApi>` - AG Grid 实例 API
- **过滤状态**: 通过 `gridApi.getFilterModel()` 获取

#### API 依赖

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/data/:resource` | GET | 获取表格数据 |
| `/api/data/:resource` | POST | 创建新记录 |
| `/api/data/:resource/:id` | PUT | 更新记录 |
| `/api/data/:resource/:id` | DELETE | 删除记录 |
| `/api/data/:resource/export` | GET | 导出数据（CSV/Excel） |

#### 使用示例

```tsx
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, themeQuartz } from "ag-grid-community";
import { useState, useCallback, useRef } from "react";

// 注册模块
ModuleRegistry.registerModules([AllCommunityModule]);

function DataTable<T extends RowData>({ 
  data, 
  columns,
  onRowChange,
}: { 
  data: T[];
  columns: ColDef<T>[];
  onRowChange?: (data: T) => void;
}) {
  const gridRef = useRef<AgGridReact<T>>(null);
  const [gridApi, setGridApi] = useState<GridApi<T> | null>(null);

  const onGridReady = useCallback((params: GridReadyEvent<T>) => {
    setGridApi(params.api);
  }, []);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent<T>) => {
    onRowChange?.(event.data);
  }, [onRowChange]);

  // 导出 CSV
  const exportCsv = () => {
    gridApi?.exportDataAsCsv({ fileName: "export.csv" });
  };

  // 自定义暗色主题
  const theme = themeQuartz.withParams({
    backgroundColor: "#0f172a",
    foregroundColor: "#e2e8f0",
    headerBackgroundColor: "#1e293b",
  });

  return (
    <div className="h-full">
      <AgGridReact<T>
        ref={gridRef}
        rowData={data}
        columnDefs={columns}
        theme={theme}
        onGridReady={onGridReady}
        onCellValueChanged={onCellValueChanged}
        rowSelection="multiple"
        pagination={true}
        paginationPageSize={20}
      />
    </div>
  );
}
```

#### Agent 集成点

```typescript
// Agent 数据操作工具
const gridTools = {
  // 查询数据
  queryData: (filter: Record<string, any>) => {
    gridApi?.setFilterModel(filter);
    return gridApi?.getDisplayedRowCount();
  },
  
  // 添加行
  addRow: (row: RowData) => {
    setData(prev => [row, ...prev]);
  },
  
  // 更新行
  updateRow: (id: number, updates: Partial<RowData>) => {
    setData(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  },
  
  // 导出数据
  exportData: () => {
    return JSON.stringify(data);
  },
  
  // 批量操作
  bulkUpdate: (ids: number[], updates: Partial<RowData>) => {
    setData(prev => prev.map(r => 
      ids.includes(r.id) ? { ...r, ...updates } : r
    ));
  },
};
```

---

### 9. Jupyter Notebook

**状态**: `beta` | **位置**: `@/components/editors/jupyter/`

交互式 Notebook，支持 Python 执行、富输出渲染、AI Agent 集成。

#### 数据类型定义

```typescript
// Cell 类型
type CellType = "code" | "markdown" | "raw";

// Cell 状态
type CellStatus = "idle" | "running" | "success" | "error";

// Notebook Cell
interface NotebookCell {
  id: string;
  type: CellType;
  source: string;
  outputs: CellOutput[];
  executionCount: number | null;
  status: CellStatus;
  metadata: Record<string, any>;
}

// Cell 输出
interface CellOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  data?: Record<string, any>;
  text?: string;
  traceback?: string[];
}

// Notebook Store
interface NotebookState {
  cells: NotebookCell[];
  activeCellId: string | null;
  kernelStatus: "idle" | "busy" | "disconnected";
  
  // Actions
  addCell: (type: CellType, index?: number) => void;
  deleteCell: (id: string) => void;
  updateCellSource: (id: string, source: string) => void;
  executeCell: (id: string) => Promise<void>;
  executeAllCells: () => Promise<void>;
}
```

#### API 依赖

| 端点 | 方法 | 用途 |
|------|------|------|
| Jupyter Server WebSocket | WS | Kernel 通信 |
| `/api/kernels` | GET/POST | Kernel 管理 |
| `/api/sessions` | GET/POST | Session 管理 |

#### 使用示例

```tsx
import { JupyterNotebook } from "@/components/editors/jupyter";

function DataAnalysis() {
  return (
    <JupyterNotebook
      serverUrl="http://localhost:8888"
      token=""  // 本地开发可为空
      className="h-full"
    />
  );
}
```

#### Agent 集成点

```typescript
// Agent 数据分析工具
const jupyterTools = {
  // 执行代码
  executeCode: async (code: string) => {
    const cellId = addCell("code");
    updateCellSource(cellId, code);
    return await executeCell(cellId);
  },
  
  // 获取变量
  getVariables: async () => {
    return await executeCode("dir()");
  },
  
  // 生成可视化
  createVisualization: async (data: any, chartType: string) => {
    const code = generatePlotCode(data, chartType);
    return await executeCode(code);
  },
  
  // 安装包
  installPackage: async (packageName: string) => {
    return await executeCode(`!pip install ${packageName}`);
  },
};
```

---

## 通用集成模式

### 组件包装器模式

为了与 Agent 系统集成，建议使用以下包装器模式：

```typescript
// ComponentWrapper.tsx
import { forwardRef, useImperativeHandle, useRef } from "react";

export interface ComponentAPI {
  // 组件暴露给 Agent 的方法
  getData: () => any;
  setData: (data: any) => void;
  execute: (action: string, params?: any) => Promise<any>;
}

export const ComponentWrapper = forwardRef<ComponentAPI, Props>((props, ref) => {
  const internalRef = useRef<InternalHandle>(null);

  useImperativeHandle(ref, () => ({
    getData: () => internalRef.current?.getData(),
    setData: (data) => internalRef.current?.setData(data),
    execute: async (action, params) => {
      switch (action) {
        case "save":
          return await saveData();
        case "export":
          return internalRef.current?.export();
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  }));

  return <OriginalComponent ref={internalRef} {...props} />;
});
```

### 事件总线模式

组件间通信使用事件总线：

```typescript
// eventBus.ts
import { EventEmitter } from "events";

class ComponentEventBus extends EventEmitter {
  // 组件注册
  registerComponent(id: string, api: ComponentAPI) {
    this.emit("component:registered", { id, api });
  }

  // 组件通信
  sendToComponent(targetId: string, event: string, data: any) {
    this.emit(`component:${targetId}:${event}`, data);
  }

  // Agent 命令
  executeAgentCommand(componentId: string, command: string, params: any) {
    this.emit(`agent:command`, { componentId, command, params });
  }
}

export const eventBus = new ComponentEventBus();
```

---

## Agent 系统集成

### Agent 工具注册

```typescript
// agentTools.ts
import type { AgentTool } from "@/types/agent";

export const componentTools: AgentTool[] = [
  {
    name: "editor_get_content",
    description: "获取编辑器当前内容",
    parameters: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["html", "markdown", "text"] },
      },
    },
    execute: async ({ format }) => {
      const api = getComponentAPI("editor");
      return api.getData()[format];
    },
  },
  {
    name: "pdf_search",
    description: "在 PDF 中搜索内容",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        pageRange: { type: "array", items: { type: "number" } },
      },
      required: ["query"],
    },
    execute: async ({ query, pageRange }) => {
      const api = getComponentAPI("pdfReader");
      return api.execute("search", { query, pageRange });
    },
  },
  {
    name: "code_execute",
    description: "在沙箱中执行代码",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
        language: { type: "string", enum: ["javascript", "python"] },
      },
      required: ["code"],
    },
    execute: async ({ code, language }) => {
      if (language === "python") {
        const api = getComponentAPI("jupyter");
        return api.execute("run", { code });
      } else {
        const api = getComponentAPI("playground");
        return api.execute("run", { code });
      }
    },
  },
];
```

### Agent 上下文构建

```typescript
// contextBuilder.ts
export function buildAgentContext(components: Record<string, ComponentAPI>) {
  return {
    // 当前活动的组件
    activeComponent: getCurrentActiveComponent(),
    
    // 各组件状态摘要
    componentStates: Object.fromEntries(
      Object.entries(components).map(([id, api]) => [
        id,
        { status: api.getStatus?.(), dataPreview: api.getData?.()?.slice?.(0, 100) }
      ])
    ),
    
    // 可用工具列表
    availableTools: componentTools.map(t => t.name),
    
    // 用户上下文
    userContext: {
      currentDocument: getCurrentDocument(),
      recentActions: getRecentActions(),
    },
  };
}
```

---

## API 端点设计

### 推荐的后端端点

```typescript
// 文档相关
POST   /api/documents                 // 保存文档
GET    /api/documents/:id             // 获取文档
PUT    /api/documents/:id             // 更新文档
DELETE /api/documents/:id             // 删除文档

// PDF/论文相关
GET    /api/papers                    // 列出论文库
POST   /api/papers/upload             // 上传 PDF
GET    /api/papers/:arxivId/pdf       // 获取 PDF 文件
GET    /api/papers/:arxivId/metadata  // 获取元数据
GET    /api/papers/:arxivId/ocr       // 获取 OCR 数据
GET    /api/papers/:arxivId/figures   // 获取提取的图片

// 代码执行
POST   /api/sandbox/execute           // 执行代码
GET    /api/sandbox/status/:id        // 获取执行状态
DELETE /api/sandbox/session/:id       // 终止会话

// AI 相关
POST   /api/ai/chat                   // AI 对话 (SSE)
POST   /api/ai/complete               // AI 补全
POST   /api/ai/analyze                // 内容分析

// Jupyter 相关
GET    /api/jupyter/kernels           // 列出 Kernels
POST   /api/jupyter/kernels           // 创建 Kernel
DELETE /api/jupyter/kernels/:id       // 终止 Kernel
WS     /api/jupyter/ws/:kernelId      // Kernel WebSocket
```

---

## 数据库 Schema 参考

```sql
-- 文档表
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title VARCHAR(255),
  content_html TEXT,
  content_markdown TEXT,
  component_type VARCHAR(50),  -- 'aieditor', 'latex', 'notebook'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 论文表
CREATE TABLE papers (
  id UUID PRIMARY KEY,
  arxiv_id VARCHAR(50) UNIQUE,
  title VARCHAR(500),
  authors TEXT[],
  abstract TEXT,
  pdf_path VARCHAR(255),
  ocr_status VARCHAR(20),  -- 'pending', 'processing', 'completed', 'failed'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 用户会话表 (用于 Jupyter/Sandbox)
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_type VARCHAR(50),  -- 'jupyter', 'webcontainer'
  config JSONB,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP
);

-- 工件/产出物表
CREATE TABLE artifacts (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  artifact_type VARCHAR(50),  -- 'figure', 'table', 'code', 'document'
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 快速引用

### 组件导入路径

```typescript
// 编辑器
import { AiEditor } from "@/components/editors/previews/AiEditorPreview";
import PDFReaderWrapper from "@/components/editors/pdf-reader/PDFReaderWrapper";
import MonacoEditor from "@/components/editors/previews/MonacoEditorPreview";
import LatexEditor from "@/components/editors/previews/LatexEditorPreview";

// 可视化
import { CodePlayground } from "@/components/editors/previews/code-playground";
import BentoGalleryPreview from "@/components/editors/previews/BentoGalleryPreview";
import ThreeViewerPreview from "@/components/editors/previews/ThreeViewerPreview";

// 数据管理
import AGGridPreview from "@/components/editors/previews/AGGridPreview";
import { JupyterNotebook } from "@/components/editors/jupyter";

// 类型
import { PDFSource, PaperContext, createPDFSource } from "@/types/paperContext";
import { FilesMap, CodePlaygroundHandle } from "@/components/editors/previews/code-playground/types";
```

### 常用 Hooks

```typescript
// PDF Reader Store
import { useMultiDocumentStore } from "@/components/editors/pdf-reader/store/multiDocumentStore";

// Jupyter Store
import { useNotebookStore } from "@/components/editors/jupyter/store/notebookStore";
import { useArtifactStore } from "@/components/editors/jupyter/store/artifactStore";

// Agent Store
import { useAgentStore } from "@/components/agent/store/agentStore";
```

---

*文档版本: 1.0.0 | 最后更新: 2026-01-28*
