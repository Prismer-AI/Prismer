/**
 * Component Event Bus
 *
 * Cross-component communication bus for editor ↔ workspace coordination.
 * Components emit events through this bus; the demo flow controller and
 * workspace orchestration layer listen and respond.
 */

import type {
  ComponentType,
  ComponentEventType,
  ComponentEvent,
  WaitCondition,
  EventCallback,
} from './types';

// ============================================================
// Event Bus Implementation
// ============================================================

type ListenerKey = `${ComponentType}:${ComponentEventType}`;

class ComponentEventBusImpl {
  private listeners: Map<ListenerKey, Set<EventCallback>> = new Map();
  private globalListeners: Set<EventCallback> = new Set();
  private eventHistory: ComponentEvent[] = [];
  private maxHistorySize = 100;

  /**
   * Subscribe to specific component events
   * @returns Unsubscribe function
   */
  on(
    component: ComponentType,
    type: ComponentEventType,
    callback: EventCallback
  ): () => void {
    const key: ListenerKey = `${component}:${type}`;

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    this.listeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  /**
   * Subscribe to all events (useful for debugging/logging)
   */
  onAll(callback: EventCallback): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  /**
   * Wait for a single event (one-time subscription)
   */
  once(
    component: ComponentType,
    type: ComponentEventType,
    timeout = 30000
  ): Promise<ComponentEvent> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for ${component}:${type}`));
      }, timeout);

      const unsubscribe = this.on(component, type, (event) => {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(event);
      });
    });
  }

  /**
   * Wait for a specific action to complete
   */
  waitForAction(
    component: ComponentType,
    action: string,
    timeout = 30000
  ): Promise<ComponentEvent> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for ${component} action: ${action}`));
      }, timeout);

      const unsubscribe = this.on(component, 'actionComplete', (event) => {
        if (event.payload?.action === action) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(event);
        }
      });
    });
  }

  /**
   * Wait for multiple conditions
   */
  async waitFor(condition: WaitCondition): Promise<ComponentEvent[]> {
    const { events, logic, timeout = 30000 } = condition;
    const results: ComponentEvent[] = [];
    const unsubscribes: (() => void)[] = [];

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribes.forEach(unsub => unsub());
        reject(new Error(`Timeout waiting for conditions`));
      }, timeout);

      const checkComplete = () => {
        if (logic === 'any' && results.length > 0) {
          clearTimeout(timeoutId);
          unsubscribes.forEach(unsub => unsub());
          resolve(results);
        } else if (logic === 'all' && results.length >= events.length) {
          clearTimeout(timeoutId);
          unsubscribes.forEach(unsub => unsub());
          resolve(results);
        }
      };

      events.forEach((condition, index) => {
        const unsub = this.on(condition.component, condition.type, (event) => {
          // Check action match if specified
          if (condition.action && event.payload?.action !== condition.action) {
            return;
          }

          // Run custom validation if specified
          if (condition.validate && !condition.validate(event)) {
            return;
          }

          results[index] = event;
          checkComplete();
        });

        unsubscribes.push(unsub);
      });
    });
  }

  /**
   * Emit an event
   */
  emit(event: ComponentEvent): void {
    // Log event
    console.log(`[EventBus] ${event.component}:${event.type}`, event.payload);

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify specific listeners
    const key: ListenerKey = `${event.component}:${event.type}`;
    this.listeners.get(key)?.forEach(callback => {
      try {
        callback(event);
      } catch (err) {
        console.error('[EventBus] Listener error:', err);
      }
    });

    // Notify global listeners
    this.globalListeners.forEach(callback => {
      try {
        callback(event);
      } catch (err) {
        console.error('[EventBus] Global listener error:', err);
      }
    });
  }

  /**
   * Get event history (for debugging)
   */
  getHistory(): ComponentEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear all listeners (for cleanup)
   */
  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const componentEventBus = new ComponentEventBusImpl();
