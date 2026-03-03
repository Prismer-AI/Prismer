/**
 * Ensure Agent Binding API
 *
 * POST /api/workspace/[id]/agent/ensure
 *
 * Ensures an AgentInstance exists for the workspace.
 * Creates AgentConfig + AgentInstance if missing. Idempotent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { workspaceService } from '@/lib/services/workspace.service';
import prisma from '@/lib/prisma';
import { getStaticAgentConfig } from '@/lib/container/staticAgentConfig';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: workspaceId } = await params;
    const staticAgent = getStaticAgentConfig();

    if (staticAgent.enabled) {
      const workspace = await prisma.workspaceSession.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });

      if (!workspace) {
        return NextResponse.json(
          { success: false, error: 'Workspace not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          id: staticAgent.agentId,
          workspaceId,
          ownerId: staticAgent.ownerId,
          status: staticAgent.agentStatus,
          gatewayUrl: staticAgent.gatewayWsUrl,
          container: {
            id: `static-container-${workspaceId}`,
            status: staticAgent.containerStatus,
            hostPort: staticAgent.hostPort,
            orchestrator: staticAgent.orchestrator,
            imageTag: staticAgent.imageTag,
            healthStatus: null,
          },
        },
      });
    }

    const workspace = await prisma.workspaceSession.findUnique({
      where: { id: workspaceId },
      include: {
        agentInstance: {
          include: {
            config: { select: { id: true, name: true, modelName: true } },
            container: { select: { id: true, status: true, hostPort: true, orchestrator: true, imageTag: true, healthStatus: true } },
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

    // Already has agent — return it
    if (workspace.agentInstance) {
      return NextResponse.json({
        success: true,
        data: workspace.agentInstance,
      });
    }

    // Create agent binding
    await workspaceService.ensureAgentBinding(workspaceId, workspace.ownerId);

    // Fetch the newly created agent
    const agent = await prisma.agentInstance.findFirst({
      where: { workspaceId },
      include: {
        config: { select: { id: true, name: true, modelName: true } },
        container: { select: { id: true, status: true, hostPort: true, orchestrator: true, imageTag: true, healthStatus: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: agent,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/workspace/[id]/agent/ensure error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
