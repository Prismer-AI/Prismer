# WindowView 产品设计文档

> **Version:** 3.1 | **Date:** 2026-02-24
> **Branch:** `feat/windowview-integration`
> **Companion docs:**
> - `docs/WINDOWVIEW_STATUS.md` — 技术实现分析（每个组件的代码现状、布局结构、容器集成）
> - `docs/WINDOWVIEW_CONVERGENCE.md` — 视觉统一 & 代码改进跟踪
> **Scope:** Desktop/Web 端 WindowView + Workspace 的产品逻辑

---

## 目录

1. [Workspace 的本质](#1-workspace-的本质)
2. [WindowView 的定位](#2-windowview-的定位)
3. [产物多实例](#3-产物多实例)
4. [时间线](#4-时间线)
5. [Workspace ↔ Asset 打通](#5-workspace--asset-打通)
6. [Agent 控制粒度](#6-agent-控制粒度)
7. [多 Workspace / 多 Agent / Team](#7-多-workspace--多-agent--team)
8. [移动端定位](#8-移动端定位)
9. [设计决策摘要](#9-设计决策摘要)

---

## 1. Workspace 的本质

### 1.1 定义

Workspace = **OpenClaw 学术容器 + Agent + 记忆层 + 沉淀 Context**。

```
┌─────────────────────────────────────────────────────────┐
│  Workspace                                               │
│                                                         │
│  ┌───────────────────────┐  ┌────────────────────────┐  │
│  │ OpenClaw Container     │  │ Agent                  │  │
│  │ - 运行环境 (Python,    │  │ - LLM 推理             │  │
│  │   LaTeX, Jupyter, etc) │  │ - Skill 执行           │  │
│  │ - 文件系统 /workspace  │  │ - 工作流推进            │  │
│  │ - 服务 (Gateway,       │  │ - 由模板初始化          │  │
│  │   Jupyter kernel, etc) │  │   (身份/能力/工具集)    │  │
│  └───────────────────────┘  └────────────────────────┘  │
│                                                         │
│  ┌───────────────────────┐  ┌────────────────────────┐  │
│  │ 记忆层                 │  │ 沉淀 Context            │  │
│  │ - IDENTITY.md          │  │ - 产物 (artifacts)      │  │
│  │ - MEMORY.md            │  │ - 对话历史              │  │
│  │ - Skills/              │  │ - 决策记录              │  │
│  │ - 跨容器持久化          │  │ - 时间线事件            │  │
│  │   (重启容器不丢失)      │  │ - 组件状态              │  │
│  └───────────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**四个层各司其职**：

| 层 | 是什么 | 持久化方式 |
|---|--------|----------|
| **容器** | 运行环境 — 提供计算能力、工具链、沙箱 | 容器镜像 + 挂载卷。容器可销毁重建，状态不依赖容器生命周期 |
| **Agent** | 智能层 — LLM 推理 + Skill 执行 + 意图理解 | 模板初始化（IDENTITY/SOUL/TOOLS）+ 运行时 Skill 积累 |
| **记忆** | 持续演化的偏好和能力 — 跨容器、跨会话存活 | DB + 容器部署时写入。重启容器时重新部署记忆文件 |
| **Context** | 本次研究过程中沉淀的所有产出和交互 | DB (messages, timeline, componentState) + 容器文件系统 (artifacts) |

### 1.2 前端是展开工具，没有定式

前端（Chat Panel + WindowView + Timeline）的唯一职责是 **把后端四层的能力和内容展开给人看、给人用**。

- Chat Panel 展开的是 Agent 的对话能力
- WindowView 展开的是 Context 中的产物（用对应的编辑器/查看器渲染）
- Timeline 展开的是 Context 中的事件流

前端不定义研究路径，不规定"应该先做什么后做什么"。研究路径由 **Agent（根据模板 + 用户指令） + 用户自身** 决定。

### 1.3 泛用性

研究类任务覆盖极广：

- 学术论文（CS/EE、生物医药、社会科学...）
- 投资研究（行业分析、尽调、二级市场研究）
- 学生作业和论文
- 技术报告和白皮书
- 数据分析和可视化项目

每种类型的路径和产物组合完全不同。我们的 8 个组件（Notes, Reader, LaTeX, Code, Data, Jupyter, Gallery, 3D）是 **目前提供的现成工具集**，未来会增加更多。当 LLM I/O 足够快时，甚至界面本身都可以动态生成。

因此：**设计不能假设任何特定的研究流程或产物序列**。

---

## 2. WindowView 的定位

### 2.1 是什么

WindowView 是 **容器内产物和能力的可视化操作面**。

```
容器内文件/服务  ──→  WindowView 组件  ──→  人可以看到、编辑、审阅
  .tex 文件           LaTeX Editor
  .ipynb 文件         Jupyter Notebook
  .py 文件            Code Playground
  .csv 数据           AG Grid
  .pdf 文件           PDF Reader
  ...                 ...
```

它不是"8 个工具标签页"。它是容器内容的 **投影**。Agent 在容器里产出了什么，WindowView 就展示什么。用户想操作什么，WindowView 就提供对应的编辑器。

### 2.2 当前 8 个组件

| ID | 展示什么 | 操作什么 |
|----|---------|---------|
| `ai-editor` (Notes) | 富文本笔记 | 撰写、AI 辅助写作 |
| `pdf-reader` (Reader) | PDF 文档 | 阅读、标注、AI 问答 |
| `latex-editor` (LaTeX) | LaTeX 工程 | 编辑、编译、预览 |
| `code-playground` (Code) | 代码项目 | 编辑、运行、调试 |
| `ag-grid` (Data) | 表格数据 | 浏览、筛选、导出 |
| `jupyter-notebook` (Jupyter) | 计算笔记本 | 编写代码、执行、可视化 |
| `bento-gallery` (Gallery) | 图片集 | 浏览、标注、组织 |
| `three-viewer` (3D) | 3D 模型 | 查看、旋转、测量 |

**8 个不是上限**。随着需求增加，可以添加新组件（如流程图编辑器、幻灯片、思维导图）。组件注册机制（`componentLoaders`）已支持动态扩展。

### 2.3 WindowView 不做的事

- **不定义研究流程** — 不存在"应该从 Reader 开始然后到 LaTeX"的逻辑
- **不管理工作流状态** — 哪个阶段、做到哪了，这是 Agent + 记忆层的事
- **不区分"Agent 产出"和"用户手动创建"** — 都是产物，同等对待
- **不限制组件使用顺序** — 用户可以随时切换到任何组件

---

## 3. 产物多实例

### 3.1 问题

当前每个组件只有一个实例。Agent 产出了两个 Jupyter 笔记本，或用户想同时打开三篇论文，做不到。

### 3.2 设计：工作台 + 产物实例选择器

**一级导航不变**：8 个 tab 代表工作台类型。

**每个工作台内部添加产物实例选择器**（紧凑下拉），让同一工作台可以承载多个同类产物。

**视觉设计约束**：很多组件已有内部多级导航（LaTeX 有文件 tab、Reader 有文档 tab、Code 有文件树）。选择器必须与已有导航 **视觉分层**，不加重杂乱。

**各组件整合策略**：

| 组件 | 已有内部导航 | 实例选择器形态 | 整合策略 |
|------|------------|-------------|---------|
| **Reader** | 顶部文档 tab 条 | 复用已有文档 tab 条 | `useMultiDocumentStore` 升级为产物实例管理 |
| **LaTeX** | 文件 tab (main.tex, bib, sty) | ��程选择器（下拉）在文件 tab 上方 | 一级=工程，二级=文件 |
| **Code** | 左侧 FileTree | 项目选择器（下拉）在工具栏左侧 | 一级=项目，二级=文件树 |
| **Jupyter** | 无 | 笔记本选择器（下拉）在工具栏左侧 | 新增 |
| **Notes** | 无 | 笔记选择器（下拉）在工具栏左侧 | 新增 |
| **Data** | 无 | 数据集选择器（下拉）在工具栏左侧 | 新增 |
| **Gallery** | Pack selector | 复用已有 pack selector | 升级为产物实例 |
| **3D** | Model selector | 复用已有 model selector | 升级为产物实例 |

**下拉选择器规范**：

```
┌──────────────────────────────┐
│ ▼ main-experiment.ipynb [NEW]│  ← 当前实例名 + 状态标签
├──────────────────────────────┤
│ ○ main-experiment.ipynb      │
│ ○ baseline-analysis.ipynb    │
│ ● ablation-study.ipynb [NEW] │  ← NEW = Agent 新产出
│ ──────────────────────────── │
│ + 新建                       │
│ ↓ 从资产导入                  │
└──────────────────────────────┘
```

- 位置：工具栏最左侧
- 宽度：`max-w-[240px]`，truncate
- 高度：`h-7`，与工具栏按钮齐高
- 组件：shadcn `<DropdownMenu>`

### 3.3 产物模型

产物（Artifact）是 Workspace Context 中的一等公民：

| 属性 | 说明 |
|------|------|
| `id` | 全局唯一标识 |
| `type` | 产物类型 → 决定用哪个工作台渲染 |
| `name` | 人类可读名称 |
| `version` | 线性版本号（v1 → v2 → v3） |
| `status` | `draft` / `review` / `approved` / `archived` |
| `content` | 内容本体（容器文件系统 / S3 / DB） |

> **版本管理**：线性版本号，不用 Git-style 分支。原因：(1) 不给用户增加分支合并负担；(2) Code Playground 内已可能有 git repo，嵌套 git 引发混乱；(3) 简单序号已够用。

### 3.4 产物生命周期

```
产生（Agent 产出 / 用户创建 / 从 Asset 导入）
  → 注册到 Workspace Context
    → 对应工作台的选择器出现新项
      → 用户操作（编辑 / 审阅）
        → approve → 归档到 Asset Collection
        → reject → Agent 根据反馈重新生成
        → edit → 版本递增
```

### 3.5 布局空间

**WindowView 垂直空间**：

```
┌─────────────────────────────────────────────────┐
│ ComponentTabs (一级 tab)              ~44px 固定  │
├─────────────────────────────────────────────────┤
│ 组件内容区域                           flex-1    │
│ ┌─────────────────────────────────────────────┐ │
│ │ 组件工具栏 (含实例选择器)         ~40px 固定  │ │
│ ├─────────────────────────────────────────────┤ │
│ │ 组件主体                           flex-1   │ │
│ ├─────────────────────────────────────────────┤ │
│ │ 组件状态栏 (可选)                  ~32px     │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Timeline                           ~44-280px    │
└─────────────────────────────────────────────────┘
```

各组件的内部布局详见 `WINDOWVIEW_STATUS.md` §3-9 的 Internal Layout 小节。

---

## 4. 时间线

### 4.1 时间线是什么

时间线是 **Workspace Context 中事件流的可视化**。它记录的是"这个 Workspace 里发生过什么"——不多不少。

```
[事件1: Agent 开始任务] → [事件2: 产物创建] → [事件3: 用户编辑] → [事件4: Agent 完成] → ...
```

### 4.2 当前问题

时间线用物理时间作为主轴，事件等距分布。任务持续时间越长，早期事件越挤压到左侧。

### 4.3 设计：带 tag 的事件流

时间线本质是 **带标签的、可过滤的、可折叠的事件流**。不预设任何"阶段"或"流程"。

**事件模型**：

| 字段 | 说明 |
|------|------|
| `timestamp` | 发生时间 |
| `actor` | 谁触发的（agent / user） |
| `action` | 发生了什么 |
| `tags` | 自由标签数组（Agent 或用户都可以打标签） |
| `artifactId` | 关联的产物（可选，点击可跳转） |
| `significance` | `routine` / `milestone` / `decision` |
| `annotation` | 用户批注（可选） |

**视觉设计**：

```
┌─────────────────────────────────────────────────────────────┐
│ Tag Filter:  [All] [#literature] [#experiment] [#writing]    │
│              [milestones only ☐]                              │
├─────────────────────────────────────────────────────────────┤
│ Event Track:                                                 │
│ ──●──●──◆────●──●──●───★──●──●──●──→                       │
│   │     │              │                                     │
│   │     ◆ decision     ★ milestone                          │
│   ● routine                                                  │
├─────────────────────────────────────────────────────────────┤
│ Controls: [◀] [▶] [zoom +/-]                  14:32 / 03:15 │
└─────────────────────────────────────────────────────────────┘
```

**交互**：

| 操作 | 行为 |
|------|------|
| 点击 tag filter | 只显示该标签的事件 |
| 点击事件点 | 查看事件详情 + 跳转关联产物 |
| 点击 milestone | 恢复 workspace 快照 |
| 滚轮 | 缩放时间密度 |

**Tag 的来源**：
- **Agent 自动打** — Agent 在工作过程中标记事件（如 `#data-analysis`、`#draft-v1`）
- **用户手动打** — 用户给事件加标签，用于个人组织
- **系统自动打** — `#artifact-created`、`#artifact-approved` 等系统事件

**解决事件挤压**：

不靠预设阶段解决，靠 **自适应密度 + tag 过滤**：
- 默认显示 milestone 和 decision 事件（稀疏），routine 事件按密度自动合并显示
- 用户 zoom in 看细节，zoom out 看全貌
- 用 tag filter 聚焦关注的子集

### 4.4 为什么不用 Phase-based

Phase（预设阶段）假设所有研究遵循同一个管道。实际上：

- 投资研究没有"实验设计"阶段
- 学生写课程论文可能只有"查文献→写论文"两步
- 数据工程师可能整个 workspace 只用 Jupyter + Data
- 有的研究反复迭代，根本没有线性阶段

Tag 系统比 Phase 系统更灵活：Agent 可以打任何标签来组织事件，用户可以自己加标签，没有预设的固定管道。如果某个 Agent 模板确实有阶段概��，它可以用 tag 实现（`#phase:literature-review`），但这是 Agent 行为，不是前端强制的 UI 结构。

---

## 5. Workspace ↔ Asset 打通

### 5.1 问题

Workspace Context 中的产物和 Asset 系统是割裂的。Workspace 里产出的东西不自动出现在 Assets 里。

### 5.2 设计：Workspace 自带 Collection

每个 Workspace 创建时自动绑定一个 Asset Collection。

```
WorkspaceSession 1:1 Collection
  │
  ├── 从 Assets 导入的产物 → 引用原 Asset
  ├── Agent 产出的新产物 → 新建 Asset，归入 Collection
  └── 用户手动创建的产物 → 新建 Asset，归入 Collection
```

**用户感知**：
- WindowView 内的产物选择器列表 = 该 Collection 按类型过滤
- Assets 页面可以看到每个 Workspace 的 Collection
- 一个 Asset 可属于多个 Collection

### 5.3 Asset → WindowView 路由

任何 Asset 都可以在 WindowView 中打开，系统根据类型自动路由到对应工作台：

```
openArtifactInWorkspace(assetId, assetType)
  → 确定目标工作台 (ComponentType)
  → 切换到该工作台 tab
  → 在产物选择器中创建新实例
  → 加载内容
```

类型映射遵循简单规则：PDF → Reader，.tex → LaTeX，.ipynb → Jupyter，.csv/.json → Data，等等。

---

## 6. Agent 控制粒度

### 6.1 问题

Agent 控制是命令式的 — Agent 说"切到 LaTeX"，前端就切。缺乏意图表达、过程透明、人工干预。

### 6.2 控制分层

| 层级 | 名称 | 说明 | 本期 |
|------|------|------|------|
| L0 | 环境级 | 容器内部操作，前端不可见 | 是 |
| L1 | 通知级 | 告知用户发生了什么 | 是 |
| L2 | 展示级 | 展示产物，等待审阅 | 是 |
| L3 | 交互级 | 需要用户决定 | 是 |
| L4 | 协作级 | Agent 和人同时编辑 | **设计预留** |

### 6.3 Agent 意图面板

在 Chat 或 WindowView 顶部展示 Agent 当前正在做什么：

```
┌──────────────────────────────────────────────┐
│ Agent 正在：执行数据分析                       │
│ ├─ 目标: experiment_results.csv               │
│ ├─ 工具: Jupyter                              │
│ └─ [暂停] [跳过] [接管]                        │
└──────────────────────────────────────────────┘
```

| 操作 | 效果 |
|------|------|
| 暂停 | Agent 暂停当前任务 |
| 跳过 | Agent 跳过当前步骤 |
| 接管 | Agent 退出，用户手动操作 |

### 6.4 Skill 自动 Directive（已验证 2026-02-24）

> E2E 测试确认：内容操作的 UI 切换应由 Skill 自动触发，而非 Agent 显式调用 `switch_component`。

**原则**：Skill 在执行内容操作时，作为 side-effect 自动触发相关的 UI directive。Agent 不需要（也不应该）浪费 token 去显式编排 UI 切换。

**已实现**：

| Skill | 自动触发的 Directive | 说明 |
|-------|---------------------|------|
| `latex_compile` | `SWITCH_COMPONENT(latex-editor)` + `LATEX_COMPILE_COMPLETE` | 编译前切换视角，编译后通知 PDF 预览 |
| `jupyter_execute` | `SWITCH_COMPONENT(jupyter-notebook)` + `JUPYTER_CELL_RESULT` | 执行前切换视角，执行后追加输出 |
| `load_pdf` | `SWITCH_COMPONENT(pdf-reader)` + `PDF_LOAD_DOCUMENT` | 加载前切换视角 |

**设计推导**：
- 每个内容工具都应该隐含"展示变更"的意图。写 LaTeX 就意味着要看 LaTeX 编辑器，执行代码就意味着要看 Notebook。
- Agent 只需关注"做什么"（调用哪个 skill），不需关注"怎么展示"（UI 切换）。
- 这种关联关系是 **Skill 定义的一部分**，不是 Agent 每次都需要决策的。
- 新增 Skill 时应遵循此模式：内容操作 → 自动 UI 切换。

### 6.5 Sidecar Agent：观测 → Skill 固化

> Sidecar 观测到 **意图级别**。最精准的时机是 **用户 comment / reject / edit 之后** — 用户对不及预期的反馈是最清晰的意图信号。

```
Agent 产出产物
  → 用户 comment: "引用格式应该用 Author-Year"
    → Sidecar 捕获: [条件] 引用格式 [行为] 使用 Author-Year
      → 固化为 Skill → 下次自动使用正确格式
```

为什么意图级而非字符级：字符级噪声太大（typo ≠ 偏好），操作级缺乏语义，意图级（comment/reject）是用户主动表达的最清晰信号，性能负担和隐私侵入也最小。

**设计预留，不实现。**

---

## 7. 多 Workspace / 多 Agent / Team

### 7.1 多 Workspace

每个 Workspace 是独立的 容器+Agent+记忆+Context。侧边栏列出所有 Workspace，可切换。

引入 **Project** 作为 Workspace 的可选上层组织（多个 Workspace 围绕同一研究主题）。Project 共享一个 Asset Collection。

> **设计预留**。当前侧边栏已支持 Workspace 列表和切换。Project 层级后续根据实际需求添加。

### 7.2 多 Agent

一个 Workspace 绑定一个 Agent（1:1）。

> Sub-Agent **只做设计预留，不实现**。预留方式：`AgentInstance.parentAgentId` 可选字段。

### 7.3 Team

> **只做设想和预留，不实现。** 已有基础设施（`WorkspaceParticipant`、IM 系统）但 UX 复杂，等产品成熟后展开。

### 7.4 Public Workspace — 公开与共享

> **设计决策 D14**：工作空间支持三种可见性（Private / Unlisted / Public），Public Workspace 出现在 Discovery Trending，支持 Fork / Star / Comment / 申请协作。

**核心概念**：Public Workspace 不是分享一个静态快照 — 是把一个**活的研究环境**公开。访问者看到的是实时的 Chat 历史、WindowViewer 内容、Timeline 进度。

**WindowViewer 在公开模式下的行为**：

| 组件 | 公开模式行为 |
|------|------------|
| PDF Reader | 可浏览，可看标注，不可新增标注 |
| Jupyter Notebook | 可看代码和输出，不可执行 Cell |
| LaTeX Editor | 可看源码和预览，不可编辑 |
| Code Playground | 可看代码，不可运行 |
| AG Grid | 可看数据，不可修改 |
| Timeline | 完整只读，可回放研究过程 |

**Fork 行为**：Fork 复制工作空间的**完整上下文**到用户自己的 Private Workspace：
- 论文集合（Paper 引用，不复制 PDF 原文 — 通过 arXiv/DOI 重新获取）
- 分析代码（Jupyter notebooks）
- 写作草稿（LaTeX source）
- Agent 配置（skill 选择、模型偏好）
- 不复制：Chat 历史、Agent 实例状态

**与 Section 5 (Asset Bridge) 的关系**：Fork 本质上是 "批量导入另一个 Workspace 的 Assets"，复用 Asset 系统的导入管线。

---

## 8. 移动端定位

移动端 **不支持 WindowView**。

移动端是 **监控面板 + 轻量审阅 + 紧急干预入口**：

| 能做的 | 不做的 |
|-------|--------|
| 任务监控（Agent 在做什么、进度） | WindowView 任何组件 |
| 产物审阅（approve/reject/comment 卡片） | 长时间编辑 |
| IM 对话（给 Agent 发指令） | 文件管理 |
| 通知（Agent 完成重要节点） | |
| 快速决策（Agent 请求选择） | |

---

## 9. 设计决策摘要

### 9.1 确定的决策

| # | 决策 | 理由 |
|---|------|------|
| D1 | 保持 8 个一级 tab，组件可扩展 | 泛用覆盖，注册机制已支持动态扩展 |
| D2 | 紧凑下拉选择器实现多实例 | 不与组件内部导航冲突 |
| D3 | Workspace 自动绑定 Collection | 打通 Asset 管理 |
| D4 | 时间线用带 tag 的事件流，不预设阶段 | 不假设特定研究流程，tag 比 phase 更灵活 |
| D5 | 产物版本用线性序号 | 不给用户增加 git 负担，避免嵌套 git 冲突 |
| D6 | Agent 控制分 L0-L3 实现，L4 预留 | 渐进实现 |
| D7 | Sub-Agent 设计预留 | 容器编排复杂 |
| D8 | Team 设想预留 | UX 复杂，等产品成熟 |
| D9 | 移动端不支持 WindowView | 监控 + 审阅，用卡片流 |
| D10 | Sidecar 意图级观测，设计预留 | comment/reject 后触发 |
| D11 | 分屏不做 | 不紧急不重要 |
| D12 | 前端不定义研究流程 | 流程由 Agent + 用户决定，前端只是展开工具 |
| D13 | Skill 内容操作自动触发 UI directive | Agent 不浪费 token 做 UI 编排，Skill 自带 side-effect（E2E 验证 2026-02-24） |

### 9.2 实施优先级

| 优先级 | 改动 | 依赖 |
|--------|------|------|
| **P0** | 产物实例选择器（二级导航） | componentStore 重构为多实例 |
| **P0** | Workspace ↔ Collection 自动绑定 | Prisma schema 新增 FK |
| **P0** | Asset → WindowView 路由 | 选择器 + 类型映射 |
| **P1** | 时间线重写（tag 事件流 + 自适应密度） | 事件模型扩展 + UI |
| **P1** | Agent Intent Panel | Directive 协议扩展 |
| **P1** | 产物生命周期 (draft/review/approved) | Artifact 数据模型 |
| **P2** | Project 层级 | 路由 + 侧边栏 |
| **P3** | 移动端产物卡片流 | 移动端 API + UI |
