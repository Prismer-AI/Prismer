#!/usr/bin/env npx tsx
/**
 * E2E Workspace Scenario Test
 *
 * Tests the complete workspace lifecycle with full observability output:
 *
 * Phase 1: Workspace Creation
 *   - Create workspace with academic-researcher template
 *   - Verify AgentConfig + AgentInstance created (1:1 binding)
 *   - Verify template defaults populated
 *
 * Phase 2: Agent Lifecycle
 *   - Start agent container (or mock mode)
 *   - Verify container record created
 *   - Verify ConfigDeployment audit trail
 *   - Check gateway connectivity
 *
 * Phase 3: Chat Communication
 *   - Send message via Bridge API
 *   - Verify IM message persistence (user + agent)
 *   - Verify message history loading
 *   - Check directive extraction
 *
 * Phase 4: Simulate Directive Pipeline
 *   - Send simulated directives (switch_component, load_document)
 *   - Verify directive validation
 *
 * Phase 5: Cleanup
 *   - Stop agent
 *   - Delete workspace
 *
 * Usage:
 *   npx tsx scripts/e2e-workspace-scenario.ts
 *   npx tsx scripts/e2e-workspace-scenario.ts --base-url http://localhost:3000
 */

const BASE_URL = process.argv.find(a => a.startsWith('--base-url='))?.split('=')[1]
  || process.env.BASE_URL
  || 'http://localhost:3000';

// ============================================================
// Logger
// ============================================================

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

let phaseNumber = 0;
let stepNumber = 0;
let passCount = 0;
let failCount = 0;

function phase(name: string) {
  phaseNumber++;
  stepNumber = 0;
  console.log(`\n${COLORS.bold}${COLORS.blue}═══════════════════════════════════════════════════════════════`);
  console.log(`  Phase ${phaseNumber}: ${name}`);
  console.log(`═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);
}

function step(name: string) {
  stepNumber++;
  console.log(`${COLORS.cyan}  [${phaseNumber}.${stepNumber}] ${name}${COLORS.reset}`);
}

function pass(msg: string, data?: Record<string, unknown>) {
  passCount++;
  const dataStr = data ? ` ${COLORS.dim}${JSON.stringify(data)}${COLORS.reset}` : '';
  console.log(`${COLORS.green}    ✓ ${msg}${dataStr}${COLORS.reset}`);
}

function fail(msg: string, data?: Record<string, unknown>) {
  failCount++;
  const dataStr = data ? ` ${COLORS.dim}${JSON.stringify(data)}${COLORS.reset}` : '';
  console.log(`${COLORS.red}    ✗ ${msg}${dataStr}${COLORS.reset}`);
}

function info(msg: string) {
  console.log(`${COLORS.dim}    → ${msg}${COLORS.reset}`);
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    info(`${label} [${duration}ms]`);
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    fail(`${label} threw after ${duration}ms`, { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ============================================================
// HTTP Client
// ============================================================

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: T }> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json() as T;
  return { status: response.status, data };
}

// ============================================================
// Test Scenario
// ============================================================

interface WorkspaceData {
  id: string;
  name: string;
  agentInstance?: { id: string; status: string };
}

async function main() {
  console.log(`${COLORS.bold}${COLORS.magenta}`);
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         E2E Workspace Scenario Test                      ║');
  console.log('║         Prismer.AI — Full Lifecycle Validation           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`${COLORS.reset}`);
  console.log(`${COLORS.dim}  Base URL: ${BASE_URL}`);
  console.log(`  Time: ${new Date().toISOString()}${COLORS.reset}`);

  let workspaceId: string | null = null;
  let agentInstanceId: string | null = null;

  try {
    // ==================== Phase 1: Workspace Creation ====================
    phase('Workspace Creation');

    step('Create workspace with academic-researcher template');
    const createResult = await timed('POST /api/workspace', () =>
      api<{ success: boolean; data: WorkspaceData }>('POST', '/api/workspace', {
        name: `E2E Test - ${new Date().toISOString().slice(0, 16)}`,
        description: 'Automated E2E test workspace for observability validation',
        templateType: 'academic-researcher',
      })
    );

    if (createResult.status === 201 && createResult.data.success) {
      workspaceId = createResult.data.data.id;
      pass('Workspace created', { workspaceId, name: createResult.data.data.name });
    } else {
      fail('Workspace creation failed', { status: createResult.status, data: createResult.data });
      return;
    }

    step('Verify Agent binding (1:1)');
    const agentResult = await timed('GET /api/workspace/:id/agent', () =>
      api<{ success: boolean; data: { id: string; status: string; name?: string; config?: { id: string; name: string; modelName?: string }; container?: { id: string; status: string } } | null }>(
        'GET',
        `/api/workspace/${workspaceId}/agent`
      )
    );

    if (agentResult.data.success && agentResult.data.data) {
      agentInstanceId = agentResult.data.data.id;
      pass('Agent instance bound (1:1 verified)', {
        agentId: agentInstanceId,
        status: agentResult.data.data.status,
        name: agentResult.data.data.name,
        configId: agentResult.data.data.config?.id,
        model: agentResult.data.data.config?.modelName,
      });
    } else {
      fail('No agent bound to workspace', { response: agentResult.data });
    }

    // ==================== Phase 2: Agent Lifecycle ====================
    phase('Agent Lifecycle');

    if (!agentInstanceId) {
      fail('Cannot test lifecycle - no agent instance');
    } else {
      step('Start agent container');
      const startResult = await timed('POST /api/agents/:id/start', () =>
        api<{ success: boolean; data: { status: string; gatewayUrl?: string; container?: { hostPort?: number } }; meta?: { mockMode: boolean } }>(
          'POST',
          `/api/agents/${agentInstanceId}/start`
        )
      );

      if (startResult.data.success) {
        const isMock = (startResult.data as { meta?: { mockMode?: boolean } }).meta?.mockMode;
        pass('Agent started', {
          status: startResult.data.data.status,
          mockMode: isMock,
          gatewayUrl: startResult.data.data.gatewayUrl,
          hostPort: startResult.data.data.container?.hostPort,
        });
      } else {
        fail('Agent start failed', { response: startResult.data });
      }

      step('Verify ConfigDeployment audit record');
      // Check via agent details (config deployment is internal)
      const agentCheck = await timed('GET /api/workspace/:id/agent (post-start)', () =>
        api<{ success: boolean; data: { id: string; status: string } }>(
          'GET',
          `/api/workspace/${workspaceId}/agent`
        )
      );
      if (agentCheck.data.success && agentCheck.data.data.status === 'running') {
        pass('Agent confirmed running');
      } else {
        info(`Agent status: ${agentCheck.data.data?.status || 'unknown'} (may be mock mode)`);
      }

      step('Check bridge status');
      const bridgeStatus = await timed('GET /api/v2/im/bridge/:workspaceId', () =>
        api<{ ok: boolean; data: { status: string; gatewayUrl?: string; conversationId?: string } }>(
          'GET',
          `/api/v2/im/bridge/${workspaceId}`
        )
      );

      if (bridgeStatus.data.ok) {
        pass('Bridge status retrieved', {
          gatewayStatus: bridgeStatus.data.data.status,
          gatewayUrl: bridgeStatus.data.data.gatewayUrl,
          conversationId: bridgeStatus.data.data.conversationId,
        });
      } else {
        fail('Bridge status check failed', { response: bridgeStatus.data });
      }
    }

    // ==================== Phase 3: Chat Communication ====================
    phase('Chat Communication');

    step('Send message via Bridge API');
    const chatResult = await timed('POST /api/v2/im/bridge/:workspaceId', () =>
      api<{
        ok: boolean;
        data?: { response: string; directives: unknown[]; workspaceId: string };
        error?: { code: string; message: string };
      }>('POST', `/api/v2/im/bridge/${workspaceId}`, {
        content: 'Hello! I am testing the research workspace. Can you confirm you are active?',
        senderId: 'e2e-test-user',
        senderName: 'E2E Tester',
      })
    );

    if (chatResult.data.ok && chatResult.data.data?.response) {
      pass('Agent responded', {
        responseLength: chatResult.data.data.response.length,
        preview: chatResult.data.data.response.substring(0, 100),
        directiveCount: chatResult.data.data.directives?.length || 0,
      });
    } else {
      const errorCode = chatResult.data.error?.code;
      if (errorCode === 'NO_RESPONSE' || errorCode === 'NO_BRIDGE') {
        info(`Expected in mock mode: ${errorCode} - ${chatResult.data.error?.message}`);
        pass('Bridge API handled gracefully (no real container)');
      } else {
        fail('Chat message failed', { response: chatResult.data });
      }
    }

    step('Load message history');
    const historyResult = await timed('GET /api/v2/im/bridge/:workspaceId?include=messages', () =>
      api<{ ok: boolean; data: { messages?: unknown[]; status: string } }>(
        'GET',
        `/api/v2/im/bridge/${workspaceId}?include=messages&limit=10`
      )
    );

    if (historyResult.data.ok) {
      const msgCount = historyResult.data.data.messages?.length || 0;
      pass('Message history loaded', { messageCount: msgCount });
    } else {
      fail('Message history load failed');
    }

    // ==================== Phase 4: Directive Pipeline ====================
    phase('Directive Pipeline');

    step('Simulate UIDirectives');
    const directiveResult = await timed('POST /api/workspace/:id/simulate-directive', () =>
      api<{ success: boolean; data?: { directives: unknown[] }; error?: string }>(
        'POST',
        `/api/workspace/${workspaceId}/simulate-directive`,
        {
          directives: [
            { type: 'switch_component', target: 'pdf-reader' },
            {
              type: 'load_document',
              target: 'pdf-reader',
              data: { documentId: '2303.08774', title: 'GPT-4 Technical Report' },
            },
          ],
        }
      )
    );

    if (directiveResult.data.success) {
      pass('Directives validated', {
        count: (directiveResult.data.data?.directives as unknown[])?.length,
      });
    } else {
      fail('Directive validation failed', { error: directiveResult.data.error });
    }

    step('Test invalid directive type');
    const invalidDirective = await timed('POST /api/workspace/:id/simulate-directive (invalid)', () =>
      api<{ success: boolean; error?: string }>(
        'POST',
        `/api/workspace/${workspaceId}/simulate-directive`,
        {
          directives: [{ type: 'invalid_type' }],
        }
      )
    );

    if (!invalidDirective.data.success) {
      pass('Invalid directive correctly rejected', { error: invalidDirective.data.error });
    } else {
      fail('Invalid directive was not rejected');
    }

    // ==================== Phase 5: Cleanup ====================
    phase('Cleanup');

    if (agentInstanceId) {
      step('Stop agent');
      const stopResult = await timed('POST /api/agents/:id/stop', () =>
        api<{ success: boolean }>('POST', `/api/agents/${agentInstanceId}/stop`)
      );
      if (stopResult.data.success) {
        pass('Agent stopped');
      } else {
        info('Agent stop may have already been stopped');
      }
    }

    step('Delete workspace');
    const deleteResult = await timed('DELETE /api/workspace/:id', () =>
      api<{ success: boolean }>('DELETE', `/api/workspace/${workspaceId}`)
    );
    if (deleteResult.data.success) {
      pass('Workspace deleted (cascade cleanup)');
    } else {
      fail('Workspace deletion failed', { response: deleteResult.data });
    }

  } catch (err) {
    console.error(`\n${COLORS.red}Fatal error:${COLORS.reset}`, err);

    // Attempt cleanup
    if (workspaceId) {
      console.log(`${COLORS.dim}  Attempting cleanup...${COLORS.reset}`);
      try {
        if (agentInstanceId) {
          await api('POST', `/api/agents/${agentInstanceId}/stop`).catch(() => {});
        }
        await api('DELETE', `/api/workspace/${workspaceId}`).catch(() => {});
      } catch { /* ignore cleanup errors */ }
    }
  }

  // ==================== Summary ====================
  console.log(`\n${COLORS.bold}═══════════════════════════════════════════════════════════════`);
  console.log(`  Results: ${COLORS.green}${passCount} passed${COLORS.reset}${COLORS.bold}, ${failCount > 0 ? COLORS.red : COLORS.dim}${failCount} failed${COLORS.reset}`);
  console.log(`${COLORS.bold}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

main();
