# Prismer Library Docker Integration Plan

> Version: 5.0.0
> Date: 2026-02-27
> Status: **Phase 1-3 完成** | Plugin v0.5.0 (26 tools) | Gateway v1.1.0 | 四层测试 59+ tests

---

## Current Architecture (v5.0)

### Container Gateway Architecture

All services run inside a single container. The unified `container-gateway.mjs` (pure Node.js, zero dependencies) listens on container port 3000 and reverse-proxies requests to internal services by route prefix. Host port is fixed at **16888** (dev/standalone/k8s 统一端口).

```
Host (:16888)                     Container (:3000)
  │                                ┌──────────────────────────┐
  │  /api/v1/latex/*               │  container-gateway.mjs   │
  ├───────────────────────────────→│    → 127.0.0.1:8080      │
  │  /api/v1/prover/*              │    → 127.0.0.1:8081      │
  ├───────────────────────────────→│    → 127.0.0.1:8888      │
  │  /api/v1/jupyter/*             │    → 127.0.0.1:18900     │
  ├───────────────────────────────→│    → 127.0.0.1:8082      │
  │  /api/v1/gateway/*             │                          │
  │  /api/v1/arxiv/*               │                          │
  │  /api/v1/health                │  aggregated health check │
  └───────────────────────────────→│                          │
                                   └──────────────────────────┘
```

### Quick Start

**方式一：已有 base 镜像（从 registry 拉取或内网）**

```bash
cd docker/
docker compose -f docker-compose.openclaw.yml up --build -d
# 或本地开发（宿主机跑 Next.js :3000）
docker compose -f docker-compose.dev.yml up -d --build
```

**方式二：无法拉取 base 镜像时，先本地构建 base**

```bash
cd docker/
# 先构建学术基础镜像（约需数分钟，仅首次，~10-12GB）
docker build -t prismer-academic:v5.0 ./base
# 再构建并启动 OpenClaw
docker compose -f docker-compose.openclaw.yml up --build -d
```

或使用脚本（会自动检测并构建 base）：

```bash
cd docker/
chmod +x build-with-local-base.sh
./build-with-local-base.sh          # 构建 base + openclaw
./build-with-local-base.sh dev      # 构建 base + dev compose
./build-with-local-base.sh dev -d   # dev 且后台
```

**健康检查（两种方式均为端口 16888）**

```bash
curl http://localhost:16888/api/v1/health
```

### API Reference

| Route | Target | Description |
|-------|--------|-------------|
| `GET /` | — | Gateway info (version, routes) |
| `GET /api/v1/health` | all services | Aggregated health (status + latency per service) |
| `GET /api/v1/health/:service` | single service | Individual service probe |
| `ANY /api/v1/latex/*` | 127.0.0.1:8080 | LaTeX compile server |
| `ANY /api/v1/prover/*` | 127.0.0.1:8081 | Theorem prover (Coq + Z3) |
| `ANY /api/v1/jupyter/*` | 127.0.0.1:8888 | Jupyter server (token auto-injected) |
| `ANY /api/v1/gateway/*` | 127.0.0.1:18900 | OpenClaw Gateway (WebSocket supported) |
| `ANY /api/v1/arxiv/*` | 127.0.0.1:8082 | arXiv paper conversion |

### arXiv Paper Service

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/arxiv/convert` | Convert paper to flattened LaTeX |
| `POST /api/v1/arxiv/sections` | List paper section names |
| `POST /api/v1/arxiv/abstract` | Extract abstract |
| `GET /api/v1/arxiv/health` | Health check |

Request example:

```json
POST /api/v1/arxiv/convert
{ "arxiv_id": "2303.08774", "remove_comments": true }

POST /api/v1/arxiv/sections
{ "arxiv_id": "2303.08774" }
→ { "arxiv_id": "2303.08774", "sections": ["Introduction", "Capabilities", ...] }
```

### Test Results

**Functional Tests** (29 tests, 100% expected behavior):

| Category | Tests | All Pass |
|----------|-------|----------|
| Basic Connectivity | 8 | Yes (Jupyter shows "degraded" due to auth — expected) |
| Service Proxying | 5 | Yes |
| LaTeX Compilation | 5 | Yes (empty content returns 400 — expected) |
| arXiv Paper Service | 6 | Yes |
| Prover Service | 2 | Yes |
| Error Handling & CORS | 3 | Yes |

**Performance Benchmarks** (10 iterations each, host port 16888, ms):

| Endpoint | Min | Avg | P50 | P95 | Max |
|----------|-----|-----|-----|-----|-----|
| GET / | 1.3 | 2.4 | 1.9 | 5.2 | 5.2 |
| GET /api/v1/health | 2.2 | 4.3 | 2.6 | 19.1 | 19.1 |
| GET /api/v1/health/latex | 1.2 | 2.1 | 2.2 | 2.7 | 2.7 |
| GET /api/v1/prover/status | 14.5 | 16.2 | 15.2 | 22.7 | 22.7 |
| GET /api/v1/arxiv/health | 1.1 | 1.4 | 1.4 | 1.7 | 1.7 |
| POST latex/compile (simple) | 249.0 | 256.1 | 257.1 | 268.6 | 268.6 |
| POST arxiv/abstract (cached) | 7.1 | 7.5 | 7.6 | 7.8 | 7.8 |
| POST arxiv/sections (cached) | 2.0 | 2.3 | 2.3 | 2.5 | 2.5 |
| POST prover/coq/check | 27.3 | 29.1 | 29.3 | 31.5 | 31.5 |
| POST prover/z3/solve | 1.9 | 2.2 | 2.3 | 2.9 | 2.9 |

**Concurrency:**

- 20 parallel health checks: 306 req/s, avg 14.9ms
- 10 parallel LaTeX compiles: 3.8 req/s, avg 1416ms (CPU-bound pdflatex)

### File Structure

```
docker/
├── Dockerfile.openclaw          # v5.0, builds on prismer-academic:v5.0
├── compatibility.json           # Version compatibility matrix
├── versions-manifest.json       # Baked into image as /opt/prismer/versions.json
├── VERSIONS.md                  # Human-readable version tracking
├── docker-compose.dev.yml       # Dev: 16888→3000
├── docker-compose.openclaw.yml  # Standalone: 16888→3000
├── gateway/
│   ├── container-gateway.mjs    # Unified reverse proxy (367 lines, zero deps)
│   ├── version.mjs              # Gateway version SSoT (1.1.0)
│   └── README.md                # Gateway documentation
├── scripts/
│   ├── arxiv-server.py          # arXiv paper conversion HTTP server
│   ├── patch-entrypoint.py      # Patches base entrypoint for gateway
│   └── prismer-tools/           # CLI tools (prismer-latex, prismer-jupyter, etc.)
├── config/
│   ├── openclaw.json            # OpenClaw agent configuration
│   └── workspace/
│       ├── TOOLS.md             # Tool documentation for agent (26 tools)
│       ├── SOUL.md              # Agent persona and boundaries
│       ├── AGENTS.md            # Agent operational instructions
│       └── skills/              # Agent skills (prismer-workspace)
├── plugin/
│   ├── prismer-im/              # IM channel plugin (v0.2.0, @prismer/sdk v1.7)
│   └── prismer-workspace/       # Workspace skill plugin (v0.5.0, 26 tools)
└── templates/                   # Agent persona templates (6 templates)
    ├── base/                    # Shared: SOUL.md, TOOLS.md, HEARTBEAT.md
    ├── academic-researcher/     # 通用学术研究员
    ├── cs-researcher/           # 计算机科学研究员
    ├── data-scientist/          # 数据科学家
    ├── finance-researcher/      # 金融研究员
    ├── mathematician/           # 数学家
    └── paper-reviewer/          # 论文审稿人
```

### Port Convention

| Context | Port | Description |
|---------|------|-------------|
| Host (fixed) | **16888** | 统一宿主机端口，dev/standalone/k8s 一致 |
| Container internal | 3000 | `container-gateway.mjs` 监听 |
| LaTeX | 8080 | 容器内部 |
| Prover | 8081 | 容器内部 |
| Jupyter | 8888 | 容器内部 |
| OpenClaw Gateway | 18900 | 容器内部 |
| arXiv | 8082 | 容器内部 |

### Notes

- **Fixed port 16888**: Both dev and standalone modes map `16888:3000`. This port is reserved for agent containers across all environments (local Docker, k8s), avoiding conflicts with Next.js (:3000) or other services.
- **Jupyter health "degraded"**: Jupyter health check returns 401 (requires token). This is expected — the gateway auto-injects the Jupyter token for actual API requests.
- **Gateway port conflict**: The entrypoint uses `GATEWAY_PORT=18900` for OpenClaw. Container Gateway overrides with `GATEWAY_PORT=$FRONTEND_PORT` (3000).
- **Python venv**: Base image creates venv at runtime. `arxiv-to-prompt` installed system-wide via `pip install --break-system-packages`. Server uses `/usr/bin/python3`.

---

## Changelog

### v0.5.0 (2026-02-27) ✅ Phase 1-3 + 测试体系 + 版本管理

- **Container Image v5.0**: 清理旧镜像 (v4.2-v4.5)，修复 configSchema 验证错误，重建镜像
- **prismer-workspace v0.5.0**: registerTool() API 重写，26 tools (原 12 + 14 新增)
- **container-gateway v1.1.0**: `/api/v1/stats` 端点，版本报告 (`/`)，token tracking
- **IM Bridge API**: `/api/v2/im/bridge/[workspaceId]` — chat + status + history + diagnostics
- **Workspace Context API**: `/api/workspace/[id]/context` — 结构化工作区状态
- **Container File Sync**: `/api/workspace/[id]/files/sync-to-container`
- **版本管理体系**: SSoT chain (`version.ts` → `compatibility.json` → `versions-manifest.json`)
- **四层测试**: Unit (8 files) + L1 (5 files, 21 tests) + L2 (7 files, 32 tests) + L3 (2 files, 6 tests)
- **6 Agent 模板**: academic-researcher, cs-researcher, data-scientist, finance-researcher, mathematician, paper-reviewer
- **configSchema fix**: `openclaw.plugin.json` 添加 `workspaceId` 字段（修复容器启动崩溃）

### v0.4.0 (2026-02-09) ✅ Phase 1 实现完成
- **容器编排**: DockerOrchestrator 实现完成，支持创建/启动/停止/删除容器
- **Gateway 代理**: TCP Proxy 方案实现，解决 OpenClaw Gateway localhost 绑定问题
- **LLM Gateway**: 支持通过 Nacos 配置自定义 Model Provider (prismer-gateway)
- **Agent APIs**: 完整的 CRUD + start/stop/health/logs API
- **配置热更新**: 容器重启时自动重新部署最新配置
- **学术工具验证**: LaTeX、Python/NumPy、arXiv 搜索、OpenClaw Agent 通信全部通过

### v0.3.0 (2026-02-08)
- **架构对齐**: 与 OpenClaw 官方规范对齐
- **模块合并**: prismer-control 合并到 prismer-im Channel Plugin
- **端口统一**: Gateway 端口统一为 18789 (官方标准)
- **协议规范**: 添加 OpenClaw Gateway Protocol 说明
- **简化模块**: 从四模块简化为三模块 (prismer-im, Next.js Proxy, prismer-workspace Skill)

### v0.2.0 (2026-02-07)
- **UIDirective 规范**: 基于组件实际实现的深度分析，定义完整 UIDirective 规范
- **新增**: 8 个组件的功能分析 (CodePlayground, JupyterNotebook, LatexEditor, PDFReader, AGGrid, AiEditor, Timeline, WindowViewer)
- **新增**: 60+ UIDirective 类型定义
- **新增**: 完整的 Payload 类型定义
- **新增**: Directive → Event 映射表
- **新增**: Component → Agent 事件回报规范
- **新增**: 双向通信流程图

### v0.1.0 (2026-02-07)
- 初始架构设计
- prismer-im (Chat) 接口定义
- prismer-gateway (API Proxy) 方案选择
- prismer-skills (Skill Extensions) 示例

---

## Quick Start (Phase 1 已实现)

### 前置要求

- Docker Desktop 运行中
- Nacos 配置中心可访问 (nacos.prismer.app)
- 配置以下环境变量 (通过 Nacos 或 .env):

```bash
# LLM Gateway 配置
OPENAI_API_KEY=sk-xxx
OPENAI_API_BASE_URL=https://api.openai.com/v1
AGENT_DEFAULT_MODEL=us-kimi-k2.5
```

### Agent API 使用

```bash
# 1. 创建 Agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name": "Research Assistant", "workspaceId": "xxx"}'

# 2. 启动 Agent (创建/启动容器)
curl -X POST http://localhost:3000/api/agents/{id}/start

# 3. 检查健康状态
curl http://localhost:3000/api/agents/{id}/health

# 4. 停止 Agent
curl -X POST http://localhost:3000/api/agents/{id}/stop
```

### 容器内配置

启动时自动部署 OpenClaw 配置到容器:

```json
{
  "models": {
    "providers": {
      "prismer-gateway": {
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "sk-xxx",
        "api": "openai-completions",
        "models": [
          {"id": "us-kimi-k2.5", "name": "us-kimi-k2.5"},
          {"id": "us-kimi-k2-turbo-preview", "name": "Kimi K2 Turbo"},
          {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4"}
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {"primary": "prismer-gateway/us-kimi-k2.5"}
    }
  }
}
```

### Gateway 代理方案

OpenClaw Gateway 默认绑定到 `localhost:18900`，无法从外部访问。解决方案:

```
容器内启动 TCP Proxy:
  0.0.0.0:18901 → localhost:18900

Gateway URL: ws://<container-ip>:18901
```

### 已验证功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 容器创建/启动/停止 | ✅ | DockerOrchestrator |
| Gateway 连接 | ✅ | TCP Proxy + WebSocket |
| LLM Gateway 配置 | ✅ | Nacos → 容器配置 |
| LaTeX 编译 | ✅ | 容器内 :8080 |
| Python/NumPy | ✅ | 容器内 Python 3.x |
| arXiv 搜索 | ✅ | 外部 API |
| OpenClaw Agent 通信 | ✅ | CLI 测试通过 |

---

## Phase 2: Cloud IM API 集成 ✅ 已完成

> **实现**: prismer-im v0.2.0 Channel Plugin + Bridge API `/api/v2/im/bridge/*`
> **SDK**: @prismer/sdk v1.7 (WebSocket + REST)
> **API 文档**: `prismercloud/src/app/docs/CLOUD-SERVICES-API.md`

### Cloud IM API 概览

| 功能 | API | 状态 |
|------|-----|------|
| Agent 注册 | `POST /api/im/register` | ✅ Live |
| 身份查询 | `GET /api/im/me` | ✅ Live |
| 直接消息 | `POST /api/im/direct/:userId/messages` | ✅ Live |
| 群组消息 | `POST /api/im/groups/:id/messages` | ✅ Live |
| @mention 路由 | 自动解析 | ✅ Live |
| Workspace 初始化 | `POST /api/im/workspace/init` | ✅ Live |
| WebSocket | `wss://prismer.cloud/ws?token=JWT` | ✅ Live |
| SSE | `https://prismer.cloud/sse?token=JWT` | ✅ Live |
| Credits | `GET /api/im/credits` | ✅ Live |

### Agent 注册示例

```bash
# Bound Agent (使用 API Key，共享用户 credits)
curl -X POST https://prismer.cloud/api/im/register \
  -H "Authorization: Bearer $PRISMER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "agent",
    "username": "research-agent",
    "displayName": "Research Assistant",
    "agentType": "assistant",
    "capabilities": ["paper_search", "latex", "jupyter"]
  }'

# 返回: { "ok": true, "data": { "token": "eyJ...", "imUserId": "cm..." } }
```

### 集成架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Phase 2 架构 (Cloud IM API)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Prismer Library Frontend                                                │
│       │                                                                  │
│       │ WebSocket: wss://prismer.cloud/ws?token=JWT                     │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   Prismer Cloud IM API                          │    │
│  │                   (prismer.cloud/api/im/*)                       │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│                                 │ prismer-im Channel Plugin              │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   OpenClaw Container (Local)                     │    │
│  │  Gateway (:18901) | Agent: prismer-gateway/us-kimi-k2.5         │    │
│  │  Academic: LaTeX (:8080) | Jupyter (:8888)                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 2 任务

| 任务 | 优先级 | Cloud API |
|------|--------|-----------|
| Agent 注册到 Cloud | P0 | `POST /api/im/register` |
| 前端 WebSocket 连接 | P0 | `wss://prismer.cloud/ws` |
| prismer-im Channel Plugin | P0 | HTTP + WebSocket |
| 消息收发 | P0 | `POST /api/im/direct/:id/messages` |
| UIDirective 注册模式重构 | P1 | 见下文 |
| 流式响应 | P1 | WebSocket events |

### UIDirective 可扩展性重构

> **问题**: 当前 UIDirective 使用静态枚举 + switch-case，添加新组件需修改 5+ 个文件。
> **目标**: 重构为注册模式 + 能力发现，组件可动态注册指令。

**当前问题**:
```typescript
// 22 种硬编码指令类型
type UIDirectiveType = 'switch_component' | 'load_document' | ...;

// switch-case 执行器
switch (type) {
  case 'switch_component': ...
  default: console.warn('Unknown');
}
```

**目标架构**:
```
组件 (自注册)                    DirectiveRegistry (单例)
┌────────────┐                  ┌─────────────────────────┐
│ PDFReader  │──register()───►  │ handlers: Map<string,   │
│ ThreeViewer│──register()───►  │   DirectiveHandler>     │
│ NewComp    │──register()───►  │                         │
└────────────┘                  │ • execute(directive)    │
                                │ • getCapabilities()     │
                                └───────────┬─────────────┘
                                            │
                                            ▼
                                ┌─────────────────────────┐
                                │ GET /api/workspace/     │
                                │     capabilities        │
                                │                         │
                                │ Agent 启动时查询        │
                                │ 动态构建 prompt         │
                                └─────────────────────────┘
```

**组件自注册示例**:
```typescript
// ThreeViewer.tsx
useDirectiveHandler('three-viewer:load_model', {
  schema: {
    description: '加载 3D 模型',
    data: {
      modelUrl: { type: 'string', required: true },
      format: { type: 'string', enum: ['gltf', 'obj', 'fbx'] }
    }
  },
  execute: async (directive) => {
    await loadModel(directive.data.modelUrl);
  }
});
```

**能力发现 API**:
```bash
GET /api/workspace/capabilities
→ {
    "directives": [
      { "type": "switch_component", "schema": {...} },
      { "type": "three-viewer:load_model", "schema": {...} }
    ],
    "components": ["pdf-reader", "three-viewer", ...]
  }
```

**实施任务**:

| 任务 | 优先级 |
|------|--------|
| DirectiveRegistry 实现 | P0 |
| useDirectiveHandler hook | P0 |
| 迁移现有 22 种指令 | P1 |
| 能力发现 API | P1 |
| Agent prompt 动态生成 | P2 |

---

## Phase 3 规划: Workspace 管理

> **背景**: OpenClaw Workspace (`~/.openclaw/workspace/`) 是 Agent 的持久化目录，
> 包含 AGENTS.md、SOUL.md、memory/、skills/ 等。需要实现备份和恢复。

### Workspace 结构

```
~/.openclaw/workspace/
├── AGENTS.md           # 操作指令
├── SOUL.md             # 人设和边界
├── USER.md             # 用户信息
├── memory/             # 日志/记忆
├── skills/             # 自定义技能
└── canvas/             # UI 配置
```

### 规划 API

| API | 方法 | 说明 |
|-----|------|------|
| `/api/agents/templates` | GET/POST | 配置模板管理 |
| `/api/agents/:id/workspace` | GET | 获取文件列表 |
| `/api/agents/:id/workspace/:path` | GET/PUT | 读写文件 |
| `/api/agents/:id/workspace/backup` | POST | 备份到 S3 |
| `/api/agents/:id/workspace/restore` | POST | 从 S3 恢复 |

---

## 1. Overview

本文档描述 Prismer Library Workspace 与 OpenClaw Academic 容器的完整集成方案。

### 1.1 Workspace 架构回顾

```
┌─────────────────────────────────────────────────────────────────┐
│                         Workspace                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────────────────┐   │
│  │   ChatPanel     │  │           WindowsView                │   │
│  │  ┌───────────┐  │  │  ┌─────────────────────────────────┐│   │
│  │  │ Messages  │  │  │  │  TabBar (Component Switcher)    ││   │
│  │  ├───────────┤  │  │  ├─────────────────────────────────┤│   │
│  │  │ TaskPanel │  │  │  │  Active Component               ││   │
│  │  ├───────────┤  │  │  │  • pdf-reader                   ││   │
│  │  │ ChatInput │  │  │  │  • jupyter-notebook             ││   │
│  │  └───────────┘  │  │  │  • latex-editor                 ││   │
│  └─────────────────┘  │  │  • code-playground              ││   │
│                       │  │  • ai-editor                    ││   │
│                       │  │  • ag-grid                      ││   │
│  ┌─────────────────┐  │  └─────────────────────────────────┘│   │
│  │   ActionBar     │  ├─────────────────────────────────────┤   │
│  │  (Interactions) │  │  Timeline                           │   │
│  └─────────────────┘  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 通信需求分析

| 通道 | 发起方 | 目标 | 协议 | 用途 |
|------|--------|------|------|------|
| **Chat ↔ IM** | 双向 | IM Server | WebSocket/HTTP | 消息收发、@mention、路由 |
| **Component ↔ Container API** | Workspace | Container | HTTP | Jupyter/LaTeX/Prover API 调用 |
| **Agent → Workspace Control** | Container | Workspace | WebSocket | UIDirective (切换组件、加载文档等) |
| **Skill Execution Events** | Container | Workspace | WebSocket | 技能执行进度、结果同步 |

### 1.3 需要实现的模块

> **v0.3.0 更新**: 基于 OpenClaw 官方规范，简化为三模块架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Modules                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. prismer-im (Channel Plugin)                                  │
│     ├── Chat 消息收发 (文本/Markdown/代码)                        │
│     ├── 流式响应 (stream.chunk, stream.end)                      │
│     ├── UIDirective 发送 (控制 Workspace 组件)                   │
│     ├── Skill 事件报告 (技能执行进度)                            │
│     └── Agent 心跳/状态同步                                      │
│                                                                  │
│  2. Next.js API Proxy (非 OpenClaw 体系)                         │
│     ├── /api/container/[id]/jupyter/* → container:8888           │
│     ├── /api/container/[id]/latex/*   → container:8080           │
│     └── /api/container/[id]/prover/*  → container:8081           │
│                                                                  │
│  3. prismer-workspace (Skill)                                    │
│     ├── prismer_directive 工具 (Agent 发送 UI 指令)              │
│     └── prismer_skill_event 工具 (报告技能执行进度)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture

### 2.1 Complete System Architecture

> **v0.3.0 更新**: 简化架构，prismer-im 统一处理 Chat + Control

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Prismer Cloud                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          IM Server (:3200)                              │ │
│  │   • REST API (/api/*)    • WebSocket (/ws)    • Webhook (P2)           │ │
│  │   • Chat 消息路由        • UIDirective 转发   • Skill 事件转发         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ ① Chat + UIDirective + Skill Events
                                        │    (WebSocket/HTTP)
                                        │
┌───────────────────────────────────────┼─────────────────────────────────────┐
│                              Container │                                     │
│  ┌────────────────────────────────────┴────────────────────────────────┐   │
│  │                     OpenClaw Gateway (:18789)                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐│   │
│  │  │                   prismer-im Channel Plugin                      ││   │
│  │  │  ┌─────────────────────────────────────────────────────────────┐││   │
│  │  │  │  • Chat 消息收发 (text/markdown/code/media)                 │││   │
│  │  │  │  • 流式响应 (stream.chunk, stream.end)                      │││   │
│  │  │  │  • UIDirective 发送 (控制 Workspace 组件)                   │││   │
│  │  │  │  • Skill 事件报告 (技能执行进度)                            │││   │
│  │  │  │  • Agent 心跳/状态同步                                      │││   │
│  │  │  └─────────────────────────────────────────────────────────────┘││   │
│  │  └─────────────────────────────────────────────────────────────────┘│   │
│  │                              │                                       │   │
│  │                              ▼                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐│   │
│  │  │                    OpenClaw Agent Runtime                        ││   │
│  │  │    Skills: prismer-workspace | jupyter | latex | python | ...   ││   │
│  │  └─────────────────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Jupyter Server  │  │   LaTeX Server   │  │  Prover Server   │          │
│  │     :8888        │  │      :8080       │  │      :8081       │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└──────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ ② API Proxy (HTTP)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Prismer Library (Host)                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         Next.js Server (:3000)                          │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │                     Container Orchestrator                       │   │  │
│  │  │  • Start/Stop containers   • Port mapping   • Health check       │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │                    API Proxy Routes                              │   │  │
│  │  │  /api/container/[id]/jupyter/*   → Proxy to container:8888       │   │  │
│  │  │  /api/container/[id]/latex/*     → Proxy to container:8080       │   │  │
│  │  │  /api/container/[id]/prover/*    → Proxy to container:8081       │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                            Workspace UI                                 │  │
│  │  ┌─────────────────┐    ┌─────────────────────────────────────────┐   │  │
│  │  │   ChatPanel     │    │              WindowsView                 │   │  │
│  │  │   ↕ IM Server   │    │  ┌───────────────────────────────────┐  │   │  │
│  │  │   (WebSocket)   │    │  │ JupyterNotebook ↔ /api/.../jupyter│  │   │  │
│  │  │                 │    │  │ LatexEditor     ↔ /api/.../latex  │  │   │  │
│  │  │ ← UIDirective   │    │  │ PDFReader       ↔ Local/S3        │  │   │  │
│  │  │ ← Skill Events  │    │  │ CodePlayground  ↔ WebContainer    │  │   │  │
│  │  └─────────────────┘    │  └───────────────────────────────────┘  │   │  │
│  │                         │                                          │   │  │
│  │  ┌─────────────────┐    └─────────────────────────────────────────┘   │  │
│  │  │  workspaceStore │ ← 处理 UIDirective，更新组件状态                 │  │
│  │  └─────────────────┘                                                   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 通信流向详解

#### ① Chat Messages (ChatPanel ↔ IM Server ↔ Container)

```
User types message → ChatPanel → IM Server → prismer-im plugin → Agent
Agent responds → prismer-im plugin → IM Server → ChatPanel → Display
```

#### ② Control Signals (Agent → Workspace via IM Server)

> **v0.3.0 更新**: UIDirective 通过 prismer-im Channel 发送，复用 IM Server 连接

```
Agent executes skill → Skill 使用 prismer_directive 工具
→ prismer-im plugin 发送 UIDirective 到 IM Server
→ IM Server 转发到 Workspace WebSocket
→ workspaceStore.executeDirective()
→ UI updates (switch component, load document, etc.)
```

#### ③ Component API Calls (Workspace → Container)

```
User clicks "Run Cell" in JupyterNotebook
→ Component calls /api/container/[id]/jupyter/api/kernels/[kid]/execute
→ Next.js proxies to container:8888
→ Jupyter executes → Returns result
→ Component displays output
```

---

## 3. Module Design

### 3.1 Module Overview

> **v0.3.0 更新**: 简化为两个核心模块

```
docker/
├── README.md
├── Dockerfile
├── entrypoint.sh
├── config/
│   └── openclaw.json
├── plugin/
│   └── prismer-im/            # Channel Plugin (Chat + Control + Events)
│       ├── index.ts
│       ├── openclaw.plugin.json
│       ├── package.json
│       └── src/
│           ├── channel.ts     # ChannelPlugin 实现
│           ├── runtime.ts     # Runtime 单例
│           ├── inbound.ts     # 入站消息处理
│           ├── outbound.ts    # 出站消息 + UIDirective + Skill Events
│           └── types.ts       # 类型定义
└── skills/
    └── prismer-workspace/     # Skill (Agent 工具定义)
        ├── SKILL.md           # Skill 描述
        └── tools/
            ├── prismer_directive.md    # UIDirective 工具
            └── prismer_skill_event.md  # Skill 事件工具
```

### 3.2 Module 1: prismer-im (Channel Plugin)

> **v0.3.0 更新**: 合并原 prismer-control 功能，统一处理 Chat + Control + Events

**职责**:
1. Chat 消息收发 (文本/Markdown/代码/媒体)
2. 流式响应 (stream.chunk, stream.end)
3. UIDirective 发送 (控制 Workspace 组件)
4. Skill 事件报告 (技能执行进度)
5. Agent 心跳/状态同步

**OpenClaw Gateway Protocol 对接**:

```typescript
// Gateway WebSocket 消息格式 (官方规范)
type GatewayFrame =
  | { type: 'req'; id: string; method: string; params: unknown }
  | { type: 'res'; id: string; ok: boolean; payload?: unknown; error?: string }
  | { type: 'event'; event: string; payload: unknown; seq?: number };

// prismer-im 实现 ChannelPlugin<PrismerIMAccountConfig> 接口
interface PrismerIMAccountConfig {
  imServerUrl: string;       // e.g., "ws://im.prismer.cloud:3200/ws"
  agentToken: string;        // JWT token
  conversationId: string;    // 绑定的会话 ID
  capabilities?: string[];   // Agent 能力声明
}
```

### 3.3 UIDirective 规范

**职责**: Agent → Workspace 控制信号 (通过 prismer-im Channel 发送)

本节基于对 Workspace 各组件实际实现的深度分析，定义完整的 UIDirective 规范。

#### 3.3.1 组件功能深度分析

##### A. CodePlayground (代码沙箱)

**文件**: `src/components/editors/previews/code-playground/CodePlayground.tsx`

| 功能类别 | 具体能力 | 当前事件处理 |
|---------|---------|-------------|
| **文件加载** | 加载多文件项目、设置活跃文件 | `demo:loadCode` |
| **代码流式输入** | 逐块流式写入代码 (减少闪烁) | `streamCodeIntoFile()` |
| **代码执行** | 执行 Python/Node.js 脚本 | `demo:executeCode`, `agent:execute-code` |
| **代码更新** | 更新指定文件内容 | `agent:directive:UPDATE_CODE` |
| **终端输出** | 追加终端输出行 | `agent:directive:TERMINAL_OUTPUT` |
| **模板切换** | 切换 React/Vue/Vanilla/Python/Node | `handleTemplateChange()` |
| **布局控制** | horizontal/vertical/editor-only/preview-only | `setLayout()` |
| **面板控制** | 显示/隐藏文件树、终端 | `setShowFileTree()`, `setShowTerminal()` |
| **项目导入导出** | JSON 格式导入/导出 | `handleImport()`, `handleExport()` |

**事件发射** (via `emitComponentEvent`):
- `ready` - 组件挂载完成
- `contentLoaded` - 代码加载完成 (`{ action: 'load_code'|'update_code', result: {...} }`)
- `actionComplete` - 执行完成 (`{ action: 'execute_code'|'script_execution', result: {...} }`)
- `actionFailed` - 执行失败

##### B. JupyterNotebook (Jupyter 笔记本)

**文件**: `src/components/editors/jupyter/components/JupyterNotebook.tsx`

| 功能类别 | 具体能力 | 当前事件处理 |
|---------|---------|-------------|
| **Cell 添加** | 添加 code/markdown cell | `demo:addCell`, `agent:directive:UPDATE_NOTEBOOK` |
| **Cell 执行** | 执行单个/全部 cell | `demo:runCell`, `agent:directive:EXECUTE_CELL` |
| **Cell 管理** | 删除、移动、复制、剪切、粘贴、重排序 | Store actions |
| **Cell 类型转换** | code ↔ markdown | `changeCellType()` |
| **内核连接** | 连接/断开 Jupyter Server | `connect()`, `disconnect()` |
| **内核控制** | 中断/重启内核 | `interruptExecution()`, `restartKernel()` |
| **输出管理** | 清除所有输出 | `clearAllOutputs()` |
| **撤销重做** | Undo/Redo 支持 | `undo()`, `redo()` |
| **AI 辅助** | 代码解释/修复/优化/文档 | `handleCellAIAction()` |
| **侧边栏** | 变量检查器、包管理、会话管理、产物面板 | `sidebarPanel` state |
| **Agent 编辑确认** | 提议/确认/拒绝编辑 | `proposeEdit()`, `confirmEdit()`, `rejectEdit()` |

**事件发射**:
- `ready` - 组件挂载完成
- `contentLoaded` - Cell 添加完成 (`{ action: 'add_cell', result: {...} }`)
- `actionComplete` - Cell 执行完成 (`{ action: 'execute_cell', result: {...} }`)
- `actionFailed` - Cell 执行失败

##### C. LatexEditor (LaTeX 编辑器)

**文件**: `src/components/editors/previews/LatexEditorPreview.tsx`

| 功能类别 | 具体能力 | 当前事件处理 |
|---------|---------|-------------|
| **文件加载** | 加载 LaTeX 项目 | Internal via template loading |
| **内容更新** | 更新指定文件内容 | `agent:directive:UPDATE_LATEX` |
| **编译** | 编译 LaTeX 到 PDF | `agent:directive:COMPILE_LATEX` |
| **PDF 预览** | 显示编译结果 | Integrated viewer |
| **文件管理** | 多文件项目导航 | File tree navigation |
| **模板选择** | 选择 LaTeX 模板 | `TemplateManager` |
| **GitHub 导入** | 从 GitHub 导入项目 | `GitHubImporter` |

##### D. PDFReader (PDF 阅读器)

**文件**: `src/components/editors/pdf-reader/index.tsx`

| 功能类别 | 具体能力 | 需要的指令 |
|---------|---------|-----------|
| **文档加载** | 按 URL/arxivId 加载 PDF | `LOAD_PDF` |
| **页面导航** | 跳转到指定页 | `NAVIGATE_TO_PAGE` |
| **文本搜索** | PDF 内文本搜索 | `SEARCH_TEXT` |
| **阅读模式** | 单页/双页模式切换 | `SET_READING_MODE` |
| **缩放控制** | 调整缩放比例 | `SET_SCALE` |
| **面板控制** | 左侧索引/右侧 AI 面板切换 | `TOGGLE_PANEL` |
| **文本高亮** | 高亮指定文本/区域 | `HIGHLIGHT_TEXT` |
| **选区提取** | 从选区创建提取 | `CREATE_EXTRACT` |
| **AI 问答** | Paper context 问答 | Via AI panel |

**OCR 依赖功能**:
- 句子级选择 (`ENABLE_SENTENCE_LAYER = false` - 待 OCR 服务)
- 对象选择 (图像/表格, `ENABLE_OBJECT_SELECTION = true`)

##### E. AGGrid (数据表格)

**文件**: `src/components/editors/previews/AGGridPreview.tsx`

| 功能类别 | 具体能力 | 当前事件处理 |
|---------|---------|-------------|
| **数据加载** | 加载 CSV/JSON 数据集 | Internal |
| **数据更新** | 更新表格数据 | `agent:directive:UPDATE_DATA_GRID` |
| **列操作** | 添加/删除/重排列 | Grid API |
| **过滤排序** | 按条件过滤和排序 | Grid API |
| **数据导出** | 导出为 CSV/Excel | Export API |
| **单元格编辑** | 直接编辑单元格 | Editable cells |

##### F. AiEditor (AI 编辑器)

**文件**: `src/components/editors/previews/AiEditorPreview.tsx`

| 功能类别 | 具体能力 | 需要的指令 |
|---------|---------|-----------|
| **内容更新** | 设置/更新文档内容 | `UPDATE_EDITOR_CONTENT` |
| **AI 命令** | 执行 AI 辅助命令 | `EXECUTE_AI_COMMAND` |
| **格式化** | 文本格式化操作 | Internal |
| **内容插入** | 在光标处插入内容 | `INSERT_CONTENT` |

##### G. Timeline (时间线)

**文件**: `src/app/workspace/components/Timeline/index.tsx`

| 功能类别 | 具体能力 | 触发方式 |
|---------|---------|---------|
| **事件显示** | 显示时间线事件 | 接收 `ExtendedTimelineEvent[]` |
| **播放控制** | 播放/暂停/跳转 | `onPlay()`, `onPause()`, `onSeek()` |
| **事件点击** | 点击事件跳转到上下文 | `onEventClick()` |

Timeline 不需要直接的 Agent 指令，而是接收其他组件产生的事件。

##### H. WindowViewer (窗口视图)

**文件**: `src/app/workspace/components/WindowViewer/index.tsx`

| 功能类别 | 具体能力 | 触发方式 |
|---------|---------|---------|
| **组件切换** | 切换活跃组件 | `onComponentChange()` → `SWITCH_COMPONENT` |
| **Diff 显示** | 显示代码差异 | `activeDiff` prop |
| **Tab 管理** | 组件标签页管理 | `ComponentTabs` |

#### 3.3.2 完整 UIDirective 类型定义

```typescript
// ═══════════════════════════════════════════════════════════════
// plugin/control/src/interfaces/control-channel.ts
// ═══════════════════════════════════════════════════════════════

/**
 * UI 指令类型 - 基于组件功能深度分析
 *
 * 命名规范:
 * - 全局指令: VERB_NOUN (大写下划线)
 * - 组件特定: COMPONENT_VERB (前缀标识组件)
 */
export type UIDirectiveType =
  // ═══════════════════════════════════════════════════════════════
  // 全局指令 (跨组件)
  // ═══════════════════════════════════════════════════════════════
  | 'SWITCH_COMPONENT'           // 切换到指定组件
  | 'LOAD_DOCUMENT'              // 加载文档到指定组件
  | 'SHOW_NOTIFICATION'          // 显示通知
  | 'UPDATE_TASK_STATUS'         // 更新任务状态
  | 'HIGHLIGHT_MESSAGE'          // 高亮聊天消息
  | 'SCROLL_TO'                  // 滚动到指定位置
  | 'TOGGLE_PANEL'               // 切换面板显示
  | 'SET_FOCUS'                  // 设置焦点元素

  // ═══════════════════════════════════════════════════════════════
  // CodePlayground 指令
  // ═══════════════════════════════════════════════════════════════
  | 'CODE_LOAD_FILES'            // 加载多文件项目
  | 'CODE_UPDATE_FILE'           // 更新指定文件内容 (alias: UPDATE_CODE)
  | 'CODE_EXECUTE'               // 执行代码
  | 'CODE_TERMINAL_OUTPUT'       // 追加终端输出 (alias: TERMINAL_OUTPUT)
  | 'CODE_SET_ACTIVE_FILE'       // 设置活跃编辑文件
  | 'CODE_SET_TEMPLATE'          // 切换模板 (react/vue/python/node...)
  | 'CODE_SET_LAYOUT'            // 设置布局模式
  | 'CODE_TOGGLE_FILE_TREE'      // 切换文件树显示
  | 'CODE_TOGGLE_TERMINAL'       // 切换终端显示
  | 'CODE_STREAM_CONTENT'        // 流式写入代码 (逐块)

  // ═══════════════════════════════════════════════════════════════
  // JupyterNotebook 指令
  // ═══════════════════════════════════════════════════════════════
  | 'JUPYTER_LOAD_NOTEBOOK'      // 加载 Notebook 文件
  | 'JUPYTER_ADD_CELL'           // 添加 Cell (可选执行)
  | 'JUPYTER_UPDATE_CELL'        // 更新指定 Cell 内容
  | 'JUPYTER_EXECUTE_CELL'       // 执行指定 Cell
  | 'JUPYTER_EXECUTE_ALL'        // 执行所有 Cell
  | 'JUPYTER_DELETE_CELL'        // 删除 Cell
  | 'JUPYTER_MOVE_CELL'          // 移动 Cell 位置
  | 'JUPYTER_CLEAR_OUTPUTS'      // 清除所有输出
  | 'JUPYTER_RESTART_KERNEL'     // 重启内核
  | 'JUPYTER_INTERRUPT'          // 中断执行
  | 'JUPYTER_PROPOSE_EDIT'       // 提议代码编辑 (等待用户确认)
  | 'JUPYTER_SET_SIDEBAR'        // 设置侧边栏 (variables/packages/sessions/artifacts)
  | 'JUPYTER_SCROLL_TO_CELL'     // 滚动到指定 Cell

  // ═══════════════════════════════════════════════════════════════
  // LatexEditor 指令
  // ═══════════════════════════════════════════════════════════════
  | 'LATEX_LOAD_PROJECT'         // 加载 LaTeX 项目
  | 'LATEX_UPDATE_FILE'          // 更新指定文件 (alias: UPDATE_LATEX)
  | 'LATEX_COMPILE'              // 编译 LaTeX (alias: COMPILE_LATEX)
  | 'LATEX_SET_ACTIVE_FILE'      // 设置活跃编辑文件
  | 'LATEX_SCROLL_TO_LINE'       // 滚动到指定行
  | 'LATEX_INSERT_TEXT'          // 在光标处插入文本
  | 'LATEX_SHOW_ERROR'           // 显示编译错误定位
  | 'LATEX_SYNC_PDF'             // 同步 PDF 位置 (SyncTeX)

  // ═══════════════════════════════════════════════════════════════
  // PDFReader 指令
  // ═══════════════════════════════════════════════════════════════
  | 'PDF_LOAD_DOCUMENT'          // 加载 PDF 文档
  | 'PDF_NAVIGATE_TO_PAGE'       // 跳转到指定页
  | 'PDF_SEARCH_TEXT'            // 搜索文本
  | 'PDF_CLEAR_SEARCH'           // 清除搜索
  | 'PDF_SET_SCALE'              // 设置缩放比例
  | 'PDF_SET_READING_MODE'       // 设置阅读模式 (single/double)
  | 'PDF_HIGHLIGHT_REGION'       // 高亮指定区域
  | 'PDF_HIGHLIGHT_TEXT'         // 高亮指定文本
  | 'PDF_CREATE_ANNOTATION'      // 创建注释
  | 'PDF_TOGGLE_LEFT_PANEL'      // 切换左侧面板
  | 'PDF_TOGGLE_AI_PANEL'        // 切换 AI 面板
  | 'PDF_SCROLL_TO_ELEMENT'      // 滚动到 OCR 元素 (figure/table)
  | 'PDF_ASK_PAPER'              // 向 Paper AI 提问

  // ═══════════════════════════════════════════════════════════════
  // AGGrid 指令
  // ═══════════════════════════════════════════════════════════════
  | 'GRID_LOAD_DATA'             // 加载数据集
  | 'GRID_UPDATE_DATA'           // 更新数据 (alias: UPDATE_DATA_GRID)
  | 'GRID_ADD_ROWS'              // 添加行
  | 'GRID_DELETE_ROWS'           // 删除行
  | 'GRID_UPDATE_CELLS'          // 更新单元格
  | 'GRID_SET_COLUMNS'           // 设置列定义
  | 'GRID_APPLY_FILTER'          // 应用过滤器
  | 'GRID_SORT'                  // 排序
  | 'GRID_EXPORT'                // 导出数据
  | 'GRID_SCROLL_TO_ROW'         // 滚动到指定行

  // ═══════════════════════════════════════════════════════════════
  // AiEditor 指令
  // ═══════════════════════════════════════════════════════════════
  | 'EDITOR_SET_CONTENT'         // 设置文档内容
  | 'EDITOR_INSERT_CONTENT'      // 插入内容
  | 'EDITOR_EXECUTE_COMMAND'     // 执行编辑器命令
  | 'EDITOR_SET_SELECTION'       // 设置选区
  | 'EDITOR_FOCUS'               // 获取焦点

  // ═══════════════════════════════════════════════════════════════
  // 时间线管理指令
  // ═══════════════════════════════════════════════════════════════
  | 'TIMELINE_ADD_EVENT'         // 添加时间线事件
  | 'TIMELINE_SEEK'              // 跳转到指定位置
  | 'TIMELINE_PLAY'              // 播放
  | 'TIMELINE_PAUSE'             // 暂停

  // ═══════════════════════════════════════════════════════════════
  // Diff 显示指令
  // ═══════════════════════════════════════════════════════════════
  | 'DIFF_SHOW'                  // 显示 Diff
  | 'DIFF_HIDE';                 // 隐藏 Diff

// ═══════════════════════════════════════════════════════════════
// Payload 类型定义
// ═══════════════════════════════════════════════════════════════

/** 组件类型 */
export type ComponentType =
  | 'ai-editor' | 'pdf-reader' | 'latex-editor' | 'code-playground'
  | 'bento-gallery' | 'three-viewer' | 'ag-grid' | 'jupyter-notebook';

/** 全局指令 Payload */
export interface SwitchComponentPayload {
  component: ComponentType;
  state?: Record<string, unknown>;  // 组件初始状态
}

export interface LoadDocumentPayload {
  documentId: string;
  documentType: 'pdf' | 'notebook' | 'latex' | 'code' | 'data';
  targetComponent?: ComponentType;
  path?: string;
  url?: string;
}

export interface ShowNotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;  // ms, 0 = persistent
  actions?: Array<{ label: string; actionId: string }>;
}

export interface UpdateTaskStatusPayload {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;  // 0-100
  message?: string;
}

/** CodePlayground Payload */
export interface CodeLoadFilesPayload {
  files: Record<string, { content: string; language: string }>;
  activeFile: string;
  stream?: boolean;  // 是否流式写入
  template?: 'react' | 'vue' | 'vanilla' | 'python' | 'node' | 'custom';
}

export interface CodeUpdateFilePayload {
  filename: string;
  content: string;
  stream?: boolean;
}

export interface CodeExecutePayload {
  command?: string;  // 默认: 根据文件类型推断
  timeout?: number;
}

export interface CodeTerminalOutputPayload {
  line: string;
  append?: boolean;
}

export interface CodeSetLayoutPayload {
  layout: 'horizontal' | 'vertical' | 'editor-only' | 'preview-only';
}

/** JupyterNotebook Payload */
export interface JupyterLoadNotebookPayload {
  path?: string;
  url?: string;
  content?: object;  // .ipynb JSON content
}

export interface JupyterAddCellPayload {
  type: 'code' | 'markdown';
  source: string;
  execute?: boolean;  // 添加后是否立即执行
  afterCellId?: string;
  origin?: 'user' | 'agent';
}

export interface JupyterExecuteCellPayload {
  cellId?: string;
  cellIndex?: number;
}

export interface JupyterProposeEditPayload {
  cellId: string;
  newSource: string;
  description?: string;
  warnings?: string[];
}

export interface JupyterSetSidebarPayload {
  panel: 'none' | 'variables' | 'packages' | 'sessions' | 'artifacts';
}

/** LatexEditor Payload */
export interface LatexLoadProjectPayload {
  projectPath?: string;
  templateId?: string;
  files?: Record<string, string>;  // filename → content
}

export interface LatexUpdateFilePayload {
  file: string;
  content: string;
}

export interface LatexCompilePayload {
  mainFile?: string;  // 默认: main.tex
  outputFormat?: 'pdf' | 'dvi';
}

export interface LatexScrollToLinePayload {
  file: string;
  line: number;
  column?: number;
}

/** PDFReader Payload */
export interface PdfLoadDocumentPayload {
  url?: string;
  arxivId?: string;
  path?: string;
}

export interface PdfNavigateToPagePayload {
  page: number;
}

export interface PdfSearchTextPayload {
  query: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface PdfSetScalePayload {
  scale: number;  // 0.25 - 2.0
}

export interface PdfSetReadingModePayload {
  mode: 'single' | 'double';
}

export interface PdfHighlightRegionPayload {
  page: number;
  bbox: [number, number, number, number];  // [x1, y1, x2, y2]
  color?: string;
  id?: string;
}

export interface PdfTogglePanelPayload {
  panel: 'left' | 'right' | 'ai';
  visible?: boolean;  // 省略则 toggle
}

export interface PdfAskPaperPayload {
  question: string;
  context?: {
    page?: number;
    selection?: string;
  };
}

/** AGGrid Payload */
export interface GridLoadDataPayload {
  data: object[];
  columns?: object[];  // AG Grid ColumnDef
  options?: object;
}

export interface GridUpdateDataPayload {
  data: object[];
  mode?: 'replace' | 'append' | 'update';  // update 需要 id 字段
}

export interface GridApplyFilterPayload {
  filters: Record<string, unknown>;  // AG Grid FilterModel
}

export interface GridSortPayload {
  sortModel: Array<{ colId: string; sort: 'asc' | 'desc' }>;
}

export interface GridScrollToRowPayload {
  rowIndex?: number;
  rowId?: string;
}

/** AiEditor Payload */
export interface EditorSetContentPayload {
  content: string;
  format?: 'markdown' | 'html' | 'text';
}

export interface EditorInsertContentPayload {
  content: string;
  position?: 'cursor' | 'start' | 'end';
}

/** Timeline Payload */
export interface TimelineAddEventPayload {
  id: string;
  action: 'navigate' | 'edit' | 'execute' | 'create' | 'delete';
  description: string;
  componentType: ComponentType;
  actorType: 'user' | 'agent';
  actorId: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface TimelineSeekPayload {
  position: number;  // 0-100 百分比
}

/** Diff Payload */
export interface DiffShowPayload {
  component: ComponentType;
  file?: string;
  changes: Array<{
    type: 'add' | 'delete' | 'modify';
    lineStart: number;
    lineEnd?: number;
    oldContent?: string;
    newContent?: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// UI 指令接口
// ═══════════════════════════════════════════════════════════════

/** UI 指令 */
export interface UIDirective {
  id: string;
  type: UIDirectiveType;
  payload: unknown;
  targetCapabilities?: string[];  // 目标能力过滤 (desktop/mobile)
  delay?: number;                 // 延迟执行 (ms)
}

// ═══════════════════════════════════════════════════════════════
// 指令 → 组件事件映射表
// ═══════════════════════════════════════════════════════════════

/**
 * 此表定义 UIDirective 如何映射到组件的 window.addEventListener 事件
 * Workspace 的 DirectiveExecutor 使用此映射分发指令
 */
export const DIRECTIVE_EVENT_MAP: Record<UIDirectiveType, {
  eventName: string;
  component: ComponentType | 'global';
  legacyAlias?: string;  // 向后兼容的旧事件名
}> = {
  // Global
  'SWITCH_COMPONENT': { eventName: 'workspace:switchComponent', component: 'global' },
  'LOAD_DOCUMENT': { eventName: 'workspace:loadDocument', component: 'global' },
  'SHOW_NOTIFICATION': { eventName: 'workspace:notification', component: 'global' },
  'UPDATE_TASK_STATUS': { eventName: 'workspace:taskStatus', component: 'global' },

  // CodePlayground
  'CODE_LOAD_FILES': { eventName: 'demo:loadCode', component: 'code-playground' },
  'CODE_UPDATE_FILE': { eventName: 'agent:directive:UPDATE_CODE', component: 'code-playground', legacyAlias: 'UPDATE_CODE' },
  'CODE_EXECUTE': { eventName: 'demo:executeCode', component: 'code-playground' },
  'CODE_TERMINAL_OUTPUT': { eventName: 'agent:directive:TERMINAL_OUTPUT', component: 'code-playground', legacyAlias: 'TERMINAL_OUTPUT' },
  'CODE_SET_ACTIVE_FILE': { eventName: 'code:setActiveFile', component: 'code-playground' },
  'CODE_SET_TEMPLATE': { eventName: 'code:setTemplate', component: 'code-playground' },
  'CODE_SET_LAYOUT': { eventName: 'code:setLayout', component: 'code-playground' },
  'CODE_TOGGLE_FILE_TREE': { eventName: 'code:toggleFileTree', component: 'code-playground' },
  'CODE_TOGGLE_TERMINAL': { eventName: 'code:toggleTerminal', component: 'code-playground' },
  'CODE_STREAM_CONTENT': { eventName: 'code:streamContent', component: 'code-playground' },

  // JupyterNotebook
  'JUPYTER_LOAD_NOTEBOOK': { eventName: 'jupyter:loadNotebook', component: 'jupyter-notebook' },
  'JUPYTER_ADD_CELL': { eventName: 'agent:directive:UPDATE_NOTEBOOK', component: 'jupyter-notebook', legacyAlias: 'UPDATE_NOTEBOOK' },
  'JUPYTER_UPDATE_CELL': { eventName: 'jupyter:updateCell', component: 'jupyter-notebook' },
  'JUPYTER_EXECUTE_CELL': { eventName: 'agent:directive:EXECUTE_CELL', component: 'jupyter-notebook', legacyAlias: 'EXECUTE_CELL' },
  'JUPYTER_EXECUTE_ALL': { eventName: 'jupyter:executeAll', component: 'jupyter-notebook' },
  'JUPYTER_DELETE_CELL': { eventName: 'jupyter:deleteCell', component: 'jupyter-notebook' },
  'JUPYTER_MOVE_CELL': { eventName: 'jupyter:moveCell', component: 'jupyter-notebook' },
  'JUPYTER_CLEAR_OUTPUTS': { eventName: 'jupyter:clearOutputs', component: 'jupyter-notebook' },
  'JUPYTER_RESTART_KERNEL': { eventName: 'jupyter:restartKernel', component: 'jupyter-notebook' },
  'JUPYTER_INTERRUPT': { eventName: 'jupyter:interrupt', component: 'jupyter-notebook' },
  'JUPYTER_PROPOSE_EDIT': { eventName: 'jupyter:proposeEdit', component: 'jupyter-notebook' },
  'JUPYTER_SET_SIDEBAR': { eventName: 'jupyter:setSidebar', component: 'jupyter-notebook' },
  'JUPYTER_SCROLL_TO_CELL': { eventName: 'jupyter:scrollToCell', component: 'jupyter-notebook' },

  // LatexEditor
  'LATEX_LOAD_PROJECT': { eventName: 'latex:loadProject', component: 'latex-editor' },
  'LATEX_UPDATE_FILE': { eventName: 'agent:directive:UPDATE_LATEX', component: 'latex-editor', legacyAlias: 'UPDATE_LATEX' },
  'LATEX_COMPILE': { eventName: 'agent:directive:COMPILE_LATEX', component: 'latex-editor', legacyAlias: 'COMPILE_LATEX' },
  'LATEX_SET_ACTIVE_FILE': { eventName: 'latex:setActiveFile', component: 'latex-editor' },
  'LATEX_SCROLL_TO_LINE': { eventName: 'latex:scrollToLine', component: 'latex-editor' },
  'LATEX_INSERT_TEXT': { eventName: 'latex:insertText', component: 'latex-editor' },
  'LATEX_SHOW_ERROR': { eventName: 'latex:showError', component: 'latex-editor' },
  'LATEX_SYNC_PDF': { eventName: 'latex:syncPdf', component: 'latex-editor' },

  // PDFReader
  'PDF_LOAD_DOCUMENT': { eventName: 'pdf:loadDocument', component: 'pdf-reader' },
  'PDF_NAVIGATE_TO_PAGE': { eventName: 'pdf:navigateToPage', component: 'pdf-reader' },
  'PDF_SEARCH_TEXT': { eventName: 'pdf:searchText', component: 'pdf-reader' },
  'PDF_CLEAR_SEARCH': { eventName: 'pdf:clearSearch', component: 'pdf-reader' },
  'PDF_SET_SCALE': { eventName: 'pdf:setScale', component: 'pdf-reader' },
  'PDF_SET_READING_MODE': { eventName: 'pdf:setReadingMode', component: 'pdf-reader' },
  'PDF_HIGHLIGHT_REGION': { eventName: 'pdf:highlightRegion', component: 'pdf-reader' },
  'PDF_HIGHLIGHT_TEXT': { eventName: 'pdf:highlightText', component: 'pdf-reader' },
  'PDF_CREATE_ANNOTATION': { eventName: 'pdf:createAnnotation', component: 'pdf-reader' },
  'PDF_TOGGLE_LEFT_PANEL': { eventName: 'pdf:toggleLeftPanel', component: 'pdf-reader' },
  'PDF_TOGGLE_AI_PANEL': { eventName: 'pdf:toggleAiPanel', component: 'pdf-reader' },
  'PDF_SCROLL_TO_ELEMENT': { eventName: 'pdf:scrollToElement', component: 'pdf-reader' },
  'PDF_ASK_PAPER': { eventName: 'pdf:askPaper', component: 'pdf-reader' },

  // AGGrid
  'GRID_LOAD_DATA': { eventName: 'grid:loadData', component: 'ag-grid' },
  'GRID_UPDATE_DATA': { eventName: 'agent:directive:UPDATE_DATA_GRID', component: 'ag-grid', legacyAlias: 'UPDATE_DATA_GRID' },
  'GRID_ADD_ROWS': { eventName: 'grid:addRows', component: 'ag-grid' },
  'GRID_DELETE_ROWS': { eventName: 'grid:deleteRows', component: 'ag-grid' },
  'GRID_UPDATE_CELLS': { eventName: 'grid:updateCells', component: 'ag-grid' },
  'GRID_SET_COLUMNS': { eventName: 'grid:setColumns', component: 'ag-grid' },
  'GRID_APPLY_FILTER': { eventName: 'grid:applyFilter', component: 'ag-grid' },
  'GRID_SORT': { eventName: 'grid:sort', component: 'ag-grid' },
  'GRID_EXPORT': { eventName: 'grid:export', component: 'ag-grid' },
  'GRID_SCROLL_TO_ROW': { eventName: 'grid:scrollToRow', component: 'ag-grid' },

  // AiEditor
  'EDITOR_SET_CONTENT': { eventName: 'editor:setContent', component: 'ai-editor' },
  'EDITOR_INSERT_CONTENT': { eventName: 'editor:insertContent', component: 'ai-editor' },
  'EDITOR_EXECUTE_COMMAND': { eventName: 'editor:executeCommand', component: 'ai-editor' },
  'EDITOR_SET_SELECTION': { eventName: 'editor:setSelection', component: 'ai-editor' },
  'EDITOR_FOCUS': { eventName: 'editor:focus', component: 'ai-editor' },

  // Timeline
  'TIMELINE_ADD_EVENT': { eventName: 'timeline:addEvent', component: 'global' },
  'TIMELINE_SEEK': { eventName: 'timeline:seek', component: 'global' },
  'TIMELINE_PLAY': { eventName: 'timeline:play', component: 'global' },
  'TIMELINE_PAUSE': { eventName: 'timeline:pause', component: 'global' },

  // Diff
  'DIFF_SHOW': { eventName: 'diff:show', component: 'global' },
  'DIFF_HIDE': { eventName: 'diff:hide', component: 'global' },

  // Legacy aliases (for backward compatibility)
  'HIGHLIGHT_MESSAGE': { eventName: 'workspace:highlightMessage', component: 'global' },
  'SCROLL_TO': { eventName: 'workspace:scrollTo', component: 'global' },
  'TOGGLE_PANEL': { eventName: 'workspace:togglePanel', component: 'global' },
  'SET_FOCUS': { eventName: 'workspace:setFocus', component: 'global' },
};

// ═══════════════════════════════════════════════════════════════
// Workspace 端 DirectiveExecutor 实现参考
// ═══════════════════════════════════════════════════════════════

/**
 * 在 Workspace 端 (Next.js) 实现的指令执行器
 * 位置: src/app/workspace/lib/directiveExecutor.ts
 */
/*
export class DirectiveExecutor {
  private activeComponent: ComponentType;

  executeDirective(directive: UIDirective): void {
    const mapping = DIRECTIVE_EVENT_MAP[directive.type];
    if (!mapping) {
      console.warn(`Unknown directive type: ${directive.type}`);
      return;
    }

    // 检查组件是否匹配 (非全局指令)
    if (mapping.component !== 'global' && mapping.component !== this.activeComponent) {
      console.warn(`Directive ${directive.type} targets ${mapping.component}, but active is ${this.activeComponent}`);
      // 可选: 自动切换到目标组件
    }

    // 分发事件到组件
    const event = new CustomEvent(mapping.eventName, {
      detail: directive.payload,
    });
    window.dispatchEvent(event);

    // 记录到时间线
    this.addTimelineEvent(directive);
  }
}
*/

#### 3.3.3 Component → Agent 事件回报

组件通过 `componentEventBus` 向 Agent 报告状态变化，Agent 可以据此决定后续操作。

**文件**: `src/app/workspace/lib/componentEventBus.ts`

```typescript
/** 组件事件类型 */
export type ComponentEventType =
  | 'ready'           // 组件加载完成
  | 'contentLoaded'   // 内容加载完成
  | 'actionComplete'  // 操作完成
  | 'actionFailed'    // 操作失败
  | 'actionProgress'  // 操作进度
  | 'stateChanged';   // 状态变化

/** 组件事件 */
export interface ComponentEvent {
  component: ComponentType;
  type: ComponentEventType;
  payload?: {
    action?: string;       // 完成的操作
    result?: unknown;      // 操作结果
    error?: Error;         // 错误信息
    state?: unknown;       // 新状态
    progress?: number;     // 进度 (0-100)
    message?: string;      // 可读消息
  };
  timestamp: number;
}
```

**各组件事件发射示例**:

| 组件 | 事件 | 触发时机 |
|------|------|---------|
| CodePlayground | `ready` | 组件挂载完成 |
| CodePlayground | `contentLoaded` | 代码加载完成 (`action: 'load_code'`) |
| CodePlayground | `actionComplete` | 脚本执行完成 (`action: 'execute_code'`) |
| JupyterNotebook | `ready` | 组件挂载完成 |
| JupyterNotebook | `contentLoaded` | Cell 添加完成 (`action: 'add_cell'`) |
| JupyterNotebook | `actionComplete` | Cell 执行完成 (`action: 'execute_cell'`) |
| LatexEditor | `contentLoaded` | LaTeX 文件加载完成 |
| LatexEditor | `actionComplete` | 编译完成 (`action: 'compile'`) |
| PDFReader | `contentLoaded` | PDF 文档加载完成 |
| PDFReader | `actionComplete` | 搜索完成 (`action: 'search'`) |
| AGGrid | `contentLoaded` | 数据加载完成 |
| AGGrid | `actionComplete` | 导出完成 (`action: 'export'`) |

**服务端同步**:

组件使用 `forwardComponentEvent()` 将事件同步到 Agent Server:

```typescript
// src/lib/sync/componentEventForwarder.ts
import { forwardComponentEvent } from "@/lib/sync";

// 在组件中调用
forwardComponentEvent('code-playground', 'actionComplete', {
  action: 'execute_code',
  result: { exitCode: 0 }
});
```

#### 3.3.4 完整通信流程

> **v0.3.0 更新**: 所有通信通过 prismer-im Channel 和 IM Server

```
Agent → Workspace (UIDirective via IM Server):
┌────────────────────────────────────────────────────────────────────┐
│ OpenClaw Agent                                                      │
│   ↓ prismer_directive({ type: 'JUPYTER_ADD_CELL', ... })           │
│   ↓                                                                 │
│ prismer-im Channel Plugin                                           │
│   ↓ POST /api/messages (type: 'ui_directive')                      │
│   ↓                                                                 │
│ IM Server (:3200)                                                   │
│   ↓ WebSocket broadcast to Workspace                               │
│   ↓                                                                 │
│ Workspace WebSocket Handler                                         │
│   ↓ DirectiveExecutor.executeDirective()                           │
│   ↓ window.dispatchEvent('agent:directive:UPDATE_NOTEBOOK', ...)   │
│   ↓                                                                 │
│ JupyterNotebook.handleAgentUpdateNotebook()                         │
│   ↓ addCodeCell(), executeCell()                                    │
└────────────────────────────────────────────────────────────────────┘

Workspace → Agent (ComponentEvent via IM Server):
┌────────────────────────────────────────────────────────────────────┐
│ JupyterNotebook.executeCell()                                       │
│   ↓ emitComponentEvent({ type: 'actionComplete', ... })            │
│   ↓                                                                 │
│ componentEventBus.emit() + forwardComponentEvent()                  │
│   ↓                                                                 │
│ Workspace WebSocket                                                 │
│   ↓ { type: 'component_event', payload: {...} }                    │
│   ↓                                                                 │
│ IM Server (:3200)                                                   │
│   ↓ Route to Agent conversation                                    │
│   ↓                                                                 │
│ prismer-im Channel Plugin                                           │
│   ↓ Deliver to OpenClaw Agent                                      │
│   ↓                                                                 │
│ OpenClaw Agent receives feedback                                    │
│   (可以据此决定下一步操作)                                           │
└────────────────────────────────────────────────────────────────────┘
```

/** Control Channel 接口 */
export interface IControlChannel {
  /** 连接到 Workspace 控制通道 */
  connect(): Promise<void>;

  /** 断开连接 */
  disconnect(): Promise<void>;

  /** 发送 UI 指令 */
  sendDirective(directive: UIDirective): Promise<void>;

  /** 发送 Skill 执行事件 */
  sendSkillEvent(event: SkillEvent): Promise<void>;

  /** 监听 Workspace 交互事件 (ComponentEvent) */
  onInteraction(handler: (event: InteractionEvent) => void): void;

  /** 监听组件事件 */
  onComponentEvent(handler: (event: ComponentEvent) => void): void;
}

/** Skill 执行事件 */
export interface SkillEvent {
  skillName: string;
  phase: 'start' | 'progress' | 'complete' | 'error';
  progress?: number;
  message?: string;
  artifacts?: SkillArtifact[];
}

/** Skill 产物 */
export interface SkillArtifact {
  type: 'file' | 'notebook' | 'pdf' | 'image' | 'data';
  path: string;
  displayName?: string;
  componentTarget?: ComponentType;
}

/** Workspace 交互事件 */
export interface InteractionEvent {
  componentId: string;
  actionId: string;
  data?: unknown;
  timestamp: number;
}
```

**实现**:

```typescript
// plugin/control/src/impl/control-channel-ws.ts

export class ControlChannelWS implements IControlChannel {
  private ws: WebSocket | null = null;
  private interactionHandler: ((e: InteractionEvent) => void) | null = null;

  constructor(private config: { controlUrl: string; token: string }) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(
        `${this.config.controlUrl}?token=${this.config.token}`
      );

      this.ws.on('open', () => {
        logger.info('[ControlChannel] Connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        if (event.type === 'USER_INTERACTION' && this.interactionHandler) {
          this.interactionHandler(event.payload);
        }
      });

      this.ws.on('error', reject);
    });
  }

  async sendDirective(directive: UIDirective): Promise<void> {
    if (!this.ws) throw new Error('Not connected');

    this.ws.send(JSON.stringify({
      type: 'UI_DIRECTIVE',
      payload: directive,
    }));
  }

  async sendSkillEvent(event: SkillEvent): Promise<void> {
    if (!this.ws) throw new Error('Not connected');

    this.ws.send(JSON.stringify({
      type: 'SKILL_EVENT',
      payload: event,
    }));
  }

  onInteraction(handler: (event: InteractionEvent) => void): void {
    this.interactionHandler = handler;
  }

  async disconnect(): Promise<void> {
    this.ws?.close();
    this.ws = null;
  }
}
```

### 3.4 Module 3: Component API Gateway

**职责**: Workspace 组件 → Container 内部服务 (Jupyter/LaTeX/Prover) 的 HTTP 代理

**方案选择**:

| 方案 | 实现位置 | 优点 | 缺点 |
|------|----------|------|------|
| A: Next.js API Proxy | Host (Next.js) | 简单、复用现有 auth | 需要端口映射 |
| B: Container Gateway | Container (prismer-gateway) | 容器自包含 | 增加容器复杂度 |
| C: Direct Access | N/A | 最简单 | 暴露容器端口，安全问题 |

**推荐方案 A**: 在 Next.js 中实现代理

```typescript
// src/app/api/container/[containerId]/jupyter/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getContainerInfo } from '@/lib/container/orchestrator';

export async function GET(
  request: NextRequest,
  { params }: { params: { containerId: string; path: string[] } }
) {
  const container = await getContainerInfo(params.containerId);
  if (!container) {
    return NextResponse.json({ error: 'Container not found' }, { status: 404 });
  }

  const jupyterUrl = `http://${container.host}:${container.jupyterPort}`;
  const path = params.path.join('/');
  const token = container.jupyterToken;

  const response = await fetch(`${jupyterUrl}/${path}?token=${token}`, {
    headers: request.headers,
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

// POST, PUT, DELETE 类似
```

**Workspace 组件调用**:

```typescript
// src/components/editors/jupyter/hooks/useJupyterAPI.ts

export function useJupyterAPI() {
  const { agentInstanceId } = useWorkspaceStore();

  const executeCell = async (kernelId: string, code: string) => {
    const res = await fetch(
      `/api/container/${agentInstanceId}/jupyter/api/kernels/${kernelId}/execute`,
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      }
    );
    return res.json();
  };

  return { executeCell, /* ... */ };
}
```

### 3.5 Module 4: Workspace-Aware Skills

**职责**: 扩展 OpenClaw Skills 以支持 Workspace UI 交互

**Skill 扩展示例**:

```markdown
---
name: prismer-workspace
description: Prismer Workspace integration — send UI directives and skill events.
metadata:
  openclaw:
    emoji: "🖥️"
    category: prismer
---

# Prismer Workspace Integration

## Overview

This skill extends OpenClaw with Prismer Workspace integration capabilities.
Use it to control the Workspace UI from agent actions.

## When To Use

- After generating a notebook, open it in the Workspace
- After compiling LaTeX, show the PDF
- During multi-step tasks, update progress
- When showing search results, switch to the appropriate component

## Send UI Directive

Use the `prismer_directive` tool to send a UI directive:

\`\`\`json
{
  "tool": "prismer_directive",
  "input": {
    "type": "SWITCH_COMPONENT",
    "payload": {
      "component": "jupyter-notebook",
      "state": {
        "notebookPath": "/workspace/notebooks/analysis.ipynb"
      }
    }
  }
}
\`\`\`

## Available Directives

| Type | Payload | Description |
|------|---------|-------------|
| `SWITCH_COMPONENT` | `{ component, state? }` | 切换到指定组件 |
| `LOAD_DOCUMENT` | `{ documentId, component }` | 在组件中加载文档 |
| `UPDATE_NOTEBOOK` | `{ path, cells }` | 更新 Notebook 内容 |
| `EXECUTE_CELL` | `{ path, cellIndex }` | 执行指定 Cell |
| `UPDATE_LATEX` | `{ path, content }` | 更新 LaTeX 文件 |
| `COMPILE_LATEX` | `{ projectPath }` | 编译 LaTeX 项目 |
| `SHOW_NOTIFICATION` | `{ title, message, type }` | 显示通知 |

## Report Skill Progress

\`\`\`json
{
  "tool": "prismer_skill_event",
  "input": {
    "phase": "progress",
    "progress": 50,
    "message": "Compiling LaTeX...",
    "artifacts": [
      {
        "type": "pdf",
        "path": "/workspace/output/paper.pdf",
        "displayName": "paper.pdf",
        "componentTarget": "pdf-reader"
      }
    ]
  }
}
\`\`\`

## Example: Create and Open Notebook

\`\`\`python
# 1. Create notebook
import json
notebook = {
    "cells": [
        {"cell_type": "code", "source": "import numpy as np", ...}
    ],
    ...
}
with open("/workspace/notebooks/new.ipynb", "w") as f:
    json.dump(notebook, f)

# 2. Send directive to open in Workspace
prismer_directive({
    "type": "SWITCH_COMPONENT",
    "payload": {
        "component": "jupyter-notebook",
        "state": {
            "notebookPath": "/workspace/notebooks/new.ipynb"
        }
    }
})
\`\`\`
```

---

## 4. Data Flow Diagrams

### 4.1 User Sends Chat Message

```
┌──────────────────────────────────────────────────────────────────────────┐
│ User: "Create a notebook to analyze the dataset"                          │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ ChatPanel → IM Server WebSocket                                           │
│   { type: 'message.send', content: '...', conversationId: '...' }         │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ IM Server → Container (prismer-im plugin)                                 │
│   message.new event via WebSocket                                         │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ prismer-im → MessageHandler → AgentBridge → OpenClaw Agent                │
│   Agent receives: "Create a notebook to analyze the dataset"              │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Agent executes academic-jupyter skill:                                    │
│   1. Creates /workspace/notebooks/analysis.ipynb                          │
│   2. Sends skill_event(phase: 'complete', artifacts: [...])               │
│   3. Sends UI_DIRECTIVE(SWITCH_COMPONENT, jupyter-notebook)               │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                      prismer-im Channel → IM Server                            │
│  ┌─────────────────────────────┐    ┌───────────────────────────────────────┐ │
│  │ Chat Response:              │    │ UI_DIRECTIVE: SWITCH_COMPONENT        │ │
│  │ "I've created analysis..."  │    │ payload: { component: 'jupyter-...' } │ │
│  └─────────────────────────────┘    └───────────────────────────────────────┘ │
└───────────────────────────────────────┬───────────────────────────────────────┘
              ┌─────────────────────────┴─────────────────────┐
              │                                               │
              ▼                                               ▼
┌─────────────────────────────┐         ┌─────────────────────────────────────┐
│ ChatPanel displays message  │         │ workspaceStore.executeDirective()   │
│                             │         │ → setActiveComponent('jupyter-...')  │
│                             │         │ → JupyterNotebook loads notebook     │
└─────────────────────────────┘         └─────────────────────────────────────┘
```

### 4.2 User Executes Cell in Jupyter

```
┌──────────────────────────────────────────────────────────────────────────┐
│ User clicks "Run Cell" in JupyterNotebook component                       │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ JupyterNotebook → useJupyterAPI().executeCell()                           │
│   POST /api/container/{id}/jupyter/api/kernels/{kid}/execute              │
│   body: { code: "import pandas as pd\ndf = pd.read_csv('data.csv')" }     │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Next.js API Route proxies to Container                                    │
│   → http://container:8888/api/kernels/{kid}/execute?token=...             │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Jupyter Server executes code                                              │
│   Returns: { outputs: [...], execution_count: 1 }                         │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ JupyterNotebook displays output                                           │
│   Cell shows execution result                                             │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Configuration

### 5.1 OpenClaw Config Template

> **v0.3.0 更新**: 统一使用 prismer-im Channel，移除 prismer-control

```json
{
  "agents": {
    "defaults": {
      "workspace": "/workspace",
      "model": {
        "primary": "google/gemini-2.5-flash"
      }
    }
  },
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "0.0.0.0",
    "auth": {
      "mode": "token",
      "token": "__CONTAINER_TOKEN__"
    }
  },
  "channels": {
    "prismer-im": {
      "enabled": true,
      "accounts": {
        "default": {
          "imServerUrl": "__IM_SERVER_URL__",
          "conversationId": "__CONVERSATION_ID__",
          "agentToken": "__AGENT_TOKEN__",
          "capabilities": ["chat", "ui_directive", "skill_event"]
        }
      }
    }
  },
  "plugins": {
    "load": {
      "paths": ["/opt/openclaw/plugins/prismer-im"]
    }
  },
  "skills": {
    "prismer-workspace": {
      "enabled": true,
      "path": "/opt/openclaw/skills/prismer-workspace"
    }
  }
}
```

### 5.2 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `IM_SERVER_URL` | Prismer Cloud IM Server URL | Yes |
| `CONVERSATION_ID` | 绑定的 IM 会话 ID | Yes |
| `AGENT_TOKEN` | IM Server JWT for Agent | Yes |
| `GEMINI_API_KEY` | Google AI API key | Yes |
| `JUPYTER_TOKEN` | Jupyter Server token | Auto-generated |
| `CONTAINER_TOKEN` | OpenClaw Gateway token | Auto-generated |

---

## 6. Directory Structure

```
docker/
├── README.md                      # 本文档
├── Dockerfile                     # 容器构建
├── entrypoint.sh                  # 启动脚本
├── config/
│   └── openclaw.json              # OpenClaw 配置模板
│
├── plugin/
│   └── prismer-im/                # prismer-im Channel Plugin (Chat + Control + Events)
│       ├── index.ts               # 插件入口
│       ├── openclaw.plugin.json   # 插件元数据
│       ├── package.json
│       └── src/
│           ├── channel.ts         # ChannelPlugin 实现
│           ├── runtime.ts         # Runtime 单例
│           ├── inbound.ts         # 入站消息处理
│           ├── outbound.ts        # 出站: 消息 + UIDirective + Skill Events
│           ├── config.ts          # 配置解析
│           └── types.ts           # 类型定义
│
└── skills/
    └── prismer-workspace/         # Prismer Workspace Skill
        ├── SKILL.md               # Skill manifest (YAML front matter)
        └── tools/
            ├── prismer_directive.md      # UIDirective 工具定义
            └── prismer_skill_event.md    # Skill 事件工具定义
```

---

## 7. Implementation Plan

> **v0.3.0 更新**: 简化为三阶段实施

### Phase 1: prismer-im Channel Plugin (Week 1-2)

| Day | Task | 输出 |
|-----|------|------|
| 1 | 初始化 plugin package，定义 ChannelPlugin 接口 | `plugin/prismer-im/` |
| 2-3 | 实现 channel.ts (config, outbound, heartbeat) | `src/channel.ts` |
| 4-5 | 实现 inbound/outbound 消息处理 | `src/inbound.ts`, `src/outbound.ts` |
| 6-7 | 实现 UIDirective 发送 (扩展 outbound) | 集成测试 |
| 8-10 | 实现 Skill 事件报告 + 单元测试 | 完成 Plugin |

### Phase 2: Next.js API Proxy + Frontend (Week 3)

| Day | Task | 输出 |
|-----|------|------|
| 1-2 | Container API proxy routes | `/api/container/[id]/jupyter/*` |
| 3-4 | UIDirective 处理器 (workspaceStore) | `DirectiveExecutor` |
| 5 | 集成测试 | E2E 测试用例 |

### Phase 3: prismer-workspace Skill (Week 4)

| Day | Task | 输出 |
|-----|------|------|
| 1-2 | SKILL.md + prismer_directive 工具 | `skills/prismer-workspace/` |
| 3-4 | prismer_skill_event 工具 | 工具定义完成 |
| 5 | Docker 构建 + E2E 测试 | 可部署镜像 |

---

## 8. Success Criteria

> **v0.3.0 更新**: 简化验收标准

### prismer-im Channel Plugin
- [ ] Plugin TypeScript 编译通过
- [ ] 能连接 IM Server WebSocket
- [ ] 能接收/发送 Chat 消息
- [ ] 能发送 UIDirective 到 Workspace
- [ ] 能发送 Skill 事件到 Workspace
- [ ] Agent 心跳/状态同步正常

### Next.js API Proxy
- [ ] Jupyter API 代理正常 (`/api/container/[id]/jupyter/*`)
- [ ] LaTeX API 代理正常 (`/api/container/[id]/latex/*`)
- [ ] Prover API 代理正常 (`/api/container/[id]/prover/*`)

### prismer-workspace Skill
- [ ] SKILL.md 格式正确
- [ ] prismer_directive 工具可被 Agent 调用
- [ ] prismer_skill_event 工具可被 Agent 调用

### Module 3: API Gateway (Next.js)
- [ ] Jupyter API 代理正常
- [ ] LaTeX API 代理正常
- [ ] Prover API 代理正常
- [ ] 认证/鉴权正确

### Integration
- [ ] 用户发消息 → Agent 响应 → 显示在 ChatPanel
- [ ] Agent 创建 Notebook → Workspace 自动打开
- [ ] Agent 编译 LaTeX → PDF 显示在 pdf-reader
- [ ] 用户在 JupyterNotebook 执行 Cell → 结果显示

---

## 9. Interface Evolution Strategy

### 9.1 抽象层隔离

```
┌─────────────────────────────────────────────────────────────────┐
│                     Stable Interfaces                            │
│  IIMClient │ IControlChannel │ IComponentProxy │ ISkillBridge   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Changeable Implementations                     │
│  IMClientV1 │ ControlChannelWS │ JupyterProxy │ OpenClawSkill   │
│  IMClientV2 │ ControlChannelHTTP │ ...         │ ...            │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 版本兼容

- **Minor 变更**: 新增可选字段，实现层自动兼容
- **Breaking 变更**: 创建新实现版本 (V2, V3)，通过配置切换
- **废弃旧版**: 保留一个版本周期，标记 `@deprecated`

---

## 10. Open Questions

1. **Control Channel 部署位置**: WebSocket 连接是从容器主动连接到 Next.js，还是 Next.js 连接到容器？
   - 推荐: 容器 → Next.js (容器 IP 不固定，Next.js 更稳定)

2. **Jupyter Kernel 管理**: 多个 Workspace 共享容器时如何隔离 kernel？
   - 当前设计: 1 Workspace = 1 Container，无此问题

3. **Skill Event 持久化**: Skill 执行事件是否需要存储到数据库？
   - 可选: 存储到 Timeline 表供回放

4. **Control Channel 认证**: 如何验证控制信号来自合法容器？
   - 建议: 使用容器启动时生成的 token

---

## 11. OpenClaw 扩展边界分析

### 11.1 文档对齐分析

> **v0.3.0 更新**: 两份文档已完全对齐

| 方面 | WORKSPACE_OPENCLAW_INTEGRATION.md (v4.2) | docker/README.md (v0.3.0) |
|------|------------------------------------------|---------------------------|
| **Chat 通信** | ✅ prismer-im Channel Plugin | ✅ 统一设计 |
| **UIDirective** | ✅ Section 13 边界分析 | ✅ 详细规范 (60+ 类型) |
| **Control 通道** | ✅ 合并到 prismer-im | ✅ 合并到 prismer-im |
| **Skills** | ✅ prismer-workspace Skill | ✅ 工具定义 |
| **API Proxy** | ✅ Next.js Proxy | ✅ 相同设计 |
| **容器部署** | ✅ Dockerfile、编排 | ✅ 相同 |
| **Gateway 端口** | ✅ 18789 | ✅ 18789 |

**结论**: 两份文档已完全对齐，统一采用 prismer-im 单 Channel 架构。

### 11.2 OpenClaw 扩展体系

根据 OpenClaw 官方架构：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OpenClaw Extension Types                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    1. Channels (通信渠道)                           │ │
│  │                                                                     │ │
│  │  • 职责: 连接外部通信平台 (WhatsApp, Telegram, Slack, etc.)        │ │
│  │  • 能力: 入站消息接收、出站消息发送、会话管理                        │ │
│  │  • 接口: ChannelPlugin (config, outbound, gateway, status)          │ │
│  │  • 我们的实现: prismer-im Channel Plugin                            │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    2. Skills (技能包)                               │ │
│  │                                                                     │ │
│  │  • 职责: 定义 Agent 可用的能力和知识                                │ │
│  │  • 位置: ~/.openclaw/workspace/skills/ 或 /workspace/skills/        │ │
│  │  • 格式: SKILL.md (Markdown + YAML frontmatter)                     │ │
│  │  • 内容: 技能描述、使用说明、工具列表                               │ │
│  │  • 我们的实现: academic-latex, academic-jupyter, academic-search   │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    3. Tools (工具)                                  │ │
│  │                                                                     │ │
│  │  • 职责: Agent 可调用的具体动作                                     │ │
│  │  • 类型: First-class tools (内置) + Custom tools (Skill 定义)       │ │
│  │  • 内置: browser_control, canvas_manipulation, cron, session        │ │
│  │  • 我们的扩展: prismer_directive, prismer_skill_event               │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    4. Nodes (节点)                                  │ │
│  │                                                                     │ │
│  │  • 职责: 设备本地运行时 (macOS, iOS, Android)                       │ │
│  │  • 能力: 屏幕录制、摄像头、系统命令等设备特定操作                    │ │
│  │  • 我们的需求: ❌ 不需要 (学术研究场景无设备依赖)                    │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.3 我们的需求 vs OpenClaw 能力边界

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          需求分类与实现方案                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════   │
│  ✅ Channel Plugin 可解决 (prismer-im)                                  │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                          │
│  • Chat 消息收发 (文本、Markdown、代码)                                  │
│  • 流式响应 (stream.chunk, stream.end)                                  │
│  • Agent 心跳和状态同步                                                  │
│  • @mention 路由                                                         │
│  • 工具调用结果展示 (tool_call, tool_result 消息类型)                    │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════   │
│  ✅ Skill 可解决                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                          │
│  • 学术能力定义 (paper_search, latex_compile, jupyter_execute)          │
│  • 工具使用说明 (Agent 学习如何调用工具)                                 │
│  • 能力声明 (告诉 IM Server 这个 Agent 会什么)                          │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════   │
│  ⚠️ Tool 扩展可解决 (需自定义)                                           │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                          │
│  • prismer_directive — 发送 UIDirective 到 Workspace                    │
│  • prismer_skill_event — 报告 Skill 执行进度                            │
│                                                                          │
│  实现方式: 在 Skill 的 SKILL.md 中定义 Tool，Tool 内部通过               │
│  WebSocket/HTTP 与 Workspace 通信                                        │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════   │
│  ❌ OpenClaw 体系外 — 需容器暴露 API                                      │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                          │
│  • Jupyter API (执行 Cell、获取变量、包管理)                             │
│  • LaTeX API (编译、获取日志、SyncTeX)                                   │
│  • Prover API (Z3/Coq/Lean 证明验证)                                     │
│                                                                          │
│  原因: 这些是容器内运行的独立服务，有自己的 REST API。                   │
│  Agent 调用它们是 "使用工具"，但 Workspace 也需要直接调用它们            │
│  (例如用户手动执行 Cell)。                                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.4 最终架构决策

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         推荐实现方案                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. prismer-im Channel Plugin (一个 Channel)                             │
│     ├── 职责: Chat 消息 + UIDirective + Skill 事件                       │
│     ├── 理由: 统一 WebSocket 连接，减少复杂度                            │
│     └── 扩展 outbound 支持 directive/event 消息类型                      │
│                                                                          │
│  2. prismer-workspace Skill (一个 Skill)                                 │
│     ├── 职责: 定义 prismer_directive / prismer_skill_event 工具          │
│     ├── SKILL.md 描述如何使用这些工具                                    │
│     └── Agent 学习后可自主发送 UI 指令                                   │
│                                                                          │
│  3. Container API (Next.js Proxy)                                        │
│     ├── 职责: Workspace 组件 → 容器服务 (Jupyter/LaTeX/Prover)           │
│     ├── 路径: /api/container/[id]/jupyter/*, /api/container/[id]/latex/* │
│     └── 非 OpenClaw 体系，但必要                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.5 prismer-im Channel 扩展设计

将 UIDirective 和 Skill 事件合并到 prismer-im Channel：

```typescript
// extensions/prismer-im/src/channel.ts

export const prismerIMPlugin: ChannelPlugin<PrismerIMAccountConfig> = {
  // ... 原有配置 ...

  outbound: {
    deliveryMode: 'direct',

    // 原有: 发送文本消息
    sendText: async (ctx) => { /* ... */ },

    // 原有: 发送媒体消息
    sendMedia: async (ctx) => { /* ... */ },

    // 新增: 发送 UI 指令
    sendDirective: async (ctx: {
      account: PrismerIMAccountConfig;
      directive: UIDirective;
    }) => {
      const ws = getConnection(ctx.account);
      ws.send(JSON.stringify({
        type: 'UI_DIRECTIVE',
        payload: ctx.directive,
      }));
      return { ok: true };
    },

    // 新增: 发送 Skill 事件
    sendSkillEvent: async (ctx: {
      account: PrismerIMAccountConfig;
      event: SkillEvent;
    }) => {
      const ws = getConnection(ctx.account);
      ws.send(JSON.stringify({
        type: 'SKILL_EVENT',
        payload: ctx.event,
      }));
      return { ok: true };
    },
  },
};
```

### 11.6 prismer-workspace Skill 定义

```markdown
<!-- /workspace/skills/prismer-workspace/SKILL.md -->
---
name: prismer-workspace
emoji: 🖥️
category: Integration
description: Control Prismer Workspace UI from Agent actions
version: 1.0.0
capabilities:
  - workspace_control
  - ui_directive
tools:
  - prismer-directive   # 发送 UI 指令
  - prismer-skill-event # 报告技能进度
---

# Prismer Workspace Control

Send UI directives to control the Workspace from your actions.

## When To Use

- After creating a notebook, open it in Workspace
- After compiling LaTeX, show the PDF
- During long tasks, report progress
- When switching context, change active component

## prismer-directive Tool

Send a UI directive to the Workspace:

\`\`\`json
{
  "tool": "prismer-directive",
  "input": {
    "type": "SWITCH_COMPONENT",
    "payload": {
      "component": "jupyter-notebook",
      "state": { "notebookPath": "/workspace/analysis.ipynb" }
    }
  }
}
\`\`\`

### Available Directive Types

| Category | Type | Payload |
|----------|------|---------|
| Global | SWITCH_COMPONENT | `{ component, state? }` |
| Global | LOAD_DOCUMENT | `{ documentId, documentType, path? }` |
| Jupyter | JUPYTER_ADD_CELL | `{ type, source, execute? }` |
| Jupyter | JUPYTER_EXECUTE_CELL | `{ cellId? cellIndex? }` |
| LaTeX | LATEX_UPDATE_FILE | `{ file, content }` |
| LaTeX | LATEX_COMPILE | `{ mainFile? }` |
| PDF | PDF_NAVIGATE_TO_PAGE | `{ page }` |
| Code | CODE_LOAD_FILES | `{ files, activeFile }` |
| Code | CODE_EXECUTE | `{ command? }` |

## prismer-skill-event Tool

Report skill execution progress:

\`\`\`json
{
  "tool": "prismer-skill-event",
  "input": {
    "phase": "progress",
    "progress": 50,
    "message": "Compiling LaTeX...",
    "artifacts": [
      { "type": "pdf", "path": "/output/paper.pdf", "componentTarget": "pdf-reader" }
    ]
  }
}
\`\`\`
```

### 11.7 边界总结表

| 需求 | 实现位置 | 类型 | 备注 |
|------|---------|------|------|
| Chat 消息收发 | prismer-im | Channel Plugin | WebSocket + HTTP |
| 流式响应 | prismer-im | Channel Plugin | stream.* 事件 |
| Agent 状态 | prismer-im | Channel Plugin | heartbeat |
| UIDirective 发送 | prismer-im (扩展) | Channel Plugin | 复用连接 |
| Skill 事件 | prismer-im (扩展) | Channel Plugin | 复用连接 |
| prismer_directive 工具 | prismer-workspace | Skill | Agent 可学习使用 |
| prismer_skill_event 工具 | prismer-workspace | Skill | Agent 可学习使用 |
| 学术能力定义 | academic-* | Skill | 独立 Skill 包 |
| Jupyter API | Next.js Proxy | Container API | 非 OpenClaw 体系 |
| LaTeX API | Next.js Proxy | Container API | 非 OpenClaw 体系 |
| Prover API | Next.js Proxy | Container API | 非 OpenClaw 体系 |

---

## Next Steps

请确认以下问题后开始实现：

1. **架构对齐**: 是否同意将 UIDirective 合并到 prismer-im Channel？
2. **Skill 设计**: prismer-workspace Skill 的工具定义是否合理？
3. **API Gateway**: Next.js Proxy 方案是否可接受？
4. **优先级**: 建议顺序 prismer-im → prismer-workspace Skill → API Proxy
