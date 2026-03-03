/**
 * Workspace-Aware LaTeX Compile API
 *
 * POST /api/workspace/:id/latex-compile
 * GET  /api/workspace/:id/latex-compile  (TeXLive availability check)
 *
 * Routes compilation to the container LaTeX service when the workspace
 * has a running agent. Falls back to local TeXLive otherwise.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger('WorkspaceLatexCompile');

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Resolve the agent instance + container for this workspace.
 */
async function getWorkspaceAgent(workspaceId: string) {
  const workspace = await prisma.workspaceSession.findUnique({
    where: { id: workspaceId },
    include: {
      agentInstance: {
        include: {
          container: { select: { id: true, containerId: true, status: true, hostPort: true } },
        },
      },
    },
  });
  return workspace;
}

/**
 * Read a file from a Docker container as a Buffer.
 * Uses child_process to run `docker cp` and read the file.
 */
async function readFileFromContainer(dockerContainerId: string, filePath: string): Promise<Buffer | null> {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync('docker', ['exec', dockerContainerId, 'cat', filePath], {
      maxBuffer: 50 * 1024 * 1024, // 50MB max for PDFs
      encoding: 'buffer' as BufferEncoding,
    });

    return stdout as unknown as Buffer;
  } catch (err) {
    log.warn('Failed to read file from container', {
      containerId: dockerContainerId.slice(0, 12),
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: workspaceId } = await params;
    const body = await request.json();
    const { content, filename = 'document', files, mainFile, engine = 'pdflatex' } = body;

    // Validate: need either content (single-file) or files (multi-file)
    if (!content && (!Array.isArray(files) || files.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'No content or files provided' },
        { status: 400 }
      );
    }

    const workspace = await getWorkspaceAgent(workspaceId);
    const agent = workspace?.agentInstance;
    const container = agent?.container;

    // Route 1: Container LaTeX service (when agent is running)
    if (agent && container?.status === 'running') {
      log.info('Routing LaTeX compile to container', {
        workspaceId,
        agentId: agent.id,
        containerId: container.id,
        dockerContainerId: container.containerId?.slice(0, 12),
      });

      try {
        const { proxyToContainer } = await import('@/lib/container/client');
        const result = await proxyToContainer(agent.id, 'latex', 'compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, filename, files, mainFile, engine }),
          timeout: 60000,
        });

        const responseBody = typeof result.body === 'string'
          ? result.body
          : Buffer.from(result.body as ArrayBuffer).toString('utf-8');

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(responseBody);
        } catch {
          // If the response is a PDF binary, return as data URL
          if (result.contentType?.includes('application/pdf')) {
            const pdfBuffer = Buffer.from(result.body as ArrayBuffer);
            const pdfBase64 = pdfBuffer.toString('base64');
            parsed = {
              success: true,
              pdfDataUrl: `data:application/pdf;base64,${pdfBase64}`,
            };
          } else {
            throw new Error('Unexpected response format from container LaTeX');
          }
        }

        // Container LaTeX service returns pdf_path (container-internal path).
        // Read the PDF from the container and convert to base64 pdfDataUrl.
        if (parsed.success && parsed.pdf_path && container.containerId) {
          const pdfBuffer = await readFileFromContainer(
            container.containerId,
            parsed.pdf_path as string
          );
          if (pdfBuffer) {
            const pdfBase64 = pdfBuffer.toString('base64');
            parsed.pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
            log.info('PDF read from container', {
              pdfPath: parsed.pdf_path,
              pdfSize: pdfBuffer.length,
            });
          }
        }

        return NextResponse.json(parsed);
      } catch (proxyError) {
        log.warn('Container compile failed, falling back to local', {
          workspaceId,
          error: proxyError instanceof Error ? proxyError.message : String(proxyError),
        });
        // Fall through to local compilation
      }
    }

    // Route 2: Local TeXLive fallback
    log.info('Routing LaTeX compile to local TeXLive', { workspaceId });

    const response = await fetch(`${getBaseUrl(request)}/api/latex/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, filename, files, mainFile, engine }),
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    log.error('LaTeX compile error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: workspaceId } = await params;
    const workspace = await getWorkspaceAgent(workspaceId);
    const container = workspace?.agentInstance?.container;

    // If container is running, LaTeX is available via container
    if (container?.status === 'running') {
      return NextResponse.json({
        available: true,
        source: 'container',
        version: 'Container LaTeX Service',
      });
    }

    // Check local TeXLive
    const response = await fetch(`${getBaseUrl(request)}/api/latex/compile`);
    const result = await response.json();
    return NextResponse.json({ ...result, source: 'local' });
  } catch {
    return NextResponse.json({ available: false, error: 'Check failed' });
  }
}

function getBaseUrl(request: NextRequest): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
