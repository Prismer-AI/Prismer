'use client';

import { memo, useMemo, useState } from 'react';
import { ChevronDown, Wrench } from 'lucide-react';
import { SiriOrb } from '@/components/ui/siri-orb';

interface ToolCallEntry {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  success?: boolean;
}

interface AgentThinkingPanelProps {
  statusText?: string | null;
  thinkingContent?: string | null;
  currentToolCall?: ToolCallEntry | null;
  toolCallHistory?: ToolCallEntry[];
}

export const AgentThinkingPanel = memo(function AgentThinkingPanel({
  statusText,
  thinkingContent,
  currentToolCall,
  toolCallHistory = [],
}: AgentThinkingPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const latestCalls = useMemo(() => toolCallHistory.slice(-3).reverse(), [toolCallHistory]);
  const primaryText = thinkingContent || statusText || 'Thinking...';

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0">
        <SiriOrb size="36px" animationDuration={4} className="shadow-md opacity-90" />
      </div>
      <div className="min-w-0 max-w-[85%]">
        <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left"
            aria-expanded={expanded}
          >
            <span className="text-xs font-medium text-slate-600">Agent Thinking</span>
            <span className="ml-auto text-xs text-slate-500 truncate max-w-[240px]">
              {statusText || 'Running...'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>

          <div className={`px-3 pb-3 ${expanded ? '' : 'hidden'}`}>
            <div className="text-xs text-slate-600 whitespace-pre-wrap break-words">
              {primaryText}
            </div>

            {(currentToolCall || latestCalls.length > 0) && (
              <div className="mt-2 space-y-1.5">
                {currentToolCall && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-700">
                    <Wrench className="w-3 h-3" />
                    <span className="truncate">Running: {currentToolCall.name}</span>
                  </div>
                )}
                {latestCalls.map((call) => (
                  <div key={call.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Wrench className="w-3 h-3" />
                    <span className="truncate">
                      {call.name} {call.success === false ? '(failed)' : call.endedAt ? '(done)' : '(running)'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default AgentThinkingPanel;
