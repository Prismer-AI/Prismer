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

# MOBILE_ROADMAP — Mobile Engineering Roadmap

> Version: 2.0.0
> Last updated: 2026-02-21
> Status: Planning (Mobile development on hold, Desktop/Web complete)
> See also: docs/ROADMAP.md (Desktop roadmap), docs/mobile/MOBILE_ARCH.md

---

## Overview

```
Desktop/Web Status: Phase 4B IM MVP Complete ✅
Mobile Status: Phase M0 (Planning) ⏸️

┌─────────────────────────────────────────────────────────────────┐
│                     Mobile Roadmap Overview                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase M0 (PLANNING) → Foundation: Core infrastructure          │
│  Phase M1            → Command Module: AI chat + task monitor   │
│  Phase M2            → Files Module: File management + upload   │
│  Phase M3            → Me Module: Profile + agent management    │
│  Phase M4            → Mobile Features: Camera, voice, offline  │
│  Phase M5            → Polish: Performance, gestures, release   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase M0 — Foundation (PLANNING)

**Goal**: Core mobile infrastructure and layout system

**Prerequisites**:
- Desktop Phase 4 complete (Cloud SDK integration) ✅
- Tauri 2 mobile plugins available ✅
- iOS development environment ready

### M0.A Mobile Layout System

| # | Task | Status | Notes |
|---|------|--------|-------|
| M0.A1 | Create `MobileLayout.tsx` | 🔲 pending | Bottom tabs, safe area |
| M0.A2 | Create `BottomTabBar.tsx` | 🔲 pending | 3 tabs: Command/Files/Me |
| M0.A3 | Create `MobileHeader.tsx` | 🔲 pending | Back/title/actions pattern |
| M0.A4 | Create `SafeAreaView.tsx` | 🔲 pending | iOS safe area wrapper |
| M0.A5 | Create `BottomSheet.tsx` | 🔲 pending | Reusable modal sheet |
| M0.A6 | Setup mobile routes `/mobile/*` | 🔲 pending | Route structure |

### M0.B Platform Detection

| # | Task | Status | Notes |
|---|------|--------|-------|
| M0.B1 | Create responsive breakpoints utility | 🔲 pending | `isMobile()`, `isTablet()` |
| M0.B2 | Add platform middleware | 🔲 pending | Auto-redirect mobile users |
| M0.B3 | Create `mobileStore.ts` | 🔲 pending | Platform state |
| M0.B4 | Tauri platform detection | 🔲 pending | `tauri-platform` header |

### M0.C Mobile Component Adaptations

| # | Task | Status | Notes |
|---|------|--------|-------|
| M0.C1 | Create `MobileButton.tsx` | 🔲 pending | Touch-optimized (44px min) |
| M0.C2 | Create `MobileCard.tsx` | 🔲 pending | Full-width cards |
| M0.C3 | Create `MobileInput.tsx` | 🔲 pending | Keyboard-aware |
| M0.C4 | Create `SwipeAction.tsx` | 🔲 pending | Swipe to delete/favorite |
| M0.C5 | Create `PullToRefresh.tsx` | 🔲 pending | Pull down refresh |

### M0.D Data Layer Setup

| # | Task | Status | Notes |
|---|------|--------|-------|
| M0.D1 | Configure mobile SQLite | 🔲 pending | Tauri plugin-store |
| M0.D2 | Create offline queue utility | 🔲 pending | Offline operation queue |
| M0.D3 | Mobile IM sync hook | 🔲 pending | Reuse `useIMSync` |
| M0.D4 | Mobile workspace sync | 🔲 pending | Task status polling |

---

## Phase M1 — Command Module

**Goal**: AI 指挥中心 - 聊天、任务监控、智能推荐

### M1.A Chat Interface

| # | Task | Status | Notes |
|---|------|--------|-------|
| M1.A1 | Create `CommandChat.tsx` | 🔲 pending | Main chat view |
| M1.A2 | Create `MessageBubble.tsx` | 🔲 pending | Mobile-optimized messages |
| M1.A3 | Create `ChatInput.tsx` | 🔲 pending | With quick action bar |
| M1.A4 | Create `QuickActions.tsx` | 🔲 pending | File/Camera/Voice/Commands |
| M1.A5 | Integrate `useDesktopAgent` | 🔲 pending | Reuse WebSocket hook |

### M1.B Task Monitoring

| # | Task | Status | Notes |
|---|------|--------|-------|
| M1.B1 | Create `TaskMonitor.tsx` | 🔲 pending | Collapsible task cards |
| M1.B2 | Create `TaskCard.tsx` | 🔲 pending | Progress + subtasks |
| M1.B3 | Create `TaskDetail.tsx` | 🔲 pending | Full task view |
| M1.B4 | Task pause/cancel/resume | 🔲 pending | Control actions |
| M1.B5 | Task notifications | 🔲 pending | Push notification on complete |

### M1.C Today's Picks

| # | Task | Status | Notes |
|---|------|--------|-------|
| M1.C1 | Create `TodaysPicks.tsx` | 🔲 pending | Pull-down recommendations |
| M1.C2 | Create `RecommendationCard.tsx` | 🔲 pending | Paper recommendation UI |
| M1.C3 | Integrate recommendation API | 🔲 pending | Use existing discovery API |
| M1.C4 | Save/Read/Ask AI actions | 🔲 pending | Quick actions on papers |

### M1.D Quick Commands

| # | Task | Status | Notes |
|---|------|--------|-------|
| M1.D1 | Create `QuickCommands.tsx` | 🔲 pending | Bottom sheet commands |
| M1.D2 | Command template system | 🔲 pending | Predefined AI commands |
| M1.D3 | Recent commands history | 🔲 pending | Quick re-execute |
| M1.D4 | Custom command creation | 🔲 pending | User-defined commands |

---

## Phase M2 — Files Module

**Goal**: 文件管理 - 快速访问、上传、预览

### M2.A File Browser

| # | Task | Status | Notes |
|---|------|--------|-------|
| M2.A1 | Create `FilesHome.tsx` | 🔲 pending | Quick access + recent |
| M2.A2 | Create `FileList.tsx` | 🔲 pending | List/grid view |
| M2.A3 | Create `FolderView.tsx` | 🔲 pending | Folder navigation |
| M2.A4 | Create `QuickAccess.tsx` | 🔲 pending | Pinned/Favorites/Recent |
| M2.A5 | File search | 🔲 pending | Full-text search |

### M2.B File Preview

| # | Task | Status | Notes |
|---|------|--------|-------|
| M2.B1 | Create `FilePreview.tsx` | 🔲 pending | Bottom sheet preview |
| M2.B2 | PDF preview | 🔲 pending | First page render |
| M2.B3 | Image preview | 🔲 pending | Full image with zoom |
| M2.B4 | Code preview | 🔲 pending | Syntax highlighting |
| M2.B5 | File info + actions | 🔲 pending | Metadata + Open/Share/AI |

### M2.C Upload Flow

| # | Task | Status | Notes |
|---|------|--------|-------|
| M2.C1 | Create `UploadSheet.tsx` | 🔲 pending | Upload source selection |
| M2.C2 | Create `UploadProgress.tsx` | 🔲 pending | Progress with cancel |
| M2.C3 | Camera source | 🔲 pending | Direct to upload |
| M2.C4 | Photo library source | 🔲 pending | iOS PHPicker |
| M2.C5 | Files app source | 🔲 pending | Document picker |
| M2.C6 | Cloud import | 🔲 pending | Drive/Dropbox integration |
| M2.C7 | Background upload | 🔲 pending | Continue when app closes |

### M2.D File Operations

| # | Task | Status | Notes |
|---|------|--------|-------|
| M2.D1 | Multi-select mode | 🔲 pending | Batch operations |
| M2.D2 | Move/Copy to folder | 🔲 pending | Folder picker |
| M2.D3 | Delete with undo | 🔲 pending | Soft delete + undo |
| M2.D4 | Share sheet | 🔲 pending | System share |
| M2.D5 | Offline download | 🔲 pending | Mark for offline |

---

## Phase M3 — Me Module

**Goal**: 个人中心 - 账户、订阅、Agent 管理

### M3.A Profile

| # | Task | Status | Notes |
|---|------|--------|-------|
| M3.A1 | Create `MeHome.tsx` | 🔲 pending | Overview page |
| M3.A2 | Create `ProfileCard.tsx` | 🔲 pending | User info + edit |
| M3.A3 | Create `UsageStats.tsx` | 🔲 pending | Monthly usage |
| M3.A4 | Edit profile flow | 🔲 pending | Name, avatar, email |

### M3.B Agent Management

| # | Task | Status | Notes |
|---|------|--------|-------|
| M3.B1 | Create `AgentList.tsx` | 🔲 pending | List of agents |
| M3.B2 | Create `AgentDetail.tsx` | 🔲 pending | Agent config page |
| M3.B3 | Skill management | 🔲 pending | Enable/disable skills |
| M3.B4 | Memory management | 🔲 pending | View/clear context |
| M3.B5 | Personality settings | 🔲 pending | Tone, length, language |
| M3.B6 | Add new agent | 🔲 pending | Agent creation flow |

### M3.C Account Settings

| # | Task | Status | Notes |
|---|------|--------|-------|
| M3.C1 | Subscription view | 🔲 pending | Plan + billing |
| M3.C2 | Notification settings | 🔲 pending | Push preferences |
| M3.C3 | Privacy & security | 🔲 pending | Password, 2FA |
| M3.C4 | Connected devices | 🔲 pending | Device list |
| M3.C5 | Help & support | 🔲 pending | FAQ, contact |
| M3.C6 | Sign out | 🔲 pending | Clear local data |

---

## Phase M4 — Mobile-Specific Features

**Goal**: 移动端特有功能 - 相机、语音、离线

### M4.A Camera OCR

| # | Task | Status | Notes |
|---|------|--------|-------|
| M4.A1 | Create `CameraCapture.tsx` | 🔲 pending | Camera viewfinder |
| M4.A2 | Document detection | 🔲 pending | Auto-detect document bounds |
| M4.A3 | OCR integration | 🔲 pending | Call OCR API |
| M4.A4 | Create `OCRResult.tsx` | 🔲 pending | Text result + edit |
| M4.A5 | AI action suggestions | 🔲 pending | Find papers, explain, etc. |
| M4.A6 | Save to notes/files | 🔲 pending | Persist captured text |

### M4.B Voice Input

| # | Task | Status | Notes |
|---|------|--------|-------|
| M4.B1 | Create `VoiceInput.tsx` | 🔲 pending | Recording UI |
| M4.B2 | Tauri speech plugin | 🔲 pending | Native speech recognition |
| M4.B3 | Real-time transcription | 🔲 pending | Live text display |
| M4.B4 | Voice command confirm | 🔲 pending | Review before execute |
| M4.B5 | AI interpretation | 🔲 pending | Show what AI understood |

### M4.C Push Notifications

| # | Task | Status | Notes |
|---|------|--------|-------|
| M4.C1 | Configure Tauri notifications | 🔲 pending | Permission request |
| M4.C2 | Task completion notifications | 🔲 pending | When task finishes |
| M4.C3 | Message notifications | 🔲 pending | New AI responses |
| M4.C4 | Notification actions | 🔲 pending | Quick reply, view |
| M4.C5 | Notification preferences | 🔲 pending | User settings |

### M4.D Offline Support

| # | Task | Status | Notes |
|---|------|--------|-------|
| M4.D1 | Offline message queue | 🔲 pending | Queue unsent messages |
| M4.D2 | Offline file access | 🔲 pending | Downloaded files |
| M4.D3 | Sync on reconnect | 🔲 pending | Process queue |
| M4.D4 | Offline indicator | 🔲 pending | UI status |
| M4.D5 | Cache recommendations | 🔲 pending | 24h TTL cache |

### M4.E Haptic Feedback

| # | Task | Status | Notes |
|---|------|--------|-------|
| M4.E1 | Configure Tauri haptics | 🔲 pending | Plugin setup |
| M4.E2 | Button press feedback | 🔲 pending | Light impact |
| M4.E3 | Success/error feedback | 🔲 pending | Notification haptic |
| M4.E4 | Pull to refresh feedback | 🔲 pending | Selection haptic |

---

## Phase M5 — Polish & Release

**Goal**: 性能优化、手势完善、发布准备

### M5.A Performance

| # | Task | Status | Notes |
|---|------|--------|-------|
| M5.A1 | Bundle size optimization | 🔲 pending | < 500KB gzipped |
| M5.A2 | Code splitting by route | 🔲 pending | Lazy load modules |
| M5.A3 | Virtual scrolling | 🔲 pending | Long lists |
| M5.A4 | Image optimization | 🔲 pending | WebP, lazy load |
| M5.A5 | Memory profiling | 🔲 pending | < 150MB target |

### M5.B Gesture Refinement

| # | Task | Status | Notes |
|---|------|--------|-------|
| M5.B1 | Swipe gesture tuning | 🔲 pending | Velocity, threshold |
| M5.B2 | Pull to refresh tuning | 🔲 pending | Resistance, trigger |
| M5.B3 | Bottom sheet gestures | 🔲 pending | Snap points |
| M5.B4 | Navigation gestures | 🔲 pending | Edge swipe back |
| M5.B5 | Pinch zoom | 🔲 pending | Image preview |

### M5.C Testing

| # | Task | Status | Notes |
|---|------|--------|-------|
| M5.C1 | Component unit tests | 🔲 pending | Mobile components |
| M5.C2 | Integration tests | 🔲 pending | Flow tests |
| M5.C3 | Device testing matrix | 🔲 pending | iOS 13+, various devices |
| M5.C4 | Performance benchmarks | 🔲 pending | FCP, TTI targets |
| M5.C5 | Accessibility audit | 🔲 pending | VoiceOver, Dynamic Type |

### M5.D Release Prep

| # | Task | Status | Notes |
|---|------|--------|-------|
| M5.D1 | App Store assets | 🔲 pending | Screenshots, description |
| M5.D2 | Privacy policy | 🔲 pending | Data collection disclosure |
| M5.D3 | TestFlight setup | 🔲 pending | Beta testing |
| M5.D4 | App Review guidelines | 🔲 pending | Compliance check |
| M5.D5 | Analytics setup | 🔲 pending | Usage tracking |

---

## Dependencies

### External Dependencies

| Dependency | Phase | Notes |
|------------|-------|-------|
| Desktop Phase 4 (Cloud SDK) | M0 | IM sync, Context API |
| Tauri 2 stable | M0 | Mobile plugins |
| @tauri-apps/plugin-camera | M4.A | Camera capture |
| @tauri-apps/plugin-speech | M4.B | Voice recognition |
| @tauri-apps/plugin-haptics | M4.E | Touch feedback |
| @tauri-apps/plugin-notification | M4.C | Push notifications |

### Internal Dependencies

| Dependency | Blocks | Notes |
|------------|--------|-------|
| MobileLayout | All M1-M3 | Core layout |
| BottomSheet | M1.D, M2.B, M2.C | Modal pattern |
| useIMSync | M1.A | Message persistence |
| Asset API | M2.A-D | File operations |
| Auth | M3.C | User management |

---

## Architecture Principles (Mobile-Specific)

1. **Mobile-first design**: Not scaled-down desktop, but redesigned for mobile context
2. **Offline-first**: Core features work without network
3. **Touch-optimized**: 44px minimum touch targets, thumb zone priority
4. **Quick in/out**: Task completion < 30 seconds
5. **Shared data layer**: Reuse desktop stores and services where possible
6. **Platform abstraction**: Tauri plugins for native features

---

## Version History

**v2.0.0 (2026-02-21)**
- Created comprehensive mobile roadmap
- 5 phases: M0-M5
- Clear task breakdown per module
- Defined dependencies and prerequisites
