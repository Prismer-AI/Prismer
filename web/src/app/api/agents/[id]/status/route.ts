/**
 * Agent Status API
 *
 * GET /api/agents/:id/status - 获取 Agent 运行状态
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { BUILTIN_SKILLS } from '@/app/api/skills/catalog';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const agent = await prisma.agentInstance.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        lastActiveAt: true,
        gatewayUrl: true,
        installedSkills: true,
        container: true,
        config: { select: { modelName: true } },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Parse version info from stored healthStatus JSON
    let versions: Record<string, string> | undefined;
    let versionCompatible: boolean | undefined;
    if (agent.container?.healthStatus) {
      try {
        const hs = JSON.parse(agent.container.healthStatus);
        versions = hs.versions;
        versionCompatible = hs.versionCompatible;
      } catch { /* ignore parse errors */ }
    }

    // Parse installedSkills JSON and merge with builtins for frontend display
    type InstalledSkillItem = { id: string; name: string; version: string; category?: string; builtin?: boolean };
    const builtinList: InstalledSkillItem[] = BUILTIN_SKILLS.map((s) => ({
      id: s.id,
      name: s.name,
      version: s.version,
      category: s.category,
      builtin: true,
    }));
    let fromDb: InstalledSkillItem[] = [];
    if (agent.installedSkills) {
      try {
        const raw = JSON.parse(agent.installedSkills) as Array<Record<string, unknown>>;
        fromDb = raw.map((s) => ({
          id: String(s?.id ?? ''),
          name: String(s?.name ?? s?.id ?? ''),
          version: String(s?.version ?? ''),
          category: s?.category != null ? String(s.category) : undefined,
          builtin: false,
        })).filter((s) => s.id);
      } catch { /* ignore */ }
    }
    const installedIds = new Set(builtinList.map((s) => s.id));
    const installedSkills: InstalledSkillItem[] = [
      ...builtinList,
      ...fromDb.filter((s) => !installedIds.has(s.id)),
    ];

    // 构建状态响应
    const status = {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      lastActiveAt: agent.lastActiveAt,
      installedSkills: installedSkills ?? [],

      // 容器信息
      container: agent.container
        ? {
            id: agent.container.containerId,
            status: agent.container.status,
            hostPort: agent.container.hostPort,
            orchestrator: agent.container.orchestrator,
            imageTag: agent.container.imageTag,
            versions,
            versionCompatible,
            uptime: agent.container.startedAt
              ? Math.floor(
                  (Date.now() - agent.container.startedAt.getTime()) / 1000
                )
              : null,
          }
        : null,

      // Gateway 连接信息
      gateway: agent.gatewayUrl
        ? {
            url: agent.gatewayUrl,
            connected: agent.status === 'running',
          }
        : null,

      // 配置信息
      config: agent.config
        ? {
            modelName: agent.config.modelName,
          }
        : null,
    };

    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error('GET /api/agents/:id/status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
