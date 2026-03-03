/**
 * Demo Orchestrator
 *
 * Plain module (not a hook) that intercepts specific user messages and
 * drives multi-step demo flows through Zustand stores + custom events.
 * Simulates real agent behavior when container LLM is unavailable.
 *
 * Usage:
 *   import { tryDemoMessage } from '../lib/demoOrchestrator';
 *   if (tryDemoMessage(workspaceId, content)) return;
 */

import { useChatStore } from '../stores/chatStore';
import { useTaskStore } from '../stores/taskStore';
import { useTimelineStore } from '../stores/timelineStore';
import { useComponentStore } from '../stores/componentStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useAgentInstanceStore } from '../stores/agentInstanceStore';
import type { ExtendedChatMessage, ExtendedTimelineEvent, Task, ComponentType, TimelineActionType } from '../types';
import type { ArtifactRef } from '@/types/message';
import { componentEventBus } from '@/lib/events';
import { VIT_SURVEY_LATEX } from '../hooks/demo-content/vitSurvey';
import { COS_CURVE_CODE, COS_CURVE_SVG, COS_CURVE_SVG_RAW } from '../hooks/demo-content/cosCurve';
import { ABLATION_STUDY_HTML } from '../hooks/demo-content/ablationStudy';

// ============================================================
// Types
// ============================================================

interface OrchestratorContext {
  workspaceId: string;
  addMessage: (msg: ExtendedChatMessage) => void;
  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateSubtaskStatus: (taskId: string, subtaskId: string, status: 'pending' | 'running' | 'completed' | 'error') => void;
  addTimelineEvent: (event: ExtendedTimelineEvent) => void;
  setActiveComponent: (type: ComponentType) => void;
  updateComponentState: <K extends keyof import('../types').ComponentStates>(
    component: K,
    state: Partial<import('../types').ComponentStates[K]>
  ) => void;
  setTaskPanelHeight: (height: import('../types').TaskPanelHeight) => void;
}

// ============================================================
// Helpers
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let messageCounter = 0;
function msgId(): string {
  return `demo-msg-${Date.now()}-${++messageCounter}`;
}

function agentMessage(
  workspaceId: string,
  content: string,
  artifacts?: ArtifactRef[],
): ExtendedChatMessage {
  return {
    id: msgId(),
    workspaceId,
    senderId: 'demo-agent',
    senderType: 'agent',
    senderName: 'Research Agent',
    content,
    contentType: 'markdown',
    timestamp: new Date().toISOString(),
    ...(artifacts && artifacts.length > 0 ? { artifacts } : {}),
  };
}

function userMessage(workspaceId: string, content: string): ExtendedChatMessage {
  return {
    id: msgId(),
    workspaceId,
    senderId: 'dev-user-1',
    senderType: 'user',
    senderName: 'User',
    content,
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };
}

function tlEvent(
  componentType: ComponentType,
  action: TimelineActionType,
  description: string,
): ExtendedTimelineEvent {
  return {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    componentType,
    action,
    description,
    actorType: 'agent',
  };
}

// ============================================================
// Scenario 1: ViT Survey (LaTeX)
// ============================================================

async function runViTSurveyScenario(ctx: OrchestratorContext): Promise<void> {
  const { workspaceId } = ctx;

  ctx.addMessage(agentMessage(workspaceId,
    '好的，我来帮你撰写关于 **Vision Transformer** 的综述论文。\n\n' +
    '我将分三个阶段完成：\n' +
    '1. 文献调研与大纲设计\n' +
    '2. 撰写初稿\n' +
    '3. LaTeX 编译与排版\n\n' +
    '正在开始文献调研...'
  ));

  await delay(500);
  const tasks: Task[] = [
    {
      id: 'task-vit-1', title: '文献调研与大纲', status: 'pending', progress: 0,
      subtasks: [
        { id: 'sub-1-1', parentId: 'task-vit-1', title: '检索 ViT 相关论文', status: 'pending' },
        { id: 'sub-1-2', parentId: 'task-vit-1', title: '分析核心架构变体', status: 'pending' },
        { id: 'sub-1-3', parentId: 'task-vit-1', title: '设计论文大纲', status: 'pending' },
      ],
    },
    {
      id: 'task-vit-2', title: '撰写初稿', status: 'pending', progress: 0,
      subtasks: [
        { id: 'sub-2-1', parentId: 'task-vit-2', title: 'Introduction & Background', status: 'pending' },
        { id: 'sub-2-2', parentId: 'task-vit-2', title: 'Architecture & Key Variants', status: 'pending' },
        { id: 'sub-2-3', parentId: 'task-vit-2', title: 'Performance Comparison', status: 'pending' },
        { id: 'sub-2-4', parentId: 'task-vit-2', title: 'Applications & Conclusion', status: 'pending' },
      ],
    },
    {
      id: 'task-vit-3', title: 'LaTeX 编译与排版', status: 'pending', progress: 0,
      subtasks: [
        { id: 'sub-3-1', parentId: 'task-vit-3', title: '编译 LaTeX 源码', status: 'pending' },
        { id: 'sub-3-2', parentId: 'task-vit-3', title: '生成 PDF 预览', status: 'pending' },
      ],
    },
  ];
  ctx.setTasks(tasks);
  ctx.setTaskPanelHeight('30%');

  // Task 1: 文献调研
  await delay(500);
  ctx.updateTask('task-vit-1', { status: 'running' });
  ctx.addTimelineEvent(tlEvent('ai-editor', 'workflow_start', '开始文献调研'));

  await delay(1000);
  ctx.updateSubtaskStatus('task-vit-1', 'sub-1-1', 'completed');
  ctx.addTimelineEvent(tlEvent('ai-editor', 'workflow_step', '已检索 8 篇核心论文'));

  await delay(800);
  ctx.updateSubtaskStatus('task-vit-1', 'sub-1-2', 'completed');

  await delay(600);
  ctx.updateSubtaskStatus('task-vit-1', 'sub-1-3', 'completed');
  ctx.addTimelineEvent(tlEvent('ai-editor', 'workflow_step', '大纲设计完成'));

  // Task 2: 撰写初稿
  await delay(500);
  ctx.updateTask('task-vit-2', { status: 'running' });
  ctx.addTimelineEvent(tlEvent('latex-editor', 'workflow_step', '开始撰写初稿'));

  await delay(1000);
  ctx.setActiveComponent('latex-editor');

  // 2s for lazy component mount
  await delay(2000);
  window.dispatchEvent(new CustomEvent('demo:updateLatex', {
    detail: { file: 'main.tex', content: VIT_SURVEY_LATEX },
  }));

  // Artifact created notification (DESIGN §3.6 Scene A)
  ctx.addMessage(agentMessage(workspaceId,
    '已创建 LaTeX 文档，正在撰写各章节...', [
      {
        id: 'artifact-vit-tex',
        type: 'latex',
        name: 'vit-survey.tex',
        description: 'Vision Transformer 综述论文 LaTeX 源码',
        version: 'v1',
        size: '8.2 KB',
        previewText: '\\documentclass{article}\n\\title{Vision Transformer: A Comprehensive Survey}\n...',
      },
    ]));

  await delay(500);
  ctx.updateSubtaskStatus('task-vit-2', 'sub-2-1', 'completed');
  ctx.addTimelineEvent(tlEvent('latex-editor', 'workflow_step', 'Introduction 撰写完成'));

  await delay(500);
  ctx.updateSubtaskStatus('task-vit-2', 'sub-2-2', 'completed');

  await delay(500);
  ctx.updateSubtaskStatus('task-vit-2', 'sub-2-3', 'completed');
  ctx.addTimelineEvent(tlEvent('latex-editor', 'workflow_step', '性能对比表格完成'));

  await delay(500);
  ctx.updateSubtaskStatus('task-vit-2', 'sub-2-4', 'completed');
  ctx.addTimelineEvent(tlEvent('latex-editor', 'workflow_step', '初稿撰写完成'));

  // Task 3: 编译 (Docker-based, ~15s total)
  await delay(500);
  ctx.updateTask('task-vit-3', { status: 'running' });
  ctx.updateSubtaskStatus('task-vit-3', 'sub-3-1', 'running');
  ctx.addTimelineEvent(tlEvent('latex-editor', 'execute', '开始 LaTeX 编译'));

  await delay(500);
  window.dispatchEvent(new CustomEvent('demo:compileLatex'));

  // Wait for compilation to complete via component event bus
  // LatexEditorPreview emits 'actionComplete' when compile finishes
  try {
    await componentEventBus.waitForAction('latex-editor', 'compile', 30000);
  } catch {
    // Timeout — compilation may still be in progress or failed, continue anyway
    console.warn('[DemoOrchestrator] LaTeX compile wait timed out');
  }
  await delay(500);

  ctx.updateSubtaskStatus('task-vit-3', 'sub-3-1', 'completed');
  ctx.updateSubtaskStatus('task-vit-3', 'sub-3-2', 'completed');
  ctx.addTimelineEvent(tlEvent('latex-editor', 'workflow_complete', 'LaTeX 编译完成'));

  await delay(500);
  ctx.addMessage(agentMessage(workspaceId,
    '综述撰写完成！\n\n' +
    '**Vision Transformer: A Comprehensive Survey** 已在 LaTeX 编辑器中完成编译。\n\n' +
    '文章包含：\n' +
    '- 6 个章节（Introduction → Conclusion）\n' +
    '- 自注意力机制数学公式\n' +
    '- ViT 变体性能对比表\n' +
    '- 8 篇核心参考文献', [
      {
        id: 'artifact-vit-pdf',
        type: 'pdf',
        name: 'vit-survey.pdf',
        description: '编译后的 PDF 文档',
        version: 'v1',
        size: '245 KB',
      },
      {
        id: 'artifact-vit-tex-final',
        type: 'latex',
        name: 'vit-survey.tex',
        description: 'LaTeX 源码（6 章 + 参考文献）',
        version: 'v1',
        size: '8.2 KB',
      },
    ]));
  ctx.addTimelineEvent(tlEvent('latex-editor', 'workflow_complete', '任务完成：ViT 综述'));
}

// ============================================================
// Scenario 2: Cos Curve (Jupyter + Gallery)
// ============================================================

async function runCosCurveScenario(ctx: OrchestratorContext): Promise<void> {
  const { workspaceId } = ctx;

  ctx.addMessage(agentMessage(workspaceId,
    '好的，我来用 **Python** 绘制 cos 曲线。\n\n' +
    '将使用 NumPy + Matplotlib 生成高质量图表，并保存到资产库。'
  ));

  await delay(500);
  const tasks: Task[] = [
    {
      id: 'task-cos-1', title: '编写绘图代码', status: 'pending', progress: 0,
      subtasks: [
        { id: 'sub-cos-1-1', parentId: 'task-cos-1', title: '生成数据与绘图', status: 'pending' },
        { id: 'sub-cos-1-2', parentId: 'task-cos-1', title: '执行代码', status: 'pending' },
      ],
    },
    {
      id: 'task-cos-2', title: '保存到资产库', status: 'pending', progress: 0,
      subtasks: [
        { id: 'sub-cos-2-1', parentId: 'task-cos-2', title: '保存图片到 Gallery', status: 'pending' },
      ],
    },
  ];
  ctx.setTasks(tasks);
  ctx.setTaskPanelHeight('30%');

  await delay(500);
  ctx.updateTask('task-cos-1', { status: 'running' });
  ctx.addTimelineEvent(tlEvent('jupyter-notebook', 'workflow_start', '开始绘制 cos 曲线'));

  await delay(500);
  ctx.setActiveComponent('jupyter-notebook');
  ctx.addTimelineEvent(tlEvent('jupyter-notebook', 'execute', '切换到 Jupyter Notebook'));

  // 2s for lazy component mount
  await delay(2000);
  ctx.updateSubtaskStatus('task-cos-1', 'sub-cos-1-1', 'running');
  window.dispatchEvent(new CustomEvent('demo:addAndRunCell', {
    detail: {
      type: 'code',
      source: COS_CURVE_CODE,
      // Pre-rendered outputs: skip real kernel execution
      outputs: [
        {
          type: 'stream',
          name: 'stdout',
          text: 'Plot saved to /workspace/cos_curve.png\n',
        },
        {
          type: 'display_data',
          data: {
            'image/svg+xml': COS_CURVE_SVG_RAW,
            'text/plain': '<Figure size 1000x600 with 1 Axes>',
          },
          metadata: {},
        },
      ],
    },
  }));

  await delay(1500);
  ctx.updateSubtaskStatus('task-cos-1', 'sub-cos-1-1', 'completed');
  ctx.updateSubtaskStatus('task-cos-1', 'sub-cos-1-2', 'completed');
  ctx.addTimelineEvent(tlEvent('jupyter-notebook', 'workflow_step', 'cos 曲线绘图代码执行完成'));

  // Artifact: Jupyter notebook created
  ctx.addMessage(agentMessage(workspaceId,
    '绘图代码已执行完成，正在保存图片到资产库...', [
      {
        id: 'artifact-cos-notebook',
        type: 'notebook',
        name: 'cos_curve.ipynb',
        description: 'NumPy + Matplotlib 绘制 cos 曲线',
        version: 'v1',
        size: '3.1 KB',
        previewText: 'import numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 4*np.pi, 1000)\ny = np.cos(x)',
      },
    ]));

  // Hold Jupyter visible for 4s so user can see code + SVG output
  await delay(4000);

  ctx.updateTask('task-cos-2', { status: 'running' });
  ctx.updateSubtaskStatus('task-cos-2', 'sub-cos-2-1', 'running');

  await delay(500);
  ctx.setActiveComponent('bento-gallery');
  ctx.addTimelineEvent(tlEvent('bento-gallery', 'navigate', '切换到 Gallery'));

  // 2s for lazy component mount
  await delay(2000);
  window.dispatchEvent(new CustomEvent('demo:addGalleryImage', {
    detail: {
      image: {
        id: `cos-${Date.now()}`,
        title: 'Cosine Curve',
        desc: 'cos(x) plotted with NumPy + Matplotlib. Range: [0, 4π]',
        url: COS_CURVE_SVG,
        span: 'md:col-span-2 md:row-span-2',
      },
    },
  }));

  await delay(500);
  ctx.updateSubtaskStatus('task-cos-2', 'sub-cos-2-1', 'completed');
  ctx.addTimelineEvent(tlEvent('bento-gallery', 'workflow_complete', '图片已保存到 Gallery'));

  await delay(1000);
  ctx.addMessage(agentMessage(workspaceId,
    'cos 曲线已绘制完成！\n\n' +
    '- **Jupyter**: 绘图代码已执行\n' +
    '- **Gallery**: cos 曲线图已添加到图库\n\n' +
    '图表展示了 cos(x) 在 [0, 4π] 区间的完整波形。', [
      {
        id: 'artifact-cos-image',
        type: 'image',
        name: 'cos_curve.svg',
        description: 'cos(x) 曲线图 — Range: [0, 4π]',
        version: 'v1',
        size: '2.4 KB',
        previewUrl: COS_CURVE_SVG,
      },
    ]));
  ctx.addTimelineEvent(tlEvent('bento-gallery', 'workflow_complete', '任务完成：cos 曲线绘图'));
}

// ============================================================
// Scenario 3: Ablation Study (Notes)
// ============================================================

async function runAblationStudyScenario(ctx: OrchestratorContext): Promise<void> {
  const { workspaceId } = ctx;

  ctx.addMessage(agentMessage(workspaceId,
    '好的，我来撰写 **目标检测消融实验** 分析文档。\n\n' +
    '将基于 COCO 2017 数据集，对 Backbone、Neck、Head、数据增强和 Loss 进行系统性消融分析。'
  ));

  await delay(500);
  const tasks: Task[] = [
    {
      id: 'task-abl-1', title: '设计实验方案', status: 'pending', progress: 0,
      subtasks: [
        { id: 'sub-abl-1-1', parentId: 'task-abl-1', title: '定义消融变量', status: 'pending' },
        { id: 'sub-abl-1-2', parentId: 'task-abl-1', title: '设置基线模型', status: 'pending' },
      ],
    },
    {
      id: 'task-abl-2', title: '撰写分析报告', status: 'pending', progress: 0,
      subtasks: [
        { id: 'sub-abl-2-1', parentId: 'task-abl-2', title: '生成实验结果表格', status: 'pending' },
        { id: 'sub-abl-2-2', parentId: 'task-abl-2', title: '撰写分析与结论', status: 'pending' },
      ],
    },
  ];
  ctx.setTasks(tasks);
  ctx.setTaskPanelHeight('30%');

  await delay(500);
  ctx.updateTask('task-abl-1', { status: 'running' });
  ctx.addTimelineEvent(tlEvent('ai-editor', 'workflow_start', '开始设计实验方案'));

  await delay(800);
  ctx.updateSubtaskStatus('task-abl-1', 'sub-abl-1-1', 'completed');

  await delay(600);
  ctx.updateSubtaskStatus('task-abl-1', 'sub-abl-1-2', 'completed');
  ctx.addTimelineEvent(tlEvent('ai-editor', 'workflow_step', '实验方案设计完成'));

  await delay(600);
  ctx.updateTask('task-abl-2', { status: 'running' });
  ctx.addTimelineEvent(tlEvent('ai-editor', 'workflow_step', '开始撰写分析报告'));

  await delay(500);
  ctx.setActiveComponent('ai-editor');

  // 2s for component mount
  await delay(2000);
  ctx.updateComponentState('ai-editor', { content: ABLATION_STUDY_HTML });
  ctx.addTimelineEvent(tlEvent('ai-editor', 'edit', '文档内容注入完成'));

  await delay(500);
  ctx.updateSubtaskStatus('task-abl-2', 'sub-abl-2-1', 'completed');
  ctx.addTimelineEvent(tlEvent('ai-editor', 'workflow_step', '6 组消融实验表格完成'));

  await delay(800);
  ctx.updateSubtaskStatus('task-abl-2', 'sub-abl-2-2', 'completed');
  ctx.addTimelineEvent(tlEvent('ai-editor', 'workflow_complete', '分析报告撰写完成'));

  // Artifact: Notes document created
  ctx.addMessage(agentMessage(workspaceId,
    '文档内容已生成，正在完成分析部分...', [
      {
        id: 'artifact-abl-notes',
        type: 'notes',
        name: '消融实验分析报告.md',
        description: '目标检测消融实验 — COCO 2017',
        version: 'v1',
        size: '15.6 KB',
      },
    ]));

  await delay(700);
  ctx.addMessage(agentMessage(workspaceId,
    '消融实验文档已完成！\n\n' +
    '文档包含：\n' +
    '- 6 组消融实验（Backbone/Neck/Head/增强/Loss/NMS）\n' +
    '- 详细的性能对比表格（mAP, AP50, AP75 等）\n' +
    '- 最优组合分析：**Swin-S + BiFPN + CIoU + Combined Aug → 48.7 mAP** (+11.3)\n' +
    '- 每组实验的定量分析与结论', [
      {
        id: 'artifact-abl-notes-final',
        type: 'notes',
        name: '消融实验分析报告.md',
        description: '完整报告 — 6 组实验 + 结论分析',
        version: 'v2',
        size: '15.6 KB',
      },
    ]));
  ctx.addTimelineEvent(tlEvent('ai-editor', 'workflow_complete', '任务完成：消融实验文档'));
}

// ============================================================
// Pattern Matching
// ============================================================

type ScenarioId = 'vit-survey' | 'cos-curve' | 'ablation-study';

function matchScenario(content: string): ScenarioId | null {
  const lower = content.toLowerCase();

  if (
    (lower.includes('vision transformer') || lower.includes('vit')) &&
    (lower.includes('综述') || lower.includes('survey'))
  ) return 'vit-survey';
  if (lower.includes('综述') && lower.includes('transformer')) return 'vit-survey';

  if (lower.includes('cos') && (lower.includes('曲线') || lower.includes('curve') || lower.includes('绘')))
    return 'cos-curve';

  if (lower.includes('消融') && (lower.includes('实验') || lower.includes('文档'))) return 'ablation-study';
  if (lower.includes('ablation') && lower.includes('study')) return 'ablation-study';

  return null;
}

const scenarioRunners: Record<ScenarioId, (ctx: OrchestratorContext) => Promise<void>> = {
  'vit-survey': runViTSurveyScenario,
  'cos-curve': runCosCurveScenario,
  'ablation-study': runAblationStudyScenario,
};

// ============================================================
// Public API
// ============================================================

let isRunning = false;

function buildContext(workspaceId: string): OrchestratorContext {
  return {
    workspaceId,
    addMessage: (msg) => useChatStore.getState().addMessage(msg),
    setTasks: (tasks) => useTaskStore.getState().setTasks(tasks),
    updateTask: (id, updates) => useTaskStore.getState().updateTask(id, updates),
    updateSubtaskStatus: (taskId, subtaskId, status) =>
      useTaskStore.getState().updateSubtaskStatus(taskId, subtaskId, status),
    addTimelineEvent: (event) => useTimelineStore.getState().addTimelineEvent(event),
    setActiveComponent: (type) => useComponentStore.getState().setActiveComponent(type),
    updateComponentState: (component, state) =>
      useComponentStore.getState().updateComponentState(component, state as never),
    setTaskPanelHeight: (height) => useLayoutStore.getState().setTaskPanelHeight(height),
  };
}

/**
 * Try to handle a message as a demo scenario.
 * Returns true if matched (message consumed), false if not (pass to real bridge).
 */
export function tryDemoMessage(workspaceId: string, content: string): boolean {
  const scenario = matchScenario(content);
  if (!scenario) return false;

  if (isRunning) {
    useChatStore.getState().addMessage(
      agentMessage(workspaceId, '当前有任务正在执行，请稍后再试。')
    );
    return true;
  }

  // Add user message
  useChatStore.getState().addMessage(userMessage(workspaceId, content));

  // Activate demo mode — sets connection indicator to green
  useAgentInstanceStore.setState({
    agentInstanceStatus: 'running',
    agentInstanceId: useAgentInstanceStore.getState().agentInstanceId || 'demo-agent-instance',
    gatewayUrl: 'ws://demo-orchestrator:18900',
    orchestratorType: 'docker',
    containerHostPort: 18900,
  });

  // Run scenario
  isRunning = true;
  const ctx = buildContext(workspaceId);
  scenarioRunners[scenario](ctx)
    .catch((err) => {
      console.error('[DemoOrchestrator] Scenario error:', err);
      ctx.addMessage(agentMessage(workspaceId, `场景执行出错: ${err instanceof Error ? err.message : String(err)}`));
    })
    .finally(() => { isRunning = false; });

  return true;
}
