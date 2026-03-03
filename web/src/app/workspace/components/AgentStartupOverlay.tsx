'use client';

/**
 * AgentStartupOverlay
 *
 * Full-screen overlay shown during agent container startup.
 * Displays step-by-step progress from SSE stream, then health check.
 * Auto-dismisses when agent reaches 'running' status.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAgentInstance, useAgentInstanceStore, useContainerVersionInfo } from '../stores/agentInstanceStore';
import {
  Loader2, CheckCircle2, XCircle, Container, Globe,
  Server, Activity, Shield, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgentStartupOverlayProps {
  onDismiss: () => void;
}

interface HealthResult {
  healthy: boolean;
  gateway?: { connected: boolean; url?: string; latency?: number };
  container?: { running: boolean; uptime?: number };
  versions?: Record<string, string>;
  versionCompatible?: boolean;
  error?: string;
}

// Step definitions for display
const STEP_LABELS: Record<number, string> = {
  1: 'Loading configuration',
  2: 'Resolving orchestrator',
  3: 'Starting container',
  4: 'Deploying agent config',
  5: 'Deploying workspace files',
  6: 'Resolving gateway',
  7: 'Validating versions',
  8: 'Finalizing',
};

function StepItem({
  stepNum,
  label,
  currentStep,
  detail,
}: {
  stepNum: number;
  label: string;
  currentStep: number;
  detail?: string;
}) {
  const isDone = currentStep > stepNum;
  const isActive = currentStep === stepNum;
  const isPending = currentStep < stepNum;

  return (
    <div className={cn(
      'flex items-start gap-3 py-1.5 transition-opacity duration-300',
      isPending && 'opacity-40',
    )}>
      <div className="flex-shrink-0 mt-0.5">
        {isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : isActive ? (
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-slate-300" />
        )}
      </div>
      <div className="min-w-0">
        <div className={cn(
          'text-sm',
          isDone && 'text-slate-500',
          isActive && 'text-slate-900 font-medium',
          isPending && 'text-slate-400',
        )}>
          {label}
        </div>
        {isActive && detail && (
          <div className="text-xs text-slate-400 mt-0.5 truncate">{detail}</div>
        )}
      </div>
    </div>
  );
}

function HealthCheckPanel({ agentId }: { agentId: string }) {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`/api/agents/${agentId}/health`);
        const data = await res.json();
        if (!cancelled && data.success) {
          setHealth(data.data);
        }
      } catch {
        if (!cancelled) {
          setHealth({ healthy: false, error: 'Health check failed' });
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    // Small delay to let container stabilize
    const timer = setTimeout(check, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [agentId]);

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Running health check...
      </div>
    );
  }

  if (!health) return null;

  const items = [
    {
      icon: Container,
      label: 'Container',
      ok: health.container?.running ?? false,
    },
    {
      icon: Globe,
      label: 'Gateway',
      ok: health.gateway?.connected ?? false,
      detail: health.gateway?.latency ? `${health.gateway.latency}ms` : undefined,
    },
    {
      icon: Shield,
      label: 'Versions',
      ok: health.versionCompatible ?? true,
      detail: health.versions
        ? Object.entries(health.versions).map(([k, v]) => `${k}: ${v}`).join(', ')
        : undefined,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Activity className="h-4 w-4" />
        Health Check
      </div>
      <div className="space-y-1.5">
        {items.map(({ icon: Icon, label, ok, detail }) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            {ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            )}
            <Icon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className={ok ? 'text-slate-600' : 'text-red-600'}>{label}</span>
            {detail && (
              <span className="text-xs text-slate-400 truncate">{detail}</span>
            )}
          </div>
        ))}
      </div>
      {health.error && (
        <div className="text-xs text-red-500 mt-1">{health.error}</div>
      )}
    </div>
  );
}

export function AgentStartupOverlay({ onDismiss }: AgentStartupOverlayProps) {
  const { id: agentId, status, error } = useAgentInstance();
  const agentState = useAgentInstanceStore((s) => s.agentState);
  const orchestratorType = useAgentInstanceStore((s) => s.orchestratorType);
  const { imageVersion } = useContainerVersionInfo();

  const currentStep = agentState.currentStep || 0;
  const isRunning = status === 'running';
  const isError = status === 'error';
  const isStarting = status === 'starting';

  // Derive showHealth from status — no effect needed
  const showHealth = isRunning;

  // Auto-dismiss timer via ref to avoid setState-in-effect
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isRunning) {
      autoDismissRef.current = setTimeout(onDismiss, 5000);
      return () => { if (autoDismissRef.current) clearTimeout(autoDismissRef.current); };
    }
  }, [isRunning, onDismiss]);

  const handleDismissNow = useCallback(() => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    onDismiss();
  }, [onDismiss]);

  // Progress percentage
  const totalSteps = agentState.totalSteps || 8;
  const percent = isRunning ? 100 : Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="w-full max-w-md mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 mb-3">
            <Server className="h-6 w-6 text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isRunning ? 'Agent Ready' : isError ? 'Startup Failed' : 'Starting Agent'}
          </h2>
          <div className="flex items-center justify-center gap-3 mt-1.5 text-xs text-slate-400">
            {orchestratorType && (
              <span className="flex items-center gap-1">
                <Container className="h-3 w-3" />
                {orchestratorType === 'kubernetes' ? 'K8s' : 'Docker'}
              </span>
            )}
            {imageVersion && (
              <span className="flex items-center gap-1">
                v{imageVersion}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                isError ? 'bg-red-500' : isRunning ? 'bg-emerald-500' : 'bg-blue-500',
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-400">
            <span>{isRunning ? 'Complete' : isError ? 'Error' : `Step ${currentStep}/${totalSteps}`}</span>
            <span>{percent}%</span>
          </div>
        </div>

        {/* Step list */}
        {(isStarting || isRunning) && (
          <div className="mb-5 max-h-[280px] overflow-y-auto">
            {Object.entries(STEP_LABELS).map(([num, label]) => (
              <StepItem
                key={num}
                stepNum={Number(num)}
                label={label}
                currentStep={isRunning ? 9 : currentStep}
                detail={currentStep === Number(num) ? agentState.stepDetail : undefined}
              />
            ))}
          </div>
        )}

        {/* Health check (after startup) */}
        {showHealth && agentId && (
          <div className="mb-5 p-3 rounded-lg bg-slate-50 border border-slate-100">
            <HealthCheckPanel agentId={agentId} />
          </div>
        )}

        {/* Error display */}
        {isError && error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-100">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center">
          {isRunning && (
            <Button
              variant="default"
              size="sm"
              onClick={handleDismissNow}
              className="gap-1.5"
            >
              Enter Workspace
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {isError && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismissNow}
            >
              Dismiss
            </Button>
          )}
          {isStarting && (
            <button
              type="button"
              onClick={handleDismissNow}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Skip to workspace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
