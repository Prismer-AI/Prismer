<p align="center">
  <img src="docs/prismerlogo.jpeg" alt="Prismer.AI" width="120" />
</p>

<h1 align="center">Prismer.AI</h1>

<p align="center">
  <strong>Open Academic Research Operating System</strong><br>
  <sub>Read → Analyze → Write → Review</sub>
</p>

<p align="center">
  <a href="https://paper.prismer.ai/library"><strong>📖 Paper Reading</strong></a> •
  <a href="https://prismer.cloud/"><strong>☁️ Context Cloud</strong></a>
</p>

<p align="center">
  <a href="docs/components.md">Components</a> •
  <a href="docs/architecture.md">Architecture</a> •
  <a href="docs/roadmap.md">Roadmap</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## What is Prismer.AI?

Prismer.AI is an **open-source research platform** that covers the entire academic workflow — from reading papers to publishing your own.

Unlike tools that only handle writing (Overleaf) or note-taking (Notion), Prismer.AI integrates:

- 📖 **Paper Reading** — AI-native PDF reader with citation graphs
- 📊 **Data Analysis** — Jupyter notebooks with Python/R execution  
- ✍️ **Paper Writing** — LaTeX editor with real-time preview
- 🔍 **Citation Verification** — Auto-checks references against arXiv, CrossRef, Semantic Scholar

## Why Open Source?

We believe research tools should be **transparent, extensible, and community-driven**.

All core components are MIT-licensed and can be used independently:

| Package | Description |
|---------|-------------|
| `@prismer/paper-reader` | PDF reader with AI chat |
| `@prismer/latex-editor` | LaTeX editor with live preview |
| `@prismer/academic-tools` | arXiv, Semantic Scholar APIs |
| `@prismer/jupyter-kernel` | Browser-native notebooks |
| `@prismer/code-sandbox` | WebContainer code execution |
| `@prismer/agent-protocol` | Multi-agent orchestration |

👉 See [Component Documentation](docs/components.md) for usage examples.

## The Hallucination Problem

LLMs fabricate citations. Prismer.AI solves this with a **Reviewer Agent** that validates every reference against academic databases before it appears in your paper.

## Status

| Done | In Progress |
|------|-------------|
| ✅ Paper Reader ([Live](https://paper.prismer.ai/library)) | 🚧 Reviewer Agent |
| ✅ Context Cloud ([Live](https://prismer.cloud/)) | 🚧 npm package extraction |
| ✅ Context Cloud SDK | 🚧 Documentation site |
| ✅ LaTeX Editor | |
| ✅ Jupyter Integration | |
| ✅ Multi-agent system | |

## License

- **Components** (`@prismer/*`): MIT License
- **Platform**: Business Source License

See [LICENSE.md](LICENSE.md) for details.

---

<p align="center">
  <sub>Built for researchers, by researchers.</sub>
</p>
