/**
 * Component Event Bus Types
 *
 * Shared event types for cross-component communication.
 */

/** Embeddable component types in WindowViewer */
export type ComponentType =
  | 'ai-editor'
  | 'pdf-reader'
  | 'latex-editor'
  | 'code-playground'
  | 'bento-gallery'
  | 'three-viewer'
  | 'ag-grid'
  | 'jupyter-notebook';

export type ComponentEventType =
  | 'ready'           // Component finished loading and is ready
  | 'contentLoaded'   // Content (PDF, code file) loaded successfully
  | 'actionComplete'  // Specific action completed successfully
  | 'actionFailed'    // Action failed
  | 'actionProgress'  // Action progress update (e.g., terminal output)
  | 'stateChanged'    // Internal state changed
  | 'stateUpdate'     // State sync update from bridge
  | 'assetOpen'       // Asset browser selected an asset
  | 'notesInsert';    // Cross-component content insertion to notes

export interface ComponentEvent {
  component: ComponentType;
  type: ComponentEventType;
  payload?: {
    action?: string;       // Which action completed
    result?: unknown;      // Action result data
    error?: Error;         // Error if failed
    state?: unknown;       // New state
    progress?: number;     // Progress percentage (0-100)
    message?: string;      // Human-readable message
  };
  timestamp: number;
}

export interface WaitCondition {
  events: Array<{
    component: ComponentType;
    type: ComponentEventType;
    action?: string;
    validate?: (event: ComponentEvent) => boolean;
  }>;
  logic: 'all' | 'any';  // All conditions must be met, or any one
  timeout?: number;       // Default 30000ms
}

export type EventCallback = (event: ComponentEvent) => void;
