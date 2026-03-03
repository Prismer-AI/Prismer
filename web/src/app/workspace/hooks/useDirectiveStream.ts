'use client';

/**
 * useDirectiveStream
 *
 * Subscribes to the directive SSE stream from the container plugin.
 * When the agent is running, connects via EventSource to receive
 * real-time UI directives (component switching, content updates, etc.)
 * and executes them via the existing directive executor.
 *
 * Maps plugin directive types (UPPERCASE) to frontend types (lowercase).
 */

import { useEffect, useRef } from 'react';
import { useAgentInstanceStore } from '../stores/agentInstanceStore';
import { useChatStore } from '../stores/chatStore';
import { useComponentStore } from '../stores/componentStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useTaskStore } from '../stores/taskStore';
import { useTimelineStore } from '../stores/timelineStore';
import { executeDirective } from '../stores/syncActions';
import { createLogger } from '@/lib/logger';
import type { UIDirective } from '@/types/message';
import type { ComponentType } from '@/types';

// Map directive types to human-readable thinking status messages
const COMPONENT_THINKING_STATUS: Record<string, string> = {
  'latex-editor': 'Working with LaTeX...',
  'jupyter-notebook': 'Running Jupyter...',
  'pdf-reader': 'Loading PDF...',
  'code-playground': 'Writing code...',
  'ag-grid': 'Loading data...',
  'bento-gallery': 'Preparing gallery...',
  'ai-editor': 'Writing notes...',
};

const DIRECTIVE_THINKING_STATUS: Record<string, string | null> = {
  'UPDATE_LATEX': 'Updating LaTeX...',
  'UPDATE_NOTEBOOK': 'Updating notebook...',
  'UPDATE_NOTES': 'Writing notes...',
  'UPDATE_GALLERY': 'Updating gallery...',
  'UPDATE_CODE': 'Updating code...',
  'UPDATE_DATA_GRID': 'Loading data...',
  'COMPILE_LATEX': 'Compiling LaTeX...',
  'UPDATE_LATEX_PROJECT': 'Updating LaTeX project...',
  'UPDATE_TASKS': null, // Tasks update silently
  // Completion directives clear the status
  'LATEX_COMPILE_COMPLETE': null,
  'LATEX_PROJECT_COMPILE_COMPLETE': null,
  'JUPYTER_CELL_RESULT': null,
};

const log = createLogger('DirectiveStream');

/**
 * Map plugin directive to frontend UIDirective format.
 * Plugin uses UPPERCASE types (SWITCH_COMPONENT, LATEX_COMPILE_COMPLETE).
 * Frontend executeDirective() expects lowercase types (switch_component, update_content).
 */
export function mapPluginDirective(raw: { type: string; payload: Record<string, unknown> }): UIDirective {
  switch (raw.type) {
    case 'SWITCH_COMPONENT':
      return {
        type: 'switch_component',
        target: raw.payload.component as ComponentType,
        data: raw.payload.data as Record<string, unknown> | undefined,
      };

    case 'LATEX_COMPILE_COMPLETE':
      return {
        type: 'latex_compile_complete',
        target: 'latex-editor',
        data: {
          compiledPdfUrl: raw.payload.pdfUrl as string,
          pdfDataUrl: raw.payload.pdfDataUrl as string | undefined,
          compileStatus: 'success',
          filename: raw.payload.filename as string | undefined,
        },
      };

    case 'JUPYTER_CELL_RESULT':
      return {
        type: 'jupyter_cell_result',
        target: 'jupyter-notebook',
        data: {
          code: raw.payload.code,
          outputs: raw.payload.outputs,
          success: raw.payload.success,
        },
      };

    case 'PDF_LOAD_DOCUMENT':
      return {
        type: 'load_document',
        target: 'pdf-reader',
        data: {
          documentId: raw.payload.source as string,
          page: raw.payload.page as number | undefined,
        },
      };

    case 'PDF_NAVIGATE':
      return {
        type: 'navigate_to_page',
        target: 'pdf-reader',
        data: {
          page: raw.payload.page as number,
          detectionId: raw.payload.detectionId as string | undefined,
          highlightRegion: raw.payload.highlightRegion as Record<string, unknown> | undefined,
        },
      };

    case 'JUPYTER_ADD_CELL':
      return {
        type: 'jupyter_cell_result',
        target: 'jupyter-notebook',
        data: {
          code: raw.payload.source as string,
          outputs: raw.payload.outputs,
        },
      };

    // Content directives from container plugin tools
    case 'UPDATE_LATEX':
      return {
        type: 'update_content',
        target: 'latex-editor',
        data: {
          file: raw.payload.file as string,
          content: raw.payload.content as string,
        },
      };

    case 'UPDATE_NOTEBOOK':
      return {
        type: 'update_content',
        target: 'jupyter-notebook',
        data: {
          cells: raw.payload.cells,
          execute: raw.payload.execute,
        },
      };

    case 'UPDATE_NOTES':
      return {
        type: 'update_content',
        target: 'ai-editor',
        data: {
          content: raw.payload.content as string,
        },
      };

    case 'COMPILE_LATEX':
      return {
        type: 'latex_compile_complete',
        target: 'latex-editor',
        data: {},
      };

    // LaTeX project directives (multi-file)
    case 'UPDATE_LATEX_PROJECT':
      return {
        type: 'update_latex_project',
        target: 'latex-editor',
        data: {
          operation: raw.payload.operation as string,
          file: raw.payload.file as string,
          content: raw.payload.content as string | undefined,
          projectFiles: raw.payload.projectFiles,
        },
      };

    case 'DELETE_LATEX_PROJECT_FILE':
      return {
        type: 'delete_latex_project_file',
        target: 'latex-editor',
        data: {
          file: raw.payload.file as string,
          projectFiles: raw.payload.projectFiles,
        },
      };

    case 'LATEX_PROJECT_COMPILE_COMPLETE':
      return {
        type: 'latex_project_compile_complete',
        target: 'latex-editor',
        data: {
          success: raw.payload.success as boolean,
          pdfBase64: raw.payload.pdfBase64 as string | undefined,
          pdfPath: raw.payload.pdfPath as string | undefined,
          log: raw.payload.log as string | undefined,
          warnings: raw.payload.warnings,
        },
      };

    case 'UPDATE_GALLERY':
      return {
        type: 'update_gallery',
        target: 'bento-gallery',
        data: { images: raw.payload.images },
      };

    case 'UPDATE_CODE':
      return {
        type: 'update_content',
        target: 'code-playground',
        data: {
          files: raw.payload.files,
          selectedFile: raw.payload.selectedFile,
        },
      };

    case 'TERMINAL_OUTPUT':
      return {
        type: 'terminal_output',
        target: 'code-playground',
        data: { output: raw.payload.output },
      };

    case 'UPDATE_DATA_GRID':
      return {
        type: 'update_data_grid',
        target: 'ag-grid',
        data: {
          data: raw.payload.data,
          columns: raw.payload.columns,
          title: raw.payload.title,
          meta: raw.payload.meta,
        },
      };

    // ========== Agent Observability Directives (Phase A/B) ==========

    case 'UPDATE_TASKS':
      return {
        type: 'update_tasks',
        data: {
          tasks: raw.payload.tasks,
        },
      };

    case 'REQUEST_CONFIRMATION':
      return {
        type: 'request_confirmation',
        data: {
          message: raw.payload.message,
          confirmLabel: raw.payload.confirmLabel,
          cancelLabel: raw.payload.cancelLabel,
          confirmationId: raw.payload.confirmationId,
        },
      };

    case 'OPERATION_STATUS':
      return {
        type: 'operation_status',
        target: raw.payload.component as string | undefined,
        data: {
          operation: raw.payload.operation,
          status: raw.payload.status,
          progress: raw.payload.progress,
          message: raw.payload.message,
          component: raw.payload.component,
        },
      };

    case 'AGENT_THINKING':
      return {
        type: 'agent_thinking',
        data: {
          content: raw.payload.content,
          status: raw.payload.status,
        },
      };

    case 'AGENT_TOOL_START':
      return {
        type: 'agent_tool_start',
        data: {
          toolName: raw.payload.toolName,
          toolCallId: raw.payload.toolCallId,
          args: raw.payload.args,
        },
      };

    case 'AGENT_TOOL_RESULT':
      return {
        type: 'agent_tool_result',
        data: {
          toolName: raw.payload.toolName,
          toolCallId: raw.payload.toolCallId,
          success: raw.payload.success,
          result: raw.payload.result,
        },
      };

    default: {
      // Generic fallback: convert UPPER_CASE to lower_case
      const mappedType = raw.type.toLowerCase() as UIDirective['type'];
      return {
        type: mappedType,
        data: raw.payload,
      };
    }
  }
}

/**
 * Subscribe to directive SSE stream when agent is running.
 * Auto-reconnects on error (EventSource handles this natively).
 */
export function useDirectiveStream(): void {
  const agentInstanceId = useAgentInstanceStore((s) => s.agentInstanceId);
  const agentStatus = useAgentInstanceStore((s) => s.agentInstanceStatus);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Expose test utilities for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__executeDirective = executeDirective;
      (window as unknown as Record<string, unknown>).__mapPluginDirective = mapPluginDirective;
      (window as unknown as Record<string, unknown>).__agentInstanceStore = useAgentInstanceStore;
      // Expose stores for E2E tests synchronously to avoid race with tests that
      // immediately evaluate window hooks after workspace mount.
      (window as unknown as Record<string, unknown>).__componentStore = useComponentStore;
      (window as unknown as Record<string, unknown>).__chatStore = useChatStore;
      (window as unknown as Record<string, unknown>).__layoutStore = useLayoutStore;
      (window as unknown as Record<string, unknown>).__taskStore = useTaskStore;
      (window as unknown as Record<string, unknown>).__timelineStore = useTimelineStore;
    }
  }, []);

  useEffect(() => {
    // Only connect when agent is running
    if (!agentInstanceId || agentStatus !== 'running') {
      if (eventSourceRef.current) {
        log.info('Closing directive stream (agent not running)', { agentInstanceId, agentStatus });
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    log.info('Connecting directive stream', { agentInstanceId });
    const es = new EventSource(`/api/agents/${agentInstanceId}/directive/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      log.info('Directive SSE stream opened', { agentInstanceId });
    };

    es.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data) as { type: string; payload: Record<string, unknown> };
        log.info('Directive received via SSE', {
          type: raw.type,
          agentInstanceId,
        });

        // Update thinking status based on directive type
        if (raw.type === 'AGENT_THINKING') {
          const store = useChatStore.getState();
          store.setThinkingStatus(
            (raw.payload.content as string) || (raw.payload.status as string) || 'Thinking...'
          );
          store.setThinkingContent(raw.payload.content as string || null);
        } else if (raw.type === 'AGENT_TOOL_START') {
          const store = useChatStore.getState();
          store.setThinkingStatus(
            `Using tool: ${raw.payload.toolName as string || 'unknown'}...`
          );
          store.startToolCall(
            raw.payload.toolCallId as string || `tc-${Date.now()}`,
            raw.payload.toolName as string || 'unknown'
          );
        } else if (raw.type === 'AGENT_TOOL_RESULT') {
          useChatStore.getState().endToolCall(
            raw.payload.toolCallId as string || '',
            raw.payload.success as boolean ?? true
          );
        } else if (raw.type in DIRECTIVE_THINKING_STATUS) {
          useChatStore.getState().setThinkingStatus(DIRECTIVE_THINKING_STATUS[raw.type]);
        } else if (raw.type === 'SWITCH_COMPONENT') {
          const target = raw.payload.component as string;
          const status = COMPONENT_THINKING_STATUS[target];
          if (status) {
            useChatStore.getState().setThinkingStatus(status);
          }
        }

        // Synthesize task progress from tool-related directives so the
        // Task Progress panel shows meaningful status during agent execution.
        // SWITCH_COMPONENT is excluded — it's a UI operation, not an agent task.
        const DIRECTIVE_TO_TASK: Record<string, string> = {
          'UPDATE_LATEX': 'Writing LaTeX',
          'UPDATE_LATEX_PROJECT': 'Writing LaTeX document',
          'COMPILE_LATEX': 'Compiling PDF',
          'LATEX_COMPILE_COMPLETE': 'PDF compiled',
          'LATEX_PROJECT_COMPILE_COMPLETE': 'PDF compiled',
          'UPDATE_NOTEBOOK': 'Writing notebook',
          'UPDATE_NOTES': 'Writing notes',
          'UPDATE_CODE': 'Writing code',
          'UPDATE_GALLERY': 'Preparing gallery',
          'UPDATE_DATA_GRID': 'Loading data',
        };
        // One-shot directives complete immediately (no follow-up COMPLETE event)
        const ONE_SHOT_DIRECTIVES = new Set([
          'UPDATE_NOTES', 'UPDATE_CODE', 'UPDATE_GALLERY', 'UPDATE_DATA_GRID', 'UPDATE_NOTEBOOK',
        ]);
        const taskTitle = DIRECTIVE_TO_TASK[raw.type];
        if (taskTitle) {
          const ts = useTaskStore.getState();
          const isComplete = raw.type.includes('COMPLETE');
          const isOneShot = ONE_SHOT_DIRECTIVES.has(raw.type);

          // Only keep synthetic tasks (skip agent-provided tasks)
          const synthTasks = ts.tasks.filter((t) => t.id.startsWith('synth-'));

          // Mark previous running synthetic tasks as done
          const updated = synthTasks.map((t) =>
            t.status === 'running' ? { ...t, status: 'completed' as const, progress: 100 } : t
          );

          if (!isComplete) {
            // Deduplicate: don't add if a task with the same title already exists
            const alreadyExists = updated.some((t) => t.title === taskTitle);
            if (!alreadyExists) {
              updated.push({
                id: `synth-${Date.now()}`,
                title: taskTitle,
                // One-shot operations are immediately complete
                status: isOneShot ? 'completed' as const : 'running' as const,
                progress: isOneShot ? 100 : 50,
              });
            }
          }

          ts.setTasks(updated);
        }

        const directive = mapPluginDirective(raw);
        log.info('Executing mapped directive', {
          originalType: raw.type,
          mappedType: directive.type,
          target: directive.target,
        });
        executeDirective(directive);
      } catch (err) {
        log.error('Failed to process SSE directive', {
          error: err instanceof Error ? err.message : String(err),
          data: event.data?.substring(0, 100),
        });
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; just log
      log.warn('Directive stream error (will auto-reconnect)', { agentInstanceId });
    };

    return () => {
      log.info('Closing directive stream', { agentInstanceId });
      es.close();
      eventSourceRef.current = null;
    };
  }, [agentInstanceId, agentStatus]);
}
