# Contributing to Prismer

Thank you for considering contributing to Prismer! This document provides guidelines for contributing.

## Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/prismer.git`
3. Copy environment file: `cp .env.docker.example .env`
4. Add your OpenAI API key to `.env`: `OPENAI_API_KEY=sk-...`
5. Start services: `docker compose -f docker/docker-compose.lite.yml up -d`
6. Install dependencies: `npm install`
7. Setup database: `npm run db:generate && npm run db:push`
8. Start dev server: `npm run dev`
9. Open http://localhost:3000

## Development Guides

- **Architecture overview:** see `docs/ARCH.md`
- **Detailed contributor guide:** see `docs/CONTRIB.md`
- **Operations runbook:** see `docs/RUNBOOK.md`

## Branch Strategy

- Create feature branches from `develop`: `feat/<name>`
- Create bugfix branches from `develop`: `fix/<name>`
- Submit merge requests to `develop`
- See `CLAUDE.md` for full branching rules

## Commit Messages

Format: `<type>: <description>`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

## Code Style

- TypeScript with strict mode
- ESLint (Next.js core-web-vitals + TypeScript rules)

## Testing

```bash
npm run test:unit         # Vitest unit tests
npm run test:layer1       # Container protocol tests
npm run test:layer2       # Mock rendering tests
npm run test:e2e          # All Playwright tests
```

Always run with `--trace on` for Playwright tests.

## Questions?

Open an issue with the "Question" label.
