# LaTeX Agent 实现方案

> 基于 LangGraph 的学术写作智能体架构设计

## 目录

1. [现有实现评估](#1-现有实现评估)
2. [架构设计](#2-架构设计)
3. [工具定义](#3-工具定义)
4. [API 接口设计](#4-api-接口设计)
5. [前端集成](#5-前端集成)
6. [Docker 打包方案](#6-docker-打包方案)
7. [行动计划](#7-行动计划)

---

## 1. 现有实现评估

### 1.1 Mock 数据服务 (已实现)

**文件**: `mockData.ts`, `types.ts`

**已实现功能**:
- ✅ 流式事件生成 (`StreamEvent`)
- ✅ 动作类型定义 (`search_papers`, `analyze_paper`, `draw_conclusion`, `write_content`)
- ✅ 论文引用结构 (`PaperReference`)
- ✅ LaTeX 内容模板（Swin Transformer 相关）
- ✅ 异步生成器模拟延迟

**评估**: Mock 实现提供了完整的数据流框架，可以直接映射到真实 Agent。

```typescript
// 现有 StreamEvent 结构
interface StreamEvent {
  type: 'action_start' | 'action_complete' | 'message' | 'content_write';
  data: {
    action?: AgentAction;
    message?: string;
    content?: string;
  };
}
```

### 1.2 TeXLive 编译服务 (已实现)

**文件**: `/src/app/api/latex/compile/route.ts`

**已实现功能**:
- ✅ POST 编译接口（LaTeX → PDF）
- ✅ GET 状态检查（TeXLive 版本）
- ✅ Base64 PDF 返回（避免跨域问题）
- ✅ 临时文件管理和清理
- ✅ 双次编译支持（处理引用）

**限制**:
- ⚠️ 硬编码 macOS TeXLive 路径 (`/Library/TeX/texbin/pdflatex`)
- ⚠️ 不支持 BibTeX 编译
- ⚠️ 不支持多文件项目

### 1.3 模板系统 (已实现)

**文件**: `/src/components/editors/previews/latex-templates/`

**已实现功能**:
- ✅ GitHub 模板导入
- ✅ 模板搜索和过滤
- ✅ 缓存服务
- ✅ 模板预览

### 1.4 PDF 阅读器 (已实现)

**文件**: `/src/components/editors/pdf-reader/`

**已实现功能**:
- ✅ react-pdf 渲染
- ✅ 多种阅读模式（单页、连续、双页）
- ✅ 文本层和注释层
- ✅ AI 侧边栏集成

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ LaTeX       │  │ PDF         │  │ Agent Chat Panel        │  │
│  │ Editor      │  │ Viewer      │  │ (Actions + Messages)    │  │
│  └─────┬───────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│        │                 │                      │                │
│        └─────────────────┴──────────────────────┘                │
│                          │                                       │
│                    SSE Stream                                    │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│                     API Layer                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              /api/latex/agent/stream                        │ │
│  │              Server-Sent Events (SSE)                       │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
│                            │                                     │
│  ┌─────────────────────────┴───────────────────────────────────┐ │
│  │                   LangGraph Agent                           │ │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐   │ │
│  │  │ Planner │→ │ Executor │→ │ Observer │→ │ Responder   │   │ │
│  │  └─────────┘  └──────────┘  └──────────┘  └─────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│  ┌─────────────────────────┴───────────────────────────────────┐ │
│  │                      Tools Layer                            │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │ │
│  │  │ Search  │  │ Analyze │  │ Write   │  │ Compile LaTeX   │ │ │
│  │  │ Papers  │  │ Papers  │  │ Content │  │ (TeXLive)       │ │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│                   External Services                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ Semantic    │  │ arXiv API   │  │ LLM API (OpenRouter)    │   │
│  │ Scholar API │  │             │  │                         │   │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 LangGraph Agent 状态机

```typescript
// Agent State Definition
interface LaTeXAgentState {
  // 用户输入
  userMessage: string;
  
  // 文档上下文
  currentDocument: {
    files: TexFile[];
    activeFile: string;
    cursorPosition?: { line: number; column: number };
  };
  
  // Agent 工作状态
  messages: BaseMessage[];
  currentAction: AgentAction | null;
  completedActions: AgentAction[];
  
  // 搜索结果缓存
  searchedPapers: PaperReference[];
  analyzedContent: Map<string, AnalysisResult>;
  
  // 输出
  generatedContent: string | null;
  targetSection: string | null;
}

// State Graph
const agentGraph = new StateGraph<LaTeXAgentState>()
  .addNode("planner", plannerNode)
  .addNode("search_papers", searchPapersNode)
  .addNode("analyze_paper", analyzePaperNode)
  .addNode("synthesize", synthesizeNode)
  .addNode("write_content", writeContentNode)
  .addNode("compile_latex", compileLatexNode)
  .addEdge(START, "planner")
  .addConditionalEdges("planner", routeByPlan)
  .addEdge("search_papers", "analyze_paper")
  .addEdge("analyze_paper", "synthesize")
  .addEdge("synthesize", "write_content")
  .addEdge("write_content", "compile_latex")
  .addEdge("compile_latex", END);
```

---

## 3. 工具定义

### 3.1 论文搜索工具

```typescript
// tools/search-papers.ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const searchPapersTool = tool(
  async ({ query, sources, maxResults }: {
    query: string;
    sources: ('arxiv' | 'semantic_scholar' | 'google_scholar')[];
    maxResults: number;
  }) => {
    const results: PaperReference[] = [];
    
    // Semantic Scholar API
    if (sources.includes('semantic_scholar')) {
      const ssResults = await searchSemanticScholar(query, maxResults);
      results.push(...ssResults);
    }
    
    // arXiv API
    if (sources.includes('arxiv')) {
      const arxivResults = await searchArxiv(query, maxResults);
      results.push(...arxivResults);
    }
    
    return {
      success: true,
      papers: results,
      totalFound: results.length,
    };
  },
  {
    name: 'search_papers',
    description: `Search academic papers from multiple sources.
Use this to find relevant research papers for citations and analysis.
Supports: Semantic Scholar, arXiv, Google Scholar.`,
    schema: z.object({
      query: z.string().describe('Search query for academic papers'),
      sources: z.array(z.enum(['arxiv', 'semantic_scholar', 'google_scholar']))
        .default(['semantic_scholar', 'arxiv']),
      maxResults: z.number().default(10),
    }),
  }
);
```

### 3.2 论文分析工具

```typescript
// tools/analyze-paper.ts
export const analyzePaperTool = tool(
  async ({ paperId, analysisType }: {
    paperId: string;
    analysisType: 'summary' | 'methodology' | 'results' | 'full';
  }) => {
    // 获取论文全文
    const paper = await fetchPaperContent(paperId);
    
    // 使用 LLM 分析
    const analysis = await analyzePaperWithLLM(paper, analysisType);
    
    return {
      success: true,
      paperId,
      analysis: analysis.summary,
      keyPoints: analysis.keyPoints,
      methodology: analysis.methodology,
      citations: analysis.relevantCitations,
    };
  },
  {
    name: 'analyze_paper',
    description: `Analyze a paper's content to extract key information.
Returns summary, key points, methodology, and relevant citations.`,
    schema: z.object({
      paperId: z.string().describe('Paper ID from search results'),
      analysisType: z.enum(['summary', 'methodology', 'results', 'full']).default('summary'),
    }),
  }
);
```

### 3.3 内容写入工具

```typescript
// tools/write-content.ts
export const writeContentTool = tool(
  async ({ 
    section, 
    content, 
    position, 
    citations 
  }: {
    section: string;
    content: string;
    position: 'append' | 'replace' | 'insert';
    citations?: string[];
  }) => {
    // 格式化 LaTeX 内容
    const formattedContent = formatLatexContent(content, citations);
    
    return {
      success: true,
      section,
      content: formattedContent,
      position,
      characterCount: formattedContent.length,
    };
  },
  {
    name: 'write_content',
    description: `Write LaTeX content to a specific section of the document.
Supports appending, replacing, or inserting content.
Automatically formats citations in BibTeX style.`,
    schema: z.object({
      section: z.string().describe('Target section name (e.g., "Introduction", "Methodology")'),
      content: z.string().describe('LaTeX content to write'),
      position: z.enum(['append', 'replace', 'insert']).default('append'),
      citations: z.array(z.string()).optional().describe('Citation keys to include'),
    }),
  }
);
```

### 3.4 LaTeX 编译工具

```typescript
// tools/compile-latex.ts
export const compileLatexTool = tool(
  async ({ content, filename }: {
    content: string;
    filename: string;
  }) => {
    const response = await fetch('/api/latex/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, filename }),
    });
    
    const result = await response.json();
    
    return {
      success: result.success,
      pdfDataUrl: result.pdfDataUrl,
      pdfUrl: result.pdfUrl,
      error: result.error,
      log: result.log,
    };
  },
  {
    name: 'compile_latex',
    description: `Compile LaTeX document to PDF using TeXLive.
Returns base64-encoded PDF for display.`,
    schema: z.object({
      content: z.string().describe('Complete LaTeX document content'),
      filename: z.string().default('document').describe('Output filename (without extension)'),
    }),
  }
);
```

### 3.5 工具集合

```typescript
// tools/index.ts
export const latexAgentTools = [
  searchPapersTool,
  analyzePaperTool,
  writeContentTool,
  compileLatexTool,
  // 扩展工具
  drawConclusionTool,
  generateBibliographyTool,
  formatTableTool,
  formatEquationTool,
];
```

---

## 4. API 接口设计

### 4.1 SSE 流式接口

```typescript
// /api/latex/agent/stream/route.ts
import { NextRequest } from 'next/server';
import { latexAgentGraph } from '@/lib/latex-agent/graph';

export async function POST(request: NextRequest) {
  const { message, documentContext } = await request.json();
  
  // 创建 SSE 响应流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 初始化 Agent 状态
        const initialState: LaTeXAgentState = {
          userMessage: message,
          currentDocument: documentContext,
          messages: [],
          currentAction: null,
          completedActions: [],
          searchedPapers: [],
          analyzedContent: new Map(),
          generatedContent: null,
          targetSection: null,
        };
        
        // 运行 Agent Graph
        for await (const event of latexAgentGraph.streamEvents(initialState)) {
          // 转换为 StreamEvent 格式
          const streamEvent = convertToStreamEvent(event);
          
          // 发送 SSE 事件
          const data = `data: ${JSON.stringify(streamEvent)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        
        // 发送完成信号
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        
      } catch (error) {
        const errorEvent = {
          type: 'error',
          data: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        controller.close();
      }
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 4.2 前端消费 SSE

```typescript
// services/agent-service.ts
export async function* streamAgentResponse(
  message: string,
  documentContext: DocumentContext
): AsyncGenerator<StreamEvent> {
  const response = await fetch('/api/latex/agent/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, documentContext }),
  });
  
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        
        try {
          yield JSON.parse(data) as StreamEvent;
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}
```

---

## 5. 前端集成

### 5.1 替换 Mock 服务

```typescript
// 修改 AgentChatPanel.tsx
import { streamAgentResponse } from '../services/agent-service';

const handleSubmit = useCallback(async (customMessage?: string) => {
  const messageText = customMessage || input.trim();
  if (!messageText || isLoading) return;
  
  // ... 用户消息处理 ...
  
  try {
    // 替换 mock 为真实 API
    for await (const event of streamAgentResponse(messageText, {
      files,
      activeFile,
    })) {
      switch (event.type) {
        case 'action_start':
          setCurrentAction(event.data.action);
          break;
        case 'action_complete':
          // 更新已完成动作
          break;
        case 'content_write':
          // 写入编辑器
          onContentWrite?.(event.data.content);
          break;
        case 'message':
          // 显示消息
          break;
      }
    }
  } catch (error) {
    // 错误处理
  }
}, [input, isLoading, files, activeFile, onContentWrite]);
```

### 5.2 文档上下文传递

```typescript
// 从 LatexEditorPreview 传递上下文
<AgentChatPanel
  onContentWrite={handleAgentContentWrite}
  documentContext={{
    files,
    activeFile,
    cursorPosition: getCursorPosition(),
  }}
/>
```

---

## 6. Docker 打包方案

### 6.1 可行性分析

| 方面 | 评估 | 说明 |
|------|------|------|
| TeXLive 打包 | ✅ 可行 | 官方 Docker 镜像 `texlive/texlive` |
| Next.js 服务 | ✅ 可行 | 标准 Node.js 部署 |
| LLM API 依赖 | ✅ 可行 | 通过环境变量配置 |
| 镜像大小 | ⚠️ 较大 | TeXLive full ~4GB, basic ~500MB |
| 编译性能 | ⚠️ 一般 | 需要优化缓存策略 |

### 6.2 Dockerfile 设计

```dockerfile
# Dockerfile.latex-agent
FROM texlive/texlive:latest-basic AS texlive

# 安装额外的 LaTeX 包
RUN tlmgr update --self && \
    tlmgr install \
    amsmath \
    amssymb \
    booktabs \
    hyperref \
    geometry \
    fancyhdr \
    graphicx \
    xcolor \
    listings \
    algorithm2e \
    tikz \
    pgfplots

# --- Node.js 阶段 ---
FROM node:20-slim AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建 Next.js
RUN npm run build

# --- 运行阶段 ---
FROM node:20-slim AS runner

WORKDIR /app

# 从 texlive 镜像复制 TeXLive
COPY --from=texlive /usr/local/texlive /usr/local/texlive

# 设置 TeXLive 路径
ENV PATH="/usr/local/texlive/2024/bin/x86_64-linux:$PATH"

# 复制构建产物
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

# API Keys（运行时注入）
# ENV OPENROUTER_API_KEY=
# ENV SEMANTIC_SCHOLAR_API_KEY=

EXPOSE 3000

CMD ["npm", "start"]
```

### 6.3 docker-compose.yml

```yaml
version: '3.8'

services:
  latex-agent:
    build:
      context: .
      dockerfile: Dockerfile.latex-agent
    ports:
      - "3000:3000"
    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
      - OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
      - SEMANTIC_SCHOLAR_API_KEY=${SEMANTIC_SCHOLAR_API_KEY}
    volumes:
      - latex-output:/app/public/data/latex-output
      - latex-cache:/app/.cache
    restart: unless-stopped

volumes:
  latex-output:
  latex-cache:
```

### 6.4 镜像优化策略

1. **使用 texlive-basic**: ~500MB vs texlive-full ~4GB
2. **按需安装包**: 只安装必要的 LaTeX 包
3. **多阶段构建**: 减少最终镜像大小
4. **缓存层优化**: 利用 Docker 层缓存
5. **.dockerignore**: 排除不必要文件

```
# .dockerignore
node_modules
.next
.git
*.md
tests/
```

### 6.5 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Kubernetes / Docker Swarm              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ latex-agent-1   │  │ latex-agent-2   │  (Replicas)       │
│  │ (Next.js +      │  │ (Next.js +      │                   │
│  │  TeXLive)       │  │  TeXLive)       │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                            │
│           └─────────┬──────────┘                            │
│                     │                                       │
│           ┌─────────┴─────────┐                             │
│           │   Load Balancer   │                             │
│           └─────────┬─────────┘                             │
└─────────────────────┼───────────────────────────────────────┘
                      │
                 HTTPS/WSS
                      │
              ┌───────┴───────┐
              │   CDN/Proxy   │
              │   (Nginx)     │
              └───────────────┘
```

---

## 7. 行动计划

### Phase 1: 基础设施 (1-2 天)

- [ ] 创建 `/src/lib/latex-agent/` 目录结构
- [ ] 安装依赖: `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`
- [ ] 配置 OpenRouter API 连接
- [ ] 实现基本的 LangGraph 状态机

### Phase 2: 工具实现 (2-3 天)

- [ ] 实现 `search_papers` 工具 (Semantic Scholar + arXiv)
- [ ] 实现 `analyze_paper` 工具 (LLM 分析)
- [ ] 实现 `write_content` 工具 (LaTeX 格式化)
- [ ] 增强 `compile_latex` 工具 (支持 BibTeX)

### Phase 3: API 集成 (1-2 天)

- [ ] 实现 `/api/latex/agent/stream` SSE 接口
- [ ] 实现前端 `streamAgentResponse` 服务
- [ ] 替换 `AgentChatPanel` 中的 mock 调用

### Phase 4: 功能完善 (2-3 天)

- [ ] 添加对话历史管理
- [ ] 实现文档上下文感知
- [ ] 添加引用自动格式化
- [ ] 实现错误恢复机制

### Phase 5: Docker 打包 (1-2 天)

- [ ] 创建 Dockerfile
- [ ] 测试本地 Docker 构建
- [ ] 优化镜像大小
- [ ] 编写 docker-compose.yml

### Phase 6: 测试与文档 (1-2 天)

- [ ] 端到端测试
- [ ] 性能测试
- [ ] 编写用户文档
- [ ] API 文档

---

## 附录

### A. 环境变量配置

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

SEMANTIC_SCHOLAR_API_KEY=xxx

# TeXLive 路径 (macOS)
TEXLIVE_PATH=/Library/TeX/texbin

# TeXLive 路径 (Linux/Docker)
# TEXLIVE_PATH=/usr/local/texlive/2024/bin/x86_64-linux
```

### B. 目录结构

```
src/
├── lib/
│   └── latex-agent/
│       ├── index.ts
│       ├── graph.ts           # LangGraph 状态机
│       ├── nodes/
│       │   ├── planner.ts
│       │   ├── search.ts
│       │   ├── analyze.ts
│       │   ├── synthesize.ts
│       │   └── write.ts
│       ├── tools/
│       │   ├── index.ts
│       │   ├── search-papers.ts
│       │   ├── analyze-paper.ts
│       │   ├── write-content.ts
│       │   └── compile-latex.ts
│       ├── services/
│       │   ├── semantic-scholar.ts
│       │   ├── arxiv.ts
│       │   └── llm.ts
│       └── types.ts
├── app/
│   └── api/
│       └── latex/
│           ├── compile/
│           │   └── route.ts  # 已有
│           └── agent/
│               └── stream/
│                   └── route.ts  # 新增
└── components/
    └── editors/
        └── previews/
            └── latex-agent/
                ├── AGENT_IMPLEMENTATION_PLAN.md  # 本文档
                ├── types.ts      # 已有
                ├── mockData.ts   # 将被替换
                ├── services/
                │   └── agent-service.ts  # 新增
                └── components/
                    ├── AgentChatPanel.tsx  # 修改
                    └── ActionCard.tsx      # 已有
```

### C. 参考资源

1. **LangGraph 文档**: https://langchain-ai.github.io/langgraph/
2. **Semantic Scholar API**: https://api.semanticscholar.org/
3. **arXiv API**: https://arxiv.org/help/api/
4. **TeXLive Docker**: https://hub.docker.com/r/texlive/texlive
5. **OpenRouter API**: https://openrouter.ai/docs

---

*最后更新: 2026-01-29*
