# Open Source Components

Prismer.AI is built on modular, reusable components. Each package can be used independently in your own projects.

<p align="center">
  <img src="component_collection.gif" alt="Component Collection Demo" width="800" />
</p>

## Live Products

| Product | URL | Status |
|---------|-----|--------|
| Paper Reading | [paper.prismer.ai/library](https://paper.prismer.ai/library) | ✅ Live |
| Context Cloud | [prismer.cloud](https://prismer.cloud/) | ✅ Live |

---

## @prismer/sdk (v1.7.0)

TypeScript/JavaScript SDK for Context Cloud API with offline-first capabilities.

```typescript
import { PrismerClient, OfflineManager, MemoryStorage } from '@prismer/sdk';

const client = new PrismerClient({
  apiKey: 'sk-prismer-...',
  baseUrl: 'https://prismer.cloud'
});

// Load and cache web content
const result = await client.load('https://arxiv.org/abs/2301.00234');

// Parse PDF documents
const pdf = await client.parsePdf('https://arxiv.org/pdf/2301.00234.pdf');

// Agent messaging with offline support
const offline = new OfflineManager(new MemoryStorage(), client.request);
await offline.init();

// Works offline - queued in outbox
await offline.dispatch('POST', '/api/im/direct/conv-1', {
  content: 'This message works offline!'
});

// File upload with progress tracking
const file = await client.im.files.upload({
  path: './research.pdf',
  onProgress: (percent) => console.log(`Upload: ${percent}%`)
});

// E2E encrypted messaging
import { E2EEncryption } from '@prismer/sdk';
const e2e = new E2EEncryption();
await e2e.init('passphrase');
await e2e.generateSessionKey('conv-1');
const encrypted = await e2e.encrypt('conv-1', 'Secret message');
```

**Features:**
- **Context API** — Load, save, and search web content
- **Parse API** — PDF/document parsing with markdown output
- **IM API** — Agent messaging, groups, workspaces
- **Offline Mode** — Outbox queue with automatic sync
- **File Upload** — Presign-based secure uploads with progress
- **E2E Encryption** — AES-256-GCM with ECDH key exchange
- **Storage Adapters** — Memory, IndexedDB, SQLite backends
- **Webhook Handlers** — HMAC verification with framework adapters
- **Real-time** — WebSocket and SSE support
- **CLI Tool** — `prismer init`, `prismer register`, `prismer status`

Also available in **Python** (`pip install prismer`) and **Go** (`go get github.com/Prismer-AI/Prismer/sdk/golang@v1.7.0`)

---

## @prismer/paper-reader

AI-native PDF reader for research papers.

```tsx
import { PaperReader } from '@prismer/paper-reader';

<PaperReader
  source={{ type: 'arxiv', id: '2301.00234' }}
  onCitationClick={(citation) => openInLibrary(citation)}
  enableAIChat={true}
/>
```

**Features:**
- Multi-document view with synchronized scrolling
- OCR data integration for enhanced search
- Bi-directional citation graph
- AI chat with paper context
- Figure/table extraction

---

## @prismer/latex-editor

Modern LaTeX editor with real-time preview and AI assistance.

```tsx
import { LaTeXEditor } from '@prismer/latex-editor';

<LaTeXEditor
  template="ieee"
  bibliography={bibtexContent}
  onCompile={(pdf) => savePDF(pdf)}
  aiAssist={{
    model: 'claude-3-opus',
    features: ['autocomplete', 'refine', 'translate']
  }}
/>
```

**Features:**
- Real-time KaTeX preview
- Multi-file project support
- Smart error recovery with auto-fix
- Template library (IEEE, ACM, Nature, arXiv)
- Integrated BibTeX management

---

## @prismer/academic-tools

Unified API for academic data sources.

```typescript
import { ArxivSearch, SemanticScholar, CitationVerifier } from '@prismer/academic-tools';

// Search papers
const papers = await ArxivSearch.query({
  query: 'transformer attention mechanism',
  category: 'cs.LG',
  maxResults: 20
});

// Verify citations (anti-hallucination)
const verification = await CitationVerifier.verify(bibtexContent);
if (!verification.allValid) {
  console.log('Invalid citations:', verification.invalid);
}
```

**Supported Sources:**
- arXiv API
- Semantic Scholar
- CrossRef DOI
- Google Scholar (via proxy)
- OpenAlex

---

## @prismer/jupyter-kernel

Browser-native Jupyter notebook with Python/R execution.

```tsx
import { JupyterNotebook } from '@prismer/jupyter-kernel';

<JupyterNotebook
  kernel="python3"
  initialCells={cells}
  onCellExecute={(cell, output) => trackExperiment(cell, output)}
  variables={{ data: experimentData }}
/>
```

**Features:**
- Full Python/R kernel support
- Variable inspector
- Plot rendering (matplotlib, plotly, seaborn)
- Cell-level execution tracking
- Integration with paper figures

---

## @prismer/code-sandbox

Secure code execution environment powered by WebContainer.

```tsx
import { CodePlayground } from '@prismer/code-sandbox';

<CodePlayground
  template="react"
  files={projectFiles}
  onFileChange={(files) => syncToCloud(files)}
/>
```

**Features:**
- Browser-native Node.js runtime
- React/Vue/Vanilla templates
- Real-time preview
- Terminal access
- Package installation (npm)

---

## @prismer/agent-protocol

Open protocol for academic AI agents.

```typescript
import { AgentOrchestrator, LiteratureAgent, DataAgent, ReviewerAgent } from '@prismer/agent-protocol';

const orchestrator = new AgentOrchestrator({
  agents: [
    new LiteratureAgent(),  // Paper discovery & citation
    new DataAgent(),        // Analysis & visualization
    new ReviewerAgent(),    // Verification & review
  ],
  tools: [arxivSearch, latexCompile, pythonExecute],
});

const result = await orchestrator.run({
  task: 'Analyze attention patterns in transformer models',
  outputDir: './research-output'
});
```

**Agent Types:**
| Agent | Purpose |
|-------|---------|
| `BuildAgent` | Task execution & code generation |
| `PlanAgent` | Research planning & design |
| `LiteratureAgent` | Paper discovery & citation management |
| `DataAgent` | Data analysis & statistics |
| `PaperAgent` | LaTeX writing & document preparation |
| `VizAgent` | Visualization & figure generation |
| `ReviewerAgent` | Citation verification & quality review |
