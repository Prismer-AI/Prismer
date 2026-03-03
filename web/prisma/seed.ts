/**
 * Prisma Seed Script
 *
 * Creates dev user, workspace, agent config, and agent instance
 * for local development.
 *
 * Usage: npx prisma db seed
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create dev user
  const user = await prisma.user.upsert({
    where: { email: process.env.DEV_USER_EMAIL || 'dev@localhost' },
    update: {},
    create: {
      id: 'dev-user',
      email: process.env.DEV_USER_EMAIL || 'dev@localhost',
      name: 'Dev User',
      isActive: true,
      emailVerified: true,
    },
  });
  console.log('User:', user.id, user.email);

  // 2. Check if workspace already exists
  const existingWorkspace = await prisma.workspaceSession.findFirst({
    where: { ownerId: user.id, status: 'active' },
  });

  if (existingWorkspace) {
    console.log('Workspace already exists:', existingWorkspace.id, existingWorkspace.name);

    // Ensure agent binding
    const existingAgent = await prisma.agentInstance.findFirst({
      where: { workspaceId: existingWorkspace.id },
    });

    if (!existingAgent) {
      const config = await prisma.agentConfig.create({
        data: {
          name: 'Research Agent Config',
          description: 'Default academic research agent configuration',
          templateType: 'academic-researcher',
          modelProvider: 'prismer-gateway',
          modelName: process.env.AGENT_DEFAULT_MODEL || 'gpt-4o',
        },
      });

      const agent = await prisma.agentInstance.create({
        data: {
          name: 'Research Agent',
          description: 'Container-based OpenClaw research agent',
          ownerId: user.id,
          workspaceId: existingWorkspace.id,
          configId: config.id,
          status: 'stopped',
        },
      });
      console.log('Agent created for existing workspace:', agent.id);
    } else {
      console.log('Agent already exists:', existingAgent.id);
    }

    console.log('Seed complete (existing workspace used).');
    return;
  }

  // 3. Create agent config
  const config = await prisma.agentConfig.create({
    data: {
      name: 'Research Agent Config',
      description: 'Default academic research agent configuration',
      templateType: 'academic-researcher',
      modelProvider: 'prismer-gateway',
      modelName: process.env.AGENT_DEFAULT_MODEL || 'gpt-4o',
    },
  });
  console.log('AgentConfig:', config.id, config.name);

  // 4. Create workspace
  const workspace = await prisma.workspaceSession.create({
    data: {
      name: 'Research Workspace',
      description: 'Default development workspace',
      ownerId: user.id,
      status: 'active',
      settings: JSON.stringify({
        autoSave: true,
        notificationsEnabled: true,
      }),
    },
  });
  console.log('Workspace:', workspace.id, workspace.name);

  // 5. Add owner as participant
  await prisma.workspaceParticipant.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      name: 'Dev User',
      type: 'user',
      role: 'owner',
      status: 'online',
    },
  });

  // 6. Create agent instance bound to workspace
  const agent = await prisma.agentInstance.create({
    data: {
      name: 'Research Agent',
      description: 'Container-based OpenClaw research agent',
      ownerId: user.id,
      workspaceId: workspace.id,
      configId: config.id,
      status: 'stopped',
    },
  });
  console.log('AgentInstance:', agent.id, agent.name);

  console.log('\nSeed complete:', {
    userId: user.id,
    workspaceId: workspace.id,
    agentId: agent.id,
    configId: config.id,
  });
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
