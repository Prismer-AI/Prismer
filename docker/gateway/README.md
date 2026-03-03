# Container Gateway

> Zero-dependency Node.js reverse proxy for container-internal services

**Version:** 1.1.0
**SSoT:** `docker/gateway/version.mjs`
**Runtime:** Node.js (ESM)
**Port:** 3000 (internal), mapped to host via Docker port binding

## Overview

`container-gateway.mjs` is a single-file HTTP server (367 lines, zero npm dependencies) that routes incoming requests to five internal container services by URL prefix. It also provides aggregated health checks, per-service statistics with token tracking, and version reporting.

## Service Routing

| Route Prefix | Target | Port | Description |
|-------------|--------|------|-------------|
| `/api/v1/latex/*` | LaTeX Service | 8080 | TeXLive compilation (pdflatex, xelatex, lualatex) |
| `/api/v1/prover/*` | Prover Service | 8081 | Theorem proving (Coq + Z3) |
| `/api/v1/jupyter/*` | Jupyter Service | 8888 | Python notebook execution |
| `/api/v1/gateway/*` | OpenClaw Gateway | 18900 | Agent WebSocket + API |
| `/api/v1/arxiv/*` | arXiv Service | 8082 | Paper conversion (arxiv-to-prompt) |

## Management Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `GET /` | GET | Gateway info + component versions (from `versions-manifest.json`) |
| `GET /api/v1/health` | GET | Aggregated health (all services, HTTP 200 or 503) |
| `GET /api/v1/health/:service` | GET | Individual service probe (status + latency) |
| `GET /api/v1/stats` | GET | Per-service request/latency/error stats + token tracking + WebSocket stats |

### Health Check

```bash
# Single service health
curl http://localhost:3000/api/v1/health/latex
# → {"status":"up","latency_ms":12}

# Aggregate health (all services)
curl http://localhost:3000/api/v1/health
# → {"status":"healthy","services":{"latex":{"status":"up"},...},"uptime_s":3600}
```

Returns HTTP 200 if all services up, 503 if any service is degraded/down.

### Stats

```bash
curl http://localhost:3000/api/v1/stats
# → {
#     uptime, total_requests, total_errors, error_rate,
#     services: { [name]: { requests, errors, latency_avg_ms, latency_max_ms, status_codes } },
#     tokens: { total_requests, prompt_tokens, completion_tokens, total_tokens, models: {} },
#     websockets: { upgrades, active }
#   }
```

### Version Reporting

```bash
curl http://localhost:3000/
# → { gateway: "1.1.0", image: "4.5", components: { ... } }
```

Returns `versions-manifest.json` (baked into image at `/opt/prismer/versions.json`) for frontend version compatibility checking.

## Features

- **WebSocket Support:** Full HTTP/1.1 Upgrade relay for real-time connections
- **Jupyter Auth:** Auto-injects `JUPYTER_TOKEN` into proxied requests
- **CORS:** Allows all origins and methods
- **Per-Service Stats:** Request count, error count, latency (avg/max), status code distribution
- **Token Tracking:** Per-model prompt/completion token counts
- **Logging:** Per-request response time logging to stdout
- **Error Handling:** Graceful timeout (30s) and connection error responses

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_PORT` | `3000` | Listen port |
| `JUPYTER_TOKEN` | `""` | Jupyter auth token for API requests |

## Architecture

```
Host (dynamic port)              Container (:3000)
  │                                ┌──────────────────────────┐
  │  /api/v1/latex/*               │  container-gateway.mjs   │
  ├───────────────────────────────→│    → 127.0.0.1:8080      │
  │  /api/v1/jupyter/*             │    → 127.0.0.1:8888      │
  ├───────────────────────────────→│    → 127.0.0.1:18900     │
  │  /api/v1/gateway/*             │    → 127.0.0.1:8081      │
  │  /api/v1/arxiv/*               │    → 127.0.0.1:8082      │
  │  /api/v1/health                │  aggregated health check │
  │  /api/v1/stats                 │  per-service statistics  │
  │  /                             │  version manifest        │
  └───────────────────────────────→│                          │
                                   └──────────────────────────┘
```

## Changelog

### 1.1.0 (2026-02-25)
- Added `/api/v1/stats` endpoint (per-service request/latency/error + token tracking + WebSocket stats)
- Added version reporting at `/` (reads `versions-manifest.json`)
- Version management with `version.mjs` SSoT file

### 1.0.0 (2026-02-16)
- Initial release: 5-service reverse proxy
- Aggregated and per-service health checks
- WebSocket relay support
- Jupyter token auto-injection
