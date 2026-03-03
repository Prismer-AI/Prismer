/**
 * Component State Bridge
 *
 * Subscribes to componentStore changes and forwards syncable state
 * updates to the Agent Server via componentEventForwarder.
 *
 * Usage: Call `initComponentStateBridge()` once at the workspace level
 * (e.g., in WorkspaceView mount). Call the returned cleanup function on unmount.
 */

import { useComponentStore } from '@/app/workspace/stores/componentStore';
import { forwardComponentEvent } from './componentEventForwarder';
import { filterSyncableState, filterPersistableState, getComponentConfig } from './componentStateConfig';
import { createLogger } from '@/lib/logger';
import type { ComponentStates } from '@/types/workspace';

const log = createLogger('ComponentBridge');

let unsubscribe: (() => void) | null = null;

/**
 * Initialize the bridge between componentStore and sync engine.
 * Detects changes to componentStates and forwards syncable fields.
 * Returns a cleanup function.
 */
export function initComponentStateBridge(): () => void {
  if (unsubscribe) {
    // Already initialized — clean up first
    unsubscribe();
  }

  let prevStates: ComponentStates = { ...useComponentStore.getState().componentStates };

  unsubscribe = useComponentStore.subscribe((state) => {
    const currentStates = state.componentStates;

    // Check each component for changes
    for (const key of Object.keys(currentStates) as Array<keyof ComponentStates>) {
      const prev = prevStates[key];
      const curr = currentStates[key];

      // Skip if no change (reference equality)
      if (prev === curr) continue;

      // Skip if no sync config for this component
      if (!getComponentConfig(key)) continue;

      // Filter to only syncable fields
      if (curr) {
        const syncable = filterSyncableState(key, curr as Record<string, unknown>);
        if (Object.keys(syncable).length > 0) {
          forwardComponentEvent(key, 'stateUpdate', syncable);
        }
      }
    }

    prevStates = { ...currentStates };
  });

  log.debug('WebSocket bridge initialized');

  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
      log.debug('WebSocket bridge cleaned up');
    }
  };
}

// ============================================================
// DB Persistence — auto-save component state to database
// ============================================================

const DB_DEBOUNCE_MS = 3000;

/**
 * Auto-persist component state changes to the database.
 * Watches componentStore and debounces PATCH calls per component type.
 * Returns a cleanup function.
 */
export function initComponentDbPersistence(workspaceId: string): () => void {
  const dbTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let prevStates: ComponentStates = { ...useComponentStore.getState().componentStates };

  const unsub = useComponentStore.subscribe((state) => {
    const currentStates = state.componentStates;

    for (const key of Object.keys(currentStates) as Array<keyof ComponentStates>) {
      const prev = prevStates[key];
      const curr = currentStates[key];

      if (prev === curr) continue;
      if (!curr || !getComponentConfig(key)) continue;

      const persistable = filterPersistableState(key, curr as Record<string, unknown>);
      if (Object.keys(persistable).length === 0) continue;

      // Clear existing timer for this component
      const existing = dbTimers.get(key);
      if (existing) clearTimeout(existing);

      // Debounced DB write
      dbTimers.set(key, setTimeout(() => {
        fetch(`/api/workspace/${workspaceId}/component-states`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ componentType: key, state: persistable }),
        }).then(() => {
          log.debug('Component state persisted to DB', { component: key, workspaceId });
        }).catch((err) => {
          log.warn('Failed to persist component state', { component: key, error: err.message });
        });
        dbTimers.delete(key);
      }, DB_DEBOUNCE_MS));
    }

    prevStates = { ...currentStates };
  });

  log.info('DB persistence initialized', { workspaceId });

  return () => {
    unsub();
    // Clear all pending timers
    for (const timer of dbTimers.values()) {
      clearTimeout(timer);
    }
    dbTimers.clear();
    log.debug('DB persistence cleaned up');
  };
}
