# Self-Host Progress — 2026-04-22

## Summary

Today focused on making the OSS self-host path less cloud-dependent and documenting the current state before pausing.

Branch:

- `fix/update-org-name`

Existing pushed checkpoint from earlier today:

- `94ff6e0` `feat(web): add local assets and multi-workspace flow`

## Completed Today

### Pushed Earlier

- restored multi-workspace behavior for the local owner model
- added local asset and collection models
- added `/api/v2/assets` compatibility routes
- switched note and artifact persistence to local-first storage

### Implemented Locally Today

- changed SDK defaults to prefer local self-host base URLs instead of `prismer.cloud`
- made MCP and OpenClaw channel clients omit `Authorization` when no `PRISMER_API_KEY` is present
- aligned TypeScript, Python, and Go CLI defaults to `local`
- replaced private model gateway defaults in Docker/OpenClaw config with standard OpenAI-compatible defaults

## Validation

Passed:

- `python3 -m py_compile sdk/python/prismer/*.py`
- `go test ./... -run '^$'`
- `bash -n docker/docker-entrypoint-openclaw.sh`
- `jq -c . docker/config/openclaw.json`

Previously passed for the workspace/data-plane checkpoint:

- `npm run build` in `web`
- local smoke for workspace creation, notes save, assets listing, asset file fetch, collection lookup, and `/workspace` redirect

## Current Gaps

- `sdk/mcp` full build not rerun successfully in this checkout because local Node dependencies such as `tsup` are missing
- `sdk/typescript` full build not rerun successfully for the same reason
- `sdk/openclaw-channel` standalone typecheck is blocked by missing local package dependencies in the current checkout
- OCR routes and local OCR dataset indexing are still not implemented

## Suggested Resume Point

Tomorrow start with:

1. restore or install Node dependencies for `sdk/mcp`, `sdk/typescript`, and `sdk/openclaw-channel`
2. rerun Node build or typecheck for the SDK packages
3. if green, continue to issue `5` and issue `6`

## Files Touched Today

- `sdk/mcp/src/*`
- `sdk/openclaw-channel/src/*`
- `sdk/typescript/src/*`
- `sdk/python/prismer/*`
- `sdk/golang/*`
- `docker/docker-entrypoint-openclaw.sh`
- `docker/config/openclaw.json`
- `docs/plans/*`
