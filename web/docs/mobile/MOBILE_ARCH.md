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

# MOBILE_ARCH — Mobile Engineering Architecture

> Version: 2.0.0
> Last updated: 2026-02-21
> Status: Planning (Mobile development on hold)
> Supersedes: docs/PRD.md (partial), docs/MOBILE_UX_DESIGN.md
> See also: docs/ARCH.md (Desktop/Web architecture)

---

## 1. Platform Strategy

### 1.1 Product Matrix

```
┌─────────────────────────────────────────────────────────────┐
│                    Prismer 产品矩阵 v2.0                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Desktop/Web (主力 - 已完成)                                 │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ • 完整功能 (Discovery/Assets/Workspace)              │   │
│   │ • 多窗口 Workspace + 8 编辑器组件                    │   │
│   │ • 深度研究和创作 (PDF/LaTeX/Jupyter/Code)           │   │
│   │ • 1024px+ 优化布局                                   │   │
│   └─────────────────────────────────────────────────────┘   │
│                          ↕ 数据同步                          │
│   Mobile (辅助 - 待开发)                                     │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ • 核心功能 (Command/Files/Me)                        │   │
│   │ • 灵感捕捉 (拍照识别/语音输入)                        │   │
│   │ • 任务监控和快速操作                                  │   │
│   │ • 触控优化交互                                        │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   优势:                                                      │
│   ✅ 一套代码库 (Tauri 2 跨平台)                             │
│   ✅ 体验一致 (跨端无缝切换)                                 │
│   ✅ 数据同步 (Cloud SDK IM)                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Desktop vs Mobile Feature Matrix

| Feature | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| **Discovery** | Full (HeroCarousel + PaperGrid) | Merged into Command | AI-powered recommendations |
| **Assets** | Full (Grid + Collections) | Simplified as Files | Quick access + upload |
| **Workspace** | Full (8 editors + Timeline) | Task monitoring only | No editor execution |
| **Chat** | WorkspaceChat panel | Command center | Primary interface |
| **PDF Reader** | Full reader + annotations | Preview + basic view | Full read on desktop |
| **LaTeX** | Full editor + compile | View only | Edit on desktop |
| **Jupyter** | Full notebook + kernel | View outputs only | Execute on desktop |
| **AI Chat** | Context-aware + tools | Same + voice/camera | Mobile-specific inputs |
| **Upload** | Drag & drop | Camera + Gallery + Files | Mobile sources |
| **Offline** | SQLite cache | SQLite + IndexedDB | Both supported |

### 1.3 Architecture Decision: Module Consolidation

**V1 (MOBILE_UX_DESIGN.md)**: 4 tabs - Discovery / Asset / Chat / Me
**V2 (Adopted)**: 3 tabs - Command / Files / Me

**Rationale**:
1. **Discovery → Command**: Mobile users primarily interact via AI assistant. Paper discovery becomes AI-powered recommendations within Command.
2. **Asset → Files**: Simplified naming, focus on file access rather than "asset management"
3. **Chat → Command**: Chat is the primary interface on mobile, rename to "Command" to reflect its control center role
4. **Workspace**: No dedicated mobile tab - tasks monitored via Command, edits done on desktop

---

## 2. Tech Stack

### 2.1 Shared Stack (Desktop + Mobile)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js (App Router) | 16 | Standalone output |
| UI Runtime | React + React Compiler | 19 | Shared components |
| Language | TypeScript | 5 | Strict mode |
| State | Zustand | 5 | Shared stores |
| Styling | Tailwind CSS + shadcn/ui | 4 | Responsive design |
| ORM | Prisma (SQLite) | 6 | Offline-first |
| Auth | NextAuth v5 | beta.30 | JWT strategy |
| Validation | Zod | 4 | Schema validation |
| Animation | framer-motion | - | Gesture support |
| Desktop/Mobile | Tauri 2 | 2 | Native shell |

### 2.2 Mobile-Specific Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Native Shell | Tauri 2 iOS/Android | WKWebView (iOS), WebView (Android) |
| Camera | @tauri-apps/plugin-camera | Native camera access |
| Voice | @tauri-apps/plugin-speech | Speech recognition |
| Haptics | @tauri-apps/plugin-haptics | Touch feedback |
| Push | @tauri-apps/plugin-notification | Background notifications |
| Storage | @tauri-apps/plugin-store | Secure local storage |
| File Picker | @tauri-apps/plugin-dialog | Native file dialogs |
| Share | @tauri-apps/plugin-share | System share sheet |

### 2.3 Responsive Breakpoints

```typescript
// src/lib/responsive.ts
export const breakpoints = {
  mobile: { max: 767 },      // < 768px: Single column + bottom tabs
  tablet: { min: 768, max: 1023 },  // 768-1023px: Two column + side tabs
  desktop: { min: 1024 },    // >= 1024px: Full layout
} as const;

export const isMobile = () => window.innerWidth < 768;
export const isTablet = () => window.innerWidth >= 768 && window.innerWidth < 1024;
export const isDesktop = () => window.innerWidth >= 1024;
```

---

## 3. Source Layout

### 3.1 Mobile-Specific Files

```
src/
├── app/
│   ├── mobile/                     # Mobile-specific routes
│   │   ├── layout.tsx              # MobileLayout (bottom tabs)
│   │   ├── command/                # Command center (AI chat)
│   │   │   ├── page.tsx            # Main chat view
│   │   │   ├── components/
│   │   │   │   ├── CommandChat.tsx      # AI chat interface
│   │   │   │   ├── TaskMonitor.tsx      # Active task cards
│   │   │   │   ├── TodaysPicks.tsx      # AI recommendations
│   │   │   │   ├── CaptureSheet.tsx     # Camera/voice capture
│   │   │   │   ├── QuickCommands.tsx    # Command shortcuts
│   │   │   │   └── VoiceInput.tsx       # Voice recording UI
│   │   │   └── store/
│   │   │       └── commandStore.ts      # Command module state
│   │   ├── files/                  # File management
│   │   │   ├── page.tsx            # File browser
│   │   │   ├── [folderId]/         # Folder view
│   │   │   │   └── page.tsx
│   │   │   ├── components/
│   │   │   │   ├── FileList.tsx         # File list/grid view
│   │   │   │   ├── FilePreview.tsx      # Preview sheet
│   │   │   │   ├── QuickAccess.tsx      # Pinned/Recent
│   │   │   │   ├── UploadSheet.tsx      # Upload flow
│   │   │   │   └── StorageCard.tsx      # Storage status
│   │   │   └── store/
│   │   │       └── filesStore.ts        # Files module state
│   │   ├── me/                     # Personal center
│   │   │   ├── page.tsx            # Profile overview
│   │   │   ├── settings/           # Settings pages
│   │   │   ├── agents/             # Agent management
│   │   │   └── components/
│   │   │       ├── ProfileCard.tsx
│   │   │       ├── UsageStats.tsx
│   │   │       ├── SubscriptionCard.tsx
│   │   │       └── AgentList.tsx
│   │   └── components/             # Shared mobile components
│   │       ├── MobileLayout.tsx         # Root layout with tabs
│   │       ├── BottomTabBar.tsx         # Navigation tabs
│   │       ├── MobileHeader.tsx         # Top navigation
│   │       ├── BottomSheet.tsx          # Reusable sheet
│   │       └── SafeArea.tsx             # iOS safe area
│   │
├── components/
│   ├── mobile/                     # Mobile-optimized UI
│   │   ├── MobileButton.tsx        # Touch-optimized button
│   │   ├── MobileCard.tsx          # Mobile card component
│   │   ├── MobileInput.tsx         # Touch keyboard optimized
│   │   ├── MobileSheet.tsx         # Bottom sheet base
│   │   └── GestureHandler.tsx      # Swipe/pull gestures
│   │
├── lib/
│   ├── mobile/                     # Mobile utilities
│   │   ├── camera.ts               # Camera capture
│   │   ├── voice.ts                # Voice recognition
│   │   ├── haptics.ts              # Haptic feedback
│   │   ├── share.ts                # System share
│   │   └── gestures.ts             # Gesture detection
│   │
└── store/
    └── mobileStore.ts              # Mobile-specific global state
```

### 3.2 Shared vs Mobile-Specific

| Component | Shared | Mobile-Only | Notes |
|-----------|--------|-------------|-------|
| UI primitives (shadcn) | ✅ | - | Same components |
| PaperCard | ✅ | MobilePaperCard | Simplified for mobile |
| ChatInput | ✅ | + VoiceInput | Voice extension |
| FileList | - | ✅ | Mobile-first design |
| TaskPanel | ✅ | TaskMonitor | Adapted for cards |
| MessageList | ✅ | - | Same component |
| ReaderOverlay | ✅ | MobileReader | Simplified |
| AssetStore | ✅ | - | Shared data layer |
| IM Service | ✅ | - | Shared backend |

---

## 4. Routing

### 4.1 Mobile Route Structure

```
/mobile                         # Mobile root
├── /command                    # Command center (default)
│   ├── /                       # Main chat view
│   ├── /task/[taskId]          # Task detail
│   └── /paper/[paperId]        # Paper detail (from recommendations)
├── /files                      # File management
│   ├── /                       # Home (recent + quick access)
│   ├── /folder/[folderId]      # Folder contents
│   ├── /search                 # File search
│   └── /upload                 # Upload flow
├── /me                         # Personal center
│   ├── /                       # Profile overview
│   ├── /settings               # Settings
│   ├── /agents                 # Agent management
│   └── /subscription           # Subscription/billing
└── /auth                       # Auth (shared)
```

### 4.2 Platform Detection

```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || '';
  const isTauriMobile = request.headers.get('tauri-platform')?.includes('mobile');
  const isMobileUA = /iPhone|iPad|Android/i.test(ua);

  // Auto-redirect mobile users
  if ((isTauriMobile || isMobileUA) && !request.nextUrl.pathname.startsWith('/mobile')) {
    if (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/library') {
      return NextResponse.redirect(new URL('/mobile/command', request.url));
    }
  }

  return NextResponse.next();
}
```

---

## 5. State Management

### 5.1 Mobile-Specific Stores

| Store | Location | Purpose |
|-------|----------|---------|
| `mobileStore` | `src/store/` | Platform detection, safe areas, orientation |
| `commandStore` | `src/app/mobile/command/store/` | Chat state, tasks, recommendations |
| `filesStore` | `src/app/mobile/files/store/` | File list, upload progress, offline status |

### 5.2 Shared Stores (Reused from Desktop)

| Store | Location | Mobile Usage |
|-------|----------|--------------|
| `authStore` | `app/global/store/` | Same auth state |
| `assetStore` | `app/assets/store/` | File data layer |
| `readerStore` | `app/global/store/` | Paper reading state |
| `workspaceStore` | `app/workspace/stores/` | Task monitoring only |

### 5.3 Offline State Sync

```typescript
// Mobile → Desktop sync via IM
interface MobileSyncEvent {
  type: 'file_upload' | 'task_command' | 'paper_save';
  payload: Record<string, unknown>;
  timestamp: number;
  offline: boolean; // Queued while offline
}

// Queued when offline, sent when online
const offlineQueue: MobileSyncEvent[] = [];
```

---

## 6. Data Flow

### 6.1 Mobile ↔ Desktop Sync

```
┌────────────────────────────────────────────────────────────────┐
│                      Sync Architecture                          │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Mobile                              Desktop                   │
│   ┌──────────────────┐               ┌──────────────────┐      │
│   │ commandStore     │               │ workspaceStore   │      │
│   │ • tasks (read)   │←───────────── │ • tasks (write)  │      │
│   │ • messages       │───────────────│ • messages       │      │
│   │ • commands       │───────────────│ • agentEvents    │      │
│   └────────┬─────────┘               └────────┬─────────┘      │
│            │                                   │                 │
│            ▼                                   ▼                 │
│   ┌──────────────────┐               ┌──────────────────┐      │
│   │ useIMSync        │               │ useIMSync        │      │
│   │ (message persist)│───────────────│ (message persist)│      │
│   └────────┬─────────┘               └────────┬─────────┘      │
│            │                                   │                 │
│            └─────────────┬─────────────────────┘                │
│                          ▼                                       │
│            ┌──────────────────────────┐                         │
│            │  Cloud IM Backend        │                         │
│            │  (Prismer SDK / Local)   │                         │
│            │  • Message persistence   │                         │
│            │  • Task notifications    │                         │
│            │  • File sync events      │                         │
│            └──────────────────────────┘                         │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 Mobile-Specific Data Flows

**Camera Capture Flow:**
```
Camera → Tauri Plugin → Image Data → OCR API → Text
                                         ↓
                                   AI Analysis → Chat Message
```

**Voice Input Flow:**
```
Microphone → Tauri Plugin → Audio Data → Speech-to-Text
                                              ↓
                                        Text → Chat Input
```

**Offline File Upload:**
```
File Selection → Local Queue → Background Upload → S3
                     ↓                              ↓
               SQLite Cache              Asset Service → IM Notify
```

---

## 7. Mobile-Specific Features

### 7.1 Camera OCR Pipeline

```typescript
// src/lib/mobile/camera.ts
export interface CaptureResult {
  image: Uint8Array;
  width: number;
  height: number;
  timestamp: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  boundingBoxes: BoundingBox[];
}

export async function captureAndOCR(): Promise<OCRResult> {
  const capture = await invoke<CaptureResult>('capture_image');
  const result = await fetch('/api/ocr', {
    method: 'POST',
    body: capture.image,
  });
  return result.json();
}
```

### 7.2 Voice Recognition

```typescript
// src/lib/mobile/voice.ts
export interface VoiceSession {
  id: string;
  isRecording: boolean;
  transcript: string;
  duration: number;
}

export function useVoiceInput() {
  const [session, setSession] = useState<VoiceSession | null>(null);

  const startRecording = async () => {
    const id = await invoke<string>('start_voice_recording');
    setSession({ id, isRecording: true, transcript: '', duration: 0 });

    // Real-time transcription updates
    listen<string>('voice:transcript', (event) => {
      setSession(s => s ? { ...s, transcript: event.payload } : null);
    });
  };

  const stopRecording = async () => {
    if (!session) return;
    await invoke('stop_voice_recording', { id: session.id });
    setSession(s => s ? { ...s, isRecording: false } : null);
  };

  return { session, startRecording, stopRecording };
}
```

### 7.3 Push Notifications

```typescript
// src/lib/mobile/notifications.ts
export interface TaskNotification {
  taskId: string;
  title: string;
  body: string;
  progress?: number;
  actions?: NotificationAction[];
}

export async function showTaskProgress(task: TaskNotification) {
  await invoke('show_notification', {
    id: `task-${task.taskId}`,
    title: task.title,
    body: task.body,
    ongoing: task.progress !== undefined && task.progress < 100,
    progress: task.progress,
    actions: task.actions,
  });
}
```

---

## 8. Offline Support

### 8.1 Offline Data Strategy

| Data Type | Offline Storage | Sync Strategy |
|-----------|-----------------|---------------|
| Messages | SQLite | Bidirectional sync on reconnect |
| Files (metadata) | SQLite | Incremental sync |
| Files (content) | Tauri FS | On-demand download |
| Tasks | SQLite | Read-only cache |
| User profile | SQLite | Pull on app launch |
| Recommendations | SQLite | Cache with TTL (24h) |

### 8.2 Offline Queue

```typescript
// src/lib/mobile/offlineQueue.ts
interface QueuedOperation {
  id: string;
  type: 'send_message' | 'upload_file' | 'save_paper';
  payload: unknown;
  createdAt: number;
  retryCount: number;
}

export class OfflineQueue {
  private queue: QueuedOperation[] = [];

  async add(op: Omit<QueuedOperation, 'id' | 'createdAt' | 'retryCount'>) {
    const item = {
      ...op,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      retryCount: 0,
    };
    this.queue.push(item);
    await this.persist();
  }

  async processWhenOnline() {
    const isOnline = navigator.onLine;
    if (!isOnline) return;

    for (const op of this.queue) {
      try {
        await this.execute(op);
        this.queue = this.queue.filter(o => o.id !== op.id);
      } catch (e) {
        op.retryCount++;
        if (op.retryCount > 3) {
          this.queue = this.queue.filter(o => o.id !== op.id);
        }
      }
    }
    await this.persist();
  }
}
```

---

## 9. Performance Guidelines

### 9.1 Mobile-Specific Optimizations

| Area | Guideline |
|------|-----------|
| Bundle Size | Code-split by route, lazy load heavy components |
| Images | Use responsive images, WebP format, lazy loading |
| Lists | Virtual scrolling for >50 items |
| Animations | Use CSS transforms, avoid layout thrashing |
| State | Minimize re-renders, use selectors |
| Network | Cache API responses, offline-first |
| Touch | 44x44pt minimum touch targets |

### 9.2 Performance Budgets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Bundle Size (initial) | < 200KB gzipped |
| Bundle Size (total) | < 500KB gzipped |
| Memory Usage | < 150MB |
| Touch Response | < 100ms |

---

## 10. Version Management

### 10.1 Documentation Versions

| Document | Version | Status |
|----------|---------|--------|
| MOBILE_ARCH.md | 2.0.0 | Current |
| MOBILE_DESIGN.md | 2.0.0 | Current |
| MOBILE_ROADMAP.md | 2.0.0 | Current |
| MOBILE_TODO.md | 2.0.0 | Current |
| PRD.md (Genspark) | 2.0.0 | Reference (partially superseded) |
| MOBILE_UX_DESIGN.md | 1.0.0 | Superseded by v2.0 docs |

### 10.2 Changelog

**v2.0.0 (2026-02-21)**
- Consolidated from PRD.md and MOBILE_UX_DESIGN.md
- Adopted 3-tab structure (Command/Files/Me) from PRD
- Integrated detailed UI patterns from MOBILE_UX_DESIGN
- Added mobile-specific tech stack documentation
- Created separated mobile documentation hierarchy
- Defined clear Desktop vs Mobile feature matrix

**v1.0.0 (2026-02-21)**
- Initial MOBILE_UX_DESIGN.md with 4-tab structure
- Based on desktop feature mirroring approach

---

## References

- Desktop Architecture: `docs/ARCH.md`
- Desktop Design: `docs/DESIGN.md`
- Cloud SDK: `/Users/prismer/workspace/Prismer/sdk/typescript/README.md`
- Tauri 2 Mobile: https://tauri.app/v2/mobile/
