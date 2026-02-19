# Roadmap

## Current Status

### ✅ Completed & Live

- **Paper Reader** — AI-native PDF reader → [paper.prismer.ai/library](https://paper.prismer.ai/library) 🚀
- **Context Cloud** — Cloud-based context management → [prismer.cloud](https://prismer.cloud/) 🚀
- **Context Cloud SDK** — TypeScript/JavaScript SDK for Context Cloud API
- LaTeX Editor with live preview
- Jupyter Notebook integration
- Code Playground (WebContainer)
- Multi-agent orchestration
- Phase-based planning

### 🚧 In Progress

- Reviewer Agent (citation verification)
- Knowledge base with RAG
- npm package extraction
- Documentation site

### ✅ SDK v1.5.0 — Webhook Handler

SDK v1.5.0 adds webhook handling across all three SDK languages (TypeScript, Python, Go).

| Feature | TS | Python | Go |
|---------|----|----|-----|
| HMAC-SHA256 signature verification | `@prismer/sdk/webhook` | `prismer.webhook` | `prismer` package |
| Typed webhook payload parsing | ✅ | ✅ | ✅ |
| Framework adapters | Express, Hono | ASGI, Flask, FastAPI | net/http |
| Unit + integration tests | 37 | 29 | 30 |

See [TODO.md](./TODO.md) for design details and API reference.

### 🔮 Future

- Collaborative research workspaces
- Research project management
- Publishing pipeline integration
- Citation network visualization
- Institutional deployment options

## Comparison

| Feature | Prismer.AI | OpenAI Prism | Overleaf | Notion |
|---------|------------|--------------|----------|--------|
| Paper Reading | ✅ AI-native | ❌ | ❌ | ❌ |
| LaTeX Writing | ✅ | ✅ | ✅ | ❌ |
| Data Analysis | ✅ Jupyter | ❌ | ❌ | ❌ |
| Code Execution | ✅ Sandbox | ❌ | ❌ | ❌ |
| Citation Verification | ✅ Auto | ❌ | ❌ | ❌ |
| Multi-Agent | ✅ | ❌ | ❌ | ❌ |
| Open Source | ✅ | ❌ | ❌ | ❌ |
| Self-Hosted | ✅ | ❌ | ❌ | ❌ |
