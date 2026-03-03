/**
 * Event Bus - 模块间通信
 * 使用 mitt 实现简单的事件发布/订阅
 */

import mitt from 'mitt';
import type { KernelStatus, Output, AgentAction } from '../types';

/**
 * 事件类型定义
 */
export type JupyterEvents = {
  // Kernel 事件
  'kernel:status': { status: KernelStatus };
  'kernel:connected': { kernelId: string };
  'kernel:disconnected': Record<string, never>;
  
  // Cell 生命周期事件
  'cell:added': { cellId: string };
  'cell:deleted': { cellId: string };
  'cell:moved': { cellId: string; targetIndex: number };
  'cell:typeChanged': { cellId: string; newType: string };
  
  // 执行事件
  'cell:executing': { cellId: string };
  'cell:output': { cellId: string; output: Output };
  'cell:executed': { cellId: string; success: boolean; executionCount: number };
  'cell:error': { cellId: string; error: string };
  
  // Agent 编辑事件
  'cell:pendingEdit': { cellId: string; newSource: string };
  'cell:editConfirmed': { cellId: string };
  'cell:editRejected': { cellId: string };
  
  // 历史事件
  'history:undo': Record<string, never>;
  'history:redo': Record<string, never>;
  
  // Agent 事件
  'agent:action': { action: AgentAction };
  'agent:thinking': { message: string };
  'agent:complete': Record<string, never>;
};

/**
 * 创建事件总线实例
 */
export const eventBus = mitt<JupyterEvents>();

/**
 * 类型安全的事件发射
 */
export function emit<K extends keyof JupyterEvents>(
  type: K,
  event?: JupyterEvents[K]
): void {
  eventBus.emit(type, event as JupyterEvents[K]);
}

/**
 * 类型安全的事件订阅
 */
export function on<K extends keyof JupyterEvents>(
  type: K,
  handler: (event: JupyterEvents[K]) => void
): () => void {
  eventBus.on(type, handler as (event: JupyterEvents[K]) => void);
  return () => eventBus.off(type, handler as (event: JupyterEvents[K]) => void);
}

/**
 * 一次性事件订阅
 */
export function once<K extends keyof JupyterEvents>(
  type: K,
  handler: (event: JupyterEvents[K]) => void
): () => void {
  const wrappedHandler = (event: JupyterEvents[K]) => {
    eventBus.off(type, wrappedHandler as (event: JupyterEvents[K]) => void);
    handler(event);
  };
  eventBus.on(type, wrappedHandler as (event: JupyterEvents[K]) => void);
  return () => eventBus.off(type, wrappedHandler as (event: JupyterEvents[K]) => void);
}
