/**
 * Container File Sync API
 *
 * POST /api/workspace/[id]/files/sync-to-container
 *
 * Syncs files from the frontend workspace to the container's /workspace/ directory.
 * Used when the user imports templates, edits files, etc., and the container agent
 * needs access to those files.
 *
 * Flow: Frontend → Backend API → docker exec → Container /workspace/
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { getStaticAgentConfig } from '@/lib/container/staticAgentConfig';

const log = createLogger('Workspace:SyncToContainer');

interface Params {
  params: Promise<{ id: string }>;
}

interface SyncFile {
  path: string;
  content: string;
}

/**
 * POST /api/workspace/[id]/files/sync-to-container
 *
 * Body: { files: [{ path: string, content: string }] }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: workspaceId } = await params;
    const body = await request.json();
    const { files } = body as { files: SyncFile[] };
    const staticAgent = getStaticAgentConfig();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'files array is required' },
        { status: 400 }
      );
    }

    let containerId = '';
    if (staticAgent.enabled) {
      containerId = staticAgent.containerId;
      if (!containerId || containerId.startsWith('external-')) {
        log.debug('Static mode without docker-exec container id, skipping sync', { workspaceId, containerId });
        return NextResponse.json({
          success: true,
          data: { synced: 0, skipped: files.length, reason: 'no_container' },
        });
      }
      const isRunning = await isDockerContainerRunning(containerId);
      if (!isRunning) {
        log.debug('Static container not running, skipping sync', { workspaceId, containerId });
        return NextResponse.json({
          success: true,
          data: { synced: 0, skipped: files.length, reason: 'container_not_running' },
        });
      }
    } else {
      // Get agent + container for this workspace
      const agent = await prisma.agentInstance.findFirst({
        where: { workspaceId },
        include: { container: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!agent || !agent.container) {
        log.debug('No container found, skipping sync', { workspaceId });
        return NextResponse.json({
          success: true,
          data: { synced: 0, skipped: files.length, reason: 'no_container' },
        });
      }

      if (agent.container.status !== 'running') {
        log.debug('Container not running, skipping sync', { workspaceId, containerStatus: agent.container.status });
        return NextResponse.json({
          success: true,
          data: { synced: 0, skipped: files.length, reason: 'container_not_running' },
        });
      }

      containerId = agent.container.containerId;
    }

    log.info('Syncing files to container', {
      workspaceId,
      containerId: containerId.slice(0, 12),
      fileCount: files.length,
      mode: staticAgent.enabled ? 'static-env' : 'dynamic-db',
    });

    // Write files to container via docker exec
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const file of files) {
      if (!file.path || typeof file.content !== 'string') {
        failed++;
        continue;
      }

      try {
        await writeFileToContainer(containerId, file.path, file.content);
        synced++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${file.path}: ${msg}`);
        log.warn('File sync failed', { path: file.path, error: msg });
      }
    }

    log.info('Container file sync complete', { workspaceId, synced, failed });

    return NextResponse.json({
      success: true,
      data: {
        synced,
        failed,
        ...(errors.length > 0 ? { errors } : {}),
      },
    });
  } catch (error) {
    log.error('POST /api/workspace/[id]/files/sync-to-container error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function isDockerContainerRunning(containerId: string): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  try {
    const { stdout } = await execAsync(`docker inspect --format='{{.State.Running}}' ${containerId}`);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Write a file to the container's /workspace/ directory via docker exec.
 * Uses base64 encoding to avoid shell escaping issues.
 */
async function writeFileToContainer(
  containerId: string,
  filePath: string,
  content: string,
): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  // Sanitize path to prevent injection
  const safePath = filePath.replace(/\.\./g, '').replace(/[;|&`$]/g, '');
  const containerPath = `/workspace/${safePath}`;

  // Create parent directory
  const dir = containerPath.substring(0, containerPath.lastIndexOf('/'));
  await execAsync(`docker exec ${containerId} mkdir -p '${dir}'`);

  // Write file content via base64 to avoid escaping issues
  const b64 = Buffer.from(content, 'utf-8').toString('base64');
  await execAsync(
    `docker exec ${containerId} sh -c "echo '${b64}' | base64 -d > '${containerPath}'"`,
    { maxBuffer: 50 * 1024 * 1024 }, // 50MB buffer for large files
  );
}
