<!--
 Copyright 2026 prismer

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

# WindowView Convergence — Implementation Tracker

> **Version:** 3.1 | **Date:** 2026-02-26
> **Branch:** `feat/windowview-integration`
> **Status:** Plugin v0.5.0（26 tools）；四层测试体系（Unit + L1:21 + L2:32 + L3:6 = 59+ tests）；Container Image v4.5
>
> **Companion docs:**
> - `docs/WINDOWVIEW_DESIGN.md` v3.1 — 产品设计规范（权威设计文档）
> - `docs/WINDOWVIEW_STATUS.md` v2.1 — 技术实现分析（每个组件的代码现状）

---

## 1. 文档定位

本文档跟踪 WindowView 组件统一化改进的 **实施状态**。

- **设计规范** → 见 WINDOWVIEW_DESIGN.md（产物工作台、时间线、Agent 控制等产品逻辑）
- **技术现状** → 见 WINDOWVIEW_STATUS.md（每个组件的内部布局、代码分析、容器集成）
- **本文档** → 聚焦于"哪些改进做了 / 哪些没做 / 下一步做什么"

---

## 2. 统一化目标

WindowViewer 承载 8 个编辑器组件，各自独立开发导致的 5 个系统性问题：

| # | 问题 | 目标 |
|---|------|------|
| 1 | **视觉碎片化** — 6 种不同的圆角/边框/背景色 | 组件无外壳，WindowViewer 统一提供 |
| 2 | **主题各自为政** — LaTeX/Code 自带暗色切换 | 移除组件内切换，编辑器固定暗色（语义选择） |
| 3 | **AI 集成不一致** — 各自调用 /api/ai/chat，参数不同 | 统一 ai-client + 参数归一化 |
| 4 | **产物管理碎片化** — 缺少多实例支持 | 紧凑下拉选择器，产物多实例管理 |
| 5 | **状态同步空转** — sync engine 就绪但组件未接入 | componentStore → sync bridge → DB |

---

## 3. 实施状态（已验证 2026-02-24）

### Phase A — Foundation

| Task | 文件 | 状态 | 验证结果 |
|------|------|------|---------|
| 修复 temperature bug | `src/app/api/ai/chat/route.ts` | ✅ Done | `isReasoningModel()` + `normalizeForReasoningModel()` 存在 (line 24, 59) |
| 创建统一 AI client | `src/lib/services/ai-client.ts` | ✅ File exists | 需验证组件是否实际调用 |
| 修复 LaTeX 内容消失 | `LatexEditorPreview.tsx` | ✅ Done | 条件渲染改为 CSS hidden |
| 定义 Toolbar 规范 | `src/components/shared/ComponentToolbar.tsx` | ✅ File exists | 需验证组件是否实际使用 |

### Phase B — Visual Convergence

| 组件 | 改动 | 状态 | 验证结果 |
|------|------|------|---------|
| **LaTeX** | 移除 isDarkTheme + Sun/Moon | ✅ Done | 确认无 isDarkTheme，无 Sun/Moon icon |
| **LaTeX** | 移除外壳 rounded-xl border | ✅ Done | 确认外层 div 为 `flex flex-col h-full bg-white` |
| **LaTeX** | 移除 AgentChatPanel | ⚠️ Partial | 文件 `AgentChatPanel.tsx` 仍存在，但可能未被 import |
| **Code Playground** | 固定 vs-dark, 移除 Sun/Moon | ⚠️ Unverified | 需检查代码 |
| **AG Grid** | 移除外壳, 统一 toolbar | ⚠️ Unverified | 需检查代码 |
| **AI Editor** | toolbar 横向滚动 CSS | ⚠️ Unverified | 需检查 CSS override |
| **Jupyter** | 浮动侧栏, 自动连接, 合并状态 | ⚠️ Unverified | 需检查代码 |
| **PDF Reader** | 已是干净 wrapper | ✅ N/A | 原本就是薄层 wrapper |

### Phase C — LLM Unification

| Task | 状态 | 验证结果 |
|------|------|---------|
| 组件迁移到 ai-client.ts | ⚠️ Unverified | 需检查各组件是否实际 import ai-client |
| LLMUsageLog 实现 | ⚠️ Unverified | 文档声称 console logging，需确认 |
| 环境变量配置验证 | ✅ Done | OPENAI_API_BASE_URL → NewAPI gateway |

### Phase D — Asset Browser

| Task | 状态 | 验证结果 |
|------|------|---------|
| AssetBrowser 共享组件 | ✅ File exists | `src/components/shared/AssetBrowser.tsx` |
| 集成到 Notes, AG Grid, Jupyter | ⚠️ Unverified | 需检查 import 和使用 |
| PDF Reader Notes 选项 | ⚠️ Unverified | 需检查 notes:insert event |
| Artifacts → Notes | ⚠️ Unverified | 需检查 ArtifactPreview |

### Phase E — State Sync

| Task | 状态 | 验证结果 |
|------|------|---------|
| Jupyter 同步配置 | ✅ File exists | `componentStateConfig.ts` |
| componentStore → sync bridge | ✅ File exists | `componentStateBridge.ts` |
| DOM 事件替换 | ✅ File exists | `useComponentBusEvent.ts` |
| Content sync | ✅ File exists | `useContentSync.ts` |

**注意**: 以上 4 项"文件存在"但尚未验证组件是否实际接入（即 sync bridge 是否被 componentStore 调用，DOM 事件是否实际替换完）。

### Phase F — Deep Integration

| Task | 状态 | 验证结果 |
|------|------|---------|
| Jupyter Cell → Agent Skill | ✅ File exists | `cellSkills.ts` |
| Jupyter Copilot 重设计 | ✅ File exists | `copilotService.ts` |
| LaTeX Copilot | ✅ File exists | `latexCopilotService.ts` |

**注意**: 以上 3 项"文件存在"但尚未验证是否有组件调用这些 service。

---

## 4. 已创建文件索引

以下文件在 Phase A-F 过程中创建，确认存在于代码库中：

| 文件 | 创建于 | 用途 |
|------|-------|------|
| `src/components/shared/ComponentToolbar.tsx` | Phase A | 标准化 toolbar (left/center/right slots) |
| `src/lib/services/ai-client.ts` | Phase A | 统一 AI 调用 client |
| `src/components/shared/AssetBrowser.tsx` | Phase D | 共享文件浏览器 (CommandPalette style) |
| `src/lib/sync/componentStateBridge.ts` | Phase E | Store → Sync engine bridge |
| `src/lib/events/useComponentBusEvent.ts` | Phase E | Component event bus hooks |
| `src/lib/sync/useContentSync.ts` | Phase E | Debounced content sync hooks |
| `src/components/editors/jupyter/skills/cellSkills.ts` | Phase F | 11 Jupyter cell skills |
| `src/components/editors/jupyter/services/copilotService.ts` | Phase F | 6 Jupyter copilot actions |
| `src/components/editors/previews/latex-agent/services/latexCopilotService.ts` | Phase F | 7 LaTeX copilot actions |

---

## 5. 视觉规范（目标状态）

### 5.1 WindowViewer 拥有外壳，组件只负责内容

所有组件应该：
- 移除自身的 `rounded-*`、`border`、`shadow`
- 填满 WindowViewer 的 `absolute inset-0` 容器
- 代码编辑器类使用暗色背景 (语义选择，不是"主题")
- 通过 `overflow-hidden` 让内容在宿主的圆角内自然裁切

### 5.2 统一 Toolbar 规范

```
高度: h-10 (40px)
内边距: px-3 py-2
背景:
  document 类: bg-white/80 backdrop-blur border-b border-slate-200
  editor 类:   bg-slate-800/80 backdrop-blur border-b border-slate-700
按钮: h-7 px-2 text-xs rounded-md
分隔线: w-px h-5 bg-current opacity-20
```

### 5.3 主题策略

不引入全局暗色模式。组件分两类：

| 类别 | 组件 | 背景 |
|------|------|------|
| 文档类 | Notes, Reader, Data | 跟随宿主白色背景 |
| 编辑器类 | LaTeX, Code, Jupyter | 固定暗色背景（VS Code 惯例） |
| 展示类 | Gallery, 3D | 跟随宿主白色背景 |

---

## 6. 下一步工作

### 6.1 验证 Gap（需立即完成）

Phase B-F 中大量 "⚠️ Unverified" 项需要逐一验证：

```
验证方法: 对每个 "file exists" 项
  1. 确认文件内容是功能代码（不是 stub/placeholder）
  2. 确认有其他文件 import 并使用它
  3. 如果是 service（如 copilotService），确认有 UI ���发入口
```

### 6.2 与 DESIGN v2.0 对齐的新增工作

以下是 DESIGN v2.0 定义的 P0 任务，尚未开始：

| 任务 | Design 参考 | 依赖 |
|------|-----------|------|
| **产物实例选择器（二级导航）** | DESIGN §3.2 | componentStore 重构为多实例 |
| **Workspace ↔ Collection 自动绑定** | DESIGN §5.2 | Prisma schema 新增 FK |
| **Asset → WindowView 路由** | DESIGN §3.5 | 二级选择器 + 类型映射 |

### 6.3 遗留清理

| 任务 | 说明 |
|------|------|
| 删除或确认 AgentChatPanel.tsx | Phase B 声称已移除但文件仍在，需确认是否还有 import |
| 统一 toolbar padding | 部分组件已改为 `px-3 py-2`，需检查剩余组件 |
| 移除 hardcoded min-h | LaTeX `min-h-[700px]`、Notes `min-h-[500px]` 需移除 |

---

## 7. 测试体系（Test Layer Architecture）

> **最后验证**: 2026-02-27 | **Plugin**: v0.5.0 (26 tools) | **Container Image**: v4.5

### 7.1 测试分层概念

测试体系分为 4 层，从单元到全链路逐层递进：

```
Layer 3 — Real Agent E2E          (端到端正确性)
    ↑ 真实 Agent + LLM → 真实 directive → 浏览器渲染
Layer 2 — Component / Directive   (UI 正确性)
    ↑ Mock Agent → 注入 directive → 断言 DOM 渲染
Layer 1 — API / Infrastructure    (协议正确性)
    ↑ 真实容器 API → Bridge / Health / Directive SSE
Unit   — Unit Tests               (逻辑正确性)
    ↑ Store/Hook/Service/API handler 的纯逻辑测试
```

**测试框架**: Unit = Vitest (jsdom) | Layer 1/2/3 = Playwright

**运行命令**:
```bash
npx vitest                           # Unit tests
npm run test:layer1                  # Layer 1 (timeout: 120s)
npm run test:layer2                  # Layer 2 (timeout: 60s)
npm run test:layer3                  # Layer 3 (timeout: 180s)
npm run test:e2e                     # All layers (Playwright)
```

### 7.2 概览表

| Layer | 位置 | 文件数 | 测试数 | 依赖 | 验证目标 |
|-------|------|--------|--------|------|---------|
| **Unit** | `tests/unit/` | 8 | ~50+ | 无外部依赖 (jsdom) | Store / Hook / API handler / Directive mapping |
| **L1** | `tests/layer1/` | 5 | 21 | 运行中的容器 | Bridge 协议、Health API、Directive SSE、Context API |
| **L2** | `tests/layer2/` | 7 | 32 | Dev server only (mock agent) | Directive 注入 → 组件渲染 → 内容验证 |
| **L3** | `tests/layer3/` | 2 | 6 | Dev server + 容器 + LLM | 真实 Agent 推理 → 完整 MVP 场景 |
| **合计** | | **22** | **59+** | | |

### 7.3 Unit Tests (Vitest)

**位置**: `tests/unit/` (8 files)
**配置**: `vitest.config.ts` → `include: ['tests/unit/**/*.{test,spec}.{ts,tsx}']`
**Setup**: `tests/helpers/setup-vitest.ts` (ResizeObserver, matchMedia mocks)

| 文件 | 覆盖范围 |
|------|---------|
| `directive-mapping.test.ts` | Directive type 映射和 schema 验证 |
| `stores/syncActions.directive.test.ts` | Zustand store directive action handlers |
| `components/AgentControlPanel.test.tsx` | Agent 控制面板组件 |
| `components/AgentStatusBadge.test.tsx` | Agent 状态徽章组件 |
| `hooks/useDirectiveStream.test.ts` | WebSocket directive stream hook |
| `lib/directive-queue.test.ts` | Directive queue 去重 |
| `api/agents.test.ts` | Agent API endpoint handlers |
| `api/workspace-context.test.ts` | Workspace context API handlers |

**Gap**: Plugin 代码 (`docker/plugin/prismer-workspace/`) 无单元测试。26 个 tool 的参数处理、directive 构建、错误路径均未单测覆盖。

### 7.4 Layer 1 — API & Infrastructure Integration (21 tests)

**位置**: `tests/layer1/` (5 files)
**依赖**: 运行中的容器 + Agent。无浏览器。
**原理**: 直接调用 REST API → 验证响应结构 → 收集 SSE directive 流。

| Spec 文件 | 测试数 | 验证目标 |
|-----------|--------|---------|
| `workspace-context.spec.ts` | 9 | Context API (结构化状态) + Container File Sync |
| `container-health.spec.ts` | 4 | Agent 健康、Gateway 连通、服务就绪 |
| `bridge-protocol.spec.ts` | 4 | Bridge 消息收发、状态检查、空消息拒绝 |
| `directive-delivery.spec.ts` | 3 | SSE directive 流、schema 验证、组件名合法性 |
| `data-tools.spec.ts` | 4 | data_list / data_load 工具调用 → UPDATE_DATA_GRID directive |

### 7.5 Layer 2 — Component & Directive Interaction (32 tests)

**位置**: `tests/layer2/` (7 files)
**依赖**: Dev server (:3000) + Desktop Chrome。**无需容器、无需 LLM**。
**原理**: `mockAgentReady()` 模拟 Agent 运行状态 → `injectDirective()` / `injectDirectiveSequence()` 注入 directive → 断言 DOM 渲染。

| Spec 文件 | 测试数 | 验证的 MVP 场景 |
|-----------|--------|----------------|
| `t0-identity.spec.ts` | 2 | Agent 身份消息渲染、发送者名称 |
| `t1-latex-survey.spec.ts` | 4 | SWITCH → UPDATE_LATEX → COMPILE_COMPLETE 序列 |
| `t2-jupyter-plot.spec.ts` | 4 | SWITCH → UPDATE_NOTEBOOK → UPDATE_GALLERY 序列 |
| `t3-notes-template.spec.ts` | 4 | SWITCH → UPDATE_NOTES 序列、模板内容验证 |
| `t4-pdf-reader.spec.ts` | 5 | load_document (arXiv/URL/upload)、navigate_to_page、自动切换 |
| `t5-workspace-context.spec.ts` | 3 | Bridge metadata、Context API、Container sync |
| `component-crud.spec.ts` | 5 | 8 组件类型循环切换、AG Grid / Code 数据注入、快速切换稳定性 |

**测试辅助模块** (`tests/helpers/`):
- `mock-agent.ts` — `mockAgentReady()`, `injectDirective()`, `forceAgentRunning()`
- `trace-collector.ts` — CustomEvent tracing + trace file 输出
- `playwright-utils.ts` — `waitForWorkspace()`, `waitForActiveComponent()`

**Fixture 数据** (`tests/fixtures/`):
- `directives/` — 预定义 directive payloads (switch, latex, jupyter, notes, code, data-grid, gallery)
- `agent-responses/` — 预定义 Agent 响应 (t0-identity, t1-latex, t2-jupyter, t3-notes)

### 7.6 Layer 3 — E2E MVP Scenarios (6 tests)

**位置**: `tests/layer3/` (2 files)
**依赖**: Dev server + Desktop Chrome + 运行中的容器 + LLM。
**原理**: 真实 Agent 推理 → 真实 tool 调用 → 真实 directive → 浏览器渲染验证。

| Spec 文件 | 测试数 | 验证场景 |
|-----------|--------|---------|
| `mvp-scenarios.spec.ts` | 4 | T0: 身份响应, T1: LaTeX 综述+编译, T2: 三角函数绘图, T3: 实验笔记模板 |
| `data-workflow.spec.ts` | 2 | data_load → UPDATE_DATA_GRID, data_query → 过滤数据 |

**Key Findings**:
- Agent 平均响应 8-22s（含 LLM 推理 + tool execution）
- WebSocket auth flow: `connect.challenge → token auth → hello-ok → chat.send → streaming → chat.final`
- Token-only auth 足够（device credentials optional for local mode）

### 7.7 Directive 管道对齐

```
Plugin (tools.ts)                    Frontend (syncActions.ts)
─────────────────                    ────────────────────────
sendDirective(SWITCH_COMPONENT)  ──→  setActiveComponent()        ✅ L2 验证
sendDirective(UPDATE_NOTES)      ──→  CustomEvent handler         ✅ L2 t3 验证
sendDirective(UPDATE_LATEX)      ──→  CustomEvent handler         ✅ L2 t1 验证
sendDirective(UPDATE_NOTEBOOK)   ──→  CustomEvent handler         ✅ L2 t2 验证
sendDirective(UPDATE_GALLERY)    ──→  CustomEvent handler         ✅ L2 t2 验证
sendDirective(UPDATE_CODE)       ──→  CustomEvent handler         ✅ L2 component-crud 验证
sendDirective(UPDATE_DATA_GRID)  ──→  CustomEvent handler         ✅ L2 component-crud 验证
sendDirective(PDF_LOAD)          ──→  updateComponentState()      ✅ L2 t4 验证
sendDirective(COMPILE_COMPLETE)  ──→  CustomEvent handler         ✅ L2 t1 验证
sendDirective(CELL_RESULT)       ──→  CustomEvent handler         ⚠️ 间接 (L2 t2)
```

### 7.8 Auto UI Directive 机制

- `tools.ts` 中基础 12 tools 有 10 个在内容操作时自动触发 `SWITCH_COMPONENT` directive
- Directives 通过 HTTP POST `${apiBaseUrl}/api/agents/${agentId}/directive` 发送
- Bridge POST 响应中 `directives: []` — directives 是 side-effect，不在 WebSocket 响应中返回
- 前端通过 SSE directive stream (`/api/agents/:id/directive/stream`) 接收

### 7.9 版本管理与测试

- 每个插件有 `version.ts` SSoT 文件
- `docker/compatibility.json` 定义兼容矩阵
- Agent 启动时 Step 7 自动校验版本，不匹配仅 warn（不阻断）
- Container gateway v1.1.0 有 `/api/v1/stats` 端点（per-service tracking）

### 7.10 测试覆盖 Gap

| 优先级 | Gap | 影响 | 建议 |
|--------|-----|------|------|
| **P0** | Plugin 0/26 单测覆盖 | 参数验证、错误路径无回归保障 | 为 tools.ts 添加 vitest 测试 |
| **P1** | v0.5.0 新增 12 扩展 tools 无 L1/L3 覆盖 | data_list, data_load, data_query, data_save, latex_project, latex_project_compile, get_paper_context, navigate_pdf, context_search, context_load, get_workspace_state, sync_files_to_workspace 均无容器集成测试 | 按使用频率逐步补充 |
| **P1** | Layer 3 仅 6 个场景 | 数据工作流覆盖少 | 补充 code_execute、latex_project E2E |
| **P2** | `send_ui_directive`, `arxiv_to_prompt` 无任何层覆盖 | 2 个 tool 完全无测试 | 根据使用频率排优先级 |

---

## 8. 变更历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-02-21 | 初版：6 Phase 设计 + 实施方案 |
| 1.1 | 2026-02-21 | 标记为 "All 6 phases COMPLETE" |
| 2.0 | 2026-02-24 | **重写**：基于代码验证修正状态（大量 "✅" 改为 "⚠️ Unverified"）；移除设计方案内容（迁移到 DESIGN.md v2.0）；重新定位为实施跟踪文档 |
| 2.1 | 2026-02-24 | 新增 §7 E2E 测试验证结果（4/4 scenarios passed）；Container→Bridge→Agent 全链路验证；Auto UI directive + gateway stats 架构分析 |
| 3.0 | 2026-02-26 | **§7 重写为三层测试体系**：Layer 0 (单测) / Layer 1 (容器集成) / Layer 2 (前端渲染)；12 tools × 3 layers 对齐矩阵；Directive 管道对齐分析；Plugin v0.3.0 版本更新；测试覆盖 Gap 分析 |
| 3.1 | 2026-02-27 | **§7 重写为四层测试体系**：Unit (tests/unit/, 8 files) / L1 (tests/layer1/, 5 files, 21 tests) / L2 (tests/layer2/, 7 files, 32 tests) / L3 (tests/layer3/, 2 files, 6 tests)；版本对齐：Plugin v0.4.0→v0.5.0 (26 tools)，Container Image v4.4→v4.5；Directive 管道对齐更新 |
