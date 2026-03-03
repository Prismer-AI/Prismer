"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";

import { createEditorEventEmitter } from "@/lib/events";

const emitEvent = createEditorEventEmitter('code-playground');
import Editor, { OnMount } from "@monaco-editor/react";
import {
  Play,
  Square,
  RotateCcw,
  Terminal,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  PanelBottomClose,
  PanelBottomOpen,
  Columns,
  Rows,
  Maximize2,
  Download,
  Upload,
  Eye,
  Code2,
} from "lucide-react";
import { FileTree, buildFileTree } from "./FileTree";
import { useMultiFieldContentSync } from "@/lib/sync/useContentSync";
import { useWebContainer, statusLabels } from "./useWebContainer";
import { getTemplate, getDefaultFile, isFrontendTemplate } from "./templates";
import { ScriptTerminal, type ScriptTerminalHandle } from "./ScriptTerminal";
import type {
  CodePlaygroundProps,
  CodePlaygroundHandle,
  FilesMap,
  TemplateType,
  LayoutMode,
  PlaygroundMode,
} from "./types";

// ============================================================
// CodePlayground Component
// ============================================================

const CodePlayground = forwardRef<CodePlaygroundHandle, CodePlaygroundProps>(
  (
    {
      mode: initialMode,
      template: initialTemplate = "react",
      initialFiles,
      layout: initialLayout = "horizontal",
      panels,
      theme: initialTheme = "vs",
      autoStart = false,
      readOnly = false,
      hideToolbar = false,
      className = "",
      callbacks,
      agentInstanceId,
    },
    ref
  ) => {
    // Determine initial mode based on template if not explicitly set
    const derivedMode: PlaygroundMode = initialMode ??
      (isFrontendTemplate(initialTemplate) ? 'frontend' : 'script');

    // Mode state (now user-switchable)
    const [effectiveMode, setEffectiveMode] = useState<PlaygroundMode>(derivedMode);

    // State
    const [template, setTemplate] = useState<TemplateType>(initialTemplate);
    const [files, setFiles] = useState<FilesMap>(
      initialFiles || getTemplate(initialTemplate)
    );
    const [selectedFile, setSelectedFile] = useState<string>(
      getDefaultFile(initialTemplate)
    );
    const [layout, setLayout] = useState<LayoutMode>(initialLayout);
    const [showFileTree, setShowFileTree] = useState(panels?.showFileTree ?? true);
    const [showTerminal, setShowTerminal] = useState(panels?.showTerminal ?? true);

    // WebContainer hook (only used in frontend mode)
    const webContainer = useWebContainer({ callbacks });

    // Refs
    const terminalRef = useRef<HTMLDivElement>(null);
    const scriptTerminalRef = useRef<ScriptTerminalHandle>(null);
    const filesRef = useRef<FilesMap>(files);
    const selectedFileRef = useRef<string>(selectedFile);

    // Keep refs in sync with state
    useEffect(() => { filesRef.current = files; }, [files]);
    useEffect(() => { selectedFileRef.current = selectedFile; }, [selectedFile]);

    // Debounced content sync to componentStore
    const syncCodeState = useMultiFieldContentSync('code-playground', 1000);
    useEffect(() => {
      syncCodeState({ selectedFile, mode: effectiveMode, template });
    }, [selectedFile, effectiveMode, template, syncCodeState]);

    // Build file tree from files
    const fileTree = useMemo(() => buildFileTree(files), [files]);

    // Auto scroll terminal
    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, [webContainer.logs]);

    // Emit 'ready' event on mount
    useEffect(() => {
      emitEvent({ type: 'ready' });
    }, []);

    // Stream code into editor in chunks (reduces flickering)
    const streamCodeIntoFile = useCallback(async (filename: string, content: string): Promise<void> => {
      setSelectedFile(filename);
      
      const lines = content.split('\n');
      const CHUNK_SIZE = 8; // Lines per chunk
      const CHUNK_DELAY = 50; // ms between chunks
      
      // Initialize empty file
      setFiles(prev => ({
        ...prev,
        [filename]: { ...prev[filename], content: '' }
      }));
      
      await new Promise(r => setTimeout(r, 30)); // Small delay for initial render
      
      // Stream in chunks
      for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
        const chunk = lines.slice(0, i + CHUNK_SIZE).join('\n');
        
        setFiles(prev => ({
          ...prev,
          [filename]: { ...prev[filename], content: chunk }
        }));
        
        // Only delay if not the last chunk
        if (i + CHUNK_SIZE < lines.length) {
          await new Promise(r => setTimeout(r, CHUNK_DELAY));
        }
      }
      
      // Final update with complete content
      setFiles(prev => ({
        ...prev,
        [filename]: { ...prev[filename], content }
      }));
      
      // Small delay to ensure React renders
      await new Promise(r => setTimeout(r, 50));
    }, []);

    // Listen for demo commands
    useEffect(() => {
      const handleLoadCode = async (e: CustomEvent<{ files: FilesMap; activeFile: string; stream?: boolean }>) => {
        const { files: newFiles, activeFile, stream = true } = e.detail;
        
        console.log('[CodePlayground] Loading code:', activeFile, 'stream:', stream);
        
        if (stream && newFiles[activeFile]) {
          // Set all files except the active one immediately
          const otherFiles: FilesMap = {};
          for (const [name, file] of Object.entries(newFiles)) {
            if (name !== activeFile) {
              otherFiles[name] = file;
            } else {
              otherFiles[name] = { ...file, content: '' }; // Empty the active file initially
            }
          }
          setFiles(otherFiles);
          setSelectedFile(activeFile);
          
          // Stream the active file's code
          await streamCodeIntoFile(activeFile, newFiles[activeFile].content);
          
          // Final update with complete files
          setFiles(newFiles);
          filesRef.current = newFiles;
        } else {
          // No streaming - set all at once
          setFiles(newFiles);
          setSelectedFile(activeFile);
          filesRef.current = newFiles;
        }
        
        callbacks?.onFilesChange?.(newFiles);
        
        console.log('[CodePlayground] Code loaded, emitting contentLoaded');
        
        // Emit content loaded event
        emitEvent({
          type: 'contentLoaded',
          payload: { action: 'load_code', result: { files: Object.keys(newFiles), activeFile } },
        });
      };

      const handleExecuteCode = async (e: CustomEvent<{ command: string }>) => {
        const { command } = e.detail;
        
        // In script mode, use ScriptTerminal
        if (effectiveMode === 'script') {
          // Use ref to get latest files state (avoid closure issues)
          const currentFiles = filesRef.current;
          const currentSelectedFile = selectedFileRef.current;
          const scriptContent = currentFiles[currentSelectedFile]?.content || '';
          
          console.log('[CodePlayground] Executing script:', command, 'File:', currentSelectedFile);
          
          try {
            await scriptTerminalRef.current?.executeCommand(command, scriptContent);
            
            // Emit execution complete event
            emitEvent({
              type: 'actionComplete',
              payload: { action: 'execute_code', result: { command, status: 'success' } },
            });
          } catch (err) {
            emitEvent({
              type: 'actionFailed',
              payload: { action: 'execute_code', error: err instanceof Error ? err : new Error(String(err)) },
            });
          }
          return;
        }
        
        // In frontend mode, use WebContainer
        webContainer.addLog(`$ ${command}`);
        
        // Start the container if not already running
        if (webContainer.status === 'idle') {
          webContainer.start(files);
        }
        
        // For demo purposes: simulate code execution with terminal output
        // In a real scenario, we'd run the actual command in WebContainer
        try {
          // Wait for container to be ready if booting
          if (webContainer.status === 'booting' || webContainer.status === 'installing') {
            await new Promise<void>((resolve) => {
              const checkStatus = setInterval(() => {
                if (webContainer.status === 'ready') {
                  clearInterval(checkStatus);
                  resolve();
                }
              }, 500);
              // Timeout after 30 seconds
              setTimeout(() => {
                clearInterval(checkStatus);
                resolve();
              }, 30000);
            });
          }
          
          // Emit execution complete event
          emitEvent({
            type: 'actionComplete',
            payload: { action: 'execute_code', result: { command, status: 'success' } },
          });
        } catch (err) {
          emitEvent({
            type: 'actionFailed',
            payload: { action: 'execute_code', error: err instanceof Error ? err : new Error(String(err)) },
          });
        }
      };

      // Handle agent directive: UPDATE_CODE
      // Supports two formats:
      //   1. { files: FilesMap, selectedFile?: string } — from syncActions / directive stream
      //   2. { code: string, filename?: string }        — legacy direct dispatch
      const handleAgentUpdateCode = async (e: CustomEvent<Record<string, unknown>>) => {
        const detail = e.detail;
        let newFiles: FilesMap;
        let selected: string;

        if (detail.files && typeof detail.files === 'object') {
          // Format 1: FilesMap
          newFiles = detail.files as FilesMap;
          selected = (detail.selectedFile as string) || Object.keys(newFiles)[0] || 'main.py';
        } else {
          // Format 2: single code string
          const code = (detail.code as string) || '';
          selected = (detail.filename as string) || 'main.py';
          newFiles = { [selected]: { content: code, language: 'python' } };
        }

        console.log('[CodePlayground] Agent UPDATE_CODE:', selected);
        const codeContent = newFiles[selected]?.content || '';
        await streamCodeIntoFile(selected, codeContent);
        setFiles(newFiles);
        setSelectedFile(selected);
        filesRef.current = newFiles;

        emitEvent({
          type: 'contentLoaded',
          payload: { action: 'update_code', result: { filename: selected } },
        });
      };
      
      // Handle agent directive: TERMINAL_OUTPUT
      const handleAgentTerminalOutput = (e: CustomEvent<{ line: string; append?: boolean }>) => {
        const { line } = e.detail;
        console.log('[CodePlayground] Agent TERMINAL_OUTPUT:', line);
        
        // Add to script terminal if in script mode
        if (scriptTerminalRef.current) {
          scriptTerminalRef.current.addLog(line);
        }
      };
      
      // Handle agent directive: execute-code
      const handleAgentExecuteCode = async (e: CustomEvent<{ command?: string }>) => {
        const { command = 'python main.py' } = e.detail || {};
        console.log('[CodePlayground] Agent execute-code:', command);
        
        if (scriptTerminalRef.current) {
          const currentFiles = filesRef.current;
          const currentSelectedFile = selectedFileRef.current;
          const scriptContent = currentFiles[currentSelectedFile]?.content || '';
          await scriptTerminalRef.current.executeCommand(command, scriptContent);
        }
      };

      window.addEventListener('demo:loadCode', handleLoadCode as unknown as EventListener);
      window.addEventListener('demo:executeCode', handleExecuteCode as unknown as EventListener);
      window.addEventListener('agent:directive:UPDATE_CODE', handleAgentUpdateCode as unknown as EventListener);
      window.addEventListener('agent:directive:TERMINAL_OUTPUT', handleAgentTerminalOutput as unknown as EventListener);
      window.addEventListener('agent:execute-code', handleAgentExecuteCode as unknown as EventListener);

      return () => {
        window.removeEventListener('demo:loadCode', handleLoadCode as unknown as EventListener);
        window.removeEventListener('demo:executeCode', handleExecuteCode as unknown as EventListener);
        window.removeEventListener('agent:directive:UPDATE_CODE', handleAgentUpdateCode as unknown as EventListener);
        window.removeEventListener('agent:directive:TERMINAL_OUTPUT', handleAgentTerminalOutput as unknown as EventListener);
        window.removeEventListener('agent:execute-code', handleAgentExecuteCode as unknown as EventListener);
      };
    }, [files, webContainer, callbacks, effectiveMode, selectedFile, streamCodeIntoFile]);

    // Auto start
    useEffect(() => {
      if (autoStart && webContainer.status === "idle") {
        webContainer.start(files);
      }
    }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle template change
    const handleTemplateChange = useCallback(
      (newTemplate: TemplateType) => {
        if (newTemplate === "custom") return;
        setTemplate(newTemplate);
        const newFiles = getTemplate(newTemplate);
        setFiles(newFiles);
        setSelectedFile(getDefaultFile(newTemplate));
        webContainer.stop();
        callbacks?.onFilesChange?.(newFiles);
      },
      [webContainer, callbacks]
    );

    // Handle mode switch (Script ↔ Project)
    const handleModeSwitch = useCallback(
      (newMode: PlaygroundMode) => {
        if (newMode === effectiveMode) return;
        setEffectiveMode(newMode);
        // Load default template for the new mode
        const newTemplate: TemplateType = newMode === 'script' ? 'python' : 'react';
        setTemplate(newTemplate);
        const newFiles = getTemplate(newTemplate);
        setFiles(newFiles);
        setSelectedFile(getDefaultFile(newTemplate));
        webContainer.stop();
        callbacks?.onFilesChange?.(newFiles);
      },
      [effectiveMode, webContainer, callbacks]
    );

    // Handle file content change
    const handleFileChange = useCallback(
      (value: string | undefined) => {
        if (value !== undefined && selectedFile && !readOnly) {
          setFiles((prev) => {
            const newFiles = {
              ...prev,
              [selectedFile]: {
                ...prev[selectedFile],
                content: value,
              },
            };
            callbacks?.onFilesChange?.(newFiles);
            return newFiles;
          });
        }
      },
      [selectedFile, readOnly, callbacks]
    );

    // Handle file selection
    const handleFileSelect = useCallback(
      (path: string) => {
        setSelectedFile(path);
        callbacks?.onFileSelect?.(path);
      },
      [callbacks]
    );

    // Start container
    const handleStart = useCallback(() => {
      webContainer.start(files);
    }, [webContainer, files]);

    // Export files
    const handleExport = useCallback(() => {
      const data = JSON.stringify(files, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template}-project.json`;
      a.click();
      URL.revokeObjectURL(url);
    }, [files, template]);

    // Import files
    const handleImport = useCallback(() => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const imported = JSON.parse(e.target?.result as string) as FilesMap;
              setFiles(imported);
              setTemplate("custom");
              const firstFile = Object.keys(imported)[0];
              if (firstFile) setSelectedFile(firstFile);
              callbacks?.onFilesChange?.(imported);
            } catch (err) {
              console.error("Failed to import files:", err);
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }, [callbacks]);

    // Monaco editor mount handler
    const handleEditorMount: OnMount = (editor, monaco) => {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
      });
    };

    // Imperative handle
    useImperativeHandle(
      ref,
      () => ({
        getFiles: () => files,
        setFiles: (newFiles) => {
          setFiles(newFiles);
          setTemplate("custom");
          callbacks?.onFilesChange?.(newFiles);
        },
        getFileContent: (path) => files[path]?.content,
        updateFile: (path, content) => {
          setFiles((prev) => {
            const newFiles = {
              ...prev,
              [path]: { ...prev[path], content },
            };
            callbacks?.onFilesChange?.(newFiles);
            return newFiles;
          });
        },
        start: () => webContainer.start(files),
        stop: () => webContainer.stop(),
        restart: () => webContainer.restart(files),
        getStatus: () => webContainer.status,
        getPreviewUrl: () => webContainer.previewUrl,
        exportFiles: () => JSON.stringify(files, null, 2),
        importFiles: (json) => {
          const imported = JSON.parse(json) as FilesMap;
          setFiles(imported);
          setTemplate("custom");
          callbacks?.onFilesChange?.(imported);
        },
      }),
      [files, webContainer, callbacks]
    );

    // Get current file data
    const currentFile = files[selectedFile];

    // Layout classes
    const getMainLayoutClass = () => {
      switch (layout) {
        case "horizontal":
          return "flex-row";
        case "vertical":
          return "flex-col";
        default:
          return "flex-row";
      }
    };

    return (
      <div
        className={`flex flex-col h-full min-h-0 overflow-hidden bg-white ${className}`}
      >
        {/* Top Toolbar */}
        {!hideToolbar && (
          <div className="flex items-center justify-between h-10 px-3 py-2 bg-white border-b border-stone-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Mode Toggle */}
              <div className="flex items-center bg-stone-100 rounded-md p-0.5 text-xs">
                <button
                  onClick={() => handleModeSwitch('script')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    effectiveMode === 'script'
                      ? 'bg-white shadow-sm text-indigo-600 font-medium'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Script
                </button>
                <button
                  onClick={() => handleModeSwitch('frontend')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    effectiveMode === 'frontend'
                      ? 'bg-white shadow-sm text-indigo-600 font-medium'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Project
                </button>
              </div>

              {/* Template Selector */}
              <select
                value={template}
                onChange={(e) =>
                  handleTemplateChange(e.target.value as TemplateType)
                }
                disabled={effectiveMode === 'frontend' && webContainer.isRunning}
                className="bg-stone-100 text-stone-800 text-sm rounded-lg px-3 py-1.5 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {effectiveMode === 'script' ? (
                  // Script mode templates
                  <>
                    <option value="python">Python</option>
                    <option value="node">Node.js</option>
                  </>
                ) : (
                  // Frontend mode templates
                  <>
                    <option value="react">React</option>
                    <option value="vue">Vue</option>
                    <option value="vanilla">Vanilla JS</option>
                  </>
                )}
                {template === "custom" && <option value="custom">Custom</option>}
              </select>

              {/* Status - only show for frontend mode */}
              {effectiveMode === 'frontend' && (
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      webContainer.status === "ready"
                        ? "bg-emerald-400 animate-pulse"
                        : webContainer.status === "error"
                          ? "bg-red-400"
                          : webContainer.status === "idle"
                            ? "bg-stone-400"
                            : "bg-amber-400 animate-pulse"
                    }`}
                  />
                  <span className="text-xs text-stone-500">
                    {statusLabels[webContainer.status]}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Layout Controls */}
              <div className="flex items-center gap-0.5 mr-2 p-1 bg-stone-100 rounded-lg">
                <button
                  onClick={() => setLayout("horizontal")}
                  className={`p-1.5 rounded ${
                    layout === "horizontal"
                      ? "bg-indigo-600 text-white"
                      : "text-stone-600 hover:text-stone-800"
                  }`}
                  title="Side by side"
                >
                  <Columns className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLayout("vertical")}
                  className={`p-1.5 rounded ${
                    layout === "vertical"
                      ? "bg-indigo-600 text-white"
                      : "text-stone-600 hover:text-stone-800"
                  }`}
                  title="Top and bottom"
                >
                  <Rows className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLayout("editor-only")}
                  className={`p-1.5 rounded ${
                    layout === "editor-only"
                      ? "bg-indigo-600 text-white"
                      : "text-stone-600 hover:text-stone-800"
                  }`}
                  title="Editor only"
                >
                  <Code2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setLayout("preview-only")}
                  className={`p-1.5 rounded ${
                    layout === "preview-only"
                      ? "bg-indigo-600 text-white"
                      : "text-stone-600 hover:text-stone-800"
                  }`}
                  title="Preview only"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>

              {/* Panel Toggles */}
              <button
                onClick={() => setShowFileTree(!showFileTree)}
                className={`p-1.5 rounded ${
                  showFileTree ? "text-indigo-600" : "text-stone-600"
                } hover:bg-stone-200/60`}
                title="Toggle file tree"
              >
                {showFileTree ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setShowTerminal(!showTerminal)}
                className={`p-1.5 rounded ${
                  showTerminal ? "text-indigo-600" : "text-stone-600"
                } hover:bg-stone-200/60`}
                title="Toggle terminal"
              >
                {showTerminal ? (
                  <PanelBottomClose className="h-4 w-4" />
                ) : (
                  <PanelBottomOpen className="h-4 w-4" />
                )}
              </button>

              {/* Import/Export */}
              <button
                onClick={handleImport}
                className="p-1.5 rounded text-stone-600 hover:bg-stone-200/60 hover:text-stone-800"
                title="Import project"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                onClick={handleExport}
                className="p-1.5 rounded text-stone-600 hover:bg-stone-200/60 hover:text-stone-800"
                title="Export project"
              >
                <Download className="h-4 w-4" />
              </button>

              <div className="w-px h-5 bg-stone-200 mx-1" />

              {/* Run Controls */}
              {effectiveMode === 'script' ? (
                // Script mode: Simple run button
                <button
                  onClick={() => {
                    const mainFile = selectedFile || 'main.py';
                    const ext = mainFile.split('.').pop();
                    const cmd = ext === 'py' ? `python ${mainFile}` : `node ${mainFile}`;
                    const script = files[mainFile]?.content || '';
                    scriptTerminalRef.current?.executeCommand(cmd, script);
                  }}
                  disabled={scriptTerminalRef.current?.isRunning()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  Run Script
                </button>
              ) : (
                // Frontend mode: WebContainer controls
                !webContainer.isRunning ? (
                  <button
                    onClick={handleStart}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Play className="h-4 w-4" />
                    Run
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => webContainer.restart(files)}
                      disabled={webContainer.status !== "ready"}
                      className="p-1.5 rounded text-stone-600 hover:bg-stone-200/60 hover:text-stone-800 disabled:opacity-50"
                      title="Restart"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => webContainer.stop()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </button>
                  </>
                )
              )}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* File Tree Sidebar */}
          {showFileTree && (
            <div className="w-56 flex-shrink-0 bg-stone-50 border-r border-stone-200">
              <FileTree
                files={fileTree}
                selectedFile={selectedFile}
                onSelectFile={handleFileSelect}
              />
            </div>
          )}

          {/* Editor + Preview Area */}
          <div
            className={`flex flex-1 min-h-0 ${getMainLayoutClass()} overflow-hidden`}
          >
            {/* Editor Panel */}
            {layout !== "preview-only" && (
              <div
                className={`flex flex-col min-h-0 ${
                  // In script mode, editor takes full width
                  effectiveMode === 'script' || layout === "editor-only"
                    ? "flex-1"
                    : layout === "vertical"
                      ? "flex-1"
                      : "w-1/2"
                } min-w-0`}
              >
                {/* Editor Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-stone-50 border-b border-stone-200 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-stone-800 font-mono truncate">
                      {selectedFile || "No file selected"}
                    </span>
                    {readOnly && (
                      <span className="text-xs px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded">
                        Read-only
                      </span>
                    )}
                  </div>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1 min-h-0">
                  {currentFile ? (
                    <Editor
                      height="100%"
                      language={currentFile.language}
                      value={currentFile.content}
                      theme={initialTheme === "vs-dark" ? "vs-dark" : "vs"}
                      onChange={handleFileChange}
                      onMount={handleEditorMount}
                      options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        lineNumbers: "on",
                        renderLineHighlight: "all",
                        padding: { top: 12, bottom: 12 },
                        automaticLayout: true,
                        bracketPairColorization: { enabled: true },
                        readOnly,
                      }}
                      loading={
                        <div className="flex items-center justify-center h-full bg-stone-50">
                          <div className="flex items-center gap-2 text-stone-500">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-indigo-500" />
                            Loading editor...
                          </div>
                        </div>
                      }
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-stone-500">
                      Select a file to edit
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview Panel - Only shown in frontend mode */}
            {effectiveMode === 'frontend' && layout !== "editor-only" && (
              <div
                className={`flex flex-col min-h-0 ${
                  layout === "preview-only"
                    ? "flex-1 w-full"
                    : layout === "vertical"
                      ? "flex-1"
                      : "w-1/2"
                } min-w-0 ${layout !== "preview-only" ? "border-l border-stone-200" : ""}`}
              >
                {/* Preview Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-stone-50 border-b border-stone-200 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-stone-600" />
                    <span className="text-sm text-stone-800">Preview</span>
                  </div>
                  {webContainer.previewUrl && (
                    <span className="text-xs text-stone-500 font-mono truncate max-w-48">
                      {webContainer.previewUrl}
                    </span>
                  )}
                </div>

                {/* Preview Content */}
                <div className="flex-1 min-h-0 bg-white">
                  {webContainer.error ? (
                    <div className="h-full flex items-center justify-center bg-stone-50">
                      <div className="text-center max-w-sm p-4">
                        <div className="text-4xl mb-3">⚠️</div>
                        <h3 className="text-red-400 font-medium mb-2">Error</h3>
                        <p className="text-sm text-stone-500">
                          {webContainer.error}
                        </p>
                      </div>
                    </div>
                  ) : webContainer.previewUrl ? (
                    <iframe
                      src={webContainer.previewUrl}
                      className="w-full h-full border-0"
                      title="Preview"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center bg-stone-50">
                      <div className="text-center">
                        <div className="text-4xl mb-3">🚀</div>
                        <p className="text-stone-500 text-sm">
                          {webContainer.status === "idle"
                            ? 'Click "Run" to start'
                            : "Starting..."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Terminal Panel */}
        {showTerminal && (
          effectiveMode === 'script' ? (
            // Script mode: Use ScriptTerminal
            <div className="h-48 flex-shrink-0 border-t border-stone-200">
              <ScriptTerminal
                ref={scriptTerminalRef}
                title="Script Output"
                className="h-full"
                agentInstanceId={agentInstanceId}
                onExecutionComplete={(success) => {
                  if (success) {
                    emitEvent({
                      type: 'actionComplete',
                      payload: { action: 'script_execution', status: 'success' },
                    });
                  }
                }}
              />
            </div>
          ) : (
            // Frontend mode: Use WebContainer terminal
            <div className="h-36 flex-shrink-0 border-t border-stone-200 flex flex-col">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 border-b border-stone-200">
                <Terminal className="h-4 w-4 text-stone-600" />
                <span className="text-sm text-stone-700">Terminal</span>
                <button
                  onClick={() => webContainer.clearLogs()}
                  className="ml-auto text-xs text-stone-500 hover:text-stone-700"
                >
                  Clear
                </button>
              </div>
              <div
                ref={terminalRef}
                className="flex-1 overflow-auto p-2 font-mono text-xs text-slate-300 bg-slate-950"
              >
                {webContainer.logs.length === 0 ? (
                  <div className="text-slate-500">
                    Terminal output will appear here...
                  </div>
                ) : (
                  webContainer.logs.map((log, i) => (
                    <div
                      key={i}
                      className="whitespace-pre-wrap break-all leading-relaxed"
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        )}
      </div>
    );
  }
);

CodePlayground.displayName = "CodePlayground";

export default CodePlayground;
