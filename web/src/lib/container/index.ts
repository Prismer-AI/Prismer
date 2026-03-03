/**
 * Container Module (Open-Source Slim)
 *
 * Provides container health checks, log retrieval, and exec for
 * externally-managed containers. Full lifecycle orchestration
 * (create/start/stop/remove) is not needed in open-source mode.
 */

// Types
export type {
  ContainerStatus,
  ContainerState,
  HealthCheckResult,
} from './types';

// Orchestrator (healthCheck, getContainerLogs, execCommand)
export {
  type ContainerOrchestrator,
  OrchestratorError,
  type OrchestratorErrorCode,
  getOrchestrator,
  getOrchestratorForAgent,
} from './orchestrator';

// Compatibility — version validation between backend and container
export {
  type CompatibilityMatrix,
  type CompatibilityResult,
  type ComponentCompatibility,
  COMPATIBILITY,
  checkVersionCompatibility,
} from './compatibility';

// Client (for API proxy)
export {
  type ContainerService,
  type ContainerEndpoint,
  resolveContainerEndpoint,
  buildServiceUrl,
  buildHealthUrl,
  proxyToContainer,
  type ProxyOptions,
  type ProxyResult,
  ContainerProxyError,
  type ContainerProxyErrorCode,
} from './client';
