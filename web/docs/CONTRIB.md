# Contributing Guide

> Auto-generated from `package.json` and `.env` — source of truth.
> Last updated: 2026-03-02

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x | Runtime |
| npm | 11.x | Package manager |
| Docker + Compose | 24+ / v2 | Agent container |
| SQLite | 3.x | Development database (via Prisma) |

## Quick Start

```bash
# 1. Clone and install
git clone <repo> && cd library
npm install

# 2. Environment
cp .env.docker.example .env
# Edit .env — set OPENAI_API_KEY at minimum

# 3. Database
npm run db:generate        # Generate Prisma Client
npm run db:push            # Push schema to SQLite

# 4. Start agent container
cd docker && docker compose -f docker-compose.openclaw.yml up -d && cd ..

# 5. Start dev server
npm run dev                # http://localhost:3000
```

## Environment Variables

### Required

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | SQLite path (dev) or MySQL connection string (prod) |
| `NEXTAUTH_SECRET` | — | Random secret: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` | Canonical app URL |
| `OPENAI_API_KEY` | — | OpenAI-compatible API key (required for agent chat) |

### AI / LLM

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible API base |
| `AGENT_DEFAULT_MODEL` | `gpt-4o-mini` | Default model for agent |
| `ANTHROPIC_API_KEY` | — | Anthropic key (optional, for Claude models) |
| `DEFAULT_MODEL` | `claude-sonnet-4-20250514` | Default model ID for container agents |

### Static Container Binding (Recommended for Dev)

| Variable | Default | Description |
|----------|---------|-------------|
| `STATIC_AGENT_ENABLED` | `true` | Use env-based static agent (skip DB lookup) |
| `STATIC_AGENT_ID` | `default` | Agent ID for directive SSE matching |
| `STATIC_AGENT_CONTAINER_ID` | `prismer-agent` | Docker container name for `docker exec` |
| `CONTAINER_GATEWAY_URL` | `http://localhost:16888` | Container gateway URL |
| `OPENCLAW_GATEWAY_TOKEN` | `prismer-dev-token` | Gateway auth token |

### Container ↔ Host Communication

| Variable | Default | Description |
|----------|---------|-------------|
| `PRISMER_IM_SERVER_URL` | `http://host.docker.internal:3456` | IM server URL from container |
| `PRISMER_API_BASE_URL` | `http://host.docker.internal:3000` | Host backend URL from container |
| `PRISMER_CONVERSATION_ID` | `test-conversation` | IM conversation room ID |
| `PRISMER_AGENT_TOKEN` | `dev-token` | IM agent authentication token |
| `PRISMER_AGENT_ID` | `default` | Agent ID injected into plugin config |

### Optional Services

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | — | S3 storage (file uploads) |
| `AWS_SECRET_ACCESS_KEY` | — | S3 storage |
| `AWS_REGION` | `us-east-1` | S3 region |
| `S3_BUCKET` | — | S3 bucket name |
| `CDN_DOMAIN` | — | CDN for static assets |
| `UPSTASH_REDIS_REST_URL` | — | Redis (optional caching) |
| `UPSTASH_REDIS_REST_TOKEN` | — | Redis auth token |
| `REMOTE_MYSQL_HOST` | — | Remote paper DB (if `USE_REMOTE_PAPERS=true`) |
| `PARSER_API_URL` | `https://parser.prismer.dev` | PDF parser / OCR service |

### Client-Side (NEXT_PUBLIC_*)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public-facing app URL |
| `NEXT_PUBLIC_APP_NAME` | `Prismer Library` | App display name |
| `NEXT_PUBLIC_SYNC_SERVER_URL` | `ws://localhost:3456` | WebSocket sync server |

## Available Scripts

### Development

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `next dev` | Start Next.js dev server (port 3000) |
| `npm run build` | `prisma generate && next build` | Production build |
| `npm start` | `next start` | Start production server |
| `npm run lint` | `eslint` | Run ESLint |
| `npm run sync:server` | `tsx scripts/sync-server.ts` | WebSocket agent/sync server (port 3456) |

### Database

| Script | Command | Description |
|--------|---------|-------------|
| `npm run db:generate` | `prisma generate` | Generate Prisma Client to `src/generated/prisma` |
| `npm run db:push` | `prisma db push` | Push schema to database |
| `npm run db:migrate` | `prisma migrate dev` | Create migration |
| `npm run db:studio` | `prisma studio` | Open Prisma Studio GUI |

### Testing

| Script | Command | Description |
|--------|---------|-------------|
| `npm test` | `vitest run` | Run all unit tests |
| `npm run test:unit` | `vitest run` | Run unit tests |
| `npm run test:watch` | `vitest` | Watch mode |
| `npm run test:coverage` | `vitest run --coverage` | Unit tests with coverage |
| `npm run test:layer1` | `playwright test --project=layer1` | Container + plugin + API tests |
| `npm run test:layer2` | `playwright test --project=layer2` | Mock frontend rendering tests |
| `npm run test:layer3` | `playwright test --project=layer3` | Full E2E tests (no mocks) |
| `npm run test:e2e` | `playwright test` | All Playwright tests (L1+L2+L3) |
| `npm run test:report` | `playwright show-report tests/output/reports` | Open HTML test report |

### Verification

| Script | Command | Description |
|--------|---------|-------------|
| `npm run verify:s3` | `tsx scripts/verify-s3.ts` | Check S3 connectivity |
| `npm run verify:mysql` | `tsx scripts/verify-mysql.ts` | Check MySQL connectivity |
| `npm run verify:redis` | `tsx scripts/verify-redis.ts` | Check Redis connectivity |
| `npm run verify:remote` | `tsx scripts/verify-remote.ts` | Check remote connections |
| `npm run verify:all` | All above | Verify all external services |

### Tauri (Desktop/Mobile) — Currently Removed in Open-Source Slim

| Script | Command | Description |
|--------|---------|-------------|
| `npm run tauri:dev` | `cargo tauri dev` | Desktop dev |
| `npm run tauri:ios:sim` | `cargo tauri ios dev 'iPhone 17 Pro Max'` | iOS simulator |
| `npm run mobile:start` | `concurrently sync:server + dev + tauri:ios:sim` | Full mobile dev stack |

> Note: Tauri scripts remain in `package.json` but the mobile app code has been removed on `feat/opensource-backup-slim`.

## Testing

### Test Layers

```
tests/
├── helpers/         # Shared: setup-vitest, mock-agent, api-client, trace-collector
├── fixtures/        # Mock directives, agent responses, workspace data
├── unit/            # Vitest unit tests (jsdom)
├── layer1/          # Playwright: container + plugin + API (real agent)
├── layer2/          # Playwright: mock frontend rendering + trace
├── layer3/          # Playwright: full E2E, no mocks + trace
└── output/          # .gitignore'd: results, reports, traces, screenshots
```

**Always run Playwright with `--trace on`** for Trace Viewer files:

```bash
npx playwright test tests/layer2/ --trace on
npx playwright show-trace tests/output/<trace>.zip
```

### MVP Scenarios (T0–T3)

- **T0**: Agent identity → chat panel reply
- **T1**: LaTeX survey (CVPR template) → editor + compile + PDF
- **T2**: Jupyter sin/cos/tan plot → notebook + gallery
- **T3**: Notes experiment template → ai-editor content

## Git Workflow

### Branch Strategy

```
main           ← production (protected)
  └── develop  ← staging/testing
        └── feat/xxx   ← feature branches
        └── fix/xxx    ← bugfix branches
```

### Commit Format

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### Pull Requests

1. Create feature branch from `develop`
2. Implement with tests
3. `gh pr create --base develop`
4. Merge via MR after review

## Project Structure (Key Directories)

```
src/
├── app/
│   ├── api/              # REST API routes
│   ├── workspace/        # Workspace page + stores + hooks
│   └── global/           # Shared layouts and stores
├── components/
│   ├── editors/previews/ # 8 editor components (PDF, LaTeX, Jupyter, etc.)
│   ├── ui/               # shadcn/ui components
│   └── shared/           # Shared components
├── lib/
│   ├── container/        # Container client + static agent config
│   ├── sync/             # Multi-client sync engine
│   └── services/         # Business logic (IM, paper, asset, etc.)
├── store/                # Global Zustand stores
└── generated/prisma/     # Generated Prisma Client (never edit)

docker/
├── plugin/prismer-workspace/  # 26-tool workspace skill plugin (v0.5.0)
├── plugin/prismer-im/         # IM channel plugin (v0.2.0)
├── scripts/prismer-tools/     # 4 Python CLI tools
├── gateway/                   # Container gateway reverse proxy
├── config/                    # OpenClaw runtime config + skills
└── docker-compose.openclaw.yml
```
