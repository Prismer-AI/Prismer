/**
 * Workspace Context API
 *
 * GET /api/workspace/[id]/context
 *
 * Returns structured workspace state for agent context injection.
 * Aggregates data from: WorkspaceSession, ComponentState, WorkspaceFile,
 * WorkspaceTask, WorkspaceMessage, AgentInstance, WorkspaceTimelineEvent.
 *
 * Used by:
 * - Plugin `get_workspace_state` tool (agent queries workspace state on demand)
 * - Plugin `agent:bootstrap` hook (generates WORKSPACE.md for system prompt)
 * - Bridge API (structured context injection)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger('Workspace:Context');

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/workspace/[id]/context
 *
 * Query params:
 * - include: comma-separated list of sections to include
 *   (files, editors, tasks, messages, timeline) — default: all
 * - format: 'json' | 'markdown' — default: json
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: workspaceId } = await params;
    const url = new URL(request.url);
    const includeParam = url.searchParams.get('include');
    const format = url.searchParams.get('format') || 'json';

    const sections = includeParam
      ? includeParam.split(',').map(s => s.trim())
      : ['files', 'editors', 'tasks', 'messages', 'timeline'];

    // Fetch workspace with basic relations
    const workspace = await prisma.workspaceSession.findUnique({
      where: { id: workspaceId },
      include: {
        agentInstance: {
          select: {
            id: true,
            name: true,
            status: true,
            config: { select: { templateType: true, modelName: true } },
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Parse workspace settings
    const settings = workspace.settings
      ? JSON.parse(workspace.settings)
      : {};

    const contextData: Record<string, unknown> = {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        status: workspace.status,
        template: workspace.agentInstance?.config?.templateType || settings.templateType || 'default',
        createdAt: workspace.createdAt.toISOString(),
      },
      agent: workspace.agentInstance
        ? {
            id: workspace.agentInstance.id,
            name: workspace.agentInstance.name,
            status: workspace.agentInstance.status,
            model: workspace.agentInstance.config?.modelName,
          }
        : null,
    };

    // Fetch sections in parallel
    const queries: Promise<void>[] = [];

    // Files
    if (sections.includes('files')) {
      queries.push(
        prisma.workspaceFile.findMany({
          where: { workspaceId },
          select: { path: true, contentHash: true, updatedAt: true },
          orderBy: { path: 'asc' },
        }).then(files => {
          contextData.files = files.map(f => ({
            path: f.path,
            hash: f.contentHash,
            updatedAt: f.updatedAt.toISOString(),
          }));
        })
      );
    }

    // Component states (editors)
    if (sections.includes('editors')) {
      queries.push(
        prisma.workspaceComponentState.findMany({
          where: { workspaceId },
        }).then(states => {
          const editors: Record<string, unknown> = {};
          let activeComponent: string | null = null;

          for (const s of states) {
            try {
              const parsed = JSON.parse(s.state);
              editors[s.componentType] = parsed;

              // Detect active component from state
              if (parsed.isActive || parsed.active) {
                activeComponent = s.componentType;
              }
            } catch {
              editors[s.componentType] = {};
            }
          }

          contextData.editors = editors;
          contextData.activeComponent = activeComponent;
        })
      );
    }

    // Tasks
    if (sections.includes('tasks')) {
      queries.push(
        prisma.workspaceTask.findMany({
          where: { workspaceId },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            progress: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }).then(tasks => {
          contextData.tasks = tasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            progress: t.progress,
          }));
        })
      );
    }

    // Recent messages (last 5)
    if (sections.includes('messages')) {
      queries.push(
        prisma.workspaceMessage.findMany({
          where: { workspaceId },
          select: {
            senderType: true,
            senderName: true,
            content: true,
            contentType: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }).then(messages => {
          contextData.recentMessages = messages.reverse().map(m => ({
            role: m.senderType,
            name: m.senderName,
            // Truncate long messages to summary length
            summary: m.content.length > 200
              ? m.content.slice(0, 200) + '...'
              : m.content,
            contentType: m.contentType,
            at: m.createdAt.toISOString(),
          }));
        })
      );
    }

    // Recent timeline events (last 10)
    if (sections.includes('timeline')) {
      queries.push(
        prisma.workspaceTimelineEvent.findMany({
          where: { workspaceId },
          select: {
            componentType: true,
            action: true,
            description: true,
            actorType: true,
            timestamp: true,
          },
          orderBy: { timestamp: 'desc' },
          take: 10,
        }).then(events => {
          contextData.timeline = events.reverse().map(e => ({
            component: e.componentType,
            action: e.action,
            description: e.description,
            actor: e.actorType,
            timestamp: Number(e.timestamp),
          }));
        })
      );
    }

    await Promise.all(queries);

    // Return in requested format
    if (format === 'markdown') {
      const markdown = generateWorkspaceMd(contextData);
      return new Response(markdown, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    }

    return NextResponse.json({
      success: true,
      data: contextData,
    });
  } catch (error) {
    log.error('GET /api/workspace/[id]/context error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate WORKSPACE.md content from structured context data.
 * This is injected into the agent's system prompt via bootstrap.
 */
function generateWorkspaceMd(ctx: Record<string, unknown>): string {
  const lines: string[] = [];
  const ws = ctx.workspace as { name?: string; description?: string; template?: string } | undefined;

  lines.push('# Workspace State');
  lines.push('');

  // Workspace info
  if (ws) {
    lines.push(`**Workspace:** ${ws.name || 'Untitled'}`);
    if (ws.description) lines.push(`**Description:** ${ws.description}`);
    if (ws.template) lines.push(`**Template:** ${ws.template}`);
    lines.push('');
  }

  // Active component
  if (ctx.activeComponent) {
    lines.push(`## Active Component`);
    lines.push(`${ctx.activeComponent}`);
    lines.push('');
  }

  // Files
  const files = ctx.files as Array<{ path: string; hash: string }> | undefined;
  if (files && files.length > 0) {
    lines.push('## Project Files');
    lines.push('');
    lines.push('| Path | Hash |');
    lines.push('|------|------|');
    for (const f of files) {
      lines.push(`| ${f.path} | ${f.hash.slice(0, 8)} |`);
    }
    lines.push('');
  }

  // Editor states
  const editors = ctx.editors as Record<string, Record<string, unknown>> | undefined;
  if (editors && Object.keys(editors).length > 0) {
    lines.push('## Editor States');
    lines.push('');
    for (const [component, state] of Object.entries(editors)) {
      lines.push(`### ${component}`);
      // Extract key info from each editor state
      if (state.activeFile) lines.push(`- Active file: ${state.activeFile}`);
      if (state.fileCount) lines.push(`- File count: ${state.fileCount}`);
      if (state.mainFile) lines.push(`- Main file: ${state.mainFile}`);
      if (state.documentTitle) lines.push(`- Document: ${state.documentTitle}`);
      if (state.currentPage) lines.push(`- Current page: ${state.currentPage}`);
      if (state.cellCount) lines.push(`- Cell count: ${state.cellCount}`);
      lines.push('');
    }
  }

  // Tasks
  const tasks = ctx.tasks as Array<{ title: string; status: string; description?: string }> | undefined;
  if (tasks && tasks.length > 0) {
    lines.push('## Tasks');
    lines.push('');
    for (const t of tasks) {
      const checkbox = t.status === 'completed' ? '[x]' : t.status === 'running' ? '[-]' : '[ ]';
      const suffix = t.status === 'running' ? ' (in progress)' : '';
      lines.push(`- ${checkbox} ${t.title}${suffix}`);
    }
    lines.push('');
  }

  // Recent messages
  const messages = ctx.recentMessages as Array<{ role: string; summary: string }> | undefined;
  if (messages && messages.length > 0) {
    lines.push('## Recent Conversation');
    lines.push('');
    for (const m of messages) {
      const role = m.role === 'user' ? 'User' : 'Agent';
      lines.push(`- **${role}:** ${m.summary}`);
    }
    lines.push('');
  }

  // Timeline
  const timeline = ctx.timeline as Array<{ component: string; action: string; description: string }> | undefined;
  if (timeline && timeline.length > 0) {
    lines.push('## Recent Activity');
    lines.push('');
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i];
      lines.push(`${i + 1}. [${e.component}] ${e.action}: ${e.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
