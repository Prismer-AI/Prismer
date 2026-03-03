'use client';

/**
 * ConnectionIndicator
 *
 * Shows the current agent connection status with a visual indicator.
 * Provides a popover with detailed connection info, diagnostics, and controls.
 *
 * States:
 * - connected: Green pulse - Agent is connected and ready
 * - connecting: Yellow spin - Establishing connection
 * - disconnected: Gray dot - No connection
 * - error: Red with exclamation - Connection error
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
  RefreshCw,
  Power,
  Clock,
  Bot,
  Layers,
  Container,
  Globe,
  Activity,
  FileText,
  Heart,
} from 'lucide-react';
import { useAgentInstanceStore, useAgentHealth } from '../stores/agentInstanceStore';
import { createLogger } from '@/lib/logger';

const log = createLogger('ConnectionIndicator');

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface ConnectionIndicatorProps {
  /** Current connection status */
  status: ConnectionStatus;
  /** Workspace name */
  workspaceName?: string;
  /** Bot/Agent ID if connected */
  agentId?: string;
  /** Connection start time (for duration calculation) */
  connectedAt?: Date;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Called when user clicks reconnect */
  onReconnect?: () => void;
  /** Called when user clicks disconnect */
  onDisconnect?: () => void;
  /** Additional className */
  className?: string;
}

const statusConfig = {
  connected: {
    color: 'bg-emerald-500',
    pulseColor: 'bg-emerald-400',
    textColor: 'text-emerald-600',
    label: 'Connected',
    icon: Wifi,
  },
  connecting: {
    color: 'bg-amber-500',
    pulseColor: 'bg-amber-400',
    textColor: 'text-amber-600',
    label: 'Connecting',
    icon: Loader2,
  },
  disconnected: {
    color: 'bg-slate-400',
    pulseColor: 'bg-slate-300',
    textColor: 'text-slate-500',
    label: 'Disconnected',
    icon: WifiOff,
  },
  error: {
    color: 'bg-red-500',
    pulseColor: 'bg-red-400',
    textColor: 'text-red-600',
    label: 'Error',
    icon: AlertCircle,
  },
};

function formatDuration(connectedAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - connectedAt.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) {
    return `${diffSecs}s`;
  }

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) {
    return `${diffMins}m`;
  }

  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  return `${diffHours}h ${remainingMins}m`;
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 5) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  return `${Math.floor(diffMins / 60)}h ago`;
}

// Health check result type
interface HealthResult {
  healthy: boolean;
  gateway?: { connected: boolean; url?: string; latency?: number };
  container?: { running: boolean; uptime?: number };
  error?: string;
  checkedAt?: string;
}

export function ConnectionIndicator({
  status,
  workspaceName,
  agentId,
  connectedAt,
  errorMessage,
  onReconnect,
  onDisconnect,
  className,
}: ConnectionIndicatorProps) {
  const [duration, setDuration] = useState<string>('');
  const [healthResult, setHealthResult] = useState<HealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);

  const agentInstanceId = useAgentInstanceStore((s) => s.agentInstanceId);
  const gatewayUrl = useAgentInstanceStore((s) => s.gatewayUrl);
  const containerHostPort = useAgentInstanceStore((s) => s.containerHostPort);
  const orchestratorType = useAgentInstanceStore((s) => s.orchestratorType);
  const storeHealth = useAgentHealth();

  const config = statusConfig[status];
  const Icon = config.icon;

  // Prevent Radix Popover SSR hydration mismatch (aria-controls ID differs server vs client)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Update duration every second when connected
  useEffect(() => {
    if (status !== 'connected' || !connectedAt) {
      setDuration('');
      return;
    }

    setDuration(formatDuration(connectedAt));
    const interval = setInterval(() => {
      setDuration(formatDuration(connectedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [status, connectedAt]);

  // Manual health check
  const runHealthCheck = useCallback(async () => {
    if (!agentInstanceId) return;
    setHealthLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentInstanceId}/health`);
      const data = await res.json();
      setHealthResult(data.data || { healthy: false, error: 'No data' });
      log.info('Manual health check', { agentInstanceId, healthy: data.data?.healthy });
    } catch (err) {
      setHealthResult({ healthy: false, error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setHealthLoading(false);
    }
  }, [agentInstanceId]);

  // Fetch agent logs
  const fetchLogs = useCallback(async () => {
    if (!agentInstanceId) return;
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentInstanceId}/logs?tail=50`);
      const data = await res.json();
      setAgentLogs(data.data?.logs || data.error || 'No logs available');
    } catch (err) {
      setAgentLogs(`Error: ${err instanceof Error ? err.message : 'Failed to fetch logs'}`);
    } finally {
      setLogsLoading(false);
    }
  }, [agentInstanceId]);

  // SSR placeholder — avoids Radix aria-controls hydration mismatch
  if (!mounted) {
    return (
      <button
        className={cn(
          'relative flex items-center gap-2 px-2 py-1.5 rounded-lg',
          'hover:bg-slate-100 transition-colors',
          className
        )}
        aria-label={`Connection status: ${config.label}`}
      >
        <span className="relative flex h-3 w-3">
          <span className={cn('relative inline-flex rounded-full h-3 w-3', config.color)} />
        </span>
        <Icon className={cn('h-4 w-4 hidden sm:block', config.textColor, status === 'connecting' && 'animate-spin')} />
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'relative flex items-center gap-2 px-2 py-1.5 rounded-lg',
            'hover:bg-slate-100 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
            className
          )}
          aria-label={`Connection status: ${config.label}`}
        >
          {/* Status dot with pulse animation */}
          <span className="relative flex h-3 w-3">
            {status === 'connected' && (
              <span
                className={cn(
                  'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                  config.pulseColor
                )}
              />
            )}
            {status === 'connecting' && (
              <span
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full opacity-50 animate-pulse',
                  config.pulseColor
                )}
              />
            )}
            <span
              className={cn(
                'relative inline-flex rounded-full h-3 w-3',
                config.color,
                status === 'connecting' && 'animate-pulse'
              )}
            />
            {/* Unhealthy warning badge */}
            {storeHealth && !storeHealth.healthy && status === 'connected' && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 border border-white" />
            )}
          </span>

          {/* Status icon for larger displays */}
          <Icon
            className={cn(
              'h-4 w-4 hidden sm:block',
              config.textColor,
              status === 'connecting' && 'animate-spin'
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-slate-900">Connection Status</h4>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                status === 'connected' && 'bg-emerald-100 text-emerald-700',
                status === 'connecting' && 'bg-amber-100 text-amber-700',
                status === 'disconnected' && 'bg-slate-100 text-slate-600',
                status === 'error' && 'bg-red-100 text-red-700'
              )}
            >
              {config.label}
            </span>
          </div>

          {/* Details */}
          <div className="space-y-1.5 text-sm">
            {workspaceName && (
              <div className="flex items-center gap-2 text-slate-600">
                <Layers className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{workspaceName}</span>
              </div>
            )}

            {agentId && (
              <div className="flex items-center gap-2 text-slate-600">
                <Bot className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="font-mono text-xs truncate">{agentId}</span>
              </div>
            )}

            {orchestratorType && (
              <div className="flex items-center gap-2 text-slate-600">
                <Container className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs">{orchestratorType === 'kubernetes' ? 'Kubernetes' : 'Docker'}</span>
              </div>
            )}

            {containerHostPort && (
              <div className="flex items-center gap-2 text-slate-600">
                <Activity className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="font-mono text-xs">Port: {containerHostPort}</span>
              </div>
            )}

            {gatewayUrl && (
              <div className="flex items-center gap-2 text-slate-600">
                <Globe className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="font-mono text-xs truncate">{gatewayUrl}</span>
              </div>
            )}

            {duration && status === 'connected' && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs">Connected for {duration}</span>
              </div>
            )}

            {errorMessage && status === 'error' && (
              <div className="flex items-start gap-2 text-red-600 bg-red-50 p-2 rounded-md">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span className="text-xs">{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Auto-populated health from periodic monitor */}
          {storeHealth && !healthResult && (
            <div className={cn(
              'p-2 rounded-md text-xs space-y-1',
              storeHealth.healthy ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium">
                  <Heart className="h-3 w-3" />
                  {storeHealth.healthy ? 'Healthy' : 'Unhealthy'}
                </div>
                {storeHealth.lastCheckedAt && (
                  <span className="text-[10px] opacity-60">
                    {formatRelativeTime(storeHealth.lastCheckedAt)}
                  </span>
                )}
              </div>
              {storeHealth.gateway && (
                <p>Gateway: {storeHealth.gateway.connected ? 'connected' : 'unreachable'}
                  {storeHealth.gateway.latency != null && ` (${storeHealth.gateway.latency}ms)`}
                </p>
              )}
              {storeHealth.container && (
                <p>Container: {storeHealth.container.running ? 'running' : 'stopped'}
                  {storeHealth.container.uptime != null && ` (uptime: ${Math.round(storeHealth.container.uptime)}s)`}
                </p>
              )}
              {storeHealth.error && <p>Error: {storeHealth.error}</p>}
              {storeHealth.consecutiveFailures > 0 && (
                <p className="text-amber-600">Consecutive failures: {storeHealth.consecutiveFailures}</p>
              )}
            </div>
          )}

          {/* Manual Health Check Result (overrides auto health display) */}
          {healthResult && (
            <div className={cn(
              'p-2 rounded-md text-xs space-y-1',
              healthResult.healthy ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
            )}>
              <div className="flex items-center gap-1.5 font-medium">
                <Heart className="h-3 w-3" />
                {healthResult.healthy ? 'Healthy' : 'Unhealthy'}
              </div>
              {healthResult.gateway && (
                <p>Gateway: {healthResult.gateway.connected ? 'connected' : 'unreachable'}
                  {healthResult.gateway.latency != null && ` (${healthResult.gateway.latency}ms)`}
                </p>
              )}
              {healthResult.container && (
                <p>Container: {healthResult.container.running ? 'running' : 'stopped'}
                  {healthResult.container.uptime != null && ` (uptime: ${Math.round(healthResult.container.uptime)}s)`}
                </p>
              )}
              {healthResult.error && <p>Error: {healthResult.error}</p>}
            </div>
          )}

          {/* Agent Logs */}
          {showLogs && (
            <div className="bg-slate-950 text-slate-300 rounded-md p-2 text-[10px] font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
              {logsLoading ? 'Loading logs...' : agentLogs || 'No logs'}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {(status === 'disconnected' || status === 'error') && onReconnect && (
              <Button size="sm" variant="default" onClick={onReconnect} className="flex-1">
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Reconnect
              </Button>
            )}

            {status === 'connected' && onDisconnect && (
              <Button size="sm" variant="outline" onClick={onDisconnect} className="flex-1">
                <Power className="h-3.5 w-3.5 mr-1" />
                Disconnect
              </Button>
            )}

            {status === 'connecting' && (
              <Button size="sm" variant="outline" disabled className="flex-1">
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Connecting...
              </Button>
            )}

            {agentInstanceId && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={runHealthCheck}
                  disabled={healthLoading}
                  className="gap-1"
                >
                  {healthLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Heart className="h-3.5 w-3.5" />
                  )}
                  Health
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!showLogs) fetchLogs();
                    setShowLogs(!showLogs);
                  }}
                  disabled={logsLoading}
                  className="gap-1"
                >
                  {logsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  Logs
                </Button>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ConnectionIndicator;
