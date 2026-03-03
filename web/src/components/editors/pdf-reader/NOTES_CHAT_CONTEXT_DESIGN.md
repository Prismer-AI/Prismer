# Notes、Chat 与 Context Engineering 设计文档

> 版本: 1.1  
> 日期: 2026-01-07  
> 状态: 待确认
> 更新: 添加跨论文标签系统设计

---

## 0. 核心挑战：跨论文标签系统

### 0.1 问题陈述

```
当前标签格式: [[p1_text_0]]
             ↑ 页码 + 类型 + 索引

问题：这是论文内局部ID，无法跨论文唯一标识

场景：
- 单论文对话: [[p1_text_0]] 可以工作
- 多论文对话: 两篇论文都有 p1_text_0，无法区分！
- 笔记本: 记录来源时，需要知道是哪篇论文的 p1_text_0
```

### 0.2 设计约束

| 约束 | 原因 |
|------|------|
| AI 生成逻辑要简单 | 复杂提示词 → AI 理解错误 → 标签格式错乱 |
| 标签要人类可读 | 用户需要理解标签含义 |
| 支持跨论文索引 | 笔记和对话可引用多篇论文 |
| 向后兼容 | 现有单论文标签继续工作 |

### 0.3 解决方案：两阶段标签系统

```
┌─────────────────────────────────────────────────────────────────────┐
│                     两阶段标签系统                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────┐        ┌────────────────┐        ┌───────────┐ │
│  │  AI 生成层      │   →    │   映射层       │   →    │ 存储/显示  │ │
│  │  (简单标签)     │        │  (添加论文ID)   │        │ (完整引用) │ │
│  └────────────────┘        └────────────────┘        └───────────┘ │
│                                                                     │
│  格式演变:                                                           │
│                                                                     │
│  单论文模式:                                                         │
│  [[p1_text_0]]  →  消息级 paperId  →  {paperId, detectionId}       │
│                                                                     │
│  多论文模式:                                                         │
│  [[A:p1_text_0]] →  A→paperId 映射  →  {paperId, detectionId}      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 0.4 标签格式规范

```typescript
// ============================================================
// 统一引用标识符 (Universal Reference Identifier)
// ============================================================

/**
 * 论文内标签 (AI 生成用)
 * 格式: [[p{页码}_{类型}_{索引}]]
 * 示例: [[p1_text_0]], [[p3_image_1]]
 */
type LocalDetectionTag = `[[p${number}_${string}_${number}]]`;

/**
 * 跨论文标签 (多论文 AI 生成用)
 * 格式: [[{论文标识}:p{页码}_{类型}_{索引}]]
 * 示例: [[A:p1_text_0]], [[B:p3_image_1]]
 */
type CrossPaperTag = `[[${string}:p${number}_${string}_${number}]]`;

/**
 * 完整引用标识符 (存储用)
 * 格式: {arxivId}#{detectionId}
 * 示例: 2601.02346v1#p1_text_0
 */
type UniversalReferenceId = `${string}#${string}`;

// ============================================================
// 存储结构
// ============================================================

interface Citation {
  // 唯一标识符
  uri: UniversalReferenceId;  // "2601.02346v1#p1_text_0"
  
  // 分解字段 (便于索引)
  paperId: string;            // "2601.02346v1"
  detectionId: string;        // "p1_text_0"
  
  // 显示信息 (避免重复查询)
  paperTitle?: string;        // "DeepSeek-R1..."
  pageNumber: number;         // 1
  type: 'text' | 'image' | 'table' | 'equation';
  excerpt?: string;           // 前30字摘要
  
  // 显示索引 (在当前上下文中的编号)
  displayIndex?: number;      // 1, 2, 3...
}
```

### 0.5 AI 提示词策略

#### 单论文模式 (保持简单)

```markdown
## 引用格式

引用论文内容时，使用 [[detection_id]] 格式。

可用的 detection IDs:
- p1_text_0: "We propose a novel approach..."
- p1_text_1: "The main contributions are..."
- p2_image_0: [Figure 1: Architecture diagram]
...

示例回答:
"论文提出了一种新方法 [[p1_text_0]]，主要贡献包括... [[p1_text_1]]"
```

#### 多论文模式 (添加论文前缀)

```markdown
## 引用格式

你正在分析多篇论文。引用时使用 [[论文标识:detection_id]] 格式。

论文标识:
- A = "DeepSeek-R1: Incentivizing Reasoning..."
- B = "Attention Is All You Need"

可用的引用:

[Paper A] 2601.02346v1:
- A:p1_text_0: "We propose DeepSeek-R1..."
- A:p2_image_0: [Figure 1: Training pipeline]

[Paper B] 1706.03762:
- B:p1_text_0: "The dominant sequence transduction..."
- B:p3_equation_0: [Attention formula]

示例回答:
"DeepSeek-R1 [[A:p1_text_0]] 借鉴了 Transformer [[B:p1_text_0]] 的注意力机制 [[B:p3_equation_0]]"
```

### 0.6 标签映射与解析

```typescript
// ============================================================
// 标签解析器
// ============================================================

interface TagParseResult {
  type: 'local' | 'cross-paper';
  paperAlias?: string;      // 多论文时的别名 (A, B, C...)
  detectionId: string;      // p1_text_0
  raw: string;              // 原始匹配字符串
}

class CitationTagParser {
  // 单论文标签: [[p1_text_0]]
  private localPattern = /\[\[(p\d+_\w+_\d+)\]\]/g;
  
  // 跨论文标签: [[A:p1_text_0]]
  private crossPaperPattern = /\[\[([A-Z]):?(p\d+_\w+_\d+)\]\]/g;
  
  /**
   * 解析消息内容中的所有标签
   */
  parse(content: string): TagParseResult[] {
    const results: TagParseResult[] = [];
    
    // 先尝试解析跨论文标签
    let match;
    while ((match = this.crossPaperPattern.exec(content)) !== null) {
      results.push({
        type: 'cross-paper',
        paperAlias: match[1],
        detectionId: match[2],
        raw: match[0]
      });
    }
    
    // 再解析单论文标签
    while ((match = this.localPattern.exec(content)) !== null) {
      // 排除已被跨论文模式匹配的
      if (!results.some(r => r.raw.includes(match[1]))) {
        results.push({
          type: 'local',
          detectionId: match[1],
          raw: match[0]
        });
      }
    }
    
    return results;
  }
}
```

```typescript
// ============================================================
// 标签映射器
// ============================================================

interface PaperAliasMap {
  [alias: string]: string;  // A -> "2601.02346v1"
}

class CitationMapper {
  /**
   * 将 AI 生成的标签转换为完整引用
   */
  mapToCitations(
    parseResults: TagParseResult[],
    context: {
      // 单论文模式: 直接使用
      defaultPaperId?: string;
      // 多论文模式: 别名映射
      aliasMap?: PaperAliasMap;
    }
  ): Citation[] {
    return parseResults.map(result => {
      let paperId: string;
      
      if (result.type === 'cross-paper' && result.paperAlias) {
        paperId = context.aliasMap?.[result.paperAlias] || result.paperAlias;
      } else {
        paperId = context.defaultPaperId || 'unknown';
      }
      
      return {
        uri: `${paperId}#${result.detectionId}`,
        paperId,
        detectionId: result.detectionId,
        pageNumber: this.extractPageNumber(result.detectionId),
        type: this.extractType(result.detectionId),
      };
    });
  }
  
  private extractPageNumber(detectionId: string): number {
    const match = detectionId.match(/p(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
  
  private extractType(detectionId: string): Citation['type'] {
    if (detectionId.includes('image')) return 'image';
    if (detectionId.includes('table')) return 'table';
    if (detectionId.includes('equation')) return 'equation';
    return 'text';
  }
}
```

### 0.7 消息存储结构

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  
  // 原始内容 (保留 AI 生成的标签格式)
  rawContent: string;
  
  // 解析后的引用 (用于渲染和跳转)
  citations: Citation[];
  
  // 消息上下文 (用于后处理)
  context: {
    mode: 'single' | 'multi';
    // 单论文模式
    defaultPaperId?: string;
    // 多论文模式
    paperAliasMap?: PaperAliasMap;
  };
  
  timestamp: number;
}
```

### 0.8 渲染流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                        渲染流程                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  rawContent: "DeepSeek [[A:p1_text_0]] uses [[A:p2_image_0]]..."   │
│       │                                                             │
│       ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ CitationTagParser.parse()                                      │ │
│  │ → [{type:'cross', alias:'A', id:'p1_text_0'},                 │ │
│  │    {type:'cross', alias:'A', id:'p2_image_0'}]                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│       │                                                             │
│       ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ ReactMarkdown 渲染                                              │ │
│  │                                                                 │ │
│  │ 遇到 [[A:p1_text_0]] → 替换为 <CitationTag>                    │ │
│  │                                                                 │ │
│  │ <CitationTag                                                   │ │
│  │   citation={{                                                  │ │
│  │     uri: "2601.02346v1#p1_text_0",                            │ │
│  │     paperId: "2601.02346v1",                                   │ │
│  │     paperTitle: "DeepSeek-R1",                                 │ │
│  │     displayIndex: 1,                                           │ │
│  │     type: "text"                                               │ │
│  │   }}                                                           │ │
│  │ />                                                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│       │                                                             │
│       ▼                                                             │
│  显示: "DeepSeek [📄A:1] uses [🖼A:2]..."                          │
│                  ↑ 点击跳转到 Paper A, page 1                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 0.9 跳转逻辑

```typescript
interface CitationNavigator {
  /**
   * 处理标签点击
   */
  navigate(citation: Citation): void {
    const { paperId, detectionId } = citation;
    
    // 1. 检查目标论文是否已打开
    const targetDoc = multiDocStore.documents.get(paperId);
    
    if (targetDoc) {
      // 2a. 已打开 → 切换到该文档
      multiDocStore.setActiveDocument(paperId);
      
      // 3. 滚动到目标位置
      setTimeout(() => {
        citationStore.scrollToDetection(detectionId);
      }, 100);
    } else {
      // 2b. 未打开 → 打开新标签页
      const source: PDFSource = {
        type: 'arxiv',
        arxivId: paperId,
        path: `/api/ocr/${paperId}/pdf`
      };
      
      multiDocStore.openDocument(source);
      
      // 等待加载完成后滚动
      // (使用事件或轮询)
    }
  }
}
```

---

## 1. 问题分析

### 1.1 当前问题

| 功能 | 当前行为 | 期望行为 |
|------|----------|----------|
| Insight | 切换文档时清空 | ✅ 应与论文一对一绑定 |
| Chat | 切换文档时清空 | ❌ 应独立管理，支持跨论文 |
| Notes | 切换文档时清空 | ❌ 应独立管理，支持跨论文 |

### 1.2 核心矛盾

```
当前设计：所有状态都绑定在 AI Store 的全局状态上
         切换文档 → 切换状态 → 数据丢失

正确设计：
- Insight: 论文级别（1:1）
- Chat Session: 会话级别（1:N 论文）
- Notebook: 笔记本级别（1:N 论文）
```

---

## 2. 数据模型设计

### 2.1 实体关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          数据实体关系                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────┐         1:1         ┌─────────────────┐              │
│   │  Paper   │ ◄──────────────────►│  PaperInsights  │              │
│   │          │                     │  (Quick Insight)│              │
│   │ - arxivId│                     │  - insights[]   │              │
│   │ - context│                     └─────────────────┘              │
│   └──────────┘                                                      │
│        │                                                            │
│        │ N:M                                                        │
│        ▼                                                            │
│   ┌──────────────────┐                 ┌─────────────────┐          │
│   │   ChatSession    │◄───────────────►│    Notebook     │          │
│   │                  │      N:M        │                 │          │
│   │ - id             │                 │ - id            │          │
│   │ - title          │                 │ - name          │          │
│   │ - paperIds[]     │                 │ - paperIds[]    │          │
│   │ - messages[]     │                 │ - entries[]     │          │
│   │ - createdAt      │                 │ - createdAt     │          │
│   └──────────────────┘                 └─────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据结构定义

```typescript
// ============================================================
// 论文相关
// ============================================================

interface Paper {
  id: string;              // arxivId 或唯一标识
  title: string;
  authors: string[];
  context: PaperContext;   // 论文内容上下文
}

interface PaperInsights {
  paperId: string;
  insights: PaperInsight[];
  generatedAt: number;
  version: string;         // 用于缓存失效判断
}

// ============================================================
// Chat Session - 独立于论文的对话
// ============================================================

interface ChatSession {
  id: string;
  title: string;
  
  // 关联的论文（可多个）
  paperIds: string[];
  
  // 消息历史
  messages: ChatMessage[];
  
  // 元数据
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  
  // 上下文配置
  contextConfig: ChatContextConfig;
}

interface ChatContextConfig {
  // 上下文模式
  mode: 'single' | 'multi' | 'selective';
  
  // 选择性上下文时，选中的 detection IDs
  selectedDetections?: string[];
  
  // 上下文长度限制
  maxContextLength: number;
  
  // 是否包含图表
  includeFigures: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  
  // 原始内容 (保留 AI 生成的标签，如 [[p1_text_0]] 或 [[A:p1_text_0]])
  rawContent: string;
  
  // 解析后的引用列表 (渲染时使用)
  citations: Citation[];
  
  // 消息上下文 (用于标签解析和映射)
  messageContext: {
    mode: 'single' | 'multi';
    defaultPaperId?: string;       // 单论文模式
    paperAliasMap?: Record<string, string>;  // 多论文: {A: "2601.02346v1"}
  };
  
  // 消息关联的论文（用户问题可能只针对特定论文）
  targetPaperIds?: string[];
  
  timestamp: number;
}

// ============================================================
// Notebook - 独立于论文的笔记本
// ============================================================

interface Notebook {
  id: string;
  name: string;
  description?: string;
  
  // 关联的论文（来源追溯）
  paperIds: string[];
  
  // 笔记条目
  entries: NoteEntry[];
  
  // 元数据
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

interface NoteEntry {
  id: string;
  type: 'text' | 'highlight' | 'figure' | 'table' | 'equation' | 'insight' | 'chat_excerpt';
  
  // 内容 (HTML/Markdown，可能包含标签)
  rawContent: string;
  
  // 解析后的引用 (内容中的跨论文引用)
  citations: Citation[];
  
  // 主要来源 (这条笔记来自哪里)
  source?: Citation;
  
  // 用户批注
  annotation?: string;
  
  createdAt: number;
  updatedAt?: number;
}

// ============================================================
// 统一引用结构 (见 0.4 节详细定义)
// ============================================================

/**
 * Citation 是跨论文引用的统一结构
 * 用于 ChatMessage.citations 和 NoteEntry.citations
 */
interface Citation {
  // 全局唯一标识符: "{paperId}#{detectionId}"
  uri: string;  // "2601.02346v1#p1_text_0"
  
  // 分解字段
  paperId: string;
  detectionId: string;
  
  // 显示信息 (缓存，避免重复查询)
  paperTitle?: string;
  pageNumber: number;
  type: 'text' | 'image' | 'table' | 'equation';
  excerpt?: string;
  
  // 在当前上下文中的显示编号
  displayIndex?: number;
}
```

---

## 3. 状态管理架构

### 3.1 Store 分层设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Store 分层架构                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    UI Layer Stores                          │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │    │
│  │  │ PanelStore  │  │ ViewStore   │  │ SelectionStore      │ │    │
│  │  │ - 面板状态   │  │ - 阅读模式  │  │ - 选中状态          │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  Document Layer Stores                      │    │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐│    │
│  │  │ MultiDocStore    │  │ CitationStore                    ││    │
│  │  │ - 多文档管理      │  │ - 检测数据索引（按文档缓存）      ││    │
│  │  │ - 活动文档切换    │  │ - 高亮状态                       ││    │
│  │  └──────────────────┘  └──────────────────────────────────┘│    │
│  └────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  Session Layer Stores                       │    │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐│    │
│  │  │ ChatSessionStore │  │ NotebookStore                    ││    │
│  │  │ - 会话列表        │  │ - 笔记本列表                     ││    │
│  │  │ - 活动会话        │  │ - 活动笔记本                     ││    │
│  │  │ - 消息历史        │  │ - 笔记条目                       ││    │
│  │  └──────────────────┘  └──────────────────────────────────┘│    │
│  └────────────────────────────────────────────────────────────┘    │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  AI Layer Stores                            │    │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐│    │
│  │  │ InsightStore     │  │ AgentStore                       ││    │
│  │  │ - 按论文缓存      │  │ - Agent 状态                     ││    │
│  │  │ - 生成状态        │  │ - 上下文工程                     ││    │
│  │  └──────────────────┘  └──────────────────────────────────┘│    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 新 Store 设计

#### ChatSessionStore

```typescript
interface ChatSessionState {
  // 会话列表
  sessions: ChatSession[];
  
  // 当前活动会话
  activeSessionId: string | null;
  
  // 加载状态
  isLoading: boolean;
  
  // 流式响应
  streamingMessage: string;
}

interface ChatSessionActions {
  // 会话管理
  createSession: (title: string, paperIds?: string[]) => ChatSession;
  deleteSession: (id: string) => void;
  archiveSession: (id: string) => void;
  
  // 切换会话
  setActiveSession: (id: string) => void;
  
  // 关联论文
  addPaperToSession: (sessionId: string, paperId: string) => void;
  removePaperFromSession: (sessionId: string, paperId: string) => void;
  
  // 消息
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  
  // 持久化
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}
```

#### NotebookStore

```typescript
interface NotebookState {
  // 笔记本列表
  notebooks: Notebook[];
  
  // 当前活动笔记本
  activeNotebookId: string | null;
  
  // 加载状态
  isLoading: boolean;
}

interface NotebookActions {
  // 笔记本管理
  createNotebook: (name: string) => Notebook;
  deleteNotebook: (id: string) => void;
  renameNotebook: (id: string, name: string) => void;
  
  // 切换笔记本
  setActiveNotebook: (id: string) => void;
  
  // 笔记条目
  addEntry: (notebookId: string, entry: Omit<NoteEntry, 'id' | 'createdAt'>) => void;
  removeEntry: (notebookId: string, entryId: string) => void;
  updateEntry: (notebookId: string, entryId: string, updates: Partial<NoteEntry>) => void;
  
  // 持久化
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}
```

#### InsightStore (重构)

```typescript
interface InsightState {
  // 按论文缓存的 Insights
  paperInsightsCache: Map<string, PaperInsights>;
  
  // 当前论文的 Insights（快速访问）
  currentPaperId: string | null;
  currentInsights: PaperInsight[];
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
}

interface InsightActions {
  // 切换论文时自动切换 insights
  setCurrentPaper: (paperId: string) => void;
  
  // 生成 insights
  generateInsights: (paperId: string, context: PaperContext) => Promise<void>;
  
  // 缓存管理
  getCachedInsights: (paperId: string) => PaperInsights | null;
  clearCache: (paperId?: string) => void;
}
```

---

## 4. Context Engineering 设计

### 4.1 上下文层次

```
┌─────────────────────────────────────────────────────────────────────┐
│                      上下文层次结构                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Level 1: System Context (固定)                                     │
│  ├── AI 角色定义                                                    │
│  ├── 引用格式规范                                                    │
│  └── 输出格式要求                                                    │
│                                                                     │
│  Level 2: Paper Context (按需加载)                                  │
│  ├── 论文元数据 (title, authors, abstract)                          │
│  ├── 结构化内容 (带 detection ID 的段落)                            │
│  └── 图表信息 (可选)                                                 │
│                                                                     │
│  Level 3: Selection Context (用户选择)                              │
│  ├── 选中文本/区域                                                   │
│  └── 相关段落 (自动扩展)                                             │
│                                                                     │
│  Level 4: Conversation Context (会话历史)                           │
│  ├── 最近 N 条消息                                                   │
│  └── 重要消息摘要                                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 上下文构建策略

```typescript
interface ContextBuilder {
  /**
   * 构建完整上下文
   */
  buildContext(options: ContextBuildOptions): BuiltContext;
}

interface ContextBuildOptions {
  // 目标论文（可多个）
  papers: Array<{
    id: string;
    context: PaperContext;
    priority: 'primary' | 'reference';  // primary 论文给更多上下文
  }>;
  
  // 用户选择
  selection?: {
    paperId: string;
    detectionIds: string[];
    expandRadius?: number;  // 自动扩展相邻段落
  };
  
  // 会话历史
  conversationHistory?: ChatMessage[];
  historyLimit?: number;
  
  // 限制
  maxTokens: number;
  
  // 包含选项
  includeFigures: boolean;
  includeEquations: boolean;
  includeReferences: boolean;
}

interface BuiltContext {
  systemPrompt: string;
  userPrompt: string;
  totalTokens: number;
  
  // 用于后处理（提取引用）
  detectionIdMap: Map<string, { paperId: string; pageNumber: number }>;
  
  // 论文别名映射 (用于解析 AI 响应中的标签)
  paperAliasMap: Record<string, string>;  // {A: "2601.02346v1", B: "1706.03762"}
}
```

### 4.3 论文别名分配策略

```typescript
// ============================================================
// 论文别名分配器
// ============================================================

class PaperAliasAssigner {
  private aliases = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  /**
   * 为会话中的论文分配稳定别名
   * 
   * 关键：同一会话中，同一论文的别名必须稳定不变
   * 否则历史消息中的 [[A:xxx]] 会失效
   */
  assignAliases(
    paperIds: string[],
    existingMap?: Record<string, string>
  ): Record<string, string> {
    const map: Record<string, string> = { ...existingMap };
    const usedAliases = new Set(Object.values(map));
    
    for (const paperId of paperIds) {
      // 已有别名，跳过
      if (Object.keys(map).some(alias => map[alias] === paperId)) {
        continue;
      }
      
      // 分配新别名
      const nextAlias = this.aliases.find(a => !usedAliases.has(a));
      if (nextAlias) {
        map[nextAlias] = paperId;
        usedAliases.add(nextAlias);
      }
    }
    
    return map;
  }
  
  /**
   * 反向查找：paperId → alias
   */
  getAliasForPaper(paperId: string, map: Record<string, string>): string | null {
    return Object.entries(map).find(([_, id]) => id === paperId)?.[0] || null;
  }
}

// ============================================================
// 会话级别别名管理
// ============================================================

interface ChatSession {
  id: string;
  // ...其他字段
  
  // 别名映射：会话创建后固定，只能追加新论文
  paperAliasMap: Record<string, string>;  // {A: "2601.02346v1"}
}

// 添加论文到会话时更新别名
function addPaperToSession(sessionId: string, paperId: string) {
  const session = chatSessionStore.getSession(sessionId);
  const assigner = new PaperAliasAssigner();
  
  session.paperIds.push(paperId);
  session.paperAliasMap = assigner.assignAliases(
    session.paperIds,
    session.paperAliasMap  // 保留现有映射
  );
  
  chatSessionStore.updateSession(session);
}
```

```
┌─────────────────────────────────────────────────────────────────────┐
│                  别名分配示例                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  初始状态: 会话只有 Paper A                                          │
│  paperIds: ["2601.02346v1"]                                         │
│  aliasMap: {A: "2601.02346v1"}                                      │
│                                                                     │
│  用户提问: "这篇论文的方法是什么?"                                    │
│  AI 响应: "论文使用了 RLHF [[A:p3_text_1]]..."                       │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  添加 Paper B 后:                                                    │
│  paperIds: ["2601.02346v1", "1706.03762"]                           │
│  aliasMap: {A: "2601.02346v1", B: "1706.03762"}                     │
│            ↑ A 的映射不变！                                          │
│                                                                     │
│  用户提问: "和 Transformer 比较有什么不同?"                           │
│  AI 响应: "DeepSeek [[A:p1_text_0]] 相比 Attention [[B:p2_text_3]]..."│
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  历史消息中的 [[A:p3_text_1]] 仍然有效                                │
│  因为 A → 2601.02346v1 的映射从未改变                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.4 多论文上下文提示词模板

```markdown
# System Prompt (多论文模式)

你是一个学术论文分析助手。你正在帮助用户分析多篇相关论文。

## 论文标识

当前会话包含以下论文：
- **A**: "DeepSeek-R1: Incentivizing Reasoning Capability..." (2601.02346v1)
- **B**: "Attention Is All You Need" (1706.03762)

## 引用格式

当引用论文内容时，使用以下格式：
- 格式: [[论文标识:detection_id]]
- 示例: [[A:p1_text_0]] 或 [[B:p3_equation_0]]

**重要**：必须使用论文标识前缀，否则无法区分来源。

---

# User Context (动态构建)

## [Paper A] DeepSeek-R1 (2601.02346v1)

### Abstract
A:p0_text_0: "We introduce DeepSeek-R1-Zero, a model..."

### Introduction  
A:p1_text_0: "Large language models have demonstrated..."
A:p1_text_1: "Our main contributions include..."

### Method
A:p3_text_0: "We employ reinforcement learning..."
A:p3_image_0: [Figure 1: Training pipeline diagram]

---

## [Paper B] Attention Is All You Need (1706.03762)

### Abstract
B:p0_text_0: "The dominant sequence transduction models..."

### Model Architecture
B:p2_text_0: "The Transformer follows an encoder-decoder..."
B:p2_equation_0: Attention(Q,K,V) = softmax(QK^T/√d_k)V

---

# User Question

{用户的问题}
```

### 4.5 Token 预算分配

```
总 Token 预算: 128K (GPT-4o) / 32K (GPT-4)

┌─────────────────────────────────────────────────────────────────────┐
│                      Token 预算分配                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  System Prompt:     ~2K tokens (固定)                               │
│  ├── 角色定义                                                        │
│  └── 格式规范                                                        │
│                                                                     │
│  Paper Context:     ~80K tokens (动态)                              │
│  ├── Primary Paper:  ~60K                                           │
│  │   ├── Metadata:    ~500                                          │
│  │   ├── Full Text:   ~50K (截断)                                   │
│  │   └── Figures:     ~10K                                          │
│  │                                                                  │
│  └── Reference Papers: ~20K (每篇 ~5K)                              │
│      └── Selected sections only                                     │
│                                                                     │
│  Selection Context: ~5K tokens                                      │
│  └── 用户选中内容 + 扩展                                             │
│                                                                     │
│  Conversation:      ~10K tokens                                     │
│  └── 最近 10-20 条消息                                               │
│                                                                     │
│  Response Reserve:  ~30K tokens                                     │
│  └── 留给模型响应                                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.6 智能上下文压缩

```typescript
interface ContextCompressor {
  /**
   * 压缩论文内容以适应 token 限制
   */
  compress(
    content: PageDetection[],
    maxTokens: number,
    options: CompressionOptions
  ): CompressedContent;
}

interface CompressionOptions {
  // 优先保留的部分
  priorities: {
    title: number;      // 1.0 (最高)
    abstract: number;   // 0.9
    introduction: number; // 0.8
    methods: number;    // 0.7
    results: number;    // 0.7
    conclusion: number; // 0.8
    references: number; // 0.3 (最低)
  };
  
  // 选择性包含
  includeDetectionIds?: string[];  // 必须包含这些
  
  // 截断策略
  truncateStrategy: 'head' | 'tail' | 'middle' | 'smart';
}
```

### 4.7 标签系统容错处理

```typescript
// ============================================================
// AI 生成标签的容错处理
// ============================================================

class CitationErrorHandler {
  /**
   * 处理 AI 可能产生的标签格式错误
   */
  sanitizeCitations(content: string): string {
    let sanitized = content;
    
    // 错误1: 缺少方括号 → cite:p1_text_0
    // 修复: 包裹方括号
    sanitized = sanitized.replace(
      /(?<!\[)cite:(p\d+_\w+_\d+)(?!\])/g,
      '[[$1]]'
    );
    
    // 错误2: 连续标签无空格 → [[p1]][[p2]]
    // 修复: 添加空格
    sanitized = sanitized.replace(
      /\]\]\[\[/g,
      ']] [['
    );
    
    // 错误3: 错误的前缀格式 → [A:p1_text_0] (单方括号)
    // 修复: 双方括号
    sanitized = sanitized.replace(
      /(?<!\[)\[([A-Z]:p\d+_\w+_\d+)\](?!\])/g,
      '[[$1]]'
    );
    
    // 错误4: 多余空格 → [[ p1_text_0 ]]
    // 修复: 移除空格
    sanitized = sanitized.replace(
      /\[\[\s*(.*?)\s*\]\]/g,
      '[[$1]]'
    );
    
    return sanitized;
  }
  
  /**
   * 验证引用是否存在于已知检测数据中
   */
  validateCitation(
    citation: Citation,
    availableDetections: Map<string, Set<string>>  // paperId → detectionIds
  ): ValidationResult {
    const paperDetections = availableDetections.get(citation.paperId);
    
    if (!paperDetections) {
      return {
        valid: false,
        error: 'unknown_paper',
        suggestion: `论文 ${citation.paperId} 未加载，无法跳转`
      };
    }
    
    if (!paperDetections.has(citation.detectionId)) {
      return {
        valid: false,
        error: 'unknown_detection',
        suggestion: `页面位置 ${citation.detectionId} 不存在`
      };
    }
    
    return { valid: true };
  }
}

// ============================================================
// 降级显示策略
// ============================================================

interface CitationTagFallback {
  /**
   * 当引用无效时的降级显示
   */
  renderInvalidCitation(citation: Citation, error: string): React.ReactNode {
    return (
      <span 
        className="inline-flex items-center px-1.5 py-0.5 rounded 
                   bg-stone-100 text-stone-500 text-xs cursor-not-allowed"
        title={error}
      >
        <AlertCircle className="w-3 h-3 mr-1" />
        {citation.displayIndex || '?'}
      </span>
    );
  }
  
  /**
   * 当论文未加载时，提供加载选项
   */
  renderUnloadedPaperCitation(citation: Citation): React.ReactNode {
    return (
      <button
        className="inline-flex items-center px-1.5 py-0.5 rounded
                   bg-amber-50 text-amber-700 text-xs hover:bg-amber-100"
        onClick={() => loadAndNavigate(citation)}
        title={`点击加载 ${citation.paperTitle || citation.paperId}`}
      >
        <Download className="w-3 h-3 mr-1" />
        {citation.displayIndex}
      </button>
    );
  }
}
```

---

## 5. 内容流转与来源追溯

### 5.1 内容来源追溯链

```
┌─────────────────────────────────────────────────────────────────────┐
│                      内容来源追溯链                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PDF 原文                                                            │
│     │                                                               │
│     │ 选中/提取                                                      │
│     ▼                                                               │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Detection Object                                            │    │
│  │ {id: "p1_text_0", paperId: "2601.02346v1", text: "..."}    │    │
│  └────────────────────────────────────────────────────────────┘    │
│     │                                                               │
│     ├─────────────────────┬─────────────────────┐                  │
│     │                     │                     │                  │
│     ▼                     ▼                     ▼                  │
│  Insight 生成         Chat 对话             直接提取               │
│     │                     │                     │                  │
│     ▼                     ▼                     ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                        Notes 笔记                             │ │
│  │  每条内容都保留 Citation:                                      │ │
│  │  {uri: "2601.02346v1#p1_text_0", pageNumber: 1, ...}         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Insight → Notes 流程

```typescript
// 当用户点击 "Add to Notes" 按钮
function handleAddInsightToNotes(insight: PaperInsight) {
  // 1. 获取当前笔记本
  const notebook = notebookStore.activeNotebook;
  
  // 2. 解析 insight 内容中的标签
  const parser = new CitationTagParser();
  const tags = parser.parse(insight.content);
  
  // 3. 映射为完整 Citation
  const mapper = new CitationMapper();
  const citations = mapper.mapToCitations(tags, {
    mode: 'single',
    defaultPaperId: insight.paperId  // insight 绑定的论文
  });
  
  // 4. 转换内容 (移除标签或保留)
  // 方案A: 移除标签，纯文本
  const cleanContent = insight.content.replace(/\[\[.*?\]\]/g, '');
  
  // 方案B: 保留标签，笔记中可跳转 (推荐)
  const contentWithCitations = insight.content;
  
  // 5. 创建 NoteEntry
  const entry: NoteEntry = {
    id: generateId(),
    type: 'insight',
    rawContent: contentWithCitations,
    citations: citations,  // 引用列表
    source: {
      uri: `${insight.paperId}#insight_${insight.type}`,
      paperId: insight.paperId,
      detectionId: `insight_${insight.type}`,
      paperTitle: insight.paperTitle,
      pageNumber: 0,  // insight 是全文摘要
      type: 'text',
      excerpt: insight.title
    },
    createdAt: Date.now()
  };
  
  // 6. 添加到笔记本
  notebookStore.addEntry(notebook.id, entry);
  
  // 7. 显示成功提示
  toast.success(`Added "${insight.title}" to ${notebook.name}`);
}
```

### 5.3 Chat → Notes 流程

```typescript
// 当用户选择聊天内容并点击 "Add to Notes"
function handleAddChatExcerptToNotes(
  message: ChatMessage,
  selectedText?: string  // 可选: 用户选中的部分
) {
  // 1. 确定内容
  const content = selectedText || message.rawContent;
  
  // 2. 如果是部分选中，重新解析标签
  let citations = message.citations;
  if (selectedText) {
    const parser = new CitationTagParser();
    const tags = parser.parse(selectedText);
    const mapper = new CitationMapper();
    citations = mapper.mapToCitations(tags, message.messageContext);
  }
  
  // 3. 创建 NoteEntry
  const entry: NoteEntry = {
    id: generateId(),
    type: 'chat_excerpt',
    rawContent: content,
    citations: citations,
    source: {
      uri: `chat_${message.id}`,  // 引用聊天消息
      paperId: message.messageContext.defaultPaperId || '',
      detectionId: `chat_${message.id}`,
      type: 'text',
      excerpt: content.slice(0, 100) + '...'
    },
    annotation: `From chat: ${chatSession.title}`,
    createdAt: Date.now()
  };
  
  // 4. 添加到当前笔记本
  notebookStore.addEntry(activeNotebookId, entry);
}
```

### 5.4 PDF Selection → Notes 流程

```typescript
// 用户从 PDF 选中内容后点击 "Add to Notes"
function handleAddSelectionToNotes(selection: {
  paperId: string;
  detectionIds: string[];
  text: string;
  type: 'text' | 'image' | 'table' | 'equation';
}) {
  // 1. 构建主要来源 Citation
  const primaryCitation: Citation = {
    uri: `${selection.paperId}#${selection.detectionIds[0]}`,
    paperId: selection.paperId,
    detectionId: selection.detectionIds[0],
    pageNumber: extractPageNumber(selection.detectionIds[0]),
    type: selection.type
  };
  
  // 2. 构建所有引用 (如果选中跨多个 detection)
  const citations = selection.detectionIds.map(id => ({
    uri: `${selection.paperId}#${id}`,
    paperId: selection.paperId,
    detectionId: id,
    pageNumber: extractPageNumber(id),
    type: selection.type
  }));
  
  // 3. 创建 NoteEntry
  const entry: NoteEntry = {
    id: generateId(),
    type: selection.type === 'text' ? 'highlight' : selection.type,
    rawContent: selection.type === 'image' 
      ? `![Figure](${getImageUrl(selection.paperId, selection.detectionIds[0])})`
      : selection.text,
    citations: citations,
    source: primaryCitation,
    createdAt: Date.now()
  };
  
  notebookStore.addEntry(activeNotebookId, entry);
}
```

---

## 6. 交互设计

### 6.1 Chat Panel 交互

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Chat Panel 交互流程                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────┐                   │
│  │ Session: "研究笔记 - 2026/01/07"      ▼ + │ ← 会话选择器        │
│  ├─────────────────────────────────────────────┤                   │
│  │ 📄 Paper A (primary)  ✕                    │ ← 关联论文         │
│  │ 📄 Paper B (reference) ✕                   │                   │
│  │ [+ Add Paper]                              │                   │
│  └─────────────────────────────────────────────┘                   │
│                                                                     │
│  ┌─────────────────────────────────────────────┐                   │
│  │                                             │                   │
│  │  💬 User: 比较两篇论文的方法有什么不同?      │                   │
│  │                                             │                   │
│  │  🤖 AI: Paper A 使用了... [[A:p3_text_1]]  │ ← 跨论文引用       │
│  │         Paper B 则采用... [[B:p5_text_2]]  │                   │
│  │                                             │                   │
│  └─────────────────────────────────────────────┘                   │
│                                                                     │
│  ┌─────────────────────────────────────────────┐                   │
│  │ 📎 Selected: "transformer architecture..."  │ ← 选中上下文      │
│  │ [Type your question...]              [Send] │                   │
│  └─────────────────────────────────────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Notes Panel 交互

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Notes Panel 交互流程                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────┐                   │
│  │ 📒 Notebook: "ML Research Notes"       ▼ + │ ← 笔记本选择器     │
│  └─────────────────────────────────────────────┘                   │
│                                                                     │
│  ┌─────────────────────────────────────────────┐                   │
│  │ [Editor Toolbar: B I U | H1 H2 | • 1. | </> ]                   │
│  ├─────────────────────────────────────────────┤                   │
│  │                                             │                   │
│  │ # Key Findings                              │                   │
│  │                                             │                   │
│  │ ## From Paper A                             │                   │
│  │ > The model achieves 95% accuracy...       │                   │
│  │   📄 [Paper A, p.5] ← 来源标签，可点击跳转   │                   │
│  │                                             │                   │
│  │ ## From Paper B                             │                   │
│  │ > Different approach using...              │                   │
│  │   📄 [Paper B, p.3]                        │                   │
│  │                                             │                   │
│  └─────────────────────────────────────────────┘                   │
│                                                                     │
│  ┌─────────────────────────────────────────────┐                   │
│  │ 📥 Import Queue (2 items)              [▼] │ ← 待导入队列       │
│  │   • Figure 3 from Paper A                  │                   │
│  │   • Chat excerpt about methods             │                   │
│  └─────────────────────────────────────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 跨论文引用交互

```
┌─────────────────────────────────────────────────────────────────────┐
│                   跨论文引用标签设计                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  单论文引用 (当前论文):                                              │
│  ┌───────────────────────────────────────────┐                     │
│  │  The model uses... [1]                    │                     │
│  │                     ↑                      │                     │
│  │            [1] = page 3, paragraph 2       │                     │
│  │            点击跳转到当前 PDF 位置           │                     │
│  └───────────────────────────────────────────┘                     │
│                                                                     │
│  跨论文引用:                                                         │
│  ┌───────────────────────────────────────────┐                     │
│  │  Paper A uses... [A:1]  Paper B has... [B:2]                    │
│  │                   ↑                     ↑                       │
│  │          [A:1] = Paper A, page 3        │                       │
│  │          不同颜色区分论文                 │                       │
│  │          点击: 切换到 Paper A 并跳转      │                       │
│  │                                [B:2] = Paper B, page 5          │
│  └───────────────────────────────────────────┘                     │
│                                                                     │
│  引用标签样式:                                                       │
│  ┌───────────────────────────────────────────┐                     │
│  │  当前论文:  [1]  [2]  [3]   (indigo)       │                     │
│  │  Paper A:   [A:1] [A:2]     (emerald)      │                     │
│  │  Paper B:   [B:1] [B:2]     (amber)        │                     │
│  │  Paper C:   [C:1]           (purple)       │                     │
│  └───────────────────────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. 实现计划

### 6.1 阶段划分

```
Phase 0: 标签系统基础 (Week 1 前半)    ← 新增！优先级最高
├── Citation 类型定义
├── CitationTagParser 实现
├── CitationMapper 实现
└── CitationNavigator 实现

Phase 1: Store 重构 (Week 1)
├── 创建 ChatSessionStore (使用新 Citation)
├── 创建 NotebookStore (使用新 Citation)
├── 重构 InsightStore (分离出来)
└── 数据迁移

Phase 2: 持久化层 (Week 1 后半)
├── IndexedDB 集成
├── 自动保存
└── 数据恢复

Phase 3: Context Engineering (Week 2 前半)
├── ContextBuilder 实现
├── 多论文上下文提示词
├── Token 计算与智能压缩
└── 论文别名分配策略

Phase 4: UI 更新 (Week 2 后半)
├── CitationTag 组件重构
├── Chat 会话选择器
├── Notebook 选择器
└── 跨论文跳转优化
```

### 6.1.5 Phase 0: 标签系统基础 (最优先)

```typescript
// ============================================================
// Day 1: 类型定义与解析器
// 文件: src/components/editors/pdf-reader/services/citationSystem.ts
// ============================================================

// types/citation.ts - 新建
interface CitationTypes {
  Citation: Citation;
  TagParseResult: TagParseResult;
  PaperAliasMap: Record<string, string>;
  MessageContext: {
    mode: 'single' | 'multi';
    defaultPaperId?: string;
    paperAliasMap?: PaperAliasMap;
  };
}

// services/citationTagParser.ts - 新建
class CitationTagParser {
  parse(content: string): TagParseResult[];
  parseAndReplace(content: string, replacer: (tag: TagParseResult) => string): string;
}

// services/citationMapper.ts - 新建
class CitationMapper {
  mapToCitations(results: TagParseResult[], context: MessageContext): Citation[];
  enrichCitation(citation: Citation, paperContext: PaperContext): Citation;
}

// ============================================================
// Day 2: 导航器与 UI 组件
// ============================================================

// services/citationNavigator.ts - 新建
class CitationNavigator {
  navigate(citation: Citation): void;
  canNavigate(citation: Citation): boolean;
  preloadPaper(paperId: string): Promise<void>;
}

// components/ui/CitationTag.tsx - 重构
interface CitationTagProps {
  citation: Citation;
  showPaperPrefix?: boolean;  // 多论文时显示 [A:1]
  colorScheme?: 'type' | 'paper';  // 按类型或论文着色
}

// ============================================================
// Day 3: 集成测试
// ============================================================

// 测试用例
const testCases = [
  {
    name: '单论文标签解析',
    input: 'The model [[p1_text_0]] uses [[p2_image_0]]',
    context: { mode: 'single', defaultPaperId: '2601.02346v1' },
    expected: [
      { uri: '2601.02346v1#p1_text_0', ... },
      { uri: '2601.02346v1#p2_image_0', ... }
    ]
  },
  {
    name: '多论文标签解析',
    input: 'Paper A [[A:p1_text_0]] differs from B [[B:p3_text_2]]',
    context: { 
      mode: 'multi', 
      paperAliasMap: { A: '2601.02346v1', B: '1706.03762' }
    },
    expected: [
      { uri: '2601.02346v1#p1_text_0', ... },
      { uri: '1706.03762#p3_text_2', ... }
    ]
  },
  {
    name: '混合标签解析',
    input: 'See [[p1_text_0]] and also [[A:p2_text_1]]',
    context: { 
      mode: 'multi',
      defaultPaperId: '2601.02346v1',
      paperAliasMap: { A: '2601.02346v1' }
    },
    expected: [
      { uri: '2601.02346v1#p1_text_0', ... },
      { uri: '2601.02346v1#p2_text_1', ... }
    ]
  }
];
```

### 6.2 Week 1 详细任务

```typescript
// Day 1-2: ChatSessionStore
// 文件: src/components/editors/pdf-reader/store/chatSessionStore.ts

interface Task {
  id: 'chat-store';
  files: [
    'store/chatSessionStore.ts',      // 新建
    'store/aiStore.ts',               // 移除 chat 相关
    'hooks/useChatSession.ts',        // 新建
  ];
}

// Day 3-4: NotebookStore
// 文件: src/components/editors/pdf-reader/store/notebookStore.ts

interface Task {
  id: 'notebook-store';
  files: [
    'store/notebookStore.ts',         // 新建
    'store/aiStore.ts',               // 移除 extracts 相关
    'hooks/useNotebook.ts',           // 新建
  ];
}

// Day 5: InsightStore 重构
// 文件: src/components/editors/pdf-reader/store/insightStore.ts

interface Task {
  id: 'insight-store';
  files: [
    'store/insightStore.ts',          // 从 aiStore 分离
    'hooks/useInsights.ts',           // 新建
  ];
}
```

### 6.3 Week 2 详细任务

```typescript
// Day 1-2: Context Engineering
interface Task {
  id: 'context-engine';
  files: [
    'services/contextBuilder.ts',     // 新建
    'services/contextCompressor.ts',  // 新建
    'services/paperAgentService.ts',  // 更新
  ];
}

// Day 3-4: UI 组件更新
interface Task {
  id: 'ui-update';
  files: [
    'components/ai/ChatPanel.tsx',           // 更新
    'components/ai/NotesPanel.tsx',          // 更新
    'components/ui/SessionSelector.tsx',     // 新建
    'components/ui/NotebookSelector.tsx',    // 新建
    'components/ui/CrossPaperCitation.tsx',  // 更新
  ];
}

// Day 5: 集成测试
interface Task {
  id: 'integration';
  tests: [
    '切换论文不丢失 Chat',
    '切换论文不丢失 Notes',
    '跨论文引用跳转',
    '多论文上下文对话',
  ];
}
```

---

## 7. 验收标准

### 7.1 功能验收

| ID | 功能 | 验收标准 |
|----|------|----------|
| F1 | Chat 会话独立 | 切换论文不清空对话 |
| F2 | Chat 多论文 | 可添加多篇论文到会话 |
| F3 | Notes 独立 | 切换论文不清空笔记 |
| F4 | Notes 跨论文来源 | 笔记条目显示来源论文 |
| F5 | Insight 缓存 | 切换回论文时恢复 insights |
| F6 | 跨论文引用 | 点击标签切换到对应论文 |
| F7 | 持久化 | 刷新页面数据不丢失 |

### 7.2 性能验收

| ID | 指标 | 标准 |
|----|------|------|
| P1 | 切换论文 | < 200ms |
| P2 | 切换会话 | < 100ms |
| P3 | 上下文构建 | < 500ms |
| P4 | IndexedDB 读取 | < 50ms |

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Token 超限 | AI 报错 | 智能压缩 + 分批处理 |
| IndexedDB 配额 | 数据丢失 | 配额检测 + 用户提示 |
| 多论文上下文混乱 | AI 回答错误 | 明确标记论文来源 |
| 迁移数据丢失 | 用户不满 | 备份 + 回滚机制 |

---

## 附录 A: 状态流转图

```
┌─────────────────────────────────────────────────────────────────────┐
│                   用户操作 → 状态流转                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [打开论文 A]                                                        │
│       │                                                             │
│       ▼                                                             │
│  MultiDocStore.openDocument(A)                                      │
│       │                                                             │
│       ├── InsightStore.setCurrentPaper(A)                           │
│       │       └── 从缓存加载或生成                                   │
│       │                                                             │
│       ├── CitationStore.setActivePaper(A)                           │
│       │       └── 加载 detection index                              │
│       │                                                             │
│       └── ChatSessionStore (不变)                                    │
│               └── 当前会话保持                                       │
│                                                                     │
│  [切换到论文 B]                                                       │
│       │                                                             │
│       ▼                                                             │
│  MultiDocStore.setActiveDocument(B)                                 │
│       │                                                             │
│       ├── InsightStore.setCurrentPaper(B)                           │
│       │       └── 缓存 A 的 insights，加载 B 的                      │
│       │                                                             │
│       ├── CitationStore.setActivePaper(B)                           │
│       │       └── 缓存 A 的 index，加载 B 的                         │
│       │                                                             │
│       └── ChatSessionStore (不变)                                    │
│               └── 当前会话保持！                                      │
│               └── 如果 B 不在会话论文列表，提示添加                    │
│                                                                     │
│  [发送消息]                                                          │
│       │                                                             │
│       ▼                                                             │
│  ChatSessionStore.addMessage()                                      │
│       │                                                             │
│       ├── ContextBuilder.build()                                    │
│       │       └── 构建多论文上下文                                   │
│       │                                                             │
│       └── AgentService.chat()                                       │
│               └── 流式响应 + 引用提取                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 附录 B: 关键设计决策总结

### B.1 核心问题与解决方案

| 问题 | 解决方案 | 设计理由 |
|------|----------|----------|
| 标签无法跨论文唯一标识 | 两阶段标签系统 | AI 生成简单标签，后处理添加论文信息 |
| 会话别名需要稳定 | 会话级别别名映射 | 只追加不修改，保证历史引用有效 |
| Chat/Notes 切换论文丢失 | 独立 Store | 解耦于文档状态，独立持久化 |
| 多论文上下文复杂 | 论文标识前缀 | [[A:xxx]] 格式清晰区分来源 |
| AI 标签格式可能出错 | 容错处理器 | 自动修复常见格式问题 |

### B.2 标签系统核心公式

```
统一引用标识符 (URI) = {paperId}#{detectionId}

示例: 2601.02346v1#p1_text_0
      └── 论文ID ──┘ └ 检测ID ┘

AI 生成格式:
  单论文: [[p1_text_0]]
  多论文: [[A:p1_text_0]]

存储格式:
  Citation {
    uri: "2601.02346v1#p1_text_0",
    paperId: "2601.02346v1",
    detectionId: "p1_text_0"
  }
```

### B.3 状态隔离策略

```
┌─────────────────────────────────────────────────────────────────────┐
│                    状态隔离层级                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  文档级状态 (切换文档时切换):                                        │
│  ├── InsightStore.currentInsights                                   │
│  ├── CitationStore.detectionIndex                                   │
│  └── PDFStore.viewState                                             │
│                                                                     │
│  会话级状态 (切换文档时保持):                                        │
│  ├── ChatSessionStore.activeSession                                 │
│  │       └── messages[]                                             │
│  │       └── paperAliasMap                                          │
│  └── NotebookStore.activeNotebook                                   │
│          └── entries[]                                              │
│                                                                     │
│  全局状态 (始终保持):                                                │
│  ├── ChatSessionStore.sessions[]                                    │
│  └── NotebookStore.notebooks[]                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### B.4 实施优先级

```
优先级 1 (阻塞其他工作):
  → 标签系统基础设施 (CitationTagParser, CitationMapper)
  → Citation 类型定义

优先级 2 (核心功能):
  → ChatSessionStore 重构
  → NotebookStore 重构
  → InsightStore 分离

优先级 3 (体验优化):
  → Context Engineering
  → UI 组件更新
  → 跨论文跳转动画
```

---

**文档结束**

> 请确认此设计方案。
> 
> **推荐实施顺序**: Phase 0 (标签系统) → Phase 1 (Store 重构) → Phase 2 (持久化) → Phase 3-4 (Context + UI)
>
> 优先完成标签系统是因为它是 Chat/Notes 跨论文引用的基础设施。

