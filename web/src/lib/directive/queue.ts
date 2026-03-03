/**
 * Directive Queue
 *
 * In-memory EventEmitter-based queue for UI directives sent by the
 * container plugin during agent tool execution. Directives are keyed
 * by agentId and pushed to frontend clients via SSE.
 *
 * Single-process only (Next.js standalone). For multi-server deployment,
 * replace with Redis pub/sub.
 */

import { EventEmitter } from 'events';
import { createLogger } from '@/lib/logger';

const log = createLogger('DirectiveQueue');

export interface QueuedDirective {
  id: string;
  type: string; // SWITCH_COMPONENT, LATEX_COMPILE_COMPLETE, etc.
  payload: Record<string, unknown>;
  timestamp: number;
}

class DirectiveQueue {
  private emitter = new EventEmitter();
  private pending = new Map<string, QueuedDirective[]>();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  /**
   * Add a directive to the queue and notify subscribers.
   */
  enqueue(agentId: string, directive: QueuedDirective): void {
    log.info('Directive enqueued', { agentId, type: directive.type, id: directive.id });
    const queue = this.pending.get(agentId) || [];
    queue.push(directive);
    this.pending.set(agentId, queue);
    this.emitter.emit(`directive:${agentId}`, directive);
  }

  /**
   * Return and clear all pending directives for an agent.
   */
  drain(agentId: string): QueuedDirective[] {
    const queue = this.pending.get(agentId) || [];
    this.pending.delete(agentId);
    return queue;
  }

  /**
   * Subscribe to new directives for an agent. Returns unsubscribe function.
   */
  subscribe(agentId: string, listener: (directive: QueuedDirective) => void): () => void {
    const event = `directive:${agentId}`;
    this.emitter.on(event, listener);
    return () => {
      this.emitter.off(event, listener);
    };
  }
}

// Singleton — use globalThis to survive Next.js HMR (same pattern as prisma.ts)
const globalForDirective = globalThis as typeof globalThis & { __directiveQueue?: DirectiveQueue };
export const directiveQueue = globalForDirective.__directiveQueue ?? new DirectiveQueue();
if (process.env.NODE_ENV !== 'production') globalForDirective.__directiveQueue = directiveQueue;
