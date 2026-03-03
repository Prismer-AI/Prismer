/**
 * Directive SSE Stream
 *
 * GET /api/agents/:id/directive/stream
 *
 * Server-Sent Events endpoint that pushes UI directives to the frontend
 * in real-time. The frontend subscribes via EventSource when the agent
 * is running.
 *
 * Protocol:
 *   - On connect: drain any pending directives
 *   - On new directive: push `data: {json}\n\n`
 *   - Heartbeat every 30s: `: heartbeat\n\n`
 *   - Close on client disconnect
 */

import { NextRequest } from 'next/server';
import { directiveQueue, type QueuedDirective } from '@/lib/directive/queue';
import { createLogger } from '@/lib/logger';

const log = createLogger('DirectiveSSE');

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: agentId } = await params;

  log.info('SSE client connected', { agentId });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Track sent directive IDs to deduplicate (drain + subscribe overlap)
      const sentIds = new Set<string>();

      const send = (d: QueuedDirective) => {
        if (sentIds.has(d.id)) return; // skip duplicate
        sentIds.add(d.id);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`));
        } catch {
          // Controller closed
        }
      };

      // 1. Subscribe FIRST to avoid race between drain and subscribe.
      //    Without this, a directive arriving between drain() and subscribe()
      //    would be lost — cleared from pending by drain but emitted before
      //    the subscriber is registered.
      const unsubscribe = directiveQueue.subscribe(agentId, (directive: QueuedDirective) => {
        send(directive);
      });

      // 2. THEN drain pending directives (dedup handles overlap)
      const pending = directiveQueue.drain(agentId);
      for (const d of pending) {
        send(d);
      }

      if (pending.length > 0) {
        log.info('Drained pending directives', { agentId, count: pending.length });
      }

      // 3. Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30000);

      // 4. Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        log.info('SSE client disconnected', { agentId });
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
