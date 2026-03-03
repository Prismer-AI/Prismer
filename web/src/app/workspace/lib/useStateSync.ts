'use client';

/**
 * useStateSync Hook
 * 
 * 用于在多个客户端之间同步状态的 Hook
 * 支持 iOS 模拟器和 macOS 桌面端共享 mock 数据变更
 * 
 * 使用方式:
 * 1. 启动同步服务器: npx tsx scripts/sync-server.ts
 * 2. 在组件中调用: const { isConnected, syncState } = useStateSync();
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useWorkspaceStore } from '../stores';

// 同步服务器配置
const SYNC_SERVER_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL || 'ws://localhost:3456';

// 消息类型
interface SyncMessage {
  type: string;
  payload?: unknown;
  timestamp: number;
  source?: string;
}

export function useStateSync(enabled: boolean = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [clientId] = useState(() => `client-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);
  
  // Store actions
  const addMessage = useWorkspaceStore((s) => s.addMessage);
  const setParticipants = useWorkspaceStore((s) => s.setParticipants);
  const setTasks = useWorkspaceStore((s) => s.setTasks);
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const markInteractionComplete = useWorkspaceStore((s) => s.markInteractionComplete);
  const reset = useWorkspaceStore((s) => s.reset);
  
  // 发送消息到服务器
  const sendMessage = useCallback((type: string, payload?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload, clientId }));
    }
  }, [clientId]);
  
  // 处理来自服务器的消息
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: SyncMessage = JSON.parse(event.data);
      
      // 忽略自己发送的消息
      if (message.source === clientId) return;
      
      console.log(`[StateSync] Received: ${message.type}`, message.payload);
      
      switch (message.type) {
        case 'FULL_STATE':
          // 接收完整状态
          const state = message.payload as {
            messages: any[];
            tasks: any[];
            participants: any[];
            completedInteractions: string[];
          };
          
          if (state.participants?.length) {
            setParticipants(state.participants);
          }
          if (state.tasks?.length) {
            setTasks(state.tasks);
          }
          // Messages are handled separately to preserve order
          state.messages?.forEach((msg) => {
            // Check if message already exists to avoid duplicates
            const store = useWorkspaceStore.getState();
            if (!store.messages.find(m => m.id === msg.id)) {
              addMessage(msg);
            }
          });
          state.completedInteractions?.forEach((id) => {
            markInteractionComplete(id);
          });
          break;
          
        case 'STATE_UPDATE':
          // 增量状态更新
          const updates = message.payload as Record<string, unknown>;
          if (updates.participants) {
            setParticipants(updates.participants as any[]);
          }
          if (updates.tasks) {
            setTasks(updates.tasks as any[]);
          }
          break;
          
        case 'ADD_MESSAGE':
          // 添加新消息
          const newMsg = message.payload as any;
          const currentStore = useWorkspaceStore.getState();
          if (!currentStore.messages.find(m => m.id === newMsg.id)) {
            addMessage(newMsg);
          }
          break;
          
        case 'UPDATE_TASK':
          // 更新任务
          const taskUpdate = message.payload as { id: string; [key: string]: any };
          updateTask(taskUpdate.id, taskUpdate);
          break;
          
        case 'INTERACTION':
          // 交互事件 - 同时标记完成并通知 demo 控制器
          const interaction = message.payload as { componentId: string; actionId?: string };
          markInteractionComplete(interaction.componentId);
          // 触发 demo 控制器推进（如果有等待的交互）
          if (interaction.actionId) {
            import('./demoFlowController').then(({ demoFlowController }) => {
              demoFlowController.handleInteraction(interaction.componentId, interaction.actionId!);
            });
          }
          break;
          
        case 'RESET':
          // 重置状态
          reset();
          break;
      }
    } catch (err) {
      console.error('[StateSync] Error handling message:', err);
    }
  }, [clientId, addMessage, setParticipants, setTasks, updateTask, markInteractionComplete, reset]);
  
  // 连接到同步服务器
  const connect = useCallback(() => {
    if (!enabled) return;
    
    try {
      console.log(`[StateSync] Connecting to ${SYNC_SERVER_URL}...`);
      const ws = new WebSocket(SYNC_SERVER_URL);
      
      ws.onopen = () => {
        console.log('[StateSync] Connected!');
        setIsConnected(true);
        wsRef.current = ws;
      };
      
      ws.onmessage = handleMessage;
      
      ws.onclose = () => {
        console.log('[StateSync] Disconnected');
        setIsConnected(false);
        wsRef.current = null;
        
        // 尝试重连
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[StateSync] Attempting to reconnect...');
            connect();
          }, 3000);
        }
      };
      
      ws.onerror = (err) => {
        console.error('[StateSync] WebSocket error:', err);
      };
      
    } catch (err) {
      console.error('[StateSync] Connection error:', err);
      
      // 尝试重连
      if (enabled) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    }
  }, [enabled, handleMessage]);
  
  // 初始化连接
  useEffect(() => {
    if (enabled) {
      connect();
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enabled, connect]);
  
  // 暴露同步方法
  const syncMessage = useCallback((message: any) => {
    sendMessage('ADD_MESSAGE', message);
  }, [sendMessage]);
  
  const syncTask = useCallback((task: { id: string; [key: string]: any }) => {
    sendMessage('UPDATE_TASK', task);
  }, [sendMessage]);
  
  const syncInteraction = useCallback((componentId: string, actionId: string) => {
    sendMessage('INTERACTION', { componentId, actionId });
  }, [sendMessage]);
  
  const syncFullState = useCallback((state: any) => {
    sendMessage('STATE_UPDATE', state);
  }, [sendMessage]);
  
  const requestFullState = useCallback(() => {
    sendMessage('REQUEST_FULL_STATE');
  }, [sendMessage]);
  
  const resetSync = useCallback(() => {
    sendMessage('RESET');
  }, [sendMessage]);
  
  return {
    isConnected,
    clientId,
    syncMessage,
    syncTask,
    syncInteraction,
    syncFullState,
    requestFullState,
    resetSync,
  };
}

export default useStateSync;
