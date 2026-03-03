/**
 * Skills API - Install Skill
 *
 * POST /api/skills/:id/install - Install skill to agent instance
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { BUILTIN_SKILLS, CLOUD_SKILLS_CATALOG } from '../../catalog';

// InstalledSkill type for JSON storage
interface InstalledSkill {
  id: string;
  name: string;
  version: string;
  installedAt: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { agentInstanceId, workspaceId, version } = body as {
      agentInstanceId?: string;
      workspaceId?: string;
      version?: string;
    };

    // Check if it's a builtin skill
    const isBuiltin = BUILTIN_SKILLS.some((s) => s.id === id);
    if (isBuiltin) {
      return NextResponse.json(
        { success: false, error: `Skill '${id}' is already installed (builtin)` },
        { status: 400 }
      );
    }

    // Find skill in catalog
    const skill = CLOUD_SKILLS_CATALOG.find((s) => s.id === id);
    if (!skill) {
      return NextResponse.json(
        { success: false, error: `Skill '${id}' not found in registry` },
        { status: 404 }
      );
    }

    const installedVersion = version || skill.version;

    // If agentInstanceId or workspaceId provided, persist to database
    if (agentInstanceId || workspaceId) {
      let agentInstance;

      if (agentInstanceId) {
        agentInstance = await prisma.agentInstance.findUnique({
          where: { id: agentInstanceId },
        });
      } else if (workspaceId) {
        agentInstance = await prisma.agentInstance.findUnique({
          where: { workspaceId },
        });
      }

      if (agentInstance) {
        // Parse existing installed skills
        const existingSkills: InstalledSkill[] = agentInstance.installedSkills
          ? JSON.parse(agentInstance.installedSkills as string)
          : [];

        // Check if already installed
        if (existingSkills.some((s) => s.id === id)) {
          return NextResponse.json(
            { success: false, error: `Skill '${id}' is already installed` },
            { status: 400 }
          );
        }

        // Add new skill
        const newSkill: InstalledSkill = {
          id,
          name: skill.name,
          version: installedVersion,
          installedAt: new Date().toISOString(),
        };

        // Update AgentInstance.installedSkills
        await prisma.agentInstance.update({
          where: { id: agentInstance.id },
          data: {
            installedSkills: JSON.stringify([...existingSkills, newSkill]),
          },
        });

        // Also update AgentConfig.skills so config survives container recreation
        if (agentInstance.configId) {
          const config = await prisma.agentConfig.findUnique({
            where: { id: agentInstance.configId },
          });
          if (config) {
            const configSkills: string[] = config.skills ? JSON.parse(config.skills) : [];
            if (!configSkills.includes(id)) {
              await prisma.agentConfig.update({
                where: { id: config.id },
                data: { skills: JSON.stringify([...configSkills, id]) },
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        name: skill.name,
        version: installedVersion,
        message: `Skill '${skill.name}' v${installedVersion} installed successfully`,
        setupInstructions: [
          `Skill will be available in workspace after container restart`,
          `Tools available: ${skill.tools.map((t) => t.name).join(', ')}`,
        ],
      },
    });
  } catch (error) {
    console.error('[API] /api/skills/[id]/install error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to install skill' },
      { status: 500 }
    );
  }
}
