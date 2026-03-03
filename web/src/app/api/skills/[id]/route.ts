/**
 * Skills API - Get/Delete Skill by ID
 *
 * GET /api/skills/:id - Get skill details
 * DELETE /api/skills/:id - Uninstall skill (non-builtin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { BUILTIN_SKILLS, CLOUD_SKILLS_CATALOG, type SkillManifest } from '../catalog';

// InstalledSkill type for JSON storage
interface InstalledSkill {
  id: string;
  name: string;
  version: string;
  installedAt: string;
}

// ============================================================
// API Handlers
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const agentInstanceId = url.searchParams.get('agentInstanceId');
    const workspaceId = url.searchParams.get('workspaceId');

    // Search in builtin skills
    let skill: SkillManifest | undefined = BUILTIN_SKILLS.find((s) => s.id === id);

    // Search in cloud catalog
    if (!skill) {
      skill = CLOUD_SKILLS_CATALOG.find((s) => s.id === id);
    }

    if (!skill) {
      return NextResponse.json(
        { success: false, error: `Skill '${id}' not found` },
        { status: 404 }
      );
    }

    // Check if installed for the given agent instance
    let installed = skill.builtin || false;

    if (!installed && (agentInstanceId || workspaceId)) {
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

      if (agentInstance?.installedSkills) {
        const installedSkills: InstalledSkill[] = JSON.parse(
          agentInstance.installedSkills as string
        );
        installed = installedSkills.some((s) => s.id === id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...skill,
        installed,
      },
    });
  } catch (error) {
    console.error('[API] /api/skills/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch skill' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const agentInstanceId = url.searchParams.get('agentInstanceId');
    const workspaceId = url.searchParams.get('workspaceId');

    // Check if it's a builtin skill
    const isBuiltin = BUILTIN_SKILLS.some((s) => s.id === id);
    if (isBuiltin) {
      return NextResponse.json(
        { success: false, error: `Cannot uninstall builtin skill '${id}'` },
        { status: 400 }
      );
    }

    // Find skill in catalog
    const skill = CLOUD_SKILLS_CATALOG.find((s) => s.id === id);
    if (!skill) {
      return NextResponse.json(
        { success: false, error: `Skill '${id}' not found` },
        { status: 404 }
      );
    }

    // If agentInstanceId or workspaceId provided, remove from database
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

      if (agentInstance?.installedSkills) {
        // Parse existing installed skills
        const existingSkills: InstalledSkill[] = JSON.parse(
          agentInstance.installedSkills as string
        );

        // Check if installed
        if (!existingSkills.some((s) => s.id === id)) {
          return NextResponse.json(
            { success: false, error: `Skill '${id}' is not installed` },
            { status: 400 }
          );
        }

        // Remove skill
        const updatedSkills = existingSkills.filter((s) => s.id !== id);

        // Update AgentInstance.installedSkills
        await prisma.agentInstance.update({
          where: { id: agentInstance.id },
          data: {
            installedSkills:
              updatedSkills.length > 0 ? JSON.stringify(updatedSkills) : null,
          },
        });

        // Also remove from AgentConfig.skills for config persistence
        if (agentInstance.configId) {
          const config = await prisma.agentConfig.findUnique({
            where: { id: agentInstance.configId },
          });
          if (config?.skills) {
            const configSkills: string[] = JSON.parse(config.skills);
            const updatedConfigSkills = configSkills.filter((s) => s !== id);
            await prisma.agentConfig.update({
              where: { id: config.id },
              data: {
                skills: updatedConfigSkills.length > 0
                  ? JSON.stringify(updatedConfigSkills)
                  : null,
              },
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        message: `Skill '${id}' uninstalled successfully`,
      },
    });
  } catch (error) {
    console.error('[API] /api/skills/[id] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to uninstall skill' },
      { status: 500 }
    );
  }
}
