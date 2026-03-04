# Local Development Setup

Use this setup when you are actively developing or modifying the Prismer frontend.
The Next.js app runs on your host machine (with hot reload), while the agent container
runs in Docker.

Compose file: `docker/docker-compose.dev.yml`

## Architecture

```
Host machine
  Next.js :3000  (npm run dev)
  Sync server :3456  (npm run sync:server, optional)

Container: prismer-agent
  Container Gateway :3000  ->  host port 16888
    /api/v1/latex    -> LaTeX :8080
    /api/v1/prover   -> Prover :8081
    /api/v1/jupyter  -> Jupyter :8888
    /api/v1/gateway  -> OpenClaw :18900
    /api/v1/arxiv    -> arXiv :8082
    /api/v1/health   -> aggregated health
```

## Prerequisites

- Node.js 18+
- Docker 24+ with Docker Compose v2
- An OpenAI-compatible API key

## Setup

### 1. Configure environment

```bash
cd /path/to/Prismer
cp .env.example .env
```

Edit `.env` and set `OPENAI_API_KEY` and `NEXTAUTH_SECRET`.

### 2. Initialize the database (first time only)

```bash
cd web
npm install
npm run db:generate
npm run db:push
```

### 3. Start the agent container

```bash
cd docker
docker compose -f docker-compose.dev.yml up -d --build
```

The container gateway is exposed on host port 16888.

### 4. Start the frontend

```bash
cd web
npm run dev
```

Frontend is available at http://localhost:3000.

### 5. (Optional) Start the sync server

```bash
cd web
npm run sync:server
```

WebSocket server on port 3456 for multi-client real-time sync.

## Verifying

```bash
docker ps | grep prismer-agent
curl http://localhost:16888/api/v1/health
curl http://localhost:3000/api/config/client
```

## Stopping

```bash
cd docker
docker compose -f docker-compose.dev.yml down
```

## Rebuilding After Plugin Changes

If you modify files in `docker/plugin/`, `docker/config/`, or `docker/gateway/`:

```bash
cd docker
docker compose -f docker-compose.dev.yml up -d --build
```

## See Also

- [Single Container](single-container.md) -- no frontend hot reload needed
- [Troubleshooting](troubleshooting.md)
