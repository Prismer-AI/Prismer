/**
 * Component Event Bus
 *
 * Cross-component communication infrastructure.
 * Editors emit events; workspace orchestration listens and responds.
 */

export { componentEventBus } from './componentEventBus';
export { useComponentEvent, useComponentEventEmitter } from './hooks';
export { createEditorEventEmitter } from './editorEvents';
export { useComponentBusEvent, useComponentBusEvents, useComponentBusDispatch } from './useComponentBusEvent';
export type {
  ComponentType,
  ComponentEventType,
  ComponentEvent,
  WaitCondition,
  EventCallback,
} from './types';
