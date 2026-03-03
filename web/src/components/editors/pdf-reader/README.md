# PDF Reader Component

一个功能完整的 PDF 智能阅读器组件，支持标注、搜索、多种阅读模式和 AI 集成。

## 目录

- [架构概览](#架构概览)
- [层级系统](#层级系统)
- [核心功能](#核心功能)
- [文件结构](#文件结构)
- [使用方法](#使用方法)
- [扩展指南](#扩展指南)
- [功能开关](#功能开关)
- [已知问题与 TODO](#已知问题与-todo)

---

## 架构概览

PDF Reader 采用分层架构设计，每个层负责特定的功能：

```
┌─────────────────────────────────────────────────────┐
│                    PDFReader                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  IndexPanel │  │ PDFRenderer │  │ RightPanel  │  │
│  │   (左侧栏)   │  │  (PDF渲染)   │  │  (右侧栏)    │  │
│  └─────────────┘  └──────┬──────┘  └─────────────┘  │
│                          │                           │
│         ┌────────────────┼────────────────┐         │
│         ▼                ▼                ▼         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ TextLayer  │  │ Annotation │  │ Sentence   │    │
│  │            │  │   Layer    │  │   Layer    │    │
│  └────────────┘  └────────────┘  └────────────┘    │
│         │                │                │         │
│         └────────────────┼────────────────┘         │
│                          ▼                           │
│                 ┌────────────────┐                   │
│                 │ CustomSelection│                   │
│                 │     Layer      │                   │
│                 └────────────────┘                   │
└─────────────────────────────────────────────────────┘
```

---

## 层级系统

### zIndex 层级定义

| 层 | zIndex | pointer-events | 功能描述 |
|---|--------|----------------|----------|
| TextLayer | 2 | auto | PDF.js 原生文本渲染层 |
| AnnotationLayer | 5 | none (子元素 auto) | 高亮标注显示 |
| CustomSelectionLayer | 6 | auto (智能穿透) | 智能文本选择 |
| InteractionLayer | 10 | auto | 通用交互处理 |
| SentenceLayer | 15 | auto | 句子级别选择 (依赖 OCR) |
| SearchHighlight | - | none | 搜索结果高亮 |

### 层间交互规则

1. **CustomSelectionLayer** 是智能中间层：
   - 检测点击目标是否为交互式元素
   - 如果是交互式元素，让事件穿透到下层
   - 如果是空白区域或文本，启动文本选择

2. **交互式元素检测**：
   ```typescript
   const INTERACTIVE_SELECTORS = [
     '[data-annotation-id]',     // 标注元素
     '[data-sentence-id]',       // 句子元素
     '[data-image-id]',          // 图像元素（预留）
     '[data-table-id]',          // 表格元素（预留）
     '.annotation-item',         // 标注项
     '.sentence-box',            // 句子框
     '.interactive-element',     // 通用交互元素
   ];
   ```

---

## 核心功能

### 1. 文本选择
- **智能选择**：从空白处开始拖选时不会产生"反选"
- **精确选择**：字符级别的选择精度
- **双向选择**：支持从上到下和从下到上的选择
- **实现文件**：`components/layers/CustomSelectionLayer.tsx`

### 2. 标注系统
- **高亮标注**：选中文本后添加彩色高亮
- **标签管理**：右侧面板显示所有标签
- **评论功能**：为标签添加评论
- **实现文件**：`components/layers/AnnotationLayer.tsx`

### 3. 搜索功能
- **全文搜索**：在 PDF 内容中搜索
- **结果导航**：上一个/下一个搜索结果
- **高亮显示**：搜索结果高亮
- **实现文件**：`hooks/usePDFSearch.ts`

### 4. 阅读模式
- **单页模式**：一次显示一页
- **连续模式**：垂直滚动所有页面
- **双页模式**：并排显示两页

### 5. 句子选择 (TODO: 依赖 OCR 服务)
- **句子级选择**：基于 OCR 的句子边界选择
- **多选支持**：Cmd/Ctrl + 点击多选
- **实现文件**：`components/layers/SentenceLayer.tsx`

---

## 文件结构

```
src/components/editors/pdf-reader/
├── index.tsx                    # 主组件入口
├── type.ts                      # 类型定义
├── README.md                    # 本文档
│
├── components/
│   ├── PDFRenderer.tsx          # PDF 页面渲染
│   ├── PDFToolbar.tsx           # 顶部工具栏
│   ├── PDFStatus.tsx            # 状态显示
│   ├── IndexPanel.tsx           # 左侧目录面板
│   ├── UnifiedRightPanel.tsx    # 右侧统一面板
│   ├── SearchHighlight.tsx      # 搜索高亮
│   ├── ShortcutsFloatingButton.tsx # 快捷键按钮
│   │
│   ├── layers/                  # 分层组件
│   │   ├── TextLayer.tsx        # 文本渲染层
│   │   ├── AnnotationLayer.tsx  # 标注层
│   │   ├── SentenceLayer.tsx    # 句子选择层
│   │   ├── InteractionLayer.tsx # 交互层
│   │   ├── CanvasLayer.tsx      # 画布层
│   │   └── CustomSelectionLayer.tsx # 智能选择层
│   │
│   └── rightPanels/             # 右侧面板组件
│       ├── TagPanel.tsx         # 标签面板
│       ├── NotesPanel.tsx       # 笔记面板
│       └── index.ts
│
├── hooks/                       # 自定义 Hooks
│   ├── useEventHandlers.ts      # 事件处理
│   ├── usePDFSearch.ts          # PDF 搜索
│   └── useLayoutCalculation.ts  # 布局计算
│
├── store/                       # 状态管理
│   └── pdfStore.ts              # Zustand store
│
└── styles/
    └── pdf-reader.css           # 样式文件
```

---

## 使用方法

### 基本用法

```tsx
import PDFReader from '@/components/editors/pdf-reader';

function MyComponent() {
  const pdfData = {
    source_path: "/path/to/document.pdf",
    sents: {
      sentences: [] // OCR 句子数据（可选）
    }
  };

  return (
    <PDFReader
      pdfData={pdfData}
      paperId={12345}
      onClose={() => console.log('Reader closed')}
    />
  );
}
```

### Props 说明

| Prop | 类型 | 必填 | 描述 |
|------|------|------|------|
| pdfData | `{ source_path: string, sents?: object }` | 是 | PDF 数据 |
| paperId | `number` | 是 | 论文 ID |
| onClose | `() => void` | 否 | 关闭回调 |

---

## 扩展指南

### 添加新的交互层（如 ImageLayer）

1. **创建层组件**：

```tsx
// components/layers/ImageLayer.tsx
export const ImageLayer: React.FC<ImageLayerProps> = ({
  images,
  scale,
  onImageClick,
}) => {
  return (
    <div
      style={{ zIndex: 12 }} // 选择合适的 zIndex
      className="image-layer absolute top-0 left-0"
    >
      {images.map((image) => (
        <div
          key={image.id}
          data-image-id={image.id}  // 必须：用于交互检测
          className="interactive-element"
          onClick={() => onImageClick(image)}
          style={{
            left: image.x * scale,
            top: image.y * scale,
            width: image.width * scale,
            height: image.height * scale,
          }}
        />
      ))}
    </div>
  );
};
```

2. **在 PDFRenderer 中添加**：

```tsx
// components/PDFRenderer.tsx
import { ImageLayer } from './layers/ImageLayer';

// 在 renderPage 函数中添加
<ImageLayer
  images={images.filter(img => img.page === pageNum)}
  scale={scale}
  onImageClick={handleImageClick}
/>
```

3. **无需修改 CustomSelectionLayer**：
   - `data-image-id` 已在选择器列表中预留
   - 点击图像时会自动穿透

### 添加新的交互元素类型

如果需要添加新类型，在 `CustomSelectionLayer.tsx` 中更新：

```typescript
const INTERACTIVE_SELECTORS = [
  // ... 现有选择器
  '[data-your-new-element]',    // 添加新选择器
  '.your-new-class',
];
```

---

## 功能开关

在 `index.tsx` 中定义的功能开关：

```typescript
/**
 * TODO: [SENTENCE_LAYER] 句子选择层开关
 * 依赖后端 OCR 服务提供句子边界数据
 * 当前状态：关闭（服务不可用）
 */
const ENABLE_SENTENCE_LAYER = false;

/**
 * TODO: [OBJECT_SELECTION] 对象选择开关
 * 依赖后端 OCR 服务提供图像/表格坐标
 * 当前状态：关闭（服务不可用）
 */
const ENABLE_OBJECT_SELECTION = false;
```

在 `PDFRenderer.tsx` 中：

```typescript
/**
 * TODO: [SELECTION_MODE] 文本选择模式开关
 * 启用自定义选择层替代原生 TextLayer 选择
 * 当前状态：开启
 */
const ENABLE_CUSTOM_SELECTION = true;
```

---

## 已知问题与 TODO

### TODO 列表

- [ ] **[SENTENCE_LAYER]** 启用句子选择层（需要 OCR 服务）
- [ ] **[OBJECT_SELECTION]** 启用图像/表格选择（需要 OCR 服务）
- [ ] **[IMAGE_LAYER]** 添加图像选择层
- [ ] **[TABLE_LAYER]** 添加表格选择层
- [ ] **[AI_CHAT]** 集成 AI 聊天面板

### 已知问题

1. **Mock API**：当前使用 Mock API，标注不会持久化
2. **Tiptap SSR 警告**：Novel 编辑器在 SSR 环境下有警告（不影响功能）

### 依赖的外部服务

| 服务 | 状态 | 用途 |
|------|------|------|
| OCR 服务 | ❌ 不可用 | 句子边界、图像/表格坐标 |
| 标注 API | ⚠️ Mock | 标注的增删改查 |
| 笔记 API | ⚠️ Mock | 笔记保存 |

---

## 样式主题

PDF Reader 使用 CSS 变量实现主题化：

```css
:root {
  --bg-main: #faf8f5;        /* 主背景色（米白色） */
  --bg-box-nor: #f0ede8;     /* 输入框背景 */
  --stroke-nor: #e5e2dd;     /* 边框颜色 */
  --text-1: #1e293b;         /* 主文字颜色 */
  --text-2: #475569;         /* 次要文字颜色 */
  --text-3: #64748b;         /* 辅助文字颜色 */
  --main-color: #6366f1;     /* 主题色（靛蓝色） */
}
```

---

## 贡献指南

1. 新功能请遵循现有的层级架构
2. 交互式元素必须添加 `data-*` 属性
3. 新层需要选择合适的 zIndex
4. 更新本文档以反映架构变更

---

## 更新日志

### v0.1.0 (2024-12-30)
- 初始版本
- 智能文本选择层
- 标注系统
- 搜索功能
- 多阅读模式
- 层级兼容架构

