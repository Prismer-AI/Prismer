"use client";

/**
 * Script Terminal
 * 
 * A simple terminal component for displaying script execution output.
 * Used in script mode of CodePlayground for Python, Node.js, etc.
 */

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Play, Square, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

// ============================================================
// Types
// ============================================================

export interface ScriptTerminalHandle {
  /** Add a log line */
  addLog: (message: string) => void;
  /** Clear all logs */
  clearLogs: () => void;
  /** Execute a command (simulated for demo) */
  executeCommand: (command: string, script?: string) => Promise<void>;
  /** Check if running */
  isRunning: () => boolean;
  /** Stop execution */
  stop: () => void;
}

interface ScriptTerminalProps {
  /** Initial logs */
  initialLogs?: string[];
  /** Terminal title */
  title?: string;
  /** On logs change callback */
  onLogsChange?: (logs: string[]) => void;
  /** On execution complete callback */
  onExecutionComplete?: (success: boolean) => void;
  /** Custom class name */
  className?: string;
  /** Whether terminal is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Agent instance ID — when provided, executes via container instead of mock */
  agentInstanceId?: string;
}

// ============================================================
// Component
// ============================================================

export const ScriptTerminal = forwardRef<ScriptTerminalHandle, ScriptTerminalProps>(
  (
    {
      initialLogs = [],
      title = "Terminal",
      onLogsChange,
      onExecutionComplete,
      className = "",
      collapsible = false,
      defaultCollapsed = false,
      agentInstanceId,
    },
    ref
  ) => {
    const [logs, setLogs] = useState<string[]>(initialLogs);
    const [isRunning, setIsRunning] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Auto-scroll to bottom when logs change
    useEffect(() => {
      if (!isCollapsed) {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, [logs, isCollapsed]);

    // Notify parent of logs change
    useEffect(() => {
      onLogsChange?.(logs);
    }, [logs, onLogsChange]);

    // Add log line
    const addLog = useCallback((message: string) => {
      setLogs(prev => [...prev, message]);
    }, []);

    // Stream text character by character
    const streamText = useCallback(async (text: string, delay = 15) => {
      let currentLine = '';
      for (let i = 0; i < text.length; i++) {
        if (abortControllerRef.current?.signal.aborted) break;
        const char = text[i];
        if (char === '\n') {
          // Add the completed line
          const line = currentLine;
          setLogs(prev => [...prev, line]);
          currentLine = '';
        } else {
          currentLine += char;
          // Update the last line in real-time
          const partial = currentLine;
          setLogs(prev => {
            if (prev.length === 0 || prev[prev.length - 1] !== partial.slice(0, -1)) {
              // New line started
              return [...prev.slice(0, -1), partial];
            }
            // Update existing line
            const newLogs = [...prev];
            newLogs[newLogs.length - 1] = partial;
            return newLogs;
          });
        }
        await new Promise(r => setTimeout(r, delay));
      }
      // Add final line if not empty
      if (currentLine) {
        const final = currentLine;
        setLogs(prev => [...prev.slice(0, -1), final]);
      }
    }, []);

    // Clear logs
    const clearLogs = useCallback(() => {
      setLogs([]);
    }, []);

    // Stop execution
    const stop = useCallback(() => {
      abortControllerRef.current?.abort();
      setIsRunning(false);
      addLog('\n⚠️ Execution stopped by user');
    }, [addLog]);

    // Add a complete line instantly (line refresh, not character streaming)
    const addLine = useCallback(async (text: string, delay = 50) => {
      setLogs(prev => [...prev, text]);
      await new Promise(r => setTimeout(r, delay));
    }, []);

    // Stream a line with typing effect (only used for important messages)
    const streamLine = useCallback(async (text: string, speed: 'fast' | 'normal' | 'slow' = 'normal') => {
      const delays = { fast: 3, normal: 8, slow: 15 };
      const delay = delays[speed];
      
      // Add an empty line first
      setLogs(prev => [...prev, '']);
      
      for (let i = 0; i <= text.length; i++) {
        if (abortControllerRef.current?.signal.aborted) break;
        const partial = text.slice(0, i) + (i < text.length ? '▌' : '');
        setLogs(prev => {
          const newLogs = [...prev];
          newLogs[newLogs.length - 1] = partial;
          return newLogs;
        });
        await new Promise(r => setTimeout(r, delay));
      }
      
      // Final update without cursor
      setLogs(prev => {
        const newLogs = [...prev];
        newLogs[newLogs.length - 1] = text;
        return newLogs;
      });
    }, []);

    // Simulate VLA benchmark output with line-by-line refresh
    const simulateBenchmarkOutput = useCallback(async () => {
      const models = [
        { name: 'RT-1', params: '35M', latency: 120, success: 72.3, memory: 8.2, checkpoint: 'rt1-robotics-transformer' },
        { name: 'OpenVLA', params: '7B', latency: 85, success: 81.2, memory: 12.4, checkpoint: 'openvla-7b-prismatic' },
        { name: 'VLA-RAIL', params: '2.1B', latency: 45, success: 89.1, memory: 6.8, checkpoint: 'vla-rail-2b-v1' },
        { name: 'VLA-RAIL+', params: '2.3B', latency: 32, success: 93.4, memory: 7.2, checkpoint: 'vla-rail-plus-2b-v1' },
      ];

      // Header - line by line refresh
      await addLine('============================================================', 30);
      await addLine('  VLA Model Benchmark Suite v1.0', 30);
      await addLine('  Benchmark: SIMPLER-Env | Episodes: 50', 30);
      await addLine('============================================================', 30);
      await addLine('', 20);

      const results: { name: string; latency: number; success: number; memory: number; params: string }[] = [];

      for (const model of models) {
        if (abortControllerRef.current?.signal.aborted) break;

        // Model loading - line by line
        await addLine(`📦 Loading ${model.name} (${model.params} params)...`, 80);
        await addLine(`   Checkpoint: ${model.checkpoint}`, 40);
        await addLine(`   Memory: ${model.memory} GB`, 40);
        await new Promise(r => setTimeout(r, 150));

        await addLine('', 20);
        await addLine(`🔬 Running benchmark...`, 60);

        // Progress bar simulation - smooth in-place update (only this uses character update)
        const totalSteps = 50;
        addLog(''); // Placeholder for progress bar
        
        for (let i = 0; i <= totalSteps; i++) {
          if (abortControllerRef.current?.signal.aborted) break;
          const percent = (i / totalSteps) * 100;
          const filled = Math.floor(percent / 2.5);
          const bar = '█'.repeat(filled) + '░'.repeat(40 - filled);
          setLogs(prev => {
            const newLogs = [...prev];
            newLogs[newLogs.length - 1] = `  ${model.name.padEnd(12)} |${bar}| ${percent.toFixed(1)}%`;
            return newLogs;
          });
          await new Promise(r => setTimeout(r, 25));
        }

        // Calculate with variance
        const actualLatency = model.latency + (Math.random() - 0.5) * 10;
        const actualSuccess = model.success + (Math.random() - 0.5) * 2;
        
        results.push({ 
          name: model.name, 
          latency: actualLatency, 
          success: actualSuccess,
          memory: model.memory,
          params: model.params
        });

        await addLine(`   ✓ Avg Latency: ${actualLatency.toFixed(1)} ms`, 40);
        await addLine(`   ✓ Success Rate: ${actualSuccess.toFixed(1)}%`, 40);
        await addLine('', 20);
        await new Promise(r => setTimeout(r, 80));
      }

      if (!abortControllerRef.current?.signal.aborted) {
        await addLine('============================================================', 30);
        await addLine('  BENCHMARK RESULTS', 30);
        await addLine('============================================================', 30);
        await addLine('Model        Latency    Success      Memory   Params', 30);
        await addLine('------------------------------------------------------------', 30);
        
        // Results - line by line
        for (const r of results) {
          const line = `${r.name.padEnd(12)} ${r.latency.toFixed(1).padStart(6)}ms ${r.success.toFixed(1).padStart(9)}% ${r.memory.toFixed(1).padStart(8)}GB ${r.params.padStart(8)}`;
          await addLine(line, 60);
        }
        
        await addLine('------------------------------------------------------------', 30);
        await addLine('', 20);
        
        const rt1 = results.find(r => r.name === 'RT-1')!;
        const vla = results.find(r => r.name === 'VLA-RAIL')!;
        const vlaPlus = results.find(r => r.name === 'VLA-RAIL+')!;
        const openVla = results.find(r => r.name === 'OpenVLA')!;
        const improvement = ((rt1.latency - vla.latency) / rt1.latency) * 100;

        await addLine('📊 Key Findings:', 50);
        await addLine(`   • VLA-RAIL achieves ${improvement.toFixed(0)}% lower latency vs RT-1`, 50);
        await addLine(`   • VLA-RAIL+ reaches ${vlaPlus.success.toFixed(1)}% success rate`, 50);
        await addLine(`   • Memory efficient: ${vla.memory}GB vs ${openVla.memory}GB (OpenVLA)`, 50);
        await addLine('', 20);
        await addLine('✅ Benchmark complete. Results saved to benchmark_results.json', 50);
      }
    }, [addLog, addLine]);

    // Execute command via container exec API (real execution)
    const executeViaContainer = useCallback(async (command: string, script?: string) => {
      addLog(`$ ${command}`);
      addLog('');

      // Determine interpreter and build command
      const isPython = command.includes('python');
      const lang = isPython ? 'python3' : 'node';
      const flag = isPython ? '-c' : '-e';
      const code = script || '';

      try {
        const res = await fetch(`/api/container/${agentInstanceId}/exec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: [lang, flag, code],
            timeout: 30000,
          }),
          signal: abortControllerRef.current?.signal,
        });

        const data = await res.json() as { success: boolean; data?: { output: string }; error?: string };

        if (data.success && data.data?.output) {
          // Output each line to terminal
          const lines = data.data.output.split('\n');
          for (const line of lines) {
            if (line) addLog(line);
          }
        } else if (!data.success) {
          addLog(`❌ ${data.error || 'Execution failed'}`);
          onExecutionComplete?.(false);
          return;
        }

        addLog('');
        addLog('✅ Process exited with code 0');
        onExecutionComplete?.(true);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        addLog(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        onExecutionComplete?.(false);
      }
    }, [agentInstanceId, addLog, onExecutionComplete]);

    // Execute command (mock fallback when no container)
    const executeMock = useCallback(async (command: string, script?: string) => {
      addLog(`$ ${command}`);
      addLog('');

      // Detect if this is our VLA benchmark script
      if (script?.includes('VLA Model Benchmark') || script?.includes('SIMPLER-Env')) {
        await simulateBenchmarkOutput();
      } else if (script) {
        // Generic Python/JS script simulation
        const lines = script.split('\n');

        for (const line of lines) {
          if (abortControllerRef.current?.signal.aborted) break;

          const printMatches = [
            line.match(/print\("(.+?)"\)/),
            line.match(/print\('(.+?)'\)/),
            line.match(/print\(f"(.+?)"\)/),
            line.match(/print\(f'(.+?)'\)/),
            line.match(/console\.log\("(.+?)"\)/),
            line.match(/console\.log\('(.+?)'\)/),
          ];

          const printMatch = printMatches.find(m => m);

          if (printMatch) {
            const output = printMatch[1]
              .replace(/\{[^}]+\}/g, () => Math.random().toFixed(1))
              .replace(/\\n/g, '\n');
            addLog(output);
            await new Promise(r => setTimeout(r, 50));
          }

          const sleepMatch = line.match(/time\.sleep\(([\d.]+)\)/);
          if (sleepMatch) {
            await new Promise(r => setTimeout(r, parseFloat(sleepMatch[1]) * 1000));
          }
        }
      } else {
        addLog(`Running: ${command}`);
        await new Promise(r => setTimeout(r, 1000));
        addLog('Done.');
      }

      if (!abortControllerRef.current?.signal.aborted) {
        addLog('');
        addLog('✅ Process exited with code 0');
      }
      onExecutionComplete?.(true);
    }, [addLog, onExecutionComplete, simulateBenchmarkOutput]);

    // Main execute dispatcher
    const executeCommand = useCallback(async (command: string, script?: string) => {
      if (isRunning) {
        addLog('⚠️ Already running a command');
        return;
      }

      setIsRunning(true);
      abortControllerRef.current = new AbortController();

      try {
        if (agentInstanceId) {
          await executeViaContainer(command, script);
        } else {
          await executeMock(command, script);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Stopped by user
        } else {
          addLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          onExecutionComplete?.(false);
        }
      } finally {
        setIsRunning(false);
        abortControllerRef.current = null;
      }
    }, [isRunning, addLog, onExecutionComplete, agentInstanceId, executeViaContainer, executeMock]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      addLog,
      clearLogs,
      executeCommand,
      isRunning: () => isRunning,
      stop,
    }), [addLog, clearLogs, executeCommand, isRunning, stop]);

    return (
      <div className={`flex flex-col bg-slate-50 border border-slate-200 rounded-b-xl overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            {collapsible && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-800 transition-colors"
              >
                {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <span className="text-xs font-medium text-slate-700">{title}</span>
            {isRunning && (
              <span className="text-xs text-emerald-600 animate-pulse">● Running</span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {isRunning ? (
              <button
                onClick={stop}
                className="p-1.5 hover:bg-red-100 rounded text-red-600 hover:text-red-700 transition-colors"
                title="Stop"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={clearLogs}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-800 transition-colors"
                title="Clear"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Terminal Content */}
        {!isCollapsed && (
          <div className="flex-1 overflow-auto p-3 font-mono text-sm min-h-[150px] max-h-[300px] bg-white text-slate-800">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic">
                Terminal ready. Run a command to see output here.
              </div>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap ${
                    log.startsWith('$') ? 'text-cyan-700' :
                    log.startsWith('✅') ? 'text-green-700' :
                    log.startsWith('❌') ? 'text-red-600' :
                    log.startsWith('⚠️') ? 'text-amber-600' :
                    log.startsWith('🚀') || log.startsWith('📊') ? 'text-blue-700' :
                    'text-slate-700'
                  }`}
                >
                  {log || '\u00A0'}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    );
  }
);

ScriptTerminal.displayName = 'ScriptTerminal';

export default ScriptTerminal;
