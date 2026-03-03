/**
 * Container Types (Open-Source Slim)
 *
 * Core types for container health checks and status monitoring.
 */

// ============================================================
// Container Status
// ============================================================

export type ContainerState =
  | 'pending'      // 等待创建
  | 'creating'     // 创建中
  | 'running'      // 运行中
  | 'paused'       // 已暂停
  | 'stopping'     // 停止中
  | 'stopped'      // 已停止
  | 'error';       // 错误

export interface ContainerStatus {
  containerId: string;
  state: ContainerState;
  uptime?: number;
  startedAt?: Date;
  stoppedAt?: Date;
  resources?: {
    cpuPercent: number;
    memoryUsage: number;
    memoryLimit: number;
  };
  ports?: Array<{
    containerPort: number;
    hostPort: number;
    protocol: 'tcp' | 'udp';
  }>;
  exitCode?: number;
  error?: string;
}

// ============================================================
// Health Check
// ============================================================

export interface HealthCheckResult {
  healthy: boolean;
  checkedAt: Date;
  gateway: {
    connected: boolean;
    url?: string;
    latency?: number;
  };
  container: {
    running: boolean;
    uptime?: number;
  };
  versions?: Record<string, string>;
  versionCompatible?: boolean;
  details?: Record<string, unknown>;
  error?: string;
}
