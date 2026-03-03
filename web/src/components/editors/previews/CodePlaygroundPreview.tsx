"use client";

/**
 * CodePlayground Preview
 *
 * Wrapper for CodePlayground that reads mode from workspace store.
 * Files are loaded via demo:loadCode events.
 */

import React from 'react';
import { CodePlayground } from './code-playground';
import { useComponentStore } from '@/app/workspace/stores/componentStore';
import { useAgentInstanceStore } from '@/app/workspace/stores/agentInstanceStore';

export default function CodePlaygroundPreview() {
  const mode = useComponentStore(
    (s) => s.componentStates['code-playground']?.mode ?? 'script'
  );
  const agentInstanceId = useAgentInstanceStore((s) => s.agentInstanceId);

  return (
    <CodePlayground
      mode={mode}
      template={mode === 'script' ? 'python' : 'react'}
      className="h-full"
      agentInstanceId={agentInstanceId ?? undefined}
      panels={{
        showFileTree: true,
        showTerminal: true,
      }}
    />
  );
}
