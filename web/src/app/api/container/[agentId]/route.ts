/**
 * Container Status API
 *
 * Get container status and available services for an agent.
 *
 * GET /api/container/{agentId}
 * Returns: { success: boolean, data: { status, services, endpoints } }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveContainerEndpoint,
  buildServiceUrl,
  buildHealthUrl,
  ContainerService,
} from '@/lib/container/client';

type Params = Promise<{ agentId: string }>;

export async function GET(
  _request: NextRequest,
  { params }: { params: Params }
) {
  const { agentId } = await params;

  try {
    const endpoint = await resolveContainerEndpoint(agentId);

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Build service endpoints (all via unified gateway)
    const services: Record<ContainerService, string | null> = {
      gateway: buildServiceUrl(endpoint, 'gateway'),
      jupyter: buildServiceUrl(endpoint, 'jupyter'),
      latex: buildServiceUrl(endpoint, 'latex'),
      prover: buildServiceUrl(endpoint, 'prover'),
      arxiv: buildServiceUrl(endpoint, 'arxiv'),
    };

    // Build proxy endpoints (via Next.js API)
    const proxyEndpoints = {
      gateway: `/api/container/${agentId}/gateway`,
      jupyter: `/api/container/${agentId}/jupyter`,
      latex: `/api/container/${agentId}/latex`,
    };

    return NextResponse.json({
      success: true,
      data: {
        agentId: endpoint.agentId,
        containerId: endpoint.containerId,
        status: endpoint.status,
        gatewayUrl: endpoint.gatewayUrl,
        hostPort: endpoint.hostPort,
        healthUrl: buildHealthUrl(endpoint),
        services,
        proxyEndpoints,
        ready: endpoint.status === 'running',
      },
    });
  } catch (error) {
    console.error('[Container] Status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
