/**
 * useHealthMonitor
 *
 * Periodic health monitoring for the active agent container.
 * Polls /api/agents/:id/health every 60s while status === 'running'.
 * Stores results in agentInstanceStore.healthStatus.
 * After 3 consecutive failures, triggers error state with toast warning.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAgentInstanceStore } from '../stores/agentInstanceStore';
import type { AgentHealthStatus } from '../stores/agentInstanceStore';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const log = createLogger('HealthMonitor');

const POLL_INTERVAL = 60_000; // 60 seconds
const MAX_CONSECUTIVE_FAILURES = 3;

export function useHealthMonitor() {
  const agentInstanceId = useAgentInstanceStore((s) => s.agentInstanceId);
  const agentStatus = useAgentInstanceStore((s) => s.agentInstanceStatus);
  const setHealthStatus = useAgentInstanceStore((s) => s.setHealthStatus);
  const setBridgeConnected = useAgentInstanceStore((s) => s.setBridgeConnected);
  const setAgentInstanceStatus = useAgentInstanceStore((s) => s.setAgentInstanceStatus);
  const setAgentInstanceError = useAgentInstanceStore((s) => s.setAgentInstanceError);

  const consecutiveFailuresRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    if (!agentInstanceId) return;

    try {
      log.debug('Health check', { agentInstanceId });
      const res = await fetch(`/api/agents/${agentInstanceId}/health`);
      const json = await res.json();

      if (!json.success && !json.data) {
        throw new Error(json.error || 'Health check failed');
      }

      const data = json.data;
      const health: AgentHealthStatus = {
        healthy: data.healthy ?? false,
        lastCheckedAt: data.checkedAt || new Date().toISOString(),
        gateway: data.gateway || null,
        container: data.container || null,
        error: data.error || null,
        consecutiveFailures: 0,
      };

      if (health.healthy) {
        consecutiveFailuresRef.current = 0;
        health.consecutiveFailures = 0;
        // Keep readiness state aligned with backend-reported gateway connectivity.
        setBridgeConnected(Boolean(data.gateway?.connected));
        log.debug('Health check passed', {
          agentInstanceId,
          latency: data.gateway?.latency,
        });
      } else {
        consecutiveFailuresRef.current += 1;
        health.consecutiveFailures = consecutiveFailuresRef.current;
        log.warn('Health check unhealthy', {
          agentInstanceId,
          error: health.error,
          consecutiveFailures: consecutiveFailuresRef.current,
        });

        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
          log.error('Max consecutive health failures reached', {
            agentInstanceId,
            failures: consecutiveFailuresRef.current,
          });
          toast.warning('Agent health degraded', {
            description: `${consecutiveFailuresRef.current} consecutive failures. ${health.error || 'Gateway unreachable'}`,
          });
          setAgentInstanceStatus('error');
          setAgentInstanceError(health.error || 'Agent became unhealthy');
        }
      }

      setHealthStatus(health);
    } catch (err) {
      consecutiveFailuresRef.current += 1;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      log.error('Health check error', {
        agentInstanceId,
        error: errorMsg,
        consecutiveFailures: consecutiveFailuresRef.current,
      });

      setHealthStatus({
        healthy: false,
        lastCheckedAt: new Date().toISOString(),
        gateway: null,
        container: null,
        error: errorMsg,
        consecutiveFailures: consecutiveFailuresRef.current,
      });
      setBridgeConnected(false);

      if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        toast.warning('Agent health check failed', {
          description: `${consecutiveFailuresRef.current} consecutive failures. ${errorMsg}`,
        });
        setAgentInstanceStatus('error');
        setAgentInstanceError(errorMsg);
      }
    }
  }, [agentInstanceId, setHealthStatus, setBridgeConnected, setAgentInstanceStatus, setAgentInstanceError]);

  useEffect(() => {
    if (agentStatus !== 'running' || !agentInstanceId) {
      // Clear interval when not running
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Reset failure count when agent restarts
      if (agentStatus === 'starting' || agentStatus === 'idle') {
        consecutiveFailuresRef.current = 0;
      }
      return;
    }

    // Initial check on mount (when running)
    checkHealth();

    // Periodic polling
    intervalRef.current = setInterval(checkHealth, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [agentStatus, agentInstanceId, checkHealth]);
}

export default useHealthMonitor;
