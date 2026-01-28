<p align="center">
  <img src="docs/prismerlogo.jpeg" alt="Prismer.AI" width="120" />
</p>

<h1 align="center">Prismer.AI</h1>

<p align="center">
  <strong>开源的 OpenAI Prism 替代方案</strong>
</p>

<p align="center">
  <a href="https://paper.prismer.ai/library">论文阅读</a> ·
  <a href="https://prismer.cloud/">Context Cloud</a> ·
  <a href="https://docs.prismer.ai">文档</a> ·
  <a href="docs/roadmap.md">路线图</a>
</p>

<p align="center">
  <a href="https://github.com/Prismer-AI/Prismer/stargazers"><img src="https://img.shields.io/github/stars/Prismer-AI/Prismer?color=ffcb47&labelColor=black&style=flat-square" alt="Stars"></a>
  <a href="https://github.com/Prismer-AI/Prismer/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-blue?labelColor=black&style=flat-square" alt="License"></a>
  <a href="https://discord.gg/t896DwGPE"><img src="https://img.shields.io/discord/1234567890?color=5865F2&label=discord&labelColor=black&logo=discord&logoColor=white&style=flat-square" alt="Discord"></a>
  <a href="https://x.com/PrismerAI"><img src="https://img.shields.io/twitter/follow/PrismerAI?style=flat-square&logo=x&labelColor=black" alt="X (Twitter)"></a>
  <a href="https://www.linkedin.com/company/prismer-ai"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
</p>

<p align="center">
  <a href="./README.md"><img alt="English" src="https://img.shields.io/badge/English-d9d9d9"></a>
  <a href="./README.zh-CN.md"><img alt="简体中文" src="https://img.shields.io/badge/简体中文-d9d9d9"></a>
  <a href="./README.ja.md"><img alt="日本語" src="https://img.shields.io/badge/日本語-d9d9d9"></a>
  <a href="./README.fr.md"><img alt="Français" src="https://img.shields.io/badge/Français-d9d9d9"></a>
  <a href="./README.de.md"><img alt="Deutsch" src="https://img.shields.io/badge/Deutsch-d9d9d9"></a>
</p>

---

## 🚀 在线产品

<table>
<tr>
<td align="center" width="50%">
<a href="https://paper.prismer.ai/library">
<img src="https://img.shields.io/badge/📖_论文阅读-立即体验-blue?style=for-the-badge&labelColor=black" alt="Paper Reading">
</a>
<br/>
<sub>AI 原生 PDF 阅读器，支持引用图谱</sub>
</td>
<td align="center" width="50%">
<a href="https://prismer.cloud/">
<img src="https://img.shields.io/badge/☁️_Context_Cloud-立即体验-purple?style=for-the-badge&labelColor=black" alt="Context Cloud">
</a>
<br/>
<sub>云端上下文管理与 SDK</sub>
</td>
</tr>
</table>

---

## Prismer.AI 是什么？

Prismer.AI 是一个**开源研究平台**，覆盖从阅读论文到发表论文的完整学术工作流程。

与只能处理写作（Overleaf）或笔记（Notion）的工具不同，Prismer.AI 集成了：

| 功能 | 描述 |
|------|------|
| 📖 **论文阅读** | AI 原生 PDF 阅读器，支持引用图谱 |
| ☁️ **Context Cloud** | 云端知识管理与 SDK |
| 📊 **数据分析** | Jupyter 笔记本，支持 Python/R 执行 |
| ✍️ **论文写作** | LaTeX 编辑器，实时预览 |
| 🔍 **引用验证** | 自动检查学术数据库中的参考文献 |
| 🤖 **多智能体系统** | 协调专业 AI 代理进行研究 |

---

## 功能对比

| 功能 | Prismer.AI | OpenAI Prism | Overleaf | Notion |
|------|:----------:|:------------:|:--------:|:------:|
| 论文阅读 | ✅ | ❌ | ❌ | ❌ |
| Context Cloud | ✅ | ❌ | ❌ | ❌ |
| LaTeX 写作 | ✅ | ✅ | ✅ | ❌ |
| 数据分析 | ✅ | ❌ | ❌ | ❌ |
| 代码执行 | ✅ | ❌ | ❌ | ❌ |
| 引用验证 | ✅ | ❌ | ❌ | ❌ |
| 多智能体 | ✅ | ❌ | ❌ | ❌ |
| 开源 | ✅ | ❌ | ❌ | ❌ |
| 自托管 | ✅ | ❌ | ❌ | ❌ |

---

## ✨ 核心功能

### 📖 论文阅读器

AI 原生的研究论文 PDF 阅读器：
- 多文档视图，同步滚动
- 双向引用图谱
- 基于论文上下文的 AI 对话
- 图表提取
- OCR 数据集成

### ☁️ Context Cloud

云端上下文管理，提供完整 SDK 支持：

```typescript
import { ContextCloudClient } from '@prismer/context-cloud-sdk';

const client = new ContextCloudClient({ apiKey: 'your-api-key' });

// 创建上下文并查询
const context = await client.contexts.create({ name: '研究项目' });
const response = await client.query({
  contextId: context.id,
  question: '主要发现是什么？'
});
```

### ✍️ LaTeX 编辑器

现代 LaTeX 编辑器：
- 实时 KaTeX 预览
- 多文件项目支持
- 模板库（IEEE、ACM、Nature、arXiv）
- 智能错误恢复与自动修复

### 🔍 引用验证

LLM 会捏造引用。Prismer.AI 通过 **Reviewer Agent** 解决这个问题，在引用出现在论文中之前，自动验证每个参考文献是否存在于学术数据库（arXiv、Semantic Scholar、CrossRef）中。

---

## 📦 开源组件

所有核心组件采用 MIT 许可，可独立使用：

| 包名 | 描述 |
|------|------|
| `@prismer/paper-reader` | 支持 AI 对话的 PDF 阅读器 |
| `@prismer/context-cloud-sdk` | Context Cloud TypeScript SDK |
| `@prismer/latex-editor` | 实时预览的 LaTeX 编辑器 |
| `@prismer/academic-tools` | arXiv、Semantic Scholar API |
| `@prismer/jupyter-kernel` | 浏览器原生笔记本 |
| `@prismer/code-sandbox` | WebContainer 代码执行 |
| `@prismer/agent-protocol` | 多智能体协调 |

👉 查看[组件文档](docs/components.md)获取使用示例。

---

## 🛠️ 自托管

即将推出。Star 本仓库以获取通知！

```bash
# Docker 部署（即将推出）
docker run -d -p 3000:3000 prismer/prismer
```

---

## 🗺️ 路线图

| 已完成 | 进行中 |
|--------|--------|
| ✅ 论文阅读器 | 🚧 Reviewer Agent |
| ✅ Context Cloud | 🚧 npm 包提取 |
| ✅ Context Cloud SDK | 🚧 文档站点 |
| ✅ LaTeX 编辑器 | 🚧 自托管指南 |
| ✅ 多智能体系统 | |

查看[完整路线图](docs/roadmap.md)了解详情。

---

## 🤝 贡献

欢迎贡献！请先阅读我们的[贡献指南](CONTRIBUTING.md)。

<a href="https://github.com/Prismer-AI/Prismer/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Prismer-AI/Prismer" />
</a>

---

## ⭐ Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=Prismer-AI/Prismer&type=Date)](https://star-history.com/#Prismer-AI/Prismer&Date)

---

## 📄 许可证

- **组件** (`@prismer/*`): [MIT 许可证](LICENSE.md)
- **平台**: Business Source License

---

<p align="center">
  <sub>由研究者打造，为研究者服务。</sub>
</p>
