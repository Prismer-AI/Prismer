// ============================================================
// Jupyter Agent Module
// ============================================================

// Styles
import './styles/jupyter.css';

// Components
export { 
  JupyterNotebook, 
  CodeCell, 
  OutputArea, 
  QueryCell, 
  AgentCell, 
  CodeConfirmDialog,
  VirtualizedCellList,
  StreamingOutput,
  useStreamingOutput,
  VariableInspector,
  KeyboardShortcutsHelp,
  // Phase 5 新增
  DraggableCellList,
  PackageManager,
  SessionManager,
  ArtifactsPanel,
  ConversationThread,
  CellContextMenu,
  CellAIToolbar,
  PendingEditBanner,
  MarkdownRenderer,
} from './components';

export type { CellAIAction } from './components';

// Services
export { 
  JupyterService, 
  createJupyterService,
  AgentOrchestrator,
  createAgentOrchestrator,
  SafetyGuard,
  createSafetyGuard,
  ExecutionManager,
  createExecutionManager,
  ArtifactManager,
  createArtifactManager,
  ContextBuilder,
  createContextBuilder,
} from './services';

// Hooks
export {
  useKeyboardShortcuts,
  getShortcutsByCategory,
  formatShortcutKey,
} from './hooks';

// Store
export { useNotebookStore, eventBus, emit, on } from './store';

// Types
export type {
  // Cell types
  CellType,
  BaseCell,
  QueryCell as QueryCellType,
  AgentCell as AgentCellType,
  CodeCell as CodeCellType,
  MarkdownCell,
  Cell,
  Attachment,
  AgentCellStatus,
  ExecutionState,
  
  // Output types
  Output,
  StreamOutput,
  ExecuteResultOutput,
  DisplayDataOutput,
  ErrorOutput,
  MimeBundle,
  DataFrameData,
  
  // Kernel types
  KernelStatus,
  KernelSpec,
  KernelInfo,
  
  // Jupyter message types
  JupyterMessageHeader,
  JupyterMessage,
  ExecuteRequest,
  ExecuteReply,
  
  // Agent types
  AgentMode,
  AgentStatus,
  AgentConfig,
  AgentAction,
  AgentActionType,
  CreateCodeAction,
  ExecuteCellAction,
  RespondAction,
  
  // Context types
  NotebookContext,
  CellSummary,
  VariableInfo,
  ContextStrategy,
  CompiledContext,
  ContextWindow,
  ConversationTurn,
  ToolCall,
  ToolResult,
  
  // Document types
  NotebookDocument,
  NotebookMetadata,
  NotebookDocumentWithArtifacts,
  
  // Artifact types
  ArtifactType,
  ArtifactStatus,
  ArtifactStorage,
  BaseArtifact,
  ImageArtifact,
  DataFrameArtifact,
  DataFrameStatistics,
  ChartArtifact,
  FileArtifact,
  Artifact,
  ArtifactSummary,
  
  // Execution types
  ExecutionTask,
  ExecutionRecord,
  ExecutionCallbacks,
  
  // Persistence types
  PersistOptions,
  UploadOptions,
  StoredArtifact,
  
  // Component props
  JupyterNotebookProps,
  CodeCellProps,
  OutputAreaProps,
  QueryInputProps,
  
  // Execution handle
  ExecutionHandle,
  
  // Service interfaces
  JupyterServiceConfig,
  IJupyterService,
  IAgentService,
} from "./types";
