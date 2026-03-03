# 多论文协同架构设计文档

> **Technical Design Document**  
> Version: 3.0  
> Date: 2026-01-07  
> Author: Pisa OS Team

---

## 目录

1. [问题分析](#1-问题分析)
2. [页面布局重构](#2-页面布局重构)
3. [多文档管理设计](#3-多文档管理设计)
4. [论文引用系统设计](#4-论文引用系统设计)
5. [数据层设计](#5-数据层设计)
6. [功能模块详设](#6-功能模块详设)
7. [行动计划](#7-行动计划)

---

## 1. 问题分析

### 1.1 当前布局问题

```
┌─────────────────────────────────────────────────────────────────────┐
│  [☰]  PDF Reader                    [模式][缩放][页码]  [Ingest][X] │  ← 顶栏混杂
├──────┬──────────────────────────────────────────────────┬───────────┤
│      │                                                  │           │
│ Left │              PDF Render Area                     │   Right   │
│ Panel│                                                  │   Panel   │
│      │                                                  │           │
└──────┴──────────────────────────────────────────────────┴───────────┘
```

**问题 1**: 工具栏位置错误
- 阅读模式切换、缩放、页码导航是 **PDF 视图专属控件**
- 它们应该属于 PDF 容器，而不是全局顶栏
- 多文档场景下，每个文档需要独立的视图状态

**问题 2**: 缺少多文档管理
- 没有文档标签页切换
- 没有添加新文档入口
- 没有关闭文档功能

**问题 3**: 论文与工具的关系混乱
- Quick Insight（论文专属）放在右边栏
- Chat/Notes（跨论文）也放在右边栏
- 职责不清晰

**问题 4**: 缺少论文引用交互
- 论文中的参考文献（References）是静态文本
- 无法快速预览被引论文的摘要
- 无法跳转到被引论文原文

### 1.2 目标架构

```
┌─────────────────────────────────────────────────────────────────────┐
│  [☰]  [Paper1 ×] [Paper2 ×] [Paper3 ×] [+]         [◧][◨]  [Ingest] │  ← 文档标签页
├──────┬──────────────────────────────────────────────────┬───────────┤
│      │ ┌──────────────────────────────────────────────┐ │           │
│ Left │ │ [单页][连续][双页]   [🔍]   ◀ 16/32 ▶  100% │ │   Right   │
│ Panel│ ├──────────────────────────────────────────────┤ │   Panel   │
│      │ │                                              │ │           │
│Index │ │              PDF Render Area                 │ │  Chat     │
│Meta  │ │                                              │ │  Notes    │
│Insight│ │              [引用悬浮卡片]                  │ │           │
│Refs  │ │                                              │ │           │
│      │ └──────────────────────────────────────────────┘ │           │
└──────┴──────────────────────────────────────────────────┴───────────┘
```

---

## 2. 页面布局重构

### 2.1 新的组件层级

```
PDFReaderLayout
├── TopBar (全局)
│   ├── LeftSection
│   │   └── SidebarToggle
│   ├── DocumentTabs (多文档标签页) ⭐ 新增
│   │   ├── TabItem × N (可关闭)
│   │   └── AddDocumentButton
│   └── RightSection
│       ├── LeftPanelToggle
│       ├── RightPanelToggle
│       └── IngestButton
│
├── MainContent
│   ├── LeftPanel (论文专属)
│   │   ├── IndexTab
│   │   ├── MetaTab
│   │   ├── InsightTab ⭐ 从右边栏移过来
│   │   └── RefsTab ⭐ 新增：参考文献列表
│   │
│   ├── PDFContainer ⭐ 重构
│   │   ├── PDFToolbar (视图专属控件) ⭐ 从顶栏移下来
│   │   │   ├── ReadingModeSelector (左)
│   │   │   ├── SearchButton (中) ⭐ 居中
│   │   │   ├── PageNavigator (右)
│   │   │   └── ZoomControls (右)
│   │   ├── PDFRenderer
│   │   │   └── PageContent
│   │   └── ReferencePopover ⭐ 新增：引用悬浮卡片
│   │
│   └── RightPanel (跨论文工具)
│       ├── ChatTab ⭐ 支持多论文引用
│       └── NotesTab ⭐ 笔记本管理
```

### 2.2 顶栏重构设计

#### 2.2.1 DocumentTabs 组件

```tsx
interface DocumentTabsProps {
  /** 已打开的文档列表 */
  documents: OpenDocument[];
  /** 当前活动文档 ID */
  activeDocumentId: string;
  /** 切换文档 */
  onSelectDocument: (id: string) => void;
  /** 关闭文档 */
  onCloseDocument: (id: string) => void;
  /** 添加新文档 */
  onAddDocument: () => void;
}

interface OpenDocument {
  id: string;
  title: string;
  arxivId?: string;
  /** 是否有未保存更改 */
  isDirty?: boolean;
}
```

#### 2.2.2 Tab 交互设计

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  ┌───┐    │
│  │ Falcon-H1R ● │ │ DeepSeek    │ │ Paper3...   │  │ + │    │
│  │           [×]│ │             │ │             │  │   │    │
│  └──────────────┘ └──────────────┘ └──────────────┘  └───┘    │
│   ↑ 活动标签      ↑ 普通标签       ↑ 长标题截断     ↑ 添加    │
│   (高亮+关闭按钮)  (hover显示关闭)                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘

交互规则：
- 点击标签：切换到该文档
- 点击 ×：关闭文档（如有未保存内容，提示确认）
- 拖拽标签：调整顺序（Phase 2）
- 右键标签：上下文菜单（关闭、关闭其他、关闭所有）
- ● 标记：表示有未保存的 Insight/Notes
```

### 2.3 PDF 容器重构设计

#### 2.3.1 内嵌工具栏设计（搜索居中）

```
┌────────────────────────────────────────────────────────────────┐
│ PDF Container                                                   │
├────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ [📄][📜][📖]        [🔍 Search]        ◀ 16/32 ▶  [-]100%[+]│ │
│ │  ↑ 阅读模式         ↑ 搜索(居中)        ↑ 页码    ↑ 缩放   │ │
│ └────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │                                                            │ │
│ │                      PDF 渲染区域                          │ │
│ │                                                            │ │
│ └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘

布局规则：
- 左区域：阅读模式切换 (固定宽度)
- 中区域：搜索按钮/搜索框 (flex-1, justify-center)
- 右区域：页码导航 + 缩放 (固定宽度)
```

#### 2.3.2 PDFToolbarInline 组件

```tsx
const PDFToolbarInline: React.FC<{
  viewState: PDFViewState;
  onViewStateChange: (state: Partial<PDFViewState>) => void;
  onSearch: () => void;
}> = ({ viewState, onViewStateChange, onSearch }) => {
  const { pageNumber, numPages, scale, readingMode } = viewState;
  const [searchOpen, setSearchOpen] = useState(false);
  
  return (
    <div className="pdf-toolbar-inline flex items-center px-3 py-2
                    bg-white/80 backdrop-blur-sm border-b border-stone-200">
      
      {/* 左区域：阅读模式 */}
      <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
        <ToolbarButton icon={<FileIcon />} isActive={readingMode === 'single'} ... />
        <ToolbarButton icon={<ScrollIcon />} isActive={readingMode === 'continuous'} ... />
        <ToolbarButton icon={<BookOpenIcon />} isActive={readingMode === 'double'} ... />
      </div>
      
      {/* 中区域：搜索 (居中) */}
      <div className="flex-1 flex justify-center">
        {searchOpen ? (
          <div className="flex items-center gap-2 bg-stone-100 rounded-lg px-3 py-1">
            <Search className="w-4 h-4 text-stone-400" />
            <input 
              type="text"
              placeholder="Search in document..."
              className="bg-transparent outline-none text-sm w-48"
              autoFocus
            />
            <button onClick={() => setSearchOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-stone-100"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm text-stone-500">Search</span>
            <kbd className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">⌘F</kbd>
          </button>
        )}
      </div>
      
      {/* 右区域：页码 + 缩放 */}
      <div className="flex items-center gap-4">
        {/* 页码导航 */}
        <div className="flex items-center gap-1">
          <button onClick={() => goToPrevPage()} disabled={pageNumber <= 1}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {pageNumber} / {numPages}
          </span>
          <button onClick={() => goToNextPage()} disabled={pageNumber >= numPages}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        {/* 缩放 */}
        <div className="flex items-center gap-1">
          <button onClick={() => zoomOut()}><Minus className="w-4 h-4" /></button>
          <span className="text-sm min-w-[45px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => zoomIn()}><Plus className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};
```

### 2.4 左边栏重构设计

#### 2.4.1 四个 Tab：Insight (默认) / Index / Outline / Meta

```
┌─────────────────────────────────────┐
│ [💡][📑][📜][ℹ️]                    │  ← 四个 Tab (图标)
├─────────────────────────────────────┤
│                                     │
│  Insight Tab: Quick Insights ⭐ 首位默认
│  Index Tab: 缩略图导航              │
│  Outline Tab: 大纲导航              │
│  Meta Tab: 论文元信息               │
│  (未来: Refs Tab 参考文献列表)      │
│                                     │
└─────────────────────────────────────┘

设计原则：
- Insight 作为首位 Tab，默认展示
- 添加 Insight 到 Notes 时，自动移除 [[detection_id]] 标签
- 保持纯 Markdown 格式，便于后续编辑
```

#### 2.4.2 Refs Tab 设计

```
┌─────────────────────────────────────┐
│  📚 References (42)                 │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │ [1] Vaswani et al., 2017        ││
│  │     Attention Is All You Need   ││
│  │     [📄 PDF] [🔗 arXiv]         ││  ← 可点击打开
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ [2] Brown et al., 2020          ││
│  │     Language Models are Few-... ││
│  │     [📄 PDF] [🔗 arXiv]         ││
│  └─────────────────────────────────┘│
│  ...                                │
└─────────────────────────────────────┘

交互：
- hover 显示摘要卡片
- 点击 PDF 按钮：在新标签页打开论文
- 点击 arXiv 按钮：跳转到 arXiv 页面
```

### 2.5 右边栏重构设计

保持 Chat 和 Notes 两个 Tab，移除 Insight Tab。

---

## 3. 多文档管理设计

### 3.1 文档状态管理

```typescript
/**
 * 多文档管理 Store
 */
interface MultiDocumentState {
  /** 已打开的文档 */
  openDocuments: Map<string, DocumentInstance>;
  /** 当前活动文档 ID */
  activeDocumentId: string | null;
  /** 文档标签顺序 */
  tabOrder: string[];
}

interface DocumentInstance {
  /** 文档 ID */
  id: string;
  /** 论文上下文 */
  paperContext: PaperContext;
  /** 视图状态 (独立) */
  viewState: PDFViewState;
  /** Quick Insights (论文专属) */
  insights: PaperInsight[];
  /** 解析的参考文献 */
  references: ParsedReference[];
  /** 是否有未保存更改 */
  isDirty: boolean;
  /** 打开时间 */
  openedAt: number;
}

interface MultiDocumentActions {
  /** 打开文档 */
  openDocument: (source: PDFSource) => Promise<string>;
  /** 关闭文档 */
  closeDocument: (id: string) => void;
  /** 切换活动文档 */
  setActiveDocument: (id: string) => void;
  /** 更新文档视图状态 */
  updateViewState: (id: string, state: Partial<PDFViewState>) => void;
  /** 调整标签顺序 */
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}
```

### 3.2 添加文档弹窗

```
┌─────────────────────────────────────────────────────────────┐
│                    Add Document                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📁 From Local File                                   │   │
│  │    Drag & drop PDF or click to browse               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔗 From URL / arXiv ID                               │   │
│  │    [2601.02346 or https://arxiv.org/...]            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📚 From Library                                      │   │
│  │    ┌────────────────┐ ┌────────────────┐            │   │
│  │    │ Falcon-H1R     │ │ DeepSeek-R1    │            │   │
│  │    │ 2601.02346     │ │ 2501.12345     │            │   │
│  │    └────────────────┘ └────────────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                              [Cancel]  [Open]               │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 论文引用系统设计

### 4.1 核心概念

论文中的 References 部分包含大量引用，我们可以：
1. **解析 BibTeX/引用格式** - 提取结构化信息
2. **匹配公开数据源** - arXiv、Semantic Scholar、DOI
3. **提供交互能力** - hover 预览、点击跳转/打开

### 4.2 引用数据结构

```typescript
/**
 * 解析后的参考文献
 */
interface ParsedReference {
  /** 引用编号 [1], [2], ... */
  index: number;
  /** 原始引用文本 */
  rawText: string;
  /** 标题 */
  title: string;
  /** 作者列表 */
  authors: string[];
  /** 发表年份 */
  year?: number;
  /** 期刊/会议 */
  venue?: string;
  /** 识别出的标识符 */
  identifiers: {
    arxiv_id?: string;    // e.g., "2301.12345"
    doi?: string;         // e.g., "10.1234/..."
    semantic_scholar_id?: string;
  };
  /** 公开访问链接 */
  publicAccess?: {
    pdf_url?: string;     // 直接 PDF 链接
    arxiv_url?: string;   // arXiv 页面
    paper_url?: string;   // 论文主页
  };
  /** 摘要 (从 API 获取) */
  abstract?: string;
  /** 在 PDF 中的位置 */
  location?: {
    page: number;
    bbox: BoundingBox;
  };
}

/**
 * 引用元数据 (从外部 API 获取)
 */
interface ReferenceMetadata {
  title: string;
  authors: string[];
  abstract: string;
  year: number;
  citationCount?: number;
  venue?: string;
  pdf_url?: string;
  arxiv_id?: string;
}
```

### 4.3 引用解析流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Reference Parsing Pipeline                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. OCR 检测 References 部分                                     │
│     └─ detections.json 中 label="reference" 的区域              │
│                                                                  │
│  2. 文本分割                                                     │
│     └─ 按 [1], [2], ... 或作者年份格式分割                      │
│                                                                  │
│  3. 结构化解析                                                   │
│     └─ 正则匹配 arXiv ID, DOI, 标题, 作者                        │
│                                                                  │
│  4. 外部 API 增强 (可选，异步)                                   │
│     ├─ arXiv API: 获取摘要、PDF链接                              │
│     ├─ Semantic Scholar API: 获取引用数、摘要                    │
│     └─ CrossRef API: DOI 解析                                    │
│                                                                  │
│  5. 缓存结果                                                     │
│     └─ 存储到 IndexedDB，避免重复请求                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 引用交互设计

#### 4.4.1 PDF 中的引用高亮

```typescript
// 当用户 hover 到引用标记 [1] 时
interface ReferenceHoverEvent {
  referenceIndex: number;
  position: { x: number; y: number };
}
```

#### 4.4.2 引用悬浮卡片 (ReferencePopover)

```
┌─────────────────────────────────────────────────────┐
│  Attention Is All You Need                          │
│  ───────────────────────────────────────────────────│
│  Vaswani, Shazeer, Parmar, et al. • NeurIPS 2017    │
│  ───────────────────────────────────────────────────│
│  We propose a new simple network architecture,      │
│  the Transformer, based solely on attention         │
│  mechanisms, dispensing with recurrence and         │
│  convolutions entirely...                           │
│  ───────────────────────────────────────────────────│
│  📊 Cited by 98,234    📄 arXiv:1706.03762          │
│  ───────────────────────────────────────────────────│
│  [📄 Open PDF]  [📑 Add to Reader]  [🔗 arXiv Page] │
└─────────────────────────────────────────────────────┘

交互：
- Open PDF: 在新标签页打开 (如果有公开 PDF)
- Add to Reader: 添加到当前阅读器的文档标签页
- arXiv Page: 新窗口打开 arXiv 页面
```

#### 4.4.3 左边栏引用列表 (RefsPanel)

```tsx
const RefsPanel: React.FC<{
  references: ParsedReference[];
  onOpenReference: (ref: ParsedReference) => void;
  onHoverReference: (ref: ParsedReference | null) => void;
}> = ({ references, onOpenReference, onHoverReference }) => {
  return (
    <div className="refs-panel h-full flex flex-col">
      <div className="px-3 py-2 border-b border-stone-200 flex items-center justify-between">
        <span className="text-sm font-medium">References ({references.length})</span>
        <button className="text-xs text-indigo-600">Export BibTeX</button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {references.map((ref) => (
          <ReferenceItem
            key={ref.index}
            reference={ref}
            onOpen={() => onOpenReference(ref)}
            onHover={(hovering) => onHoverReference(hovering ? ref : null)}
          />
        ))}
      </div>
    </div>
  );
};

const ReferenceItem: React.FC<{
  reference: ParsedReference;
  onOpen: () => void;
  onHover: (hovering: boolean) => void;
}> = ({ reference, onOpen, onHover }) => {
  const hasPublicAccess = reference.publicAccess?.pdf_url || reference.identifiers.arxiv_id;
  
  return (
    <div
      className="p-3 border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="flex items-start gap-2">
        <span className="text-xs font-mono text-stone-400">[{reference.index}]</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-800 line-clamp-2">
            {reference.title}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            {reference.authors.slice(0, 3).join(', ')}
            {reference.authors.length > 3 && ' et al.'}
            {reference.year && ` • ${reference.year}`}
          </p>
          
          {/* 快捷操作 */}
          <div className="flex items-center gap-2 mt-1.5">
            {reference.identifiers.arxiv_id && (
              <a
                href={`https://arxiv.org/abs/${reference.identifiers.arxiv_id}`}
                target="_blank"
                rel="noopener"
                className="text-xs text-indigo-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                arXiv
              </a>
            )}
            {hasPublicAccess && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                className="text-xs text-emerald-600 hover:underline"
              >
                Open PDF
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 4.5 外部 API 集成

```typescript
/**
 * 引用元数据服务
 */
class ReferenceMetadataService {
  private cache: Map<string, ReferenceMetadata> = new Map();
  
  /**
   * 从 arXiv 获取元数据
   */
  async fetchFromArxiv(arxivId: string): Promise<ReferenceMetadata | null> {
    const cacheKey = `arxiv:${arxivId}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;
    
    try {
      // arXiv API: http://export.arxiv.org/api/query?id_list=2301.12345
      const response = await fetch(
        `http://export.arxiv.org/api/query?id_list=${arxivId}`
      );
      const xml = await response.text();
      const metadata = this.parseArxivXML(xml);
      
      if (metadata) {
        metadata.pdf_url = `https://arxiv.org/pdf/${arxivId}.pdf`;
        metadata.arxiv_id = arxivId;
        this.cache.set(cacheKey, metadata);
      }
      return metadata;
    } catch (error) {
      console.error('Failed to fetch arXiv metadata:', error);
      return null;
    }
  }
  
  /**
   * 从 Semantic Scholar 获取元数据
   */
  async fetchFromSemanticScholar(paperId: string): Promise<ReferenceMetadata | null> {
    // Semantic Scholar API
    // https://api.semanticscholar.org/graph/v1/paper/{paper_id}
    // ...
  }
  
  /**
   * 批量获取引用元数据 (带限流)
   */
  async enrichReferences(
    references: ParsedReference[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<ParsedReference[]> {
    const enriched: ParsedReference[] = [];
    
    for (let i = 0; i < references.length; i++) {
      const ref = references[i];
      
      if (ref.identifiers.arxiv_id) {
        const metadata = await this.fetchFromArxiv(ref.identifiers.arxiv_id);
        if (metadata) {
          ref.abstract = metadata.abstract;
          ref.publicAccess = {
            pdf_url: metadata.pdf_url,
            arxiv_url: `https://arxiv.org/abs/${ref.identifiers.arxiv_id}`,
          };
        }
      }
      
      enriched.push(ref);
      onProgress?.(i + 1, references.length);
      
      // 限流：100ms 间隔
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return enriched;
  }
}
```

---

## 5. 数据层设计

### 5.1 存储策略：接口优先 + Mock 数据

```
┌─────────────────────────────────────────────────────────────────┐
│                     Storage Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   StorageAdapter (Interface)             │    │
│  │  ┌───────────────────────────────────────────────────┐  │    │
│  │  │ + listPapers(): Promise<PaperMeta[]>              │  │    │
│  │  │ + getPaper(id): Promise<PaperData | null>         │  │    │
│  │  │ + listChatSessions(): Promise<ChatSession[]>      │  │    │
│  │  │ + saveChatSession(session): Promise<void>         │  │    │
│  │  │ + listNotebooks(): Promise<Notebook[]>            │  │    │
│  │  │ + saveNotebook(notebook): Promise<void>           │  │    │
│  │  │ + ...                                             │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ▲                                   │
│                              │ implements                        │
│              ┌───────────────┴───────────────┐                   │
│              │                               │                   │
│  ┌───────────────────────┐     ┌───────────────────────┐        │
│  │   MockStorageAdapter  │     │  IndexedDBAdapter     │        │
│  │   (Phase 1-2)         │     │  (Phase 3+)           │        │
│  │                       │     │                       │        │
│  │ 读取 public/data/     │     │ 真正的本地存储        │        │
│  │ output/ 目录          │     │ 支持持久化            │        │
│  └───────────────────────┘     └───────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 StorageAdapter 接口定义

```typescript
/**
 * 存储适配器接口 - 所有存储操作的统一抽象
 */
interface StorageAdapter {
  // ==========================================
  // Paper Data (OCR 预处理数据)
  // ==========================================
  
  /** 列出所有可用论文 */
  listPapers(): Promise<PaperMeta[]>;
  
  /** 获取论文完整数据 */
  getPaper(paperId: string): Promise<PaperData | null>;
  
  /** 检查论文是否存在 */
  hasPaper(paperId: string): Promise<boolean>;
  
  // ==========================================
  // Chat Sessions
  // ==========================================
  
  listChatSessions(): Promise<ChatSession[]>;
  getChatSession(id: string): Promise<ChatSession | null>;
  saveChatSession(session: ChatSession): Promise<void>;
  deleteChatSession(id: string): Promise<void>;
  
  // ==========================================
  // Notebooks
  // ==========================================
  
  listNotebooks(): Promise<Notebook[]>;
  getNotebook(id: string): Promise<Notebook | null>;
  saveNotebook(notebook: Notebook): Promise<void>;
  deleteNotebook(id: string): Promise<void>;
  
  // ==========================================
  // Paper Insights Cache
  // ==========================================
  
  getPaperInsights(paperId: string): Promise<PaperInsight[]>;
  savePaperInsights(paperId: string, insights: PaperInsight[]): Promise<void>;
  
  // ==========================================
  // Reference Metadata Cache
  // ==========================================
  
  getReferenceMetadata(identifier: string): Promise<ReferenceMetadata | null>;
  saveReferenceMetadata(identifier: string, metadata: ReferenceMetadata): Promise<void>;
}

/**
 * 论文元信息 (列表展示用)
 */
interface PaperMeta {
  id: string;           // arxiv_id 或自定义 ID
  title: string;
  authors: string[];
  arxivId?: string;
  published?: string;
  hasOCRData: boolean;
}

/**
 * 论文完整数据
 */
interface PaperData {
  meta: PaperMeta;
  metadata: PaperMetadata;
  markdown: string;
  detections: PageDetection[];
  ocrResult: OCRResult;
}
```

### 5.3 MockStorageAdapter 实现

```typescript
/**
 * Mock 存储适配器 - 使用 public/data/output 作为数据源
 */
class MockStorageAdapter implements StorageAdapter {
  private basePath = '/data/output';
  
  async listPapers(): Promise<PaperMeta[]> {
    // 读取 public/data/output 目录下的所有论文
    // 这里需要一个预定义的清单或扫描接口
    
    // 方案 1: 预定义清单
    const knownPapers = [
      '2601.02346v1',  // Falcon-H1R
      '2512.23676v1',  // 示例论文
      // ... 其他论文
    ];
    
    const papers: PaperMeta[] = [];
    for (const id of knownPapers) {
      try {
        const metadata = await this.fetchJSON<PaperMetadata>(
          `${this.basePath}/${id}/metadata.json`
        );
        if (metadata) {
          papers.push({
            id,
            title: metadata.title,
            authors: metadata.authors,
            arxivId: metadata.arxiv_id,
            published: metadata.published,
            hasOCRData: true,
          });
        }
      } catch (e) {
        console.warn(`Failed to load paper ${id}:`, e);
      }
    }
    
    return papers;
  }
  
  async getPaper(paperId: string): Promise<PaperData | null> {
    try {
      const [metadata, detections, ocrResult, markdown] = await Promise.all([
        this.fetchJSON<PaperMetadata>(`${this.basePath}/${paperId}/metadata.json`),
        this.fetchJSON<{ pages: PageDetection[] }>(`${this.basePath}/${paperId}/detections.json`),
        this.fetchJSON<OCRResult>(`${this.basePath}/${paperId}/ocr_result.json`),
        this.fetchText(`${this.basePath}/${paperId}/paper.md`),
      ]);
      
      if (!metadata) return null;
      
      return {
        meta: {
          id: paperId,
          title: metadata.title,
          authors: metadata.authors,
          arxivId: metadata.arxiv_id,
          published: metadata.published,
          hasOCRData: true,
        },
        metadata,
        markdown: markdown || '',
        detections: detections?.pages || [],
        ocrResult: ocrResult!,
      };
    } catch (error) {
      console.error(`Failed to load paper ${paperId}:`, error);
      return null;
    }
  }
  
  async hasPaper(paperId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.basePath}/${paperId}/metadata.json`);
      return response.ok;
    } catch {
      return false;
    }
  }
  
  // Chat Sessions - 使用 localStorage 作为临时存储
  async listChatSessions(): Promise<ChatSession[]> {
    const data = localStorage.getItem('mock_chat_sessions');
    return data ? JSON.parse(data) : [];
  }
  
  async saveChatSession(session: ChatSession): Promise<void> {
    const sessions = await this.listChatSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem('mock_chat_sessions', JSON.stringify(sessions));
  }
  
  // ... 其他方法类似实现
  
  private async fetchJSON<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }
  
  private async fetchText(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return response.text();
    } catch {
      return null;
    }
  }
}
```

### 5.4 useStorage Hook

```typescript
/**
 * 存储 Hook - 提供统一的存储访问
 */
const StorageContext = createContext<StorageAdapter | null>(null);

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Phase 1-2: 使用 MockStorageAdapter
  // Phase 3+: 切换到 IndexedDBAdapter
  const adapter = useMemo(() => new MockStorageAdapter(), []);
  
  return (
    <StorageContext.Provider value={adapter}>
      {children}
    </StorageContext.Provider>
  );
};

export function useStorage(): StorageAdapter {
  const adapter = useContext(StorageContext);
  if (!adapter) {
    throw new Error('useStorage must be used within StorageProvider');
  }
  return adapter;
}

// 便捷 Hooks
export function usePaperList() {
  const storage = useStorage();
  const [papers, setPapers] = useState<PaperMeta[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    storage.listPapers().then(setPapers).finally(() => setLoading(false));
  }, [storage]);
  
  return { papers, loading };
}

export function usePaper(paperId: string | null) {
  const storage = useStorage();
  const [paper, setPaper] = useState<PaperData | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!paperId) {
      setPaper(null);
      return;
    }
    
    setLoading(true);
    storage.getPaper(paperId).then(setPaper).finally(() => setLoading(false));
  }, [storage, paperId]);
  
  return { paper, loading };
}
```

---

## 6. 功能模块详设

### 6.1 DocumentTabs 组件

（与之前设计相同，略）

### 6.2 PDFToolbarInline 组件

（见 2.3.2 节）

### 6.3 InsightPanelLeft 组件

```tsx
const InsightPanelLeft: React.FC<{
  insights: PaperInsight[];
  loading: boolean;
  onRefresh: () => void;
  onAddToNotes: (insight: PaperInsight) => void;
  onCitationClick: (citation: SourceCitation) => void;
}> = ({ insights, loading, onRefresh, onAddToNotes, onCitationClick }) => {
  return (
    <div className="insight-panel-left h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200">
        <span className="text-sm font-medium text-stone-600">Quick Insights</span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 rounded hover:bg-stone-100"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {insights.map((insight) => (
          <InsightCardCompact
            key={insight.id}
            insight={insight}
            onAddToNotes={() => onAddToNotes(insight)}
            onCitationClick={onCitationClick}
          />
        ))}
        
        {insights.length === 0 && !loading && (
          <EmptyState
            icon={<Lightbulb />}
            message="No insights generated yet"
            action={{ label: "Generate Now", onClick: onRefresh }}
          />
        )}
      </div>
    </div>
  );
};
```

### 6.4 RefsPanel 组件

（见 4.4.3 节）

### 6.5 ReferencePopover 组件

```tsx
const ReferencePopover: React.FC<{
  reference: ParsedReference | null;
  position: { x: number; y: number } | null;
  onOpenPDF: (ref: ParsedReference) => void;
  onAddToReader: (ref: ParsedReference) => void;
}> = ({ reference, position, onOpenPDF, onAddToReader }) => {
  if (!reference || !position) return null;
  
  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-stone-200 
                 w-80 p-4 animate-in fade-in-50 slide-in-from-bottom-2"
      style={{
        left: Math.min(position.x, window.innerWidth - 340),
        top: Math.min(position.y + 10, window.innerHeight - 300),
      }}
    >
      {/* 标题 */}
      <h3 className="font-medium text-stone-900 leading-tight">
        {reference.title}
      </h3>
      
      {/* 作者和年份 */}
      <p className="text-sm text-stone-500 mt-1">
        {reference.authors.slice(0, 3).join(', ')}
        {reference.authors.length > 3 && ' et al.'}
        {reference.year && ` • ${reference.year}`}
      </p>
      
      {/* 摘要 */}
      {reference.abstract && (
        <p className="text-sm text-stone-600 mt-2 line-clamp-4">
          {reference.abstract}
        </p>
      )}
      
      {/* 元信息 */}
      <div className="flex items-center gap-3 mt-3 text-xs text-stone-400">
        {reference.identifiers.arxiv_id && (
          <span>arXiv:{reference.identifiers.arxiv_id}</span>
        )}
      </div>
      
      {/* 操作按钮 */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100">
        {reference.publicAccess?.pdf_url && (
          <button
            onClick={() => onOpenPDF(reference)}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white 
                       text-sm rounded-lg hover:bg-indigo-700"
          >
            <FileText className="w-3.5 h-3.5" />
            Open PDF
          </button>
        )}
        <button
          onClick={() => onAddToReader(reference)}
          className="flex items-center gap-1 px-3 py-1.5 bg-stone-100 text-stone-700
                     text-sm rounded-lg hover:bg-stone-200"
        >
          <Plus className="w-3.5 h-3.5" />
          Add to Reader
        </button>
        {reference.publicAccess?.arxiv_url && (
          <a
            href={reference.publicAccess.arxiv_url}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1 px-3 py-1.5 text-stone-500
                       text-sm rounded-lg hover:bg-stone-100"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
};
```

---

## 7. 行动计划

### 实施策略：先布局后底层

```
Phase 1: 页面布局改动 + 存储接口（视觉层）
    ↓
Phase 2: 多文档管理（状态层）
    ↓
Phase 3: 论文引用系统
    ↓
Phase 4: 存储持久化 + 跨论文功能
```

---

### Phase 1: 页面布局改动 + 存储接口 (Week 1)

> **目标**：完成视觉层重构，建立存储抽象

#### 1.1 存储层接口 (Day 1)

| 任务 | 文件 | 说明 |
|------|------|------|
| 定义 `StorageAdapter` 接口 | `lib/storage/types.ts` | 统一存储抽象 |
| 实现 `MockStorageAdapter` | `lib/storage/mockAdapter.ts` | 读取 public/data/output |
| 创建 `useStorage` hook | `hooks/useStorage.ts` | React 集成 |
| 添加 `StorageProvider` | `lib/storage/provider.tsx` | Context Provider |

#### 1.2 工具栏下沉 (Day 1-2)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 `PDFToolbarInline` | `components/PDFToolbarInline.tsx` | 内嵌工具栏 (搜索居中) |
| 重构 `PDFContainer` | `components/PDFContainer.tsx` | 包裹工具栏和渲染器 |
| 移除顶栏工具按钮 | `index.tsx` | 清理旧布局 |

#### 1.3 Quick Insight 移至左边栏 (Day 2-3)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 `InsightPanelLeft` | `components/left/InsightPanelLeft.tsx` | 左边栏版本 |
| 修改 `IndexPanel` | `components/IndexPanel.tsx` | 添加 Insight Tab |
| 修改右边栏 | `components/ai/AIRightPanel.tsx` | 移除 Insight Tab |

#### 1.4 顶栏文档标签页 UI (Day 3-4)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 `DocumentTabs` | `components/DocumentTabs.tsx` | 标签页组件 |
| 修改顶栏布局 | `index.tsx` | 集成标签页 |

**Phase 1 交付物**：
- `src/lib/storage/` - 存储层抽象
- `src/components/editors/pdf-reader/components/PDFToolbarInline.tsx`
- `src/components/editors/pdf-reader/components/left/InsightPanelLeft.tsx`
- `src/components/editors/pdf-reader/components/DocumentTabs.tsx`

---

### Phase 2: 多文档状态管理 (Week 2)

> **目标**：实现真正的多文档打开和切换

#### 2.1 多文档 Store (Day 1-2)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 `multiDocumentStore` | `store/multiDocumentStore.ts` | Zustand store |
| 集成 `useStorage` | - | 从存储加载论文 |
| 实现 open/close/switch | - | 核心操作 |

#### 2.2 添加文档弹窗 (Day 2-3)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 `AddDocumentDialog` | `components/AddDocumentDialog.tsx` | 添加文档弹窗 |
| 使用 `usePaperList` | - | 展示 Library |
| 支持 arXiv ID 输入 | - | URL/ID 解析 |

#### 2.3 视图状态隔离 (Day 3-4)

| 任务 | 说明 |
|------|------|
| 每个文档独立 `viewState` | 缩放、页码、模式独立 |
| 文档切换时保存/恢复状态 | 切换不丢失位置 |

#### 2.4 关闭确认 (Day 4-5)

| 任务 | 说明 |
|------|------|
| 检测未保存内容 | Insight 变更检测 |
| 关闭确认弹窗 | Save/Discard/Cancel |

**Phase 2 交付物**：
- `src/components/editors/pdf-reader/store/multiDocumentStore.ts`
- `src/components/editors/pdf-reader/components/AddDocumentDialog.tsx`
- 完整的多文档切换功能

---

### Phase 3: 论文引用系统 (Week 3)

> **目标**：实现 References 解析和交互

#### 3.1 引用解析服务 (Day 1-2)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 `ReferenceParser` | `services/referenceParser.ts` | 解析 References 文本 |
| 正则匹配 arXiv/DOI | - | 提取标识符 |
| 集成到 Paper 加载流程 | - | 加载时解析 |

#### 3.2 外部 API 服务 (Day 2-3)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 `ReferenceMetadataService` | `services/referenceMetadata.ts` | 外部 API 调用 |
| arXiv API 集成 | - | 获取摘要/PDF |
| 结果缓存 | - | 避免重复请求 |

#### 3.3 RefsPanel 组件 (Day 3-4)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 `RefsPanel` | `components/left/RefsPanel.tsx` | 引用列表 |
| 添加到左边栏 Tab | `components/IndexPanel.tsx` | 第四个 Tab |
| 实现 hover/click 交互 | - | 预览和跳转 |

#### 3.4 ReferencePopover 组件 (Day 4-5)

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建 `ReferencePopover` | `components/ui/ReferencePopover.tsx` | 悬浮卡片 |
| 集成到 PDF 渲染 | - | 检测引用标记 hover |
| 实现 "Add to Reader" | - | 打开为新标签页 |

**Phase 3 交付物**：
- `src/services/referenceParser.ts`
- `src/services/referenceMetadata.ts`
- `src/components/editors/pdf-reader/components/left/RefsPanel.tsx`
- `src/components/editors/pdf-reader/components/ui/ReferencePopover.tsx`

---

### Phase 4: 存储持久化 + 跨论文功能 (Week 4)

> **目标**：实现数据持久化和跨论文协作

#### 4.1 IndexedDB 存储 (Day 1-2)

| 任务 | 文件 | 说明 |
|------|------|------|
| 实现 `IndexedDBAdapter` | `lib/storage/indexedDBAdapter.ts` | 真正持久化 |
| 切换适配器 | `lib/storage/provider.tsx` | 根据环境选择 |
| 数据迁移 | - | 从 Mock 迁移 |

#### 4.2 会话和笔记管理 (Day 2-3)

| 任务 | 文件 | 说明 |
|------|------|------|
| `ChatSessionManager` | `components/ai/ChatSessionManager.tsx` | 会话管理 |
| `NotebookSelector` | `components/ai/NotebookSelector.tsx` | 笔记本选择 |
| 自动保存 | - | 防抖保存 |

#### 4.3 跨论文引用 (Day 3-4)

| 任务 | 说明 |
|------|------|
| 扩展 `citationStore` | 支持多论文 detections |
| 跨论文导航 | 点击引用切换文档 |
| 引用标签带论文来源 | `[Paper:p5]` 格式 |

#### 4.4 测试优化 (Day 4-5)

| 任务 | 说明 |
|------|------|
| 端到端测试 | 多文档场景 |
| 性能优化 | 大量文档时的性能 |
| Bug 修复 | - |

**Phase 4 交付物**：
- `src/lib/storage/indexedDBAdapter.ts`
- 完整的会话/笔记本管理
- 跨论文引用功能

---

## 附录 A: 文件变更清单

### 新增文件

```
src/
├── lib/
│   └── storage/
│       ├── types.ts              # 存储接口定义
│       ├── mockAdapter.ts        # Mock 实现 (Phase 1)
│       ├── indexedDBAdapter.ts   # IndexedDB 实现 (Phase 4)
│       └── provider.tsx          # Context Provider
│
├── services/
│   ├── referenceParser.ts        # 引用解析
│   └── referenceMetadata.ts      # 外部 API
│
└── components/editors/pdf-reader/
    ├── components/
    │   ├── PDFContainer.tsx          # 重构
    │   ├── PDFToolbarInline.tsx      # 新增
    │   ├── DocumentTabs.tsx          # 新增
    │   ├── AddDocumentDialog.tsx     # 新增
    │   ├── left/
    │   │   ├── InsightPanelLeft.tsx  # 新增
    │   │   └── RefsPanel.tsx         # 新增
    │   └── ui/
    │       └── ReferencePopover.tsx  # 新增
    ├── store/
    │   └── multiDocumentStore.ts     # 新增
    └── hooks/
        └── useStorage.ts             # 新增
```

---

## 附录 B: 里程碑验收标准

### Phase 1 验收标准
- [x] 存储接口定义完成，MockAdapter 可用 ✅ 2026-01-07
- [x] PDF 工具栏在 PDF 容器内部，搜索按钮居中 ✅ 2026-01-07
- [x] Quick Insight 在左边栏可见（首位，默认展示） ✅ 2026-01-07
- [x] 顶栏有文档标签页 UI（单文档） ✅ 2026-01-07
- [x] 现有功能全部正常 ✅ 2026-01-07
- [x] Insight 添加到 Notes 自动移除标签 ✅ 2026-01-07

### Phase 2 验收标准
- [x] 论文库对话框可用，显示所有可用论文 ✅ 2026-01-07
- [x] API `/api/papers` 列出 public/data/output 所有论文 ✅ 2026-01-07
- [x] 搜索功能（标题/作者/arXiv ID） ✅ 2026-01-07
- [x] 移除 "Ingest" 冗余标签 ✅ 2026-01-07
- [x] 可以从 Library 打开多个 PDF 文档 ✅ 2026-01-07
- [x] 标签页可切换，每个文档状态独立 ✅ 2026-01-07
- [x] 可关闭文档（状态自动清理） ✅ 2026-01-07

**Phase 2 新增文件：**
- `store/multiDocumentStore.ts` - 多文档状态管理
- `PDFReaderWrapper.tsx` - 多文档包装组件
- `PDFReaderContent.tsx` - 单文档内容组件
- `app/api/papers/route.ts` - 论文列表 API
- `components/PaperLibraryDialog.tsx` - 论文库对话框

### Phase 3 验收标准 ✅ 2026-01-07
- [x] 引用解析服务创建完成
- [x] 左侧边栏 References 面板实现
- [x] arXiv API 集成获取元数据
- [x] 悬浮预览卡片（标题、作者、摘要）
- [x] "在阅读器中打开" 操作

**Phase 3 新增文件：**
- `services/referenceService.ts` - 引用解析和 arXiv API
- `components/left/RefsPanel.tsx` - 引用面板组件

### Phase 3 验收标准
- [ ] 左边栏有 Refs Tab，显示参考文献列表
- [ ] Hover 引用条目显示摘要卡片
- [ ] 可点击 "Open PDF" 打开公开访问的论文
- [ ] "Add to Reader" 可将引用论文添加到标签页

### Phase 4 验收标准 ✅ 2026-01-07
- [x] IndexedDB 存储适配器实现
- [x] Chat Session 可保存/加载 (Zustand persist)
- [x] Notebook 可保存/加载 (Zustand persist)
- [x] 刷新页面后数据不丢失
- [x] 跨论文引用标签组件 (CrossPaperCitationTag)
- [x] 点击引用可跨文档跳转 (支持打开新文档+滚动)

**Phase 4 新增文件：**
- `lib/storage/indexedDBAdapter.ts` - IndexedDB 存储适配器
- `components/ui/CrossPaperCitationTag.tsx` - 跨论文引用标签组件

---

**文档结束**

> 请确认此设计方案，我们将从 Phase 1 开始实施。
