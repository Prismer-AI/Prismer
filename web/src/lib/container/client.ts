/**
 * Container Client
 *
 * @description
 * Client library for communicating with OpenClaw agent containers.
 * All container services are accessed via the unified Container Gateway
 * at a single port using the /api/v1/{service}/* routing pattern.
 *
 * Supports both Docker (localhost) and Kubernetes (nodeAddress) service discovery.
 */

import prisma from '@/lib/prisma';
import { getStaticAgentConfig } from './staticAgentConfig';

// ============================================================
// Container Service Types
// ============================================================

/**
 * Available container services exposed via the unified gateway
 */
export type ContainerService = 'latex' | 'prover' | 'jupyter' | 'gateway' | 'arxiv';

// ============================================================
// Container Resolution
// ============================================================

export interface ContainerEndpoint {
  agentId: string;
  containerId: string | null;
  status: string;
  gatewayUrl: string | null;
  hostPort: number | null;
  /** Orchestrator type: 'docker' or 'kubernetes' */
  orchestrator: string;
  /** Node external IP for K8s NodePort access */
  nodeAddress: string | null;
}

/**
 * Resolve container endpoint for an agent.
 *
 * Falls back to the default static container (CONTAINER_GATEWAY_PORT env)
 * when the agent ID is not found in the database. This supports the
 * single-container open-source deployment where all services share one
 * container regardless of the agent ID used by the frontend.
 */
export async function resolveContainerEndpoint(
  agentId: string
): Promise<ContainerEndpoint | null> {
  const agent = await prisma.agentInstance.findUnique({
    where: { id: agentId },
    include: { container: true },
  });

  if (!agent) {
    // Fallback: use the default static container (single-container deployment)
    const staticConfig = getStaticAgentConfig();
    if (staticConfig.hostPort) {
      return {
        agentId,
        containerId: staticConfig.containerId || null,
        status: staticConfig.agentStatus || 'running',
        gatewayUrl: staticConfig.gatewayWsUrl || null,
        hostPort: staticConfig.hostPort,
        orchestrator: staticConfig.orchestrator || 'docker',
        nodeAddress: null,
      };
    }
    return null;
  }

  const orchestrator = agent.container?.orchestrator ?? 'docker';

  // For K8s, derive node address from env or gatewayUrl
  let nodeAddress: string | null = null;
  if (orchestrator === 'kubernetes') {
    nodeAddress = process.env.K8S_NODE_EXTERNAL_IP || null;
    if (!nodeAddress && agent.gatewayUrl) {
      // Parse from gatewayUrl: ws://120.204.95.194:31234 → 120.204.95.194
      const match = agent.gatewayUrl.match(/\/\/([^:]+)/);
      if (match) nodeAddress = match[1];
    }
  }

  return {
    agentId: agent.id,
    containerId: agent.container?.containerId ?? agent.containerId,
    status: agent.status,
    gatewayUrl: agent.gatewayUrl,
    hostPort: agent.container?.hostPort ?? null,
    orchestrator,
    nodeAddress,
  };
}

/**
 * Build service URL for a container
 *
 * All services are accessed through the unified Container Gateway
 * via /api/v1/{service}/{path} routing.
 *
 * Docker: http://localhost:{hostPort}/api/v1/{service}/{path}
 * K8s:    http://{nodeAddress}:{hostPort}/api/v1/{service}/{path}
 */
export function buildServiceUrl(
  endpoint: ContainerEndpoint,
  service: ContainerService,
  path: string = ''
): string | null {
  if (!endpoint.hostPort) {
    return null;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const host = endpoint.nodeAddress || 'localhost';

  return `http://${host}:${endpoint.hostPort}/api/v1/${service}${normalizedPath}`;
}

/**
 * Build health check URL for a container
 */
export function buildHealthUrl(
  endpoint: ContainerEndpoint,
  service?: ContainerService
): string | null {
  if (!endpoint.hostPort) {
    return null;
  }

  const host = endpoint.nodeAddress || 'localhost';

  if (service) {
    return `http://${host}:${endpoint.hostPort}/api/v1/health/${service}`;
  }

  return `http://${host}:${endpoint.hostPort}/api/v1/health`;
}

// ============================================================
// Proxy Request Handler
// ============================================================

export interface ProxyOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface ProxyResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: ArrayBuffer | string;
  contentType: string;
}

/**
 * Proxy a request to a container service
 */
export async function proxyToContainer(
  agentId: string,
  service: ContainerService,
  path: string,
  options: ProxyOptions
): Promise<ProxyResult> {
  // Resolve container endpoint
  const endpoint = await resolveContainerEndpoint(agentId);

  if (!endpoint) {
    throw new ContainerProxyError('Agent not found', 'AGENT_NOT_FOUND');
  }

  if (endpoint.status !== 'running') {
    throw new ContainerProxyError(
      `Agent container is not running (status: ${endpoint.status})`,
      'CONTAINER_NOT_RUNNING'
    );
  }

  // Build service URL
  const serviceUrl = buildServiceUrl(endpoint, service, path);

  if (!serviceUrl) {
    throw new ContainerProxyError(
      'Cannot resolve container service URL',
      'URL_RESOLUTION_FAILED'
    );
  }

  // Execute proxy request
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeout || 30000
  );

  try {
    const response = await fetch(serviceUrl, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Parse body based on content type
    let body: ArrayBuffer | string;
    if (contentType.includes('application/json') || contentType.includes('text/')) {
      body = await response.text();
    } else {
      body = await response.arrayBuffer();
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
      contentType,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Error Types
// ============================================================

export type ContainerProxyErrorCode =
  | 'AGENT_NOT_FOUND'
  | 'CONTAINER_NOT_RUNNING'
  | 'URL_RESOLUTION_FAILED'
  | 'REQUEST_TIMEOUT'
  | 'CONNECTION_FAILED';

export class ContainerProxyError extends Error {
  constructor(
    message: string,
    public code: ContainerProxyErrorCode
  ) {
    super(message);
    this.name = 'ContainerProxyError';
  }
}
