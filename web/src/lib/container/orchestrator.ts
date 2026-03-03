/**
 * Container Orchestrator (Open-Source Slim)
 *
 * Orchestrator interface for health checks, log retrieval,
 * and command execution. Full lifecycle methods (create/start/
 * stop/remove/deploy) are not needed in open-source mode.
 */

import type {
  HealthCheckResult,
} from './types';

// ============================================================
// Orchestrator Interface
// ============================================================

export interface ContainerOrchestrator {
  /** Get container logs */
  getContainerLogs(
    containerId: string,
    options?: {
      tail?: number;
      since?: Date;
      timestamps?: boolean;
    }
  ): Promise<string>;

  /** Health check */
  healthCheck(containerId: string): Promise<HealthCheckResult>;

  /** Execute command inside container */
  execCommand(containerId: string, cmd: string[]): Promise<string>;
}

// ============================================================
// Orchestrator Error
// ============================================================

export type OrchestratorErrorCode =
  | 'CONTAINER_NOT_FOUND'
  | 'HEALTH_CHECK_FAILED'
  | 'DOCKER_NOT_AVAILABLE'
  | 'UNKNOWN_ERROR';

export class OrchestratorError extends Error {
  constructor(
    public readonly code: OrchestratorErrorCode,
    message: string,
    public readonly containerId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

// ============================================================
// Factory
// ============================================================

const _orchestrators = new Map<string, ContainerOrchestrator>();

export function getOrchestrator(type: 'docker' | 'kubernetes' = 'docker'): ContainerOrchestrator {
  // In open-source mode, always use Docker orchestrator
  const key = 'docker';
  if (_orchestrators.has(key)) {
    return _orchestrators.get(key)!;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DockerOrchestrator } = require('./dockerOrchestrator');
  const orchestrator: ContainerOrchestrator = new DockerOrchestrator();

  _orchestrators.set(key, orchestrator);
  return orchestrator;
}

export async function getOrchestratorForAgent(agentId: string): Promise<{
  orchestrator: ContainerOrchestrator;
  type: 'docker' | 'kubernetes';
}> {
  const prisma = (await import('@/lib/prisma')).default;
  const container = await prisma.container.findFirst({
    where: { agentInstanceId: agentId },
    select: { orchestrator: true },
  });

  const type = (container?.orchestrator as 'docker' | 'kubernetes') || 'docker';
  return { orchestrator: getOrchestrator(type), type };
}
