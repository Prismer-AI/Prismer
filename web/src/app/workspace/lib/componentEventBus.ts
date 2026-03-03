/**
 * Component Event Bus — Re-export from canonical location
 *
 * The event bus has been moved to src/lib/events/ since it is shared
 * infrastructure used by editors, workspace, and other modules.
 * This file re-exports everything for backward compatibility.
 */

export {
  componentEventBus,
  useComponentEvent,
  useComponentEventEmitter,
} from '@/lib/events';

export type {
  ComponentType,
  ComponentEventType,
  ComponentEvent,
  WaitCondition,
  EventCallback,
} from '@/lib/events';
