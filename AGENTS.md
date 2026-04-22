# Repository Guidelines

## Project Structure & Module Organization

Prismer is a monorepo centered on the Next.js app in `web/`. Use `web/src/app` for routes, `web/src/components` for UI, `web/src/lib` for shared services, and `web/prisma` for schema and local SQLite setup. SDKs live under `sdk/typescript`, `sdk/python`, `sdk/golang`, and `sdk/mcp`. Reusable agent skills are in `skills/`, while containerized runtime and self-hosting assets live in `docker/`. Reference material and architecture notes belong in `docs/`.

## Build, Test, and Development Commands

Run commands from the package you are changing; there is no single root task runner.

- `cd web && npm install && npm run dev` starts the main app at `http://localhost:3000`.
- `cd web && npm run db:generate && npm run db:push` refreshes the Prisma client and local schema.
- `cd web && npm run build` creates the production Next.js build.
- `cd web && npm run lint && npm test` runs the checks covered by CI for the web app.
- `cd web && npm run test:e2e` runs Playwright flows; use `test:layer1`, `test:layer2`, or `test:layer3` for narrower scopes.
- `cd sdk/typescript && npm run build && npm test` validates the TypeScript SDK.
- `cd sdk/python && pytest` and `cd sdk/golang && go test ./...` cover the Python and Go SDKs.

## Coding Style & Naming Conventions

Follow the local formatter and linter rather than hand-formatting. In `web/`, Prettier uses 2-space indentation, semicolons, single quotes, trailing commas, and `printWidth: 100`; ESLint is defined in `web/eslint.config.mjs`. Use `PascalCase` for React components, `camelCase` for hooks and utilities, `snake_case` only where language conventions require it, and keep package names scoped like `@prismer/*`.

## Testing Guidelines

Prefer small, package-local tests. TypeScript tests use `*.test.ts`, Python tests use `test_*.py`, and Go tests use `*_test.go`. Add or update tests with every behavioral change. Keep generated output such as `web/tests/output/`, `web/.next/`, `web/src/generated/prisma/`, and SDK `dist/` artifacts out of commits unless intentionally regenerated for release work.

## Commit & Pull Request Guidelines

Git history follows Conventional Commits, often with scopes: `feat(workspace): ...`, `fix: ...`, `chore(deps): ...`. Keep messages imperative and specific. PRs should follow `.github/PULL_REQUEST_TEMPLATE.md`: explain `What`, `Why`, and `How`, link the issue with `Fixes #...`, confirm `web/` lint and tests passed, update docs when needed, and attach screenshots for UI changes.
