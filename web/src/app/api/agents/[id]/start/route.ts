/**
 * Agent Start API (Open-Source Stub)
 *
 * POST /api/agents/:id/start
 *
 * In open-source mode the container is managed externally (docker-compose),
 * so this endpoint simply returns the static agent config without any
 * Docker/K8s orchestration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStaticAgentConfig } from '@/lib/container/staticAgentConfig';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const staticAgent = getStaticAgentConfig();

  if (!staticAgent.enabled) {
    return NextResponse.json(
      { success: false, error: 'Agent orchestration is not available in this deployment' },
      { status: 501 }
    );
  }

  // Return static config as if the agent just started — no Docker operations
  return NextResponse.json({
    success: true,
    data: {
      id: staticAgent.agentId || id,
      status: 'running',
      gatewayUrl: staticAgent.gatewayWsUrl,
      container: {
        hostPort: staticAgent.hostPort,
        orchestrator: staticAgent.orchestrator,
        imageTag: staticAgent.imageTag,
        healthStatus: null,
      },
    },
    meta: { mockMode: false, orchestrator: staticAgent.orchestrator },
  });
}
