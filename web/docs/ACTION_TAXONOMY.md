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

# WindowView Action Taxonomy — 完整信号体系

> **Version:** 1.0 | **Date:** 2026-02-26
> **Branch:** `feat/windowview-integration`
> **Status:** Plugin v0.5.0（26 tools），8 组件全覆盖（three-viewer 除外，已禁用）
>
> **Companion docs:**
> - `docs/WINDOWVIEW_CONVERGENCE.md` — 实施状态跟踪
> - `docs/WINDOWVIEW_STATUS.md` — 技术实现分析
> - `docs/WINDOWVIEW_DESIGN.md` — 产品设计规范

---

## 1. 文档定位

本文档从**需求侧自顶向下**定义 WindowView 8 组件的完整 UI Action / Directive / Content CRUD 体系。

- 每个组件有哪些动作（agent 触发 vs 用户触发 vs 自动）
- 哪些是**基础动作**（单 directive）、哪些是**复合动作**（多步级联）
- Plugin 需要暴露哪些信号、前端需要处理哪些信号
- 四层测试（Unit / L1 API / L2 渲染 / L3 E2E）的覆盖要求

---

## 2. 信号流架构

```
┌──────────────────────────────────────────────────────────────┐
│  Container Plugin (prismer-workspace v0.5.0, 26 tools)       │
│  tools.ts → sendUIDirective() → POST /api/agents/:id/directive│
└───────────────────────────┬──────────────────────────────────┘
                            │ SSE Stream
┌───────────────────────────▼──────────────────────────────────┐
│  useDirectiveStream.ts                                        │
│  mapPluginDirective(): UPPERCASE → lowercase UIDirective      │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  syncActions.ts → executeDirective()                          │
│  switch(type):                                                │
│    ├→ componentStore.updateComponentState()  [持久化]          │
│    └→ window.dispatchEvent(CustomEvent)      [运行时更新]      │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  Component Listeners                                          │
│  window.addEventListener('agent:directive:UPDATE_LATEX', ...)  │
│  → 更新编辑器内部状态                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 组件信号覆盖矩阵

| # | 组件 | Plugin Tools | Plugin → 前端 Directives | CustomEvent 监听 | 状态 |
|---|------|-------------|--------------------------|-----------------|------|
| 1 | **latex-editor** | `update_latex`, `latex_compile` | UPDATE_LATEX, LATEX_COMPILE_COMPLETE, COMPILE_LATEX | `UPDATE_LATEX`, `COMPILE_LATEX` | ✅ 完整 |
| 2 | **ai-editor** | `update_notes` | UPDATE_NOTES | `UPDATE_NOTES` | ✅ 完整 |
| 3 | **jupyter-notebook** | `jupyter_execute`, `update_notebook`, `jupyter_notebook` | UPDATE_NOTEBOOK, JUPYTER_CELL_RESULT, JUPYTER_ADD_CELL | `UPDATE_NOTEBOOK`, `EXECUTE_CELL` | ✅ 完整 |
| 4 | **bento-gallery** | `update_gallery` | UPDATE_GALLERY | `UPDATE_GALLERY` | ✅ 完整 |
| 5 | **pdf-reader** | `load_pdf` | PDF_LOAD_DOCUMENT | `SEND_PDF_CHAT`, `PDF_CHAT_RESPONSE` | ✅ 完整 |
| 6 | **code-playground** | `update_code` | UPDATE_CODE | `UPDATE_CODE`, `TERMINAL_OUTPUT` | ✅ v0.4.0 新增 |
| 7 | **ag-grid** | `update_data_grid` | UPDATE_DATA_GRID | `UPDATE_DATA_GRID` | ✅ v0.4.0 新增 |
| 8 | **three-viewer** | — | — | — | ⏭️ 已禁用，跳过 |

**辅助工具**（不绑定特定组件）：

| Tool | 类型 | 说明 |
|------|------|------|
| `switch_component` | UI 控制 | 切换 activeComponent，不触发 CustomEvent |
| `send_ui_directive` | 通用透传 | 发送任意 directive type + payload |
| `arxiv_to_prompt` | API-only | 下载 arXiv 论文转 LLM 可读格式，无 UI 副作用 |
| `save_artifact` | API-only | 保存产物到 workspace collection，无 UI directive |

---

## 4. 动作分类

### 4.1 基础动作（单 Directive）

| 动作 | Plugin Type | Frontend Type | Target | 副作用 |
|------|------------|--------------|--------|--------|
| 切换组件 | `SWITCH_COMPONENT` | `switch_component` | any | `componentStore.setActiveComponent()` |
| 加载 PDF | `PDF_LOAD_DOCUMENT` | `load_document` | pdf-reader | `componentStore.updateComponentState()` |
| 显示通知 | `NOTIFICATION` | `show_notification` | — | `console.log`（暂无 UI toast） |

### 4.2 内容更新动作（Directive + Store + CustomEvent）

| 动作 | Plugin Type | Frontend Type | Target | CustomEvent | Store 更新 |
|------|------------|--------------|--------|------------|-----------|
| 更新 LaTeX | `UPDATE_LATEX` | `update_content` | latex-editor | `agent:directive:UPDATE_LATEX` | content, activeFile |
| 更新笔记 | `UPDATE_NOTES` | `update_content` | ai-editor | `agent:directive:UPDATE_NOTES` | content |
| 更新 Notebook | `UPDATE_NOTEBOOK` | `update_content` | jupyter-notebook | `agent:directive:UPDATE_NOTEBOOK` | cells |
| 更新 Gallery | `UPDATE_GALLERY` | `update_gallery` | bento-gallery | `agent:directive:UPDATE_GALLERY` | images |
| 更新代码 | `UPDATE_CODE` | `update_content` | code-playground | `agent:directive:UPDATE_CODE` | files, selectedFile |
| 更新数据表 | `UPDATE_DATA_GRID` | `update_data_grid` | ag-grid | `agent:directive:UPDATE_DATA_GRID` | rowCount |

### 4.3 执行结果动作（API 调用 + 结果 Directive）

| 动作 | 触发 Tool | API 调用 | 结果 Directive | CustomEvent |
|------|----------|---------|---------------|------------|
| 编译 LaTeX | `latex_compile` | POST /latex/compile | `LATEX_COMPILE_COMPLETE` | `agent:directive:COMPILE_LATEX` |
| 执行 Jupyter | `jupyter_execute` | POST /jupyter/api/execute | `JUPYTER_CELL_RESULT` | `agent:directive:UPDATE_NOTEBOOK` |

### 4.4 复合动作（多 Directive 序列）

| 复合动作 | 信号链 | 涉及组件 |
|---------|--------|---------|
| **写 LaTeX 文件** | `SWITCH_COMPONENT(latex)` → `UPDATE_LATEX(file, content)` → store sync(500ms) → DB persist(3s) | latex-editor |
| **编译 LaTeX** | `SWITCH_COMPONENT(latex)` → API compile → `LATEX_COMPILE_COMPLETE(pdfUrl)` → store(compiledPdfUrl) → `COMPILE_LATEX` event → PDF 预览 | latex-editor |
| **写+编译 LaTeX** | UPDATE_LATEX → LATEX_COMPILE_COMPLETE（两步串联） | latex-editor |
| **执行 Jupyter** | `SWITCH_COMPONENT(jupyter)` → API execute → `JUPYTER_CELL_RESULT(code, outputs)` → store(cells) → `UPDATE_NOTEBOOK` event | jupyter-notebook |
| **数据分析流** | `jupyter_execute` → `update_gallery` → `save_artifact` | jupyter, gallery |
| **论文阅读+笔记** | `load_pdf` → `update_notes` | pdf-reader, ai-editor |
| **文献综述** | `arxiv_to_prompt` → `update_notes` → `update_latex` | ai-editor, latex-editor |

---

## 5. 每组件详细 Action 清单

### 5.1 latex-editor

**Agent 可触发的动作：**
| 动作 | Tool | Directive Chain | 备注 |
|------|------|----------------|------|
| 更新源码 | `update_latex` | SWITCH → UPDATE_LATEX | 不编译 |
| 编译为 PDF | `latex_compile` | SWITCH → API → LATEX_COMPILE_COMPLETE | 自动显示结果 |
| 切换到编辑器 | `switch_component` | SWITCH_COMPONENT | — |

**用户可触发的动作：**
- 编辑文件内容（CodeMirror onChange → useContentSync 500ms）
- 添加/删除/重命名文件
- 手动编译（工具栏按钮 → POST /api/workspace/:id/latex-compile）
- 加载模板（TemplateManager）
- 下载 PDF

**自动副作用：**
- 内容 → componentStore sync（500ms debounce）
- componentStore → DB persist（3s debounce via componentStateBridge）
- componentEventBus.emit: `ready`, `contentLoaded`, `actionComplete`/`actionFailed`
- componentEventForwarder → Bridge API（通知 agent）

### 5.2 ai-editor (Notes)

**Agent 可触发的动作：**
| 动作 | Tool | Directive Chain |
|------|------|----------------|
| 更新内容 | `update_notes` | SWITCH → UPDATE_NOTES |

**用户可触发的动作：**
- 编辑 HTML 内容（ProseMirror onChange → useContentSync 1000ms）
- AI 续写/改写/翻译/总结（AiEditor slash command / bubble menu）
- 打开 Asset Browser（Cmd+O）
- 接收跨组件内容（pdf-reader → notesInsert bus event）

**自动副作用：**
- 内容 → componentStore sync（1000ms debounce）
- componentStore → DB persist（3s debounce）
- Notes Auto-Save → workspace collection（5s periodic）

### 5.3 jupyter-notebook

**Agent 可触发的动作：**
| 动作 | Tool | Directive Chain |
|------|------|----------------|
| 执行代码 | `jupyter_execute` | SWITCH → API execute → JUPYTER_CELL_RESULT |
| 添加/更新 cells | `update_notebook` | SWITCH → UPDATE_NOTEBOOK |
| 管理 notebook 文件 | `jupyter_notebook` | API CRUD（无 UI directive） |

**用户可触发的动作：**
- 添加代码/markdown cell
- 执行单个/全部 cells
- 中断/重启 kernel
- Cell AI 辅助操作
- 打开 Asset Browser

**自动副作用：**
- kernelStatus → componentStore sync（2000ms debounce）
- componentEventBus.emit: `ready`, `contentLoaded`, `actionComplete`/`actionFailed`

### 5.4 pdf-reader

**Agent 可触发的动作：**
| 动作 | Tool | Directive Chain |
|------|------|----------------|
| 加载文档 | `load_pdf` | SWITCH → PDF_LOAD_DOCUMENT |

**用户可触发的动作：**
- 翻页、缩放、搜索
- AI 论文问答（AskPaperChat）
- 发送到笔记（componentEventBus → ai-editor:notesInsert）
- 切换阅读模式（单页/双页）

### 5.5 bento-gallery

**Agent 可触发的动作：**
| 动作 | Tool | Directive Chain |
|------|------|----------------|
| 添加图片 | `update_gallery` | SWITCH → UPDATE_GALLERY |

**用户可触发的动作：**
- 手动添加图片
- 删除图片
- 切换图片包
- Lightbox 查看

### 5.6 code-playground（v0.4.0 新增管道）

**Agent 可触发的动作：**
| 动作 | Tool | Directive Chain |
|------|------|----------------|
| 推送代码 | `update_code` | SWITCH → UPDATE_CODE |

**用户可触发的动作：**
- 编辑代码（CodeMirror）
- 执行代码（WebContainer / script terminal）
- 切换模板（React / Python / etc.）
- 文件管理

**注意**：代码执行在浏览器 WebContainer 内，agent 无法直接触发执行。

### 5.7 ag-grid（v0.4.0 新增管道）

**Agent 可触发的动作：**
| 动作 | Tool | Directive Chain |
|------|------|----------------|
| 推送数据 | `update_data_grid` | SWITCH → UPDATE_DATA_GRID |

**用户可触发的动作：**
- 内联编辑 cell
- 添加/删除行
- 排序、筛选
- 导出 CSV
- 打开 Asset Browser

### 5.8 three-viewer（已禁用）

无 agent 管道。纯本地交互组件。MVP 后评估。

---

## 6. 四层测试覆盖要求

### 6.1 Unit — 单元测试（Vitest, `tests/unit/`）

| 测试文件 | 覆盖范围 | 目标 |
|---------|---------|------|
| `directive-mapping.test.ts` | Directive type 映射 + schema 验证 | 全部 Plugin UPPERCASE → lowercase 映射 |
| `stores/syncActions.directive.test.ts` | `executeDirective()` 全部 handler | directive type 的 store 更新 + CustomEvent 派发 |
| `hooks/useDirectiveStream.test.ts` | WebSocket directive stream | 连接、重连、消息处理 |
| `lib/directive-queue.test.ts` | Directive 去重队列 | 重复过滤逻辑 |
| `api/agents.test.ts` | Agent API handlers | CRUD 端点 |
| `api/workspace-context.test.ts` | Workspace context API | 结构化状态返回 |

### 6.2 L1 — API / 基础设施测试（Playwright, `tests/layer1/`）

| 测试文件 | 覆盖范围 | 目标 |
|---------|---------|------|
| `container-health.spec.ts` | 容器健康 + Gateway 服务就绪 | 启动后全服务可达 |
| `bridge-protocol.spec.ts` | Bridge 消息收发 + 状态检查 | 协议正确性 |
| `directive-delivery.spec.ts` | SSE directive 流 + schema 验证 | directive 类型和结构正确 |
| `data-tools.spec.ts` | data_list / data_load 工具 | UPDATE_DATA_GRID directive |
| `workspace-context.spec.ts` | Context API + File Sync | 结构化状态 + 文件同步 |

### 6.3 L2 — 前端渲染测试（Playwright + Mock Agent, `tests/layer2/`）

| 测试文件 | 覆盖范围 | 目标 |
|---------|---------|------|
| `t0-identity.spec.ts` | Agent 身份消息渲染 | 聊天面板 markdown 渲染 |
| `t1-latex-survey.spec.ts` | LaTeX 序列 (SWITCH → UPDATE → COMPILE) | CodeMirror 内容验证 |
| `t2-jupyter-plot.spec.ts` | Jupyter 序列 + Gallery | notebook cell + 图片渲染 |
| `t3-notes-template.spec.ts` | Notes 序列 | ProseMirror 模板内容 |
| `t4-pdf-reader.spec.ts` | PDF reader directives | arXiv/URL/upload 加载 + 页面导航 |
| `t5-workspace-context.spec.ts` | Bridge metadata + context sync | 上下文传递验证 |
| `component-crud.spec.ts` | 8 组件循环切换 + 数据注入 | 快速切换稳定性 |

### 6.4 L3 — 真实 Agent E2E（Playwright + 容器 + LLM, `tests/layer3/`）

| 测试文件 | 覆盖范围 | 目标 |
|---------|---------|------|
| `mvp-scenarios.spec.ts` | T0-T3 MVP 场景 | 真实 Agent 推理 → directive → 渲染 |
| `data-workflow.spec.ts` | 数据加载 + 查询 | data_load → grid 更新 |

---

## 7. Plugin v0.5.0 Tool 清单（26 tools）

### 基础 Tools（v0.1.0 ~ v0.4.0, 14 tools）

| # | Tool Name | 组件 | Directive(s) | 类别 |
|---|-----------|------|-------------|------|
| 1 | `latex_compile` | latex-editor | SWITCH + LATEX_COMPILE_COMPLETE | 执行结果 |
| 2 | `update_latex` | latex-editor | SWITCH + UPDATE_LATEX | 内容更新 |
| 3 | `jupyter_execute` | jupyter-notebook | SWITCH + JUPYTER_CELL_RESULT | 执行结果 |
| 4 | `jupyter_notebook` | jupyter-notebook | API-only | CRUD |
| 5 | `update_notebook` | jupyter-notebook | SWITCH + UPDATE_NOTEBOOK | 内容更新 |
| 6 | `load_pdf` | pdf-reader | SWITCH + PDF_LOAD_DOCUMENT | 基础动作 |
| 7 | `update_notes` | ai-editor | SWITCH + UPDATE_NOTES | 内容更新 |
| 8 | `update_gallery` | bento-gallery | SWITCH + UPDATE_GALLERY | 内容更新 |
| 9 | `update_code` | code-playground | SWITCH + UPDATE_CODE | 内容更新 |
| 10 | `update_data_grid` | ag-grid | SWITCH + UPDATE_DATA_GRID | 内容更新 |
| 11 | `switch_component` | any | SWITCH_COMPONENT | UI 控制 |
| 12 | `send_ui_directive` | any | 任意 type + payload | 通用透传 |
| 13 | `arxiv_to_prompt` | — | API-only | 数据获取 |
| 14 | `save_artifact` | — | API-only | 产物保存 |

### 扩展 Tools（v0.5.0 新增, 12 tools）

| # | Tool Name | 组件 | Directive(s) | 类别 |
|---|-----------|------|-------------|------|
| 15 | `code_execute` | code-playground | SWITCH + CODE_RESULT | 执行结果 |
| 16 | `data_list` | ag-grid | — | 数据查询 |
| 17 | `data_load` | ag-grid | SWITCH + UPDATE_DATA_GRID | 数据加载 |
| 18 | `data_query` | ag-grid | UPDATE_DATA_GRID | 数据过滤 |
| 19 | `data_save` | — | API-only | 数据保存 |
| 20 | `latex_project` | latex-editor | — | LaTeX 项目管理 |
| 21 | `latex_project_compile` | latex-editor | SWITCH + COMPILE_COMPLETE | LaTeX 项目编译 |
| 22 | `get_paper_context` | — | API-only | 论文上下文获取 |
| 23 | `navigate_pdf` | pdf-reader | PDF_NAVIGATE | PDF 页面导航 |
| 24 | `context_search` | — | API-only | 上下文搜索 |
| 25 | `context_load` | — | API-only | 上下文加载 |
| 26 | `get_workspace_state` | — | API-only | 工作区状态查询 |
| 27* | `sync_files_to_workspace` | — | API-only | 容器文件同步 |

> *注：tools.ts 实际注册 26 个 tool（`code_execute` 和 `update_code` 存在功能重叠）

---

## 8. 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-02-26 | 初始版本：8 组件动作体系、信号矩阵、三层测试要求、Plugin v0.4.0 工具清单 |
| 1.1 | 2026-02-27 | 版本对齐：Plugin v0.5.0 (26 tools)，四层测试体系 (Unit/L1/L2/L3)，新增 12 扩展 tools 清单 |
