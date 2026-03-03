"use client";

import { useState, useCallback, useEffect } from "react";
import Editor, { OnMount, loader } from "@monaco-editor/react";
import {
  FileCode,
  FileJson,
  FileType,
  Sun,
  Moon,
  Copy,
  Check,
  Download,
  Plus,
  X,
} from "lucide-react";
import type { ComponentPreviewProps } from "@/components/playground/registry";

// ============================================================
// Types
// ============================================================

interface FileData {
  language: string;
  content: string;
}

type Files = Record<string, FileData>;

// ============================================================
// Sample Files
// ============================================================

const defaultFiles: Files = {
  "App.tsx": {
    language: "typescript",
    content: `import React, { useState } from 'react';

interface CounterProps {
  initialValue?: number;
}

export const Counter: React.FC<CounterProps> = ({ 
  initialValue = 0 
}) => {
  const [count, setCount] = useState(initialValue);

  return (
    <div className="counter">
      <h2>Counter: {count}</h2>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(c => c - 1)}>
        Decrement
      </button>
    </div>
  );
};

export default Counter;
`,
  },
  "styles.css": {
    language: "css",
    content: `/* Modern CSS with custom properties */
:root {
  --primary-color: #6366f1;
  --secondary-color: #8b5cf6;
  --background: #0f172a;
  --surface: #1e293b;
  --text: #f1f5f9;
}

.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: var(--surface);
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.counter h2 {
  font-size: 2rem;
  color: var(--text);
}

.counter button {
  padding: 0.75rem 1.5rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.counter button:hover {
  background: var(--secondary-color);
}
`,
  },
  "utils.ts": {
    language: "typescript",
    content: `/**
 * Utility functions for the application
 */

// Debounce function with TypeScript generics
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Type-safe deep clone
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Format date with Intl
export function formatDate(
  date: Date, 
  locale: string = 'en-US'
): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
`,
  },
  "config.json": {
    language: "json",
    content: `{
  "name": "monaco-playground",
  "version": "1.0.0",
  "settings": {
    "theme": "dark",
    "fontSize": 14,
    "tabSize": 2,
    "autoSave": true,
    "formatOnSave": true
  },
  "features": {
    "syntaxHighlighting": true,
    "intelliSense": true,
    "minimap": true,
    "lineNumbers": true
  },
  "languages": [
    "typescript",
    "javascript",
    "css",
    "json",
    "html"
  ]
}
`,
  },
  "index.html": {
    language: "html",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monaco Playground</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>Welcome to Monaco Editor</h1>
      <p>A powerful code editor in your browser</p>
    </header>
    
    <main>
      <section class="features">
        <article>
          <h2>Syntax Highlighting</h2>
          <p>Beautiful code colorization for 100+ languages</p>
        </article>
        <article>
          <h2>IntelliSense</h2>
          <p>Smart completions based on variable types</p>
        </article>
      </section>
    </main>
    
    <footer>
      <p>&copy; 2025 Monaco Playground</p>
    </footer>
  </div>
  
  <script type="module" src="main.js"></script>
</body>
</html>
`,
  },
};

// ============================================================
// File Icon Helper
// ============================================================

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return <FileCode className="h-4 w-4 text-blue-400" />;
    case "js":
    case "jsx":
      return <FileCode className="h-4 w-4 text-yellow-400" />;
    case "json":
      return <FileJson className="h-4 w-4 text-amber-400" />;
    case "css":
    case "scss":
      return <FileType className="h-4 w-4 text-pink-400" />;
    case "html":
      return <FileType className="h-4 w-4 text-orange-400" />;
    default:
      return <FileCode className="h-4 w-4 text-slate-400" />;
  }
}

// ============================================================
// Component
// ============================================================

export default function MonacoEditorPreview({ onOutput }: ComponentPreviewProps) {
  const [files, setFiles] = useState<Files>(defaultFiles);
  const [activeFile, setActiveFile] = useState<string>("App.tsx");
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [minimap, setMinimap] = useState(true);

  // Report current state to parent
  useEffect(() => {
    if (onOutput) {
      onOutput({
        activeFile,
        content: files[activeFile]?.content,
        totalFiles: Object.keys(files).length,
      });
    }
  }, [activeFile, files, onOutput]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setFiles((prev) => ({
          ...prev,
          [activeFile]: {
            ...prev[activeFile],
            content: value,
          },
        }));
      }
    },
    [activeFile]
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(files[activeFile].content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeFile, files]);

  const handleDownload = useCallback(() => {
    const content = files[activeFile].content;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeFile, files]);

  const handleAddFile = useCallback(() => {
    const name = prompt("Enter file name (e.g., component.tsx):");
    if (name && !files[name]) {
      const ext = name.split(".").pop()?.toLowerCase();
      let language = "plaintext";
      if (ext === "ts" || ext === "tsx") language = "typescript";
      else if (ext === "js" || ext === "jsx") language = "javascript";
      else if (ext === "css" || ext === "scss") language = "css";
      else if (ext === "json") language = "json";
      else if (ext === "html") language = "html";

      setFiles((prev) => ({
        ...prev,
        [name]: { language, content: "" },
      }));
      setActiveFile(name);
    }
  }, [files]);

  const handleCloseFile = useCallback(
    (filename: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (Object.keys(files).length <= 1) return;

      const { [filename]: removed, ...rest } = files;
      setFiles(rest);
      if (activeFile === filename) {
        setActiveFile(Object.keys(rest)[0]);
      }
    },
    [files, activeFile]
  );

  const handleEditorMount: OnMount = (editor, monaco) => {
    // Configure TypeScript defaults
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
    });

    // Add React types (simplified)
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare module 'react' {
        export function useState<T>(initialState: T): [T, (value: T | ((prev: T) => T)) => void];
        export type FC<P = {}> = (props: P) => JSX.Element | null;
      }
      `,
      "file:///node_modules/@types/react/index.d.ts"
    );
  };

  return (
    <div className="flex flex-col h-full min-h-[500px] rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-300">
            Monaco Editor
          </span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Font Size:</label>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600"
            >
              {[12, 14, 16, 18, 20].map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={minimap}
              onChange={(e) => setMinimap(e.target.checked)}
              className="rounded bg-slate-700 border-slate-600"
            />
            Minimap
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>

          <button
            onClick={() => setTheme(theme === "vs-dark" ? "light" : "vs-dark")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
          >
            {theme === "vs-dark" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            {theme === "vs-dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      {/* File Tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-800/50 border-b border-slate-700 overflow-x-auto">
        {Object.keys(files).map((filename) => (
          <button
            key={filename}
            onClick={() => setActiveFile(filename)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
              activeFile === filename
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-300"
            }`}
          >
            {getFileIcon(filename)}
            <span>{filename}</span>
            {Object.keys(files).length > 1 && (
              <X
                className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                onClick={(e) => handleCloseFile(filename, e)}
              />
            )}
          </button>
        ))}

        <button
          onClick={handleAddFile}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={files[activeFile]?.language || "plaintext"}
          value={files[activeFile]?.content || ""}
          theme={theme}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          options={{
            fontSize,
            minimap: { enabled: minimap },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            lineNumbers: "on",
            renderLineHighlight: "all",
            cursorBlinking: "smooth",
            smoothScrolling: true,
            padding: { top: 16, bottom: 16 },
            automaticLayout: true,
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            formatOnType: true,
          }}
          loading={
            <div className="flex items-center justify-center h-full bg-slate-900">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-violet-500" />
                <span>Loading Monaco Editor...</span>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
