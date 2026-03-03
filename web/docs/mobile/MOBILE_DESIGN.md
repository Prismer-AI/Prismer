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

# MOBILE_DESIGN — Mobile Interface Design Specification

> Version: 2.0.0
> Last updated: 2026-02-21
> Status: Planning (Mobile development on hold)
> Supersedes: docs/MOBILE_UX_DESIGN.md
> See also: docs/DESIGN.md (Desktop design), docs/mobile/MOBILE_ARCH.md

---

## 1. Design Principles

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Mobile-First Scenarios** | Not a scaled-down desktop, but redesigned for mobile context |
| **Moderate Information Density** | 3-5 core elements per screen |
| **Thumb Zone** | Critical actions in bottom 60% of screen |
| **Quick In/Out** | Task completion target: < 30 seconds |
| **Offline Ready** | Cached content accessible without network |

### 1.2 Design Language

```
┌─────────────────────────────────────────────────────────────┐
│                    Prismer Mobile 设计语言                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   色彩系统                                                    │
│   ├─ Primary: Blue-600 (#2563EB)     AI/Brand 主色          │
│   ├─ Secondary: Violet-500 (#8B5CF6)  交互高亮              │
│   ├─ Success: Green-500 (#22C55E)     完成/成功              │
│   ├─ Warning: Amber-500 (#F59E0B)     警告/进行中           │
│   ├─ Error: Red-500 (#EF4444)         错误/删除              │
│   └─ Neutral: Slate-*                 文本/背景              │
│                                                              │
│   间距系统 (4px base)                                         │
│   ├─ xs: 4px   (内边距)                                      │
│   ├─ sm: 8px   (元素间)                                      │
│   ├─ md: 16px  (组间)                                        │
│   ├─ lg: 24px  (区域间)                                      │
│   └─ xl: 32px  (页面边距)                                    │
│                                                              │
│   圆角                                                        │
│   ├─ sm: 6px   (按钮/输入框)                                 │
│   ├─ md: 12px  (卡片)                                        │
│   ├─ lg: 16px  (Sheet)                                       │
│   └─ full: 9999px (Avatar/Badge)                             │
│                                                              │
│   触摸目标                                                    │
│   └─ 最小: 44 × 44 pt (iOS HIG)                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Layout Structure

### 2.1 Overall Layout

```
┌─────────────────────────────────────────┐
│ Status Bar (20px, system)               │  ← iOS 状态栏
├─────────────────────────────────────────┤
│ Header (44-56px)                        │  ← 导航栏
│ ┌─────┐  Title                  Actions │
│ │ ← │                            ⋯     │
│ └─────┘                                 │
├─────────────────────────────────────────┤
│                                          │
│                                          │
│                                          │
│           Content Area                   │  ← 主内容区
│           (flex-1, scrollable)           │
│                                          │
│                                          │
│                                          │
│                                          │
├─────────────────────────────────────────┤
│ Tab Bar (49px + safe area)              │  ← 底部导航
│                                          │
│   🤖        📁        👤                │
│ Command    Files      Me                │
│                                          │
└─────────────────────────────────────────┘
```

### 2.2 Safe Area Handling

```css
/* iOS Safe Area */
.mobile-container {
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
  padding-left: env(safe-area-inset-left, 0);
  padding-right: env(safe-area-inset-right, 0);
}

/* Dynamic Viewport (keyboard aware) */
.mobile-viewport {
  height: 100dvh;
}

/* Tab Bar Bottom Padding */
.tab-bar {
  padding-bottom: max(4px, env(safe-area-inset-bottom));
}
```

---

## 3. Command Module (AI 指挥中心)

### 3.1 Module Overview

**Purpose**: AI 研究助手的统一入口，整合对话、任务管理、智能推荐

**Replaces**: Discovery + Chat from v1

### 3.2 Main Chat View

```
┌─────────────────────────────────────────┐
│ ⌚ 09:41        Prismer          🔔  ⚙️  │ ← Status Bar
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📋 Active Tasks (2)         ▼    │   │ ← 可折叠任务卡片
│  │                                   │   │
│  │ ◐ Analyzing paper_v3.pdf         │   │
│  │   ████████████░░░░  75%          │   │
│  │   Est. 2 min left                │   │
│  │   [Pause] [Cancel]               │   │
│  │                                   │   │
│  │ ⏸️ Literature search (Paused)    │   │
│  │   [Resume]                       │   │
│  │                                   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ─────  Chat History  ─────             │
│                                          │
│  Today 09:30                             │
│                                          │
│  ┌────────────────────────────────┐     │
│  │ 🤖 Research Assistant           │     │ ← AI 消息 (左)
│  │                                 │     │
│  │ I've started analyzing the     │     │
│  │ paper. The methodology section │     │
│  │ uses transformer architecture. │     │
│  │                                 │     │
│  │ ┌────────────────────────────┐ │     │
│  │ │ 📄 paper_v3.pdf            │ │     │ ← 文件卡片
│  │ │    4.2 MB · 12 pages       │ │     │
│  │ │    [Open]                  │ │     │
│  │ └────────────────────────────┘ │     │
│  └────────────────────────────────┘     │
│                                          │
│              ┌──────────────────────┐   │
│              │ Can you summarize    │   │ ← 用户消息 (右)
│              │ the key findings?    │   │
│              └──────────────────────┘   │
│                                  09:32  │
│                                          │
├─────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌────────┐ │ ← 输入区域
│ │ Ask anything...           │ │   ➤   │ │
│ └──────────────────────────┘ └────────┘ │
│                                          │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │ ← 快捷操作栏
│ │ 📎 │ │ 📷 │ │ 🎤 │ │ ⚡ │ │ ⋯  │    │   (移动端特有)
│ │File│ │Cam │ │Mic │ │Cmd │ │More│    │
│ └────┘ └────┘ └────┘ └────┘ └────┘    │
│                                          │
├─────────────────────────────────────────┤
│   🤖        📁        👤                │ ← Tab Bar
│ Command    Files      Me                │
│   ●         ○         ○                 │
└─────────────────────────────────────────┘
```

### 3.3 Today's Picks (下拉触发)

```
┌─────────────────────────────────────────┐
│ ⌚ 09:41        Prismer          🔔  ⚙️  │
├─────────────────────────────────────────┤
│                                          │
│  ↓  Pull to see Today's Picks  ↓        │ ← 下拉刷新提示
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📚 Today's Picks for You         │   │
│  │                                   │   │
│  │ Based on your recent work on     │   │
│  │ transformer models:              │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📄 Efficient Transformers: A     │   │
│  │    Survey and Beyond (2026)      │   │
│  │                                   │   │
│  │    Tay et al. · arXiv            │   │
│  │    ⭐ 4.8/5 · 🔥 Trending        │   │
│  │                                   │   │
│  │    "Comprehensive survey of      │   │
│  │    efficient transformer         │   │
│  │    architectures..."             │   │
│  │                                   │   │
│  │    [Read] [Save] [Ask AI ↗]     │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📄 Long-Range Transformers...    │   │
│  │    ...                            │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [Not interested] [Refresh Picks]        │
│                                          │
│  ─────  Back to Chat  ─────             │
│  (Swipe up to dismiss)                   │
│                                          │
└─────────────────────────────────────────┘
```

### 3.4 Quick Commands Panel (Bottom Sheet)

```
┌─────────────────────────────────────────┐
│            Quick Commands               │ ← Bottom Sheet
├─────────────────────────────────────────┤
│                  ─────                   │ ← Drag Handle
│                                          │
│  Frequently Used                         │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📄 Summarize Paper               │   │
│  │    Generate concise summary      │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 🔍 Find Related Papers           │   │
│  │    Search similar research       │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ✍️ Improve Writing                │   │
│  │    Polish academic text          │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📊 Visualize Data                │   │
│  │    Create charts and plots       │   │
│  └──────────────────────────────────┘   │
│                                          │
│  More Commands                           │
│  ┌──────────────────────────────────┐   │
│  │ 📚 Generate Bibliography         │   │
│  │ 🧮 Calculate Statistics          │   │
│  │ 🔄 Translate Text                │   │
│  │ 📝 Extract Key Points            │   │
│  │ 🎯 Compare Papers                │   │
│  └──────────────────────────────────┘   │
│                                          │
└─────────────────────────────────────────┘
```

### 3.5 Camera Capture Flow

```
┌─────────────────────────────────────────┐
│ ✕          Capture Mode          ⚙️     │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │                                   │   │
│  │                                   │   │
│  │        Camera Viewfinder         │   │ ← 相机取景器
│  │                                   │   │
│  │      ┌─────────────────┐         │   │
│  │      │                  │         │   │ ← OCR 识别框
│  │      │   Document       │         │   │
│  │      │   Detection      │         │   │
│  │      └─────────────────┘         │   │
│  │                                   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Tips: Align document within frame      │
│                                          │
│  ┌────────┐       ┌────────┐           │
│  │ 🖼️     │       │   ⭕   │           │ ← 控制按钮
│  │Gallery │       │Capture │           │
│  └────────┘       └────────┘           │
│                                          │
│         [✓ Auto] [Flash] [Grid]         │ ← 拍照选项
│                                          │
└─────────────────────────────────────────┘

                    ↓ After capture

┌─────────────────────────────────────────┐
│ ←          OCR Result            ✓      │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ [Preview Image]                  │   │ ← 原图预览
│  └──────────────────────────────────┘   │
│                                          │
│  Extracted Text:                         │
│  ┌──────────────────────────────────┐   │
│  │ Transformer architecture has     │   │
│  │ revolutionized natural language  │   │ ← 识别文本
│  │ processing. The attention        │   │   (可编辑)
│  │ mechanism allows...              │   │
│  │ [Edit Text]                      │   │
│  └──────────────────────────────────┘   │
│                                          │
│  AI Actions:                             │
│  ┌──────────────────────────────────┐   │
│  │ 🔍 Find related papers           │   │
│  │ 💡 Explain this concept          │   │
│  │ 📝 Add to notes                  │   │
│  │ ⚡ Custom prompt...               │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [Save] [Share] [Discard]                │
│                                          │
└─────────────────────────────────────────┘
```

### 3.6 Voice Input

```
┌─────────────────────────────────────────┐
│ ✕         Voice Input                   │
├─────────────────────────────────────────┤
│                                          │
│            ┌───────────┐                 │
│            │           │                 │
│            │     ⬤     │                 │ ← 录音动画
│            │           │                 │   (波形可视化)
│            └───────────┘                 │
│                                          │
│          "Listening..."                  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ Find papers about transformer    │   │ ← 实时转写
│  │ models published after 2024...   │   │
│  └──────────────────────────────────┘   │
│                                          │
│           00:05 / 02:00                  │ ← 时间进度
│                                          │
│       ┌────────┐   ┌────────┐           │
│       │   ⏸    │   │   ✓    │           │
│       │ Pause  │   │ Done   │           │
│       └────────┘   └────────┘           │
│                                          │
│  💡 Tips:                                │
│  • Speak clearly and naturally          │
│  • You can pause and continue           │
│  • Tap "Done" when finished             │
│                                          │
└─────────────────────────────────────────┘
```

### 3.7 Task Detail View

```
┌─────────────────────────────────────────┐
│ ←      Task: Analyzing Paper      ⋯     │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ Status: In Progress              │   │
│  │ ████████████░░░░  75%            │   │
│  │ Est. 2 minutes remaining         │   │
│  │                                   │   │
│  │ Started: 09:30 · Duration: 5m    │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Subtasks                                │
│  ┌──────────────────────────────────┐   │
│  │ ✓ Download PDF                    │   │
│  │ ✓ Extract text                    │   │
│  │ ◐ Analyze methodology (running)   │   │
│  │ ○ Extract key findings            │   │
│  │ ○ Generate summary                │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Related Files                           │
│  ┌──────────────────────────────────┐   │
│  │ 📄 paper_v3.pdf                   │   │
│  │    4.2 MB · ML Research           │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Logs                                    │
│  ┌──────────────────────────────────┐   │
│  │ 09:35 Analyzing section 3...      │   │
│  │ 09:34 Found 5 key references      │   │
│  │ 09:32 Extracted 12 pages          │   │
│  │ 09:31 Started processing          │   │
│  └──────────────────────────────────┘   │
│                                          │
├─────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐          │
│ │   Pause    │ │   Cancel   │          │
│ └────────────┘ └────────────┘          │
└─────────────────────────────────────────┘
```

---

## 4. Files Module (文件管理)

### 4.1 Module Overview

**Purpose**: 快速查找和访问研究资料

**Design Philosophy**: 搜索优先 + 快速访问，非复杂文件管理

### 4.2 Files Home

```
┌─────────────────────────────────────────┐
│ Files                           🔍  ⋯    │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 🔍 Search files, content...      │   │ ← 全文搜索
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ☁️ Storage: 2.3 / 5 GB           │   │ ← 存储状态
│  │ ████████████░░░░  46%            │   │
│  │ [Manage Storage →]               │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Quick Access                            │
│                                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │ 📌 │ │ ⭐ │ │ 🕐 │ │ 📄 │ │ 📊 │    │ ← 快速入口
│  │Pin │ │Fav │ │Rec │ │PDF │ │Data│    │
│  │ 8  │ │ 12 │ │ -- │ │ 24 │ │ 8  │    │
│  └────┘ └────┘ └────┘ └────┘ └────┘    │
│                                          │
│  Recent Files                            │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📄 transformer_paper_v3.pdf      │   │
│  │    4.2 MB · 2 hours ago          │   │ ← 文件项
│  │    📁 ML Research                │   │   (点击预览)
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📊 experiment_results.csv        │   │
│  │    156 KB · Yesterday            │   │
│  │    📁 Data Analysis              │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📓 analysis_notebook.ipynb       │   │
│  │    89 KB · 3 days ago            │   │
│  │    📁 Experiments                │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Folders                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ 📁     │ │ 📁     │ │ 📁     │      │ ← 文件夹网格
│  │ ML     │ │ Data   │ │ Papers │      │
│  │Research│ │Analysis│ │ 2026   │      │
│  │ 12项   │ │ 8项    │ │ 34项   │      │
│  └────────┘ └────────┘ └────────┘      │
│                                          │
│                        ┌─────────────┐  │
│                        │     ＋      │  │ ← FAB 上传按钮
│                        │   Upload    │  │
│                        └─────────────┘  │
│                                          │
├─────────────────────────────────────────┤
│   🤖        📁        👤                │
│ Command    Files      Me                │
│   ○         ●         ○                 │
└─────────────────────────────────────────┘
```

### 4.3 Folder View

```
┌─────────────────────────────────────────┐
│ ←  ML Research                    ⋯     │ ← 返回 | 文件夹名 | 更多
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  🔍 Search in folder...          │   │ ← 文件夹内搜索
│  └──────────────────────────────────┘   │
│                                          │
│  ┌─ Sort ─────────────┐  ┌─ View ────┐  │
│  │ Recent ▾           │  │ ☰  ⊞     │  │ ← 排序 | 视图切换
│  └────────────────────┘  └───────────┘  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ○  📄 transformer_paper.pdf      │   │ ← 多选模式可勾选
│  │       4.2 MB · Feb 20, 2026      │   │
│  │       ★ Favorite                 │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ○  📄 attention_mechanism.pdf    │   │
│  │       2.8 MB · Feb 18, 2026      │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ○  📓 model_training.ipynb       │   │
│  │       156 KB · Feb 15, 2026      │   │
│  └──────────────────────────────────┘   │
│                                          │
├─────────────────────────────────────────┤
│  Selected: 0                    Cancel  │ ← 底部操作栏（多选时）
│  [Move] [Copy] [Delete] [Share]         │
└─────────────────────────────────────────┘
```

### 4.4 File Preview Sheet

```
┌─────────────────────────────────────────┐
│                  ─────                   │ ← Drag Handle
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │                                   │   │
│  │       [File Preview Area]        │   │ ← 预览区
│  │                                   │   │
│  │     PDF: First Page Rendered     │   │
│  │     Image: Full Display          │   │
│  │     Code: Syntax Highlighted     │   │
│  │                                   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  📄 transformer_paper_v3.pdf             │
│                                          │
│  Details                                 │
│  ┌──────────────────────────────────┐   │
│  │ Size        4.2 MB                │   │
│  │ Type        PDF Document          │   │
│  │ Pages       12                    │   │
│  │ Modified    2 hours ago           │   │
│  │ Location    📁 ML Research        │   │
│  │ Tags        #transformer #2026    │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Actions                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │  Open  │ │ Share  │ │  More  │      │
│  │   📖   │ │   ↗️   │ │   ⋯    │      │
│  └────────┘ └────────┘ └────────┘      │
│                                          │
│  AI Actions                              │
│  ┌──────────────────────────────────┐   │
│  │ 💬 Ask AI about this file        │   │
│  │ 📝 Summarize content             │   │
│  │ 🔍 Find related papers           │   │
│  └──────────────────────────────────┘   │
│                                          │
└─────────────────────────────────────────┘
```

### 4.5 Upload Flow

```
┌─────────────────────────────────────────┐
│ ✕         Upload Files                  │
├─────────────────────────────────────────┤
│                  ─────                   │
│                                          │
│  Choose Source                           │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         📷 Camera                │   │
│  │   Capture document or photo      │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         🖼️ Photo Library         │   │
│  │   Select from your photos        │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         📁 Files App             │   │
│  │   Browse device storage          │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         ☁️ Cloud Services        │   │
│  │   Google Drive, Dropbox, etc.    │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │         🔗 From URL              │   │
│  │   Paste a link to download       │   │
│  └──────────────────────────────────┘   │
│                                          │
└─────────────────────────────────────────┘

                    ↓

┌─────────────────────────────────────────┐
│ ✕         Uploading Files               │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📄 paper_v4.pdf                  │   │
│  │ ████████████████░░  85%          │   │ ← 上传进度
│  │ 3.6 MB / 4.2 MB · 5 sec left     │   │
│  │                          [✕]     │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📊 data.csv                      │   │
│  │ ████████████████████  100%       │   │
│  │ Completed · 156 KB          [✓]  │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Options                                 │
│  ┌──────────────────────────────────┐   │
│  │ Save to: 📁 [Select Folder ▾]    │   │
│  │                                   │   │
│  │ ☑ Extract text (PDF/Images)      │   │
│  │ ☑ Add to AI knowledge            │   │
│  │ ☐ Share with team                │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [Pause All] [Cancel]                    │
│                                          │
└─────────────────────────────────────────┘
```

---

## 5. Me Module (个人中心)

### 5.1 Module Overview

**Purpose**: 账户管理、订阅管理、AI 能力配置

**Integrates**: Profile + Settings + Agent Management + Subscription

### 5.2 Me Home

```
┌─────────────────────────────────────────┐
│ Me                              ⚙️       │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ┌────────┐                        │   │
│  │ │  👤    │ John Researcher        │   │ ← 个人卡片
│  │ │        │ john@university.edu    │   │
│  │ └────────┘                        │   │
│  │                                   │   │
│  │ Pro Member · Since Mar 2025      │   │
│  │ [Edit Profile]                   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 📊 This Month                    │   │ ← 使用统计
│  │                                   │   │
│  │ AI Queries     ████████░░  842    │   │
│  │ Papers Read    ████░░░░░░  45     │   │
│  │ Tasks Complete ██████░░░░  28     │   │
│  │                                   │   │
│  │ [View Details →]                  │   │
│  └──────────────────────────────────┘   │
│                                          │
│  AI Assistants                           │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 🤖 Research Assistant       →    │   │
│  │    Active · 12 skills enabled    │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 🤖 Writing Helper           →    │   │
│  │    Active · 8 skills enabled     │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ＋ Add New Assistant             │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Account                                 │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ⭐ Subscription              →   │   │
│  │ 🔔 Notifications             →   │   │
│  │ 🔐 Privacy & Security        →   │   │
│  │ 📱 Devices                   →   │   │
│  │ ❓ Help & Support            →   │   │
│  │ 🚪 Sign Out                      │   │
│  └──────────────────────────────────┘   │
│                                          │
├─────────────────────────────────────────┤
│   🤖        📁        👤                │
│ Command    Files      Me                │
│   ○         ○         ●                 │
└─────────────────────────────────────────┘
```

### 5.3 Agent Management

```
┌─────────────────────────────────────────┐
│ ←  Research Assistant            ⚙️     │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │       ┌────────┐                 │   │
│  │       │  🤖    │                 │   │
│  │       └────────┘                 │   │
│  │   Research Assistant             │   │
│  │   Active · Online                │   │
│  │                                   │   │
│  │   Specialized in paper analysis, │   │
│  │   literature review, and data    │   │
│  │   visualization.                 │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Skills (12 enabled)                     │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ ☑ Paper Analysis                  │   │
│  │ ☑ Literature Search               │   │
│  │ ☑ Citation Management             │   │
│  │ ☑ Data Visualization              │   │
│  │ ☑ Summarization                   │   │
│  │ ☐ Code Generation (disabled)      │   │
│  │                                   │   │
│  │ [Manage Skills →]                 │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Memory                                  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ 🧠 42 context entries            │   │
│  │                                   │   │
│  │ Last updated: 2 hours ago        │   │
│  │ Research focus: Transformers     │   │
│  │                                   │   │
│  │ [View Memory →] [Clear Memory]   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Settings                                │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ Personality      [Analytical ▾]   │   │
│  │ Response Length  [Concise ▾]      │   │
│  │ Language         [English ▾]      │   │
│  └──────────────────────────────────┘   │
│                                          │
└─────────────────────────────────────────┘
```

---

## 6. Component Library

### 6.1 Mobile-Specific Components

| Component | Usage |
|-----------|-------|
| `BottomSheet` | Modal from bottom (file preview, quick commands) |
| `SwipeAction` | Swipe to reveal actions (delete, archive) |
| `PullToRefresh` | Pull down to refresh (recommendations) |
| `BottomTabBar` | Main navigation (Command/Files/Me) |
| `MobileHeader` | Top navigation with back/title/actions |
| `SafeAreaView` | iOS safe area wrapper |
| `FAB` | Floating action button (upload) |
| `VoiceRecorder` | Voice input UI |
| `CameraCapture` | Camera OCR UI |

### 6.2 Shared Components (from Desktop)

| Component | Mobile Adaptation |
|-----------|-------------------|
| `Button` | Larger touch targets (min 44px) |
| `Input` | Touch keyboard optimized |
| `Card` | Full width on mobile |
| `Avatar` | Same component |
| `Badge` | Same component |
| `Progress` | Same component |
| `Toast` (Sonner) | Bottom positioned |
| `Dialog` | Full screen on mobile |

### 6.3 Gesture Support

| Gesture | Action |
|---------|--------|
| Swipe left | Delete/archive (file list) |
| Swipe right | Mark favorite (file list) |
| Pull down | Refresh / Show recommendations |
| Pull up | Load more (infinite scroll) |
| Long press | Context menu |
| Pinch | Zoom (image preview) |
| Double tap | Quick action (favorite) |

---

## 7. Animation & Transitions

### 7.1 Transition Types

| Transition | Usage | Duration |
|------------|-------|----------|
| Push (right) | Navigate forward | 300ms |
| Pop (left) | Navigate back | 250ms |
| Bottom sheet | Modal panels | 350ms |
| Fade | Tab switch | 150ms |
| Scale | FAB press | 100ms |

### 7.2 framer-motion Patterns

```typescript
// Bottom Sheet
const sheetVariants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: { type: 'spring', damping: 25 } },
};

// Tab Content
const tabVariants = {
  enter: { opacity: 0, x: 10 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

// Task Card Collapse
const collapseVariants = {
  expanded: { height: 'auto', opacity: 1 },
  collapsed: { height: 48, opacity: 1 },
};
```

---

## 8. Color & Typography

### 8.1 Color Palette

| Usage | Light Mode | Dark Mode |
|-------|------------|-----------|
| Background | white | slate-950 |
| Card | white | slate-900 |
| Text Primary | slate-900 | slate-100 |
| Text Secondary | slate-600 | slate-400 |
| Border | slate-200 | slate-800 |
| Brand/AI | blue-600 | blue-500 |
| Success | green-600 | green-500 |
| Warning | amber-600 | amber-500 |
| Error | red-600 | red-500 |

### 8.2 Typography Scale

| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| Title | 20px | Bold | Page titles |
| Subtitle | 16px | Semibold | Section headers |
| Body | 14px | Regular | Main content |
| Caption | 12px | Regular | Metadata |
| Label | 12px | Medium | Button labels |

---

## 9. Version History

**v2.0.0 (2026-02-21)**
- Consolidated from PRD.md and MOBILE_UX_DESIGN.md
- Adopted 3-module structure: Command / Files / Me
- Integrated mobile-specific UI patterns
- Added camera and voice input flows
- Defined gesture and animation specs

**v1.0.0 (2026-02-21)**
- Initial MOBILE_UX_DESIGN.md with 4-module structure
