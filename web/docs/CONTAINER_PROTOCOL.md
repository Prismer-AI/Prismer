# Container Change Protocol

> Prevents frontend-container integration breakage by defining checklists for every type of container-related change.

**Why this exists**: Container integration spans 6 layers (Dockerfile, config, templates, proxy routes, frontend guards, docs). Missing any one causes silent failures — e.g., Jupyter 503 (missing status gate), Identity not working (config override), image tag drift (v4.2 vs v4.3 in different files).

---

## Version Source of Truth

**File**: `src/lib/container/version.ts`

```typescript
export const CONTAINER_IMAGE_VERSION = '5.0';
export const CONTAINER_IMAGE_TAG = `v${CONTAINER_IMAGE_VERSION}-openclaw`;
export const CONTAINER_IMAGE = process.env.CONTAINER_IMAGE
  || `docker.prismer.dev/prismer-academic:${CONTAINER_IMAGE_TAG}`;
```

ALL code references to the container image MUST import from this file. Never hardcode the image tag elsewhere.

---

## Change Type I: Container Image

> When: modifying Dockerfile, plugins, gateway, built-in tools, base image

### Checklist

1. [ ] Update `CONTAINER_IMAGE_VERSION` in `src/lib/container/version.ts`
2. [ ] Build new image:
   ```bash
   cd docker && docker build -f Dockerfile.openclaw -t docker.prismer.dev/prismer-academic:v{NEW}-openclaw .
   ```
3. [ ] Update `docker/VERSIONS.md` — Container Image row
4. [ ] Update `docker/docker-compose.openclaw.yml` — image tag
5. [ ] Update `docker/docker-compose.dev.yml` — image tag
6. [ ] Update `docker/Dockerfile.openclaw` — build command in header comment
7. [ ] Run E2E: `npx playwright test e2e/workspace-visual.spec.ts` — all 5 phases pass
8. [ ] PR description includes `[container-image]` tag

### What triggers this

- Changes to `docker/Dockerfile.openclaw`
- Plugin updates (`docker/plugin/prismer-im/`, `docker/plugin/prismer-workspace/`)
- Gateway changes (`docker/gateway/container-gateway.mjs`)
- Python tool changes (`docker/scripts/prismer-tools/`)
- Base image upgrade

---

## Change Type II: Runtime Config

> When: modifying OpenClaw config, template files, skill definitions, system prompts

### Checklist

1. [ ] Update source files:
   - `docker/config/openclaw.json` — default OpenClaw configuration
   - `docker/templates/base/*.md` — shared SOUL, TOOLS, HEARTBEAT
   - `docker/templates/{templateType}/*.md` — template-specific IDENTITY, MEMORY
   - `docker/templates/{templateType}/skills/{name}/SKILL.md` — skill definitions
2. [ ] Verify `deployWorkspaceFiles()` in `src/app/api/agents/[id]/start/route.ts` reads new files
3. [ ] Verify `buildOpenClawConfig()` in `start/route.ts` maps new config fields
4. [ ] If adding new template type: update `getTemplateDefaults()` in `src/lib/services/workspace.service.ts`
5. [ ] Run E2E: Phase 2 Identity check should pass for template changes
6. [ ] Update `docker/VERSIONS.md` if config version changes

### Runtime deployment flow

```
Agent Start (POST /api/agents/:id/start)
  Step 4: buildOpenClawConfig(agentConfig) → merge into /home/user/.openclaw/openclaw.json
  Step 5: deployWorkspaceFiles(templateType) → copy from docker/templates/ to container
```

Files are deployed to the container at start time via `orchestrator.exec()` — no image rebuild needed.

### Known interaction

`openclaw.json` field `agents[0].identity.theme` (from `systemPromptText`) can override IDENTITY.md directives. When updating templates, verify both the file content AND the config systemPrompt are consistent.

---

## Change Type III: Frontend-Container Integration

> When: modifying proxy routes, component status gates, gateway protocol, error handling

### Checklist

1. [ ] New proxy route follows pattern: `src/app/api/container/[agentId]/{service}/[...path]/route.ts`
2. [ ] Frontend component gates on `agentInstanceStatus === 'running'` before connecting
3. [ ] Error handling covers all proxy error codes:
   - `503` — CONTAINER_NOT_RUNNING (show placeholder)
   - `502` — CONNECTION_FAILED / service starting (show retry message)
   - `504` — REQUEST_TIMEOUT (show timeout message)
   - `404` — AGENT_NOT_FOUND
4. [ ] E2E test Phase 3 includes tab switch + render verification for new component
5. [ ] Update `docs/WINDOWVIEW_STATUS.md` if editor component changed

### Existing proxy routes

| Service | Route | Container Port |
|---------|-------|---------------|
| Jupyter | `/api/container/{agentId}/jupyter/` | 8888 |
| LaTeX | `/api/container/{agentId}/latex/` | 8080 |
| Gateway | `/api/container/{agentId}/gateway/` | 18789 |

### Frontend guard pattern

```typescript
// Required pattern for any component connecting to container services
const agentStatus = useAgentInstanceStore((s) => s.agentInstanceStatus);
const hasAgent = !!agentInstanceId;
const agentRunning = agentStatus === 'running';

if (hasAgent && !agentRunning) {
  return <Placeholder />;  // Never attempt connection when container is down
}
```

---

## Change Type IV: Plugin Version

> When: bumping version of prismer-im, prismer-workspace, prismer-tools, or container-gateway

### Checklist

1. [ ] Update version constant in the plugin's SSoT file:
   - `docker/plugin/prismer-im/version.ts`
   - `docker/plugin/prismer-workspace/version.ts`
   - `docker/gateway/version.mjs`
   - `docker/scripts/prismer-tools/version.py`
2. [ ] Sync `package.json` version (for TypeScript plugins)
3. [ ] Sync `openclaw.plugin.json` version (for OpenClaw plugins)
4. [ ] Update `docker/compatibility.json` — component version
5. [ ] Update `docker/versions-manifest.json` — component version
6. [ ] Update `docker/VERSIONS.md` — component row
7. [ ] If breaking API change: update `minBackendApi` in `docker/compatibility.json`
8. [ ] Rebuild container image (follow Change Type I checklist)
9. [ ] Run E2E: Phase 1 version check annotation shows `versionCompatible: true`
10. [ ] PR description includes `[plugin-version]` tag

### What triggers this

- Bug fix or feature addition in any plugin
- SDK dependency upgrade (e.g., @prismer/sdk)
- New tools added to prismer-workspace skill
- Container gateway routing or protocol changes

### Version SSoT files

| Component | SSoT File |
|-----------|-----------|
| prismer-im | `docker/plugin/prismer-im/version.ts` |
| prismer-workspace | `docker/plugin/prismer-workspace/version.ts` |
| container-gateway | `docker/gateway/version.mjs` |
| prismer-tools | `docker/scripts/prismer-tools/version.py` |
| Container Image | `src/lib/container/version.ts` |
| Compatibility Matrix | `docker/compatibility.json` |

---

## Change Type V: Open-Source Frontend (workspace-ui)

> When: modifying the embedded workspace-ui SPA package, updating API compatibility routes in Gateway, or changing the dual-mode (Cloud/Local) behavior

### Checklist

1. [ ] Build workspace-ui SPA: `cd packages/workspace-ui && npm run build`
2. [ ] Verify SPA loads in standalone mode: `npx serve dist/` → opens in browser
3. [ ] Update Gateway API compatibility routes if Cloud API response format changed:
   - `docker/gateway/container-gateway.mjs` — Bridge, Agent, Container proxy routes
   - Verify response format matches Cloud API (`{ ok, data: { ... } }`)
4. [ ] Update `docker/Dockerfile.openclaw` — `COPY packages/workspace-ui/dist/ /app/frontend/`
5. [ ] Update `docker/VERSIONS.md` — workspace-ui version row
6. [ ] Update `docker/compatibility.json` — workspace-ui component entry
7. [ ] Update `docker/versions-manifest.json` — workspace-ui version
8. [ ] Rebuild container image (follow Change Type I checklist)
9. [ ] Run E2E in **both modes**:
   - Cloud mode: `npx playwright test e2e/workspace-visual.spec.ts`
   - Local mode: open container `:3000` directly → chat + editor tabs work
10. [ ] PR description includes `[workspace-ui]` tag

### What triggers this

- Changes to workspace components (`src/app/workspace/components/`)
- Changes to workspace stores (`src/app/workspace/stores/`)
- Changes to editor components (`src/components/editors/previews/`)
- Changes to Cloud API response format (any endpoint the frontend calls)
- Gateway compatibility route updates

### Key principle

**Frontend code is 100% reused** between Cloud and Local modes. The Gateway mimics Cloud API endpoints with identical response formats. When a Cloud API changes, the Gateway compatibility layer must be updated to match — this is the ONLY adaptation needed.

### API compatibility routes

| Cloud API Path | Gateway Handler | Response Format |
|----------------|----------------|-----------------|
| `GET /api/v2/im/bridge/:wsId` | `handleBridgeStatus()` | `{ ok, data: { status, gatewayUrl } }` |
| `POST /api/v2/im/bridge/:wsId` | `handleBridgeChat()` | `{ ok, data: { response, directives } }` |
| `GET /api/v2/im/bridge/:wsId?include=messages` | `handleBridgeHistory()` | `{ ok, data: { messages: [...] } }` |
| `GET /api/container/:id/jupyter/*` | Proxy to :8888 | Jupyter API |
| `GET /api/container/:id/latex/*` | Proxy to :8080 | LaTeX API |
| `GET /api/agents/:id/health` | `handleAgentAPI()` | `{ status: 'running' }` |
| `POST /api/agents/:id/directive` | `saveDirective()` | `{ ok: true }` |

### Architecture reference

See `docs/OPENSOURCE_ARCHITECTURE.md` for full design and `docs/CONTAINER_FRONTEND_FEASIBILITY.md` for feasibility analysis.

---

## Change Type VI: Agent Automation (Cron, Hooks, Heartbeat)

> When: modifying cron job management, hook configuration, heartbeat settings, or the backend↔container automation sync pipeline

Reference: [OpenClaw Cron](https://docs.openclaw.ai/automation/cron-jobs), [Hooks](https://docs.openclaw.ai/automation/hooks), [Cron vs Heartbeat](https://docs.openclaw.ai/automation/cron-vs-heartbeat)

### Checklist

1. [ ] Backend is SSoT — all cron jobs persist in `AgentCronJob` DB model
2. [ ] On agent start, re-deploy all enabled cron jobs from DB → Gateway `cron.add`
3. [ ] Agent self-created cron jobs sync back to DB via callback/polling
4. [ ] Container restart re-deploys jobs — no data loss
5. [ ] Heartbeat config included in `buildOpenClawConfig()` (Change Type II step)
6. [ ] Hook enable/disable state included in config deployment
7. [ ] Frontend Scheduler Panel reflects DB state, not container state
8. [ ] API routes: `/api/agents/:id/cron` CRUD + `/api/agents/:id/hooks` management
9. [ ] Run history available: `GET /api/agents/:id/cron/:jobId/runs`
10. [ ] PR description includes `[agent-automation]` tag

### What triggers this

- Changes to cron job CRUD APIs (`src/app/api/agents/[id]/cron/`)
- Changes to hook management APIs (`src/app/api/agents/[id]/hooks/`)
- Changes to heartbeat config in `buildOpenClawConfig()`
- Changes to config deployment pipeline (`deployConfigToContainer`)
- Changes to Scheduler Panel UI (`src/app/workspace/components/`)
- Changes to `AgentCronJob` or related DB models

### Key principles

**Backend is SSoT**: Container's `jobs.json` is ephemeral. On container restart, backend re-deploys all jobs. On agent stop, jobs are preserved in DB for next start.

**Bidirectional sync**: User creates via UI → backend → container. Agent creates via conversation → container → backend callback → UI updates.

**Heartbeat vs Cron**: Heartbeat for batched awareness (inbox, calendar, monitoring). Cron for precise timing (scheduled reports, reminders). Both configured from backend.

### Automation deployment in agent start sequence

```
POST /api/agents/:id/start
├── Step 4: buildOpenClawConfig() → includes heartbeat + hooks config
├── Step 5: deployWorkspaceFiles()
├── Step 6: deployConfigToContainer()
├── Step 7: checkVersionCompatibility()
└── Step 8 (NEW): deployCronJobs() → query AgentCronJob → Gateway cron.add for each
```

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Build Time (Type I + V)                                      │
│ docker/Dockerfile.openclaw → Image v{X}-openclaw             │
│ Includes: plugins, gateway, tools, default config            │
│ + workspace-ui SPA (Type V: /app/frontend/)                  │
├─────────────────────────────────────────────────────────────┤
│ Deploy Time — Cloud Mode (Type II)                           │
│ POST /api/agents/:id/start                                   │
│ ├─ Step 4: buildOpenClawConfig() → openclaw.json (merged)    │
│ ├─ Step 5: deployWorkspaceFiles() → IDENTITY/SOUL/SKILL.md  │
│ └─ Step 7: checkVersionCompatibility() → warn/pass (Type IV) │
├─────────────────────────────────────────────────────────────┤
│ Deploy Time — Local Mode (Type V)                            │
│ Container starts → Gateway serves SPA at /                   │
│ Gateway mimics Cloud API: /api/v2/im/bridge, /api/agents,   │
│ /api/container → all handled locally with compatible formats  │
├─────────────────────────────────────────────────────────────┤
│ Runtime (Type III)                                           │
│ Cloud: Frontend → Proxy Route → Container Service            │
│ Local: Frontend → Gateway API Compat → Local Service         │
│ Guard: agentInstanceStatus === 'running'                     │
│ Errors: 503/502/504 → user-friendly messages                 │
└─────────────────────────────────────────────────────────────┘
```

---

## E2E Verification

The lifecycle E2E test (`e2e/workspace-visual.spec.ts`) serves as the integration gate:

| Phase | Validates |
|-------|-----------|
| Phase 1 | Container starts, image tag consistent, health check passes, **version compatibility check** |
| Phase 2 | Template identity deployed (agent responds with role), real LLM reasoning |
| Phase 3 | All WindowView components render (including container-dependent Jupyter) |
| Phase 4 | Persistence after container stop (IM messages, config, binding) |
| Phase 5 | Clean deletion |

**Rule**: All 5 phases must pass before merging any container-related change to `develop`.
