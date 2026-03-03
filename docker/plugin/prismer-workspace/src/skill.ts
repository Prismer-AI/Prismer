/**
 * Prismer Workspace Skill - Skill Definition
 *
 * @description
 * OpenClaw skill definition for Prismer.AI Academic Workspace.
 * Exposes tools for LaTeX, Jupyter, PDF, and UI control.
 */

import { VERSION } from '../version';
import type { PrismerWorkspaceConfig, ResolvedPrismerWorkspaceConfig } from './types';
import { setConfig, toolDefinitions, executeTool } from './tools';

// ============================================================
// OpenClaw Skill Types (simplified from openclaw package)
// ============================================================

interface SkillMeta {
  id: string;
  label: string;
  description: string;
  version: string;
}

interface SkillTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface SkillContext {
  config: unknown;
  conversationId: string;
  userId: string;
}

interface SkillExecuteResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface Skill {
  id: string;
  meta: SkillMeta;
  tools: SkillTool[];
  initialize: (config: unknown) => Promise<void>;
  execute: (toolName: string, params: unknown, ctx: SkillContext) => Promise<SkillExecuteResult>;
}

// ============================================================
// Skill Implementation
// ============================================================

/**
 * Prismer Workspace Skill
 *
 * @description
 * Provides tools for academic research operations:
 * - LaTeX compilation
 * - Jupyter notebook operations
 * - PDF document loading
 * - UI component control
 */
export const prismerWorkspaceSkill: Skill = {
  id: 'prismer-workspace',

  meta: {
    id: 'prismer-workspace',
    label: 'Prismer Workspace',
    description: 'Academic research workspace tools for LaTeX, Jupyter, PDF, and more',
    version: VERSION,
  },

  tools: toolDefinitions as SkillTool[],

  /**
   * Initialize the skill with configuration
   */
  initialize: async (rawConfig: unknown): Promise<void> => {
    const config = rawConfig as PrismerWorkspaceConfig;

    // Resolve configuration
    const resolvedConfig: ResolvedPrismerWorkspaceConfig = {
      ...config,
      containerProxyUrl: `${config.apiBaseUrl}/api/container/${config.agentId}`,
      hasLocalLatex: true, // Assume available in container
      hasJupyter: true, // Assume available in container
    };

    setConfig(resolvedConfig);

    console.log(`[prismer-workspace] Skill initialized for agent: ${config.agentId}`);
  },

  /**
   * Execute a tool
   */
  execute: async (
    toolName: string,
    params: unknown,
    _ctx: SkillContext
  ): Promise<SkillExecuteResult> => {
    console.log(`[prismer-workspace] Executing tool: ${toolName}`);

    try {
      const result = await executeTool(toolName, params);
      return result;
    } catch (error) {
      console.error(`[prismer-workspace] Tool execution error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Get available tool names
 */
export function getToolNames(): string[] {
  return toolDefinitions.map((t) => t.name);
}

/**
 * Get tool definition by name
 */
export function getToolDefinition(name: string): SkillTool | undefined {
  return toolDefinitions.find((t) => t.name === name) as SkillTool | undefined;
}
