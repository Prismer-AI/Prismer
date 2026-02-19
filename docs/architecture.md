# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Prismer.AI Frontend                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ Library     │  │ Jupyter     │  │ LaTeX       │  │ Paper Reader   │  │
│  │ (Discovery) │  │ (Analysis)  │  │ (Writing)   │  │ (Reading)      │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────────┘  │
│                              │ SSE Stream                                │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                     Agent Panel / Chat Interface                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Agent Orchestrator                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐ │
│  │ Build  │ │ Plan   │ │ Lit.   │ │ Data   │ │ Paper  │ │ Reviewer   │ │
│  │ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │ │ Agent      │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────────┘ │
│                              │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Tools: arxiv_search | latex_compile | execute_code | citation_verify ││
│  └─────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Skills: literature_review | data_analysis | paper_writing           ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
            │  LLM Provider │ │ Sandbox       │ │  Storage      │
            │  (Claude,     │ │ (E2B/Docker/  │ │  (S3, Qdrant, │
            │   GPT-4, etc) │ │  WebContainer)│ │   PostgreSQL) │
            └───────────────┘ └───────────────┘ └───────────────┘
```

## Design Principles

### 1. Multi-Agent Architecture

Specialized agents collaborate on complex research tasks, rather than relying on a single monolithic LLM. Each agent has:
- Specific domain expertise
- Defined tool access
- Clear responsibility boundaries

### 2. Phase-Based Execution

Research is broken into phases with mandatory checkpoints:

```
Literature Review → Data Analysis → Writing → Review
```

Each phase must complete before the next begins, ensuring quality control.

### 3. Citation Verification Pipeline

Every reference passes through verification before appearing in your paper:

```
Citation → CrossRef Check → Semantic Scholar → arXiv Validation → ✓ Verified
```

### 4. Knowledge-Grounded RAG

Papers you read are indexed with precise anchors, enabling accurate citations:

```
"The attention mechanism..." → (Vaswani et al., 2017, p.4)
```

## SDK Architecture (v1.7.0)

The Context Cloud SDK provides a comprehensive client library with offline-first capabilities:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Application Layer                               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Client API: load(), save(), parsePdf(), im.*, realtime.*        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Offline Manager                                                  │   │
│  │ • Outbox Queue (pending operations)                              │   │
│  │ • Sync Engine (event reconciliation)                             │   │
│  │ • Conflict Resolution (server/client/custom)                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Storage Layer                                                    │   │
│  │ • MemoryStorage (in-process Map)                                 │   │
│  │ • IndexedDBStorage (browser persistent)                          │   │
│  │ • SQLiteStorage (Node.js/React Native)                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Security Layer                                                   │   │
│  │ • E2E Encryption (AES-256-GCM)                                   │   │
│  │ • Key Exchange (ECDH P-256)                                      │   │
│  │ • Webhook Verification (HMAC-SHA256)                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Transport Layer                                                  │   │
│  │ • HTTP/REST (Context, Parse, IM APIs)                            │   │
│  │ • WebSocket (Real-time messaging)                                │   │
│  │ • SSE (Server-sent events)                                       │   │
│  │ • File Upload (Presign + S3)                                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Features:

- **Offline-First**: All write operations go through an outbox queue, enabling work without connectivity
- **Pluggable Storage**: Choose between memory, IndexedDB, or SQLite based on your platform
- **E2E Encryption**: Optional end-to-end encryption for sensitive conversations
- **Multi-Tab Coordination**: BroadcastChannel-based leadership election prevents duplicate sync
- **Webhook Handlers**: Framework-specific adapters for Express, Hono, Flask, FastAPI, and more

## Cloud Integration

Components can optionally connect to Prismer Cloud:

| Component | Cloud Feature | Benefit |
|-----------|--------------|---------|
| Paper Reader | Context API | Sync annotations across devices |
| LaTeX Editor | Context API | Cloud storage, version history |
| Academic Tools | Context Cache | Fast metadata caching |
| Agent Protocol | Agent Comm + IM API | Multi-agent context sharing with messaging |
| SDK Offline Mode | Sync API | Automatic reconciliation when online |
| SDK File Upload | Presign API | Secure S3 uploads with quota management |

**Deployment Options:**
- **Self-Hosted** — All data stays on your infrastructure
- **Cloud Sync** — Annotations sync via Prismer Cloud
- **Full Platform** — Complete research workspace with offline resilience
