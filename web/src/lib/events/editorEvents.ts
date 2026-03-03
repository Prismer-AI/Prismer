/**
 * Editor Event Emitter
 *
 * Factory for creating typed event emitters for editor components.
 * Combines componentEventBus.emit with optional sync forwarding.
 *
 * Usage:
 * ```typescript
 * // Module-level (works outside React)
 * const emit = createEditorEventEmitter('code-playground');
 * emit({ type: 'ready' });
 * emit({ type: 'actionComplete', payload: { action: 'execute_code' } });
 * ```
 */

import { componentEventBus } from './componentEventBus';
import { forwardComponentEvent } from '@/lib/sync/componentEventForwarder';
import type { ComponentType, ComponentEventType, ComponentEvent } from './types';

interface EditorEventOptions {
  type: ComponentEventType;
  payload?: {
    action?: string;
    result?: unknown;
    error?: Error;
    progress?: number;
    message?: string;
    state?: unknown;
    [key: string]: unknown;
  };
}

/**
 * Create a module-level event emitter for an editor component.
 * Emits to both the local event bus and the sync forwarder (if connected).
 */
export function createEditorEventEmitter(component: ComponentType) {
  return function emit(options: EditorEventOptions) {
    const event: ComponentEvent = {
      component,
      type: options.type,
      payload: options.payload as ComponentEvent['payload'],
      timestamp: Date.now(),
    };
    componentEventBus.emit(event);
    forwardComponentEvent(component, options.type, options.payload);
  };
}
