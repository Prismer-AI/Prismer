"use client";

import { WebContainer, FileSystemTree } from "@webcontainer/api";
import { useState, useCallback, useRef, useEffect } from "react";
import type { FilesMap, ContainerStatus, CodePlaygroundCallbacks } from "./types";

import { createEditorEventEmitter } from "@/lib/events";

const emitEvent = createEditorEventEmitter('code-playground');

// ============================================================
// Convert FilesMap to WebContainer FileSystemTree
// ============================================================

function filesToFileSystemTree(files: FilesMap): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const [path, { content }] of Object.entries(files)) {
    const parts = path.split("/");
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        current[part] = { file: { contents: content } };
      } else {
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        const dir = current[part];
        if ("directory" in dir) {
          current = dir.directory;
        }
      }
    }
  }

  return tree;
}

// ============================================================
// Status Labels
// ============================================================

export const statusLabels: Record<ContainerStatus, string> = {
  idle: "Ready",
  booting: "Booting...",
  mounting: "Mounting files...",
  installing: "Installing deps...",
  starting: "Starting server...",
  ready: "Running",
  error: "Error",
};

// ============================================================
// useWebContainer Hook
// ============================================================

interface UseWebContainerOptions {
  callbacks?: CodePlaygroundCallbacks;
}

interface UseWebContainerReturn {
  instance: WebContainer | null;
  status: ContainerStatus;
  logs: string[];
  previewUrl: string;
  error: string | null;
  start: (files: FilesMap) => Promise<void>;
  stop: () => void;
  restart: (files: FilesMap) => void;
  isRunning: boolean;
  addLog: (message: string) => void;
  clearLogs: () => void;
}

export function useWebContainer(
  options: UseWebContainerOptions = {}
): UseWebContainerReturn {
  const { callbacks } = options;

  const [instance, setInstance] = useState<WebContainer | null>(null);
  const [status, setStatus] = useState<ContainerStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const isBootingRef = useRef(false);
  const instanceRef = useRef<WebContainer | null>(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    instanceRef.current = instance;
  }, [instance]);

  // Update status with callback and event emission
  const updateStatus = useCallback(
    (newStatus: ContainerStatus) => {
      setStatus(newStatus);
      callbacks?.onStatusChange?.(newStatus);
      
      // Emit events for demo flow
      if (newStatus === 'ready') {
        emitEvent({
          type: 'actionComplete',
          payload: { action: 'server_ready', result: { status: newStatus } },
        });
      } else if (newStatus === 'error') {
        emitEvent({
          type: 'actionFailed',
          payload: { action: 'start', error: new Error('WebContainer error') },
        });
      } else {
        // Progress update
        emitEvent({
          type: 'actionProgress',
          payload: { action: 'start', message: statusLabels[newStatus] },
        });
      }
    },
    [callbacks]
  );

  // Add log helper
  const addLog = useCallback(
    (message: string) => {
      setLogs((prev) => {
        const newLogs = [...prev.slice(-200), message];
        callbacks?.onLogsUpdate?.(newLogs);
        return newLogs;
      });
    },
    [callbacks]
  );

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    callbacks?.onLogsUpdate?.([]);
  }, [callbacks]);

  // Start WebContainer
  const start = useCallback(
    async (files: FilesMap) => {
      if (isBootingRef.current) return;
      isBootingRef.current = true;

      setError(null);
      clearLogs();
      setPreviewUrl("");

      try {
        // Check cross-origin isolation
        if (!window.crossOriginIsolated) {
          throw new Error(
            "Cross-origin isolation is not enabled. Please access via /playground route."
          );
        }

        updateStatus("booting");
        addLog("🚀 Booting WebContainer...");

        // Teardown existing instance
        const existingInstance = instanceRef.current;
        if (existingInstance) {
          try {
            existingInstance.teardown();
          } catch {
            // Already torn down, ignore
          }
          instanceRef.current = null;
          setInstance(null);
        }

        const webcontainer = await WebContainer.boot({ coep: "require-corp" });
        instanceRef.current = webcontainer;
        setInstance(webcontainer);
        addLog("✅ WebContainer booted");

        // Mount files
        updateStatus("mounting");
        addLog("📁 Mounting project files...");
        await webcontainer.mount(filesToFileSystemTree(files));
        addLog("✅ Files mounted");

        // Install dependencies
        updateStatus("installing");
        addLog("📦 Running npm install...");

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
          throw new Error(
            `npm install failed with exit code ${installExitCode}`
          );
        }
        addLog("✅ Dependencies installed");

        // Start dev server
        updateStatus("starting");
        addLog("🔧 Starting dev server...");

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
          addLog(`🌐 Server ready at ${url}`);
          setPreviewUrl(url);
          updateStatus("ready");
          callbacks?.onPreviewReady?.(url);
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        updateStatus("error");
        addLog(`❌ Error: ${message}`);
        callbacks?.onError?.(message);
      } finally {
        isBootingRef.current = false;
      }
    },
    [addLog, clearLogs, updateStatus, callbacks]
  );

  // Stop container
  const stop = useCallback(() => {
    const currentInstance = instanceRef.current;
    if (currentInstance) {
      try {
        currentInstance.teardown();
      } catch {
        // Already torn down, ignore
      }
      instanceRef.current = null;
      setInstance(null);
    }
    updateStatus("idle");
    setPreviewUrl("");
    addLog("⏹️ Container stopped");
  }, [addLog, updateStatus]);

  // Restart container
  const restart = useCallback(
    (files: FilesMap) => {
      stop();
      setTimeout(() => start(files), 100);
    },
    [stop, start]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const currentInstance = instanceRef.current;
      if (currentInstance) {
        try {
          currentInstance.teardown();
        } catch {
          // Already torn down, ignore
        }
        instanceRef.current = null;
      }
    };
  }, []);

  const isRunning = status !== "idle" && status !== "error";

  return {
    instance,
    status,
    logs,
    previewUrl,
    error,
    start,
    stop,
    restart,
    isRunning,
    addLog,
    clearLogs,
  };
}

export default useWebContainer;
