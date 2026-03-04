# Self-Hosting Prismer

This guide helps you choose the right deployment option for your situation.

## Decision Tree

Are you a single researcher running Prismer on your own laptop?
- Yes, and I want to develop or modify the frontend -> [Local Development](local-dev.md)
- Yes, I just want to run it -> [Single Container](single-container.md)

Are you deploying for a lab or team on a dedicated server?
- Yes -> [Full Stack Deployment](full-stack.md)

## Deployment Options at a Glance

| Option | Compose File | Frontend | Agent | Best For |
|--------|-------------|----------|-------|----------|
| [Local Dev](local-dev.md) | `docker-compose.dev.yml` | Host (npm run dev) | Container | Frontend development |
| [Single Container](single-container.md) | `docker-compose.lite.yml` | Container | Container | Personal use, quick setup |
| [Full Stack](full-stack.md) | `docker-compose.openclaw.yml` | Container | Container | Lab servers, shared deployment |

## Prerequisites (All Options)

- Docker 24+ with Docker Compose v2
- An OpenAI-compatible API key (OpenAI, Azure, vLLM, Ollama, LiteLLM)
- The Prismer repository cloned locally

## Environment Setup (Common First Step)

All deployment options share the same `.env` file at the repository root:

```bash
cd /path/to/Prismer
cp .env.example .env
```

Edit `.env` and set at minimum:

```
OPENAI_API_KEY=sk-your-api-key-here
NEXTAUTH_SECRET=<output of: openssl rand -base64 32>
```

See `.env.example` for the full list of options.

## Port Reference

| Port | Service | Notes |
|------|---------|-------|
| 3000 | Next.js frontend | All options except local-dev |
| 16888 | Container gateway | Unified entry point for agent services |
| 18888 | Jupyter | Direct access in single-container mode |
| 18080 | LaTeX | Direct access in single-container mode |

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues across all deployment options.
