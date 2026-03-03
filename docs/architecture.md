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

## Deployment Options

- **Self-Hosted** — All data stays on your infrastructure via Docker containers
- **Full Platform** — Complete research workspace with multi-agent orchestration
