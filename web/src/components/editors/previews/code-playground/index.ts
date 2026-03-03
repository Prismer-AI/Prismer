// Main component
export { default as CodePlayground } from "./CodePlayground";

// Script Terminal (for script mode)
export { ScriptTerminal } from "./ScriptTerminal";
export type { ScriptTerminalHandle } from "./ScriptTerminal";

// File tree component
export { FileTree, buildFileTree } from "./FileTree";
export type { FileNode } from "./FileTree";

// Types
export type {
  PlaygroundMode,
  TemplateType,
  LayoutMode,
  ContainerStatus,
  FileData,
  FilesMap,
  CodePlaygroundCallbacks,
  PanelConfig,
  CodePlaygroundProps,
  CodePlaygroundHandle,
} from "./types";

// Templates
export {
  reactTemplate,
  vueTemplate,
  vanillaTemplate,
  pythonTemplate,
  nodeTemplate,
  frontendTemplates,
  scriptTemplates,
  templates,
  getTemplate,
  getDefaultFile,
  isFrontendTemplate,
  isScriptTemplate,
} from "./templates";

// Hooks
export { useWebContainer, statusLabels } from "./useWebContainer";
