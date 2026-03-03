/**
 * useComponentBusEvent — React hook for componentEventBus subscriptions
 *
 * Provides a clean React lifecycle-managed way to listen for bus events.
 * Replaces raw window.addEventListener for cross-component communication.
 *
 * @example
 * ```typescript
 * // Listen for notes:insert from any component
 * useComponentBusEvent('ai-editor', 'notesInsert', (event) => {
 *   const content = event.payload?.result as string;
 *   editor.insertContent(content);
 * });
 *
 * // Listen for asset:open targeted at this component
 * useComponentBusEvent('ag-grid', 'assetOpen', (event) => {
 *   loadAsset(event.payload);
 * });
 * ```
 */

import { useEffect, useRef } from 'react';
import { componentEventBus } from './componentEventBus';
import type { ComponentType, ComponentEventType, ComponentEvent } from './types';

/**
 * Subscribe to a specific component event on the bus.
 * Automatically unsubscribes on unmount.
 */
export function useComponentBusEvent(
  component: ComponentType,
  type: ComponentEventType,
  callback: (event: ComponentEvent) => void
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = componentEventBus.on(component, type, (event) => {
      callbackRef.current(event);
    });
    return unsubscribe;
  }, [component, type]);
}

/**
 * Subscribe to all events from a specific component.
 */
export function useComponentBusEvents(
  component: ComponentType,
  callback: (event: ComponentEvent) => void
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = componentEventBus.onAll((event) => {
      if (event.component === component) {
        callbackRef.current(event);
      }
    });
    return unsubscribe;
  }, [component]);
}

/**
 * Emit a bus event from within a React component.
 * Returns a stable dispatch function.
 */
export function useComponentBusDispatch(component: ComponentType) {
  const componentRef = useRef(component);
  componentRef.current = component;

  return useRef((type: ComponentEventType, payload?: ComponentEvent['payload']) => {
    componentEventBus.emit({
      component: componentRef.current,
      type,
      payload,
      timestamp: Date.now(),
    });
  }).current;
}
