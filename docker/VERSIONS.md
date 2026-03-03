# OpenClaw Integration — Version Tracking

> **Source of Truth for image tag**: `src/lib/container/version.ts`
> **Compatibility matrix**: `docker/compatibility.json`
> **Change protocol**: `docs/CONTAINER_PROTOCOL.md`

| Component | Version | SSoT File | Location | Build |
|-----------|---------|-----------|----------|-------|
| Base Image | 5.0 | `docker/base/version.sh` | `docker/base/Dockerfile` | `docker build docker/base/` |
| prismer-im | 0.2.0 | `docker/plugin/prismer-im/version.ts` | `docker/plugin/prismer-im/` | `npm run build` → `dist/` |
| prismer-workspace | 0.5.0 | `docker/plugin/prismer-workspace/version.ts` | `docker/plugin/prismer-workspace/` | `npm run build` → `dist/` |
| prismer-tools | 0.1.0 | `docker/scripts/prismer-tools/version.py` | `docker/scripts/prismer-tools/` | N/A — copied by Dockerfile |
| container-gateway | 1.1.0 | `docker/gateway/version.mjs` | `docker/gateway/` | N/A — no build step |
| Container Image | 5.0 | `src/lib/container/version.ts` | `docker/Dockerfile.openclaw` | `docker build -f Dockerfile.openclaw` |
| OpenClaw Config | 5.0 | — | `docker/config/openclaw.json` | — |

## Two-Layer Architecture

```
Layer 1 — Base Image (agent-agnostic):
  docker/base/Dockerfile → prismer-academic:v5.0
  Ubuntu 24.04 + TeXLive + Python/uv + R + Coq + Lean4 + Z3
  + Jupyter + LaTeX/Prover/arXiv servers + Node.js 22

Layer 2 — Agent Layer (OpenClaw):
  docker/Dockerfile.openclaw → prismer-academic:v5.0-openclaw
  FROM prismer-academic:v5.0
  + OpenClaw runtime + Prismer plugins + Gateway + Skills + Config
```

## Version Management

- **Base image SSoT**: `docker/base/version.sh` — Ubuntu + academic tools, no Agent framework
- **Plugin version SSoT**: Each plugin has a `version.ts` / `version.mjs` / `version.py` file. All other version references (package.json, manifest, code) must sync from this file.
- **Compatibility matrix**: `docker/compatibility.json` defines expected versions for all components. Backend validates at container startup (Step 7 of agent start).
- **Version manifest**: `docker/versions-manifest.json` is baked into the image as `/opt/prismer/versions.json`. Container gateway reports it at `/` root endpoint.
- **Change protocol**: See `docs/CONTAINER_PROTOCOL.md` Change Type IV for the plugin version bump checklist.

## Build Commands

```bash
# Layer 1 — Base Image (run on x86 server or with buildx)
cd docker/base
docker build -t prismer-academic:v5.0 .

# Layer 2 — OpenClaw Layer
cd docker
docker build -f Dockerfile.openclaw \
  --build-arg BASE_IMAGE=prismer-academic:v5.0 \
  -t docker.prismer.dev/prismer-academic:v5.0-openclaw .
```

## External Dependencies

| Dependency | Version | Used By |
|-----------|---------|---------|
| `@prismer/sdk` | ^1.7.0 | prismer-im |
| `openclaw` | * (peer) | prismer-im, prismer-workspace |
| Base Image | v5.0 | Dockerfile.openclaw |
