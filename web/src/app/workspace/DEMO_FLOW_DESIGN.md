# Workspace 演示流程设计文档

## 一、概述

本文档定义了 Workspace 完整演示流程的数据结构、Agent Action 与 UI 状态同步机制、时间线事件系统设计。

### 核心问题

1. **Agent Action 与 UI 状态同步**：Agent 执行动作后，前端需要知道切换到哪个组件、显示什么内容
2. **时间线与状态快照**：每个时间点需要记录完整的 UI 状态，支持回放
3. **增量变化展示**：像 Git Diff 一样展示内容变化
4. **交互式组件**：Chat 中的确认按钮、选择器等

---

## 二、演示流程详细步骤

### Step 1: Agent 主动发起

**场景**：Research Agent 检测到用户昨天研究的主题有新进展

```typescript
// Message
{
  id: 'msg-step1',
  senderId: 'agent-research',
  senderType: 'agent',
  senderName: 'Aria (Research)',
  content: '早上好！我注意到你昨天对 VLA 模型的研究进展。今天有几篇新发布的相关论文，需要我帮你研究分析一下吗？',
  contentType: 'text',
  timestamp: '2026-01-29T09:00:00Z',
  // 交互式组件
  interactiveComponents: [
    {
      type: 'button-group',
      id: 'step1-confirm',
      buttons: [
        { id: 'yes', label: '好的，开始分析', variant: 'primary' },
        { id: 'later', label: '稍后再说', variant: 'secondary' },
        { id: 'details', label: '先看看有哪些论文', variant: 'ghost' },
      ],
    },
  ],
}
```

**UI 状态**：
- `activeComponent`: 'ai-editor' (默认)
- `chatExpanded`: true
- `taskPanelHeight`: 'collapsed'

---

### Step 2: 用户确认并提出需求

**用户消息**：

```typescript
{
  id: 'msg-step2-user',
  senderId: 'user-1',
  senderType: 'user',
  senderName: '我',
  content: '好的，帮我分析一下。特别是和之前的方法做个 benchmark 对比，看看性能提升多少。',
  contentType: 'text',
  timestamp: '2026-01-29T09:01:00Z',
}
```

**Agent 响应**：

```typescript
{
  id: 'msg-step2-agent',
  senderId: 'agent-research',
  senderType: 'agent',
  senderName: 'Aria (Research)',
  content: '收到！我先加载 VLA-RAIL 这篇论文进行深度分析，然后整理 benchmark 对比数据。',
  contentType: 'text',
  timestamp: '2026-01-29T09:01:30Z',
  actions: [
    {
      id: 'action-step2-1',
      type: 'search_papers',
      status: 'completed',
      description: '搜索 VLA 相关最新论文',
      duration: 3000,
      data: {
        papers: [
          {
            id: 'paper-vla-rail',
            title: 'VLA-RAIL: A Real-Time Asynchronous Inference Linker for VLA Models and Robots',
            authors: ['Zhang et al.'],
            year: 2026,
            source: 'arxiv',
          },
        ],
      },
    },
  ],
  // UI 指令
  uiDirectives: [
    {
      type: 'switch_component',
      target: 'pdf-reader',
      delay: 500,
    },
    {
      type: 'load_document',
      documentId: 'library/vla-rail.pdf',
      delay: 1000,
    },
  ],
}
```

---

### Step 3: PDF 阅读器分析

**UI 状态变化**：

```typescript
// Timeline Event
{
  id: 'tl-step3',
  timestamp: Date.parse('2026-01-29T09:02:00Z'),
  componentType: 'pdf-reader',
  action: 'navigate',
  description: '打开 VLA-RAIL 论文',
  actorId: 'agent-research',
  actorType: 'agent',
  // 状态快照
  stateSnapshot: {
    activeComponent: 'pdf-reader',
    pdfReader: {
      documentId: 'library/vla-rail.pdf',
      currentPage: 1,
      totalPages: 12,
      highlights: [],
      chatOpen: true,
    },
  },
}
```

**PDF 阅读器内的 Agent Chat**：

```typescript
// PDF Reader 内部 Chat
{
  id: 'pdf-chat-1',
  role: 'assistant',
  content: '我正在分析这篇论文的核心贡献...',
  timestamp: '2026-01-29T09:02:30Z',
  actions: [
    {
      id: 'pdf-action-1',
      type: 'analyze_paper',
      status: 'running',
      description: '提取论文关键信息',
    },
  ],
}

// 分析完成后
{
  id: 'pdf-chat-2',
  role: 'assistant',
  content: '分析完成！VLA-RAIL 的主要创新点：\n1. 异步推理链接器设计\n2. 实时性能提升 40%\n3. 与 ROS2 原生集成',
  timestamp: '2026-01-29T09:03:00Z',
  data: {
    keyPoints: [
      '异步推理链接器 (AIL) 架构',
      '延迟从 200ms 降至 120ms',
      '支持多机器人协同',
    ],
    benchmark: {
      baseline: { latency: 200, throughput: 5 },
      vlaRail: { latency: 120, throughput: 8.5 },
    },
  },
}
```

---

### Step 4: 分析结果返回 Chat，调度 Code Agent

**Message 回到主 Chat Panel**：

```typescript
{
  id: 'msg-step4',
  senderId: 'agent-research',
  senderType: 'agent',
  senderName: 'Aria (Research)',
  content: '论文分析完成！发现 VLA-RAIL 在异步推理链接器的设计上与之前的方法有显著区别。我发现了一个有趣的优化点，需要写代码验证一下。',
  contentType: 'text',
  timestamp: '2026-01-29T09:05:00Z',
  actions: [
    {
      id: 'action-step4-1',
      type: 'draw_conclusion',
      status: 'completed',
      description: '总结 VLA-RAIL 核心创新',
      data: {
        conclusion: 'VLA-RAIL 通过异步推理链接器实现了 40% 的延迟降低',
      },
    },
  ],
  // 通知 Code Agent
  agentHandoff: {
    targetAgent: 'agent-code',
    reason: '需要代码验证性能差异',
    context: {
      task: 'implement_benchmark',
      baseline: 'synchronous_inference',
      target: 'async_inference_linker',
    },
  },
}

// Code Agent 响应
{
  id: 'msg-step4-code',
  senderId: 'agent-code',
  senderType: 'agent',
  senderName: 'Copilot (Code)',
  content: '收到！我来实现一个简单的 benchmark 脚本对比两种推理方式的性能差异。',
  contentType: 'text',
  timestamp: '2026-01-29T09:05:30Z',
  actions: [
    {
      id: 'action-step4-code',
      type: 'write_content',
      status: 'running',
      description: '编写 benchmark 代码',
      data: {
        section: 'benchmark.py',
        content: `import asyncio
import time
from dataclasses import dataclass

@dataclass
class InferenceResult:
    latency_ms: float
    throughput: float

class SyncInference:
    def run(self, batch_size=32):
        start = time.time()
        # Simulate synchronous inference
        time.sleep(0.2)  # 200ms latency
        latency = (time.time() - start) * 1000
        return InferenceResult(latency, batch_size / latency * 1000)

class AsyncInferenceLinker:
    async def run(self, batch_size=32):
        start = time.time()
        # Simulate async inference with pipelining
        await asyncio.sleep(0.12)  # 120ms latency
        latency = (time.time() - start) * 1000
        return InferenceResult(latency, batch_size / latency * 1000)

# Run benchmark
sync = SyncInference()
async_linker = AsyncInferenceLinker()

print("Running benchmark...")
sync_result = sync.run()
async_result = asyncio.run(async_linker.run())

print(f"Sync: {sync_result.latency_ms:.1f}ms, {sync_result.throughput:.1f} samples/s")
print(f"Async: {async_result.latency_ms:.1f}ms, {async_result.throughput:.1f} samples/s")
print(f"Speedup: {sync_result.latency_ms / async_result.latency_ms:.2f}x")`,
      },
    },
  ],
  uiDirectives: [
    {
      type: 'switch_component',
      target: 'code-playground',
      delay: 500,
    },
  ],
}
```

---

### Step 5: Jupyter 可视化

**Code Agent 完成后的消息**：

```typescript
{
  id: 'msg-step5',
  senderId: 'agent-code',
  senderType: 'agent',
  senderName: 'Copilot (Code)',
  content: 'Benchmark 运行完成！结果显示异步推理链接器确实有显著性能提升。建议做个可视化更直观。',
  contentType: 'text',
  timestamp: '2026-01-29T09:08:00Z',
  actions: [
    {
      id: 'action-step5-1',
      type: 'execute_code',
      status: 'completed',
      description: '运行 benchmark',
      data: {
        output: `Running benchmark...
Sync: 201.3ms, 159.0 samples/s
Async: 121.5ms, 263.4 samples/s
Speedup: 1.66x`,
      },
    },
  ],
  interactiveComponents: [
    {
      type: 'button-group',
      id: 'step5-viz',
      buttons: [
        { id: 'visualize', label: '生成可视化', variant: 'primary' },
        { id: 'export', label: '导出数据', variant: 'secondary' },
      ],
    },
  ],
}

// 用户点击可视化后
{
  id: 'msg-step5-jupyter',
  senderId: 'agent-code',
  senderType: 'agent',
  senderName: 'Copilot (Code)',
  content: '正在 Jupyter 中生成可视化图表...',
  contentType: 'text',
  timestamp: '2026-01-29T09:09:00Z',
  actions: [
    {
      id: 'action-step5-jupyter',
      type: 'write_content',
      status: 'running',
      description: '生成可视化代码',
      data: {
        section: 'visualization.ipynb',
        content: `import matplotlib.pyplot as plt
import numpy as np

# Benchmark data
methods = ['Sync Inference', 'Async Linker (VLA-RAIL)']
latency = [201.3, 121.5]
throughput = [159.0, 263.4]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

# Latency comparison
colors = ['#ef4444', '#22c55e']
bars1 = ax1.bar(methods, latency, color=colors)
ax1.set_ylabel('Latency (ms)')
ax1.set_title('Inference Latency Comparison')
ax1.bar_label(bars1, fmt='%.1f ms')

# Throughput comparison
bars2 = ax2.bar(methods, throughput, color=colors)
ax2.set_ylabel('Throughput (samples/s)')
ax2.set_title('Inference Throughput Comparison')
ax2.bar_label(bars2, fmt='%.1f')

plt.tight_layout()
plt.savefig('benchmark_comparison.png', dpi=150)
plt.show()

print("✅ Visualization saved to benchmark_comparison.png")`,
      },
    },
  ],
  uiDirectives: [
    {
      type: 'switch_component',
      target: 'jupyter-notebook',
      delay: 500,
    },
  ],
}
```

---

### Step 6: 询问是否写文章

```typescript
{
  id: 'msg-step6',
  senderId: 'agent-research',
  senderType: 'agent',
  senderName: 'Aria (Research)',
  content: '实验完成！总结一下我们的发现：\n\n📊 **Benchmark 结果**\n- 延迟降低: 39.6% (201ms → 121ms)\n- 吞吐量提升: 65.7% (159 → 263 samples/s)\n\n📝 **关键发现**\n- VLA-RAIL 的异步推理链接器设计确实有效\n- 性能提升主要来自流水线并行\n\n所有实验数据和分析已经整理到 AI Editor 中。需要我帮你撰写论文的实验部分吗？',
  contentType: 'markdown',
  timestamp: '2026-01-29T09:12:00Z',
  interactiveComponents: [
    {
      type: 'choice-card',
      id: 'step6-write',
      title: '下一步操作',
      options: [
        {
          id: 'write-paper',
          icon: '📄',
          label: '撰写论文',
          description: '将实验结果写入 LaTeX 文档',
        },
        {
          id: 'more-experiments',
          icon: '🔬',
          label: '补充实验',
          description: '在其他数据集上验证',
        },
        {
          id: 'save-notes',
          icon: '📝',
          label: '保存笔记',
          description: '仅保存到 AI Editor',
        },
      ],
    },
  ],
  uiDirectives: [
    {
      type: 'switch_component',
      target: 'ai-editor',
      delay: 500,
    },
    {
      type: 'update_content',
      target: 'ai-editor',
      content: {
        append: true,
        section: 'VLA-RAIL Analysis',
        data: '## VLA-RAIL Benchmark Analysis\n\n### Results Summary\n...',
      },
    },
  ],
}
```

---

### Step 7: 用户确认写文章，引用 Notes

```typescript
// 用户点击 "撰写论文" 后
{
  id: 'msg-step7-user',
  senderId: 'user-1',
  senderType: 'user',
  senderName: '我',
  content: '需要写论文。#Transformer 学习笔记 里面有之前整理的相关方法对比，也参考一下。',
  contentType: 'text',
  timestamp: '2026-01-29T09:13:00Z',
  references: ['notes-transformer'],
}

// Agent 响应
{
  id: 'msg-step7-agent',
  senderId: 'agent-writing',
  senderType: 'agent',
  senderName: 'Claude (Writing)',
  content: '收到！我会结合你的笔记和今天的实验结果，开始撰写论文的实验部分。',
  contentType: 'text',
  timestamp: '2026-01-29T09:13:30Z',
  actions: [
    {
      id: 'action-step7-1',
      type: 'analyze_paper',
      status: 'completed',
      description: '分析笔记内容',
      data: {
        analysis: '笔记中包含了同步推理方法的详细说明和局限性分析',
      },
    },
  ],
}
```

---

### Step 8: LaTeX 编辑器写入

```typescript
{
  id: 'msg-step8',
  senderId: 'agent-writing',
  senderType: 'agent',
  senderName: 'Claude (Writing)',
  content: '开始写入 LaTeX 文档。我会分段落写入实验方法和结论...',
  contentType: 'text',
  timestamp: '2026-01-29T09:14:00Z',
  actions: [
    {
      id: 'action-step8-1',
      type: 'write_content',
      status: 'running',
      description: '写入实验方法',
      data: {
        section: '\\section{Experiments}',
        content: `\\section{Experiments}

\\subsection{Experimental Setup}

We evaluate the performance of VLA-RAIL against the baseline synchronous inference approach. Our experiments are conducted on a simulated robotic manipulation task using the following configuration:

\\begin{itemize}
    \\item Hardware: NVIDIA RTX 4090, 64GB RAM
    \\item Batch size: 32
    \\item Number of trials: 1000
\\end{itemize}

\\subsection{Results}

Table~\\ref{tab:benchmark} summarizes the performance comparison between synchronous inference and our proposed VLA-RAIL approach.

\\begin{table}[h]
\\centering
\\begin{tabular}{lcc}
\\toprule
Method & Latency (ms) & Throughput (samples/s) \\\\
\\midrule
Sync Inference & 201.3 & 159.0 \\\\
VLA-RAIL (Ours) & \\textbf{121.5} & \\textbf{263.4} \\\\
\\bottomrule
\\end{tabular}
\\caption{Performance comparison on inference benchmark.}
\\label{tab:benchmark}
\\end{table}

As shown in the results, VLA-RAIL achieves a \\textbf{39.6\\%} reduction in latency and \\textbf{65.7\\%} improvement in throughput compared to the synchronous baseline.`,
      },
    },
  ],
  uiDirectives: [
    {
      type: 'switch_component',
      target: 'latex-editor',
      delay: 500,
    },
    {
      type: 'highlight_diff',
      target: 'latex-editor',
      range: { start: 0, end: 50 },
      style: 'insert',
    },
  ],
}

// 继续写入 Reference
{
  id: 'msg-step8-ref',
  senderId: 'agent-writing',
  senderType: 'agent',
  senderName: 'Claude (Writing)',
  content: '正在更新参考文献...',
  contentType: 'text',
  timestamp: '2026-01-29T09:15:00Z',
  actions: [
    {
      id: 'action-step8-2',
      type: 'write_content',
      status: 'completed',
      description: '更新 References',
      data: {
        section: 'references.bib',
        content: `@article{zhang2026vlarail,
  title={VLA-RAIL: A Real-Time Asynchronous Inference Linker for VLA Models and Robots},
  author={Zhang, Wei and others},
  journal={arXiv preprint arXiv:2601.xxxxx},
  year={2026}
}`,
      },
    },
  ],
}
```

---

### Step 9: 最终汇报

```typescript
{
  id: 'msg-step9',
  senderId: 'agent-research',
  senderType: 'agent',
  senderName: 'Aria (Research)',
  content: '🎉 **任务完成！**\n\n今天的研究工作总结：\n\n✅ **完成的工作**\n1. 分析了 VLA-RAIL 论文的核心创新\n2. 实现并运行了性能 benchmark\n3. 生成了可视化对比图\n4. 撰写了论文实验部分\n5. 更新了参考文献\n\n📁 **产出文件**\n- `benchmark.py` - Benchmark 脚本\n- `benchmark_comparison.png` - 可视化图表\n- `paper.tex` - 更新后的论文\n- `references.bib` - 参考文献\n\n⏱️ **耗时**: 15 分钟\n\n还有其他需要帮助的吗？',
  contentType: 'markdown',
  timestamp: '2026-01-29T09:15:30Z',
  interactiveComponents: [
    {
      type: 'summary-card',
      id: 'step9-summary',
      stats: [
        { label: '分析论文', value: '1', icon: '📄' },
        { label: '代码文件', value: '2', icon: '💻' },
        { label: '可视化', value: '1', icon: '📊' },
        { label: '更新章节', value: '2', icon: '✍️' },
      ],
      actions: [
        { id: 'view-timeline', label: '查看完整时间线', variant: 'secondary' },
        { id: 'export-all', label: '导出所有产出', variant: 'primary' },
      ],
    },
  ],
}
```

---

## 三、Agent Action 与 UI 状态同步机制

### 3.1 核心问题分析

Agent 动作和前端 UI 状态之间存在以下映射关系：

| Agent Action | UI 响应 |
|--------------|---------|
| `search_papers` | 可能不需要 UI 变化 |
| `analyze_paper` | 切换到 PDF Reader，加载文档 |
| `write_content` | 切换到对应编辑器，显示 diff |
| `execute_code` | 切换到 Code Playground / Jupyter |
| `draw_conclusion` | 在 Chat 中显示总结卡片 |

### 3.2 UI Directive 系统

引入 `UIDirective` 概念，让 Agent 显式声明 UI 变化：

```typescript
// types.ts
interface UIDirective {
  type: UIDirectiveType;
  target?: ComponentType;
  delay?: number; // 延迟执行 (ms)
  data?: Record<string, unknown>;
}

type UIDirectiveType =
  | 'switch_component'    // 切换组件
  | 'load_document'       // 加载文档
  | 'update_content'      // 更新内容
  | 'highlight_diff'      // 显示差异
  | 'scroll_to'           // 滚动到位置
  | 'open_panel'          // 打开面板
  | 'close_panel'         // 关闭面板
  | 'show_notification'   // 显示通知
  | 'play_animation';     // 播放动画
```

### 3.3 状态快照系统

每个时间线事件携带完整的 UI 状态快照：

```typescript
interface StateSnapshot {
  // 全局布局
  layout: {
    chatExpanded: boolean;
    chatPanelWidth: number;
    taskPanelHeight: TaskPanelHeight;
    activeComponent: ComponentType;
  };
  
  // 各组件状态
  components: {
    'pdf-reader'?: {
      documentId: string;
      currentPage: number;
      highlights: Highlight[];
      chatMessages: Message[];
    };
    'latex-editor'?: {
      activeFile: string;
      content: string;
      cursorPosition: { line: number; column: number };
      compiledPdfUrl?: string;
    };
    'code-playground'?: {
      files: FilesMap;
      selectedFile: string;
      terminalOutput: string;
      previewUrl?: string;
    };
    'jupyter-notebook'?: {
      cells: Cell[];
      activeCellIndex: number;
      outputs: Record<string, CellOutput>;
    };
    'ai-editor'?: {
      content: string;
      selections: Selection[];
    };
  };
  
  // 差异信息 (用于 diff 显示)
  diff?: {
    component: ComponentType;
    file?: string;
    changes: DiffChange[];
  };
}

interface DiffChange {
  type: 'insert' | 'delete' | 'modify';
  range: { start: number; end: number };
  oldContent?: string;
  newContent?: string;
}
```

### 3.4 时间线同步机制

```typescript
interface TimelineEvent {
  id: string;
  timestamp: number;
  
  // 谁触发的
  actorId: string;
  actorType: 'user' | 'agent';
  
  // 做了什么
  action: TimelineActionType;
  description: string;
  
  // 影响了哪个组件
  componentType: ComponentType;
  
  // UI 状态快照 (支持回放)
  stateSnapshot: StateSnapshot;
  
  // 关联的消息 ID
  messageId?: string;
  
  // 持续时间 (如果是持续性动作)
  duration?: number;
}

type TimelineActionType =
  | 'navigate'     // 导航/切换
  | 'edit'         // 编辑内容
  | 'execute'      // 执行代码
  | 'analyze'      // 分析
  | 'create'       // 创建文件
  | 'compile'      // 编译
  | 'render';      // 渲染
```

---

## 四、交互式组件系统

### 4.1 Chat 内交互组件

```typescript
interface InteractiveComponent {
  type: InteractiveComponentType;
  id: string;
  // 组件特定配置
  [key: string]: unknown;
}

type InteractiveComponentType =
  | 'button-group'    // 按钮组
  | 'choice-card'     // 选择卡片
  | 'input-field'     // 输入框
  | 'select'          // 下拉选择
  | 'slider'          // 滑块
  | 'file-picker'     // 文件选择
  | 'code-block'      // 可执行代码块
  | 'summary-card'    // 总结卡片
  | 'progress-card';  // 进度卡片

// 按钮组
interface ButtonGroup {
  type: 'button-group';
  id: string;
  buttons: {
    id: string;
    label: string;
    variant: 'primary' | 'secondary' | 'ghost' | 'danger';
    icon?: string;
  }[];
  layout?: 'horizontal' | 'vertical';
}

// 选择卡片
interface ChoiceCard {
  type: 'choice-card';
  id: string;
  title: string;
  options: {
    id: string;
    icon: string;
    label: string;
    description: string;
    disabled?: boolean;
  }[];
  multiSelect?: boolean;
}

// 总结卡片
interface SummaryCard {
  type: 'summary-card';
  id: string;
  stats: {
    label: string;
    value: string;
    icon: string;
    trend?: 'up' | 'down' | 'neutral';
  }[];
  actions?: {
    id: string;
    label: string;
    variant: string;
  }[];
}
```

### 4.2 交互处理流程

```typescript
// 用户交互 -> 发送到后端 -> 触发 Agent -> 返回响应
async function handleInteraction(
  componentId: string,
  actionId: string,
  data?: unknown
): Promise<void> {
  // 1. 发送交互事件
  const response = await api.postInteraction({
    workspaceId,
    componentId,
    actionId,
    data,
    timestamp: Date.now(),
  });
  
  // 2. 处理 Agent 响应
  if (response.messages) {
    response.messages.forEach(addMessage);
  }
  
  // 3. 执行 UI 指令
  if (response.uiDirectives) {
    await executeUIDirectives(response.uiDirectives);
  }
  
  // 4. 更新时间线
  if (response.timelineEvents) {
    response.timelineEvents.forEach(addTimelineEvent);
  }
}
```

---

## 五、实现行动计划

### Phase 1: 类型定义与 Store 扩展 (1天)

**任务**:

1. 扩展 `types.ts`
   - 添加 `UIDirective` 类型
   - 添加 `StateSnapshot` 类型
   - 添加 `InteractiveComponent` 类型
   - 扩展 `ChatMessage` 支持交互组件

2. 扩展 `workspaceStore.ts`
   - 添加 `stateSnapshots: StateSnapshot[]`
   - 添加 `executeUIDirective(directive: UIDirective)` action
   - 添加 `captureStateSnapshot()` action

**文件**:
- `src/app/workspace/types.ts`
- `src/app/workspace/stores/workspaceStore.ts`

---

### Phase 2: 交互组件开发 (2天)

**任务**:

1. 创建 `src/app/workspace/components/InteractiveComponents/`
   - `ButtonGroup.tsx`
   - `ChoiceCard.tsx`
   - `SummaryCard.tsx`
   - `ProgressCard.tsx`
   - `index.tsx` (渲染器)

2. 更新 `MessageList.tsx`
   - 集成交互组件渲染
   - 处理交互事件

**文件**:
- `src/app/workspace/components/InteractiveComponents/`
- `src/app/workspace/components/WorkspaceChat/MessageList.tsx`

---

### Phase 3: UI Directive 执行器 (2天)

**任务**:

1. 创建 `src/app/workspace/lib/uiDirectiveExecutor.ts`
   - 实现各类型指令的执行逻辑
   - 支持延迟执行
   - 支持动画过渡

2. 创建 `src/app/workspace/lib/stateSnapshotManager.ts`
   - 实现状态快照捕获
   - 实现状态恢复 (用于时间线回放)

3. 集成到 `WorkspaceView.tsx`

**文件**:
- `src/app/workspace/lib/uiDirectiveExecutor.ts`
- `src/app/workspace/lib/stateSnapshotManager.ts`
- `src/app/workspace/components/WorkspaceView.tsx`

---

### Phase 4: Diff 显示系统 (1天)

**任务**:

1. 创建 `src/app/workspace/components/DiffViewer/`
   - 实现文本 diff 显示
   - 实现代码 diff 高亮
   - 支持行级和字符级 diff

2. 集成到各编辑器组件
   - LaTeX Editor
   - Code Playground
   - AI Editor

**文件**:
- `src/app/workspace/components/DiffViewer/`

---

### Phase 5: 完整 Demo 数据 (1天)

**任务**:

1. 更新 `src/app/workspace/mock/demoData.ts`
   - 实现完整的 9 步演示数据
   - 包含所有交互组件配置
   - 包含所有 UI 指令

2. 创建 `src/app/workspace/mock/demoRunner.ts`
   - 实现演示流程自动播放
   - 支持暂停/继续
   - 支持跳转到特定步骤

**文件**:
- `src/app/workspace/mock/demoData.ts`
- `src/app/workspace/mock/demoRunner.ts`

---

### Phase 6: 时间线回放增强 (1天)

**任务**:

1. 增强 `Timeline` 组件
   - 显示更详细的事件标记
   - 点击事件跳转到对应状态
   - 显示事件预览

2. 实现状态回放
   - 根据 `stateSnapshot` 恢复 UI 状态
   - 平滑过渡动画

**文件**:
- `src/app/workspace/components/Timeline/index.tsx`
- `src/app/workspace/lib/timelinePlayer.ts`

---

## 六、技术架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Workspace View                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │    Chat Panel       │    │       Window Viewer            │  │
│  │                     │    │                                │  │
│  │  ┌───────────────┐  │    │  ┌────────────────────────┐   │  │
│  │  │  TaskPanel    │  │    │  │    ComponentTabs       │   │  │
│  │  └───────────────┘  │    │  └────────────────────────┘   │  │
│  │                     │    │                                │  │
│  │  ┌───────────────┐  │    │  ┌────────────────────────┐   │  │
│  │  │ MessageList   │  │    │  │   Active Component     │   │  │
│  │  │               │  │    │  │                        │   │  │
│  │  │ ┌───────────┐ │  │    │  │  - PDF Reader          │   │  │
│  │  │ │Interactive│ │  │    │  │  - LaTeX Editor        │   │  │
│  │  │ │Components │ │  │    │  │  - Code Playground     │   │  │
│  │  │ └───────────┘ │  │    │  │  - Jupyter Notebook    │   │  │
│  │  │               │  │    │  │  - AI Editor           │   │  │
│  │  └───────────────┘  │    │  │                        │   │  │
│  │                     │    │  │  ┌──────────────────┐  │   │  │
│  │  ┌───────────────┐  │    │  │  │   Diff Overlay   │  │   │  │
│  │  │  ChatInput    │  │    │  │  └──────────────────┘  │   │  │
│  │  │ @ # / support │  │    │  │                        │   │  │
│  │  └───────────────┘  │    │  └────────────────────────┘   │  │
│  │                     │    │                                │  │
│  └─────────────────────┘    │  ┌────────────────────────┐   │  │
│                             │  │      Timeline          │   │  │
│                             │  │  ●──●──●──●──●────▶    │   │  │
│                             │  └────────────────────────┘   │  │
│                             │                                │  │
│                             └────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      State Management                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────┐    ┌────────────────┐    ┌───────────────┐  │
│  │ workspaceStore │───▶│ UIDirective    │───▶│ Component     │  │
│  │                │    │ Executor       │    │ State Update  │  │
│  └────────────────┘    └────────────────┘    └───────────────┘  │
│         │                                            │          │
│         │                                            │          │
│         ▼                                            ▼          │
│  ┌────────────────┐                         ┌───────────────┐   │
│  │ StateSnapshot  │◀────────────────────────│ State Capture │   │
│  │ Manager        │                         │               │   │
│  └────────────────┘                         └───────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌────────────────┐                                            │
│  │ Timeline       │                                            │
│  │ Events         │                                            │
│  └────────────────┘                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 七、风险与注意事项

### 7.1 性能考虑

- **状态快照大小**: 需要优化快照存储，避免内存膨胀
- **Diff 计算**: 大文件 diff 可能耗时，考虑 Web Worker
- **动画性能**: 多组件同时动画时注意性能

### 7.2 复杂度控制

- **渐进式实现**: 先实现核心流程，再添加边缘情况
- **Mock 优先**: 先用 mock 数据验证 UI，再接真实 Agent

### 7.3 测试策略

- 单元测试: UIDirective 执行器
- 集成测试: 完整演示流程
- E2E 测试: 用户交互流程

---

## 八、预期产出

完成后，Workspace 将支持：

1. ✅ Agent 主动发起对话
2. ✅ 用户通过交互组件响应
3. ✅ 自动切换到对应组件并加载内容
4. ✅ 显示内容变化的 Diff
5. ✅ 时间线记录所有操作
6. ✅ 支持时间线回放
7. ✅ 完整的 VLA 研究演示流程

---

## 九、实现文件清单

### 9.1 类型定义

| 文件 | 说明 |
|------|------|
| `types.ts` | 扩展类型定义：UIDirective、InteractiveComponent、StateSnapshot 等 |

### 9.2 Store 扩展

| 文件 | 说明 |
|------|------|
| `stores/workspaceStore.ts` | 新增：componentStates、stateSnapshots、demoConfig、activeDiff 状态及对应 actions |

### 9.3 核心库

| 文件 | 说明 |
|------|------|
| `lib/uiDirectiveExecutor.ts` | UI 指令执行器，支持延迟执行、批量执行 |
| `lib/stateSnapshotManager.ts` | 状态快照管理器，支持捕获、恢复、对比 |
| `lib/demoRunner.ts` | Demo 流程运行器，支持自动播放、手动控制 |

### 9.4 交互组件

| 文件 | 说明 |
|------|------|
| `components/InteractiveComponents/ButtonGroup.tsx` | 按钮组组件 |
| `components/InteractiveComponents/ChoiceCard.tsx` | 选择卡片组件 |
| `components/InteractiveComponents/SummaryCard.tsx` | 总结卡片组件 |
| `components/InteractiveComponents/ProgressCard.tsx` | 进度卡片组件 |
| `components/InteractiveComponents/CodeBlock.tsx` | 可执行代码块组件 |
| `components/InteractiveComponents/index.tsx` | 交互组件渲染器 |

### 9.5 Diff 显示

| 文件 | 说明 |
|------|------|
| `components/DiffViewer/index.tsx` | 差异查看器，支持行级 diff 显示 |

### 9.6 Mock 数据

| 文件 | 说明 |
|------|------|
| `mock/demoFlowTypes.ts` | Demo 数据接口定义 (IDemoDataProvider) |
| `mock/vlaResearchDemo.ts` | VLA 研究演示完整数据 (9 步骤) |

### 9.7 组件更新

| 文件 | 说明 |
|------|------|
| `components/WorkspaceChat/MessageList.tsx` | 集成交互组件渲染 |
| `components/WorkspaceChat/index.tsx` | 添加 onInteraction 回调 |
| `components/Timeline/index.tsx` | 增强：事件详情弹窗、可展开事件列表 |
| `components/WindowViewer/index.tsx` | 添加 Diff Overlay、时间线事件点击 |
| `components/WorkspaceView.tsx` | 集成 Demo 流程、交互处理、Diff 显示 |

---

## 十、使用说明

### 10.1 创建自定义 Demo

实现 `IDemoDataProvider` 接口即可创建新的演示流程：

```typescript
import type { IDemoDataProvider } from './mock/demoFlowTypes';

class MyCustomDemoProvider implements IDemoDataProvider {
  getDemoFlowConfig() { /* ... */ }
  getParticipants() { /* ... */ }
  getInitialTasks() { /* ... */ }
  getStepMessages(stepIndex: number) { /* ... */ }
  getStepTimelineEvents(stepIndex: number) { /* ... */ }
  handleInteraction(componentId: string, actionId: string) { /* ... */ }
}
```

### 10.2 添加新的交互组件

1. 在 `types.ts` 中添加组件类型定义
2. 在 `InteractiveComponents/` 下创建组件文件
3. 在 `InteractiveComponents/index.tsx` 中注册渲染

### 10.3 扩展 UI 指令

在 `lib/uiDirectiveExecutor.ts` 的 `executeDirective` 方法中添加新的指令处理逻辑。

---

*文档版本: 2.0*  
*创建日期: 2026-01-29*  
*更新日期: 2026-01-29*  
*作者: System*
