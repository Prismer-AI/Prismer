# Runbook

> Operational guide for deploying and maintaining Prismer.AI.

## Deployment

### Local Development (Frontend + Agent Container)

```bash
# Terminal 1: Frontend
cd web
npm install
npm run db:generate && npm run db:push
npm run dev                    # → http://localhost:3000

# Terminal 2: Agent container
docker compose -f docker/docker-compose.dev.yml up
                               # → http://localhost:16888 (gateway)

# Terminal 3: Sync server (optional, for multi-client sync)
cd web
npm run sync:server            # → ws://localhost:3456
```

### Lite Mode (Single Container)

```bash
cd docker
docker compose -f docker-compose.lite.yml up -d
```

Exposed ports: 16888 (gateway), 18888 (Jupyter), 18080 (LaTeX).

### Production Build

```bash
cd web
npm run build                  # prisma generate + next build (standalone)
npm run start                  # Start production server
```

### Docker Build

```bash
# Build base image
cd docker/base
docker build -t prismer-academic:v5.0 .

# Build OpenClaw layer
cd docker
docker build -f Dockerfile.openclaw \
  --build-arg BASE_IMAGE=prismer-academic:v5.0 \
  -t prismer-academic:v5.0-openclaw .
```

## Health Checks

### Container Services

All container services are accessible via the unified gateway:

```bash
# Aggregated health check
curl http://localhost:16888/api/v1/health

# Individual services
curl http://localhost:16888/api/v1/latex/health     # LaTeX (port 8080)
curl http://localhost:16888/api/v1/prover/health    # Prover (port 8081)
curl http://localhost:16888/api/v1/jupyter/health   # Jupyter (port 8888)
curl http://localhost:16888/api/v1/gateway/health   # OpenClaw Gateway (port 18900)
```

### Frontend

```bash
curl http://localhost:3000/api/config/client
```

### Database

```bash
cd web
npx prisma studio              # Visual database browser
```

### S3 Connectivity

```bash
cd web
npm run verify:s3
```

## Common Issues

### `npm run dev` fails with "SyntaxError: Unexpected token '?'"

**Cause:** Node.js version too old. Next.js 16 requires Node 18+.

```bash
node -v                        # Check version
nvm install 20 && nvm use 20   # Upgrade via nvm
```

### "Unable to acquire lock at .next/dev/lock"

**Cause:** A previous Next.js dev server is still running.

```bash
# Find and kill stale processes
ps aux | grep 'next dev\|next-server' | grep -v grep
kill <PID>

# Then restart
npm run dev
```

### "Port 3000 is in use"

```bash
lsof -ti:3000 | xargs kill     # Kill process on port 3000
```

### Prisma Client not generated

**Symptom:** Import errors for `@/generated/prisma`.

```bash
cd web
npm run db:generate             # Regenerate Prisma Client
```

### Database not initialized

**Symptom:** "table does not exist" errors.

```bash
cd web
npm run db:push                 # Create tables from schema
```

### Container gateway unreachable

**Symptom:** Agent features not working, network errors to `:16888`.

1. Check container is running: `docker ps | grep prismer-agent`
2. Check container logs: `docker logs prismer-agent`
3. Verify gateway port: `curl http://localhost:16888/api/v1/health`
4. Check `.env` has `CONTAINER_GATEWAY_URL=http://localhost:16888`

### Docker build fails on base image

**Cause:** Base image `prismer-academic:v5.0` must be built first.

```bash
cd docker/base
docker build -t prismer-academic:v5.0 .
# Then build the OpenClaw layer
cd ..
docker build -f Dockerfile.openclaw --build-arg BASE_IMAGE=prismer-academic:v5.0 -t prismer-academic:v5.0-openclaw .
```

## Container Architecture

```
Host                          Container (prismer-agent)
┌──────────────┐              ┌────────────────────────────┐
│ Next.js :3000│──── :16888 ──│ Gateway :3000              │
│              │              │  ├─ /api/v1/latex → :8080   │
│              │              │  ├─ /api/v1/prover → :8081  │
│              │              │  ├─ /api/v1/jupyter → :8888 │
│              │              │  ├─ /api/v1/gateway → :18900│
│              │              │  └─ /api/v1/arxiv → :8082   │
│ Sync :3456  ◄──────────────│ IM Plugin                   │
└──────────────┘              └────────────────────────────┘
```

## Version Matrix

See [docker/VERSIONS.md](../docker/VERSIONS.md) for component version tracking.

| Component | Version Source |
|-----------|---------------|
| Base image | `docker/base/version.sh` |
| prismer-im plugin | `docker/plugin/prismer-im/version.ts` |
| prismer-workspace plugin | `docker/plugin/prismer-workspace/version.ts` |
| Container gateway | `docker/gateway/version.mjs` |
| Compatibility matrix | `docker/compatibility.json` |
