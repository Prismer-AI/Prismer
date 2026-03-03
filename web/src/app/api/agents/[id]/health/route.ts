/**
 * Agent Health API
 *
 * GET /api/agents/:id/health - 获取 Agent 健康状态
 *
 * @description
 * 执行 Agent 健康检查，返回：
 * - 容器运行状态
 * - Gateway 连接状态
 * - 资源使用情况
 *
 * 响应格式:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "healthy": true,
 *     "checkedAt": "2026-02-05T12:00:00Z",
 *     "gateway": { "connected": true, "url": "ws://...", "latency": 50 },
 *     "container": { "running": true, "uptime": 3600 }
 *   }
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOrchestrator, OrchestratorError, checkVersionCompatibility } from '@/lib/container';
import { getStaticAgentConfig } from '@/lib/container/staticAgentConfig';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const staticAgent = getStaticAgentConfig();

    if (staticAgent.enabled && id === staticAgent.agentId) {
      let gatewayHealthy = false;
      let latency = 0;
      let versions: Record<string, string> | undefined;
      let versionCompatible: boolean | undefined;

      try {
        const start = Date.now();
        const res = await fetch(`${staticAgent.gatewayHttpBaseUrl}/api/v1/health`, {
          signal: AbortSignal.timeout(5000),
        });
        latency = Date.now() - start;
        gatewayHealthy = res.ok;
      } catch {
        gatewayHealthy = false;
      }

      if (gatewayHealthy) {
        try {
          const versionRes = await fetch(`${staticAgent.gatewayHttpBaseUrl}/`, {
            signal: AbortSignal.timeout(3000),
          });
          if (versionRes.ok) {
            const rootData = await versionRes.json();
            if (rootData.versions) {
              versions = rootData.versions;
              const compat = checkVersionCompatibility(rootData.versions);
              versionCompatible = compat.compatible;
            }
          }
        } catch {
          // Non-blocking
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          agentId: id,
          healthy: gatewayHealthy,
          checkedAt: new Date().toISOString(),
          gateway: {
            connected: gatewayHealthy,
            url: staticAgent.gatewayWsUrl,
            latency,
          },
          container: {
            running: gatewayHealthy,
            hostPort: staticAgent.hostPort,
            orchestrator: staticAgent.orchestrator,
          },
          versions,
          versionCompatible,
          mode: 'static-env',
        },
      });
    }

    // 查询 Agent 和 Container
    const agent = await prisma.agentInstance.findUnique({
      where: { id },
      include: { container: true },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // 检查是否有容器
    if (!agent.container) {
      return NextResponse.json({
        success: true,
        data: {
          healthy: false,
          checkedAt: new Date().toISOString(),
          gateway: { connected: false },
          container: { running: false },
          error: 'No container created',
        },
      });
    }

    // External container mode: skip Docker API, use HTTP health check directly
    const externalGateway = process.env.CONTAINER_GATEWAY_URL;
    let health: {
      healthy: boolean;
      checkedAt: Date;
      gateway: { connected: boolean; url?: string; latency?: number };
      container: { running: boolean; uptime?: number };
      details?: { resources?: { cpuPercent?: number; memoryUsage?: number; memoryLimit?: number } };
    };

    if (externalGateway && agent.container.containerId.startsWith('external-')) {
      let gatewayHealthy = false;
      let latency = 0;
      try {
        const start = Date.now();
        const res = await fetch(`${externalGateway}/api/v1/health`, { signal: AbortSignal.timeout(5000) });
        latency = Date.now() - start;
        gatewayHealthy = res.ok;
      } catch { /* unreachable */ }

      health = {
        healthy: gatewayHealthy,
        checkedAt: new Date(),
        gateway: { connected: gatewayHealthy, url: agent.gatewayUrl || externalGateway, latency },
        container: { running: gatewayHealthy },
      };
    } else {
      // Docker-managed container: use orchestrator API
      const orchestratorType = (agent.container.orchestrator as 'docker' | 'kubernetes') || 'docker';
      const orchestrator = getOrchestrator(orchestratorType);
      health = await orchestrator.healthCheck(agent.container.containerId);

      if (agent.gatewayUrl && health.gateway) {
        health.gateway.url = agent.gatewayUrl;
      }
    }

    // Flatten details.resources into container so frontend can show CPU/Memory
    type ContainerWithResources = typeof health.container & {
      cpuPercent?: number;
      memoryUsage?: number;
      memoryLimit?: number;
    };
    const container: ContainerWithResources = { ...health.container };
    const resources = (health as { details?: { resources?: { cpuPercent?: number; memoryUsage?: number; memoryLimit?: number } } }).details?.resources;
    if (resources) {
      if (resources.cpuPercent != null) container.cpuPercent = resources.cpuPercent;
      if (resources.memoryUsage != null) container.memoryUsage = resources.memoryUsage;
      if (resources.memoryLimit != null) container.memoryLimit = resources.memoryLimit;
    }

    // Fetch container versions from gateway root endpoint
    let versions: Record<string, string> | undefined;
    let versionCompatible: boolean | undefined;

    if (health.healthy && agent.container.hostPort) {
      try {
        const versionRes = await fetch(`http://localhost:${agent.container.hostPort}/`, {
          signal: AbortSignal.timeout(3000),
        });
        if (versionRes.ok) {
          const rootData = await versionRes.json();
          if (rootData.versions) {
            versions = rootData.versions;
            const compat = checkVersionCompatibility(rootData.versions);
            versionCompatible = compat.compatible;
          }
        }
      } catch {
        // Non-blocking: version check failure doesn't affect health status
      }
    }

    // Also check stored version info from startup
    if (!versions && agent.container.healthStatus) {
      try {
        const stored = JSON.parse(agent.container.healthStatus);
        if (stored.versions) {
          versions = stored.versions;
          versionCompatible = stored.versionCompatible;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // 更新数据库中的健康状态
    await prisma.container.update({
      where: { id: agent.container.id },
      data: {
        healthStatus: JSON.stringify({ ...health, versions, versionCompatible }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        agentId: id,
        ...health,
        container,
        checkedAt: health.checkedAt.toISOString(),
        versions,
        versionCompatible,
      },
    });
  } catch (error) {
    console.error('GET /api/agents/:id/health error:', error);

    // 处理编排器错误
    if (error instanceof OrchestratorError) {
      return NextResponse.json({
        success: true,
        data: {
          healthy: false,
          checkedAt: new Date().toISOString(),
          gateway: { connected: false },
          container: { running: false },
          error: error.message,
          code: error.code,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
