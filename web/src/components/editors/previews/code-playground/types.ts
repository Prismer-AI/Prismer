// ============================================================
// Code Playground Types
// ============================================================

/**
 * Playground mode
 * - frontend: Uses WebContainer for web development (React, Vue, etc.)
 * - script: Uses generic terminal for script execution (Python, Node, etc.)
 */
export type PlaygroundMode = "frontend" | "script";

/**
 * Supported project template types
 */
export type TemplateType = "react" | "vue" | "vanilla" | "python" | "node" | "custom";

/**
 * Layout modes for the IDE
 */
export type LayoutMode = "horizontal" | "vertical" | "editor-only" | "preview-only";

/**
 * WebContainer status
 */
export type ContainerStatus =
  | "idle"
  | "booting"
  | "mounting"
  | "installing"
  | "starting"
  | "ready"
  | "error";

/**
 * Single file data
 */
export interface FileData {
  content: string;
  language: string;
}

/**
 * File map (path -> file data)
 */
export type FilesMap = Record<string, FileData>;

/**
 * Event callbacks
 */
export interface CodePlaygroundCallbacks {
  /** Called when files are modified */
  onFilesChange?: (files: FilesMap) => void;
  /** Called when a file is selected */
  onFileSelect?: (path: string) => void;
  /** Called when container status changes */
  onStatusChange?: (status: ContainerStatus) => void;
  /** Called when preview URL is available */
  onPreviewReady?: (url: string) => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
  /** Called when terminal logs are updated */
  onLogsUpdate?: (logs: string[]) => void;
}

/**
 * Panel visibility configuration
 */
export interface PanelConfig {
  showFileTree?: boolean;
  showTerminal?: boolean;
  showPreview?: boolean;
}

/**
 * CodePlayground component props
 */
export interface CodePlaygroundProps {
  /** Playground mode (default: "frontend") */
  mode?: PlaygroundMode;
  /** Initial template type (default: "react" for frontend, "python" for script) */
  template?: TemplateType;
  /** Custom initial files (overrides template) */
  initialFiles?: FilesMap;
  /** Initial layout mode (default: "horizontal") */
  layout?: LayoutMode;
  /** Initial panel visibility */
  panels?: PanelConfig;
  /** Editor theme: "vs" (light) or "vs-dark" (default: "vs" / light) */
  theme?: "vs-dark" | "light";
  /** Auto-start WebContainer on mount (only for frontend mode) */
  autoStart?: boolean;
  /** Read-only mode (disable editing) */
  readOnly?: boolean;
  /** Hide toolbar */
  hideToolbar?: boolean;
  /** Custom class name */
  className?: string;
  /** Event callbacks */
  callbacks?: CodePlaygroundCallbacks;
  /** Agent instance ID — enables real container execution in script mode */
  agentInstanceId?: string;
}

/**
 * CodePlayground imperative handle (ref methods)
 */
export interface CodePlaygroundHandle {
  /** Get current files */
  getFiles: () => FilesMap;
  /** Set files programmatically */
  setFiles: (files: FilesMap) => void;
  /** Get current file content */
  getFileContent: (path: string) => string | undefined;
  /** Update a single file */
  updateFile: (path: string, content: string) => void;
  /** Start the WebContainer */
  start: () => Promise<void>;
  /** Stop the WebContainer */
  stop: () => void;
  /** Restart the WebContainer */
  restart: () => void;
  /** Get current status */
  getStatus: () => ContainerStatus;
  /** Get preview URL */
  getPreviewUrl: () => string;
  /** Export files as JSON */
  exportFiles: () => string;
  /** Import files from JSON */
  importFiles: (json: string) => void;
}
