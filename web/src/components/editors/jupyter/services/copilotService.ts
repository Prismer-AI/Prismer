/**
 * Jupyter Copilot Service
 *
 * Context-aware AI assistance for Jupyter notebook cells.
 * Uses the unified ai-client.ts for all LLM interactions.
 *
 * Copilot Modes:
 * - explain: Explain cell code or output
 * - fix: Analyze error and suggest fixes
 * - generate: Generate code from natural language
 * - optimize: Suggest optimizations for cell code
 * - complete: Auto-complete code in context
 */

import { aiChatStream, aiChat, type AIMessage } from '@/lib/services/ai-client';

// ============================================================
// Types
// ============================================================

export type CopilotAction = 'explain' | 'fix' | 'generate' | 'optimize' | 'complete' | 'chat';

export interface CopilotRequest {
  /** What action to perform */
  action: CopilotAction;
  /** The cell source code */
  cellSource?: string;
  /** Cell execution output (stdout, stderr, display_data) */
  cellOutput?: string;
  /** Error traceback if the cell errored */
  errorTraceback?: string;
  /** User's natural language query */
  query?: string;
  /** Context from surrounding cells (for better suggestions) */
  notebookContext?: string;
  /** Variable names and types from kernel */
  variables?: Array<{ name: string; type: string; shape?: string }>;
}

export interface CopilotResponse {
  /** The AI response text */
  content: string;
  /** Extracted code blocks (if any) */
  codeBlocks: string[];
  /** Whether the response suggests a fix */
  hasFix: boolean;
}

// ============================================================
// System Prompts
// ============================================================

const BASE_SYSTEM = `You are a Jupyter notebook AI copilot. You help users write, debug, and understand Python code in a data science context.

Rules:
- Be concise and practical
- When suggesting code, wrap it in \`\`\`python code blocks
- Reference variable names from the kernel context when available
- Use standard data science libraries (pandas, numpy, matplotlib, scikit-learn)`;

const ACTION_PROMPTS: Record<CopilotAction, string> = {
  explain: `${BASE_SYSTEM}

Task: Explain the given code or output clearly and concisely. Focus on what the code does, not line-by-line commentary. If there are outputs, explain what they mean.`,

  fix: `${BASE_SYSTEM}

Task: The cell produced an error. Analyze the traceback and suggest a fix. Provide the corrected code in a \`\`\`python code block. Explain what was wrong briefly.`,

  generate: `${BASE_SYSTEM}

Task: Generate Python code based on the user's description. Produce clean, well-structured code. Include brief inline comments only for non-obvious parts. Output the code in a \`\`\`python code block.`,

  optimize: `${BASE_SYSTEM}

Task: Review the code and suggest optimizations for performance, readability, or correctness. Provide the improved code in a \`\`\`python code block and explain the changes.`,

  complete: `${BASE_SYSTEM}

Task: Complete the code. Look at the context and produce the most likely continuation. Output only the code to add, in a \`\`\`python code block.`,

  chat: `${BASE_SYSTEM}

Task: Answer the user's question about the notebook, code, or data science in general. Use context from the notebook cells and variables when relevant.`,
};

// ============================================================
// Service Functions
// ============================================================

/**
 * Build the user message with all available context.
 */
function buildUserMessage(request: CopilotRequest): string {
  const parts: string[] = [];

  if (request.notebookContext) {
    parts.push(`**Notebook context (surrounding cells):**\n\`\`\`python\n${request.notebookContext}\n\`\`\``);
  }

  if (request.variables && request.variables.length > 0) {
    const varList = request.variables
      .map(v => `- ${v.name}: ${v.type}${v.shape ? ` (${v.shape})` : ''}`)
      .join('\n');
    parts.push(`**Available variables:**\n${varList}`);
  }

  if (request.cellSource) {
    parts.push(`**Cell code:**\n\`\`\`python\n${request.cellSource}\n\`\`\``);
  }

  if (request.cellOutput) {
    parts.push(`**Cell output:**\n\`\`\`\n${request.cellOutput}\n\`\`\``);
  }

  if (request.errorTraceback) {
    parts.push(`**Error:**\n\`\`\`\n${request.errorTraceback}\n\`\`\``);
  }

  if (request.query) {
    parts.push(`**User request:** ${request.query}`);
  }

  return parts.join('\n\n');
}

/**
 * Extract code blocks from AI response.
 */
function extractCodeBlocks(content: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:python)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

/**
 * Send a copilot request and get a streaming response.
 */
export async function* copilotStream(request: CopilotRequest) {
  const systemPrompt = ACTION_PROMPTS[request.action];
  const userMessage = buildUserMessage(request);

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  for await (const chunk of aiChatStream({
    messages,
    intent: request.action === 'generate' ? 'code' : 'analytical',
  })) {
    yield chunk;
  }
}

/**
 * Send a copilot request and get a complete response.
 */
export async function copilotChat(request: CopilotRequest): Promise<CopilotResponse> {
  const systemPrompt = ACTION_PROMPTS[request.action];
  const userMessage = buildUserMessage(request);

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const response = await aiChat({
    messages,
    intent: request.action === 'generate' ? 'code' : 'analytical',
  });

  const content = response.content;
  const codeBlocks = extractCodeBlocks(content);

  return {
    content,
    codeBlocks,
    hasFix: request.action === 'fix' && codeBlocks.length > 0,
  };
}

/**
 * Quick action: Explain code
 */
export async function explainCell(cellSource: string, cellOutput?: string): Promise<CopilotResponse> {
  return copilotChat({ action: 'explain', cellSource, cellOutput });
}

/**
 * Quick action: Fix error
 */
export async function fixCellError(cellSource: string, errorTraceback: string): Promise<CopilotResponse> {
  return copilotChat({ action: 'fix', cellSource, errorTraceback });
}

/**
 * Quick action: Generate code from description
 */
export async function generateCode(
  query: string,
  variables?: CopilotRequest['variables']
): Promise<CopilotResponse> {
  return copilotChat({ action: 'generate', query, variables });
}
