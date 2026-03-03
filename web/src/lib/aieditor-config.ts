/**
 * AiEditor AI 配置
 * 
 * 注意：AiEditor 的 AI 功能目前在客户端是禁用的
 * 因为它需要直接暴露 API Key，这是不安全的
 * 
 * 论文阅读器的 AI 功能（Insights、Chat、翻译）使用服务端代理 /api/ai/*
 */

import type { AiEditorOptions } from 'aieditor';

// ============================================================
// Types
// ============================================================

interface AiConfig {
  enabled: boolean;
}

// ============================================================
// Config
// ============================================================

let _aiEnabled: boolean | null = null;

/**
 * 检查 AI 服务是否可用
 */
async function checkAiAvailability(): Promise<boolean> {
  if (_aiEnabled !== null) {
    return _aiEnabled;
  }

  try {
    const response = await fetch('/api/config/client');
    if (response.ok) {
      const config = await response.json();
      _aiEnabled = !!config.aiEnabled;
      return _aiEnabled;
    }
  } catch (error) {
    console.warn('[AiEditor] Failed to check AI availability:', error);
  }

  _aiEnabled = false;
  return false;
}

// 预加载
if (typeof window !== 'undefined') {
  checkAiAvailability().catch(() => {});
}

// ============================================================
// AI 菜单配置 (保留以备将来使用)
// ============================================================

const AI_MENUS = [
  {
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
    name: 'explain',
    prompt: '请用简单易懂的语言解释以下内容：\n\n{content}',
  },
  {
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    name: 'summarize',
    prompt: '请简洁地总结以下内容的要点（使用 bullet points）：\n\n{content}',
  },
  {
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    name: 'improve',
    prompt: '请改进以下文本的表达，使其更加清晰、专业：\n\n{content}',
  },
  {
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>',
    name: 'translate-en',
    prompt: '请将以下内容翻译成英文，保持学术风格：\n\n{content}',
  },
  {
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>',
    name: 'translate-zh',
    prompt: '请将以下内容翻译成中文，保持学术风格：\n\n{content}',
  },
];

// ============================================================
// Public API
// ============================================================

/**
 * 获取 AiEditor 的 AI 配置 (同步)
 * 
 * 注意：目前返回空配置，因为 AiEditor 的 AI 功能需要直接暴露 API Key
 * 论文阅读器的 AI 功能使用服务端代理，不受此影响
 */
export function getAiEditorConfig(): Partial<AiEditorOptions> {
  // AiEditor 的内置 AI 功能目前禁用
  // 需要客户端 API Key，不安全
  console.warn('[AiEditor] Built-in AI features are disabled for security. Use the PDF reader AI features instead.');
  return {};
}

/**
 * 异步获取 AiEditor 的 AI 配置
 */
export async function getAiEditorConfigAsync(): Promise<Partial<AiEditorOptions>> {
  // 同上，返回空配置
  return {};
}

/**
 * 获取 AI 模型信息
 */
export function getAiModelInfo() {
  return {
    baseUrl: '/api/ai', // 使用服务端代理
    model: 'default',
    hasApiKey: _aiEnabled === true,
  };
}

/**
 * 检查 AI 功能是否可用 (同步)
 */
export function isAiEnabled(): boolean {
  return _aiEnabled === true;
}

/**
 * 检查 AI 功能是否可用 (异步)
 */
export async function isAiEnabledAsync(): Promise<boolean> {
  return checkAiAvailability();
}

/**
 * 预加载配置
 */
export async function preloadAiConfig(): Promise<void> {
  await checkAiAvailability();
}
