/**
 * Agent Logs API
 *
 * GET /api/agents/:id/logs - 获取 Agent 容器日志
 *
 * @description
 * 返回 Agent 运行容器的日志内容。
 * 支持限制行数和时间过滤。
 *
 * Query Parameters:
 * - tail: 返回最后 N 行日志，默认 100
 * - since: Unix 时间戳，只返回该时间之后的日志
 * - timestamps: 是否包含时间戳，默认 false
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOrchestrator, OrchestratorError } from '@/lib/container';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const tail = parseInt(searchParams.get('tail') || '100');
    const sinceParam = searchParams.get('since');
    const timestamps = searchParams.get('timestamps') === 'true';

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
      return NextResponse.json(
        { success: false, error: 'Agent has no container' },
        { status: 400 }
      );
    }

    // External container mode: fetch logs via Container Gateway HTTP API
    const externalGateway = process.env.CONTAINER_GATEWAY_URL;
    if (externalGateway && agent.container.containerId.startsWith('external-')) {
      let logs = '[External container — logs available via: docker logs prismer-agent]';
      try {
        const res = await fetch(`${externalGateway}/api/v1/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const health = await res.json();
          logs = `[External container] Status: ${health.status}, Uptime: ${health.uptime}s\n` +
            Object.entries(health.services || {}).map(([name, svc]: [string, any]) =>
              `  ${name}: ${svc.status} (${svc.latency_ms}ms)`
            ).join('\n');
        }
      } catch { /* unreachable */ }

      return NextResponse.json({
        success: true,
        data: { agentId: id, containerId: agent.container.containerId, logs, fetchedAt: new Date().toISOString() },
      });
    }

    // Docker-managed container: fetch logs via orchestrator
    const orchestratorType = (agent.container.orchestrator as 'docker' | 'kubernetes') || 'docker';
    const orchestrator = getOrchestrator(orchestratorType);
    const logs = await orchestrator.getContainerLogs(agent.container.containerId, {
      tail,
      since: sinceParam ? new Date(parseInt(sinceParam) * 1000) : undefined,
      timestamps,
    });

    return NextResponse.json({
      success: true,
      data: {
        agentId: id,
        containerId: agent.container.containerId,
        logs,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('GET /api/agents/:id/logs error:', error);

    // 处理编排器错误
    if (error instanceof OrchestratorError) {
      const status = error.code === 'CONTAINER_NOT_FOUND' ? 404 : 500;
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
