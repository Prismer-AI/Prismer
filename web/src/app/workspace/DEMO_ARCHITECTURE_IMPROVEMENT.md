# Demo Flow Architecture - Deep Analysis & Improvement Plan

## 🔴 Current Problems

### 1. No Component Ready Detection
```typescript
// Current: Just updates state immediately, doesn't wait for anything
executeDirective: async (directive) => {
  set({ activeComponent: target as ComponentType }); // ❌ No wait for component to load
}
```

**Problem**: Components load asynchronously via `React.lazy()`, but demo flow doesn't wait for them to:
- Finish rendering
- Load their content (PDF document, code files)
- Be ready to receive actions

### 2. Auto-Advance Uses Arbitrary Timers
```typescript
// Current: Fixed delay, no relation to actual completion
const autoAdvanceDelay = (stepMessages.length * 500) + 2000;
setTimeout(() => {
  loadStep(nextStepIndex); // ❌ Advances regardless of component state
}, autoAdvanceDelay);
```

**Problem**: Demo advances based on time, not actual completion:
- PDF might still be loading when we try to interact with it
- Code execution might not have finished
- Chart might not have rendered

### 3. No Event Communication Between Components and Demo Flow
```typescript
// Current: Components are isolated, can't signal completion
export default function PDFReaderPreview() {
  // ❌ No way to notify demo flow that PDF is loaded
  // ❌ No way to receive commands from demo flow
}
```

### 4. State Snapshots Don't Capture Real Content
```typescript
// Current: Only metadata
interface PdfReaderState {
  documentId: string;     // ✓ Which document
  currentPage: number;    // ✓ Which page
  // ❌ Missing: actual annotations, highlights
  // ❌ Missing: AI chat history in sidebar
}

interface CodePlaygroundState {
  template: string;        // ✓ Which template
  selectedFile: string;    // ✓ Which file
  terminalOutput?: string; // ❌ This is always undefined
  // ❌ Missing: actual code content
  // ❌ Missing: file tree state
}
```

### 5. Timeline Restore is Non-Functional
```typescript
// Current: restoreSnapshot only updates layout, not content
restoreSnapshot: (snapshotId) => {
  const snapshot = state.stateSnapshots.find(s => s.id === snapshotId);
  // ❌ Only restores layout.activeComponent
  // ❌ Doesn't restore actual code, terminal output, PDF state
}
```

---

## 🟢 Required Architecture

### 1. Component Event Bus

```typescript
// src/app/workspace/lib/componentEventBus.ts

type ComponentEventType =
  | 'ready'           // Component finished loading
  | 'contentLoaded'   // Content (PDF, code) loaded
  | 'actionComplete'  // Specific action completed
  | 'actionFailed'    // Action failed
  | 'stateChanged';   // Internal state changed

interface ComponentEvent {
  component: ComponentType;
  type: ComponentEventType;
  payload?: {
    action?: string;
    result?: unknown;
    error?: Error;
    state?: unknown;
  };
  timestamp: number;
}

class ComponentEventBus {
  private listeners: Map<string, Set<(event: ComponentEvent) => void>>;
  
  // Subscribe to events
  on(component: ComponentType, type: ComponentEventType, callback: (event: ComponentEvent) => void): () => void;
  
  // One-time subscription
  once(component: ComponentType, type: ComponentEventType): Promise<ComponentEvent>;
  
  // Emit event
  emit(event: ComponentEvent): void;
  
  // Wait for condition
  waitFor(condition: WaitCondition): Promise<ComponentEvent[]>;
}

interface WaitCondition {
  events: Array<{
    component: ComponentType;
    type: ComponentEventType;
    action?: string;
  }>;
  logic: 'all' | 'any';
  timeout?: number;
}

export const componentEventBus = new ComponentEventBus();
```

### 2. Awaitable Action System

```typescript
// src/app/workspace/lib/actionExecutor.ts

interface AwaitableAction {
  id: string;
  type: 'load_document' | 'execute_code' | 'run_cell' | 'compile_latex' | 'send_chat';
  target: ComponentType;
  params: Record<string, unknown>;
  
  // What event signals completion
  completionEvent: {
    type: ComponentEventType;
    action?: string;
    validate?: (event: ComponentEvent) => boolean;
  };
  
  timeout?: number; // Default 30s
}

interface ActionResult {
  success: boolean;
  event?: ComponentEvent;
  error?: Error;
}

class ActionExecutor {
  async execute(action: AwaitableAction): Promise<ActionResult> {
    // 1. Dispatch the action to the component
    this.dispatchToComponent(action);
    
    // 2. Wait for completion event
    const event = await componentEventBus.once(
      action.target,
      action.completionEvent.type,
      action.timeout
    );
    
    // 3. Validate result if needed
    if (action.completionEvent.validate && !action.completionEvent.validate(event)) {
      return { success: false, error: new Error('Validation failed') };
    }
    
    return { success: true, event };
  }
}
```

### 3. Demo Step Definition with Conditions

```typescript
// Enhanced DemoStep
interface EnhancedDemoStep {
  id: string;
  order: number;
  title: string;
  description: string;
  
  // Actions to execute in sequence
  actions: AwaitableAction[];
  
  // Messages to show (after actions complete)
  messages: ExtendedChatMessage[];
  
  // Timeline events to record
  timelineEvents: ExtendedTimelineEvent[];
  
  // How to transition to next step
  transition: {
    type: 'auto' | 'interaction' | 'condition';
    
    // For 'interaction': which component/button triggers next step
    interactionTrigger?: {
      componentId: string;
      actionId: string;
    };
    
    // For 'condition': wait for these events
    conditions?: WaitCondition;
    
    // For 'auto': delay after actions complete
    autoDelay?: number;
  };
  
  // State to capture after this step
  captureState?: boolean;
}
```

### 4. Component Protocol for Demo Awareness

Each component that participates in demo needs to implement:

```typescript
// src/app/workspace/lib/demoAwareComponent.ts

interface DemoAwareComponent {
  // Called when component mounts
  onReady(): void;
  
  // Execute a specific action
  executeAction(action: string, params: Record<string, unknown>): Promise<void>;
  
  // Capture current state (for timeline)
  captureState(): ComponentContentState;
  
  // Restore state (for timeline scrubbing)
  restoreState(state: ComponentContentState): Promise<void>;
}

// Example for PDF Reader
interface PDFReaderDemoState {
  documentId: string;
  currentPage: number;
  zoom: number;
  highlights: Array<{ page: number; rect: Rect; color: string }>;
  aiChatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// Example actions for PDF Reader
type PDFReaderAction =
  | { type: 'load_document'; documentId: string }
  | { type: 'go_to_page'; page: number }
  | { type: 'add_highlight'; page: number; rect: Rect }
  | { type: 'send_ai_question'; question: string };
```

### 5. Deep State Snapshot System

```typescript
// src/app/workspace/lib/stateCapture.ts

interface DeepStateSnapshot {
  id: string;
  timestamp: number;
  
  // Layout state
  layout: {
    chatExpanded: boolean;
    chatPanelWidth: number;
    taskPanelHeight: TaskPanelHeight;
    activeComponent: ComponentType;
  };
  
  // Chat state
  chat: {
    messages: ExtendedChatMessage[];
    scrollPosition: number;
  };
  
  // Task state
  tasks: {
    list: Task[];
    activeId: string | null;
  };
  
  // Component content states (deep)
  components: {
    'pdf-reader'?: PDFReaderDemoState;
    'code-playground'?: CodePlaygroundDemoState;
    'jupyter-notebook'?: JupyterDemoState;
    'latex-editor'?: LatexEditorDemoState;
    'ag-grid'?: AgGridDemoState;
    // ...
  };
}

interface CodePlaygroundDemoState {
  files: Record<string, string>; // filename -> content
  activeFile: string;
  terminalOutput: string;
  terminalCwd: string;
}

interface JupyterDemoState {
  cells: Array<{
    type: 'code' | 'markdown';
    source: string;
    outputs: Array<{ type: string; data: unknown }>;
    executionCount?: number;
  }>;
  activeCellIndex: number;
}
```

---

## 🔧 Implementation Plan

### Phase 1: Event Bus Infrastructure
**Files to create/modify:**
- `src/app/workspace/lib/componentEventBus.ts` - Event bus implementation
- `src/app/workspace/stores/workspaceStore.ts` - Add event subscription
- `src/app/workspace/types.ts` - Add event types

### Phase 2: Component Instrumentation
**Modify each component to emit events:**

#### PDF Reader
```typescript
// In PDFReaderContent.tsx
useEffect(() => {
  if (document && pagesLoaded) {
    componentEventBus.emit({
      component: 'pdf-reader',
      type: 'contentLoaded',
      payload: { documentId, totalPages },
      timestamp: Date.now(),
    });
  }
}, [document, pagesLoaded]);

// When AI chat responds
const onAIResponse = (response) => {
  componentEventBus.emit({
    component: 'pdf-reader',
    type: 'actionComplete',
    payload: { action: 'ai_chat', result: response },
    timestamp: Date.now(),
  });
};
```

#### Code Playground
```typescript
// When terminal outputs
const onTerminalOutput = (output) => {
  componentEventBus.emit({
    component: 'code-playground',
    type: 'actionComplete',
    payload: { action: 'terminal_output', result: output },
    timestamp: Date.now(),
  });
};

// When code execution finishes
const onExecutionComplete = (exitCode) => {
  componentEventBus.emit({
    component: 'code-playground',
    type: 'actionComplete',
    payload: { action: 'execute_code', result: { exitCode } },
    timestamp: Date.now(),
  });
};
```

#### Jupyter Notebook
```typescript
// When cell execution completes
const onCellExecuted = (cellIndex, outputs) => {
  componentEventBus.emit({
    component: 'jupyter-notebook',
    type: 'actionComplete',
    payload: { action: 'execute_cell', result: { cellIndex, outputs } },
    timestamp: Date.now(),
  });
};
```

### Phase 3: Action Executor
**Files to create:**
- `src/app/workspace/lib/actionExecutor.ts` - Awaitable action execution
- `src/app/workspace/lib/componentActions.ts` - Action dispatchers per component

### Phase 4: Demo Flow Controller
**Files to modify:**
- `src/app/workspace/mock/vlaResearchDemo.ts` - Use new step format
- `src/app/workspace/components/WorkspaceView.tsx` - Use event-driven flow

### Phase 5: State Capture & Restore
**Files to create/modify:**
- `src/app/workspace/lib/stateCapture.ts` - Deep state capture
- Each component: Add `captureState()` and `restoreState()` methods

---

## 📋 Specific Step Requirements

### Step 1: Paper Analysis
```typescript
const step1: EnhancedDemoStep = {
  id: 'step-1',
  title: 'Paper Loading & AI Analysis',
  actions: [
    {
      id: 'action-1-1',
      type: 'load_document',
      target: 'pdf-reader',
      params: { documentId: 'library/vla-rail.pdf' },
      completionEvent: { type: 'contentLoaded' },
    },
    {
      id: 'action-1-2',
      type: 'send_chat',
      target: 'pdf-reader',
      params: { 
        message: 'What are the key innovations of this VLA-RAIL paper?' 
      },
      completionEvent: { 
        type: 'actionComplete', 
        action: 'ai_chat',
        validate: (e) => e.payload?.result?.length > 0
      },
      timeout: 60000, // AI might take time
    },
  ],
  transition: { type: 'auto', autoDelay: 2000 },
};
```

### Step 2-3: Benchmark Execution
```typescript
const step2: EnhancedDemoStep = {
  id: 'step-2',
  title: 'Benchmark Code Setup',
  actions: [
    {
      id: 'action-2-1',
      type: 'switch_component',
      target: 'code-playground',
      params: {},
      completionEvent: { type: 'ready' },
    },
    {
      id: 'action-2-2',
      type: 'load_code',
      target: 'code-playground',
      params: { 
        files: { 'benchmark.py': BENCHMARK_CODE },
        activeFile: 'benchmark.py'
      },
      completionEvent: { type: 'contentLoaded' },
    },
    {
      id: 'action-2-3',
      type: 'execute_code',
      target: 'code-playground',
      params: { command: 'python benchmark.py' },
      completionEvent: { 
        type: 'actionComplete', 
        action: 'execute_code',
        validate: (e) => e.payload?.result?.exitCode === 0
      },
      timeout: 120000, // Benchmark might take time
    },
  ],
  transition: { type: 'auto', autoDelay: 1000 },
};
```

### Step 4: Data Display
```typescript
const step4: EnhancedDemoStep = {
  id: 'step-4',
  title: 'Results Display',
  actions: [
    {
      id: 'action-4-1',
      type: 'switch_component',
      target: 'ag-grid',
      params: {},
      completionEvent: { type: 'ready' },
    },
    {
      id: 'action-4-2',
      type: 'load_data',
      target: 'ag-grid',
      params: { data: BENCHMARK_RESULTS },
      completionEvent: { type: 'contentLoaded' },
    },
  ],
  transition: {
    type: 'interaction',
    interactionTrigger: {
      componentId: 'step4-actions',
      actionId: 'visualize',
    },
  },
};
```

### Step 5: Visualization
```typescript
const step5: EnhancedDemoStep = {
  id: 'step-5',
  title: 'Generate Visualization',
  actions: [
    {
      id: 'action-5-1',
      type: 'switch_component',
      target: 'jupyter-notebook',
      params: {},
      completionEvent: { type: 'ready' },
    },
    {
      id: 'action-5-2',
      type: 'add_cell',
      target: 'jupyter-notebook',
      params: { 
        type: 'code',
        source: VISUALIZATION_CODE 
      },
      completionEvent: { type: 'contentLoaded' },
    },
    {
      id: 'action-5-3',
      type: 'run_cell',
      target: 'jupyter-notebook',
      params: { cellIndex: 0 },
      completionEvent: { 
        type: 'actionComplete', 
        action: 'execute_cell',
        validate: (e) => {
          // Check that output contains an image
          const outputs = e.payload?.result?.outputs || [];
          return outputs.some(o => o.type === 'display_data');
        }
      },
      timeout: 60000,
    },
  ],
  transition: { type: 'auto', autoDelay: 2000 },
};
```

### Step 6: Paper Writing
```typescript
const step6: EnhancedDemoStep = {
  id: 'step-6',
  title: 'Write Paper Section',
  actions: [
    {
      id: 'action-6-1',
      type: 'switch_component',
      target: 'latex-editor',
      params: {},
      completionEvent: { type: 'ready' },
    },
    {
      id: 'action-6-2',
      type: 'update_content',
      target: 'latex-editor',
      params: { 
        file: 'experiment.tex',
        content: EXPERIMENT_SECTION_LATEX 
      },
      completionEvent: { type: 'contentLoaded' },
    },
    {
      id: 'action-6-3',
      type: 'compile_latex',
      target: 'latex-editor',
      params: {},
      completionEvent: { 
        type: 'actionComplete', 
        action: 'compile',
        validate: (e) => !e.payload?.result?.errors?.length
      },
      timeout: 30000,
    },
  ],
  transition: { type: 'auto', autoDelay: 2000 },
};
```

---

## 🎯 Timeline Scrubbing

For timeline to work properly:

1. **Capture state after each step**
```typescript
// In demo flow controller
afterStepComplete(stepIndex) {
  const snapshot = captureDeepState();
  this.stepSnapshots[stepIndex] = snapshot;
  addTimelineEvent({
    ...event,
    stateSnapshot: snapshot,
  });
}
```

2. **Restore on seek**
```typescript
handleSeek(position) {
  const targetStep = findStepForPosition(position);
  const snapshot = this.stepSnapshots[targetStep];
  if (snapshot) {
    await restoreDeepState(snapshot);
  }
}
```

3. **Components implement restore**
```typescript
// In Code Playground
restoreState(state: CodePlaygroundDemoState) {
  // Restore files
  for (const [filename, content] of Object.entries(state.files)) {
    this.setFileContent(filename, content);
  }
  // Restore terminal output
  this.setTerminalOutput(state.terminalOutput);
  // Restore active file
  this.setActiveFile(state.activeFile);
}
```

---

## 📊 Priority & Effort Estimate

| Phase | Priority | Effort | Description |
|-------|----------|--------|-------------|
| 1. Event Bus | P0 | 2h | Foundation for everything |
| 2. PDF Reader instrumentation | P0 | 3h | Most critical for step 1 |
| 3. Code Playground instrumentation | P0 | 4h | Critical for benchmark |
| 4. Jupyter instrumentation | P1 | 4h | For visualization |
| 5. LaTeX Editor instrumentation | P1 | 3h | For paper writing |
| 6. Action Executor | P0 | 3h | Ties it all together |
| 7. Demo Flow refactor | P0 | 4h | Use new architecture |
| 8. Deep State Capture | P1 | 4h | For timeline |
| 9. Timeline Restore | P1 | 4h | For timeline scrubbing |

**Total: ~31 hours**

---

## 🚀 Quick Win Alternative

If full implementation is too much, a simpler approach:

1. **Use callbacks instead of events**
```typescript
// Pass completion callback to components
<PDFReader 
  onDocumentLoaded={(doc) => demoFlow.notifyComplete('pdf-loaded')}
  onAIResponse={(response) => demoFlow.notifyComplete('ai-responded')}
/>
```

2. **Simple promise-based waiting**
```typescript
async loadPDFAndWait() {
  executeDirective({ type: 'load_document', ... });
  await this.waitForCallback('pdf-loaded', 10000);
  // Now we know PDF is loaded
}
```

This is less elegant but achieves the core goal of waiting for real completion.
