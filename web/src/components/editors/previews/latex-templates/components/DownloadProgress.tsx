"use client";

import { memo } from "react";
import { Loader2, FileText, Check, AlertCircle } from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface DownloadState {
  status: "idle" | "downloading" | "processing" | "success" | "error";
  progress: number;           // 0-100
  currentFile?: string;
  totalFiles?: number;
  downloadedFiles?: number;
  message?: string;
  error?: string;
}

interface DownloadProgressProps {
  state: DownloadState;
  onCancel?: () => void;
}

// ============================================================
// Component
// ============================================================

function DownloadProgressComponent({ state, onCancel }: DownloadProgressProps) {
  if (state.status === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          {state.status === "downloading" || state.status === "processing" ? (
            <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
          ) : state.status === "success" ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
          <span className="text-sm font-medium text-white">
            {state.status === "downloading"
              ? "Downloading Template"
              : state.status === "processing"
                ? "Processing Files"
                : state.status === "success"
                  ? "Download Complete"
                  : "Download Failed"}
          </span>
        </div>

        {(state.status === "downloading" || state.status === "processing") && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {(state.status === "downloading" || state.status === "processing") && (
        <div className="px-4 py-3">
          <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-slate-400">
              {state.currentFile ? (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{state.currentFile}</span>
                </span>
              ) : (
                state.message || "Preparing..."
              )}
            </span>
            <span className="text-slate-500">
              {state.downloadedFiles !== undefined && state.totalFiles
                ? `${state.downloadedFiles}/${state.totalFiles} files`
                : `${Math.round(state.progress)}%`}
            </span>
          </div>
        </div>
      )}

      {/* Success Message */}
      {state.status === "success" && (
        <div className="px-4 py-3">
          <p className="text-sm text-slate-300">
            {state.message || "Template downloaded successfully!"}
          </p>
          {state.totalFiles && (
            <p className="text-xs text-slate-500 mt-1">
              {state.totalFiles} files imported
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {state.status === "error" && (
        <div className="px-4 py-3">
          <p className="text-sm text-red-400">
            {state.error || "An error occurred during download."}
          </p>
        </div>
      )}
    </div>
  );
}

export const DownloadProgress = memo(DownloadProgressComponent);

// ============================================================
// Hook for managing download state
// ============================================================

import { useState, useCallback } from "react";

export function useDownloadProgress() {
  const [state, setState] = useState<DownloadState>({
    status: "idle",
    progress: 0,
  });

  const startDownload = useCallback((totalFiles?: number) => {
    setState({
      status: "downloading",
      progress: 0,
      totalFiles,
      downloadedFiles: 0,
    });
  }, []);

  const updateProgress = useCallback(
    (progress: number, currentFile?: string, downloadedFiles?: number) => {
      setState((prev) => ({
        ...prev,
        progress,
        currentFile,
        downloadedFiles: downloadedFiles ?? prev.downloadedFiles,
      }));
    },
    []
  );

  const setProcessing = useCallback((message?: string) => {
    setState((prev) => ({
      ...prev,
      status: "processing",
      progress: 100,
      message,
    }));
  }, []);

  const setSuccess = useCallback((message?: string, totalFiles?: number) => {
    setState({
      status: "success",
      progress: 100,
      message,
      totalFiles,
    });

    // Auto-hide after 3 seconds
    setTimeout(() => {
      setState({ status: "idle", progress: 0 });
    }, 3000);
  }, []);

  const setError = useCallback((error: string) => {
    setState({
      status: "error",
      progress: 0,
      error,
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      setState({ status: "idle", progress: 0 });
    }, 5000);
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", progress: 0 });
  }, []);

  return {
    state,
    startDownload,
    updateProgress,
    setProcessing,
    setSuccess,
    setError,
    reset,
  };
}
