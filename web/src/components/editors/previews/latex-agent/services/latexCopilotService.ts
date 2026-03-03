/**
 * LaTeX Copilot Service
 *
 * Context-aware AI assistance for LaTeX academic writing.
 * Uses the unified ai-client.ts for all LLM interactions.
 *
 * Copilot Actions:
 * - explain: Explain LaTeX code or compilation output
 * - fix: Analyze compilation errors and suggest fixes
 * - generate: Generate LaTeX code from natural language
 * - improve: Improve writing style, grammar, academic tone
 * - cite: Help with citations and bibliography
 * - structure: Help with document structure and organization
 * - chat: General LaTeX/academic writing questions
 */

import { aiChatStream, aiChat, type AIMessage } from '@/lib/services/ai-client';

// ============================================================
// Types
// ============================================================

export type LatexCopilotAction =
  | 'explain'
  | 'fix'
  | 'generate'
  | 'improve'
  | 'cite'
  | 'structure'
  | 'chat';

export interface LatexCopilotRequest {
  /** What action to perform */
  action: LatexCopilotAction;
  /** The current LaTeX source code (selected text or full file) */
  latexSource?: string;
  /** Active file name (e.g., main.tex, references.bib) */
  activeFile?: string;
  /** Compilation error/warning output */
  compilationOutput?: string;
  /** User's natural language query */
  query?: string;
  /** List of files in the project for context */
  projectFiles?: Array<{ name: string; type: string }>;
  /** Document class and packages in use */
  documentInfo?: {
    documentClass?: string;
    packages?: string[];
    bibliographyStyle?: string;
  };
}

export interface LatexCopilotResponse {
  /** The AI response text */
  content: string;
  /** Extracted LaTeX code blocks */
  latexBlocks: string[];
  /** Extracted BibTeX entries */
  bibEntries: string[];
  /** Whether the response contains a fix */
  hasFix: boolean;
  /** Suggested file to apply changes to */
  targetFile?: string;
}

// ============================================================
// System Prompts
// ============================================================

const BASE_SYSTEM = `You are a LaTeX academic writing copilot. You help researchers write, debug, and improve academic papers in LaTeX.

Rules:
- Be concise and practical
- When suggesting LaTeX code, wrap it in \`\`\`latex code blocks
- When suggesting BibTeX entries, wrap them in \`\`\`bibtex code blocks
- Use standard academic LaTeX packages (amsmath, graphicx, hyperref, natbib/biblatex, booktabs)
- Follow academic writing conventions and style guides
- Preserve the user's document class and package choices`;

const ACTION_PROMPTS: Record<LatexCopilotAction, string> = {
  explain: `${BASE_SYSTEM}

Task: Explain the given LaTeX code clearly. Focus on what the code produces, what packages/commands are used, and any notable formatting decisions. If there are compilation outputs, explain what they mean.`,

  fix: `${BASE_SYSTEM}

Task: The LaTeX compilation produced errors or warnings. Analyze the output and suggest fixes. Provide the corrected code in a \`\`\`latex code block. Explain what was wrong briefly. Common issues include:
- Missing packages
- Unmatched braces or environments
- Invalid command usage
- Bibliography/citation errors
- Math mode issues`,

  generate: `${BASE_SYSTEM}

Task: Generate LaTeX code based on the user's description. Produce clean, well-structured code. Include only necessary packages. Output the code in a \`\`\`latex code block. For equations, use appropriate math environments (equation, align, gather). For tables, use booktabs style. For figures, use standard graphicx patterns.`,

  improve: `${BASE_SYSTEM}

Task: Review the LaTeX content and suggest improvements for:
- Academic writing style and tone
- Grammar and clarity
- LaTeX best practices (proper environments, commands)
- Formatting consistency
Provide the improved version in a \`\`\`latex code block and explain the changes briefly.`,

  cite: `${BASE_SYSTEM}

Task: Help with citations and bibliography management. You can:
- Generate BibTeX entries from paper information
- Suggest citation commands (\\cite, \\citep, \\citet, \\citealp)
- Fix bibliography formatting issues
- Recommend citation style packages
Provide BibTeX entries in \`\`\`bibtex code blocks and LaTeX code in \`\`\`latex code blocks.`,

  structure: `${BASE_SYSTEM}

Task: Help organize and structure the LaTeX document. Suggest:
- Section/subsection organization
- Document class and package recommendations
- Preamble setup for the document type
- Template structures for common academic paper types (IEEE, ACM, Springer, etc.)
Provide structural code in a \`\`\`latex code block.`,

  chat: `${BASE_SYSTEM}

Task: Answer the user's question about LaTeX, academic writing, or document preparation. Use context from the current document when relevant. Provide code examples when helpful.`,
};

// ============================================================
// Service Functions
// ============================================================

/**
 * Build the user message with all available context.
 */
function buildUserMessage(request: LatexCopilotRequest): string {
  const parts: string[] = [];

  if (request.documentInfo) {
    const info = request.documentInfo;
    const infoLines: string[] = [];
    if (info.documentClass) infoLines.push(`Document class: ${info.documentClass}`);
    if (info.packages && info.packages.length > 0) {
      infoLines.push(`Packages: ${info.packages.join(', ')}`);
    }
    if (info.bibliographyStyle) infoLines.push(`Bibliography style: ${info.bibliographyStyle}`);
    if (infoLines.length > 0) {
      parts.push(`**Document info:**\n${infoLines.join('\n')}`);
    }
  }

  if (request.projectFiles && request.projectFiles.length > 0) {
    const fileList = request.projectFiles
      .map(f => `- ${f.name} (${f.type})`)
      .join('\n');
    parts.push(`**Project files:**\n${fileList}`);
  }

  if (request.latexSource) {
    const fileLabel = request.activeFile ? ` (${request.activeFile})` : '';
    parts.push(`**LaTeX source${fileLabel}:**\n\`\`\`latex\n${request.latexSource}\n\`\`\``);
  }

  if (request.compilationOutput) {
    parts.push(`**Compilation output:**\n\`\`\`\n${request.compilationOutput}\n\`\`\``);
  }

  if (request.query) {
    parts.push(`**User request:** ${request.query}`);
  }

  return parts.join('\n\n');
}

/**
 * Extract LaTeX code blocks from AI response.
 */
function extractLatexBlocks(content: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:latex|tex)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

/**
 * Extract BibTeX entries from AI response.
 */
function extractBibEntries(content: string): string[] {
  const entries: string[] = [];
  const regex = /```(?:bibtex|bib)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    entries.push(match[1].trim());
  }
  return entries;
}

/**
 * Detect target file from response context.
 */
function detectTargetFile(request: LatexCopilotRequest, bibEntries: string[]): string | undefined {
  if (bibEntries.length > 0) return 'references.bib';
  if (request.activeFile) return request.activeFile;
  return undefined;
}

/**
 * Send a copilot request and get a streaming response.
 */
export async function* latexCopilotStream(request: LatexCopilotRequest) {
  const systemPrompt = ACTION_PROMPTS[request.action];
  const userMessage = buildUserMessage(request);

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const intent = request.action === 'generate' || request.action === 'structure'
    ? 'code' as const
    : request.action === 'improve'
    ? 'creative' as const
    : 'analytical' as const;

  for await (const chunk of aiChatStream({ messages, intent })) {
    yield chunk;
  }
}

/**
 * Send a copilot request and get a complete response.
 */
export async function latexCopilotChat(request: LatexCopilotRequest): Promise<LatexCopilotResponse> {
  const systemPrompt = ACTION_PROMPTS[request.action];
  const userMessage = buildUserMessage(request);

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const intent = request.action === 'generate' || request.action === 'structure'
    ? 'code' as const
    : request.action === 'improve'
    ? 'creative' as const
    : 'analytical' as const;

  const response = await aiChat({ messages, intent });

  const content = response.content;
  const latexBlocks = extractLatexBlocks(content);
  const bibEntries = extractBibEntries(content);
  const targetFile = detectTargetFile(request, bibEntries);

  return {
    content,
    latexBlocks,
    bibEntries,
    hasFix: request.action === 'fix' && latexBlocks.length > 0,
    targetFile,
  };
}

// ============================================================
// Quick Actions
// ============================================================

/**
 * Quick action: Explain LaTeX code
 */
export async function explainLatex(latexSource: string): Promise<LatexCopilotResponse> {
  return latexCopilotChat({ action: 'explain', latexSource });
}

/**
 * Quick action: Fix compilation error
 */
export async function fixLatexError(
  latexSource: string,
  compilationOutput: string
): Promise<LatexCopilotResponse> {
  return latexCopilotChat({ action: 'fix', latexSource, compilationOutput });
}

/**
 * Quick action: Generate LaTeX from description
 */
export async function generateLatex(
  query: string,
  documentInfo?: LatexCopilotRequest['documentInfo']
): Promise<LatexCopilotResponse> {
  return latexCopilotChat({ action: 'generate', query, documentInfo });
}

/**
 * Quick action: Improve writing
 */
export async function improveLatex(latexSource: string): Promise<LatexCopilotResponse> {
  return latexCopilotChat({ action: 'improve', latexSource });
}

/**
 * Quick action: Generate citation
 */
export async function generateCitation(query: string): Promise<LatexCopilotResponse> {
  return latexCopilotChat({ action: 'cite', query });
}
