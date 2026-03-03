// ============================================================
// Jupyter Agent Types
// ============================================================

// ============================================================
// Cell Types
// ============================================================

export type CellType = 'query' | 'agent' | 'code' | 'markdown';

export interface BaseCell {
  id: string;
  type: CellType;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

/**
 * Query Cell - User input/question
 */
export interface QueryCell extends BaseCell {
  type: 'query';
  content: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  data?: string; // base64
}

/**
 * Agent Cell - AI response
 */
export interface AgentCell extends BaseCell {
  type: 'agent';
  content: string; // Markdown content
  thinking?: string; // Chain of thought (optional)
  suggestedCode?: string; // Suggested code to insert
  actions?: AgentAction[]; // Actions suggested by the agent
  status: AgentCellStatus;
  queryId?: string; // Reference to the query this responds to
}

export type AgentCellStatus = 'pending' | 'thinking' | 'streaming' | 'complete' | 'error';

/**
 * Code Cell - Executable code
 */
export interface CodeCell extends BaseCell {
  type: 'code';
  source: string;
  language: string;
  executionCount: number | null;
  executionState: ExecutionState;
  outputs: Output[];
  createdBy: 'user' | 'agent';
}

export type ExecutionState = 'idle' | 'queued' | 'running' | 'success' | 'error';

/**
 * Markdown Cell - Rich text content
 */
export interface MarkdownCell extends BaseCell {
  type: 'markdown';
  source: string;
  rendered?: string; // Cached rendered HTML
}

export type Cell = QueryCell | AgentCell | CodeCell | MarkdownCell;

// ============================================================
// Output Types
// ============================================================

export type Output =
  | StreamOutput
  | ExecuteResultOutput
  | DisplayDataOutput
  | ErrorOutput;

export interface StreamOutput {
  type: 'stream';
  name: 'stdout' | 'stderr';
  text: string;
}

export interface ExecuteResultOutput {
  type: 'execute_result';
  executionCount: number;
  data: MimeBundle;
  metadata: Record<string, unknown>;
}

export interface DisplayDataOutput {
  type: 'display_data';
  data: MimeBundle;
  metadata: Record<string, unknown>;
}

export interface ErrorOutput {
  type: 'error';
  ename: string;
  evalue: string;
  traceback: string[];
}

/**
 * MIME bundle for rich content
 */
export interface MimeBundle {
  'text/plain'?: string;
  'text/html'?: string;
  'text/markdown'?: string;
  'text/latex'?: string;
  'image/png'?: string;
  'image/jpeg'?: string;
  'image/gif'?: string;
  'image/svg+xml'?: string;
  'application/json'?: unknown;
  'application/javascript'?: string;
  'application/vnd.plotly.v1+json'?: unknown;
  'application/vnd.jupyter.widget-view+json'?: unknown;
  [key: string]: unknown;
}

/**
 * DataFrame data structure for table rendering
 */
export interface DataFrameData {
  columns: string[];
  data: unknown[][];
  index?: (string | number)[];
  dtypes?: Record<string, string>;
  shape: [number, number];
  truncated: boolean;
  totalRows: number;
}

// ============================================================
// Kernel Types
// ============================================================

export type KernelStatus = 
  | 'disconnected'
  | 'connecting'
  | 'starting'
  | 'idle'
  | 'busy'
  | 'restarting'
  | 'dead';

export interface KernelSpec {
  name: string;
  displayName: string;
  language: string;
  metadata?: Record<string, unknown>;
}

export interface KernelInfo {
  id: string;
  name: string;
  status: KernelStatus;
  lastActivity?: string;
  executionCount: number;
}

// ============================================================
// Jupyter Message Types
// ============================================================

export interface JupyterMessageHeader {
  msg_id: string;
  msg_type: string;
  session: string;
  username: string;
  date: string;
  version: string;
}

export interface JupyterMessage<T = unknown> {
  header: JupyterMessageHeader;
  parent_header: Partial<JupyterMessageHeader>;
  metadata: Record<string, unknown>;
  content: T;
  buffers?: ArrayBuffer[];
  channel?: 'shell' | 'iopub' | 'stdin' | 'control';
}

// Execute request/reply
export interface ExecuteRequest {
  code: string;
  silent?: boolean;
  store_history?: boolean;
  user_expressions?: Record<string, string>;
  allow_stdin?: boolean;
  stop_on_error?: boolean;
}

export interface ExecuteReply {
  status: 'ok' | 'error' | 'aborted';
  execution_count: number;
  // Error fields
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

// ============================================================
// Agent Types
// ============================================================

export type AgentMode = 'interactive' | 'autonomous';

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'error';

export interface AgentConfig {
  enabled: boolean;
  mode: AgentMode;
  provider: 'openai' | 'anthropic' | 'custom';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  maxRetries?: number;
  autoExecute?: boolean;
}

export interface AgentAction {
  type: AgentActionType;
  payload?: unknown;
  code?: string;          // For create_cell, update_cell
  cellId?: string;        // For update_cell, execute_cell, delete_cell
  description?: string;   // Human-readable description
  warnings?: string[];    // Security warnings
}

export type AgentActionType =
  | 'respond'         // Send markdown response
  | 'create_code'     // Create new code cell
  | 'create_cell'     // Alias for create_code
  | 'update_cell'     // Update existing cell
  | 'execute_cell'    // Execute a cell
  | 'edit_code'       // Modify existing code
  | 'delete_cell'     // Delete a cell
  | 'request_input'   // Ask user for more info
  | 'explain'         // Explanation text
  | 'complete';       // Task finished

export interface CreateCodeAction {
  type: 'create_code';
  payload: {
    code: string;
    language?: string;
    insertAfterId?: string;
    autoExecute?: boolean;
  };
}

export interface ExecuteCellAction {
  type: 'execute_cell';
  payload: {
    cellId: string;
  };
}

export interface RespondAction {
  type: 'respond';
  payload: {
    content: string;
    suggestedCode?: string;
  };
}

// ============================================================
// Notebook Context (for Agent)
// ============================================================

export interface NotebookContext {
  cells: CellSummary[];
  variables: VariableInfo[];
  imports: string[];
  lastError?: {
    ename: string;
    evalue: string;
    traceback: string;
  };
  kernelLanguage: string;
}

export interface CellSummary {
  id: string;
  type: CellType;
  source?: string;
  outputSummary?: string;
  executionCount?: number;
}

export interface VariableInfo {
  name: string;
  type: string;
  shape?: string;
  preview?: string;
  size?: number;
}

// ============================================================
// Notebook Document
// ============================================================

export interface NotebookDocument {
  cells: Cell[];
  metadata: NotebookMetadata;
  nbformat: number;
  nbformat_minor: number;
}

export interface NotebookMetadata {
  kernelspec?: {
    name: string;
    display_name: string;
    language: string;
  };
  language_info?: {
    name: string;
    version?: string;
    mimetype?: string;
    file_extension?: string;
  };
  title?: string;
  authors?: string[];
  created?: string;
  modified?: string;
  [key: string]: unknown;
}

// ============================================================
// Component Props
// ============================================================

export interface JupyterNotebookProps {
  // Server configuration
  serverUrl: string;
  token?: string;
  wsUrl?: string;
  
  // Initial notebook
  initialNotebook?: NotebookDocument;
  notebookPath?: string;
  
  // Agent configuration
  agentConfig?: AgentConfig;
  
  // Callbacks
  onNotebookChange?: (notebook: NotebookDocument) => void;
  onKernelStatusChange?: (status: KernelStatus) => void;
  onCellExecute?: (cellId: string, outputs: Output[]) => void;
  onError?: (error: Error) => void;
  
  // UI options
  className?: string;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  showToolbar?: boolean;
  showLineNumbers?: boolean;
}

export interface CodeCellProps {
  cell: CodeCell;
  isActive: boolean;
  isSelected: boolean;
  kernelStatus: KernelStatus;
  
  onExecute: () => void;
  onSourceChange: (source: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onFocus: () => void;
  
  readOnly?: boolean;
  showLineNumbers?: boolean;
  theme?: 'light' | 'dark';
}

export interface OutputAreaProps {
  outputs: Output[];
  executionCount: number | null;
  isExecuting: boolean;
  maxHeight?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface QueryInputProps {
  onSubmit: (query: string, attachments?: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isProcessing?: boolean;
}

// ============================================================
// Execution Handle
// ============================================================

export interface ExecutionHandle {
  id: string;
  cellId: string;
  
  onOutput: (callback: (output: Output) => void) => void;
  onComplete: (callback: (result: ExecuteReply) => void) => void;
  onError: (callback: (error: ErrorOutput) => void) => void;
  
  cancel: () => void;
  done: Promise<ExecuteReply>;
}

// ============================================================
// Artifact Types
// ============================================================

export type ArtifactType =
  | 'image'
  | 'dataframe'
  | 'chart'
  | 'file'
  | 'model'
  | 'html'
  | 'widget'
  | 'unknown';

export type ArtifactStatus = 'memory' | 'uploading' | 'persisted' | 'error';

export interface ArtifactStorage {
  backend: 'local' | 's3' | 'gcs' | 'database';
  url?: string;
  path?: string;
  bucket?: string;
  key?: string;
  size?: number;
  checksum?: string;
}

export interface BaseArtifact {
  id: string;
  type: ArtifactType;
  name: string;
  description?: string;
  cellId: string;
  executionId: string;
  createdAt: string;
  status: ArtifactStatus;
  storage?: ArtifactStorage;
}

export interface ImageArtifact extends BaseArtifact {
  type: 'image';
  mimeType: 'image/png' | 'image/jpeg' | 'image/svg+xml';
  data: string;
  width?: number;
  height?: number;
  thumbnail?: string;
}

export interface DataFrameArtifact extends BaseArtifact {
  type: 'dataframe';
  columns: string[];
  shape: [number, number];
  dtypes: Record<string, string>;
  preview: unknown[][];
  statistics?: DataFrameStatistics;
}

export interface DataFrameStatistics {
  rowCount: number;
  columnCount: number;
  nullCounts: Record<string, number>;
  numericStats?: Record<string, {
    min: number;
    max: number;
    mean: number;
    std: number;
  }>;
}

export interface ChartArtifact extends BaseArtifact {
  type: 'chart';
  chartType: 'plotly' | 'matplotlib' | 'echarts';
  spec: unknown;
  imageSnapshot?: string;
}

export interface FileArtifact extends BaseArtifact {
  type: 'file';
  filename: string;
  mimeType: string;
  size: number;
  path?: string;
}

export type Artifact =
  | ImageArtifact
  | DataFrameArtifact
  | ChartArtifact
  | FileArtifact;

export interface ArtifactSummary {
  id: string;
  type: ArtifactType;
  name: string;
  cellId: string;
  createdAt: string;
  description?: string;
  imageData?: string;
  schema?: {
    columns: string[];
    dtypes: Record<string, string>;
    shape: [number, number];
  };
  preview?: unknown[][];
  path?: string;
}

// ============================================================
// Execution Types
// ============================================================

export interface ExecutionTask {
  id: string;
  cellId: string;
  code: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: number;
  endTime?: number;
}

export interface ExecutionRecord {
  id: string;
  cellId: string;
  code: string;
  status: 'success' | 'error';
  executionCount: number;
  startTime: number;
  endTime: number;
  duration: number;
  outputs: Output[];
  error?: ErrorOutput;
  variablesCreated: string[];
  artifactsCreated: string[];
}

export interface ExecutionCallbacks {
  onStart?: () => void;
  onOutput?: (output: Output) => void;
  onComplete?: (result: ExecutionRecord) => void;
  onError?: (error: ErrorOutput) => void;
}

// ============================================================
// Agent Context Types
// ============================================================

export interface ContextStrategy {
  recentCellCount: number;
  includeOutputCells: boolean;
  includeErrorCells: boolean;
  variableSummaryMaxLength: number;
  outputSummaryMaxLength: number;
  includeArtifacts: boolean;
}

export interface CompiledContext {
  systemPrompt?: string;
  recentCells: Array<{
    id: string;
    source: string;
    outputs: string;
    executionState: string;
  }>;
  summaries: Array<{
    id: string;
    summary: string;
  }>;
  variables: Array<{
    name: string;
    type: string;
    shape?: string;
  }>;
  errors: string[];
  activeCellId?: string;
  totalCells: number;
  artifacts?: ArtifactSummary[];
  estimatedTokens?: number;
}

export interface ContextWindow {
  maxTokens: number;
  currentTokens: number;
  strategy: ContextStrategy;
  compiledContext: CompiledContext | null;
}

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  relatedCellIds?: string[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

// ============================================================
// Persistence Types
// ============================================================

export interface PersistOptions {
  backend?: 'local' | 's3' | 'gcs' | 'database';
  generateThumbnail?: boolean;
  compress?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UploadOptions extends PersistOptions {
  path?: string;
  filename?: string;
  s3?: {
    bucket?: string;
    prefix?: string;
    acl?: string;
    storageClass?: string;
  };
}

export interface StoredArtifact {
  id: string;
  notebookId: string;
  cellId: string;
  type: ArtifactType;
  name: string;
  description?: string;
  storage: ArtifactStorage;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
  thumbnail?: string;
  preview?: unknown;
}

export interface NotebookDocumentWithArtifacts extends NotebookDocument {
  artifacts?: {
    [artifactId: string]: {
      cellId: string;
      type: ArtifactType;
      name: string;
      storage?: ArtifactStorage;
      inlineData?: string;
    };
  };
}

// ============================================================
// Service Interfaces
// ============================================================

export interface JupyterServiceConfig {
  baseUrl: string;
  token?: string;
  wsUrl?: string;
}

export interface IJupyterService {
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Kernel management
  listKernelSpecs(): Promise<KernelSpec[]>;
  listKernels(): Promise<KernelInfo[]>;
  startKernel(name: string): Promise<string>;
  shutdownKernel(kernelId: string): Promise<void>;
  interruptKernel(kernelId: string): Promise<void>;
  restartKernel(kernelId: string): Promise<void>;
  
  // Execution
  execute(kernelId: string, code: string): ExecutionHandle;
  
  // Events
  onKernelStatus(callback: (kernelId: string, status: KernelStatus) => void): () => void;
}

export interface IAgentService {
  // Process user query
  processQuery(
    query: string,
    context: NotebookContext
  ): AsyncGenerator<AgentAction>;
  
  // Analyze execution output
  analyzeOutput(
    code: string,
    outputs: Output[]
  ): Promise<string>;
  
  // Fix code error
  fixError(
    code: string,
    error: ErrorOutput,
    context: NotebookContext
  ): Promise<string>;
  
  // Generate code
  generateCode(
    task: string,
    context: NotebookContext
  ): Promise<string>;
  
  // Cancel current operation
  cancel(): void;
}
