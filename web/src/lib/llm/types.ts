/**
 * LLM Gateway Types
 *
 * @description
 * Phase 3E: LLM 网关类型定义
 * 支持多提供商、用量追踪和成本监控
 */

// ============================================================
// Provider Types
// ============================================================

/**
 * 支持的 LLM 提供商
 */
export type LLMProvider = 'anthropic' | 'openai' | 'prismer' | 'custom';

/**
 * 模型信息
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: LLMProvider;
  /** 输入价格 (USD per 1M tokens) */
  inputPricePerM: number;
  /** 输出价格 (USD per 1M tokens) */
  outputPricePerM: number;
  /** 上下文窗口大小 */
  contextWindow: number;
  /** 最大输出 tokens */
  maxOutputTokens: number;
  /** 是否支持推理模式 */
  reasoning?: boolean;
  /** 是否支持视觉 */
  vision?: boolean;
}

/**
 * 提供商配置
 */
export interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
}

// ============================================================
// Usage Types
// ============================================================

/**
 * LLM 使用量记录
 */
export interface LLMUsage {
  /** 请求 ID */
  requestId: string;
  /** Agent Instance ID */
  agentInstanceId?: string;
  /** 用户 ID */
  userId?: string;
  /** 提供商 */
  provider: LLMProvider;
  /** 模型 */
  model: string;
  /** 输入 tokens */
  inputTokens: number;
  /** 输出 tokens */
  outputTokens: number;
  /** 总 tokens */
  totalTokens: number;
  /** 费用 (USD) */
  costUsd: number;
  /** 延迟 (ms) */
  latencyMs: number;
  /** 来源组件 */
  component?: string;
  /** 成功/失败 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 使用量统计
 */
export interface UsageStats {
  /** 时间范围 */
  period: {
    start: Date;
    end: Date;
  };
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 总输入 tokens */
  totalInputTokens: number;
  /** 总输出 tokens */
  totalOutputTokens: number;
  /** 总 tokens */
  totalTokens: number;
  /** 总费用 (USD) */
  totalCostUsd: number;
  /** 平均延迟 (ms) */
  avgLatencyMs: number;
  /** 按模型统计 */
  byModel: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  /** 按组件统计 */
  byComponent: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
}

// ============================================================
// Request/Response Types
// ============================================================

/**
 * Chat 请求
 */
export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** 来源组件 (用于追踪) */
  component?: string;
  /** Agent Instance ID */
  agentInstanceId?: string;
  /** 用户 ID */
  userId?: string;
}

/**
 * Chat 消息
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat 响应
 */
export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

// ============================================================
// Cost Calculation
// ============================================================

/**
 * 模型定价表 (USD per 1M tokens)
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'o1': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },
  'o3-mini': { input: 1.1, output: 4.4 },
  // Default fallback
  'default': { input: 1.0, output: 3.0 },
};

/**
 * 计算 API 调用成本
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal precision
}
