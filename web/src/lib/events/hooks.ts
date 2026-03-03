/**
 * Component Event Bus Hooks
 *
 * React hooks for subscribing to and emitting component events.
 */

import { useEffect, useCallback } from 'react';
import { componentEventBus } from './componentEventBus';
import type { ComponentType, ComponentEventType, ComponentEvent, EventCallback } from './types';

/**
 * Hook to subscribe to component events
 */
export function useComponentEvent(
  component: ComponentType,
  type: ComponentEventType,
  callback: EventCallback
): void {
  useEffect(() => {
    return componentEventBus.on(component, type, callback);
  }, [component, type, callback]);
}

/**
 * Hook to emit events from a component
 */
export function useComponentEventEmitter(component: ComponentType) {
  const emitReady = useCallback(() => {
    componentEventBus.emit({
      component,
      type: 'ready',
      timestamp: Date.now(),
    });
  }, [component]);

  const emitContentLoaded = useCallback((payload?: ComponentEvent['payload']) => {
    componentEventBus.emit({
      component,
      type: 'contentLoaded',
      payload,
      timestamp: Date.now(),
    });
  }, [component]);

  const emitActionComplete = useCallback((action: string, result?: unknown) => {
    componentEventBus.emit({
      component,
      type: 'actionComplete',
      payload: { action, result },
      timestamp: Date.now(),
    });
  }, [component]);

  const emitActionFailed = useCallback((action: string, error: Error) => {
    componentEventBus.emit({
      component,
      type: 'actionFailed',
      payload: { action, error },
      timestamp: Date.now(),
    });
  }, [component]);

  const emitActionProgress = useCallback((action: string, progress: number, message?: string) => {
    componentEventBus.emit({
      component,
      type: 'actionProgress',
      payload: { action, progress, message },
      timestamp: Date.now(),
    });
  }, [component]);

  const emitStateChanged = useCallback((state: unknown) => {
    componentEventBus.emit({
      component,
      type: 'stateChanged',
      payload: { state },
      timestamp: Date.now(),
    });
  }, [component]);

  return {
    emitReady,
    emitContentLoaded,
    emitActionComplete,
    emitActionFailed,
    emitActionProgress,
    emitStateChanged,
  };
}
