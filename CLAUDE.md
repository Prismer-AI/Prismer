# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prismer.AI is an open-source academic research platform combining paper reading, writing, data analysis, and multi-agent AI workflows. It ships as a self-hosted Docker container with a Next.js frontend and uses OpenClaw for agent orchestration.

**Dual license:** `@prismer/*` packages are MIT; the platform uses Business Source License.

## Repository Structure

```
docker/                  # Self-hosted containerized platform
  web/                   # Next.js 16 frontend (React 19, TypeScript, Tailwind 4)
  skills/                # OpenClaw academic skills (latex, jupyter, prover, etc.)
  config/                # Agent config (openclaw.json) and persona files (SOUL.md, AGENTS.md)
  Dockerfile             # Multi-stage build (frontend-builder → prismer-academic:v1.0 base)
  docker-compose.yml     # Production compose config
  entrypoint.sh          # Container startup (starts all internal services)
sdk/typescript/          # @prismer/sdk - TypeScript SDK for Context Cloud API
docs/                    # Architecture docs, roadmap, i18n translations
```

## Build & Development Commands

### Frontend (`docker/web/`)

```bash
npm run dev          # Next.js dev server with hot reload
npm run build        # Production build (standalone output for Docker)
npm run lint         # ESLint (Next.js core-web-vitals + TypeScript rules)
npm run typecheck    # tsc --noEmit
```

### TypeScript SDK (`sdk/typescript/`)

```bash
npm run build        # tsup → dist/ (CJS + ESM + types)
npm run dev          # Watch mode
npm test             # Vitest
npm run lint         # ESLint
```

### Docker

```bash
cd docker
docker build -t openprismer .
docker run -p 3000:3000 -v openprismer-data:/workspace openprismer
```

## Architecture

### Frontend Tech Stack

- **Next.js 16** with App Router, standalone output mode, React Server Components enabled
- **React 19**, **Tailwind CSS 4**, **shadcn/ui** (new-york style), **Radix UI**
- **Zustand 5** for state management with localStorage persistence
- **TypeScript 5** with strict mode; path alias `@/*` → `./src/*`

### State Management

Single Zustand store at `docker/web/src/stores/workspaceStore.ts` with persist middleware. Uses `useShallow` selector hooks to prevent unnecessary re-renders. Key selector hooks: `useConfig()`, `useMessages()`, `useTasks()`, `useActiveEditor()`, `useLayout()`, `useSkills()`, `useArtifacts()`.

### Editor System

Six editor types defined in `docker/web/src/types/workspace.ts`: `ai-editor`, `jupyter`, `latex`, `code-playground`, `pdf-reader`, `image-viewer`. Editor components live in `docker/web/src/components/editors/`.

### API Routes (`docker/web/src/app/api/v1/`)

- `chat/route.ts` — Main chat endpoint. Calls OpenClaw agent via CLI, streams SSE events, parses `[[UI:type:payload]]` directives from agent responses.
- `services/latex/`, `services/jupyter/`, `services/prover/` — Proxy to internal container services.
- `sessions/`, `files/`, `skills/`, `artifacts/` — CRUD endpoints.
- `status/health/` — Health check.

### Container Internal Services

All run inside the Docker container on localhost, only port 3000 is exposed:

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | Next.js web UI |
| LaTeX | 8080 | pdflatex/xelatex/lualatex compilation |
| Prover | 8081 | Coq/Z3 formal verification |
| Jupyter | 8888 | Python/R notebook kernel |
| Gateway | 18900 | OpenClaw agent orchestration |

Service URLs are configured in `docker/web/src/lib/services.ts` via environment variables.

### Agent System

OpenClaw config at `docker/config/openclaw.json`. Default model: `google/gemini-2.5-flash`. Academic skills in `docker/skills/` (academic-jupyter, academic-latex, academic-prover, academic-python, academic-search, academic-workflow, academic-workspace). Agent persona files: `SOUL.md`, `AGENTS.md`, `IDENTITY.md`, `TOOLS.md`.

### SDK Architecture

`sdk/typescript/` exports `PrismerClient` for the Context Cloud API. Built with tsup targeting ES2020. Supports load (URL/batch/search) and save operations with caching and cost tracking.

## Commit Message Convention

Conventional Commits format: `type(scope): description`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
