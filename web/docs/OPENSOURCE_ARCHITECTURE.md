# 开源组件化架构设计

> 最大复用、最小适配 — API 路径兼容策略
> Last updated: 2026-02-27
> Status: 设计文档（Phase 5A 实现前）
> Change protocol: `docs/CONTAINER_PROTOCOL.md` Change Type V
> Related: `docs/CONTAINER_FRONTEND_FEASIBILITY.md`

## 核心思路

**不是分离代码，而是让容器模拟云端 API**。

前端代码调用 `/api/v2/im/bridge/:wsId`，无论后端是 Prismer Cloud 还是容器内 Gateway，都返回相同格式的响应。这样：

- **前端代码**: 100% 复用，零修改
- **容器 Gateway**: 扩展现有路由，模拟云端 API
- **适配工作量**: 仅在容器侧

## 架构对比

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Cloud Mode (现有)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Browser                      Prismer Cloud                   Container    │
│   ┌──────────────┐            ┌─────────────────┐            ┌───────────┐ │
│   │ workspace-ui │───────────▶│ Next.js API     │───────────▶│ Gateway   │ │
│   │ (React SPA)  │            │ /api/v2/im/...  │            │ :3000     │ │
│   │              │◀───────────│ /api/container/ │◀───────────│           │ │
│   └──────────────┘            │ /api/agents/    │            │ OpenClaw  │ │
│                               │                 │            │ Agent     │ │
│                               │ Prisma + MySQL  │            └───────────┘ │
│                               │ @prismer/sdk    │                          │
│                               └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         Local Mode (开源容器单例)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Browser                                   Container (All-in-One)          │
│   ┌──────────────┐                         ┌────────────────────────────┐  │
│   │ workspace-ui │────────────────────────▶│ Gateway :3000              │  │
│   │ (同样的代码) │                         │                            │  │
│   │              │◀────────────────────────│ 路由 (兼容云端):            │  │
│   └──────────────┘                         │ /api/v2/im/bridge/* → 本地 │  │
│         │                                  │ /api/container/*   → 本地  │  │
│         │ 相同的 API 调用                   │ /api/agents/*      → 本地  │  │
│         │ 相同的响应格式                    │ /api/v1/jupyter    → :8888│  │
│         ▼                                  │ /api/v1/latex      → :8080│  │
│   零代码修改                                │                            │  │
│                                            │ SQLite + OpenClaw Agent    │  │
│                                            └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API 兼容层设计

### 前端调用的 API 端点 (完整清单)

前端实际调用 ~40 个端点。按 Local 模式处理策略分为 4 类：

#### Tier 1 — 必须兼容（核心功能，8 端点）

| 端点 | Cloud 实现 | Local 实现 | 响应格式 |
|------|-----------|-----------|---------|
| `GET /api/v2/im/bridge/:wsId` | Bridge API + Prisma | Gateway 本地处理 | `{ ok, data: { status, gatewayUrl } }` |
| `POST /api/v2/im/bridge/:wsId` | Bridge API → Container | Gateway → Agent | `{ ok, data: { response, directives } }` |
| `GET /api/v2/im/bridge/:wsId?include=messages` | IM Database | SQLite | `{ ok, data: { messages: [...] } }` |
| `GET /api/agents/:id/health` | Agent Instance 查询 | 固定返回 healthy | `{ status: 'running' }` |
| `GET /api/agents/:id/directive/stream` | SSE directive stream | Gateway SSE 推送 | `text/event-stream` |
| `GET /api/workspace/:id/agent` | Prisma 查询 | 固定返回 local-agent | `{ success, data: { agent } }` |
| `GET /api/container/:agentId/jupyter/*` | Proxy to Container | 直接 Proxy :8888 | Jupyter API |
| `GET /api/container/:agentId/latex/*` | Proxy to Container | 直接 Proxy :8080 | LaTeX API |

#### Tier 2 — 建议兼容（增强体验，7 端点）

| 端点 | Cloud 实现 | Local 实现 |
|------|-----------|-----------|
| `PUT /api/workspace/:id/notes` | Prisma upsert | SQLite 保存 |
| `GET/PATCH /api/workspace/:id/component-states` | Prisma CRUD | SQLite 保存 |
| `GET /api/workspace/:id/context` | Prisma 聚合 | SQLite 聚合 |
| `POST /api/workspace/:id/files/sync-to-container` | Docker exec cp | 本地文件操作 |
| `POST /api/workspace/:id/latex-compile` | Proxy to container | 直接 Proxy :8080 |

#### Tier 3 — 可简化/Stub（非核心功能）

| 端点 | Local 策略 |
|------|-----------|
| `POST /api/agents/:id/start` | 返回 already-running（容器自启动） |
| `POST /api/agents/:id/stop` | 返回 not-supported（容器外部管理） |
| `GET /api/agents/:id/logs` | 读取容器 stdout 日志 |
| `POST /api/workspace/:id/agent/ensure` | 返回固定 local-agent |
| `GET /api/workspace/:id/messages` | SQLite 查询（复用 bridge history） |
| `GET /api/workspace/:id/timeline` | SQLite 或空 |
| `GET /api/workspace/:id/tasks` | SQLite 或空 |
| `GET /api/workspace/:id/snapshots` | 不实现（返回空） |

#### Tier 4 — 不需要（Cloud 专属功能）

| 端点 | 原因 |
|------|------|
| `POST /api/v2/im/register` | Cloud IM 注册 |
| `POST /api/v2/im/workspace/:wsId` | Cloud IM workspace binding |
| `GET /api/workspace/:id/participants` | 单用户模式无需 |
| `GET /api/workspace/:id/collection` | Cloud 资产管理 |
| `GET /api/workspace/:id/materials` | Cloud 资产管理 |

### Gateway 扩展方案

在现有 `container-gateway.mjs` 基础上新增路由：

```javascript
// ── Cloud-Compatible API Routes ────────────────────────────

// 兼容 /api/v2/im/bridge/:wsId (Chat API)
if (path.match(/^\/api\/v2\/im\/bridge\/[\w-]+$/)) {
  if (req.method === 'GET') {
    return handleBridgeStatus(req, res, path);
  }
  if (req.method === 'POST') {
    return handleBridgeChat(req, res, path);
  }
}

// 兼容 /api/container/:agentId/* (Service Proxy)
if (path.match(/^\/api\/container\/[\w-]+\/(jupyter|latex|gateway)\//)) {
  const service = path.match(/\/(jupyter|latex|gateway)\//)[1];
  const rest = path.replace(/^\/api\/container\/[\w-]+\/\w+/, '');
  return proxyRequest(req, res, service, rest);
}

// 兼容 /api/agents/:id/* (Agent Management)
if (path.match(/^\/api\/agents\/[\w-]+/)) {
  return handleAgentAPI(req, res, path);
}
```

### 本地处理函数

```javascript
// ── Chat Bridge (Local Implementation) ─────────────────────

async function handleBridgeStatus(req, res, path) {
  // 单例模式：固定返回 connected
  sendJSON(res, 200, {
    ok: true,
    data: {
      status: 'connected',
      workspaceId: 'local',
      gatewayUrl: 'http://localhost:3000',
      conversationId: 'local-conversation',
    },
  });
}

async function handleBridgeChat(req, res, path) {
  // 1. 读取请求体
  const body = await readBody(req);
  const { content, senderId, senderName } = JSON.parse(body);

  // 2. 存储用户消息到 SQLite
  const userMsgId = saveMessage({
    role: 'user',
    content,
    senderId,
    senderName,
  });

  // 3. 调用 OpenClaw Agent
  const agentResponse = await callOpenClawAgent(content);

  // 4. 存储 Agent 响应
  const agentMsgId = saveMessage({
    role: 'agent',
    content: agentResponse.text,
  });

  // 5. 读取 Directives (从 /workspace/.openclaw/directives/)
  const directives = readAndClearDirectives();

  // 6. 返回与 Cloud 相同格式的响应
  sendJSON(res, 200, {
    ok: true,
    data: {
      response: agentResponse.text,
      directives,
      workspaceId: 'local',
      gatewayUrl: 'http://localhost:3000',
    },
  });
}

async function handleBridgeHistory(req, res, path) {
  const messages = getMessagesFromDB();
  sendJSON(res, 200, {
    ok: true,
    data: {
      status: 'connected',
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        type: 'text',
        senderId: m.role === 'user' ? 'user-1' : 'agent-1',
        createdAt: m.created_at,
        sender: {
          id: m.role === 'user' ? 'user-1' : 'agent-1',
          displayName: m.role === 'user' ? 'User' : 'Agent',
          role: m.role === 'user' ? 'human' : 'agent',
        },
      })),
    },
  });
}

// ── Agent API (Local Implementation) ───────────────────────

function handleAgentAPI(req, res, path) {
  // /api/agents/:id/health
  if (path.endsWith('/health')) {
    return sendJSON(res, 200, { status: 'running', healthy: true });
  }

  // /api/agents/:id/status
  if (path.endsWith('/status')) {
    return sendJSON(res, 200, {
      id: 'local-agent',
      status: 'running',
      gatewayUrl: 'http://localhost:3000',
    });
  }

  // 其他 Agent API 返回模拟数据
  sendJSON(res, 200, { ok: true });
}
```

## NPM 包结构 (最简方案)

> ⚠️ 以下为 Phase 5A 设计方案，尚未实现。

只需要 **2 个包**：

### 1. @prismer/workspace-ui 📋

从现有代码提取，**零修改**直接打包：

```
@prismer/workspace-ui/
├── package.json
├── src/
│   ├── components/           # 从 src/app/workspace/components/ 复制
│   ├── stores/               # 从 src/app/workspace/stores/ 复制
│   ├── hooks/                # 从 src/app/workspace/hooks/ 复制
│   ├── editors/              # 从 src/components/editors/previews/ 复制
│   └── types/                # 从 src/types/ 复制
├── vite.config.ts            # Vite 构建配置
└── dist/                     # 构建输出 → 容器 /app/frontend/
```

**关键**: 这个包在 Cloud 和 Local 模式下都使用相同的代码。

### 2. @prismer/container-gateway 📋

扩展现有 `container-gateway.mjs` (当前 v1.1.0)：

```
@prismer/container-gateway/
├── package.json
├── src/
│   ├── index.mjs             # 主入口 (扩展自 container-gateway.mjs)
│   ├── routes/
│   │   ├── bridge.mjs        # /api/v2/im/bridge/* 处理
│   │   ├── container.mjs     # /api/container/* 代理
│   │   └── agents.mjs        # /api/agents/* 处理
│   ├── db/
│   │   ├── sqlite.mjs        # SQLite 操作
│   │   └── schema.sql        # 消息/状态表
│   ├── agent/
│   │   └── openclaw.mjs      # OpenClaw Agent 调用
│   └── lib/
│       ├── static.mjs        # 静态文件服务
│       └── sse.mjs           # SSE 推送 (可选)
└── dist/
```

## 数据库 Schema (容器内 SQLite)

```sql
-- 最小化 schema，字段与 Cloud 响应格式对齐
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  role TEXT NOT NULL,              -- 'user' | 'agent'
  sender_id TEXT,
  sender_name TEXT,
  metadata TEXT,                   -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,             -- JSON
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE directives (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,           -- JSON
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_created ON messages(created_at);
```

## prismer-workspace Plugin 适配

现有 `prismer-workspace` plugin 的 `sendUIDirective()` 调用：

```typescript
// 当前实现 (docker/plugin/prismer-workspace/src/tools.ts:303-335)
const result = await fetch(`${config.apiBaseUrl}/api/agents/${config.agentId}/directive`, ...);
```

**Local 模式适配**：Gateway 增加 `/api/agents/:id/directive` 端点：

```javascript
// Gateway 处理
if (path.match(/^\/api\/agents\/[\w-]+\/directive$/) && req.method === 'POST') {
  const body = await readBody(req);
  const directive = JSON.parse(body);

  // 写入 directives 表或文件
  saveDirective(directive);

  sendJSON(res, 200, { ok: true });
}
```

这样 `prismer-workspace` plugin **零修改**即可工作。

## prismer-im Plugin 处理

Local 模式**不需要** `prismer-im` plugin，因为：

1. Cloud 模式: `prismer-im` 连接 Cloud IM Server
2. Local 模式: Gateway 直接处理 Chat，无需 IM 中间层

在 OpenClaw 配置中，Local 模式只加载 `prismer-workspace`：

```json
{
  "plugins": {
    "entries": {
      "prismer-workspace": { "enabled": true }
    }
  },
  "channels": {
    // Local 模式不配置 prismer-im
  }
}
```

Agent 响应通过 OpenClaw 的标准输出机制返回，Gateway 捕获并转换为 Chat 响应。

## 工作量估算

| 任务 | 工作量 | 说明 |
|------|--------|------|
| workspace-ui 打包 | 3天 | 提取代码 + Vite 配置 + 路径别名处理 |
| Gateway Tier 1 API | 4天 | Bridge (chat + history + SSE), Agent (health + directive stream), Container proxy, Workspace agent |
| Gateway Tier 2 API | 2天 | Notes auto-save, Component states, Context API, File sync, LaTeX compile |
| Gateway Tier 3 Stubs | 1天 | Agent start/stop/logs, Tasks/Timeline/Snapshots stubs |
| SQLite 集成 | 2天 | 消息/状态/组件状态/directive 持久化 |
| OpenClaw 调用集成 | 2天 | Agent 调用 + 响应解析 |
| 静态文件服务 | 0.5天 | 服务 workspace-ui 构建产物 |
| 测试 + 调试 | 2天 | 现有 L1/L2 测试跑双模式 |
| **总计** | **~3 周** | |

## 当前组件版本基线 (v5.0)

> SSoT: `src/lib/container/version.ts` + `docker/compatibility.json`

开源容器基于当前 Cloud 版的组件集。以下是各组件的当前版本和 Local 模式适配状态：

| 组件 | 当前版本 | SSoT 文件 | Local 模式 |
|------|---------|-----------|-----------|
| Container Image | v5.0-openclaw | `src/lib/container/version.ts` | 基础镜像，直接使用 |
| Base Image | v5.0 (ClawBase Academic) | `docker/Dockerfile.openclaw` ARG | 不变 |
| prismer-workspace | 0.5.0 | `docker/plugin/prismer-workspace/version.ts` | ✅ 零修改可工作 |
| prismer-im | 0.2.0 | `docker/plugin/prismer-im/version.ts` | ❌ 不加载（Local 无需 IM） |
| container-gateway | 1.1.0 | `docker/gateway/version.mjs` | 🔧 需扩展 API 兼容路由 |
| prismer-tools | 0.1.0 | `docker/scripts/prismer-tools/version.py` | ✅ 不变 |
| @prismer/sdk | ^1.7.0 | `package.json` | ❌ Cloud 专用，Local 不使用 |
| @prismer/workspace-ui | — | (Phase 5A 提取) | 📋 待实现 |

### Cloud SDK 在 Local 模式中的角色

**`@prismer/sdk` 仅用于 Cloud 模式**。Local 模式的等价实现：

| Cloud SDK API | Cloud 模式 | Local 模式替代 |
|---------------|-----------|--------------|
| `im.direct.send()` | 连接 Prismer IM Server | Gateway Bridge API (HTTP) |
| `im.realtime.connectWS()` | WebSocket to Cloud | 不需要（Gateway 直接代理） |
| `context.load()` | Cloud HQCC 缓存 | 容器本地 `/workspace/` 文件 |
| `parsePdf()` | Cloud Parse API | 容器内 Jupyter + arxiv-server |

### prismer-workspace 插件兼容性

prismer-workspace v0.5.0 使用 OpenClaw `registerTool()` API 注册 26 个工具。其 `sendUIDirective()` 调用：

```typescript
// 当前实现 — 通过 HTTP 调用 Next.js API (Cloud) 或 Gateway (Local)
await fetch(`${config.apiBaseUrl}/api/agents/${config.agentId}/directive`, ...);
```

**Local 模式**：Gateway 增加 `/api/agents/:id/directive` 端点即可，插件代码**零修改**。

`openclaw.plugin.json` configSchema 接受三个字段：
- `apiBaseUrl` — Next.js API 或 Gateway URL
- `agentId` — Agent 实例 ID
- `workspaceId` — 工作空间会话 ID

## 版本兼容策略

当 Cloud 版 API 变化时：

1. **前端代码** 随 Cloud 版更新
2. **Gateway** 同步更新兼容层，保持响应格式一致
3. **测试**: 同一份 E2E 测试跑两个模式

```typescript
// E2E 测试示例
describe('Workspace Chat', () => {
  const baseUrl = process.env.MODE === 'local'
    ? 'http://localhost:3000'
    : 'https://prismer.cloud';

  it('should send message and get response', async () => {
    // 相同的测试代码，不同的 baseUrl
    const res = await fetch(`${baseUrl}/api/v2/im/bridge/test-ws`, {
      method: 'POST',
      body: JSON.stringify({ content: 'Hello' }),
    });
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.data.response).toBeDefined();
  });
});
```

## 开发流程

1. **Cloud 版开发**: 正常在 `src/app/` 中开发
2. **打包 UI**: `npm run build:workspace-ui` 输出到 `packages/workspace-ui/dist/`
3. **更新 Gateway**: 如果 API 格式变化，同步更新 `container-gateway`
4. **构建容器**: Docker build 包含 UI + Gateway

```dockerfile
# Dockerfile (简化)
FROM node:20-alpine

# 复制 UI 构建产物
COPY packages/workspace-ui/dist /app/frontend

# 复制 Gateway
COPY docker/gateway /app/gateway

# 复制 OpenClaw 配置和 plugins
COPY docker/config /home/user/.openclaw
COPY docker/plugin /home/user/.openclaw/plugins

EXPOSE 3000
CMD ["node", "/app/gateway/index.mjs"]
```

## 总结

| 方面 | 策略 |
|------|------|
| 前端代码 | 100% 复用，零修改 |
| API 兼容 | Gateway 模拟 Cloud API — Tier 1 (8 核心) + Tier 2 (7 增强) + Tier 3 (8 stub) |
| 插件 | prismer-workspace v0.5.0 (26 tools) 零修改，prismer-im 不需要 |
| 数据库 | SQLite 替代 Prisma/MySQL（消息、组件状态、directive、notes） |
| 测试验证 | 现有四层测试 (59+ tests) 跑双模式 |
| 工作量 | ~3 周 (Gateway 扩展 + Tier 2 增强) |
| 维护成本 | API 变化时同步更新 Gateway，合约测试自动检测 |

这个方案的核心优势：**一套前端代码，两种部署模式**。

## 实现状态概览

| 模块 | 状态 | 说明 |
|------|------|------|
| Container Image (v5.0) | ✅ 已就绪 | 基础镜像含所有服务 |
| container-gateway (v1.1.0) | ✅ 已有基础 | 需扩展 Cloud API 兼容路由 |
| prismer-workspace plugin (v0.5.0) | ✅ 零修改 | 26 tools, `registerTool()` API |
| Bridge API (`/api/v2/im/bridge/*`) | ✅ Cloud 侧已实现 | Gateway 需实现 Local 等价 |
| 前端 Directive Pipeline | ✅ 已验证 | 四层测试 59+ tests 通过 (Unit + L1:21 + L2:32 + L3:6) |
| @prismer/workspace-ui 包 | 📋 未开始 | Phase 5A.1: 提取 + Vite 构建 |
| Gateway API 兼容层 | 📋 未开始 | Phase 5A.2: 模拟 Cloud API |
| SQLite 集成 | 📋 未开始 | Phase 5A.2: 消息/状态持久化 |
| SPA 静态文件服务 | 📋 未开始 | Phase 5A.3: Gateway 托管 |
| E2E 双模式测试 | 📋 未开始 | Phase 5A.3: 同一测试跑两种模式 |

### 进入 Phase 5A 的前置条件

1. ✅ Container image v5.0 构建并验证
2. ✅ prismer-workspace 插件 v0.5.0 稳定（26 tools, configSchema 已修复）
3. ✅ Bridge API 完整实现（chat + status + history + diagnostics）
4. ✅ 四层测试全绿 — Unit + L1 (21) + L2 (32) + L3 (6) = 59+ tests（directive pipeline 验证）
5. ✅ 版本管理体系建立（SSoT → compatibility → manifest → protocol）
6. ✅ 文档对齐（2026-02-27: 版本号、测试体系、API 端点清单完整对齐）

### 参考文档

- `docs/CONTAINER_PROTOCOL.md` — Change Type V 定义了开源前端的变更清单
- `docs/CONTAINER_FRONTEND_FEASIBILITY.md` — 可行性分析（Module inventory: 63 files, ~7,100 lines）
- `docker/VERSIONS.md` — 组件版本追踪表
- `docker/compatibility.json` — 机器可读的版本兼容矩阵
