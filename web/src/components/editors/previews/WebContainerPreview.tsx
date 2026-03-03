"use client";

import { WebContainer, FileSystemTree } from "@webcontainer/api";
import { useEffect, useState, useRef, useCallback } from "react";
import { Play, Square, RotateCcw, Terminal, Monitor } from "lucide-react";

// ============================================================
// Project Templates
// ============================================================

const reactTemplate: FileSystemTree = {
  "package.json": {
    file: {
      contents: JSON.stringify(
        {
          name: "react-playground",
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: {
            dev: "vite --host",
          },
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
          },
          devDependencies: {
            "@vitejs/plugin-react": "^4.2.1",
            vite: "^5.0.0",
          },
        },
        null,
        2
      ),
    },
  },
  "vite.config.js": {
    file: {
      contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
    },
  },
  "index.html": {
    file: {
      contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React Playground</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
    },
  },
  src: {
    directory: {
      "main.jsx": {
        file: {
          contents: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
        },
      },
      "App.jsx": {
        file: {
          contents: `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, sans-serif',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
        React Playground
      </h1>
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        padding: '2rem',
        borderRadius: '1rem',
        backdropFilter: 'blur(10px)'
      }}>
        <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          Count: {count}
        </p>
        <button
          onClick={() => setCount(c => c + 1)}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            background: 'white',
            color: '#764ba2',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Click me!
        </button>
      </div>
    </div>
  )
}

export default App`,
        },
      },
      "index.css": {
        file: {
          contents: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}`,
        },
      },
    },
  },
};

const vueTemplate: FileSystemTree = {
  "package.json": {
    file: {
      contents: JSON.stringify(
        {
          name: "vue-playground",
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: {
            dev: "vite --host",
          },
          dependencies: {
            vue: "^3.4.0",
          },
          devDependencies: {
            "@vitejs/plugin-vue": "^5.0.0",
            vite: "^5.0.0",
          },
        },
        null,
        2
      ),
    },
  },
  "vite.config.js": {
    file: {
      contents: `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})`,
    },
  },
  "index.html": {
    file: {
      contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue Playground</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`,
    },
  },
  src: {
    directory: {
      "main.js": {
        file: {
          contents: `import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')`,
        },
      },
      "App.vue": {
        file: {
          contents: `<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="container">
    <h1>Vue Playground</h1>
    <div class="card">
      <p class="count">Count: {{ count }}</p>
      <button @click="count++">
        Click me!
      </button>
    </div>
  </div>
</template>

<style scoped>
.container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #42b883 0%, #35495e 100%);
  font-family: system-ui, sans-serif;
  color: white;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.card {
  background: rgba(255, 255, 255, 0.1);
  padding: 2rem;
  border-radius: 1rem;
  backdrop-filter: blur(10px);
}

.count {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: white;
  color: #42b883;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.2s;
}

button:hover {
  transform: scale(1.05);
}
</style>`,
        },
      },
      "style.css": {
        file: {
          contents: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}`,
        },
      },
    },
  },
};

const templates = {
  react: reactTemplate,
  vue: vueTemplate,
};

type TemplateType = keyof typeof templates;

// ============================================================
// Status Types
// ============================================================

type ContainerStatus =
  | "idle"
  | "booting"
  | "mounting"
  | "installing"
  | "starting"
  | "ready"
  | "error";

const statusLabels: Record<ContainerStatus, string> = {
  idle: "Ready to start",
  booting: "Booting WebContainer...",
  mounting: "Mounting files...",
  installing: "Installing dependencies...",
  starting: "Starting dev server...",
  ready: "Running",
  error: "Error occurred",
};

// ============================================================
// Component
// ============================================================

export default function WebContainerPreview() {
  const [instance, setInstance] = useState<WebContainer | null>(null);
  const [template, setTemplate] = useState<TemplateType>("react");
  const [status, setStatus] = useState<ContainerStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [showTerminal, setShowTerminal] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const isBootingRef = useRef(false);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [...prev.slice(-100), message]);
  }, []);

  // Auto scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const startContainer = useCallback(async () => {
    if (isBootingRef.current) return;
    isBootingRef.current = true;

    setError(null);
    setLogs([]);
    setPreviewUrl("");

    try {
      // Check cross-origin isolation
      if (!window.crossOriginIsolated) {
        throw new Error(
          "Cross-origin isolation is not enabled. Please access this page via /playground route."
        );
      }

      setStatus("booting");
      addLog("Booting WebContainer...");

      // Teardown existing instance
      if (instance) {
        instance.teardown();
        setInstance(null);
      }

      const webcontainer = await WebContainer.boot({
        coep: "require-corp",
      });
      setInstance(webcontainer);
      addLog("WebContainer booted successfully");

      // Mount files
      setStatus("mounting");
      addLog(`Mounting ${template} template...`);
      await webcontainer.mount(templates[template]);
      addLog("Files mounted successfully");

      // Install dependencies
      setStatus("installing");
      addLog("Running npm install...");

      const installProcess = await webcontainer.spawn("npm", ["install"]);

      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            addLog(data);
          },
        })
      );

      const installExitCode = await installProcess.exit;

      if (installExitCode !== 0) {
        throw new Error(`npm install failed with exit code ${installExitCode}`);
      }

      addLog("Dependencies installed successfully");

      // Start dev server
      setStatus("starting");
      addLog("Starting dev server...");

      const devProcess = await webcontainer.spawn("npm", ["run", "dev"]);

      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            addLog(data);
          },
        })
      );

      // Wait for server ready
      webcontainer.on("server-ready", (port, url) => {
        addLog(`Server ready at ${url}`);
        setPreviewUrl(url);
        setStatus("ready");
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setStatus("error");
      addLog(`Error: ${message}`);
    } finally {
      isBootingRef.current = false;
    }
  }, [template, instance, addLog]);

  const stopContainer = useCallback(() => {
    if (instance) {
      instance.teardown();
      setInstance(null);
    }
    setStatus("idle");
    setPreviewUrl("");
    addLog("Container stopped");
  }, [instance, addLog]);

  const restart = useCallback(() => {
    stopContainer();
    setTimeout(() => startContainer(), 100);
  }, [stopContainer, startContainer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (instance) {
        instance.teardown();
      }
    };
  }, [instance]);

  const isRunning = status !== "idle" && status !== "error";

  return (
    <div className="flex flex-col h-full min-h-[600px] rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-4">
          {/* Template Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Template:</span>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as TemplateType)}
              disabled={isRunning}
              className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            >
              <option value="react">React (Vite)</option>
              <option value="vue">Vue (Vite)</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                status === "ready"
                  ? "bg-emerald-400 animate-pulse"
                  : status === "error"
                    ? "bg-red-400"
                    : status === "idle"
                      ? "bg-slate-400"
                      : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="text-sm text-slate-300">
              {statusLabels[status]}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showTerminal
                ? "bg-violet-500/20 text-violet-400"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            <Terminal className="h-4 w-4" />
            Terminal
          </button>

          {!isRunning ? (
            <button
              onClick={startContainer}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              <Play className="h-4 w-4" />
              Start
            </button>
          ) : (
            <>
              <button
                onClick={restart}
                disabled={status !== "ready"}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Restart
              </button>
              <button
                onClick={stopContainer}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Terminal Panel */}
        {showTerminal && (
          <div className="w-1/2 flex flex-col border-r border-slate-700">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border-b border-slate-700">
              <Terminal className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-300">Terminal Output</span>
            </div>
            <div
              ref={terminalRef}
              className="flex-1 overflow-auto p-3 font-mono text-xs text-slate-300 bg-slate-950"
            >
              {logs.length === 0 ? (
                <div className="text-slate-500">
                  Click &quot;Start&quot; to boot the WebContainer...
                </div>
              ) : (
                logs.map((log, i) => (
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
        )}

        {/* Preview Panel */}
        <div
          className={`flex flex-col ${showTerminal ? "w-1/2" : "w-full"}`}
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border-b border-slate-700">
            <Monitor className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-300">Preview</span>
            {previewUrl && (
              <span className="text-xs text-slate-500 ml-2 font-mono">
                {previewUrl}
              </span>
            )}
          </div>
          <div className="flex-1 bg-white">
            {error ? (
              <div className="h-full flex items-center justify-center bg-slate-900">
                <div className="text-center max-w-md p-6">
                  <div className="text-5xl mb-4">⚠️</div>
                  <h3 className="text-lg font-medium text-red-400 mb-2">
                    Error
                  </h3>
                  <p className="text-sm text-slate-400">{error}</p>
                </div>
              </div>
            ) : previewUrl ? (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-full border-0"
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-slate-900">
                <div className="text-center">
                  <div className="text-5xl mb-4">🚀</div>
                  <p className="text-slate-400">
                    {status === "idle"
                      ? "Start the container to see the preview"
                      : "Preparing preview..."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
