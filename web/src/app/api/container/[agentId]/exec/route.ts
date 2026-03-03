/**
 * Container Exec API
 *
 * Execute commands inside an agent's container.
 * Used by Code Playground for real Python/Node.js script execution.
 *
 * POST /api/container/{agentId}/exec
 * Body: { command: string[], timeout?: number }
 * Response: { success: true, data: { output: string } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveContainerEndpoint } from '@/lib/container/client';
import { getOrchestratorForAgent } from '@/lib/container/orchestrator';

type Params = Promise<{ agentId: string }>;

// Allowed command prefixes for security
const ALLOWED_COMMANDS = ['python3', 'python', 'node', 'bash'];

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  const { agentId } = await params;

  try {
    const body = await request.json() as { command: string[]; timeout?: number };
    const { command, timeout = 30000 } = body;

    if (!Array.isArray(command) || command.length === 0) {
      return NextResponse.json(
        { success: false, error: 'command must be a non-empty array of strings' },
        { status: 400 }
      );
    }

    // Whitelist check: only allow python3, node, bash
    const cmd = command[0];
    if (!ALLOWED_COMMANDS.includes(cmd)) {
      return NextResponse.json(
        { success: false, error: `Command not allowed: ${cmd}. Allowed: ${ALLOWED_COMMANDS.join(', ')}` },
        { status: 403 }
      );
    }

    // Resolve container
    const endpoint = await resolveContainerEndpoint(agentId);
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (endpoint.status !== 'running') {
      return NextResponse.json(
        { success: false, error: `Agent container is not running (status: ${endpoint.status})` },
        { status: 409 }
      );
    }

    if (!endpoint.containerId) {
      return NextResponse.json(
        { success: false, error: 'No container ID found for agent' },
        { status: 409 }
      );
    }

    // Execute command in container with timeout
    const { orchestrator } = await getOrchestratorForAgent(agentId);

    const execPromise = orchestrator.execCommand(endpoint.containerId, command);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Execution timed out')), timeout)
    );

    const output = await Promise.race([execPromise, timeoutPromise]);

    return NextResponse.json({
      success: true,
      data: { output },
    });
  } catch (error) {
    console.error('[Container Exec] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('timed out') ? 408 : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
