/**
 * Agent Instance Store
 *
 * Manages agent instance lifecycle, workspace identity, and sync session state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createWorkspaceIsolatedStorage } from '@/lib/storage/userStorageManager';
import { createLogger } from '@/lib/logger';
import type { AgentState } from '@/lib/sync/types';

const { storage: wsAgentStorage, setWorkspaceId: setAgentStoreWorkspaceId } =
  createWorkspaceIsolatedStorage<Pick<AgentInstanceState, 'workspaceId' | 'agentInstanceId' | 'agentInstanceStatus' | 'gatewayUrl'>>('prismer-ws-agent', true);

export { setAgentStoreWorkspaceId };

const log = createLogger('AgentStore');

type AgentInstanceStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

async function apiCall<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/** Container version info parsed from API responses */
interface ContainerVersionInfo {
  imageTag: string | null;
  versions: Record<string, string> | null;
  versionCompatible: boolean | null;
}

/** Extract version info from container data (healthStatus is JSON string) */
function parseContainerVersionInfo(container?: {
  imageTag?: string;
  healthStatus?: string | null;
} | null): ContainerVersionInfo {
  const info: ContainerVersionInfo = { imageTag: null, versions: null, versionCompatible: null };
  if (!container) return info;
  info.imageTag = container.imageTag || null;
  if (container.healthStatus) {
    try {
      const hs = JSON.parse(container.healthStatus);
      info.versions = hs.versions || null;
      info.versionCompatible = hs.versionCompatible ?? null;
    } catch { /* ignore */ }
  }
  return info;
}

/** Health status from periodic health monitoring */
export interface AgentHealthStatus {
  healthy: boolean;
  lastCheckedAt: string | null;
  gateway: { connected: boolean; latency?: number } | null;
  container: { running: boolean; uptime?: number } | null;
  error: string | null;
  consecutiveFailures: number;
}

interface AgentInstanceState {
  workspaceId: string | null;
  agentInstanceId: string | null;
  agentInstanceStatus: AgentInstanceStatus;
  agentInstanceError: string | null;
  gatewayUrl: string | null;
  containerHostPort: number | null;
  jupyterHostPort: number | null;
  orchestratorType: string | null;
  containerImageTag: string | null;
  containerVersions: Record<string, string> | null;
  versionCompatible: boolean | null;
  agentState: AgentState;
  syncSessionId: string | null;
  bridgeConnected: boolean;
  healthStatus: AgentHealthStatus | null;
  collectionId: number | null;
  _loading: boolean;
  _synced: boolean;
  _syncError: string | null;
}

interface AgentInstanceActions {
  setWorkspaceId: (id: string | null) => void;
  setAgentInstanceId: (id: string | null) => void;
  setAgentInstanceStatus: (status: AgentInstanceStatus) => void;
  setAgentInstanceError: (error: string | null) => void;
  fetchAgentBinding: (workspaceId: string) => Promise<void>;
  ensureAgentForWorkspace: (workspaceId: string) => Promise<void>;
  startAgentInstance: (orchestrator?: 'docker' | 'kubernetes', imageTag?: string) => Promise<void>;
  stopAgentInstance: () => Promise<void>;
  setAgentState: (state: AgentState) => void;
  setSyncSessionId: (sessionId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setBridgeConnected: (connected: boolean) => void;
  setHealthStatus: (health: AgentHealthStatus | null) => void;
  setSynced: (synced: boolean) => void;
  setSyncError: (error: string | null) => void;
  resetAgentInstance: () => void;
}

const initialAgentInstanceState: AgentInstanceState = {
  workspaceId: null,
  agentInstanceId: null,
  agentInstanceStatus: 'idle',
  agentInstanceError: null,
  gatewayUrl: null,
  containerHostPort: null,
  jupyterHostPort: null,
  orchestratorType: null,
  containerImageTag: null,
  containerVersions: null,
  versionCompatible: null,
  agentState: {
    status: 'idle',
    currentStep: 0,
    totalSteps: 0,
  },
  syncSessionId: null,
  bridgeConnected: false,
  healthStatus: null,
  collectionId: null,
  _loading: false,
  _synced: false,
  _syncError: null,
};

export const useAgentInstanceStore = create<AgentInstanceState & AgentInstanceActions>()(
  persist(
    (set, get) => ({
      ...initialAgentInstanceState,

      setWorkspaceId: (id) => {
        set({ workspaceId: id });
      },

      setAgentInstanceId: (id) => {
        set({ agentInstanceId: id });
      },

      setAgentInstanceStatus: (status) => {
        set({ agentInstanceStatus: status });
      },

      setAgentInstanceError: (error) => {
        set({ agentInstanceError: error });
      },

      fetchAgentBinding: async (workspaceId: string) => {
        log.info('Fetching agent binding', { workspaceId });
        set({ _loading: true, workspaceId });
        try {
          const agent = await apiCall<{
            id: string;
            status: string;
            gatewayUrl?: string;
            collectionId?: number | null;
            jupyterHostPort?: number | null;
            container?: { hostPort?: number; orchestrator?: string; imageTag?: string; healthStatus?: string | null };
          }>(`/api/workspace/${workspaceId}/agent`);

          if (agent) {
            const statusMap: Record<string, AgentInstanceStatus> = {
              running: 'running',
              starting: 'starting',
              stopped: 'stopped',
              error: 'error',
            };
            const resolvedStatus = statusMap[agent.status] || 'idle';
            const versionInfo = parseContainerVersionInfo(agent.container);
            log.info('Agent binding found', { workspaceId, agentId: agent.id, status: resolvedStatus, imageTag: versionInfo.imageTag });
            set({
              agentInstanceId: agent.id,
              agentInstanceStatus: resolvedStatus,
              gatewayUrl: agent.gatewayUrl || null,
              containerHostPort: agent.container?.hostPort || null,
              jupyterHostPort: agent.jupyterHostPort ?? null,
              orchestratorType: agent.container?.orchestrator || null,
              collectionId: agent.collectionId ?? null,
              ...versionInfo,
            });
          } else {
            log.info('No agent bound to workspace', { workspaceId });
            // No agent bound to this workspace
            set({
              agentInstanceId: null,
              agentInstanceStatus: 'idle',
              gatewayUrl: null,
              containerHostPort: null,
              jupyterHostPort: null,
              orchestratorType: null,
              containerImageTag: null,
              containerVersions: null,
              versionCompatible: null,
              collectionId: null,
            });
          }
        } catch {
          log.error('Failed to fetch agent binding', { workspaceId });
          set({ agentInstanceError: 'Failed to fetch agent binding' });
        } finally {
          set({ _loading: false });
        }
      },

      ensureAgentForWorkspace: async (workspaceId: string) => {
        set({ _loading: true });
        try {
          const result = await apiCall<{
            id: string;
            status: string;
            gatewayUrl?: string;
            container?: { hostPort?: number; orchestrator?: string; imageTag?: string; healthStatus?: string | null };
          }>(`/api/workspace/${workspaceId}/agent/ensure`, { method: 'POST' });

          if (result) {
            const statusMap: Record<string, AgentInstanceStatus> = {
              running: 'running',
              starting: 'starting',
              stopped: 'stopped',
              error: 'error',
            };
            const versionInfo = parseContainerVersionInfo(result.container);
            set({
              agentInstanceId: result.id,
              agentInstanceStatus: statusMap[result.status] || 'idle',
              gatewayUrl: result.gatewayUrl || null,
              containerHostPort: result.container?.hostPort || null,
              orchestratorType: result.container?.orchestrator || null,
              ...versionInfo,
            });
          }
        } catch {
          set({ agentInstanceError: 'Failed to ensure agent for workspace' });
        } finally {
          set({ _loading: false });
        }
      },

      startAgentInstance: async (orchestrator?: 'docker' | 'kubernetes', imageTag?: string) => {
        const { agentInstanceId } = get();
        if (!agentInstanceId) {
          log.warn('Start called but no agent instance bound');
          set({ agentInstanceError: 'No agent instance bound' });
          return;
        }

        log.info('Starting agent instance', { agentInstanceId, orchestrator });
        set({
          agentInstanceStatus: 'starting',
          agentInstanceError: null,
          agentState: { status: 'idle', currentStep: 0, totalSteps: 6 },
        });

        try {
          const response = await fetch(`/api/agents/${agentInstanceId}/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
            },
            body: JSON.stringify({ orchestrator, ...(imageTag ? { imageTag } : {}) }),
          });

          if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
            const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorBody.error || `HTTP ${response.status}`);
          }

          const contentType = response.headers.get('content-type') || '';

          if (contentType.includes('text/event-stream') && response.body) {
            // SSE mode: consume stream and update progress
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const event = JSON.parse(line.slice(6));
                    log.debug('SSE progress', { step: event.step, message: event.message });

                    set({
                      agentState: {
                        status: event.done ? (event.error ? 'error' : 'completed') : 'starting',
                        currentStep: event.step,
                        totalSteps: event.total,
                        stepMessage: event.message,
                        stepDetail: event.detail,
                      },
                    });

                    if (event.done) {
                      if (event.error) {
                        set({
                          agentInstanceStatus: 'error',
                          agentInstanceError: event.message,
                        });
                      } else if (event.data) {
                        const data = event.data as {
                          gatewayUrl?: string;
                          container?: { hostPort?: number; orchestrator?: string; imageTag?: string; healthStatus?: string | null };
                        };
                        const versionInfo = parseContainerVersionInfo(data.container);
                        log.info('Agent started successfully (SSE)', {
                          agentInstanceId,
                          gatewayUrl: data.gatewayUrl,
                          hostPort: data.container?.hostPort,
                          imageTag: versionInfo.imageTag,
                          versionCompatible: versionInfo.versionCompatible,
                        });
                        set({
                          agentInstanceStatus: 'running',
                          gatewayUrl: data.gatewayUrl || get().gatewayUrl,
                          containerHostPort: data.container?.hostPort || get().containerHostPort,
                          orchestratorType: data.container?.orchestrator || get().orchestratorType,
                          ...versionInfo,
                        });
                      }
                    }
                  } catch {
                    // Ignore malformed SSE events
                  }
                }
              }
            }
          } else {
            // JSON mode fallback
            const json = await response.json();
            if (json.success && json.data) {
              const data = json.data as {
                gatewayUrl?: string;
                container?: { hostPort?: number; orchestrator?: string; imageTag?: string; healthStatus?: string | null };
              };
              const versionInfo = parseContainerVersionInfo(data.container);
              log.info('Agent started successfully (JSON)', {
                agentInstanceId,
                gatewayUrl: data.gatewayUrl,
                hostPort: data.container?.hostPort,
                imageTag: versionInfo.imageTag,
              });
              set({
                agentInstanceStatus: 'running',
                gatewayUrl: data.gatewayUrl || get().gatewayUrl,
                containerHostPort: data.container?.hostPort || get().containerHostPort,
                orchestratorType: data.container?.orchestrator || get().orchestratorType,
                ...versionInfo,
              });
            } else {
              throw new Error(json.error || 'Failed to start agent');
            }
          }
        } catch (err) {
          log.error('Agent start threw error', { agentInstanceId, error: err instanceof Error ? err.message : String(err) });
          set({
            agentInstanceStatus: 'error',
            agentInstanceError: err instanceof Error ? err.message : 'Failed to start agent',
          });
        }
      },

      stopAgentInstance: async () => {
        const { agentInstanceId } = get();
        if (!agentInstanceId) return;

        log.info('Stopping agent instance', { agentInstanceId });

        try {
          const result = await apiCall<{ status: string }>(
            `/api/agents/${agentInstanceId}/stop`,
            { method: 'POST' }
          );
          if (result) {
            log.info('Agent stopped', { agentInstanceId });
            set({ agentInstanceStatus: 'stopped' });
          }
        } catch (err) {
          log.error('Agent stop failed', { agentInstanceId, error: err instanceof Error ? err.message : String(err) });
          set({
            agentInstanceError: err instanceof Error ? err.message : 'Failed to stop agent',
          });
        }
      },

      setAgentState: (agentState) => {
        set({ agentState });
      },

      setSyncSessionId: (sessionId) => {
        set({ syncSessionId: sessionId });
      },

      setLoading: (loading) => {
        set({ _loading: loading });
      },

      setBridgeConnected: (connected) => {
        set({ bridgeConnected: connected });
      },

      setHealthStatus: (health) => {
        set({ healthStatus: health });
      },

      setSynced: (synced) => {
        set({ _synced: synced });
      },

      setSyncError: (error) => {
        set({ _syncError: error });
      },

      resetAgentInstance: () => {
        set(initialAgentInstanceState);
      },
    }),
    {
      name: 'prismer-ws-agent',
      storage: wsAgentStorage,
      version: 3,
      skipHydration: true,
      partialize: (state) => ({
        workspaceId: state.workspaceId,
        agentInstanceId: state.agentInstanceId,
        agentInstanceStatus: state.agentInstanceStatus,
        gatewayUrl: state.gatewayUrl,
      }),
    }
  )
);

// Selector hooks
export function useAgentInstance() {
  const id = useAgentInstanceStore((s) => s.agentInstanceId);
  const status = useAgentInstanceStore((s) => s.agentInstanceStatus);
  const error = useAgentInstanceStore((s) => s.agentInstanceError);

  return {
    id,
    status,
    error,
    isRunning: status === 'running',
    hasAgent: id !== null,
  };
}

export function useAgentInstanceId() {
  return useAgentInstanceStore((s) => s.agentInstanceId);
}

export function useAgentInstanceStatus() {
  return useAgentInstanceStore((s) => s.agentInstanceStatus);
}

export function useAgentInstanceActions() {
  const startAgentInstance = useAgentInstanceStore((s) => s.startAgentInstance);
  const stopAgentInstance = useAgentInstanceStore((s) => s.stopAgentInstance);
  const setAgentInstanceId = useAgentInstanceStore((s) => s.setAgentInstanceId);
  const fetchAgentBinding = useAgentInstanceStore((s) => s.fetchAgentBinding);

  return {
    start: startAgentInstance,
    stop: stopAgentInstance,
    setId: setAgentInstanceId,
    fetchBinding: fetchAgentBinding,
  };
}

export function useAgentGatewayUrl() {
  return useAgentInstanceStore((s) => s.gatewayUrl);
}

export function useAgentState() {
  return useAgentInstanceStore((s) => s.agentState);
}

export function useSyncSessionId() {
  return useAgentInstanceStore((s) => s.syncSessionId);
}

export function useWorkspaceReadiness() {
  const status = useAgentInstanceStore((s) => s.agentInstanceStatus);
  const bridgeConnected = useAgentInstanceStore((s) => s.bridgeConnected);

  return {
    isReady: status === 'running' && bridgeConnected,
    isStarting: status === 'starting',
    isIdle: status === 'idle' || status === 'stopped',
    isError: status === 'error',
    status,
    bridgeConnected,
  };
}

export function useAgentHealth() {
  return useAgentInstanceStore((s) => s.healthStatus);
}

export function useWorkspaceCollectionId() {
  return useAgentInstanceStore((s) => s.collectionId);
}

export function useJupyterHostPort() {
  return useAgentInstanceStore((s) => s.jupyterHostPort);
}

export function useContainerVersionInfo() {
  const imageTag = useAgentInstanceStore((s) => s.containerImageTag);
  const versions = useAgentInstanceStore((s) => s.containerVersions);
  const compatible = useAgentInstanceStore((s) => s.versionCompatible);

  // Extract short version from imageTag (e.g., "registry.example.com/...:v4.3-openclaw" → "v4.3")
  const imageVersion = imageTag?.match(/:v([\d.]+)/)?.[1] || null;

  return { imageTag, imageVersion, versions, versionCompatible: compatible };
}
