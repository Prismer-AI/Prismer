# 开源优化 Phase 0 + Phase 1 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 清除所有阻止外部开发者 build 成功的硬性阻塞（Phase 0），完成开源合规文档和公开镜像发布（Phase 1）。

**Architecture:** 自底向上逐文件清理 12 个 hardcoded 云端 URL，将默认值从私有地址替换为公开可达地址。所有修改为纯字符串替换 + 环境变量读取，不引入新依赖。合规文档直接创建在根目录。

**Tech Stack:** Next.js 16 (TypeScript) · Docker · Shell · Prisma 6

**Design Doc:** `docs/plans/2026-03-02-opensource-optimization-design.md`

---

## Phase 0：扫雷

### Task 1: 清除私有 LLM 默认端点

**Files:**
- Modify: `docker/config/openclaw.json:13`
- Modify: `docker/docker-compose.openclaw.yml:47`
- Modify: `docker/docker-entrypoint-openclaw.sh:101`

**Step 1: 替换 openclaw.json 中的私有 IP**

将 `docker/config/openclaw.json` line 13：
```json
"baseUrl": "http://34.60.178.0:3000/v1"
```
替换为：
```json
"baseUrl": "${OPENAI_API_BASE_URL:-https://api.openai.com/v1}"
```

**Step 2: 替换 docker-compose.openclaw.yml 中的默认值**

将 `docker/docker-compose.openclaw.yml` line 47：
```yaml
OPENAI_API_BASE_URL: ${OPENAI_API_BASE_URL:-http://34.60.178.0:3000/v1}
```
替换为：
```yaml
OPENAI_API_BASE_URL: ${OPENAI_API_BASE_URL:-https://api.openai.com/v1}
```

**Step 3: 替换 docker-entrypoint-openclaw.sh 中的默认值**

将 `docker/docker-entrypoint-openclaw.sh` line 101：
```bash
local model_base_url="${OPENAI_API_BASE_URL:-http://34.60.178.0:3000/v1}"
```
替换为：
```bash
local model_base_url="${OPENAI_API_BASE_URL:-https://api.openai.com/v1}"
```

**Step 4: 验证无残留**

Run: `grep -r "34.60.178.0" docker/ --include="*.json" --include="*.yml" --include="*.sh"`
Expected: 无输出（docker/README.md 中的引用在 Task 后续清理）

**Step 5: Commit**

```bash
git add docker/config/openclaw.json docker/docker-compose.openclaw.yml docker/docker-entrypoint-openclaw.sh
git commit -m "fix(opensource): replace private LLM endpoint with OpenAI default"
```

---

### Task 2: 清除默认模型名

**Files:**
- Modify: `docker/config/openclaw.json`
- Modify: `docker/docker-entrypoint-openclaw.sh`

**Step 1: 查找私有模型名**

Run: `grep -rn "us-kimi" docker/`
记录所有出现位置。

**Step 2: 替换 openclaw.json 中的模型名**

将所有 `us-kimi-k2.5` 替换为 `gpt-4o`，`us-kimi-k2-turbo-preview` 替换为 `gpt-4o-mini`。

**Step 3: 替换 entrypoint 中的模型名**

在 `docker/docker-entrypoint-openclaw.sh` 中做同样替换。

**Step 4: 验证无残留**

Run: `grep -rn "us-kimi" docker/`
Expected: 无输出

**Step 5: Commit**

```bash
git add docker/config/openclaw.json docker/docker-entrypoint-openclaw.sh
git commit -m "fix(opensource): replace private model names with standard OpenAI models"
```

---

### Task 3: 清除 prismer.cloud 默认值

**Files:**
- Modify: `docker/config/openclaw.json:29`
- Modify: `docker/docker-entrypoint-openclaw.sh:103`
- Modify: `docker/plugin/prismer-workspace/src/tools.ts:1606`
- Modify: `docker/plugin/prismer-workspace/skills/find-skills/index.ts:87-88`

**Step 1: 替换 openclaw.json 中的 IM server URL**

将 `docker/config/openclaw.json` line 29：
```json
"imServerUrl": "${PRISMER_IM_SERVER_URL:-https://prismer.cloud}"
```
替换为：
```json
"imServerUrl": "${PRISMER_IM_SERVER_URL:-}"
```

空值表示 Local 模式下不连接 IM server。prismer-im plugin 检测到空值时应 skip 初始化。

**Step 2: 替换 entrypoint 中的 IM server URL**

将 `docker/docker-entrypoint-openclaw.sh` line 103：
```bash
local im_server_url="${PRISMER_IM_SERVER_URL:-https://prismer.cloud}"
```
替换为：
```bash
local im_server_url="${PRISMER_IM_SERVER_URL:-}"
```

**Step 3: 替换 tools.ts 中的 base URL**

将 `docker/plugin/prismer-workspace/src/tools.ts` line 1606：
```typescript
return process.env.PRISMER_BASE_URL || 'https://prismer.cloud';
```
替换为：
```typescript
return process.env.PRISMER_BASE_URL || 'http://localhost:3000';
```

**Step 4: 替换 find-skills 中的 registry URL**

将 `docker/plugin/prismer-workspace/skills/find-skills/index.ts` lines 87-88：
```typescript
const SKILL_REGISTRY_URL =
  process.env.PRISMER_SKILL_REGISTRY_URL || 'https://prismer.cloud/api/skills';
```
替换为：
```typescript
const SKILL_REGISTRY_URL =
  process.env.PRISMER_SKILL_REGISTRY_URL || 'http://localhost:3000/api/skills';
```

**Step 5: 验证无残留**

Run: `grep -rn "prismer\.cloud" docker/ --include="*.ts" --include="*.json" --include="*.sh" --include="*.yml"`
Expected: 无输出（仅 README.md 中可能残留说明文字）

**Step 6: Commit**

```bash
git add docker/config/openclaw.json docker/docker-entrypoint-openclaw.sh \
  docker/plugin/prismer-workspace/src/tools.ts \
  docker/plugin/prismer-workspace/skills/find-skills/index.ts
git commit -m "fix(opensource): replace prismer.cloud defaults with localhost for local mode"
```

---

### Task 4: CDN URL 环境变量化

**Files:**
- Modify: `src/app/api/ocr/[arxivId]/[file]/route.ts:24`
- Modify: `src/app/api/ocr/[arxivId]/images/route.ts:17`
- Modify: `src/app/api/ocr/[arxivId]/images/[filename]/route.ts:20`
- Modify: `src/app/api/v2/papers/[id]/thumbnail/route.ts:18`
- Modify: `src/app/api/v2/assets/[id]/content/route.ts:181`
- Modify: `src/app/api/v2/assets/[id]/process/route.ts:114`
- Modify: `src/lib/s3.ts:36`
- Modify: `src/lib/services/paper.service.ts:334`
- Create: `tests/unit/lib/cdn-config.test.ts`

**Step 1: 写测试 — 验证 CDN domain 从环境变量读取**

```typescript
// tests/unit/lib/cdn-config.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('CDN Domain Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use CDN_DOMAIN env var when set', () => {
    process.env.CDN_DOMAIN = 'cdn.example.com';
    // getCdnDomain 从 s3.ts 导入
    const { getCdnDomain } = require('@/lib/s3');
    expect(getCdnDomain()).toBe('cdn.example.com');
  });

  it('should return empty string when no CDN configured', () => {
    delete process.env.CDN_DOMAIN;
    delete process.env.NEXT_PUBLIC_CDN_DOMAIN;
    const { getCdnDomain } = require('@/lib/s3');
    expect(getCdnDomain()).toBe('');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/lib/cdn-config.test.ts`
Expected: FAIL — 当前 `getCdnDomain()` 返回 `'cdn.prismer.app'` 而非空字符串

**Step 3: 修改 s3.ts — 移除 hardcoded fallback**

将 `src/lib/s3.ts` line 36：
```typescript
return process.env.CDN_DOMAIN || process.env.NEXT_PUBLIC_CDN_DOMAIN || 'cdn.prismer.app';
```
替换为：
```typescript
return process.env.CDN_DOMAIN || process.env.NEXT_PUBLIC_CDN_DOMAIN || '';
```

**Step 4: 修改 OCR routes — 统一使用 env**

将 `src/app/api/ocr/[arxivId]/[file]/route.ts` line 24：
```typescript
const DEFAULT_CDN_DOMAIN = 'cdn.prismer.ai';
```
替换为：
```typescript
const DEFAULT_CDN_DOMAIN = process.env.CDN_DOMAIN || '';
```

对 `src/app/api/ocr/[arxivId]/images/route.ts` line 17 和 `src/app/api/ocr/[arxivId]/images/[filename]/route.ts` line 20 做同样替换。

**Step 5: 修改 thumbnail route**

将 `src/app/api/v2/papers/[id]/thumbnail/route.ts` line 18：
```typescript
const CDN_BASE = 'https://cdn.prismer.ai';
```
替换为：
```typescript
const CDN_BASE = process.env.CDN_DOMAIN ? `https://${process.env.CDN_DOMAIN}` : '';
```

在使用 `CDN_BASE` 的地方增加空值检查，CDN 不可用时返回 404：
```typescript
if (!CDN_BASE) {
  return NextResponse.json({ error: 'CDN not configured' }, { status: 404 });
}
```

**Step 6: 修改 assets content route**

将 `src/app/api/v2/assets/[id]/content/route.ts` line 181：
```typescript
const parserCdnBase = `https://cdn.prismer.ai/parser/${asset.ocrTaskId}/`;
```
替换为：
```typescript
const cdnDomain = process.env.CDN_DOMAIN;
if (!cdnDomain) {
  return NextResponse.json({ error: 'CDN not configured for OCR content' }, { status: 404 });
}
const parserCdnBase = `https://${cdnDomain}/parser/${asset.ocrTaskId}/`;
```

**Step 7: 修改 assets process route**

将 `src/app/api/v2/assets/[id]/process/route.ts` line 114：
```typescript
pdfUrl = `https://cdn.prismer.ai/${asset.pdfS3Key}`;
```
替换为：
```typescript
const cdnDomain = process.env.CDN_DOMAIN;
pdfUrl = cdnDomain ? `https://${cdnDomain}/${asset.pdfS3Key}` : '';
```

**Step 8: 修改 paper.service.ts**

将 `src/lib/services/paper.service.ts` line 334：
```typescript
url: f.s3Key ? `https://cdn.prismer.app/${f.s3Key}` : undefined,
```
替换为：
```typescript
url: f.s3Key && process.env.CDN_DOMAIN ? `https://${process.env.CDN_DOMAIN}/${f.s3Key}` : undefined,
```

**Step 9: 运行测试确认通过**

Run: `npx vitest run tests/unit/lib/cdn-config.test.ts`
Expected: PASS

**Step 10: 验证无残留**

Run: `grep -rn "cdn\.prismer\." src/ --include="*.ts" --include="*.tsx"`
Expected: 无输出

**Step 11: Commit**

```bash
git add src/app/api/ocr/ src/app/api/v2/papers/ src/app/api/v2/assets/ \
  src/lib/s3.ts src/lib/services/paper.service.ts \
  tests/unit/lib/cdn-config.test.ts
git commit -m "fix(opensource): replace all cdn.prismer.ai/app hardcodes with CDN_DOMAIN env var"
```

---

### Task 5: Dev 用户 email 可配置化

**Files:**
- Modify: `src/app/workspace/page.tsx:25`
- Modify: `src/app/workspace/[workspaceId]/page.tsx:28`
- Modify: `src/app/api/workspace/route.ts:23`
- Modify: `src/app/api/workspace/[id]/route.ts:25`
- Modify: `src/app/api/v2/notebooks/route.ts:23,29,83,89`
- Modify: `src/app/api/v2/papers/[id]/favorite/route.ts:16,22`
- Modify: `src/app/api/v2/papers/[id]/like/route.ts:16,22`
- Create: `src/lib/dev-user.ts`

**Step 1: 创建集中的 dev user 配置**

```typescript
// src/lib/dev-user.ts
export const DEV_USER_EMAIL = process.env.DEV_USER_EMAIL || 'dev@localhost';
```

**Step 2: 替换所有 dev@prismer.app**

在以下文件中，将 `'dev@prismer.app'` 替换为从 `@/lib/dev-user` 导入的 `DEV_USER_EMAIL`：

- `src/app/workspace/page.tsx` line 25
- `src/app/workspace/[workspaceId]/page.tsx` line 28
- `src/app/api/workspace/route.ts` line 23
- `src/app/api/workspace/[id]/route.ts` line 25

每个文件顶部添加：
```typescript
import { DEV_USER_EMAIL } from '@/lib/dev-user';
```

将 `email: 'dev@prismer.app'` 替换为 `email: DEV_USER_EMAIL`。

**Step 3: 替换所有 dev@prismer.ai**

在以下文件中做同样替换（`'dev@prismer.ai'` → `DEV_USER_EMAIL`）：

- `src/app/api/v2/notebooks/route.ts` lines 23, 29, 83, 89
- `src/app/api/v2/papers/[id]/favorite/route.ts` lines 16, 22
- `src/app/api/v2/papers/[id]/like/route.ts` lines 16, 22

**Step 4: 验证无残留**

Run: `grep -rn "dev@prismer" src/ --include="*.ts" --include="*.tsx"`
Expected: 无输出（prisma/seed.ts 保留不动——种子数据中的默认值可接受）

**Step 5: Commit**

```bash
git add src/lib/dev-user.ts src/app/workspace/ src/app/api/workspace/ \
  src/app/api/v2/notebooks/ src/app/api/v2/papers/
git commit -m "fix(opensource): centralize dev user email to DEV_USER_EMAIL env var"
```

---

### Task 6: @prismer/sdk 条件依赖

**Files:**
- Modify: `package.json:56`
- Modify: `src/lib/services/im.service.ts`

**Step 1: 移动 @prismer/sdk 到 optionalDependencies**

在 `package.json` 中，将 line 56：
```json
"@prismer/sdk": "^1.7.0",
```
从 `dependencies` 中删除，并添加到 `optionalDependencies` 中：
```json
"optionalDependencies": {
  "@prismer/sdk": "^1.7.0"
}
```

**Step 2: 在 im.service.ts 中添加安全导入保护**

在 `src/lib/services/im.service.ts` 中，如果文件中有任何从 `@prismer/sdk` 的 import，将其改为 dynamic import + try/catch：

```typescript
// 替换静态 import
// import { PrismerIM } from '@prismer/sdk';

// 改为动态 import
let PrismerIM: any = null;
try {
  const sdk = await import('@prismer/sdk');
  PrismerIM = sdk.PrismerIM;
} catch {
  // @prismer/sdk not installed — IM features disabled in local mode
}
```

如果 im.service.ts 不直接 import @prismer/sdk（从探索结果看只 import prisma），则检查其他可能引用 SDK 的文件并做同样保护。

**Step 3: 验证 npm install 无报错**

Run: `npm install`
Expected: SUCCESS（optionalDependencies 安装失败时不阻塞）

**Step 4: 验证 build 成功**

Run: `npm run build`
Expected: SUCCESS（无 SDK 时 IM 功能降级但不崩溃）

**Step 5: Commit**

```bash
git add package.json src/lib/services/im.service.ts
git commit -m "fix(opensource): move @prismer/sdk to optionalDependencies for local mode"
```

---

### Task 7: Phase 0 最终验证

**Step 1: 全量扫描残留**

Run: `grep -rn "34\.60\.178\.0\|prismer\.cloud\|cdn\.prismer\.\|dev@prismer\.\|us-kimi" src/ docker/ --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.sh" | grep -v node_modules | grep -v ".md"`
Expected: 无输出（.md 文档中的引用可接受）

**Step 2: Build 验证**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Lint 验证**

Run: `npm run lint`
Expected: SUCCESS 或仅有预存 warning（无新增 error）

---

## Phase 1：合规与镜像

### Task 8: 创建 LICENSE 文件

**Files:**
- Create: `LICENSE`

**Step 1: 创建 Apache-2.0 LICENSE**

在项目根目录创建 `LICENSE` 文件，内容为 Apache License Version 2.0 全文。

Copyright 行：
```
Copyright 2024-2026 Prismer.AI Contributors
```

**Step 2: 更新 README.md 中的 License 引用**

找到 README.md 中关于 "dual licensing" 或 "Business Source License" 的描述，替换为：

```markdown
## License

This project is licensed under the [Apache License 2.0](LICENSE).
```

**Step 3: 更新 package.json license 字段**

确认 `package.json` 中的 `"license"` 字段为 `"Apache-2.0"`。

**Step 4: Commit**

```bash
git add LICENSE README.md package.json
git commit -m "docs(opensource): add Apache-2.0 LICENSE file"
```

---

### Task 9: 创建根目录 CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`
- Read reference: `docs/CONTRIB.md`

**Step 1: 创建 CONTRIBUTING.md**

```markdown
# Contributing to Prismer

Thank you for considering contributing to Prismer! This document provides guidelines for contributing.

## Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/prismer.git`
3. Copy environment file: `cp .env.docker.example .env`
4. Add your OpenAI API key to `.env`: `OPENAI_API_KEY=sk-...`
5. Start services: `docker compose -f docker/docker-compose.openclaw.yml up -d`
6. Install dependencies: `npm install`
7. Setup database: `npm run db:generate && npm run db:push`
8. Start dev server: `npm run dev`
9. Open http://localhost:3000

## Development Guides

- **Architecture overview:** see `docs/ARCH.md`
- **Detailed contributor guide:** see `docs/CONTRIB.md`
- **Operations runbook:** see `docs/RUNBOOK.md`
- **Local development paths:** see `docs/LOCAL_DEV.md` (coming soon)

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
- Prettier for formatting

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
```

**Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs(opensource): add root CONTRIBUTING.md"
```

---

### Task 10: 创建 CODE_OF_CONDUCT.md

**Files:**
- Create: `CODE_OF_CONDUCT.md`

**Step 1: 创建 Contributor Covenant v2.1**

创建 `CODE_OF_CONDUCT.md`，内容为 [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) 全文。

Contact method: `opensource@prismer.ai`

**Step 2: Commit**

```bash
git add CODE_OF_CONDUCT.md
git commit -m "docs(opensource): add Contributor Covenant Code of Conduct"
```

---

### Task 11: 创建 SECURITY.md

**Files:**
- Create: `SECURITY.md`

**Step 1: 创建安全策略文件**

```markdown
# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. Email: security@prismer.ai
3. Include: description, reproduction steps, potential impact
4. We will acknowledge within 48 hours
5. We will provide a fix timeline within 7 days

## Scope

- Authentication and authorization flaws
- SQL injection, XSS, CSRF vulnerabilities
- Container escape or privilege escalation
- Secret/credential exposure
- Dependency vulnerabilities (critical/high severity)
```

**Step 2: Commit**

```bash
git add SECURITY.md
git commit -m "docs(opensource): add SECURITY.md vulnerability reporting policy"
```

---

### Task 12: 轻量版 Dockerfile

**Files:**
- Create: `docker/base/Dockerfile.lite`
- Read reference: `docker/base/Dockerfile`

**Step 1: 创建 Dockerfile.lite**

基于现有 `docker/base/Dockerfile`，创建裁剪版 `docker/base/Dockerfile.lite`：

```dockerfile
# Prismer Academic Base Image — Lite Edition
# Target: < 4GB, < 20 min build
# Includes: Ubuntu 24.04 + Node 22 + Python 3.12 + TeXLive (basic) + Jupyter

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# System packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget git ca-certificates gnupg \
    build-essential python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# TeXLive — scheme-basic + academic essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-base texlive-latex-base texlive-latex-recommended \
    texlive-latex-extra texlive-fonts-recommended texlive-fonts-extra \
    texlive-science texlive-bibtex-extra biber \
    texlive-publishers latexmk \
    && rm -rf /var/lib/apt/lists/*

# Python scientific stack
RUN pip3 install --no-cache-dir --break-system-packages \
    jupyter notebook numpy pandas matplotlib scipy \
    sympy scikit-learn seaborn plotly

# Workspace directory
RUN mkdir -p /workspace/.prismer /workspace/.openclaw/directives
WORKDIR /workspace

LABEL org.opencontainers.image.title="prismer-academic-lite" \
      org.opencontainers.image.description="Lightweight academic research container (TeXLive basic + Python + Jupyter)" \
      org.opencontainers.image.version="5.0-lite"
```

**Step 2: 验证 build**

Run: `docker build -f docker/base/Dockerfile.lite -t prismer-academic:v5.0-lite docker/base/`
Expected: SUCCESS，镜像 < 4GB

**Step 3: Commit**

```bash
git add docker/base/Dockerfile.lite
git commit -m "feat(docker): add lightweight base image Dockerfile (< 4GB, no R/Coq/Lean4)"
```

---

### Task 13: docker-compose.lite.yml

**Files:**
- Create: `docker/docker-compose.lite.yml`
- Read reference: `docker/docker-compose.openclaw.yml`

**Step 1: 创建 lite 版 compose 文件**

基于 `docker/docker-compose.openclaw.yml`，创建 `docker/docker-compose.lite.yml`：

```yaml
# Prismer Local Mode — Lightweight single-container setup
# Usage: docker compose -f docker/docker-compose.lite.yml up -d

services:
  prismer-agent:
    build:
      context: .
      dockerfile: Dockerfile.openclaw
      args:
        BASE_IMAGE: prismer-academic:v5.0-lite
    ports:
      - "${AGENT_PORT:-16888}:3000"
      - "${JUPYTER_PORT:-18888}:8888"
      - "${LATEX_PORT:-18080}:8080"
    environment:
      - LOCAL_MODE=true
      - STATIC_AGENT_ENABLED=true
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_API_BASE_URL=${OPENAI_API_BASE_URL:-https://api.openai.com/v1}
      - AGENT_DEFAULT_MODEL=${AGENT_DEFAULT_MODEL:-gpt-4o}
      - PRISMER_API_BASE_URL=http://host.docker.internal:3000
      - PRISMER_AGENT_ID=${PRISMER_AGENT_ID:-local-agent-001}
    volumes:
      - prismer-workspace:/workspace
    restart: unless-stopped

volumes:
  prismer-workspace:
```

**Step 2: Commit**

```bash
git add docker/docker-compose.lite.yml
git commit -m "feat(docker): add docker-compose.lite.yml for local mode single-container setup"
```

---

### Task 14: 更新 .env.docker.example

**Files:**
- Modify: `.env.docker.example`

**Step 1: 更新环境变量模板**

确保 `.env.docker.example` 包含以下内容（按重要性分组，注释清晰）：

```bash
# ===========================================
# Prismer Local Mode Configuration
# ===========================================

# --- Required ---
OPENAI_API_KEY=sk-your-key-here          # Your OpenAI API key

# --- Optional: LLM Configuration ---
# OPENAI_API_BASE_URL=https://api.openai.com/v1   # Default: OpenAI. Change for Anthropic, local LLM, etc.
# AGENT_DEFAULT_MODEL=gpt-4o                       # Default model for agent

# --- Optional: Database ---
DATABASE_URL=file:./prisma/dev.db                   # SQLite for local dev
# DATABASE_URL=mysql://user:pass@host:3306/prismer  # MySQL for production

# --- Optional: Auth ---
NEXTAUTH_SECRET=your-secret-here-change-in-production
NEXTAUTH_URL=http://localhost:3000

# --- Optional: Agent ---
# STATIC_AGENT_ENABLED=true                         # Use env-based agent config (no DB lookup)
# PRISMER_AGENT_ID=local-agent-001

# --- Optional: CDN (for paper OCR/thumbnails) ---
# CDN_DOMAIN=cdn.example.com                        # Leave unset for local-only mode

# --- Optional: Dev User ---
# DEV_USER_EMAIL=dev@localhost                       # Default dev user email
```

**Step 2: Commit**

```bash
git add .env.docker.example
git commit -m "docs(opensource): update .env.docker.example with clear grouping and defaults"
```

---

### Task 15: docker/README.md 清理

**Files:**
- Modify: `docker/README.md`

**Step 1: 替换 README 中的私有 IP 引用**

在 `docker/README.md` 中搜索 `34.60.178.0` 和 `docker.prismer.dev`，替换为通用的占位符或公开地址。

将所有 `http://34.60.178.0:3000/v1` 替换为 `https://api.openai.com/v1`。
将所有 `docker.prismer.dev/...` 替换为 `ghcr.io/prismer/...`。

**Step 2: 在 README 顶部新增 Quick Start (Local Mode)**

```markdown
## Quick Start (Local Mode)

```bash
# 1. Build lite base image (first time only, ~15 min)
docker build -f docker/base/Dockerfile.lite -t prismer-academic:v5.0-lite docker/base/

# 2. Start agent container
cp .env.docker.example .env
# Edit .env — add your OPENAI_API_KEY
docker compose -f docker/docker-compose.lite.yml up -d

# 3. Start frontend
npm install && npm run db:generate && npm run db:push && npm run dev
```
```

**Step 3: Commit**

```bash
git add docker/README.md
git commit -m "docs(opensource): clean private URLs from docker README, add local mode quick start"
```

---

### Task 16: Phase 1 最终验证

**Step 1: 全量验证 — clean clone 模拟**

```bash
# 模拟外部开发者流程
npm install                    # 无 @prismer/sdk 报错
npm run db:generate            # Prisma generate 成功
npm run db:push                # SQLite schema push 成功
npm run build                  # Next.js build 成功
npm run lint                   # Lint 通过
```

**Step 2: Docker 验证**

```bash
docker build -f docker/base/Dockerfile.lite -t prismer-academic:v5.0-lite docker/base/
# 验证镜像大小 < 4GB
docker images prismer-academic:v5.0-lite --format "{{.Size}}"
```

**Step 3: 文件完整性检查**

```bash
# 合规文档存在
ls LICENSE CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md
# Docker 文件存在
ls docker/base/Dockerfile.lite docker/docker-compose.lite.yml
```

---

## 任务依赖图

```
Phase 0（可全部并行，互不依赖）:
  Task 1 (LLM endpoint)  ──┐
  Task 2 (Model names)   ──┤
  Task 3 (prismer.cloud) ──┼── Task 7 (Final verify)
  Task 4 (CDN URLs)      ──┤
  Task 5 (Dev email)     ──┤
  Task 6 (@prismer/sdk)  ──┘

Phase 1（Phase 0 完成后开始，内部可并行）:
  Task 8 (LICENSE)        ──┐
  Task 9 (CONTRIBUTING)   ──┤
  Task 10 (CODE_OF_CONDUCT)─┤
  Task 11 (SECURITY)      ──┼── Task 16 (Final verify)
  Task 12 (Dockerfile.lite)─┤
  Task 13 (compose.lite)  ──┤
  Task 14 (.env.example)  ──┤
  Task 15 (docker README) ──┘
```

**Phase 0 的 Task 1-6 互不依赖，可全部并行。**
**Phase 1 的 Task 8-15 互不依赖，可全部并行。**

---

## 验收标准

Phase 0 + Phase 1 完成标志：

- [ ] `grep -rn "34\.60\.178\.0\|prismer\.cloud\|cdn\.prismer\.\|dev@prismer\.\|us-kimi" src/ docker/ --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.sh"` 无输出
- [ ] `npm install` 在无 @prismer/sdk 的环境下成功
- [ ] `npm run build` 成功
- [ ] `LICENSE` 文件存在且内容为 Apache-2.0
- [ ] `CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`SECURITY.md` 存在
- [ ] `docker build -f docker/base/Dockerfile.lite` 成功且镜像 < 4GB
- [ ] `.env.docker.example` 包含清晰分组的所有必要/可选环境变量
- [ ] 所有默认值指向公开可达服务（OpenAI API、localhost）
