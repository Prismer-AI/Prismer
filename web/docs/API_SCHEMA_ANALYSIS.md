<!--
 Copyright 2026 prismer

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

# API Schema Analysis — Cloud SDK v1.7 Integration

> Last updated: 2026-02-20
> Purpose: Analyze gaps between Container plugins, TS Backend API, Frontend Workspace, and Cloud SDK v1.7

---

## 1. Executive Summary

### 1.1 Plugin Redevelopment Recommendation

| Plugin | Current State | Recommendation | Effort |
|--------|--------------|----------------|--------|
| **prismer-im** | Custom WebSocket to IM Server | **Refactor** to use `@prismer/sdk` IM API | Medium |
| **prismer-workspace** | Skill plugin with 12+ tools | **Enhance** with SDK Context/Parse APIs | Low |

### 1.2 Key Findings

1. **prismer-im** duplicates functionality now available in Cloud SDK
2. **prismer-workspace** skills are container-local; need frontend skill registry
3. **No unified skill discovery/installation mechanism** exists
4. **Gap between container Gateway ↔ Frontend WebSocket** for realtime events

---

## 2. Plugin Analysis

### 2.1 prismer-im Plugin (Needs Refactor)

**Current Implementation** (`docker/plugin/prismer-im/src/channel.ts`):
```typescript
// Custom WebSocket connection
this.ws = new WebSocket(wsUrl);
this.ws.on('message', (data) => this.handleMessage(data));

// Custom heartbeat mechanism
setInterval(() => this.sendHeartbeat(), 30000);

// Custom message types
interface IMMessage {
  id: string;
  type: 'text' | 'markdown' | 'code' | 'image' | 'file' | 'tool_call' | 'tool_result';
  content: string;
  senderId: string;
  conversationId: string;
  metadata?: Record<string, unknown>;
}
```

**Cloud SDK v1.7 Equivalent**:
```typescript
import { PrismerClient } from '@prismer/sdk';

const client = new PrismerClient({ token: agentToken });

// Built-in WebSocket with auto-reconnect
const ws = await client.im.realtime.connectWS();
ws.on('message.new', handleMessage);

// Built-in heartbeat (handled internally)
// Type-safe message sending
await client.im.messages.send({
  conversationId,
  type: 'text',
  content: '...',
  metadata: { ... }
});
```

**Migration Path**:
1. Replace custom WebSocket with `client.im.realtime.connectWS()`
2. Replace message handling with SDK event listeners
3. Use SDK types for `IMMessage`, `IMConversation`, etc.
4. Remove heartbeat logic (SDK handles it)
5. **Keep** prismer-specific extensions: `sendDirective`, `sendSkillEvent`

**Breaking Changes**:
- None for OpenClaw Agent side (abstracted by plugin interface)
- Frontend needs to align with SDK message types

### 2.2 prismer-workspace Plugin (Enhance Only)

**Current Implementation** (`docker/plugin/prismer-workspace/src/skill.ts`):
```typescript
export const prismerWorkspaceSkill: Skill = {
  name: 'prismer-workspace',
  description: 'Academic workspace tools for Prismer.AI',
  tools: [
    // LaTeX tools
    { name: 'latex_compile', description: '...', parameters: {...}, execute: async (params) => {...} },
    { name: 'latex_preview', ... },

    // Jupyter tools
    { name: 'jupyter_execute', ... },
    { name: 'jupyter_create_cell', ... },

    // PDF tools
    { name: 'pdf_extract_text', ... },
    { name: 'pdf_get_sections', ... },

    // UI control
    { name: 'ui_show_component', ... },
    { name: 'ui_send_directive', ... },

    // arXiv
    { name: 'arxiv_to_prompt', ... },
  ]
};
```

**Enhancement with Cloud SDK**:
```typescript
import { PrismerClient } from '@prismer/sdk';

// Use Context API for paper loading
{
  name: 'load_paper_context',
  execute: async ({ arxivUrl }) => {
    const client = new PrismerClient();
    const content = await client.load(arxivUrl);
    return content.hqcc; // High-Quality Compressed Content
  }
}

// Use Parse API for PDF processing
{
  name: 'parse_pdf',
  execute: async ({ pdfUrl }) => {
    const client = new PrismerClient();
    return await client.parsePdf(pdfUrl);
  }
}
```

**No Breaking Changes** — additive enhancement only.

---

## 3. Skill Management Design

### 3.1 find-skills Skill (New)

Following the [Vercel skills pattern](https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md):

**SKILL.md** (`docker/plugin/prismer-workspace/skills/find-skills/SKILL.md`):
```markdown
# find-skills

Discover and install skills for Prismer.AI academic workspace.

## Usage

"Find a skill for bibliography management"
"Install the latex-cite skill"
"List all available skills"

## Process

1. **Identify** user's need (search query or category)
2. **Search** skill registry (local + cloud)
3. **Present** matching skills with descriptions
4. **Install** selected skill to workspace

## Tools

- `skill_search`: Search skill registry
- `skill_info`: Get detailed skill information
- `skill_install`: Install skill to current workspace
- `skill_list`: List installed skills
- `skill_uninstall`: Remove skill from workspace
```

**Implementation** (`docker/plugin/prismer-workspace/skills/find-skills/index.ts`):
```typescript
export const findSkillsSkill: Skill = {
  name: 'find-skills',
  description: 'Discover and manage skills for Prismer.AI workspace',
  tools: [
    {
      name: 'skill_search',
      description: 'Search for skills by name or capability',
      parameters: {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', enum: ['latex', 'jupyter', 'pdf', 'citation', 'data', 'writing'] }
      },
      execute: async ({ query, category }) => {
        // Search local registry + cloud skill store
        const results = await searchSkillRegistry(query, category);
        return results;
      }
    },
    {
      name: 'skill_install',
      description: 'Install a skill to the current workspace',
      parameters: {
        skillId: { type: 'string', description: 'Skill ID or package name' }
      },
      execute: async ({ skillId }) => {
        // Download and install skill
        // Update workspace skill manifest
        return await installSkill(skillId);
      }
    },
    {
      name: 'skill_list',
      description: 'List all installed skills in current workspace',
      execute: async () => {
        return await listInstalledSkills();
      }
    }
  ]
};
```

### 3.2 Skill Registry Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Skill Registry                              │
├─────────────────────────────────────────────────────────────────┤
│  Local Registry          │  Cloud Registry                      │
│  (WorkspaceFile)         │  (Prismer Cloud API)                 │
│                          │                                       │
│  /workspace/skills/      │  GET /api/skills?q=...               │
│    ├── latex-cite/       │  GET /api/skills/:id                 │
│    ├── data-viz/         │  POST /api/skills/:id/install        │
│    └── find-skills/      │                                       │
├─────────────────────────────────────────────────────────────────┤
│                    Skill Manifest Format                         │
│  {                                                               │
│    "id": "latex-cite",                                          │
│    "name": "LaTeX Citation Manager",                            │
│    "version": "1.0.0",                                          │
│    "description": "...",                                        │
│    "category": "latex",                                         │
│    "tools": ["cite_search", "cite_format", "bib_manage"],       │
│    "dependencies": ["prismer-workspace"],                       │
│    "installPath": "/workspace/skills/latex-cite"                │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Skill Management Page (Frontend)

**Route**: `/workspace/settings/skills` or modal in workspace

**Components**:
```
src/app/workspace/components/SkillManager/
├── SkillManagerDialog.tsx      # Modal container
├── SkillSearch.tsx             # Search input + filters
├── SkillGrid.tsx               # Grid of skill cards
├── SkillCard.tsx               # Individual skill card
├── SkillDetails.tsx            # Detailed view with tools
├── InstalledSkills.tsx         # List of installed skills
└── SkillInstallProgress.tsx    # Installation progress
```

**UI Wireframe**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Skill Manager                                          [Close] │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐  ┌──────────────────┐ │
│  │ 🔍 Search skills...                 │  │ Category ▼       │ │
│  └─────────────────────────────────────┘  └──────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Installed (3)                                                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐         │
│  │ 📦 latex-cite │ │ 📦 data-viz   │ │ 📦 find-skills│         │
│  │ v1.0.0        │ │ v2.1.0        │ │ v1.0.0        │         │
│  │ [Uninstall]   │ │ [Uninstall]   │ │ [Built-in]    │         │
│  └───────────────┘ └───────────────┘ └───────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│  Available (12)                                                 │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐         │
│  │ 📄 bib-sync   │ │ 📊 stats-help │ │ 🔬 method-gen │         │
│  │ Sync Zotero   │ │ Stats assist  │ │ Methods sect  │         │
│  │ [Install]     │ │ [Install]     │ │ [Install]     │         │
│  └───────────────┘ └───────────────┘ └───────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Gap Analysis

### 4.1 Container ↔ TS Backend API

| Layer | Current State | Gap | Resolution |
|-------|--------------|-----|------------|
| **Gateway** | Unified proxy on 16888 | ✅ Working | — |
| **LaTeX** | /api/v1/latex/* | ✅ Working | — |
| **Jupyter** | /api/v1/jupyter/* | ✅ Working | — |
| **arXiv** | /api/v1/arxiv/* | ✅ Working | — |
| **OpenClaw Gateway** | /api/v1/gateway/* | 🔶 Basic | Need auth proxy |
| **IM Integration** | Custom WebSocket | 🔴 Gap | Migrate to SDK |
| **Skill Registry** | Not implemented | 🔴 Gap | New API needed |

**Required TS API Additions**:
```typescript
// New routes
GET  /api/skills                    // List available skills
GET  /api/skills/:id                // Get skill details
POST /api/skills/:id/install        // Install skill to workspace
DELETE /api/skills/:id              // Uninstall skill
GET  /api/workspace/:id/skills      // List workspace installed skills

// Existing route enhancement
GET  /api/workspace/:id/agent       // Add skills[] to response
```

### 4.2 TS Backend API ↔ Frontend

| Feature | Backend API | Frontend | Gap |
|---------|------------|----------|-----|
| **Workspace CRUD** | /api/workspace | workspaceStore | ✅ Aligned |
| **Agent Status** | /api/agents/:id/status | AgentStatusBadge | ✅ Aligned |
| **Messages** | /api/workspace/:id/messages | MessageList | ✅ Aligned |
| **Skills** | Not implemented | Not implemented | 🔴 Both needed |
| **Realtime Events** | WebSocket sync | useAgentConnection | 🔶 Need SDK alignment |
| **UIDirectives** | WorkspaceMessage.uiDirectives | componentStore | ✅ Aligned |

**Required Frontend Additions**:
```typescript
// New store
src/store/skillStore.ts
  - availableSkills: Skill[]
  - installedSkills: Skill[]
  - fetchSkills()
  - installSkill(id)
  - uninstallSkill(id)

// New components
src/app/workspace/components/SkillManager/

// New hooks
src/lib/hooks/useSkills.ts
```

### 4.3 Frontend ↔ Cloud SDK

| SDK Feature | Current Frontend Use | Gap |
|------------|---------------------|-----|
| **Context API** | Not used | Need paper loading integration |
| **Parse API** | Local OCR API | Should fallback to SDK |
| **IM Realtime** | Custom WebSocket | Should migrate to SDK |
| **IM Messages** | Custom types | Should align with SDK types |
| **Webhook** | Not applicable | Backend only |
| **Offline Mode** | Not used | Future enhancement |

---

## 5. Implementation Roadmap

### Phase 1: Plugin Alignment (Week 1-2)

1. **prismer-im Refactor**
   - [ ] Add `@prismer/sdk` to plugin dependencies
   - [ ] Replace custom WebSocket with `client.im.realtime.connectWS()`
   - [ ] Migrate message types to SDK types
   - [ ] Keep prismer-specific extensions (directives, skill events)
   - [ ] Test with existing container setup

2. **prismer-workspace Enhancement**
   - [ ] Add Context API integration for paper loading
   - [ ] Add Parse API integration for PDF processing
   - [ ] Keep existing tools unchanged

### Phase 2: Skill System (Week 2-3)

1. **Backend**
   - [ ] Create `/api/skills` routes
   - [ ] Add skills[] to AgentInstance/Workspace models
   - [ ] Implement skill registry (local file + future cloud)

2. **Container**
   - [ ] Create `find-skills` skill with SKILL.md
   - [ ] Implement skill search/install/list tools
   - [ ] Integrate with OpenClaw skill loading

3. **Frontend**
   - [ ] Create skillStore
   - [ ] Create SkillManager components
   - [ ] Integrate into workspace settings

### Phase 3: Full SDK Integration (Week 3-4)

1. **IM Migration**
   - [ ] Replace frontend custom WebSocket with SDK
   - [ ] Align message types across stack
   - [ ] Test realtime events end-to-end

2. **Context/Parse Integration**
   - [ ] Use SDK for paper content loading
   - [ ] Fallback Parse API for OCR

---

## 6. Type Alignment Reference

### 6.1 Message Types

**Current (prismer-im)**:
```typescript
interface IMMessage {
  id: string;
  type: 'text' | 'markdown' | 'code' | 'image' | 'file' | 'tool_call' | 'tool_result';
  content: string;
  senderId: string;
  conversationId: string;
  metadata?: Record<string, unknown>;
}
```

**Cloud SDK v1.7**:
```typescript
interface IMMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'markdown' | 'code' | 'image' | 'file' | 'tool_call' | 'tool_result' | 'system_event' | 'thinking';
  content: string;
  metadata: MessageMetadata;
  parentId?: string;       // Threading support
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: string;
  updatedAt: string;
}
```

**Migration**: SDK type is superset; current code compatible with minor additions.

### 6.2 Skill Types

**Proposed Standard**:
```typescript
interface Skill {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'latex' | 'jupyter' | 'pdf' | 'citation' | 'data' | 'writing' | 'general';
  tools: SkillTool[];
  dependencies: string[];
  author?: string;
  repository?: string;
  installPath?: string;  // Set after installation
}

interface SkillTool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
}
```

---

## 7. File Changes Summary

### New Files

```
docker/plugin/prismer-workspace/skills/find-skills/
├── SKILL.md
├── index.ts
└── registry.ts

src/app/api/skills/
├── route.ts                 # GET list, POST create
└── [id]/
    ├── route.ts             # GET, DELETE
    └── install/route.ts     # POST install

src/store/skillStore.ts
src/lib/hooks/useSkills.ts

src/app/workspace/components/SkillManager/
├── SkillManagerDialog.tsx
├── SkillSearch.tsx
├── SkillGrid.tsx
├── SkillCard.tsx
├── SkillDetails.tsx
└── InstalledSkills.tsx
```

### Modified Files

```
docker/plugin/prismer-im/package.json      # Add @prismer/sdk
docker/plugin/prismer-im/src/channel.ts    # Refactor to use SDK
docker/plugin/prismer-workspace/src/skill.ts  # Add SDK integrations

prisma/schema.prisma                        # Add skills field to AgentInstance

src/app/workspace/stores/workspaceStore.ts  # Add skills state
src/app/workspace/components/WorkspaceChat/ChatHeader.tsx  # Add skills button
```

---

## 8. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| SDK breaking changes | High | Pin to v1.7.x, monitor releases |
| Plugin backward compatibility | Medium | Keep existing APIs, add new methods |
| Skill installation security | High | Sandbox skills, validate manifests |
| Realtime migration downtime | Medium | Dual-mode support during transition |

---

## Appendix A: Cloud SDK v1.7 Quick Reference

```typescript
import { PrismerClient } from '@prismer/sdk';

// Initialize
const client = new PrismerClient({
  baseUrl: process.env.PRISMER_BASE_URL,
  apiKey: process.env.PRISMER_API_KEY,
});

// Context API
const content = await client.load(arxivUrl);
const results = await client.search(query, { ranking: 'cache_first' });
await client.save({ url, hqcc });

// Parse API
const parsed = await client.parsePdf(pdfUrl);
const doc = await client.parse(url, { output: 'markdown' });

// IM API
const ws = await client.im.realtime.connectWS();
ws.on('message.new', handleMessage);
await client.im.messages.send({ conversationId, type: 'text', content });

// Workspace binding
const wsBinding = await client.im.workspace.init({
  workspaceId,
  userId,
  userDisplayName,
});
```
