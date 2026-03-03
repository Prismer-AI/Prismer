# Runbook — Operations Guide

> Auto-generated from project configuration — source of truth.
> Last updated: 2026-03-02

## Deployment Modes

| Mode | Description | Database | Container |
|------|-------------|----------|-----------|
| **Local Dev** | `npm run dev` + Docker Compose | SQLite (`file:./dev.db`) | `prismer-agent` on `:16888` |
| **K8s Test** | Tag `k8s-test-YYYYMMDD-vX.Y.Z` on `develop` | MySQL | EKS `prismer-test` |
| **K8s Prod** | Tag `k8s-prod-YYYYMMDD-vX.Y.Z` on `main` | MySQL | EKS `prismer-prod` |

## Local Development Setup

### 1. Start Agent Container

```bash
cd docker
docker compose -f docker-compose.openclaw.yml up -d
cd ..
```

Verify container is healthy:

```bash
docker exec prismer-agent env | grep PRISMER_API_BASE_URL
# Expected: http://host.docker.internal:3000

curl http://localhost:16888/api/v1/health
# Expected: JSON with all services status
```

### 2. Start Next.js Dev Server

```bash
npm run dev
# Server on http://localhost:3000
```

### 3. Verify Workspace Flow

1. Open `http://localhost:3000/workspace`
2. DevTools Console — look for:
   - `[DirectiveStream] Directive SSE stream opened`
   - `[ContainerChat] Bridge status response` → `status: "connected"`
3. Send a test message (e.g., "write notes about YOLO")
4. Expect: thinking animation → component switch → content rendered

## Container Services

The `prismer-agent` container exposes all services through a unified gateway on port `16888` (mapped to container port `3000`):

| Service | Internal Port | Gateway Path | Purpose |
|---------|--------------|--------------|---------|
| Container Gateway | 3000 | `/` | Reverse proxy for all services |
| LaTeX Compiler | 8080 | `/api/v1/latex/*` | LaTeX → PDF compilation |
| Jupyter Server | 8888 | `/api/v1/jupyter/*` | Python execution |
| OpenClaw Gateway | 18900 | `/api/v1/gateway/*` | Agent WebSocket + API |
| Browser Control | 18902 | — | Headless browser for agent |
| arXiv Converter | — | `/api/v1/arxiv/*` | arXiv paper → flat LaTeX |
| Health Check | — | `/api/v1/health` | Aggregated status |

## Container Management

### Restart Container (picks up new .env values)

```bash
cd docker
docker compose -f docker-compose.openclaw.yml up -d
```

### Rebuild Container Image

```bash
cd docker
docker build -f Dockerfile.openclaw -t prismer-academic:v5.0-openclaw .
docker compose -f docker-compose.openclaw.yml up -d --force-recreate
```

### Copy Config Into Container

The `/workspace` directory inside the container is a Docker named volume, **not** a bind mount. Editing files in `docker/config/workspace/` on host does NOT update the container.

```bash
# Copy a single file
docker cp docker/config/workspace/AGENTS.md prismer-agent:/workspace/AGENTS.md

# Copy entire config directory
docker cp docker/config/workspace/. prismer-agent:/workspace/
```

### View Container Logs

```bash
docker logs prismer-agent --tail 100 -f
```

### Execute Commands in Container

```bash
docker exec -it prismer-agent bash
docker exec prismer-agent cat /workspace/AGENTS.md
```

## Database Operations

### Reset Development Database

```bash
# Delete and recreate
rm -f prisma/dev.db
npm run db:push

# Or use Prisma Studio to inspect
npm run db:studio
```

### Clear Chat History

```bash
# Via sqlite3
sqlite3 prisma/dev.db "DELETE FROM IMMessage; DELETE FROM IMConversation; DELETE FROM IMParticipant; DELETE FROM IMUser;"
```

### Clear Workspace State

```bash
sqlite3 prisma/dev.db "DELETE FROM Message; DELETE FROM Task; DELETE FROM Timeline; DELETE FROM ComponentState; DELETE FROM Snapshot;"
```

## Common Issues and Fixes

### 1. "No container ID found for agent" (409)

**Symptom**: Agent exec commands fail with 409.

**Cause**: Static fallback in `resolveContainerEndpoint()` was returning `containerId: null`.

**Fix**: Ensure `STATIC_AGENT_CONTAINER_ID=prismer-agent` in `.env`. The code now uses `staticConfig.containerId` as fallback.

### 2. Container Config Not Taking Effect

**Symptom**: Updated `AGENTS.md` or `openclaw.json` not reflected in agent behavior.

**Cause**: `/workspace` is a Docker named volume. Host file edits don't propagate.

**Fix**: Use `docker cp` to copy files into the running container, then restart the agent session.

### 3. Agent Shows as "openclaw agent" Instead of "Research Claw"

**Symptom**: After page refresh, chat shows old agent name.

**Cause**: IM User record in DB had stale displayName from before rename.

**Fix**: The bridge route now auto-corrects the displayName on both GET (page load) and POST (agent response). A single page refresh triggers the fix.

### 4. Gallery/Grid Shows Default Demo Data

**Symptom**: Bento Gallery shows 6 default images; AG Grid shows sample rows.

**Cause**: Hardcoded default data in preview components.

**Fix**: Removed all default data. Components start empty and wait for agent directives.

### 5. Agent Uses code-playground Instead of AG Grid for Data

**Symptom**: Agent generates Python code instead of using `data_load` tool.

**Cause**: LLM tool selection — agent prefers `code_execute` over `data_load`.

**Fix**: Added mandatory tool routing rules in `AGENTS.md` (system prompt) with explicit workflow instructions.

### 6. Container Gateway Unreachable

**Symptom**: Bridge status shows "unreachable", agent chat fails.

**Checks**:
```bash
# Is container running?
docker ps | grep prismer-agent

# Is gateway responding?
curl http://localhost:16888/api/v1/health

# Is PRISMER_API_BASE_URL correct?
docker exec prismer-agent env | grep PRISMER_API_BASE_URL
# Must point to host.docker.internal:3000 (NOT 3001)
```

**Fix**: If env is wrong, container was created with old `.env`. Recreate:
```bash
cd docker && docker compose -f docker-compose.openclaw.yml up -d --force-recreate
```

### 7. OpenAI API Key Invalid (401)

**Symptom**: Agent tool calls fail with 401 for image generation or web fetch.

**Cause**: Invalid or expired `OPENAI_API_KEY` in container env.

**Fix**: Update `.env` with valid key, then recreate container.

## K8s Deployment

### Release Workflow

```bash
# 1. Test release — tag develop
git tag k8s-test-20260302-v0.1.0 develop
git push origin k8s-test-20260302-v0.1.0

# 2. Prod release — merge develop → main, then tag main
git checkout main && git merge develop
git tag k8s-prod-20260302-v0.1.0 main
git push origin k8s-prod-20260302-v0.1.0
```

CI pipeline: build Docker image → push to registry → update k8s-deploy repo → `kubectl apply`

### Tag Format

- `k8s-prod-YYYYMMDD-vX.Y.Z` — production
- `k8s-test-YYYYMMDD-vX.Y.Z` — staging

**FORBIDDEN**: Never use `prod-*`, `test-*`, `dev-*` prefixes (legacy patterns).

### Rollback

```bash
# Find previous tag
git tag --list 'k8s-prod-*' --sort=-version:refname | head -5

# Re-tag with previous image
git tag k8s-prod-YYYYMMDD-vX.Y.Z-rollback <previous-commit>
git push origin k8s-prod-YYYYMMDD-vX.Y.Z-rollback
```

Or manually update k8s-deploy repo to point to previous image tag.

## Monitoring

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:16888/api/v1/health` | Container gateway aggregated health |
| `GET /api/agents/:id/health` | Agent instance health (API route) |
| `GET /api/v2/im/bridge/:wsId` | Bridge status + gateway connectivity |

### Key Logs to Watch

```bash
# Next.js server logs
# Look for: [Bridge], [DirectiveStream], [ContainerChat], [SyncActions]

# Container logs
docker logs prismer-agent -f --tail 50
# Look for: [Gateway], [OpenClaw], [Plugin]
```

### Structured Log Format

All logs use unified format via `src/lib/logger.ts`:

```
[2026-03-02T10:00:00Z] INFO  [Bridge] Agent response persisted to IM {"conversationId":"...","responseLength":1234}
```
