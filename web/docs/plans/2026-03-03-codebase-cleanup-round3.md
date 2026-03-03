# Codebase Cleanup — Round 3 Scan Results

> Scan date: 2026-03-03
> Branch: `feat/opensource-backup-slim`
> Context: Single static container (`prismer-agent` :16888), open-source slim mode

## Previous Rounds

- **Round 1**: Agent CRUD/health routes deleted, CONTRIB/RUNBOOK docs created (`a921150`)
- **Round 2**: K8s layer removed, orchestrator slimmed to health/logs/exec (`b22a7c5`)
- **Round 3**: This document — comprehensive deep scan of remaining dead code

---

## A. Dead API Routes (0 Frontend Callers)

All verified via `grep` import analysis — zero `fetch`/`axios` calls from `src/app/`, `src/components/`, `src/lib/services/`, `src/store/`.

| # | Route | Files | Status |
|---|-------|-------|--------|
| 1 | `src/app/api/v2/im/conversations/` (含 `[id]/`, `[id]/messages/`) | ~4 | [ ] Deleted |
| 2 | `src/app/api/v2/im/register/` | 1 | [ ] Deleted |
| 3 | `src/app/api/v2/im/workspace/[workspaceId]/` | 1 | [ ] Deleted |
| 4 | `src/app/api/v2/papers/[id]/favorite/` | 1 | [ ] Deleted |
| 5 | `src/app/api/v2/papers/[id]/like/` | 1 | [ ] Deleted |
| 6 | `src/app/api/workspace/[id]/interactions/` | 1 | [ ] Deleted |
| 7 | `src/app/api/workspace/[id]/materials/` | 1 | [ ] Deleted |
| 8 | `src/app/api/workspace/[id]/snapshots/` (含 `[version]/`, `[version]/restore/`) | ~4 | [ ] Deleted |
| 9 | `src/app/api/workspace/[id]/simulate-directive/` | 1 | [ ] Deleted |

> Note: `simulate-directive` is only referenced by `scripts/e2e-workspace-scenario.ts` (dev test script, not frontend).

### Active Routes (Do NOT Delete)

| Route | Callers |
|-------|---------|
| `/api/ai/chat`, `/api/ai/translate` | ai-client.ts, AiEditorPreview, paperAgentService, translateService |
| `/api/ocr/[arxivId]/*` | 8+ PDF reader files |
| `/api/config/client` | runtime-config, aieditor-config, translateService, paperAgentService |
| `/api/container/[agentId]/exec` | ScriptTerminal.tsx |
| `/api/container/[agentId]/jupyter` | JupyterNotebookPreview.tsx |
| `/api/latex/compile` | LatexEditorPreview.tsx |
| `/api/v2/im/bridge/[workspaceId]` | useContainerChat.ts, WorkspaceView.tsx |
| `/api/v2/papers/*`, `/api/v2/assets/*`, `/api/v2/collections/*` | Multiple frontend consumers |

---

## B. Dead lib/service Files (0 Imports)

| # | File | Reason | Status |
|---|------|--------|--------|
| 1 | `src/lib/services/upload.service.ts` | 0 imports anywhere | [ ] Deleted |
| 2 | `src/lib/services/offline.service.ts` | 0 imports anywhere | [ ] Deleted |
| 3 | `src/lib/redis.ts` | 0 imports in src/ | [ ] Deleted |
| 4 | `src/lib/nacos-config.ts` | 0 imports (already an empty shim) | [ ] Deleted |
| 5 | `src/lib/runtime-config.ts` | 0 imports anywhere | [ ] Deleted |
| 6 | `src/lib/crypto.ts` | 0 imports (auth flow removed) | [ ] Deleted |
| 7 | `src/lib/responsive.ts` | 0 imports (mobile directory removed) | [ ] Deleted |

### Active lib Files (Do NOT Delete)

| File | Used By |
|------|---------|
| `src/lib/services/asset.service.ts` | 9+ API routes, AssetBrowser |
| `src/lib/services/collection.service.ts` | 6+ API routes, workspace.service |
| `src/lib/services/im.service.ts` | 6 IM API routes |
| `src/lib/services/paper.service.ts` | papers API routes, PDF reader |
| `src/lib/services/parser.service.ts` | assets API routes |
| `src/lib/services/workspace.service.ts` | 8+ workspace API routes |
| `src/lib/services/ai-client.ts` | 4 editor service files |
| `src/lib/logger.ts` | 22+ files |
| `src/lib/prisma.ts` | 40+ files |
| `src/lib/remote-db.ts` | 8 files |
| `src/lib/s3.ts` | assets/upload route |
| `src/lib/utils.ts` | 57+ files |
| `src/lib/storage/*` | 11 files (workspace stores, PDF reader) |

---

## C. Dead Components & Other Files

| # | File | Reason | Status |
|---|------|--------|--------|
| 1 | `src/components/playground/Sidebar.tsx` | 0 imports | [ ] Deleted |
| 2 | `src/components/playground/ComponentPreview.tsx` | 0 imports | [ ] Deleted |
| 3 | `src/components/playground/components.ts` | 0 imports | [ ] Deleted |
| 4 | `src/components/playground/index.ts` | 0 imports | [ ] Deleted |
| 5 | `src/components/shared/ComponentToolbar.tsx` | 0 TS imports (only in a design .md) | [ ] Deleted |
| 6 | `ref/pod-manager.ts` | 0 imports, legacy reference | [ ] Deleted |
| 7 | `ref/warm-pool.ts` | 0 imports, legacy reference | [ ] Deleted |
| 8 | `src/hooks/` (empty directory) | No files inside | [ ] Deleted |

> `src/components/playground/registry.ts` MUST be kept — `ComponentPreviewProps` type is imported by 7 editor preview components.

---

## D. next.config.ts Cleanup

| # | Item | Action | Status |
|---|------|--------|--------|
| 1 | `headers()` for `/playground/:path*` | Remove entire function — route doesn't exist | [ ] Done |
| 2 | `"ssh2"` in `serverExternalPackages` | Remove — 0 direct imports in src/ | [ ] Done |
| 3 | `"docker-modem"` in `serverExternalPackages` | Remove — 0 direct imports in src/ | [ ] Done |
| 4 | `"@kubernetes/client-node"` in `serverExternalPackages` | Remove — 0 imports, K8s layer deleted | [ ] Done |

> Keep `"dockerode"` — still used by `dockerOrchestrator.ts` via dynamic import.

Result:

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  serverExternalPackages: ["dockerode"],
};
```

---

## E. Dead One-Off Scripts

| # | Script | Reason | Status |
|---|--------|--------|--------|
| 1 | `scripts/test-ocr-api.ts` | One-off remote OCR test | [ ] Deleted |
| 2 | `scripts/test-papers-api.ts` | One-off remote papers test | [ ] Deleted |
| 3 | `scripts/test-sts-api.ts` | One-off STS token test | [ ] Deleted |
| 4 | `scripts/test-nacos-mysql.ts` | One-off Nacos+MySQL test | [ ] Deleted |
| 5 | `scripts/test-sync.ts` | One-off WebSocket test | [ ] Deleted |
| 6 | `scripts/test-gateway-auth.mjs` | One-off gateway auth test (hardcoded creds) | [ ] Deleted |
| 7 | `scripts/test-gateway-modes.mjs` | One-off gateway connection test | [ ] Deleted |
| 8 | `scripts/check-image-storage.ts` | One-off DB investigation (hardcoded IP) | [ ] Deleted |
| 9 | `scripts/verify-documents-table.ts` | One-off MySQL table check | [ ] Deleted |
| 10 | `scripts/seedData.ts` | No npm run entry, no caller | [ ] Deleted |
| 11 | `scripts/start-dual-demo.sh` | Superseded by mobile-dev.sh | [ ] Deleted |

### Active Scripts (Do NOT Delete)

| Script | Why |
|--------|-----|
| `scripts/agent-server.ts` | Used by mobile-dev.sh, start-dual-demo.sh |
| `scripts/sync-server.ts` | `npm run sync:server` |
| `scripts/sessionStore.ts` | Imported by agent-server.ts |
| `scripts/mobile-dev.sh` | Full mobile dev launcher |
| `scripts/e2e-setup-workspace.ts` / `.mjs` | E2E test setup |
| `scripts/e2e-workspace-scenario.ts` | E2E scenario test |
| `scripts/verify-*.ts` (s3, mysql, redis, remote) | `npm run verify:*` |
| `scripts/db/`, `scripts/migrations/` | SQL migration history |

---

## F. package.json Cleanup

### npm Packages to Remove (15)

Previously confirmed — 0 imports in src/ after auth/mobile/K8s removal:

| Package | Type | Reason |
|---------|------|--------|
| `next-auth` | dep | Auth stack removed |
| `@auth/prisma-adapter` | dep | Auth stack removed |
| `bcryptjs` | dep | Auth (password hashing) removed |
| `jsonwebtoken` | dep | Auth (JWT) removed |
| `mysql2` | dep | Prod DB client — dev uses SQLite only |
| `proxy-agent` | dep | Remote proxy removed |
| `html2pdf.js` | dep | PDF export removed |
| `yaml` | dep | Nacos config removed |
| `nanoid` | dep | 0 imports |
| `hono` | dep | Agent server framework removed |
| `@hono/node-server` | dep | Agent server removed |
| `ioredis` | dep | Redis removed |
| `@prismer/sdk` | dep | Cloud SDK removed |
| `@kubernetes/client-node` | dep | K8s layer removed |
| `@saurl/tauri-plugin-safe-area-insets-css-api` | dep | Tauri mobile plugin |

| Package | Type | Reason |
|---------|------|--------|
| `@types/bcryptjs` | devDep | Auth removed |
| `@types/jsonwebtoken` | devDep | Auth removed |
| `@types/ioredis` | devDep | Redis removed |

### Tauri Scripts to Remove (6)

| Script | Command |
|--------|---------|
| `tauri:dev` | `cargo tauri dev` |
| `tauri:ios` | `cargo tauri ios dev` |
| `tauri:ios:sim` | `cargo tauri ios dev 'iPhone 17 Pro Max'` |
| `tauri:android` | `cargo tauri android dev` |
| `tauri:build` | `cargo tauri build` |
| `mobile:start` | `concurrently` sync + dev + ios |

> Note: `src-tauri/` directory still exists on disk. Tauri scripts removed from npm but Rust project preserved for future mobile revival.

---

## Execution Order

1. **Phase 1 — Code files** (A + B + C): Delete dead routes, lib files, components, ref/
2. **Phase 2 — Config** (D): Clean next.config.ts
3. **Phase 3 — Scripts** (E): Delete one-off test scripts
4. **Phase 4 — Dependencies** (F): Remove npm packages + Tauri scripts, run `npm install`
5. **Phase 5 — Verify**: `npx tsc --noEmit` + `npx vitest run` + `npm run build`

---

## Estimated Impact

| Category | Files Deleted | Lines Removed (est.) |
|----------|--------------|---------------------|
| Dead API routes (A) | ~15 | ~2,000 |
| Dead lib files (B) | 7 | ~800 |
| Dead components/ref (C) | 8 | ~600 |
| next.config.ts (D) | 0 (edit) | ~15 |
| Dead scripts (E) | 11 | ~1,500 |
| npm packages (F) | 0 (package.json edit) | — |
| **Total** | **~41 files** | **~5,000 lines** |
