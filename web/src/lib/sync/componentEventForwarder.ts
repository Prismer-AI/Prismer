/**
 * Component Event Forwarder
 *
 * 将组件事件转发到 Agent Server
 *
 * 使用方式:
 * 1. WorkspaceView 调用 setComponentEventForwarder 设置转发函数
 * 2. 组件调用 forwardComponentEvent 报告事件
 * 3. 事件通过 WebSocket 发送到 Agent Server
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('EventForwarder');

type ComponentEventForwarder = (
  component: string,
  eventType: string,
  data?: unknown
) => void;

// 全局转发函数 (由 WorkspaceView 设置)
let globalForwarder: ComponentEventForwarder | null = null;

/**
 * 设置组件事件转发函数
 * 由顶层组件 (WorkspaceView) 在挂载时调用
 */
export function setComponentEventForwarder(forwarder: ComponentEventForwarder | null): void {
  globalForwarder = forwarder;
  if (forwarder) {
    log.info('Forwarder registered');
  } else {
    log.debug('Forwarder unregistered');
  }
}

/**
 * 转发组件事件到服务器
 * 组件在 ready/contentLoaded 等生命周期调用
 */
export function forwardComponentEvent(
  component: string,
  eventType: string,
  data?: unknown
): void {
  if (globalForwarder) {
    log.info('Forwarding component event', { component, eventType });
    globalForwarder(component, eventType, data);
  } else {
    log.debug('No forwarder, skipping event', { component, eventType });
  }
}

/**
 * 检查转发器是否已设置
 */
export function hasComponentEventForwarder(): boolean {
  return globalForwarder !== null;
}
