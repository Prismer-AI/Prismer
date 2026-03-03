/**
 * Type declarations for OpenClaw plugin SDK
 *
 * Minimal type definitions for TypeScript compilation.
 * Actual types come from the OpenClaw runtime at execution time.
 */

declare module 'openclaw/plugin-sdk' {
  export interface OpenClawPluginApi {
    /** Plugin ID */
    id: string;
    /** Plugin name */
    name: string;
    /** Plugin version */
    version?: string;
    /** Plugin description */
    description?: string;
    /** Plugin source origin */
    source: string;
    /** OpenClaw configuration */
    config: Record<string, unknown>;
    /** Plugin-specific configuration from plugins.entries.<id>.config */
    pluginConfig?: Record<string, unknown>;
    /** Logger instance */
    logger?: {
      info: (...args: unknown[]) => void;
      debug: (...args: unknown[]) => void;
      warn: (...args: unknown[]) => void;
      error: (...args: unknown[]) => void;
    };
    /** Runtime environment */
    runtime: Record<string, unknown>;
    /** Register an agent tool */
    registerTool: (tool: AgentToolDefinition, opts?: ToolRegistrationOptions) => void;
    /** Register a channel plugin */
    registerChannel: (opts: { plugin: unknown }) => void;
    /** Register an HTTP route handler */
    registerHttpRoute: (params: { path: string; handler: unknown }) => void;
    /** Register a background service */
    registerService: (service: unknown) => void;
    /** Register a lifecycle hook */
    on: (hookName: string, handler: (...args: unknown[]) => void, opts?: { priority?: number }) => void;
    /** Resolve a user path */
    resolvePath: (input: string) => string;
  }

  export interface AgentToolDefinition {
    name: string;
    description: string;
    parameters: unknown;
    execute: (id: string, params: Record<string, unknown>) => Promise<AgentToolResult>;
  }

  export interface AgentToolResult {
    content: Array<{ type: 'text'; text: string }>;
  }

  export interface ToolRegistrationOptions {
    name?: string;
    names?: string[];
    optional?: boolean;
  }

  export function emptyPluginConfigSchema(): object;
}
