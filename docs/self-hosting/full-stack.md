# Full Stack Deployment

Use this for lab servers or shared team environments with the full OpenClaw agent stack.

Compose file: `docker/docker-compose.openclaw.yml`

## Architecture

```
External traffic
  :3000  -> prismer-web (Next.js, Prisma/SQLite)
  :16888 -> prismer-agent Container Gateway
               /api/v1/latex    -> LaTeX :8080
               /api/v1/prover   -> Prover :8081
               /api/v1/jupyter  -> Jupyter :8888
               /api/v1/gateway  -> OpenClaw :18900
               /api/v1/arxiv    -> arXiv :8082
               /api/v1/health   -> aggregated
```

## Setup

### 1. Configure environment

```bash
cd /path/to/Prismer
cp .env.example .env
```

Required:

```
OPENAI_API_KEY=sk-your-api-key-here
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://your-server-hostname:3000
```

Optional production settings:

```
OPENCLAW_GATEWAY_TOKEN=<strong-random-token>
ANTHROPIC_API_KEY=sk-ant-your-key-here
AGENT_DEFAULT_MODEL=gpt-4o
```

### 2. Build and start

```bash
cd docker
docker compose -f docker-compose.openclaw.yml up -d --build
```

If the base image is not accessible from the registry, build locally first:

```bash
docker build -t prismer-academic:v5.0 ./base
docker compose -f docker-compose.openclaw.yml up -d --build
```

### 3. Verify

```bash
docker ps | grep prismer
curl http://localhost:16888/api/v1/health
curl http://localhost:3000/api/config/client
```

## Reverse Proxy / TLS

For production, place Nginx or Caddy in front. Example Nginx snippet:

```nginx
server {
    listen 443 ssl;
    server_name prismer.lab.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/v1/ {
        proxy_pass http://127.0.0.1:16888;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Update `NEXTAUTH_URL` to match the public URL.

## Logs

```bash
docker compose -f docker/docker-compose.openclaw.yml logs -f
docker logs -f prismer-agent
docker exec prismer-agent ls /var/log/openclaw/
```

## Data Persistence

| Volume | Purpose |
|--------|---------|
| `prismer-data` | SQLite database |
| `prismer-workspace` | Agent workspace files |

Never use `down -v` in production unless you intend to wipe all data.

## Updating

```bash
cd docker
docker compose -f docker-compose.openclaw.yml up -d --build
```

If the schema changed:

```bash
docker exec prismer-web npx prisma db push
```

## See Also

- [Local Development](local-dev.md) -- for active development
- [Single Container](single-container.md) -- for simpler personal use
- [Troubleshooting](troubleshooting.md)
