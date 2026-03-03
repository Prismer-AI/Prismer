/**
 * Static agent binding config for open-source deployments.
 *
 * When enabled, APIs can resolve a single Docker-managed gateway from env
 * instead of reading dynamic agent/container bindings from database.
 */

export interface StaticAgentConfig {
  enabled: boolean;
  agentId: string;
  ownerId: string;
  containerId: string;
  agentStatus: 'running' | 'starting' | 'stopped' | 'error';
  containerStatus: 'running' | 'stopped' | 'error';
  orchestrator: string;
  imageTag: string;
  hostPort: number | null;
  gatewayHttpBaseUrl: string;
  gatewayWsUrl: string;
  gatewayToken: string;
}

function parseBoolean(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function parseInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseUrlWithProtocol(raw: string, fallbackProtocol: 'http:' | 'ws:'): URL | null {
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`${fallbackProtocol}//${raw}`);
    } catch {
      return null;
    }
  }
}

function defaultPortForProtocol(protocol: string): number | null {
  if (protocol === 'http:' || protocol === 'ws:') return 80;
  if (protocol === 'https:' || protocol === 'wss:') return 443;
  return null;
}

function normalizeGatewayPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/api/v1/gateway/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

/**
 * Open-source default:
 * - Enable static mode when STATIC_AGENT_ENABLED=true
 * - Or when external gateway envs are provided
 * - Gateway defaults to localhost:16888 (docker compose under /docker)
 */
export function getStaticAgentConfig(): StaticAgentConfig {
  const explicitEnabled = parseBoolean(process.env.STATIC_AGENT_ENABLED);
  const rawHttpGateway = process.env.STATIC_AGENT_GATEWAY_URL || process.env.CONTAINER_GATEWAY_URL || '';
  const rawWsGateway = process.env.STATIC_AGENT_GATEWAY_WS_URL || process.env.OPENCLAW_GATEWAY_URL || '';
  const inferredEnabled = explicitEnabled ?? Boolean(rawHttpGateway || rawWsGateway);

  if (!inferredEnabled) {
    return {
      enabled: false,
      agentId: '',
      ownerId: '',
      containerId: '',
      agentStatus: 'stopped',
      containerStatus: 'stopped',
      orchestrator: 'docker',
      imageTag: '',
      hostPort: null,
      gatewayHttpBaseUrl: '',
      gatewayWsUrl: '',
      gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || 'prismer-dev-token',
    };
  }

  const rawEndpoint = rawWsGateway || rawHttpGateway || 'http://localhost:16888';
  const fallbackProtocol: 'http:' | 'ws:' = rawWsGateway ? 'ws:' : 'http:';
  const parsed = parseUrlWithProtocol(rawEndpoint, fallbackProtocol) || new URL('http://localhost:16888');

  const isWsInput = parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : parsed.protocol === 'http:' ? 'ws:' : parsed.protocol;
  const httpProtocol = parsed.protocol === 'wss:' ? 'https:' : parsed.protocol === 'ws:' ? 'http:' : parsed.protocol;
  const gatewayPath = normalizeGatewayPath(parsed.pathname);
  const hostPortFromUrl = parsed.port ? parseInt(parsed.port, 10) : defaultPortForProtocol(parsed.protocol);
  const hostPort = parseInteger(process.env.STATIC_AGENT_HOST_PORT) ?? hostPortFromUrl ?? 16888;
  const host = parsed.host || `localhost:${hostPort}`;

  const gatewayWsUrl = isWsInput
    ? `${wsProtocol}//${host}${gatewayPath}`
    : `${wsProtocol}//${host}/api/v1/gateway/`;
  const gatewayHttpBaseUrl = `${httpProtocol}//${host}`;

  const agentStatus = (process.env.STATIC_AGENT_STATUS as StaticAgentConfig['agentStatus']) || 'running';
  const containerStatus = (process.env.STATIC_CONTAINER_STATUS as StaticAgentConfig['containerStatus']) || 'running';

  return {
    enabled: true,
    agentId: process.env.STATIC_AGENT_ID || process.env.PRISMER_AGENT_ID || 'default',
    ownerId: process.env.STATIC_AGENT_OWNER_ID || 'dev-user',
    containerId: process.env.STATIC_AGENT_CONTAINER_ID || 'prismer-agent',
    agentStatus,
    containerStatus,
    orchestrator: process.env.STATIC_AGENT_ORCHESTRATOR || 'docker',
    imageTag: process.env.STATIC_AGENT_IMAGE_TAG || 'docker-openclaw-static',
    hostPort,
    gatewayHttpBaseUrl,
    gatewayWsUrl,
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || 'prismer-dev-token',
  };
}
