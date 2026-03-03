# Prismer 开源优化设计文档

> **文档类型：** 设计文档（Roadmap + Design + 实施蓝图）
> **创建日期：** 2026-03-02
> **License 策略：** Apache-2.0
> **关联文档：** `docs/plans/2026-03-02-prismer-evolution-blueprint.md`（产品进化蓝图）

---

## 目录

1. [现状与目标](#1-现状与目标)
2. [四阶段 Roadmap](#2-四阶段-roadmap)
3. [Gateway 兼容层详细设计](#3-gateway-兼容层详细设计)
4. [Hardcoded URL 清理策略](#4-hardcoded-url-清理策略)
5. [轻量版镜像规格](#5-轻量版镜像规格)
6. [测试策略](#6-测试策略)

---

## 1. 现状与目标

### 当前就绪度：5.5/10

| 维度 | 现状分 | 目标分 | 差距 |
|------|--------|--------|------|
| 云依赖清除 | 5/10 | 10/10 | 12 个 hardcoded URL 需清理 |
| 部署体验 | 4/10 | 9/10 | 从"数小时构建"到"30 分钟跑通" |
| 合规文档 | 2/10 | 9/10 | 缺 LICENSE、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY |
| Gateway 兼容层 | 1/10 | 8/10 | 架构设计完备（`OPENSOURCE_ARCHITECTURE.md`），代码 0% |
| 社区生态 | 2/10 | 7/10 | 缺贡献指南、本地开发文档、排障指南 |
| 测试基础 | 8/10 | 9/10 | 59+ 测试已有，需补开源场景 E2E |

### 已完成的基础工作（feat/opensource-backup-slim 分支）

| 已完成项 | 说明 |
|----------|------|
| Nacos 依赖移除 | `nacos-config.ts` 已替换为 env-only no-op shim |
| 静态 Agent 配置 | `staticAgentConfig.ts` 支持完整 env-based 容器绑定（`STATIC_AGENT_ENABLED=true`） |
| K8s 层移除 | orchestrator 精简为 health/logs/exec only |
| Cloud IM 路由移除 | agent CRUD/health routes 已移除 |
| 环境变量模板 | `.env.docker.example` 已存在 |
| 初版文档 | `docs/CONTRIB.md` + `docs/RUNBOOK.md` 已有 |
| 测试基础 | 四层测试架构（59+ tests: Unit + L1:21 + L2:32 + L3:6） |

### 核心目标

> **一个外部开发者 clone 仓库后，30 分钟内能完整跑通 workspace + Agent 对话 + LaTeX 编译 + Jupyter 执行。**

---

## 2. 四阶段 Roadmap

### Phase 0：扫雷（Day 1-3）

> **目标：** 消除所有阻止 `npm install` 和 `docker build` 成功的硬性阻塞

| 任务 | 具体内容 | 影响文件 |
|------|----------|----------|
| 清除私有 LLM 默认端点 | `34.60.178.0:3000/v1` → 默认 `https://api.openai.com/v1`，私有 IP 改为显式 opt-in | `docker/config/openclaw.json`, `docker-compose.openclaw.yml`, `docker-entrypoint-openclaw.sh`, `docker/README.md` |
| 清除 prismer.cloud 默认值 | 所有 `prismer.cloud` fallback → 本地 Gateway 地址或必须显式设置 | `docker/config/openclaw.json`, `docker-entrypoint-openclaw.sh`, `tools.ts`, `find-skills/index.ts` |
| CDN URL 环境变量化 | `cdn.prismer.ai` / `cdn.prismer.app` → 统一走 `process.env.CDN_DOMAIN`，无 CDN 时 graceful fallback | OCR routes (3), assets routes (2), thumbnail route, `s3.ts`, `paper.service.ts` |
| 默认模型标准化 | `us-kimi-k2.5` → 默认 `gpt-4o`，私有模型名需显式配置 | `docker/config/openclaw.json`, `docker-entrypoint-openclaw.sh` |
| dev 用户 email 可配置化 | `dev@prismer.app` → `process.env.DEV_USER_EMAIL \|\| 'dev@localhost'` | 8 个 API route 文件 |
| `@prismer/sdk` 条件依赖 | 从 `dependencies` 移到 `optionalDependencies`，IM 代码加 dynamic import + try/catch | `package.json`, `src/lib/services/im.service.ts` |

**验收：** `npm install` 无报错，`docker build` 使用公开 npm 源无报错，所有默认值指向公开可达服务。

---

### Phase 1：合规与镜像（Day 4-7）

> **目标：** 满足开源合规要求 + 发布公开容器镜像

| 任务 | 具体内容 |
|------|----------|
| 创建 LICENSE 文件 | 根目录 `LICENSE`，Apache-2.0 全文 |
| 创建根目录 CONTRIBUTING.md | 从 `docs/CONTRIB.md` 提炼核心流程，链接到详细文档 |
| 创建 CODE_OF_CONDUCT.md | Contributor Covenant v2.1 |
| 创建 SECURITY.md | 漏洞报告流程 |
| 创建 CHANGELOG.md | 从 git tag 历史生成初版 |
| 构建轻量版镜像 | 裁剪 `docker/base/Dockerfile`：仅保留 Ubuntu 24.04 + Node 22 + Python 3.12 + TeXLive (scheme-basic + 常用宏包) + Jupyter。去掉 R/Coq/Lean4/Z3。目标 < 4GB，构建 < 20 分钟 |
| 构建完整版镜像 | 保持现有 `docker/base/Dockerfile` 不变，发布为 full 版 |
| 发布到 GHCR | `ghcr.io/prismer/prismer-academic:v5.0-lite` + `ghcr.io/prismer/prismer-academic:v5.0-full` |
| 更新 docker-compose 默认镜像 | `BASE_IMAGE` 默认改为 `ghcr.io/prismer/prismer-academic:v5.0-lite` |

**验收：** `docker pull ghcr.io/prismer/prismer-academic:v5.0-lite` 成功，GitHub/GitLab 自动展示 License 徽标。

---

### Phase 2：Gateway 兼容层（Day 8-18）

> **目标：** 让前端在本地模式下无需任何 Cloud 服务即可完整运行

分三个 Tier 实现（详见第 3 节）：

| Tier | 覆盖路由 | 存储 | 工作量 |
|------|----------|------|--------|
| Tier 1：消息通信 | bridge 聊天收发、directive 队列、SSE 推送 | 内存队列 | 2-3 天 |
| Tier 2：状态持久化 | workspace context、messages、files、component-states | SQLite | 3-4 天 |
| Tier 3：资产管理 | snapshots、artifacts、timeline | SQLite + 本地文件 | 2-3 天 |

**验收：** 前端代码零修改，完整本地模式 workspace 对话 + LaTeX 编译 + Jupyter 执行 + 消息持久化。

---

### Phase 3：开发者体验与文档（Day 19-25）

> **目标：** 让首次贡献者体验顺畅，建立社区信任

| 任务 | 具体内容 |
|------|----------|
| Quick Start 重写 | 三条命令：`git clone` → `cp .env.example .env` → `docker compose up && npm run dev` |
| 本地开发指南 | `docs/LOCAL_DEV.md`：前端独立开发 / 容器开发 / Plugin 开发 三条路径 |
| 排障手册扩展 | `docs/RUNBOOK.md` 增加：build 失败、容器启动失败、Agent 无响应的排查 |
| 架构导览 | `docs/ARCHITECTURE_TOUR.md`：10 分钟可读完的架构速览 |
| E2E 双模式测试 | `tests/layer1/local-mode/` + `tests/layer3/local-mode-e2e.spec.ts` |
| CI 可 fork 化 | `.gitlab-ci.yml` 参数化所有私有地址，新增 `CI_MODE=opensource` |
| Issue 模板 | Bug Report / Feature Request / Question 三个模板 |

**验收：** 全新环境开发者按 Quick Start 操作，30 分钟内完成首次 Agent 对话 + LaTeX 编译。

---

### 时间线总览

```
Week 1              Week 2              Week 3              Week 4
├─ Phase 0 (3d) ──┤                    │                    │
│  扫雷: URL清理     ├─ Phase 1 (4d) ──┤                    │
│  默认值替换        │  合规: LICENSE     ├─ Phase 2 (10d) ─────────────┤
│  条件依赖          │  镜像: lite+full   │  Gateway Tier 1→2→3        │
│                    │  发布: GHCR        │                    ├─ Phase 3 (7d) ──┤
│                    │                    │                    │  文档: Quick Start │
│                    │                    │                    │  测试: E2E dual    │
│                    │                    │                    │  CI: forkable      │
```

---

## 3. Gateway 兼容层详细设计

### 架构对比

```
【当前：Cloud 模式】
Frontend → Cloud API (prismer.cloud) → 数据库 → Cloud IM → OpenClaw Container
                                                    ↑
                                        prismer-im plugin 连接 Cloud IM

【目标：Local 模式】
Frontend → Next.js API Routes → Gateway (container-gateway.mjs)
                                    │
                                    ├── 内存 directive queue + SSE 推送
                                    ├── SQLite 持久化 (messages, files, states)
                                    ├── WebSocket → OpenClaw Agent
                                    └── 反向代理 → 容器内服务 (LaTeX, Jupyter, arxiv)
```

**核心原则：** 前端代码零修改。Gateway 暴露的路由签名、请求/响应格式与 Cloud API 完全一致。差异全部封装在 Gateway 内部。

### Tier 1：消息通信（最小可用集）

实现后用户可在 workspace 中与 Agent 对话，Agent 可发送 directive 控制前端组件。

**需兼容的 3 条路由：**

| 路由 | Cloud 行为 | Gateway 行为 |
|------|-----------|-------------|
| `POST /api/v2/im/bridge/[workspaceId]` | 转发到 Cloud IM → OpenClaw | Gateway 直接 WebSocket 转发到 `ws://localhost:16888` + 轮询 directives |
| `POST /api/agents/[id]/directive` | 入队到 Cloud directive queue | 入队到 Gateway 内存 `Map<string, Directive[]>` |
| `GET /api/agents/[id]/directive/stream` | Cloud SSE 推送 | Gateway 内存 EventEmitter → SSE stream |

**核心代码结构：**

```javascript
// container-gateway.mjs 扩展

// 1. 内存 directive queue
class LocalDirectiveQueue {
  constructor() {
    this.queues = new Map();        // agentId → Directive[]
    this.listeners = new Map();     // agentId → Set<callback>
  }
  enqueue(agentId, directive) { /* ... */ }
  drain(agentId) { /* ... */ }
  subscribe(agentId, callback) { /* ... */ }
}

// 2. Bridge handler — 替代 Cloud IM
async function handleBridge(req, workspaceId) {
  // 读取 agent config（从 SQLite 或 env）
  // WebSocket 连接 OpenClaw gateway ws://localhost:16888
  // 发送用户消息
  // 等待 Agent 响应完成
  // 扫描 /workspace/.openclaw/directives/*.json
  // 入队到 LocalDirectiveQueue
  // 返回响应
}

// 3. SSE stream handler
function handleDirectiveStream(req, agentId) {
  // 设置 SSE headers
  // 订阅 LocalDirectiveQueue
  // 每次有新 directive 时 push event
}
```

**关键差异点：** 当前 `src/app/api/v2/im/bridge/[workspaceId]/route.ts` 的流程是查 DB 获取 `IMConversation` + `agentInstance` → WebSocket → 扫描 directives → 入队。Gateway 兼容层将步骤 1 的 DB 查询替换为 env config / SQLite 查询，步骤 2-4 逻辑复用。

### Tier 2：状态持久化

实现后 workspace 的消息历史、文件状态、组件状态跨 session 保持。

**SQLite Schema（嵌入 Gateway）：**

```sql
CREATE TABLE workspace_messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  role TEXT NOT NULL,           -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  metadata TEXT,                -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workspace_files (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT,
  content_hash TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, path)
);

CREATE TABLE component_states (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  component_type TEXT NOT NULL,
  state TEXT,                   -- JSON
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, component_type)
);

CREATE TABLE research_phases (
  workspace_id TEXT PRIMARY KEY,
  current_phase TEXT DEFAULT 'idea',
  phase_history TEXT            -- JSON
);
```

**需兼容的路由：**

| 路由 | 操作 |
|------|------|
| `GET /api/workspace/[id]/context` | SQLite → files + component_states + messages → WORKSPACE.md |
| `GET /api/workspace/[id]/messages` | SQLite 分页查询 messages |
| `GET/PUT /api/workspace/[id]/files/sync` | SQLite 批量 upsert files |
| `GET/PATCH /api/workspace/[id]/component-states` | SQLite 读写 component_states |
| `GET/POST /api/workspace/[id]/phase` | SQLite 读写 research_phases |

### Tier 3：资产管理

| 路由 | Gateway 行为 |
|------|-------------|
| `GET/POST /api/workspace/[id]/snapshots` | 从 workspace_files 生成快照 manifest → SQLite |
| `POST /api/agents/[id]/artifacts` | 保存到 `/workspace/.prismer/artifacts/`（替代 S3） |
| `GET /api/workspace/[id]/timeline` | SQLite 读取 timeline 事件 |

**本地文件存储替代 S3：**
- 编译产物（PDF）→ `/workspace/.prismer/artifacts/{timestamp}-{name}.pdf`
- 图表导出 → `/workspace/.prismer/artifacts/{timestamp}-{name}.svg`
- Gateway 提供 `GET /api/artifacts/{path}` 静态文件服务

### LOCAL_MODE 容器配置

| 配置项 | Cloud Mode | Local Mode |
|--------|-----------|------------|
| plugins | `prismer-im` + `prismer-workspace` | 仅 `prismer-workspace` |
| imServerUrl | `https://prismer.cloud` | 不设置（IM plugin 不加载） |
| apiBaseUrl | `https://prismer.cloud` | `http://localhost:3000`（Gateway） |
| LLM baseUrl | 私有 IP | `process.env.OPENAI_API_BASE_URL`（必填） |

`docker-entrypoint-openclaw.sh` 新增：

```bash
if [ "$LOCAL_MODE" = "true" ]; then
  # 不注入 prismer-im plugin
  # apiBaseUrl 指向 Gateway 自身
  # 要求 OPENAI_API_KEY 必须设置，否则启动时 warn
fi
```

---

## 4. Hardcoded URL 清理策略

### 完整清理清单

| # | Hardcoded 值 | 替换方案 | 文件数 | 风险 |
|---|-------------|---------|--------|------|
| 1 | `http://34.60.178.0:3000/v1` | 默认 `https://api.openai.com/v1`，`OPENAI_API_BASE_URL` 覆盖 | 4 | 低 |
| 2 | `us-kimi-k2.5` / `us-kimi-k2-turbo-preview` | 默认 `gpt-4o`，`AGENT_DEFAULT_MODEL` 覆盖 | 2 | 低 |
| 3 | `https://prismer.cloud` (IM server) | LOCAL_MODE 下不设置；Cloud 通过 `PRISMER_IM_SERVER_URL` 显式配置 | 3 | 中 |
| 4 | `https://prismer.cloud/api/skills` | 默认 `http://localhost:3000/api/skills`，env 覆盖 | 1 | 低 |
| 5 | `https://prismer.cloud` (tools base) | `process.env.PRISMER_BASE_URL \|\| 'http://localhost:3000'` | 1 | 低 |
| 6 | `cdn.prismer.ai` (OCR routes) | `process.env.CDN_DOMAIN`，无 CDN 时返回 404 + 日志 | 3 | 中 |
| 7 | `cdn.prismer.app` (S3/paper) | `process.env.CDN_DOMAIN`，删除 hardcode fallback | 2 | 低 |
| 8 | `dev@prismer.app` / `dev@prismer.ai` | `process.env.DEV_USER_EMAIL \|\| 'dev@localhost'` | 8 | 低 |
| 9 | `docker.prismer.dev` (registry) | 文档替换为 `ghcr.io/prismer/...` | 2 (docs) | 无 |
| 10 | `nacos.prismer.app` (CI) | `${CONFIG_CENTER_IP:-disabled}` + 开源跳过 | 1 | 低 |
| 11 | `prismer.dev` / `prismer.app` (CI deploy) | `${DEPLOY_HOST}` 参数化 | 1 | 低 |
| 12 | `parser.prismer.dev` (docs) | 标注为 optional Cloud feature | 1 (docs) | 无 |

### 清理原则

1. **环境变量名复用** — 已存在的 env var 直接复用（`CDN_DOMAIN`、`OPENAI_API_BASE_URL`），不新造
2. **默认值指向公开地址** — 所有默认值必须外部开发者可访问（OpenAI API、localhost）
3. **Cloud 值改为显式 opt-in** — 私有地址不再是 fallback，必须通过 env 显式配置
4. **降级而非崩溃** — 缺少可选服务时 graceful degradation，返回合理错误 + 日志提示

---

## 5. 轻量版镜像规格

### lite vs full 对比

| 组件 | lite | full | 裁剪理由 |
|------|------|------|----------|
| Ubuntu 24.04 | Yes | Yes | 基础 |
| Node.js 22 | Yes | Yes | Gateway + 前端运行时 |
| Python 3.12 + pip | Yes | Yes | Jupyter + 数据分析 |
| Jupyter Notebook | Yes | Yes | 核心功能 |
| TeXLive scheme-basic + 常用宏包 | Yes | Yes (scheme-full) | basic 够写大多数论文 |
| numpy/pandas/matplotlib/scipy | Yes | Yes | 数据分析核心库 |
| openclaw (via Dockerfile) | Yes | Yes | Agent 运行时 |
| prismer-workspace plugin | Yes | Yes | 26 个工具 |
| R + tidyverse | **No** | Yes | 社科/统计学，非核心 |
| Coq + Lean4 | **No** | Yes | 形式化验证，极小众 |
| Z3 Solver | **No** | Yes | 定理证明器，极小众 |
| prismer-im plugin | **No** | Yes | Local 模式不需要 |

**目标：** lite < 4GB，构建 < 20 分钟

### TeXLive 宏包策略（lite 版）

```
scheme-basic + collection-latexrecommended
+ booktabs + multirow + makecell           # 表格
+ algorithm2e + algorithmicx               # 算法伪代码
+ biblatex + biber                         # 引用管理
+ hyperref + cleveref + natbib             # 交叉引用
+ amsmath + amssymb + mathtools            # 数学
+ graphicx + subfig + caption + float      # 图表
+ geometry + fancyhdr + titlesec           # 排版
+ xcolor + listings + minted              # 代码高亮
+ IEEE / ACM / NeurIPS / CVPR 模板宏包    # 主流会议
```

### 发布地址

```
ghcr.io/prismer/prismer-academic:v5.0-lite    # < 4GB
ghcr.io/prismer/prismer-academic:v5.0-full    # ~15GB
ghcr.io/prismer/prismer-academic:latest       # → lite
```

---

## 6. 测试策略

### 新增 Local Mode 测试

```
tests/
├── layer1/
│   ├── ... (existing 21 tests)
│   └── local-mode/                          # 新增
│       ├── gateway-health.spec.ts           # Gateway 启动 + 健康检查
│       ├── gateway-bridge.spec.ts           # 本地 bridge 消息收发
│       ├── gateway-directive.spec.ts        # 本地 directive queue + SSE
│       ├── gateway-persistence.spec.ts      # SQLite 持久化
│       └── gateway-artifact.spec.ts         # 本地文件系统 artifact
├── layer3/
│   ├── ... (existing 6 tests)
│   └── local-mode-e2e.spec.ts              # 新增：完整本地模式 E2E
```

### local-mode-e2e 验收场景

```
1. docker compose up（lite 镜像）
2. npm run dev
3. 创建 Workspace → 自动绑定 Agent（STATIC_AGENT_ENABLED=true）
4. 发送消息 "Write a hello world LaTeX document"
5. 验证：Agent 返回消息 + UPDATE_LATEX_PROJECT directive 到达
6. 验证：LaTeX 编译成功 + PDF 预览
7. 发送消息 "Run a Python script that prints 1+1"
8. 验证：Jupyter 执行 + cell output 显示
9. 重启 Next.js dev server
10. 验证：消息历史从 SQLite 恢复
```

### CI 双模式

```yaml
test:local-mode:
  stage: test
  variables:
    LOCAL_MODE: "true"
    STATIC_AGENT_ENABLED: "true"
  script:
    - docker compose -f docker/docker-compose.lite.yml up -d
    - npm run dev &
    - npx playwright test tests/layer1/local-mode/ --trace on
    - npx playwright test tests/layer3/local-mode-e2e.spec.ts --trace on
```

---

## 附录：优先级汇总

| 优先级 | Phase | 核心交付 | 预计耗时 |
|--------|-------|----------|----------|
| **P0** | Phase 0 扫雷 | 12 个 hardcoded URL 清理 + `@prismer/sdk` 条件化 | 3 天 |
| **P1** | Phase 1 合规 | LICENSE + 合规文档 + lite/full 镜像发布 | 4 天 |
| **P2** | Phase 2 Gateway | 三层 Gateway 兼容层（通信 → 持久化 → 资产） | 10 天 |
| **P3** | Phase 3 体验 | Quick Start + 开发指南 + E2E 测试 + CI fork 化 | 7 天 |
| **总计** | | 外部开发者 30 分钟跑通完整 workspace | **~25 天** |
