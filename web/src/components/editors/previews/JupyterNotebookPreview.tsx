'use client';

/**
 * JupyterNotebook Playground Preview
 *
 * Renders the Jupyter Notebook component with container proxy integration.
 * Only attempts connection when the agent container is running to avoid 503 errors.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Loader2, WifiOff, Play, Settings } from 'lucide-react';
import { JupyterNotebook } from '../jupyter';
import { useAgentInstanceStore } from '@/app/workspace/stores/agentInstanceStore';
import { useMultiFieldContentSync } from '@/lib/sync/useContentSync';

// Legacy proxy for non-container Jupyter (e.g., local server)
const PROXY_BASE = '/api/jupyter';

export default function JupyterNotebookPreview() {
  const containerHostPort = useAgentInstanceStore((s) => s.containerHostPort);
  const agentStatus = useAgentInstanceStore((s) => s.agentInstanceStatus);
  const agentInstanceId = useAgentInstanceStore((s) => s.agentInstanceId);
  const isLoading = useAgentInstanceStore((s) => s._loading);
  const startAgent = useAgentInstanceStore((s) => s.startAgentInstance);

  // Container proxy URL — only used when agent is running
  const serverUrl = useMemo(() => {
    if (agentInstanceId) {
      return `/api/container/${agentInstanceId}/jupyter`;
    }
    return PROXY_BASE;
  }, [agentInstanceId]);

  // WebSocket URL through container's web server (port 3000) which proxies WS to Jupyter.
  // Jupyter binds to localhost inside the container, so direct host port access doesn't work.
  // The web server on port 3000 supports WS upgrade proxy via /api/v1/jupyter/ route.
  const wsUrl = useMemo(() => {
    if (containerHostPort) {
      const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      return `${wsProtocol}//${wsHost}:${containerHostPort}/api/v1/jupyter/`;
    }
    return undefined;
  }, [containerHostPort]);

  const [token, setToken] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Determine if Jupyter should attempt connection:
  // - No agent bound → use legacy proxy (always try)
  // - Agent bound + running → use container proxy
  // - Agent bound + not running → show placeholder (avoid 503)
  const hasAgent = !!agentInstanceId;
  const agentRunning = agentStatus === 'running';
  const canConnect = !hasAgent || agentRunning;

  // Sync Jupyter metadata to componentStore
  const syncJupyterState = useMultiFieldContentSync('jupyter-notebook', 2000);
  useEffect(() => {
    syncJupyterState({
      kernelStatus: canConnect ? 'idle' : 'not_connected',
    });
  }, [canConnect, syncJupyterState]);

  // Show config panel
  if (showConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white text-stone-800 p-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Jupyter Notebook</h2>
            <p className="text-stone-500 text-sm">
              Connect to a Jupyter Server to start using the notebook
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Server URL
              </label>
              <div className="px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-stone-600 text-sm">
                {serverUrl}
                {agentRunning && (
                  <span className="ml-2 text-green-600 text-xs">(Container active)</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Token (optional)
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter token if required"
                className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-stone-800 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={() => setShowConfig(false)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Agent bound but not running — show placeholder instead of connecting (avoids 503)
  if (hasAgent && !agentRunning) {
    const isStarting = agentStatus === 'starting';

    return (
      <div className="flex flex-col items-center justify-center h-full bg-white text-stone-800">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          {isLoading || isStarting ? (
            <>
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              <div>
                <h3 className="text-lg font-semibold text-stone-900">
                  {isStarting ? 'Starting Container...' : 'Loading...'}
                </h3>
                <p className="text-sm text-stone-500 mt-1">
                  Jupyter will be available once the agent container is ready
                </p>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="w-10 h-10 text-stone-300" />
              <div>
                <h3 className="text-lg font-semibold text-stone-900">Jupyter Notebook</h3>
                <p className="text-sm text-stone-500 mt-1">
                  Start the agent container to use the Jupyter kernel
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => startAgent()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Container
                </button>
                <button
                  onClick={() => setShowConfig(true)}
                  className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
                  title="Configure connection"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <JupyterNotebook
          serverUrl={serverUrl}
          token={token}
          wsUrl={wsUrl}
          className="h-full"
        />
      </div>
    </div>
  );
}
