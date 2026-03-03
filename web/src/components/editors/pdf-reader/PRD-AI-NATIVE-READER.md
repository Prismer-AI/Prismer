# AI-Native PDF Reader PRD

> **Product Requirements Document**  
> Version: 1.0  
> Date: 2026-01-03  
> Author: Pisa OS Team

---

## 目录

1. [背景与愿景](#1-背景与愿景)
2. [现状分析](#2-现状分析)
3. [第一性原理思考](#3-第一性原理思考)
4. [产品设计](#4-产品设计)
5. [技术架构](#5-技术架构)
6. [数据 Schema](#6-数据-schema)
7. [行动计划](#7-行动计划)
8. [里程碑](#8-里程碑)

---

## 1. 背景与愿景

### 1.1 AI 时代的阅读本质变化

传统 PDF 阅读器的核心假设是：**用户需要自己阅读全文，然后手动标注重点**。

AI 时代的新假设是：**用户需要与文档对话，AI 帮助用户快速理解和提取价值**。

这不是简单的"加个聊天框"，而是重新思考：

| 维度 | 传统阅读器 | AI-Native 阅读器 |
|------|-----------|-----------------|
| 主体 | 用户是信息处理者 | AI 是信息处理者，用户是决策者 |
| 交互 | 线性阅读 + 手动标注 | 对话式探索 + 智能溯源 |
| 输出 | 高亮、笔记碎片 | 结构化知识、可复用 Artifacts |
| 目标 | 记录读过什么 | 理解和应用知识 |

### 1.2 产品愿景

> **"让每篇论文都能回答你的问题，每个问题都能追溯到原文"**

核心价值主张：
1. **深度理解** - AI 预处理论文结构，提供多维度解读
2. **精准溯源** - 所有 AI 回答都可以追溯到 PDF 原文位置
3. **知识萃取** - 从论文中提取可复用的知识单元
4. **主动洞察** - AI 主动发现论文的关键信息和潜在问题

---

## 2. 现状分析

### 2.1 已有 OCR 数据能力

我们已经实现了完整的 PDF OCR 处理流水线，输出结构化数据：

```
data/output/{arxiv_id}/
├── metadata.json      # 论文元信息
├── paper.md           # 完整 Markdown 全文
├── detections.json    # 逐页检测结果（含坐标）
├── ocr_result.json    # 分页 OCR 结果
└── images/            # 提取的图像
```

#### Detection Labels 类型

| Label | 说明 | 用途 |
|-------|------|------|
| `title` | 论文标题 | 导航、元信息 |
| `sub_title` | 章节标题 | 目录生成、定位 |
| `text` | 正文段落 | 主要内容、问答上下文 |
| `image` | 图像区域 | 交互层、图像问答 |
| `image_caption` | 图像说明 | 图像理解上下文 |
| `table` | 表格区域 | 交互层、表格问答 |
| `equation` | 公式区域 | 公式识别、解释 |

#### Detection 数据结构

```typescript
interface Detection {
  label: string;
  boxes: Array<{
    x1: number;      // 原始坐标
    y1: number;
    x2: number;
    y2: number;
    x1_px: number;   // 像素坐标（用于渲染）
    y1_px: number;
    x2_px: number;
    y2_px: number;
  }>;
  raw_text: string;
}
```

### 2.2 现有右侧栏问题

当前实现 (`UnifiedRightPanel.tsx`):
- **TagPanel**: 手动高亮标签，需要用户逐字选择
- **NotesPanel**: 自由文本笔记，与 PDF 内容断联
- **ChatPanel**: 已禁用，设计过于简单

**核心问题**：
1. ❌ 没有利用 OCR 预处理数据
2. ❌ AI 功能残缺，无法真正对话
3. ❌ 标注与 AI 回答无法溯源到原文
4. ❌ 交互范式停留在 Web 2.0 时代

### 2.3 技术栈约束

- **LLM Gateway**: OpenAI-compatible API (`.env`)
  - `OPENAI_API_BASE_URL=http://34.60.178.0:3000/v1`
  - `AGENT_DEFAULT_MODEL=us-kimi-k2-0905-preview`
- **Agent SDK**: `@openai/agents` (JS) - 参考 [官方文档](https://openai.github.io/openai-agents-js/)

---

## 3. 第一性原理思考

### 3.1 用户阅读论文的本质需求

从第一性原理出发，用户阅读学术论文是为了：

1. **回答具体问题** - "这篇文章解决了什么问题？"
2. **评估价值** - "这对我的研究有用吗？"
3. **提取方法** - "他们是怎么做的？我能复现吗？"
4. **发现联系** - "这和我知道的 X 有什么关系？"
5. **形成观点** - "我同意他们的结论吗？"

### 3.2 AI 在阅读中的角色

AI 不应该替代阅读，而应该：

| AI 角色 | 说明 |
|---------|------|
| **导航员** | 帮用户快速定位到相关内容 |
| **翻译官** | 将复杂内容转化为用户能理解的语言 |
| **质疑者** | 帮用户发现论文的潜在问题 |
| **连接者** | 将论文内容与用户已有知识关联 |
| **整理者** | 将碎片信息结构化为可用知识 |

### 3.3 溯源的重要性

**为什么 AI 回答必须可溯源？**

1. **可验证性** - 用户能验证 AI 是否正确理解
2. **学术诚信** - 引用必须有出处
3. **深度学习** - 用户可以进一步阅读原文细节
4. **信任建立** - 透明的推理过程建立用户信任

---

## 4. 产品设计

### 4.1 新右侧栏架构

废弃现有的 Tags/Notes 双面板，重新设计为：

```
┌────────────────────────────────────────┐
│  🧠 Paper Intelligence                  │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │  📊 Paper Overview Card          │  │
│  │  • Title, Authors, Year          │  │
│  │  • Key Contribution (AI)         │  │
│  │  • Reading Time Estimate         │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  🔍 Quick Insights (Auto-gen)    │  │
│  │  • Core Problem [→ Page 1]       │  │
│  │  • Main Method [→ Page 4]        │  │
│  │  • Key Results [→ Page 8]        │  │
│  │  • Limitations [→ Page 12]       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  💬 Ask Paper                    │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │ What's the novelty of...   │  │  │
│  │  └────────────────────────────┘  │  │
│  │                                  │  │
│  │  [Conversation Thread...]        │  │
│  │                                  │  │
│  │  💡 Suggested Questions:         │  │
│  │  • Explain Figure 3              │  │
│  │  • Compare with prior work       │  │
│  │  • What are the limitations?     │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  📌 Extracts (Traceable)         │  │
│  │  • Highlighted: 3 passages       │  │
│  │  • AI Insights: 5 items          │  │
│  │  • Figures: 12 items [clickable] │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### 4.2 核心功能模块

#### 4.2.1 Paper Overview Card

**目的**: 30 秒了解论文价值

**内容**:
- 元信息：标题、作者、年份、期刊/会议
- AI 生成的一句话概括
- 预估阅读时间
- 论文类型标签（Survey/Method/Application）

**数据来源**: `metadata.json` + AI 生成

#### 4.2.2 Quick Insights (自动洞察)

**目的**: AI 预处理论文关键信息

**内容**:
| 洞察类型 | 说明 | 溯源 |
|---------|------|------|
| Core Problem | 论文要解决的核心问题 | → Abstract/Intro |
| Main Method | 提出的主要方法/贡献 | → Method Section |
| Key Results | 主要实验结果 | → Results Section |
| Limitations | 作者承认的局限性 | → Discussion |
| Future Work | 未来研究方向 | → Conclusion |

**交互**:
- 每条洞察可点击跳转到原文位置
- 可展开查看 AI 的详细解释
- 可追问 "Why?"

#### 4.2.3 Ask Paper (对话式问答)

**目的**: 自由对话探索论文

**特性**:
1. **上下文感知** - 自动包含 `paper.md` 作为上下文
2. **溯源引用** - 每个回答都标注来源段落
3. **多轮对话** - 支持追问和澄清
4. **建议问题** - 基于当前视图位置推荐问题

**溯源机制**:
```typescript
interface TracedResponse {
  answer: string;
  citations: Array<{
    text: string;        // 引用的原文
    pageNumber: number;  // 页码
    bbox: BoundingBox;   // 精确位置
    confidence: number;  // 匹配置信度
  }>;
}
```

**Agent 设计** (使用 `@openai/agents`):
```typescript
import { Agent, tool } from '@openai/agents';

const paperAgent = new Agent({
  name: 'paper-reader',
  model: process.env.AGENT_DEFAULT_MODEL,
  instructions: `You are an expert paper reader. 
    Answer questions based on the provided paper context.
    Always cite specific sections when making claims.`,
  tools: [
    locateInPaper,     // 定位到 PDF 位置
    explainFigure,     // 解释图表
    compareMethods,    // 比较方法
    extractFormula,    // 提取公式
  ],
});
```

#### 4.2.4 Extracts Panel (可追溯提取)

**目的**: 收集和组织从论文中提取的内容

**内容类型**:
1. **用户高亮** - 用户手动选择的文本（带 AI 解释选项）
2. **AI 洞察** - AI 主动发现的重要内容
3. **图表索引** - 所有图表的可点击列表
4. **公式列表** - 所有公式的可点击列表

**导出功能**:
- 导出为 Markdown（带溯源链接）
- 导出为 BibTeX 引用
- 导出为 Knowledge Card

### 4.3 交互层增强

#### 4.3.1 Image Layer (图像交互层)

利用 `detections.json` 中的 `image` 标签：

```typescript
// 启用图像层
const ENABLE_IMAGE_LAYER = true;

// 图像交互
interface ImageInteraction {
  onClick: (image: Detection) => void;  // 点击放大
  onAskAI: (image: Detection) => void;  // "解释这个图"
  onExtract: (image: Detection) => void; // 提取到 Extracts
}
```

**功能**:
- 悬停显示图像说明 (`image_caption`)
- 点击放大查看
- 右键菜单："Ask AI about this figure"

#### 4.3.2 Table Layer (表格交互层)

利用 `detections.json` 中的 `table` 标签：

```typescript
const ENABLE_TABLE_LAYER = true;

interface TableInteraction {
  onExtractData: (table: Detection) => void;  // 提取为结构化数据
  onCompare: (table: Detection) => void;      // "与论文 X 的表格比较"
  onExplain: (table: Detection) => void;      // "解释这个表格"
}
```

#### 4.3.3 Equation Layer (公式交互层)

利用 `detections.json` 中的 `equation` 标签：

```typescript
const ENABLE_EQUATION_LAYER = true;

interface EquationInteraction {
  onExplain: (eq: Detection) => void;     // "解释这个公式"
  onDerive: (eq: Detection) => void;      // "推导这个公式"
  onCopyLatex: (eq: Detection) => void;   // 复制 LaTeX
}
```

### 4.4 溯源高亮机制

当 AI 回答引用原文时，实现双向链接：

```
┌─────────────────────────────────────────────────────────┐
│                    PDF Content                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ "We propose a novel method that..."               │  │
│  │ ═══════════════════════════════════ ← 高亮        │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↑                               │
│                         │ 双向链接                       │
│                         ↓                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ AI Response:                                      │  │
│  │ "The main contribution is... [1]"                 │  │
│  │                                                   │  │
│  │ [1] Page 3, Line 5-7 ← 可点击跳转                 │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 技术架构

### 5.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   PDFRenderer   │  │  RightPanel     │  │  Layers     │  │
│  │   (react-pdf)   │  │  (AI-Native)    │  │  (Image/    │  │
│  │                 │  │                 │  │   Table/    │  │
│  │                 │  │  • Overview     │  │   Equation) │  │
│  │                 │  │  • Insights     │  │             │  │
│  │                 │  │  • Chat         │  │             │  │
│  │                 │  │  • Extracts     │  │             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│           │                    │                   │        │
│           └────────────────────┼───────────────────┘        │
│                                │                            │
│                    ┌───────────▼───────────┐                │
│                    │    Paper Context      │                │
│                    │    Store (Zustand)    │                │
│                    └───────────┬───────────┘                │
│                                │                            │
├────────────────────────────────┼────────────────────────────┤
│                    ┌───────────▼───────────┐                │
│                    │   Agent Service       │                │
│                    │   (@openai/agents)    │                │
│                    └───────────┬───────────┘                │
│                                │                            │
├────────────────────────────────┼────────────────────────────┤
│                    ┌───────────▼───────────┐                │
│                    │   LLM Gateway         │                │
│                    │   (OpenAI-compatible) │                │
│                    └────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 状态管理

扩展现有 `pdfStore.ts`:

```typescript
interface PaperContextState {
  // 原有状态
  pdfDocument: PDFDocumentProxy | null;
  currentPage: number;
  scale: number;
  
  // 新增：OCR 数据
  ocrData: OCRResult | null;
  detections: PageDetection[];
  paperMarkdown: string;
  
  // 新增：AI 状态
  insights: PaperInsight[];
  chatHistory: ChatMessage[];
  extracts: Extract[];
  
  // 新增：溯源状态
  activeHighlights: TracedHighlight[];
}
```

### 5.3 Agent 服务设计

```typescript
// src/services/paperAgent.ts
import { Agent, tool, run } from '@openai/agents';

// Tool: 定位到 PDF 位置
const locateTool = tool({
  name: 'locate_in_paper',
  description: 'Find and highlight a specific passage in the paper',
  parameters: z.object({
    query: z.string(),
    pageHint: z.number().optional(),
  }),
  execute: async ({ query, pageHint }) => {
    // 在 paper.md 中搜索匹配内容
    // 返回精确位置和高亮指令
  },
});

// Tool: 解释图表
const explainFigureTool = tool({
  name: 'explain_figure',
  description: 'Explain a figure or table in the paper',
  parameters: z.object({
    figureId: z.string(),
    question: z.string().optional(),
  }),
  execute: async ({ figureId, question }) => {
    // 获取图像上下文 (caption + surrounding text)
    // 生成解释
  },
});

export const paperAgent = new Agent({
  name: 'paper-reader',
  model: process.env.AGENT_DEFAULT_MODEL,
  instructions: `You are an expert academic paper reader.
    
    Your responsibilities:
    1. Answer questions about the paper accurately
    2. Always cite specific sections with page numbers
    3. Explain complex concepts in simple terms
    4. Point out potential issues or limitations
    
    When citing, use format: [Page X, Section Y]`,
  tools: [locateTool, explainFigureTool],
});

// 流式响应处理
export async function askPaper(
  question: string,
  context: PaperContext
): AsyncGenerator<StreamEvent> {
  const result = run(paperAgent, question, {
    context: {
      paperContent: context.markdown,
      currentPage: context.currentPage,
      detections: context.detections,
    },
  });
  
  for await (const event of result) {
    yield event;
  }
}
```

### 5.4 溯源匹配算法

```typescript
// src/utils/sourceMatching.ts

interface SourceMatch {
  text: string;
  pageNumber: number;
  bbox: BoundingBox;
  confidence: number;
}

/**
 * 将 AI 引用的文本匹配回 PDF 原文位置
 */
export function matchSourceInPaper(
  citedText: string,
  ocrResult: OCRResult,
  detections: PageDetection[]
): SourceMatch | null {
  // 1. 在 paper.md 中模糊搜索
  const pageHits = fuzzySearch(citedText, ocrResult.pages);
  
  // 2. 根据页面内容定位到具体 detection
  for (const hit of pageHits) {
    const pageDetections = detections[hit.pageNumber - 1];
    const match = findBestMatchingBox(citedText, pageDetections);
    
    if (match && match.confidence > 0.8) {
      return {
        text: citedText,
        pageNumber: hit.pageNumber,
        bbox: match.bbox,
        confidence: match.confidence,
      };
    }
  }
  
  return null;
}
```

---

## 6. 数据 Schema

### 6.1 Paper Context Type

```typescript
// src/types/paperContext.ts

export interface PaperContext {
  arxivId: string;
  metadata: PaperMetadata;
  markdown: string;
  pages: PageContent[];
  detections: PageDetection[];
  images: ImageAsset[];
}

export interface PaperMetadata {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  categories: string[];
  pdf_url: string;
  total_pages: number;
}

export interface PageContent {
  page_number: number;
  content: string;
  meta: {
    width: number;
    height: number;
    dpi: number;
  };
  detection_count: number;
  image_count: number;
}

export interface PageDetection {
  page_number: number;
  detections: Detection[];
}

export interface Detection {
  label: DetectionLabel;
  boxes: BoundingBox[];
  raw_text: string;
}

export type DetectionLabel = 
  | 'title' 
  | 'sub_title' 
  | 'text' 
  | 'image' 
  | 'image_caption'
  | 'table'
  | 'table_caption'
  | 'equation';
```

### 6.2 AI Response Types

```typescript
// src/types/aiResponse.ts

export interface PaperInsight {
  id: string;
  type: InsightType;
  title: string;
  content: string;
  citations: SourceCitation[];
  confidence: number;
  generatedAt: number;
}

export type InsightType = 
  | 'core_problem'
  | 'main_method'
  | 'key_results'
  | 'limitations'
  | 'future_work'
  | 'custom';

export interface SourceCitation {
  id: string;
  text: string;
  pageNumber: number;
  bbox: BoundingBox;
  sectionHint?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: SourceCitation[];
  timestamp: number;
}

export interface Extract {
  id: string;
  type: ExtractType;
  content: string;
  source: SourceCitation;
  aiExplanation?: string;
  createdAt: number;
  tags: string[];
}

export type ExtractType = 
  | 'highlight'
  | 'figure'
  | 'table'
  | 'equation'
  | 'ai_insight';
```

---

## 7. 行动计划

### Phase 1: 基础设施 (Week 1) ✅ COMPLETED

#### 1.1 Paper Context Loader
- [x] 创建 `usePaperContext` hook → `hooks/usePaperContext.ts`
- [x] 实现 OCR 数据加载 (`metadata.json`, `detections.json`, `paper.md`)
- [x] 类型定义 (`src/types/paperContext.ts`)

#### 1.2 Agent Service Setup
- [x] 配置 LLM Gateway (从 `.env`) → 支持 NEXT_PUBLIC_ 前缀
- [x] 创建基础 Paper Agent → `services/paperAgentService.ts`
- [x] 创建 Source Matching Service → `services/sourceMatchingService.ts`

#### 1.3 Store 扩展
- [x] 创建 `aiStore.ts` 管理 AI 状态
- [x] 实现溯源高亮状态管理

### Phase 2: 右侧栏重构 (Week 2) ✅ COMPLETED

#### 2.1 Panel 架构重写
- [x] 创建新的 `AIRightPanel` 组件 → `components/ai/AIRightPanel.tsx`
- [x] 实现面板布局 (Overview / Insights / Chat / Extracts)
- [ ] 删除旧的 `TagPanel`, `NotesPanel` (保留兼容性，待后续移除)

#### 2.2 Paper Overview Card
- [x] 元信息展示 → `components/ai/PaperOverviewCard.tsx`
- [x] 阅读时间估算
- [ ] AI 一句话概括生成 (TODO: 需要调用 Agent)

#### 2.3 Quick Insights
- [x] 洞察卡片 UI → `components/ai/QuickInsightsPanel.tsx`
- [x] 点击跳转到原文
- [ ] 实现 5 类洞察生成 Agent (TODO: 需要完整集成)

### Phase 3: 对话式问答 (Week 3)

#### 3.1 Chat Interface
- [ ] 对话列表 UI
- [ ] 流式响应展示
- [ ] Markdown 渲染

#### 3.2 溯源引用
- [ ] 引用提取算法
- [ ] 引用高亮组件
- [ ] 双向跳转交互

#### 3.3 建议问题
- [ ] 基于当前页面的问题推荐
- [ ] 问题点击填充

### Phase 4: 交互层增强 (Week 4)

#### 4.1 Image Layer
- [ ] 启用 `ENABLE_IMAGE_LAYER`
- [ ] 图像悬停/点击交互
- [ ] "Ask AI" 右键菜单

#### 4.2 Table Layer
- [ ] 启用 `ENABLE_TABLE_LAYER`
- [ ] 表格交互
- [ ] 数据提取功能

#### 4.3 Equation Layer
- [ ] 启用 `ENABLE_EQUATION_LAYER`
- [ ] 公式解释功能
- [ ] LaTeX 复制

### Phase 5: Extracts & 导出 (Week 5)

#### 5.1 Extracts Panel
- [ ] 提取列表 UI
- [ ] 类型筛选 (Highlights / Figures / AI Insights)
- [ ] 编辑和删除

#### 5.2 导出功能
- [ ] Markdown 导出
- [ ] JSON 导出
- [ ] 与外部工具集成 API

---

## 8. 里程碑

### M1: Alpha (Week 2)
- ✅ Paper Context 加载正常
- ✅ 基础 Agent 可对话
- ✅ 新右侧栏框架可用

### M2: Beta (Week 4)
- ✅ Quick Insights 自动生成
- ✅ 对话溯源可点击跳转
- ✅ Image/Table 交互层可用

### M3: Release (Week 5)
- ✅ 全功能可用
- ✅ 性能优化
- ✅ 文档完善

---

## 附录 A: API 参考

### Agent Streaming

参考 [OpenAI Agents Streaming Guide](https://openai.github.io/openai-agents-js/guides/streaming/):

```typescript
import { run } from '@openai/agents';

const stream = run(paperAgent, userMessage, { stream: true });

for await (const event of stream) {
  if (event.type === 'text_stream') {
    // 处理流式文本
    appendToChat(event.data);
  }
  if (event.type === 'tool_call') {
    // 处理工具调用
    handleToolCall(event.data);
  }
}
```

### 配置参考

参考 [OpenAI Agents Config Guide](https://openai.github.io/openai-agents-js/guides/config/):

```typescript
import { setDefaultOpenAIKey, setOpenAIAPI } from '@openai/agents';

// 设置 API 密钥和 Base URL
setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
setOpenAIAPI('chat_completions');

// 或使用自定义 Client
import { OpenAI } from 'openai';
import { setDefaultOpenAIClient } from '@openai/agents';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});
setDefaultOpenAIClient(client);
```

---

## 附录 B: 设计参考

### 类似产品
- [Elicit](https://elicit.com/) - AI 研究助手
- [Semantic Scholar](https://www.semanticscholar.org/) - AI 学术搜索
- [Scholarcy](https://www.scholarcy.com/) - 论文摘要生成
- [ChatPDF](https://www.chatpdf.com/) - PDF 对话

### 差异化
| 特性 | ChatPDF | Elicit | **Pisa Reader** |
|------|---------|--------|-----------------|
| 精准溯源 | ❌ | 部分 | ✅ 字符级 |
| 结构化洞察 | ❌ | ✅ | ✅ |
| 图表交互 | ❌ | ❌ | ✅ |
| 本地部署 | ❌ | ❌ | ✅ |
| 知识萃取 | ❌ | 部分 | ✅ |

---

*Document End*

