# Roadmap

## Current Status

### ✅ Completed & Live

- **Paper Reader** — AI-native PDF reader → [paper.prismer.ai/library](https://paper.prismer.ai/library) 🚀
- **Context Cloud** — Cloud-based context management → [prismer.cloud](https://prismer.cloud/) 🚀
- **Context Cloud SDK v1.7.0** — Full-featured SDK for TypeScript, Python, and Go 🎉
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

### ✅ SDK v1.7.0 — Major Release

SDK v1.7.0 is now live with significant new features across all three languages:

| Feature | TypeScript | Python | Go | Description |
|---------|------------|--------|-----|-------------|
| **File Upload** | ✅ | ✅ | ✅ | Presign-based secure upload with progress tracking |
| **Offline Mode** | ✅ | 🚧 | 🚧 | Outbox queue, sync engine, conflict resolution |
| **Storage Adapters** | MemoryStorage, IndexedDBStorage, SQLiteStorage | 🚧 | 🚧 | Pluggable storage backends |
| **Webhook Handler** | Express, Hono | ASGI, Flask, FastAPI | net/http | HMAC-SHA256 signature verification |
| **E2E Encryption** | AES-256-GCM + ECDH | 🚧 | 🚧 | End-to-end message encryption |
| **Multi-Tab Coordination** | BroadcastChannel | N/A | N/A | Leadership election for browser tabs |
| **Attachment Queue** | ✅ | 🚧 | 🚧 | Offline file upload with retry |
| **Message Threading** | ✅ | ✅ | ✅ | Parent ID support for threaded conversations |
| **New Message Types** | ✅ | ✅ | ✅ | markdown, tool_call, tool_result, thinking, image, file |

**Test Coverage:**
- TypeScript: 123 unit tests passing (37 webhook + 86 storage/offline/encryption)
- Python: 42 integration tests passing
- Go: 33 integration tests passing

**Package Versions:**
- npm: `@prismer/sdk@1.7.0`
- PyPI: `prismer==1.7.0`
- Go: `github.com/Prismer-AI/Prismer/sdk/golang@v1.7.0`

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
