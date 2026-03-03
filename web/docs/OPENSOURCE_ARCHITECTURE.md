# Open-Source Componentized Architecture Design

> Maximum reuse, minimum adaptation — API path compatibility strategy
> Last updated: 2026-02-27
> Status: Design document (before Phase 5A implementation)
> Change protocol: `docs/CONTAINER_PROTOCOL.md` Change Type V
> Related: `docs/CONTAINER_FRONTEND_FEASIBILITY.md`

## Core Concept

**Not about separating code, but making the container simulate the cloud API**.

The frontend code calls `/api/v2/im/bridge/:wsId`, and whether the backend is a Next.js API or the in-container Gateway, it returns responses in the same format. This way:

- **Frontend code**: 100% reuse, zero modifications
- **Container Gateway**: Extends existing routes, simulates Next.js API
- **Adaptation effort**: Only on the container side

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Local Mode (Open-source container singleton)         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Browser                                   Container (All-in-One)          │
│   ┌──────────────┐                         ┌────────────────────────────┐  │
│   │ workspace-ui │────────────────────────▶│ Gateway :3000              │  │
│   │ (same code)  │                         │                            │  │
│   │              │◀────────────────────────│ Routes (cloud-compatible): │  │
│   └──────────────┘                         │ /api/v2/im/bridge/* → local│  │
│         │                                  │ /api/container/*   → local │  │
│         │ Same API calls                   │ /api/agents/*      → local │  │
│         │ Same response format             │ /api/v1/jupyter    → :8888│  │
│         ▼                                  │ /api/v1/latex      → :8080│  │
│   Zero code changes                        │                            │  │
│                                            │ SQLite + OpenClaw Agent    │  │
│                                            └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Compatibility Layer Design

### API Endpoints Called by Frontend (Complete List)

The frontend actually calls ~40 endpoints. They are divided into 4 tiers by Local mode handling strategy:

#### Tier 1 — Must Be Compatible (Core Functionality, 8 Endpoints)

| Endpoint | Cloud Implementation | Local Implementation | Response Format |
|----------|---------------------|---------------------|----------------|
| `GET /api/v2/im/bridge/:wsId` | Bridge API + Prisma | Gateway local handling | `{ ok, data: { status, gatewayUrl } }` |
| `POST /api/v2/im/bridge/:wsId` | Bridge API → Container | Gateway → Agent | `{ ok, data: { response, directives } }` |
| `GET /api/v2/im/bridge/:wsId?include=messages` | IM Database | SQLite | `{ ok, data: { messages: [...] } }` |
| `GET /api/agents/:id/health` | Agent Instance query | Fixed return healthy | `{ status: 'running' }` |
| `GET /api/agents/:id/directive/stream` | SSE directive stream | Gateway SSE push | `text/event-stream` |
| `GET /api/workspace/:id/agent` | Prisma query | Fixed return local-agent | `{ success, data: { agent } }` |
| `GET /api/container/:agentId/jupyter/*` | Proxy to Container | Direct Proxy :8888 | Jupyter API |
| `GET /api/container/:agentId/latex/*` | Proxy to Container | Direct Proxy :8080 | LaTeX API |

#### Tier 2 — Recommended Compatible (Enhanced Experience, 7 Endpoints)

| Endpoint | Cloud Implementation | Local Implementation |
|----------|---------------------|---------------------|
| `PUT /api/workspace/:id/notes` | Prisma upsert | SQLite save |
| `GET/PATCH /api/workspace/:id/component-states` | Prisma CRUD | SQLite save |
| `GET /api/workspace/:id/context` | Prisma aggregation | SQLite aggregation |
| `POST /api/workspace/:id/files/sync-to-container` | Docker exec cp | Local file operations |
| `POST /api/workspace/:id/latex-compile` | Proxy to container | Direct Proxy :8080 |

#### Tier 3 — Can Be Simplified/Stubbed (Non-core Functionality)

| Endpoint | Local Strategy |
|----------|---------------|
| `POST /api/agents/:id/start` | Return already-running (container auto-starts) |
| `POST /api/agents/:id/stop` | Return not-supported (container externally managed) |
| `GET /api/agents/:id/logs` | Read container stdout logs |
| `POST /api/workspace/:id/agent/ensure` | Return fixed local-agent |
| `GET /api/workspace/:id/messages` | SQLite query (reuse bridge history) |
| `GET /api/workspace/:id/timeline` | SQLite or empty |
| `GET /api/workspace/:id/tasks` | SQLite or empty |
| `GET /api/workspace/:id/snapshots` | Not implemented (return empty) |

#### Tier 4 — Not Needed (Cloud-exclusive Functionality)

| Endpoint | Reason |
|----------|--------|
| `POST /api/v2/im/register` | Cloud IM registration |
| `POST /api/v2/im/workspace/:wsId` | Cloud IM workspace binding |
| `GET /api/workspace/:id/participants` | Not needed in single-user mode |
| `GET /api/workspace/:id/collection` | Cloud asset management |
| `GET /api/workspace/:id/materials` | Cloud asset management |

### Gateway Extension Plan

Add new routes on top of the existing `container-gateway.mjs`:

```javascript
// ── Cloud-Compatible API Routes ────────────────────────────

// Compatible with /api/v2/im/bridge/:wsId (Chat API)
if (path.match(/^\/api\/v2\/im\/bridge\/[\w-]+$/)) {
  if (req.method === 'GET') {
    return handleBridgeStatus(req, res, path);
  }
  if (req.method === 'POST') {
    return handleBridgeChat(req, res, path);
  }
}

// Compatible with /api/container/:agentId/* (Service Proxy)
if (path.match(/^\/api\/container\/[\w-]+\/(jupyter|latex|gateway)\//)) {
  const service = path.match(/\/(jupyter|latex|gateway)\//)[1];
  const rest = path.replace(/^\/api\/container\/[\w-]+\/\w+/, '');
  return proxyRequest(req, res, service, rest);
}

// Compatible with /api/agents/:id/* (Agent Management)
if (path.match(/^\/api\/agents\/[\w-]+/)) {
  return handleAgentAPI(req, res, path);
}
```

### Local Handler Functions

```javascript
// ── Chat Bridge (Local Implementation) ─────────────────────

async function handleBridgeStatus(req, res, path) {
  // Singleton mode: fixed return connected
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
  // 1. Read request body
  const body = await readBody(req);
  const { content, senderId, senderName } = JSON.parse(body);

  // 2. Store user message to SQLite
  const userMsgId = saveMessage({
    role: 'user',
    content,
    senderId,
    senderName,
  });

  // 3. Call OpenClaw Agent
  const agentResponse = await callOpenClawAgent(content);

  // 4. Store Agent response
  const agentMsgId = saveMessage({
    role: 'agent',
    content: agentResponse.text,
  });

  // 5. Read Directives (from /workspace/.openclaw/directives/)
  const directives = readAndClearDirectives();

  // 6. Return response in the same format as Cloud
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

  // Other Agent APIs return mock data
  sendJSON(res, 200, { ok: true });
}
```

## NPM Package Structure (Minimal Approach)

> Warning: The following is a Phase 5A design plan, not yet implemented.

Only **2 packages** are needed:

### 1. @prismer/workspace-ui

Extracted from existing code, packaged **with zero modifications**:

```
@prismer/workspace-ui/
├── package.json
├── src/
│   ├── components/           # Copied from src/app/workspace/components/
│   ├── stores/               # Copied from src/app/workspace/stores/
│   ├── hooks/                # Copied from src/app/workspace/hooks/
│   ├── editors/              # Copied from src/components/editors/previews/
│   └── types/                # Copied from src/types/
├── vite.config.ts            # Vite build configuration
└── dist/                     # Build output → container /app/frontend/
```

**Key point**: This package uses the same code in both Cloud and Local modes.

### 2. @prismer/container-gateway

Extends the existing `container-gateway.mjs` (currently v1.1.0):

```
@prismer/container-gateway/
├── package.json
├── src/
│   ├── index.mjs             # Main entry (extended from container-gateway.mjs)
│   ├── routes/
│   │   ├── bridge.mjs        # /api/v2/im/bridge/* handling
│   │   ├── container.mjs     # /api/container/* proxy
│   │   └── agents.mjs        # /api/agents/* handling
│   ├── db/
│   │   ├── sqlite.mjs        # SQLite operations
│   │   └── schema.sql        # Message/state tables
│   ├── agent/
│   │   └── openclaw.mjs      # OpenClaw Agent invocation
│   └── lib/
│       ├── static.mjs        # Static file serving
│       └── sse.mjs           # SSE push (optional)
└── dist/
```

## Database Schema (In-container SQLite)

```sql
-- Minimal schema, fields aligned with Cloud response format
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

## prismer-workspace Plugin Adaptation

The existing `prismer-workspace` plugin's `sendUIDirective()` call:

```typescript
// Current implementation (docker/plugin/prismer-workspace/src/tools.ts:303-335)
const result = await fetch(`${config.apiBaseUrl}/api/agents/${config.agentId}/directive`, ...);
```

**Local mode adaptation**: Gateway adds `/api/agents/:id/directive` endpoint:

```javascript
// Gateway handling
if (path.match(/^\/api\/agents\/[\w-]+\/directive$/) && req.method === 'POST') {
  const body = await readBody(req);
  const directive = JSON.parse(body);

  // Write to directives table or file
  saveDirective(directive);

  sendJSON(res, 200, { ok: true });
}
```

This way the `prismer-workspace` plugin works **with zero modifications**.

## prismer-im Plugin Handling

Local mode **does not need** the `prismer-im` plugin, because:

1. Cloud mode: `prismer-im` connects to Cloud IM Server
2. Local mode: Gateway handles Chat directly, no IM middle layer needed

In the OpenClaw configuration, Local mode only loads `prismer-workspace`:

```json
{
  "plugins": {
    "entries": {
      "prismer-workspace": { "enabled": true }
    }
  },
  "channels": {
    // Local mode does not configure prismer-im
  }
}
```

Agent responses are returned through OpenClaw's standard output mechanism, and the Gateway captures and converts them into Chat responses.

## Effort Estimation

| Task | Effort | Description |
|------|--------|-------------|
| workspace-ui packaging | 3 days | Extract code + Vite config + path alias handling |
| Gateway Tier 1 API | 4 days | Bridge (chat + history + SSE), Agent (health + directive stream), Container proxy, Workspace agent |
| Gateway Tier 2 API | 2 days | Notes auto-save, Component states, Context API, File sync, LaTeX compile |
| Gateway Tier 3 Stubs | 1 day | Agent start/stop/logs, Tasks/Timeline/Snapshots stubs |
| SQLite integration | 2 days | Message/state/component state/directive persistence |
| OpenClaw invocation integration | 2 days | Agent invocation + response parsing |
| Static file serving | 0.5 day | Serve workspace-ui build artifacts |
| Testing + debugging | 2 days | Run existing L1/L2 tests in dual mode |
| **Total** | **~3 weeks** | |

## Current Component Version Baseline (v5.0)

> SSoT: `src/lib/container/version.ts` + `docker/compatibility.json`

The open-source container is based on the current Cloud version's component set. Below is the current version and Local mode adaptation status of each component:

| Component | Current Version | SSoT File | Local Mode |
|-----------|----------------|-----------|-----------|
| Container Image | v5.0-openclaw | `src/lib/container/version.ts` | Base image, used directly |
| Base Image | v5.0 (ClawBase Academic) | `docker/Dockerfile.openclaw` ARG | Unchanged |
| prismer-workspace | 0.5.0 | `docker/plugin/prismer-workspace/version.ts` | Zero modifications, works as-is |
| prismer-im | 0.2.0 | `docker/plugin/prismer-im/version.ts` | Not loaded (Local does not need IM) |
| container-gateway | 1.1.0 | `docker/gateway/version.mjs` | Needs API compatibility route extensions |
| prismer-tools | 0.1.0 | `docker/scripts/prismer-tools/version.py` | Unchanged |
| @prismer/sdk | ^1.7.0 | `package.json` | Cloud-only, not used in Local |
| @prismer/workspace-ui | — | (Phase 5A extraction) | To be implemented |

### Cloud SDK's Role in Local Mode

**`@prismer/sdk` is only for Cloud mode**. Local mode equivalents:

| Cloud SDK API | Cloud Mode | Local Mode Replacement |
|---------------|-----------|----------------------|
| `im.direct.send()` | Connect to Prismer IM Server | Gateway Bridge API (HTTP) |
| `im.realtime.connectWS()` | WebSocket to Cloud | Not needed (Gateway proxies directly) |
| `context.load()` | Cloud HQCC cache | Container local `/workspace/` files |
| `parsePdf()` | Cloud Parse API | In-container Jupyter + arxiv-server |

### prismer-workspace Plugin Compatibility

prismer-workspace v0.5.0 uses the OpenClaw `registerTool()` API to register 26 tools. Its `sendUIDirective()` call:

```typescript
// Current implementation — calls Next.js API (Cloud) or Gateway (Local) via HTTP
await fetch(`${config.apiBaseUrl}/api/agents/${config.agentId}/directive`, ...);
```

**Local mode**: Gateway adds the `/api/agents/:id/directive` endpoint, and the plugin code requires **zero modifications**.

`openclaw.plugin.json` configSchema accepts three fields:
- `apiBaseUrl` — Next.js API or Gateway URL
- `agentId` — Agent instance ID
- `workspaceId` — Workspace session ID

## Version Compatibility Strategy

When the Cloud version API changes:

1. **Frontend code** updates along with the Cloud version
2. **Gateway** synchronously updates the compatibility layer to maintain consistent response formats
3. **Testing**: The same E2E tests run in both modes

```typescript
// E2E test example
describe('Workspace Chat', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  it('should send message and get response', async () => {
    // Same test code, different baseUrl
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

## Development Workflow

1. **Cloud version development**: Develop normally in `src/app/`
2. **Package UI**: `npm run build:workspace-ui` outputs to `packages/workspace-ui/dist/`
3. **Update Gateway**: If API format changes, synchronously update `container-gateway`
4. **Build container**: Docker build includes UI + Gateway

```dockerfile
# Dockerfile (simplified)
FROM node:20-alpine

# Copy UI build artifacts
COPY packages/workspace-ui/dist /app/frontend

# Copy Gateway
COPY docker/gateway /app/gateway

# Copy OpenClaw config and plugins
COPY docker/config /home/user/.openclaw
COPY docker/plugin /home/user/.openclaw/plugins

EXPOSE 3000
CMD ["node", "/app/gateway/index.mjs"]
```

## Summary

| Aspect | Strategy |
|--------|----------|
| Frontend code | 100% reuse, zero modifications |
| API compatibility | Gateway simulates Next.js API — Tier 1 (8 core) + Tier 2 (7 enhanced) + Tier 3 (8 stub) |
| Plugins | prismer-workspace v0.5.0 (26 tools) zero modifications, prismer-im not needed |
| Database | SQLite replaces Prisma/MySQL (messages, component states, directives, notes) |
| Test verification | Existing four-layer tests (59+ tests) run in dual mode |
| Effort | ~3 weeks (Gateway extension + Tier 2 enhancements) |
| Maintenance cost | Synchronously update Gateway when API changes, contract tests auto-detect |

The core advantage of this approach: **one set of frontend code, two deployment modes**.

## Implementation Status Overview

| Module | Status | Description |
|--------|--------|-------------|
| Container Image (v5.0) | Ready | Base image contains all services |
| container-gateway (v1.1.0) | Foundation exists | Needs Cloud API compatibility route extensions |
| prismer-workspace plugin (v0.5.0) | Zero modifications | 26 tools, `registerTool()` API |
| Bridge API (`/api/v2/im/bridge/*`) | Next.js side implemented | Gateway needs to implement Local equivalent |
| Frontend Directive Pipeline | Verified | Four-layer tests 59+ tests passed (Unit + L1:21 + L2:32 + L3:6) |
| @prismer/workspace-ui package | Not started | Phase 5A.1: Extraction + Vite build |
| Gateway API compatibility layer | Not started | Phase 5A.2: Simulate Next.js API |
| SQLite integration | Not started | Phase 5A.2: Message/state persistence |
| SPA static file serving | Not started | Phase 5A.3: Gateway hosting |
| E2E dual-mode testing | Not started | Phase 5A.3: Same tests run in both modes |

### Prerequisites for Entering Phase 5A

1. Container image v5.0 built and verified
2. prismer-workspace plugin v0.5.0 stable (26 tools, configSchema fixed)
3. Bridge API fully implemented (chat + status + history + diagnostics)
4. Four-layer tests all green — Unit + L1 (21) + L2 (32) + L3 (6) = 59+ tests (directive pipeline verified)
5. Version management system established (SSoT -> compatibility -> manifest -> protocol)
6. Documentation aligned (2026-02-27: version numbers, test system, API endpoint list fully aligned)

### Reference Documents

- `docs/CONTAINER_PROTOCOL.md` — Change Type V defines the change checklist for the open-source frontend
- `docs/CONTAINER_FRONTEND_FEASIBILITY.md` — Feasibility analysis (Module inventory: 63 files, ~7,100 lines)
- `docker/VERSIONS.md` — Component version tracking table
- `docker/compatibility.json` — Machine-readable version compatibility matrix
