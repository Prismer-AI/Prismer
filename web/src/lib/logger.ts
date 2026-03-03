/**
 * Unified Logger for Prismer.AI
 *
 * Structured logging with correlation IDs across frontend, backend, and bridge layers.
 *
 * Usage:
 *   import { createLogger } from '@/lib/logger';
 *   const log = createLogger('Bridge');
 *   log.info('Message sent', { workspaceId, messageId });
 *   log.error('Connection failed', { error: err.message });
 *
 * With correlation:
 *   const log = createLogger('Chat', { correlationId: 'req-abc123' });
 *   log.info('Processing message'); // includes correlationId in output
 *
 * Scoped child:
 *   const wsLog = log.child({ workspaceId: 'ws-123' });
 *   wsLog.info('Connected'); // inherits correlationId + workspaceId
 */

// ============================================================
// Types
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: LogContext;
  correlationId?: string;
  duration?: number;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Create a child logger with additional default context */
  child(defaultContext: LogContext): Logger;
  /** Time an operation and log its duration */
  time<T>(label: string, fn: () => T | Promise<T>, context?: LogContext): Promise<T>;
}

// ============================================================
// Configuration
// ============================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Global minimum log level (can be changed at runtime) */
let globalMinLevel: LogLevel = 'debug';

/** Whether to use structured JSON output (for server-side) */
let useStructuredOutput = false;

/** Event listeners for log entries (for aggregation/forwarding) */
type LogListener = (entry: LogEntry) => void;
const listeners: LogListener[] = [];

// ============================================================
// Public API: Configuration
// ============================================================

/** Set the minimum log level globally */
export function setLogLevel(level: LogLevel): void {
  globalMinLevel = level;
}

/** Enable structured JSON output (for server-side logging) */
export function setStructuredOutput(enabled: boolean): void {
  useStructuredOutput = enabled;
}

/** Add a listener for all log entries (for forwarding to external services) */
export function addLogListener(listener: LogListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/** Generate a correlation ID */
export function generateCorrelationId(): string {
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Log Ring Buffer (in-memory, last N entries)
// ============================================================

const LOG_BUFFER_SIZE = 200;
const logBuffer: LogEntry[] = [];

/** Get recent log entries (for debugging/display) */
export function getRecentLogs(count?: number): LogEntry[] {
  const n = count ?? LOG_BUFFER_SIZE;
  return logBuffer.slice(-n);
}

/** Get recent logs filtered by module */
export function getLogsByModule(module: string, count?: number): LogEntry[] {
  const filtered = logBuffer.filter((e) => e.module === module);
  return count ? filtered.slice(-count) : filtered;
}

/** Clear the log buffer */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

// ============================================================
// Internal: Log Output
// ============================================================

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // gray
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
};
const RESET = '\x1b[0m';

const LEVEL_BADGES: Record<LogLevel, string> = {
  debug: '🔍',
  info: '📋',
  warn: '⚠️',
  error: '❌',
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[globalMinLevel];
}

function formatEntry(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return;

  // Store in ring buffer
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Notify listeners
  for (const listener of listeners) {
    try { listener(entry); } catch { /* ignore listener errors */ }
  }

  // Output
  if (useStructuredOutput) {
    // Server-side: JSON line
    const line = JSON.stringify({
      ts: entry.timestamp,
      level: entry.level,
      mod: entry.module,
      msg: entry.message,
      ...entry.context,
      ...(entry.correlationId ? { cid: entry.correlationId } : {}),
      ...(entry.duration !== undefined ? { duration_ms: entry.duration } : {}),
    });
    // Use appropriate console method
    const method = entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log';
    console[method](line);
  } else {
    // Browser/dev: colored prefix format
    const isBrowser = typeof window !== 'undefined';
    const prefix = `[${entry.module}]`;
    const ctx = entry.context && Object.keys(entry.context).length > 0 ? entry.context : undefined;
    const cidStr = entry.correlationId ? ` (${entry.correlationId})` : '';
    const durStr = entry.duration !== undefined ? ` [${entry.duration}ms]` : '';

    if (isBrowser) {
      // Browser console with CSS styling
      const levelColors: Record<LogLevel, string> = {
        debug: 'color: #888',
        info: 'color: #0ea5e9',
        warn: 'color: #f59e0b',
        error: 'color: #ef4444; font-weight: bold',
      };
      const badge = LEVEL_BADGES[entry.level];
      const msg = `${badge} %c${prefix}%c ${entry.message}${cidStr}${durStr}`;
      const method: keyof Pick<Console, 'error' | 'warn' | 'debug' | 'log'> =
        entry.level === 'error'
          ? 'error'
          : entry.level === 'warn'
            ? 'warn'
            : entry.level === 'debug'
              ? 'debug'
              : 'log';
      if (ctx) {
        console[method](msg, `color: #8b5cf6; font-weight: bold`, '', ctx);
      } else {
        console[method](msg, `color: #8b5cf6; font-weight: bold`, '');
      }
    } else {
      // Node.js: ANSI colors
      const color = LEVEL_COLORS[entry.level];
      const msg = `${color}${entry.level.toUpperCase().padEnd(5)}${RESET} \x1b[35m${prefix}${RESET} ${entry.message}${cidStr}${durStr}`;
      const method = entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log';
      if (ctx) {
        console[method](msg, ctx);
      } else {
        console[method](msg);
      }
    }
  }
}

// ============================================================
// Logger Implementation
// ============================================================

function createLoggerImpl(module: string, defaultContext?: LogContext): Logger {
  const corrId = defaultContext?.correlationId as string | undefined;
  const baseContext = { ...defaultContext };
  delete baseContext.correlationId;

  function emit(level: LogLevel, message: string, context?: LogContext): void {
    const mergedContext = { ...baseContext, ...context };
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      context: Object.keys(mergedContext).length > 0 ? mergedContext : undefined,
      correlationId: corrId || (context?.correlationId as string | undefined),
    };
    formatEntry(entry);
  }

  const logger: Logger = {
    debug: (msg, ctx) => emit('debug', msg, ctx),
    info: (msg, ctx) => emit('info', msg, ctx),
    warn: (msg, ctx) => emit('warn', msg, ctx),
    error: (msg, ctx) => emit('error', msg, ctx),

    child(childContext: LogContext): Logger {
      return createLoggerImpl(module, {
        ...baseContext,
        ...(corrId ? { correlationId: corrId } : {}),
        ...childContext,
      });
    },

    async time<T>(label: string, fn: () => T | Promise<T>, context?: LogContext): Promise<T> {
      const start = performance.now();
      try {
        const result = await fn();
        const duration = Math.round(performance.now() - start);
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          module,
          message: label,
          context: { ...baseContext, ...context },
          correlationId: corrId,
          duration,
        };
        formatEntry(entry);
        return result;
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'error',
          module,
          message: `${label} (failed)`,
          context: { ...baseContext, ...context, error: err instanceof Error ? err.message : String(err) },
          correlationId: corrId,
          duration,
        };
        formatEntry(entry);
        throw err;
      }
    },
  };

  return logger;
}

/** Create a scoped logger for a module */
export function createLogger(module: string, defaultContext?: LogContext): Logger {
  return createLoggerImpl(module, defaultContext);
}

// ============================================================
// Convenience: Pre-built loggers for common modules
// ============================================================

/** Frontend loggers */
export const frontendLog = {
  workspace: createLogger('Workspace'),
  chat: createLogger('Chat'),
  windowView: createLogger('WindowView'),
  component: createLogger('Component'),
  store: createLogger('Store'),
};

/** Backend API loggers */
export const apiLog = {
  bridge: createLogger('Bridge'),
  workspace: createLogger('API:Workspace'),
  agent: createLogger('API:Agent'),
  skill: createLogger('API:Skill'),
  container: createLogger('API:Container'),
};

/** Sync/Bridge loggers */
export const syncLog = {
  engine: createLogger('SyncEngine'),
  connection: createLogger('Connection'),
  directive: createLogger('Directive'),
  im: createLogger('IM'),
};
