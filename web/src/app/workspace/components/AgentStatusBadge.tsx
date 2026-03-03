/**
 * AgentStatusBadge - Agent 状态指示器
 *
 * @description
 * 显示当前 Workspace 绑定的 Agent Instance 的运行状态。
 * 用于 ChatHeader、MobileHeader 等位置，提供快速状态反馈。
 *
 * 状态说明:
 * - idle: 灰色，未绑定或未启动
 * - starting: 黄色闪烁，启动中
 * - running: 绿色，正常运行
 * - stopped: 灰色，已停止
 * - error: 红色，出错
 *
 * @example
 * ```tsx
 * // 基础用法
 * <AgentStatusBadge />
 *
 * // 显示详细信息
 * <AgentStatusBadge showLabel />
 *
 * // 自定义大小
 * <AgentStatusBadge size="lg" />
 * ```
 */

'use client';

import { useAgentInstance } from '../stores/workspaceStore';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface AgentStatusBadgeProps {
  /** 是否显示状态文字标签 */
  showLabel?: boolean;
  /** 徽章大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 自定义类名 */
  className?: string;
}

// ============================================================
// Status Config
// ============================================================

/**
 * 状态配置映射
 * 定义每种状态对应的颜色、动画和标签
 */
const STATUS_CONFIG = {
  idle: {
    color: 'bg-gray-400',
    pulse: false,
    label: 'Idle',
    description: 'Agent not started',
  },
  starting: {
    color: 'bg-yellow-400',
    pulse: true,
    label: 'Starting',
    description: 'Agent is starting...',
  },
  running: {
    color: 'bg-green-500',
    pulse: false,
    label: 'Running',
    description: 'Agent is running',
  },
  stopped: {
    color: 'bg-gray-400',
    pulse: false,
    label: 'Stopped',
    description: 'Agent is stopped',
  },
  error: {
    color: 'bg-red-500',
    pulse: false,
    label: 'Error',
    description: 'Agent encountered an error',
  },
} as const;

/**
 * 大小配置
 */
const SIZE_CONFIG = {
  sm: {
    dot: 'h-2 w-2',
    text: 'text-xs',
  },
  md: {
    dot: 'h-2.5 w-2.5',
    text: 'text-sm',
  },
  lg: {
    dot: 'h-3 w-3',
    text: 'text-base',
  },
} as const;

// ============================================================
// Component
// ============================================================

export function AgentStatusBadge({
  showLabel = false,
  size = 'md',
  className,
}: AgentStatusBadgeProps) {
  const { status, hasAgent, error } = useAgentInstance();

  // 如果没有绑定 Agent，显示空状态
  if (!hasAgent) {
    return showLabel ? (
      <span className={cn('text-muted-foreground', SIZE_CONFIG[size].text, className)}>
        No Agent
      </span>
    ) : null;
  }

  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      title={error || config.description}
    >
      {/* Status Dot */}
      <span className="relative flex">
        <span
          className={cn(
            'rounded-full',
            sizeConfig.dot,
            config.color,
            config.pulse && 'animate-pulse'
          )}
        />
        {/* Pulse ring for starting state */}
        {config.pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              config.color
            )}
          />
        )}
      </span>

      {/* Status Label */}
      {showLabel && (
        <span
          className={cn(
            'font-medium',
            sizeConfig.text,
            status === 'error' ? 'text-red-500' : 'text-foreground'
          )}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}

export default AgentStatusBadge;
