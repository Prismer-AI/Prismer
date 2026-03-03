/**
 * Prismer Workspace Plugin - Entry Point
 *
 * @description
 * OpenClaw plugin for Prismer.AI Workspace tools.
 * Registers individual tools via api.registerTool() following the OpenClaw Plugin SDK.
 *
 * Tools registered (24 exposed + 2 internal):
 *
 * Exposed to Agent (24):
 * - jupyter_execute: Execute Python code in Jupyter kernel
 * - jupyter_notebook: CRUD for notebook files
 * - load_pdf: Load PDF in viewer
 * - switch_component: Switch workspace component
 * - send_ui_directive: Send raw UI directive
 * - arxiv_to_prompt: Convert arXiv paper to LLM text
 * - update_notes: Update Notes editor content
 * - update_notebook: Update Jupyter notebook cells
 * - update_gallery: Add images to gallery component
 * - code_execute: Execute code in sandbox
 * - update_code: Update Code Playground files
 * - update_data_grid: Update AG Grid data
 * - data_list: List available datasets
 * - data_load: Load dataset into grid
 * - data_query: Query/filter dataset
 * - data_save: Save dataset to file
 * - latex_project: Multi-file LaTeX project CRUD
 * - latex_project_compile: Compile multi-file LaTeX project
 * - get_paper_context: Get structured paper content (metadata, markdown, detections)
 * - navigate_pdf: Navigate PDF reader to page/detection
 * - context_search: Semantic web search via Cloud SDK
 * - context_load: Load URL content via Cloud SDK
 * - get_workspace_state: Get workspace state (files, editors, tasks, activity)
 * - update_tasks: Update task panel with progress (v0.7.0)
 * - request_user_confirmation: Request user confirmation before action (v0.7.0)
 *
 * Internal (2, not exposed to Agent — auto-triggered by directive middleware):
 * - save_artifact: Auto-called by compile tools
 * - sync_files_to_workspace: Auto-triggered by FILE_SYNC_TRIGGERS
 *
 * Removed in v0.7.0:
 * - latex_compile: Replaced by latex_project_compile
 * - update_latex: Replaced by latex_project("write")
 */

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import {
  setConfig,
  toolDefinitions,
  executeTool,
  generateWorkspaceMd,
} from './src/tools.js';
import type { ResolvedPrismerWorkspaceConfig } from './src/types.js';

// ============================================================
// Config Resolution
// ============================================================

function resolveConfig(api: OpenClawPluginApi): ResolvedPrismerWorkspaceConfig {
  const pluginConfig = (api.pluginConfig ?? {}) as Record<string, unknown>;
  const apiBaseUrl = (pluginConfig.apiBaseUrl as string) || 'http://host.docker.internal:3000';
  const agentId = (pluginConfig.agentId as string) || api.id || 'default';

  // Resolve env var references like ${PRISMER_API_BASE_URL:-fallback}
  const resolvedBaseUrl = apiBaseUrl.replace(/\$\{(\w+)(?::-(.*?))?\}/g, (_m, name, fallback) => {
    return process.env[name] || fallback || '';
  });
  const resolvedAgentId = agentId.replace(/\$\{(\w+)(?::-(.*?))?\}/g, (_m, name, fallback) => {
    return process.env[name] || fallback || '';
  });

  // Resolve Prismer API key: env > plugin config (openclaw.json)
  const prismerApiKey = process.env.PRISMER_API_KEY
    || (pluginConfig.prismerApiKey as string)
    || undefined;

  // Resolve workspaceId: env (from Docker) > plugin config
  const workspaceId = process.env.WORKSPACE_ID
    || (pluginConfig.workspaceId as string)
    || '';

  const resolved: ResolvedPrismerWorkspaceConfig = {
    apiBaseUrl: resolvedBaseUrl,
    agentId: resolvedAgentId,
    workspaceId,
    containerProxyUrl: `${resolvedBaseUrl}/api/container/${resolvedAgentId}`,
    hasLocalLatex: true,
    hasJupyter: true,
    prismerApiKey,
  };

  setConfig(resolved);
  return resolved;
}

// ============================================================
// Plugin Definition
// ============================================================

const plugin = {
  id: 'prismer-workspace',
  name: 'Prismer Workspace',
  description: 'Academic workspace tools for LaTeX, Jupyter, PDF, and UI control',
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi): void {
    // Initialize config from plugin settings
    const resolved = resolveConfig(api);
    const { workspaceId, apiBaseUrl: resolvedBaseUrl } = resolved;

    // Register each tool individually via registerTool
    for (const toolDef of toolDefinitions) {
      api.registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters as Record<string, unknown>,
        async execute(_id: string, params: Record<string, unknown>) {
          const result = await executeTool(toolDef.name, params);
          const text = result.success
            ? JSON.stringify(result.data ?? { ok: true })
            : JSON.stringify({ error: result.error });
          return { content: [{ type: 'text' as const, text }] };
        },
      });
    }

    // Register agent:bootstrap hook to inject WORKSPACE.md into system prompt
    if (workspaceId) {
      api.registerHook?.('agent:bootstrap', async (event: Record<string, unknown>) => {
        try {
          const stateUrl = `${resolvedBaseUrl}/api/workspace/${workspaceId}/context`;
          const response = await fetch(stateUrl, {
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const workspaceMd = generateWorkspaceMd(result.data);
              const bootstrapFiles = (event.context as Record<string, unknown>)?.bootstrapFiles;
              if (Array.isArray(bootstrapFiles)) {
                bootstrapFiles.push({
                  basename: 'WORKSPACE.md',
                  content: workspaceMd,
                });
              }
            }
          }
        } catch (err) {
          api.logger?.warn(`[prismer-workspace] Bootstrap context fetch failed: ${err}`);
        }
      });
      api.logger?.info(`[prismer-workspace] Bootstrap hook registered (workspaceId: ${workspaceId})`);
    }

    api.logger?.info(`[prismer-workspace] Registered ${toolDefinitions.length} tools`);
    api.logger?.info(`[prismer-workspace] Tools: ${toolDefinitions.map(t => t.name).join(', ')}`);
  },
};

export default plugin;
