/**
 * E2E Test Setup — Create workspace + agent + container records.
 *
 * Usage: node scripts/e2e-setup-workspace.mjs
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { PrismaClient } = require(join(__dirname, '..', 'src', 'generated', 'prisma'));

const prisma = new PrismaClient();

async function setup() {
  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'e2e-test@localhost' },
    update: {},
    create: {
      email: 'e2e-test@localhost',
      name: 'E2E Test User',
      isActive: true,
      emailVerified: true,
    },
  });
  console.log('User:', user.id);

  // Create workspace
  const ws = await prisma.workspaceSession.upsert({
    where: { id: 'e2e-test-workspace' },
    update: {},
    create: {
      id: 'e2e-test-workspace',
      name: 'E2E Test Workspace',
      description: 'Automated E2E testing workspace',
      ownerId: user.id,
      status: 'active',
    },
  });
  console.log('Workspace:', ws.id);

  // Create agent instance
  const agent = await prisma.agentInstance.upsert({
    where: { workspaceId: ws.id },
    update: {
      status: 'running',
      gatewayUrl: 'ws://localhost:16888/api/v1/gateway/',
    },
    create: {
      name: 'E2E Test Agent',
      ownerId: user.id,
      workspaceId: ws.id,
      status: 'running',
      gatewayUrl: 'ws://localhost:16888/api/v1/gateway/',
      capabilities: JSON.stringify(['chat', 'research', 'latex', 'jupyter', 'code']),
    },
  });
  console.log('Agent:', agent.id);

  // Create container record
  const container = await prisma.container.upsert({
    where: { agentInstanceId: agent.id },
    update: {
      status: 'running',
      hostPort: 16888,
    },
    create: {
      agentInstanceId: agent.id,
      orchestrator: 'docker',
      containerId: 'external-prismer-agent',
      imageTag: 'prismer-academic:v5.0-openclaw',
      status: 'running',
      hostPort: 16888,
      gatewayPort: 3000,
      startedAt: new Date(),
    },
  });
  console.log('Container:', container.id);

  console.log('\n=== Setup complete ===');
  console.log('Workspace ID:', ws.id);
  console.log('Agent ID:', agent.id);
  console.log('Gateway: ws://localhost:16888/api/v1/gateway/');

  await prisma.$disconnect();
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
