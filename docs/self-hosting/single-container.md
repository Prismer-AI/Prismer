# Single Container Deployment

Use this for personal use when you do not need to modify the frontend source code.
Both the Next.js frontend and the agent container run in Docker.

Compose file: `docker/docker-compose.lite.yml`

## Architecture

```
Host machine
  prismer-web  :3000   (Next.js frontend)
  prismer-agent        (all agent services)
    host:16888 -> Container Gateway
    host:18888 -> Jupyter (direct access)
    host:18080 -> LaTeX (direct access)
```

Containers communicate over an internal Docker network.

## Setup

### 1. Configure environment

```bash
cd /path/to/Prismer
cp .env.example .env
```

Edit `.env` and set `OPENAI_API_KEY` and `NEXTAUTH_SECRET`.

### 2. Build and start

```bash
cd docker
docker compose -f docker-compose.lite.yml up -d --build
```

First build takes several minutes. Subsequent starts reuse cached layers.

### 3. Verify

```bash
docker ps | grep prismer
curl http://localhost:16888/api/v1/health
```

Open http://localhost:3000 in your browser.

## Data Persistence

| Volume | Purpose |
|--------|---------|
| `prismer-data` | SQLite database |
| `prismer-workspace` | Agent workspace (notebooks, LaTeX, outputs) |

Volumes persist across container restarts. To back up:

```bash
docker run --rm \
  -v docker_prismer-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/prismer-data-backup.tar.gz /data
```

## Stopping

```bash
cd docker
docker compose -f docker-compose.lite.yml down      # keeps volumes
docker compose -f docker-compose.lite.yml down -v    # removes all data
```

## See Also

- [Local Development](local-dev.md) -- for active frontend development
- [Full Stack](full-stack.md) -- for lab/team deployments
- [Troubleshooting](troubleshooting.md)
