/**
 * Unified AI Client
 *
 * 统一的 AI 调用客户端，所有组件通过此模块调用 LLM。
 * 支持流式/非流式、意图预设、AbortController、SSE 解析。
 *
 * 设计原则：
 * - 组件声明意图 (creative/analytical/code)，客户端负责参数预设
 * - 服务端 /api/ai/chat 负责推理模型归一化（temperature、system message 等）
 * - 统一的 SSE 流解析和错误处理
 */

// ============================================================
// Types
// ============================================================

export type AIIntent = 'creative' | 'analytical' | 'code' | 'chat' | 'translate';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  /** 消息列表 */
  messages: AIMessage[];
  /** 模型名称，'default' 使用服务端配置 */
  model?: string;
  /** 意图预设 — 自动设置 temperature/max_tokens */
  intent?: AIIntent;
  /** 是否流式响应 */
  stream?: boolean;
  /** 覆盖 temperature (优先于 intent 预设) */
  temperature?: number;
  /** 覆盖 max_tokens (优先于 intent 预设) */
  maxTokens?: number;
  /** AbortSignal 用于取消请求 */
  signal?: AbortSignal;
  /** 额外参数透传 */
  extra?: Record<string, unknown>;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
  /** 完整响应（仅在 done=true 时可用） */
  fullContent?: string;
}

export interface AIResponse {
  content: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIError {
  message: string;
  status?: number;
  details?: string;
}

// ============================================================
// Intent Presets
// ============================================================

const INTENT_PRESETS: Record<AIIntent, { temperature: number; maxTokens: number }> = {
  creative:   { temperature: 0.8, maxTokens: 2000 },
  analytical: { temperature: 0.3, maxTokens: 1500 },
  code:       { temperature: 0.2, maxTokens: 2000 },
  chat:       { temperature: 0.7, maxTokens: 2000 },
  translate:  { temperature: 0.3, maxTokens: 1500 },
};

// ============================================================
// Core Functions
// ============================================================

function buildRequestBody(options: AIRequestOptions): Record<string, unknown> {
  const preset = options.intent ? INTENT_PRESETS[options.intent] : undefined;

  return {
    messages: options.messages,
    model: options.model || 'default',
    stream: options.stream ?? true,
    temperature: options.temperature ?? preset?.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? preset?.maxTokens ?? 2000,
    ...options.extra,
  };
}

/**
 * 非流式 AI 调用
 */
export async function aiChat(options: AIRequestOptions): Promise<AIResponse> {
  const body = buildRequestBody({ ...options, stream: false });

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: AIError = {
      message: errorData.error || `AI request failed (${response.status})`,
      status: response.status,
      details: errorData.details,
    };
    throw error;
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model,
    usage: data.usage,
  };
}

/**
 * 流式 AI 调用 — 返回 AsyncGenerator
 *
 * 用法：
 * ```ts
 * for await (const chunk of aiChatStream({ messages, intent: 'chat' })) {
 *   console.log(chunk.content);
 *   if (chunk.done) console.log('Full:', chunk.fullContent);
 * }
 * ```
 */
export async function* aiChatStream(
  options: AIRequestOptions
): AsyncGenerator<AIStreamChunk> {
  const body = buildRequestBody({ ...options, stream: true });

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: AIError = {
      message: errorData.error || `AI stream failed (${response.status})`,
      status: response.status,
      details: errorData.details,
    };
    throw error;
  }

  if (!response.body) {
    throw { message: 'No response body for stream' } as AIError;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed === 'data: [DONE]') {
          yield { content: '', done: true, fullContent };
          return;
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              yield { content: delta, done: false };
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    }

    // Stream ended without [DONE]
    if (fullContent) {
      yield { content: '', done: true, fullContent };
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 流式 AI 调用 — 回调模式 (适配现有组件)
 *
 * 返回 AbortController，调用 .abort() 可取消请求
 */
export function aiChatStreamCallback(
  options: Omit<AIRequestOptions, 'signal'>,
  callbacks: {
    onChunk: (content: string) => void;
    onDone?: (fullContent: string) => void;
    onError?: (error: AIError) => void;
  }
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      for await (const chunk of aiChatStream({ ...options, signal: controller.signal })) {
        if (chunk.done) {
          callbacks.onDone?.(chunk.fullContent || '');
        } else {
          callbacks.onChunk(chunk.content);
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      callbacks.onError?.(err as AIError);
    }
  })();

  return controller;
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * 快速单次对话
 */
export async function aiQuickChat(
  prompt: string,
  options?: Partial<AIRequestOptions>
): Promise<string> {
  const result = await aiChat({
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    ...options,
  });
  return result.content;
}

/**
 * 系统指令 + 用户输入 模式
 */
export async function aiWithSystem(
  systemPrompt: string,
  userPrompt: string,
  options?: Partial<AIRequestOptions>
): Promise<string> {
  const result = await aiChat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: false,
    ...options,
  });
  return result.content;
}
