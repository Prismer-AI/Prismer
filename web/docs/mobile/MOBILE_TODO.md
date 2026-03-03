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

# MOBILE_TODO — Mobile Development Tracker

> Version: 2.1.0
> Last updated: 2026-02-22
> Status: **IN PROGRESS** - Phase M0/M1/M2/M3 Core Complete
> Reference: `docs/mobile/MOBILE_ROADMAP.md`, `docs/mobile/MOBILE_ARCH.md`

---

## Current Status

```
┌─────────────────────────────────────────────────────────────────┐
│                      Mobile Development Status                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Desktop/Web:  Phase 4B Complete ✅                              │
│  Mobile:       Phase M0-M3 Core Complete 🚧                      │
│                                                                  │
│  Completed:                                                      │
│  ✅ M0.A Layout System (BottomTabBar, MobileHeader, etc.)        │
│  ✅ M0.B Platform Detection (responsive.ts, mobileStore)         │
│  ✅ M1.A Command Module Core (CommandChat, TaskMonitor)          │
│  ✅ M2.A Files Module Core (FilesHome)                           │
│  ✅ M3.A Me Module Core (MeHome)                                 │
│                                                                  │
│  In Progress:                                                    │
│  🔲 M0.C Component Adaptations                                   │
│  🔲 M1.B-D Advanced Command features                             │
│  🔲 M2.B-D File preview/upload                                   │
│  🔲 M4 Mobile-specific features (Camera, Voice)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase M0 — Foundation (MOSTLY COMPLETE ✅)

> **Status**: Core layout and platform detection complete

### M0.A Layout System

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M0.A1 | Create `MobileLayout.tsx` | ✅ | - | Using existing layout.tsx |
| M0.A2 | Create `BottomTabBar.tsx` | ✅ | - | 3 tabs: Command/Files/Me |
| M0.A3 | Create `MobileHeader.tsx` | ✅ | - | Back/title/actions |
| M0.A4 | Create `SafeAreaView.tsx` | ✅ | - | iOS safe area wrapper |
| M0.A5 | Create `BottomSheet.tsx` | ✅ | - | framer-motion modal |
| M0.A6 | Setup `/mobile/*` routes | ✅ | - | command/files/me routes |

### M0.B Platform Detection

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M0.B1 | Responsive breakpoints | ✅ | - | `src/lib/responsive.ts` |
| M0.B2 | Platform middleware | 🔲 | - | Auto-redirect (optional) |
| M0.B3 | Create `mobileStore.ts` | ✅ | - | `src/store/mobileStore.ts` |
| M0.B4 | Tauri detection | ✅ | - | In mobileStore |

### M0.C Component Adaptations

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M0.C1 | `MobileButton.tsx` | 🔲 | - | 44px touch targets |
| M0.C2 | `MobileCard.tsx` | 🔲 | - | Full-width cards |
| M0.C3 | `MobileInput.tsx` | 🔲 | - | Keyboard-aware |
| M0.C4 | `SwipeAction.tsx` | 🔲 | - | Swipe gestures |
| M0.C5 | `PullToRefresh.tsx` | 🔲 | - | Pull down |

### M0.D Data Layer

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M0.D1 | Mobile SQLite config | 🔲 | - | Tauri plugin-store |
| M0.D2 | Offline queue utility | 🔲 | - | Operation queue |
| M0.D3 | Mobile IM sync | ✅ | - | Reuses `useMobileAgent` |
| M0.D4 | Workspace sync | ✅ | - | Reuses workspaceStore |

---

## Phase M1 — Command Module (CORE COMPLETE ✅)

### M1.A Chat Interface

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M1.A1 | `CommandChat.tsx` | ✅ | - | Main chat view |
| M1.A2 | `MessageBubble.tsx` | ✅ | - | In CommandChat |
| M1.A3 | `ChatInput.tsx` | ✅ | - | In CommandChat |
| M1.A4 | `QuickActions.tsx` | ✅ | - | In CommandChat |
| M1.A5 | `useMobileAgent` integration | ✅ | - | WebSocket reuse |

### M1.B Task Monitoring

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M1.B1 | `TaskMonitor.tsx` | ✅ | - | Collapsible cards |
| M1.B2 | `TaskCard.tsx` | ✅ | - | In TaskMonitor |
| M1.B3 | `TaskDetail.tsx` | 🔲 | - | Full view |
| M1.B4 | Task controls | 🔲 | - | Pause/cancel |
| M1.B5 | Push notifications | 🔲 | - | On complete |

### M1.C Today's Picks

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M1.C1 | `TodaysPicks.tsx` | 🔲 | - | Pull-down UI |
| M1.C2 | `RecommendationCard.tsx` | 🔲 | - | Paper card |
| M1.C3 | API integration | 🔲 | - | Discovery API |
| M1.C4 | Save/Read/AI actions | 🔲 | - | Quick actions |

### M1.D Quick Commands

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M1.D1 | `QuickCommands.tsx` | 🔲 | - | Bottom sheet |
| M1.D2 | Command templates | 🔲 | - | Predefined AI commands |
| M1.D3 | Command history | 🔲 | - | Recent commands |
| M1.D4 | Custom commands | 🔲 | - | User-defined |

---

## Phase M2 — Files Module (CORE COMPLETE ✅)

### M2.A File Browser

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M2.A1 | `FilesHome.tsx` | ✅ | - | Quick access + recent |
| M2.A2 | `FileList.tsx` | ✅ | - | In FilesHome |
| M2.A3 | `FolderView.tsx` | ✅ | - | In FilesHome |
| M2.A4 | `QuickAccess.tsx` | ✅ | - | In FilesHome |
| M2.A5 | File search | 🔲 | - | Full-text search |

### M2.B File Preview

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M2.B1 | `FilePreview.tsx` | 🔲 | - | Bottom sheet |
| M2.B2 | PDF preview | 🔲 | - | First page |
| M2.B3 | Image preview | 🔲 | - | With zoom |
| M2.B4 | Code preview | 🔲 | - | Syntax highlight |
| M2.B5 | File info/actions | 🔲 | - | Metadata + buttons |

### M2.C Upload

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M2.C1 | `UploadSheet.tsx` | 🔲 | - | Source selection |
| M2.C2 | `UploadProgress.tsx` | 🔲 | - | Progress UI |
| M2.C3 | Camera source | 🔲 | - | Direct upload |
| M2.C4 | Photo library | 🔲 | - | PHPicker |
| M2.C5 | Files app | 🔲 | - | Document picker |
| M2.C6 | Cloud import | 🔲 | - | Drive/Dropbox |
| M2.C7 | Background upload | 🔲 | - | App backgrounded |

### M2.D File Operations

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M2.D1 | Multi-select | 🔲 | - | Batch operations |
| M2.D2 | Move/Copy | 🔲 | - | Folder picker |
| M2.D3 | Delete + undo | 🔲 | - | Soft delete |
| M2.D4 | Share sheet | 🔲 | - | System share |
| M2.D5 | Offline download | 🔲 | - | Mark offline |

---

## Phase M3 — Me Module (CORE COMPLETE ✅)

### M3.A Profile

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M3.A1 | `MeHome.tsx` | ✅ | - | Overview |
| M3.A2 | `ProfileCard.tsx` | ✅ | - | In MeHome |
| M3.A3 | `UsageStats.tsx` | ✅ | - | In MeHome |
| M3.A4 | Edit profile | 🔲 | - | Name/avatar |

### M3.B Agent Management

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M3.B1 | `AgentList.tsx` | 🔲 | - | List agents |
| M3.B2 | `AgentDetail.tsx` | 🔲 | - | Config page |
| M3.B3 | Skill management | 🔲 | - | Enable/disable |
| M3.B4 | Memory management | 🔲 | - | View/clear |
| M3.B5 | Personality | 🔲 | - | Tone settings |
| M3.B6 | Add agent | 🔲 | - | Creation flow |

### M3.C Account

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M3.C1 | Subscription | 🔲 | - | Plan + billing |
| M3.C2 | Notifications | 🔲 | - | Preferences |
| M3.C3 | Privacy | 🔲 | - | Password/2FA |
| M3.C4 | Devices | 🔲 | - | Device list |
| M3.C5 | Help | 🔲 | - | FAQ/contact |
| M3.C6 | Sign out | 🔲 | - | Clear data |

---

## Phase M4 — Mobile Features (NOT STARTED)

### M4.A Camera OCR

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M4.A1 | `CameraCapture.tsx` | 🔲 | - | Viewfinder |
| M4.A2 | Document detection | 🔲 | - | Auto-detect |
| M4.A3 | OCR API call | 🔲 | - | Integration |
| M4.A4 | `OCRResult.tsx` | 🔲 | - | Text + edit |
| M4.A5 | AI suggestions | 🔲 | - | Actions |
| M4.A6 | Save result | 🔲 | - | Notes/files |

### M4.B Voice Input

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M4.B1 | `VoiceInput.tsx` | 🔲 | - | Recording UI |
| M4.B2 | Speech plugin | 🔲 | - | Native STT |
| M4.B3 | Live transcription | 🔲 | - | Real-time |
| M4.B4 | Confirm flow | 🔲 | - | Review text |
| M4.B5 | AI interpretation | 🔲 | - | Show intent |

### M4.C Push Notifications

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M4.C1 | Tauri config | 🔲 | - | Permissions |
| M4.C2 | Task complete | 🔲 | - | Notify done |
| M4.C3 | New messages | 🔲 | - | AI response |
| M4.C4 | Actions | 🔲 | - | Reply/view |
| M4.C5 | Preferences | 🔲 | - | Settings |

### M4.D Offline

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M4.D1 | Message queue | 🔲 | - | Queue unsent |
| M4.D2 | File access | 🔲 | - | Downloaded |
| M4.D3 | Reconnect sync | 🔲 | - | Process queue |
| M4.D4 | Status indicator | 🔲 | - | UI offline |
| M4.D5 | Cache recs | 🔲 | - | 24h TTL |

### M4.E Haptics

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M4.E1 | Plugin setup | 🔲 | - | Tauri haptics |
| M4.E2 | Button feedback | 🔲 | - | Light impact |
| M4.E3 | Success/error | 🔲 | - | Notification |
| M4.E4 | Pull refresh | 🔲 | - | Selection |

---

## Phase M5 — Polish & Release (NOT STARTED)

### M5.A Performance

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M5.A1 | Bundle optimization | 🔲 | - | < 500KB |
| M5.A2 | Code splitting | 🔲 | - | By route |
| M5.A3 | Virtual scrolling | 🔲 | - | Long lists |
| M5.A4 | Image optimization | 🔲 | - | WebP/lazy |
| M5.A5 | Memory profiling | 🔲 | - | < 150MB |

### M5.B Gestures

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M5.B1 | Swipe tuning | 🔲 | - | Velocity |
| M5.B2 | Pull refresh | 🔲 | - | Resistance |
| M5.B3 | Sheet gestures | 🔲 | - | Snap points |
| M5.B4 | Navigation | 🔲 | - | Edge swipe |
| M5.B5 | Pinch zoom | 🔲 | - | Images |

### M5.C Testing

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M5.C1 | Unit tests | 🔲 | - | Components |
| M5.C2 | Integration | 🔲 | - | Flows |
| M5.C3 | Device matrix | 🔲 | - | iOS 13+ |
| M5.C4 | Performance | 🔲 | - | FCP/TTI |
| M5.C5 | Accessibility | 🔲 | - | VoiceOver |

### M5.D Release

| # | Task | Status | Assignee | Notes |
|---|------|--------|----------|-------|
| M5.D1 | App Store assets | 🔲 | - | Screenshots |
| M5.D2 | Privacy policy | 🔲 | - | Disclosure |
| M5.D3 | TestFlight | 🔲 | - | Beta |
| M5.D4 | Guidelines | 🔲 | - | Compliance |
| M5.D5 | Analytics | 🔲 | - | Tracking |

---

## Existing Mobile Code (Legacy)

> From v1 implementation, to be evaluated for reuse

### Files Present

| File | Status | Notes |
|------|--------|-------|
| `src/app/mobile/layout.tsx` | 🔄 review | Basic layout |
| `src/app/mobile/page.tsx` | 🔄 review | Redirect to /chat |
| `src/app/mobile/chat/` | 🔄 review | Basic chat UI |
| `src/app/mobile/components/MobileDrawer.tsx` | 🔄 review | Navigation drawer |
| `src/app/mobile/components/MobileChat.tsx` | 🔄 review | Chat component |

### Reusability Assessment

| Component | Reuse? | Notes |
|-----------|--------|-------|
| MobileDrawer | ❌ No | Replace with BottomTabBar |
| MobileChat | 🔄 Partial | Base for CommandChat |
| Mobile route structure | ❌ No | Redesign for 3-tab |
| Safe area handling | ✅ Yes | Keep CSS approach |
| Viewport handling | ✅ Yes | Keep 100dvh pattern |

---

## Decision Log

### 2026-02-21: Module Structure Decision

**Decision**: Adopt 3-tab structure from PRD.md (Command/Files/Me) instead of 4-tab structure from MOBILE_UX_DESIGN.md (Discovery/Asset/Chat/Me)

**Rationale**:
1. Mobile users primarily interact via AI assistant
2. Discovery merged into Command as AI-powered recommendations
3. Simpler navigation reduces cognitive load
4. "Command" better reflects control center role

**Impact**:
- MOBILE_UX_DESIGN.md superseded by v2.0 docs
- Legacy mobile code needs refactoring
- Discovery API reused for recommendations

### 2026-02-21: Documentation Separation

**Decision**: Create separate `docs/mobile/` directory with independent doc set

**Rationale**:
1. Clear separation between desktop (complete) and mobile (planning)
2. Version management easier
3. Different lifecycle stages

**Files Created**:
- `docs/mobile/MOBILE_ARCH.md` v2.0.0
- `docs/mobile/MOBILE_DESIGN.md` v2.0.0
- `docs/mobile/MOBILE_ROADMAP.md` v2.0.0
- `docs/mobile/MOBILE_TODO.md` v2.0.0

---

## Version History

**v2.1.0 (2026-02-22)**
- Phase M0.A Layout System complete (BottomTabBar, MobileHeader, BottomSheet, SafeAreaView)
- Phase M0.B Platform Detection complete (responsive.ts, mobileStore)
- Phase M1.A-B Command Module core complete (CommandChat, TaskMonitor)
- Phase M2.A Files Module core complete (FilesHome)
- Phase M3.A Me Module core complete (MeHome)
- All core components reuse workspaceStore and useMobileAgent for data/sync
- 3-tab navigation structure fully implemented

**v2.0.0 (2026-02-21)**
- Created comprehensive TODO tracker
- All M0-M5 tasks documented
- Legacy code assessment added
- Decision log started
