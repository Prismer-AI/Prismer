# Troubleshooting

Common issues across all Prismer deployment options.

## Frontend Issues

### Node.js version too old

```
SyntaxError: Unexpected token '?'
```

Next.js 16 requires Node 18+:

```bash
node -v
nvm install 20 && nvm use 20
```

### Port 3000 in use

```bash
lsof -ti:3000 | xargs kill
```

### Missing Prisma client

```
Cannot find module '@/generated/prisma'
```

```bash
cd web
npm run db:generate
```

### Database tables missing

```bash
cd web
npm run db:push
```

## Container / Agent Issues

### Gateway unreachable (port 16888)

```bash
# 1. Check container is running
docker ps | grep prismer-agent

# 2. Check logs
docker logs prismer-agent

# 3. Test gateway
curl http://localhost:16888/api/v1/health
```

For local-dev mode, ensure `CONTAINER_GATEWAY_URL=http://localhost:16888` is set in `web/.env`.

### Docker build fails: base image not found

Option A -- build locally:

```bash
cd docker/base
docker build -t prismer-academic:v5.0 .
```

Option B -- pull from registry:

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USER --password-stdin
docker pull ghcr.io/prismer-ai/prismer-academic:v5.0-lite
```

### OpenClaw Gateway fails to start

The entrypoint logs a warning but continues. Other services (LaTeX, Jupyter, Prover) remain available.

```bash
docker logs prismer-agent 2>&1 | grep -A5 openclaw
```

Ensure `OPENAI_API_KEY` is set in `.env`.

### Agent replies fail with 401

```bash
docker exec prismer-agent printenv OPENAI_API_KEY
```

If empty, set the key in the root `.env` file and restart.

### `host.docker.internal` not resolving (Linux)

Requires Docker 20.10+. All Prismer compose files include:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

### Workspace volume files not persisting

```bash
docker volume ls | grep prismer
```

If you ran `docker compose down -v`, volumes were deleted.

## Database Issues

### Schema drift after update

```bash
cd web
npm run db:push
```

For containerized deployments:

```bash
docker exec prismer-web npx prisma db push
```

## S3 / Storage Issues

### File uploads fail

Verify S3 credentials in `.env`:

```bash
cd web
npm run verify:s3
```

## Health Endpoints

```bash
curl http://localhost:16888/api/v1/health          # All agent services
curl http://localhost:16888/api/v1/latex/health     # LaTeX
curl http://localhost:16888/api/v1/prover/health    # Prover
curl http://localhost:16888/api/v1/jupyter/health   # Jupyter
curl http://localhost:3000/api/config/client        # Frontend API
```
