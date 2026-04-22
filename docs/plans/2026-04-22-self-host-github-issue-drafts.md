# Self-Host GitHub Issue Drafts

## Usage

Each section below is written as a copy-paste-ready GitHub issue draft for the self-host track.

Conventions:

- `self-host` is the common label
- priority labels use `p0`, `p1`, `p2`
- add `backend`, `frontend`, `infra`, or `docs` as needed

## Issue 1

**Title**

`self-host: restore multi-workspace in local owner mode`

**Suggested labels**

`self-host`, `p0`, `backend`, `frontend`

**Body**

```md
## Problem

The current OSS build is no-auth, but it is also effectively locked to a single default workspace. That removes valid workspace functionality instead of only removing auth.

## Scope

- Keep the fixed local owner model
- Remove forced redirect to the default workspace
- Preserve local create/list/update/delete workspace flows

## Files

- `web/src/app/workspace/[workspaceId]/page.tsx`
- `web/src/app/workspace/page.tsx`
- `web/src/app/api/workspace/route.ts`

## Acceptance Criteria

- Multiple workspaces can be created and opened locally
- Visiting `/workspace/:id` no longer rewrites to the default workspace
- No auth flow is introduced

## Dependencies

None

## Risks

- Some UI assumptions may still expect exactly one workspace
```

## Issue 2

**Title**

`self-host: add local asset and collection models`

**Suggested labels**

`self-host`, `p0`, `backend`

**Body**

```md
## Problem

Asset and collection services are currently stubs, but multiple API and UI flows assume they exist.

## Scope

- Add local Prisma-backed models for assets and collections
- Preserve current numeric `assetId` and `collectionId` expectations where feasible
- Support papers, notes, generated artifacts, and collection membership

## Files

- `web/prisma/schema.prisma`
- `web/src/lib/services/asset.service.ts`
- `web/src/lib/services/collection.service.ts`

## Acceptance Criteria

- Local DB persists paper and note assets
- Workspace collection binding works without remote services
- Existing routes expecting `assetId` or `collectionId` continue to function

## Dependencies

None

## Risks

- ID type mismatches may cascade into API and frontend changes if not handled deliberately
```

## Issue 3

**Title**

`self-host: add /api/v2/assets compatibility API`

**Suggested labels**

`self-host`, `p0`, `backend`, `frontend`

**Body**

```md
## Problem

The frontend already relies on `/api/v2/assets` and `/api/v2/assets/:id/file`, but those routes do not exist in this repo.

## Scope

- Implement list/search endpoint for Asset Browser
- Implement file/content endpoint for opening an asset
- Match the response shape expected by current callers

## Files

- `web/src/components/shared/AssetBrowser.tsx`
- `web/src/components/editors/pdf-reader/PDFReaderWrapper.tsx`
- `web/src/app/api/v2/assets/*`

## Acceptance Criteria

- Asset Browser lists local assets
- Selecting a note or paper asset opens it successfully
- PDF Reader can open paper assets from the asset browser

## Dependencies

- Local asset and collection models

## Risks

- Existing callers may rely on undocumented cloud response fields
```

## Issue 4

**Title**

`self-host: replace default S3 sync with local file storage`

**Suggested labels**

`self-host`, `p0`, `backend`, `infra`

**Body**

```md
## Problem

Generated outputs and notes still assume `S3 + remote asset service` as the default storage path.

## Scope

- Introduce a local storage backend for generated files and uploaded content
- Make S3 optional instead of mandatory
- Rewire note save, artifact save, and directive-triggered sync flows to use local storage by default

## Files

- `web/src/app/api/workspace/[id]/notes/route.ts`
- `web/src/app/api/agents/[id]/artifacts/route.ts`
- `web/src/app/api/agents/[id]/directive/route.ts`
- `web/src/lib/services/workspace-file-sync.service.ts`

## Acceptance Criteria

- Notes persist locally and reopen after restart
- LaTeX compile outputs are saved locally and appear in assets
- Jupyter or gallery artifacts can be reopened locally

## Dependencies

- Local asset and collection models
- `/api/v2/assets` compatibility API

## Risks

- Need a clear on-disk storage layout to avoid later migration pain
```

## Issue 5

**Title**

`self-host: add read-only /api/ocr routes`

**Suggested labels**

`self-host`, `p0`, `backend`

**Body**

```md
## Problem

The PDF reader expects an OCR API contract, but the repo does not expose the corresponding routes.

## Scope

- Add handlers for `metadata.json`, `ocr_result.json`, `detections.json`, `paper.md`, `pdf`, and image assets
- Serve local OCR datasets in the shape expected by the reader

## Files

- `web/src/components/editors/pdf-reader/services/paperContextProvider.ts`
- `web/src/lib/storage/mockAdapter.ts`
- `web/src/app/api/ocr/*`

## Acceptance Criteria

- PDF reader can load OCR metadata, markdown, detections, and images through `/api/ocr/*`
- Missing OCR data degrades cleanly to raw PDF mode

## Dependencies

None

## Risks

- The reader depends on a fairly specific file layout and response contract
```

## Issue 6

**Title**

`self-host: add local OCR dataset import and indexing`

**Suggested labels**

`self-host`, `p0`, `backend`, `infra`

**Body**

```md
## Problem

Read-only OCR routes are not enough unless users have a standard place to drop local OCR datasets and have them indexed.

## Scope

- Define one supported local dataset directory layout
- Add indexing for available papers
- Support sample dataset import or discovery

## Files

- `web/src/lib/storage/mockAdapter.ts`
- `web/public/data/output` or replacement local data root
- helper scripts under `web/scripts/` if needed

## Acceptance Criteria

- A user can place a dataset under the documented path and see papers appear in the library
- Paper index no longer depends on hardcoded fallback IDs

## Dependencies

- Read-only `/api/ocr/*` routes

## Risks

- If OCR generation code lives outside this repo, this issue should stay read-only/import-focused
```

## Issue 7

**Title**

`self-host: remove cloud and private runtime defaults`

**Suggested labels**

`self-host`, `p0`, `infra`, `docs`

**Body**

```md
## Problem

Several modules still default to `prismer.cloud` or a private model gateway address, which breaks the self-host promise.

## Scope

- Remove or neutralize cloud defaults
- Prefer explicit env vars and documented local defaults
- Audit SDKs and runtime config for self-host-safe defaults

## Files

- `docker/docker-entrypoint-openclaw.sh`
- `sdk/mcp/src/lib/client.ts`
- `sdk/openclaw-channel/src/api-client.ts`
- `sdk/openclaw-channel/src/accounts.ts`

## Acceptance Criteria

- Default runtime config does not point to `prismer.cloud`
- Default model gateway config does not point to a private IP
- Self-host docs are consistent with runtime defaults

## Dependencies

None

## Risks

- Some examples or tests may still silently depend on cloud URLs
```

## Issue 8

**Title**

`self-host: add local smoke test for the main user journey`

**Suggested labels**

`self-host`, `p0`, `infra`, `tests`

**Body**

```md
## Problem

Without an explicit self-host smoke test, cloud-only assumptions will keep reappearing.

## Scope

- Add one automated smoke path for local deployment
- Cover at least workspace creation, agent response, artifact creation, asset opening, and OCR read

## Files

- `.github/workflows/*`
- `web/tests/*`
- `docker/*`

## Acceptance Criteria

- A documented or CI-backed smoke test exists
- The smoke test can run against local services without external cloud dependencies

## Dependencies

- P0 self-host data-plane issues should be mostly complete

## Risks

- Overly brittle browser tests may slow iteration unless the scope stays narrow
```

## Issue 9

**Title**

`self-host: make skill installation honest`

**Suggested labels**

`self-host`, `p1`, `backend`, `frontend`

**Body**

```md
## Problem

Skill installation currently updates DB state but does not necessarily install anything usable into the runtime.

## Scope

- Either implement real local install behavior
- Or clearly limit the product to builtin skills and adjust UI/API messaging

## Files

- `web/src/app/api/skills/[id]/install/route.ts`
- `web/src/app/api/skills/route.ts`
- `web/src/app/workspace/components/SkillManager/*`

## Acceptance Criteria

- A successful install means the skill is actually usable
- Or the UI only exposes builtin skills and no misleading install path remains

## Dependencies

None

## Risks

- Runtime install behavior may depend on container lifecycle assumptions not yet formalized
```

## Issue 10

**Title**

`self-host: expose local IM API and ws/sse compatibility layer`

**Suggested labels**

`self-host`, `p1`, `backend`, `infra`

**Body**

```md
## Problem

The repo contains IM models and service logic, but not the full local API surface that SDKs and self-host integrations expect.

## Scope

- Add local `/api/im/*` routes for core messaging flows
- Expose WS/SSE endpoints for local realtime
- Keep scope to single-machine self-host compatibility

## Files

- `web/src/lib/services/im.service.ts`
- `web/src/app/api/im/*`

## Acceptance Criteria

- Local agent and local user messaging work without external IM services
- Core SDK examples can target the self-host base URL

## Dependencies

None

## Risks

- Realtime transport compatibility may expand this beyond a simple CRUD routing task
```

## Issue 11

**Title**

`self-host: make SDKs and plugins first-class for local deployment`

**Suggested labels**

`self-host`, `p1`, `docs`, `sdk`

**Body**

```md
## Problem

Even after local runtime improvements, SDK defaults and examples still assume cloud deployment.

## Scope

- Update SDK defaults and examples
- Add self-host examples for TypeScript, Python, Go, and OpenClaw channel usage

## Files

- `sdk/typescript/*`
- `sdk/python/*`
- `sdk/golang/*`
- `sdk/openclaw-channel/*`

## Acceptance Criteria

- A self-host user can follow docs and target the local deployment directly
- No SDK README implies cloud is the only supported mode

## Dependencies

- Local IM API if IM-facing examples are included

## Risks

- Docs may drift again unless self-host examples are tested periodically
```

## Issue 12

**Title**

`self-host: hide or gate demo and mock paths`

**Suggested labels**

`self-host`, `p2`, `frontend`

**Body**

```md
## Problem

Several components still surface demo or mock behaviors that can be confused with real product capability.

## Scope

- Move demo-only behaviors behind an explicit flag
- Keep default user paths on real functionality

## Files

- `web/src/components/editors/jupyter/components/JupyterNotebook.tsx`
- `web/src/components/editors/previews/latex-agent/components/AgentChatPanel.tsx`
- `web/src/components/playground/registry.ts`

## Acceptance Criteria

- Default self-host flows do not rely on mock data
- Demo functionality remains available for development when explicitly enabled

## Dependencies

- Core self-host data plane should already be working

## Risks

- Some demo code may currently be hiding missing real functionality
```

## Issue 13

**Title**

`self-host: rewrite oss self-host documentation`

**Suggested labels**

`self-host`, `p2`, `docs`

**Body**

```md
## Problem

Current docs still blur the line between the OSS self-host package and cloud/platform capabilities.

## Scope

- Rewrite README and self-hosting docs around the actual local product
- Document local storage, OCR dataset path, asset behavior, and skill limitations

## Files

- `README.md`
- `docs/self-hosting/README.md`
- `docs/CONTRIB.md`

## Acceptance Criteria

- Docs clearly describe what works in self-host mode
- Setup instructions do not assume cloud services or private infrastructure

## Dependencies

- P0 self-host functionality should be stable enough to document

## Risks

- Documentation will be misleading again if it lands before runtime defaults are fixed
```

## Suggested Creation Order

1. Issue 2
2. Issue 3
3. Issue 4
4. Issue 5
5. Issue 6
6. Issue 1
7. Issue 7
8. Issue 8
9. Issue 9
10. Issue 10
11. Issue 11
12. Issue 12
13. Issue 13
