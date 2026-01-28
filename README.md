<p align="center">
  <img src="docs/prismerlogo.jpeg" alt="Prismer.AI" width="120" />
</p>

<h1 align="center">Prismer.AI</h1>

<p align="center">
  <strong>Open Source OpenAI Prism Alternative</strong>
</p>

<p align="center">
  <a href="https://paper.prismer.ai/library">Paper Reading</a> ·
  <a href="https://prismer.cloud/">Context Cloud</a> ·
  <a href="https://docs.prismer.ai">Documentation</a> ·
  <a href="docs/roadmap.md">Roadmap</a>
</p>

<p align="center">
  <a href="https://github.com/Prismer-AI/Prismer/stargazers"><img src="https://img.shields.io/github/stars/Prismer-AI/Prismer?color=ffcb47&labelColor=black&style=flat-square" alt="Stars"></a>
  <a href="https://github.com/Prismer-AI/Prismer/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-blue?labelColor=black&style=flat-square" alt="License"></a>
  <a href="https://discord.gg/VP2HQHbHGn"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white&labelColor=black" alt="Discord"></a>
  <a href="https://x.com/PrismerAI"><img src="https://img.shields.io/twitter/follow/PrismerAI?style=flat-square&logo=x&labelColor=black" alt="X (Twitter)"></a>
  <a href="https://www.linkedin.com/company/prismer-ai"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
</p>

<p align="center">
  <a href="./README.md"><img alt="English" src="https://img.shields.io/badge/English-d9d9d9"></a>
  <a href="./docs/i18n/README.zh-CN.md"><img alt="简体中文" src="https://img.shields.io/badge/简体中文-d9d9d9"></a>
  <a href="./docs/i18n/README.ja.md"><img alt="日本語" src="https://img.shields.io/badge/日本語-d9d9d9"></a>
  <a href="./docs/i18n/README.fr.md"><img alt="Français" src="https://img.shields.io/badge/Français-d9d9d9"></a>
  <a href="./docs/i18n/README.de.md"><img alt="Deutsch" src="https://img.shields.io/badge/Deutsch-d9d9d9"></a>
</p>

---

## 🚀 Live Products

<table>
<tr>
<td align="center" width="50%">
<a href="https://paper.prismer.ai/library">
<img src="https://img.shields.io/badge/📖_Paper_Reading-Try_Now-blue?style=for-the-badge&labelColor=black" alt="Paper Reading">
</a>
<br/>
<sub>AI-native PDF reader with citation graphs</sub>
</td>
<td align="center" width="50%">
<a href="https://prismer.cloud/">
<img src="https://img.shields.io/badge/☁️_Context_Cloud-Try_Now-purple?style=for-the-badge&labelColor=black" alt="Context Cloud">
</a>
<br/>
<sub>Cloud-based context management & SDK</sub>
</td>
</tr>
</table>

---

## What is Prismer.AI?

Prismer.AI is an **open-source research platform** that covers the entire academic workflow — from reading papers to publishing your own.

Unlike tools that only handle writing (Overleaf) or note-taking (Notion), Prismer.AI integrates:

| Feature | Description |
|---------|-------------|
| 📖 **Paper Reading** | AI-native PDF reader with citation graphs |
| ☁️ **Context Cloud** | Cloud-based knowledge management with SDK |
| 📊 **Data Analysis** | Jupyter notebooks with Python/R execution |
| ✍️ **Paper Writing** | LaTeX editor with real-time preview |
| 🔍 **Citation Verification** | Auto-checks references against academic databases |
| 🤖 **Multi-Agent System** | Orchestrate specialized AI agents for research |

---

## Comparison

| Feature | Prismer.AI | OpenAI Prism | Overleaf | Google Scholar |
|---------|:----------:|:------------:|:--------:|:--------------:|
| Paper Reading | ✅ | ❌ | ❌ | ✅ |
| Context Cloud | ✅ | ❌ | ❌ | ❌ |
| LaTeX Writing | ✅ | ✅ | ✅ | ❌ |
| Data Analysis | ✅ | ❌ | ❌ | ❌ |
| Code Execution | ✅ | ❌ | ❌ | ❌ |
| Citation Verification | ✅ | ❌ | ❌ | ❌ |
| Multi-Agent | ✅ | ❌ | ❌ | ❌ |
| Open Source | ✅ | ❌ | ❌ | ❌ |
| Self-Hosted | ✅ | ❌ | ❌ | ❌ |

---

## ✨ Key Features

### 📖 Paper Reader

AI-native PDF reader for research papers with:
- Multi-document view with synchronized scrolling
- Bi-directional citation graph
- AI chat with paper context
- Figure/table extraction
- OCR data integration

### ☁️ Context Cloud

Cloud-based context management with full SDK support:

```typescript
import { ContextCloudClient } from '@prismer/context-cloud-sdk';

const client = new ContextCloudClient({ apiKey: 'your-api-key' });

// Create context and query
const context = await client.contexts.create({ name: 'Research Project' });
const response = await client.query({
  contextId: context.id,
  question: 'What are the main findings?'
});
```

### ✍️ LaTeX Editor

Modern LaTeX editor with:
- Real-time KaTeX preview
- Multi-file project support
- Template library (IEEE, ACM, Nature, arXiv)
- Smart error recovery with auto-fix

### 🔍 Citation Verification

LLMs fabricate citations. Prismer.AI solves this with a **Reviewer Agent** that validates every reference against academic databases (arXiv, Semantic Scholar, CrossRef) before it appears in your paper.

---

## 📦 Open Source Components

All core components are MIT-licensed and can be used independently:

| Package | Description |
|---------|-------------|
| `@prismer/paper-reader` | PDF reader with AI chat |
| `@prismer/context-cloud-sdk` | Context Cloud TypeScript SDK |
| `@prismer/latex-editor` | LaTeX editor with live preview |
| `@prismer/academic-tools` | arXiv, Semantic Scholar APIs |
| `@prismer/jupyter-kernel` | Browser-native notebooks |
| `@prismer/code-sandbox` | WebContainer code execution |
| `@prismer/agent-protocol` | Multi-agent orchestration |

👉 See [Component Documentation](docs/components.md) for usage examples.

---

## 🛠️ Self-Hosting

Coming soon. Star this repo to get notified!

```bash
# Docker deployment (coming soon)
docker run -d -p 3000:3000 prismer/prismer
```

---

## 🗺️ Roadmap

| Done | In Progress |
|------|-------------|
| ✅ Paper Reader | 🚧 Reviewer Agent |
| ✅ Context Cloud | 🚧 npm package extraction |
| ✅ Context Cloud SDK | 🚧 Documentation site |
| ✅ LaTeX Editor | 🚧 Self-hosting guide |
| ✅ Multi-agent system | |

See [full roadmap](docs/roadmap.md) for details.

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

<a href="https://github.com/Prismer-AI/Prismer/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Prismer-AI/Prismer" />
</a>

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Prismer-AI/Prismer&type=Date)](https://star-history.com/#Prismer-AI/Prismer&Date)

---

## 📄 License

- **Components** (`@prismer/*`): [MIT License](LICENSE.md)
- **Platform**: Business Source License

---

<p align="center">
  <sub>Built for researchers, by researchers.</sub>
</p>
