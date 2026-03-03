# Code Playground

一个集成的在线 IDE 组件，支持 React/Vue/Vanilla JS 项目的代码编辑和实时预览。

## 特性

- 🔧 **Monaco Editor** - VS Code 同款代码编辑器，支持语法高亮、智能提示
- 📦 **WebContainer** - 浏览器内 Node.js 运行时，无需后端服务
- 🌲 **文件树** - 可视化项目结构，支持文件切换
- 🖥️ **实时预览** - iframe 内嵌预览，支持热更新
- 💻 **终端输出** - 显示 npm install 和 dev server 日志
- 🎨 **多布局模式** - 水平/垂直/仅编辑器 多种布局切换
- 📤 **导入导出** - 项目文件 JSON 导入导出

## 安装依赖

```bash
npm install @webcontainer/api @monaco-editor/react
```

## 基础用法

```tsx
import { CodePlayground } from "@/components/editors/previews/code-playground";

function MyPage() {
  return (
    <div className="h-screen">
      <CodePlayground template="react" />
    </div>
  );
}
```

> **注意**: WebContainer 需要跨域隔离 (COOP/COEP) headers。确保页面路由已配置相应的 headers，或通过 `/playground` 路由访问。

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `template` | `TemplateType` | `"react"` | 项目模板类型 |
| `initialFiles` | `FilesMap` | - | 自定义初始文件（覆盖模板） |
| `layout` | `LayoutMode` | `"horizontal"` | 布局模式 |
| `panels` | `PanelConfig` | - | 面板可见性配置 |
| `theme` | `"vs-dark" \| "light"` | `"vs-dark"` | 编辑器主题 |
| `autoStart` | `boolean` | `false` | 挂载后自动启动 WebContainer |
| `readOnly` | `boolean` | `false` | 只读模式（禁用编辑） |
| `hideToolbar` | `boolean` | `false` | 隐藏顶部工具栏 |
| `className` | `string` | - | 自定义 CSS 类名 |
| `callbacks` | `CodePlaygroundCallbacks` | - | 事件回调函数 |

### TemplateType

```ts
type TemplateType = "react" | "vue" | "vanilla" | "custom";
```

### LayoutMode

```ts
type LayoutMode = "horizontal" | "vertical" | "editor-only" | "preview-only";
```

### PanelConfig

```ts
interface PanelConfig {
  showFileTree?: boolean;   // 显示文件树（默认 true）
  showTerminal?: boolean;   // 显示终端（默认 true）
  showPreview?: boolean;    // 显示预览（默认 true）
}
```

### CodePlaygroundCallbacks

```ts
interface CodePlaygroundCallbacks {
  onFilesChange?: (files: FilesMap) => void;      // 文件变更
  onFileSelect?: (path: string) => void;          // 文件选择
  onStatusChange?: (status: ContainerStatus) => void;  // 状态变更
  onPreviewReady?: (url: string) => void;         // 预览就绪
  onError?: (error: string) => void;              // 错误发生
  onLogsUpdate?: (logs: string[]) => void;        // 日志更新
}
```

## Ref Handle (编程式控制)

通过 `ref` 可以获取组件实例，进行编程式控制：

```tsx
import { useRef } from "react";
import { CodePlayground, CodePlaygroundHandle } from "@/components/editors/previews/code-playground";

function MyPage() {
  const playgroundRef = useRef<CodePlaygroundHandle>(null);

  const handleExport = () => {
    const json = playgroundRef.current?.exportFiles();
    console.log(json);
  };

  return (
    <>
      <button onClick={handleExport}>导出项目</button>
      <CodePlayground ref={playgroundRef} template="react" />
    </>
  );
}
```

### CodePlaygroundHandle 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `getFiles` | `() => FilesMap` | 获取当前所有文件 |
| `setFiles` | `(files: FilesMap) => void` | 设置文件（替换全部） |
| `getFileContent` | `(path: string) => string \| undefined` | 获取指定文件内容 |
| `updateFile` | `(path: string, content: string) => void` | 更新单个文件 |
| `start` | `() => Promise<void>` | 启动 WebContainer |
| `stop` | `() => void` | 停止 WebContainer |
| `restart` | `() => void` | 重启 WebContainer |
| `getStatus` | `() => ContainerStatus` | 获取当前状态 |
| `getPreviewUrl` | `() => string` | 获取预览 URL |
| `exportFiles` | `() => string` | 导出文件为 JSON 字符串 |
| `importFiles` | `(json: string) => void` | 从 JSON 字符串导入文件 |

## 高级用法

### 自定义初始文件

```tsx
import { CodePlayground, FilesMap } from "@/components/editors/previews/code-playground";

const customFiles: FilesMap = {
  "package.json": {
    language: "json",
    content: JSON.stringify({
      name: "my-project",
      scripts: { dev: "vite --host" },
      dependencies: { react: "^18.2.0" },
      devDependencies: { vite: "^5.0.0" }
    }, null, 2)
  },
  "index.html": {
    language: "html",
    content: `<!DOCTYPE html>
<html>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>`
  },
  "main.jsx": {
    language: "javascript",
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return <h1>Hello Custom Project!</h1>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);`
  }
};

function MyPage() {
  return (
    <CodePlayground
      template="custom"
      initialFiles={customFiles}
    />
  );
}
```

### 事件监听

```tsx
<CodePlayground
  template="react"
  callbacks={{
    onFilesChange: (files) => {
      // 可用于自动保存
      console.log("Files changed:", Object.keys(files));
    },
    onStatusChange: (status) => {
      // 可用于显示加载状态
      if (status === "ready") {
        console.log("Development server is ready!");
      }
    },
    onPreviewReady: (url) => {
      // 可用于在新窗口打开预览
      console.log("Preview available at:", url);
    },
    onError: (error) => {
      // 错误处理
      alert(`Error: ${error}`);
    }
  }}
/>
```

### 嵌入到其他布局

```tsx
// 作为可调整大小的面板
<div className="flex h-screen">
  <aside className="w-64 bg-gray-100">
    {/* 侧边栏内容 */}
  </aside>
  <main className="flex-1">
    <CodePlayground
      template="react"
      hideToolbar={false}
      panels={{ showFileTree: true, showTerminal: true }}
    />
  </main>
</div>
```

## 使用模板

组件内置三种项目模板：

### React 模板

基于 Vite 的 React 项目，包含：
- `package.json` - 依赖配置
- `vite.config.js` - Vite 配置
- `index.html` - 入口 HTML
- `src/main.jsx` - React 入口
- `src/App.jsx` - 主组件
- `src/index.css` - 样式

### Vue 模板

基于 Vite 的 Vue 3 项目，包含：
- `package.json` - 依赖配置
- `vite.config.js` - Vite 配置
- `index.html` - 入口 HTML
- `src/main.js` - Vue 入口
- `src/App.vue` - 主组件
- `src/style.css` - 样式

### Vanilla 模板

原生 JavaScript 项目，包含：
- `package.json` - 依赖配置
- `index.html` - 入口 HTML
- `main.js` - JavaScript 入口
- `style.css` - 样式

## 获取模板

```tsx
import { getTemplate, getDefaultFile, templates } from "@/components/editors/previews/code-playground";

// 获取 React 模板文件
const reactFiles = getTemplate("react");

// 获取模板的默认选中文件
const defaultFile = getDefaultFile("react"); // "src/App.jsx"

// 直接访问模板对象
const { react, vue, vanilla } = templates;
```

## 使用 Hook

`useWebContainer` hook 可以单独使用：

```tsx
import { useWebContainer } from "@/components/editors/previews/code-playground";

function MyComponent() {
  const webContainer = useWebContainer({
    callbacks: {
      onStatusChange: (status) => console.log(status),
    }
  });

  return (
    <div>
      <p>Status: {webContainer.status}</p>
      <button onClick={() => webContainer.start(myFiles)}>Start</button>
      <button onClick={() => webContainer.stop()}>Stop</button>
      {webContainer.previewUrl && (
        <iframe src={webContainer.previewUrl} />
      )}
    </div>
  );
}
```

## 文件结构

```
code-playground/
├── index.ts              # 统一导出
├── types.ts              # TypeScript 类型定义
├── templates.ts          # React/Vue/Vanilla 模板
├── useWebContainer.ts    # WebContainer hook
├── FileTree.tsx          # 文件树组件
├── CodePlayground.tsx    # 主组件
└── README.md             # 本文档
```

## 注意事项

### 跨域隔离要求

WebContainer 需要 SharedArrayBuffer，这要求页面启用跨域隔离：

```ts
// next.config.ts
async headers() {
  return [
    {
      source: '/your-route/:path*',
      headers: [
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    },
  ];
}
```

### 浏览器兼容性

WebContainer 支持以下浏览器：
- Chrome 90+
- Edge 90+
- Firefox 89+
- Safari 15.2+

### 性能考虑

- 首次启动 WebContainer 需要 2-5 秒（取决于网络和项目大小）
- npm install 会下载依赖，建议使用精简的依赖列表
- 建议在高性能设备上使用

## 许可证

MIT
