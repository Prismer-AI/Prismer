'use client';

/**
 * WorkspaceReadinessGate
 *
 * Full-screen overlay shown whenever the workspace is not ready.
 * Three visual states:
 * 1. Idle/Stopped — "Agent not running" with Start button
 * 2. Starting — Delegates to AgentStartupOverlay for step-by-step progress
 * 3. Error — Error display with retry
 *
 * Auto-dismisses when workspace becomes ready (agent running + bridge connected).
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  useWorkspaceReadiness,
  useAgentInstance,
  useAgentInstanceStore,
  useContainerVersionInfo,
} from '../stores/agentInstanceStore';
import { AgentStartupOverlay } from './AgentStartupOverlay';
import { AgentStatusBadge } from './AgentStatusBadge';
import { Button } from '@/components/ui/button';
import {
  Play, Server, AlertCircle, Loader2, Container, Globe, XCircle,
} from 'lucide-react';

interface WorkspaceReadinessGateProps {
  onDismiss: () => void;
}

export function WorkspaceReadinessGate({ onDismiss }: WorkspaceReadinessGateProps) {
  const { isReady, isStarting, isIdle, isError } = useWorkspaceReadiness();
  const { id: agentId, error } = useAgentInstance();
  const startAgent = useAgentInstanceStore((s) => s.startAgentInstance);
  const orchestratorType = useAgentInstanceStore((s) => s.orchestratorType);
  const { imageVersion } = useContainerVersionInfo();
  const agentLoading = useAgentInstanceStore((s) => s._loading);

  // Auto-dismiss when ready (with small delay so health data can populate)
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isReady) {
      autoDismissRef.current = setTimeout(onDismiss, 1500);
      return () => {
        if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      };
    }
  }, [isReady, onDismiss]);

  const handleStart = useCallback(() => {
    startAgent();
  }, [startAgent]);

  // ==================== Starting State ====================
  // Delegate to the existing AgentStartupOverlay for step-by-step progress
  if (isStarting) {
    return <AgentStartupOverlay onDismiss={onDismiss} />;
  }

  // ==================== Idle/Stopped State ====================
  if (isIdle) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-2xl shadow-md border border-slate-200/60">
        <div className="w-full max-w-sm mx-auto px-6 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mb-4">
            <Server className="h-7 w-7 text-slate-400" />
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Agent Not Running
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Start the agent to use the workspace chat and tools.
          </p>

          {/* Agent info */}
          {(orchestratorType || imageVersion) && (
            <div className="flex items-center justify-center gap-3 mb-5 text-xs text-slate-400">
              {orchestratorType && (
                <span className="flex items-center gap-1">
                  {orchestratorType === 'kubernetes' ? (
                    <Globe className="h-3 w-3" />
                  ) : (
                    <Container className="h-3 w-3" />
                  )}
                  {orchestratorType === 'kubernetes' ? 'K8s' : 'Docker'}
                </span>
              )}
              {imageVersion && <span>v{imageVersion}</span>}
            </div>
          )}

          {/* Start button */}
          <Button
            onClick={handleStart}
            disabled={agentLoading || !agentId}
            className="gap-2 mb-4"
          >
            {agentLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Agent
              </>
            )}
          </Button>

          {/* Agent status badge */}
          <div className="flex justify-center mb-4">
            <AgentStatusBadge showLabel size="sm" />
          </div>

          {/* Skip link */}
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip to workspace
          </button>
        </div>
      </div>
    );
  }

  // ==================== Error State ====================
  if (isError) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-2xl shadow-md border border-slate-200/60">
        <div className="w-full max-w-sm mx-auto px-6 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 mb-4">
            <XCircle className="h-7 w-7 text-red-500" />
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Startup Failed
          </h2>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100 mb-5 text-left">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Retry + Dismiss */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="default"
              size="sm"
              onClick={handleStart}
              disabled={agentLoading}
              className="gap-1.5"
            >
              {agentLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Retry
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Agent is running but bridge not connected yet — show brief connecting state
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-2xl shadow-md border border-slate-200/60">
      <div className="text-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-600 font-medium">Connecting to agent...</p>
        <p className="text-xs text-slate-400 mt-1">Establishing gateway connection</p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors mt-4"
        >
          Skip to workspace
        </button>
      </div>
    </div>
  );
}
