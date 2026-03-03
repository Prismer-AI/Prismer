/**
 * Agent Server
 *
 * 服务端为中心的同步架构 - 核心服务器
 * 
 * 功能:
 * - Agent/DemoFlowController 在服务端运行
 * - 会话状态持久化
 * - 基于同步控制矩阵的消息路由
 * - 客户端能力管理
 *
 * 启动方式: npx tsx scripts/agent-server.ts
 */

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { SessionStore, createSessionStore } from './sessionStore';
import {
  SyncMatrixEngine,
  createSyncMatrixEngine,
  defaultSyncMatrix,
  DATA_TYPES,
} from '../src/lib/sync';
import type {
  ClientInfo,
  ClientConnection,
  SessionState,
  AgentState,
  ServerToClientMessage,
  ClientToServerMessage,
  StateDelta,
  UIDirective,
  EndpointType,
} from '../src/lib/sync/types';
import {
  generateSeedSession,
  generateSeedComponentStates,
  generateSeedMessages,
  generateSeedTasks,
  generateSeedParticipants,
  generateSeedTimeline,
} from './seedData';

// ============================================================
// Configuration
// ============================================================

const PORT = parseInt(process.env.AGENT_SERVER_PORT || '3456', 10);
const DEBUG = process.env.NODE_ENV === 'development';
const BRIDGE_MODE = process.env.AGENT_BRIDGE_MODE || 'auto'; // 'auto' | 'demo' | 'bridge'
const NEXT_API_BASE = process.env.NEXT_API_BASE || 'http://localhost:3000';

// ============================================================
// Types
// ============================================================

interface ServerClientConnection extends ClientConnection {
  ws: WebSocket;
}

interface DemoControllerCallbacks {
  onMessage: (message: unknown) => void;
  onTaskUpdate: (tasks: unknown[]) => void;
  onUIDirective: (directive: UIDirective) => void;
  onAgentStateChange: (state: Partial<AgentState>) => void;
  onTimelineEvent: (event: unknown) => void;
  onStateSnapshot: (snapshot: unknown) => void;
  onReset: () => void;  // 重置会话状态
}

// ============================================================
// Agent Server
// ============================================================

class AgentServer {
  private wss: WebSocketServer;
  private clients: Map<string, ServerClientConnection> = new Map();
  private sessions: SessionStore;
  private syncEngine: SyncMatrixEngine;
  private demoControllers: Map<string, DemoController> = new Map();
  private containerBridges: Map<string, ContainerBridge> = new Map();

  constructor(port: number) {
    // 初始化同步矩阵引擎
    this.syncEngine = createSyncMatrixEngine(defaultSyncMatrix);
    log(`Sync Matrix Engine initialized (${this.syncEngine.getStats().totalRules} rules)`);

    // 初始化会话存储
    this.sessions = createSessionStore({
      debug: DEBUG,
    });
    this.sessions.loadAll();

    // 创建 HTTP 服务器
    const server = createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // 创建 WebSocket 服务器
    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // 启动服务器
    server.listen(port, () => {
      console.log('═'.repeat(60));
      console.log('  🚀 Pisa Agent Server (Server-Centric Architecture)');
      console.log('═'.repeat(60));
      console.log(`  WebSocket:  ws://localhost:${port}`);
      console.log(`  Health:     http://localhost:${port}/health`);
      console.log(`  State:      http://localhost:${port}/state/:sessionId`);
      console.log(`  Matrix:     http://localhost:${port}/matrix`);
      console.log(`  Clients:    http://localhost:${port}/clients`);
      console.log(`  Demo:       http://localhost:${port}/demo/status`);
      console.log(`  Seed:       http://localhost:${port}/seed/info`);
      console.log(`  Monitor:    http://localhost:3000/admin/monitor`);
      console.log('═'.repeat(60));
      console.log(`  Bridge Mode: ${BRIDGE_MODE}`);
      console.log('  📦 Seed Data: 8 components initialized');
      console.log('═'.repeat(60));
      console.log('\nServer ready. Waiting for client connections...\n');
    });

    // 优雅关闭
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  // ==================== HTTP 端点 ====================

  private handleHttpRequest(req: any, res: any): void {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // 健康检查
    if (url.pathname === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        clients: this.clients.size,
        sessions: this.sessions.getAllSessionIds().length,
        uptime: process.uptime(),
      }));
      return;
    }

    // 获取会话状态
    if (url.pathname.startsWith('/state/')) {
      const sessionId = url.pathname.slice(7);
      const session = this.sessions.get(sessionId);
      if (session) {
        res.writeHead(200);
        res.end(JSON.stringify(session));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Session not found' }));
      }
      return;
    }

    // 获取同步矩阵
    if (url.pathname === '/matrix') {
      res.writeHead(200);
      res.end(JSON.stringify({
        version: this.syncEngine.getVersion(),
        stats: this.syncEngine.getStats(),
        rules: this.syncEngine.getAllRules().map(r => ({
          dataType: r.dataType,
          description: r.description,
          persistence: r.persistence.strategy,
          sync: r.sync.direction,
        })),
      }));
      return;
    }

    // Demo 控制: 启动（重置并开始）
    if (url.pathname === '/demo/start' && req.method === 'POST') {
      const sessionId = url.searchParams.get('session') || 'default';

      // 重置会话（停止旧控制器、清空数据、重建并启动新控制器）
      this.resetSession(sessionId);
      log(`Demo started for session: ${sessionId}`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, message: 'Demo started', sessionId }));
      return;
    }

    // Demo 控制: 重置
    if (url.pathname === '/demo/reset' && req.method === 'POST') {
      const sessionId = url.searchParams.get('session') || 'default';
      
      // 使用现有的 resetSession 方法（会清理并重新创建）
      this.resetSession(sessionId);
      log(`Demo reset for session: ${sessionId}`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, message: 'Demo reset', sessionId }));
      return;
    }

    // Demo 控制: 下一步
    if (url.pathname === '/demo/next-step' && req.method === 'POST') {
      const sessionId = url.searchParams.get('session') || 'default';
      let controller = this.demoControllers.get(sessionId);

      // 如果控制器不存在，先创建会话和控制器（使用种子数据）
      if (!controller) {
        const seedData = generateSeedSession();
        this.sessions.getOrCreate(sessionId, {
          participants: seedData.participants as unknown[],
          tasks: seedData.tasks as unknown[],
          messages: seedData.messages as unknown[],
          timeline: seedData.timeline as unknown[],
          componentStates: seedData.componentStates,
          agentState: seedData.agentState as AgentState,
        });
        this.startDemoController(sessionId);
        controller = this.demoControllers.get(sessionId);
      }
      
      if (controller) {
        controller.triggerNextStep();
        log(`Demo next step triggered for session: ${sessionId}`);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Next step triggered', sessionId }));
      } else {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to create demo controller' }));
      }
      return;
    }

    // Demo 控制: 清空客户端消息
    if (url.pathname === '/demo/clear-messages' && req.method === 'POST') {
      const sessionId = url.searchParams.get('session') || 'default';
      
      // 清空会话中的消息
      const session = this.sessions.get(sessionId);
      if (session) {
        session.messages = [];
        this.sessions.save(session);
      }
      
      // 广播清空消息指令给所有客户端
      const clearDirective = {
        type: 'UI_DIRECTIVE',
        payload: {
          id: `directive-clear-${Date.now()}`,
          type: 'CLEAR_MESSAGES',
          payload: { sessionId },
          targetCapabilities: ['full_ui', 'chat_ui'],
        },
      };
      
      // 发送给所有连接的客户端
      for (const client of this.clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify(clearDirective));
        }
      }
      
      log(`Messages cleared for session: ${sessionId}`);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, message: 'Messages cleared', sessionId }));
      return;
    }

    // Demo 控制: 获取状态
    if (url.pathname === '/demo/status') {
      const sessionId = url.searchParams.get('session') || 'default';
      const controller = this.demoControllers.get(sessionId);
      const session = this.sessions.get(sessionId);
      res.writeHead(200);
      res.end(JSON.stringify({
        sessionId,
        hasController: !!controller,
        agentState: session?.agentState || null,
        messagesCount: session?.messages?.length || 0,
        tasksCount: session?.tasks?.length || 0,
      }));
      return;
    }

    // 种子数据: 获取当前种子数据信息
    if (url.pathname === '/seed/info') {
      const seedData = generateSeedSession();
      res.writeHead(200);
      res.end(JSON.stringify({
        version: seedData.metadata.seedVersion,
        generatedAt: seedData.metadata.generatedAt,
        source: seedData.metadata.source,
        components: Object.keys(seedData.componentStates),
        participantsCount: seedData.participants.length,
        messagesCount: seedData.messages.length,
        tasksCount: seedData.tasks.length,
        timelineCount: seedData.timeline.length,
      }));
      return;
    }

    // 种子数据: 获取特定组件的种子数据
    if (url.pathname.startsWith('/seed/component/')) {
      const componentType = url.pathname.slice(16);
      const seedData = generateSeedSession();
      const componentState = seedData.componentStates[componentType];
      if (componentState) {
        res.writeHead(200);
        res.end(JSON.stringify({
          component: componentType,
          state: componentState,
        }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({
          error: `Component '${componentType}' not found`,
          availableComponents: Object.keys(seedData.componentStates),
        }));
      }
      return;
    }

    // 桥接状态
    if (url.pathname === '/bridges') {
      const bridges = Array.from(this.containerBridges.entries()).map(([sid, b]) => ({
        sessionId: sid,
        connected: b.connected,
      }));
      res.writeHead(200);
      res.end(JSON.stringify({
        mode: BRIDGE_MODE,
        bridges,
        demoControllers: this.demoControllers.size,
      }));
      return;
    }

    // 获取所有客户端
    if (url.pathname === '/clients') {
      const clients = Array.from(this.clients.values()).map(c => ({
        id: c.clientId,
        type: c.clientType,
        sessionId: c.sessionId,
        capabilities: c.capabilities,
        connectedAt: c.connectedAt,
      }));
      res.writeHead(200);
      res.end(JSON.stringify({ clients }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  // ==================== WebSocket 连接管理 ====================

  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    log(`New connection from ${req.socket.remoteAddress}`);

    // 等待客户端注册
    const registrationTimeout = setTimeout(() => {
      log(`Client ${clientId} failed to register in time`);
      ws.close(1008, 'Registration timeout');
    }, 10000);

    ws.once('message', (data) => {
      clearTimeout(registrationTimeout);
      
      try {
        const msg: ClientToServerMessage = JSON.parse(data.toString());
        
        if (msg.type === 'REGISTER_CLIENT') {
          this.registerClient(clientId, ws, req, msg.payload);
        } else {
          ws.close(1008, 'Expected REGISTER_CLIENT message');
        }
      } catch (err) {
        log(`Invalid registration message from ${clientId}:`, err);
        ws.close(1008, 'Invalid message format');
      }
    });

    ws.on('error', (err) => {
      log(`WebSocket error for ${clientId}:`, err);
    });
  }

  private registerClient(
    clientId: string,
    ws: WebSocket,
    req: any,
    payload: Omit<ClientInfo, 'clientId' | 'connectedAt'>
  ): void {
    // 从 URL 获取 sessionId
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const sessionId = url.searchParams.get('session') || 'default';

    const client: ServerClientConnection = {
      clientId,
      sessionId,
      clientType: payload.clientType as EndpointType,
      capabilities: payload.capabilities,
      platform: payload.platform,
      version: payload.version,
      connectedAt: Date.now(),
      ws,
    };

    this.clients.set(clientId, client);

    log(`✓ Client registered: ${clientId}`);
    log(`  Type: ${client.clientType}, Session: ${sessionId}`);
    log(`  Capabilities: ${client.capabilities.join(', ')}`);
    log(`  Total clients: ${this.clients.size}`);

    // 获取或创建会话（使用种子数据初始化所有组件状态）
    const seedData = generateSeedSession();
    const session = this.sessions.getOrCreate(sessionId, {
      participants: seedData.participants as unknown[],
      tasks: seedData.tasks as unknown[],
      messages: seedData.messages as unknown[],
      timeline: seedData.timeline as unknown[],
      componentStates: seedData.componentStates,
      agentState: seedData.agentState as AgentState,
    });

    // 确保已有会话也包含种子组件状态（防止旧持久化文件缺少组件数据）
    const existingComponents = Object.keys(session.componentStates || {});
    const seedComponents = Object.keys(seedData.componentStates);
    if (existingComponents.length < seedComponents.length) {
      session.componentStates = { ...seedData.componentStates, ...session.componentStates };
      log(`  Merged seed data: ${seedComponents.length - existingComponents.length} missing components added`);
    }

    log(`  Session ready: ${Object.keys(session.componentStates).length} components`);

    // 发送完整状态（包含所有组件的种子数据）
    this.sendToClient(clientId, {
      type: 'FULL_STATE',
      payload: session,
    });

    // 确保控制器运行（优先尝试容器桥接）
    if (!this.containerBridges.has(sessionId) && !this.demoControllers.has(sessionId)) {
      this.initSessionController(sessionId);
    }

    // 设置消息处理
    ws.on('message', (data) => {
      try {
        const msg: ClientToServerMessage = JSON.parse(data.toString());
        this.handleClientMessage(clientId, msg);
      } catch (err) {
        log(`Invalid message from ${clientId}:`, err);
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);
    log(`✗ Client disconnected: ${clientId}`);
    log(`  Remaining clients: ${this.clients.size}`);

    // 注意：不停止 Demo 控制器！Agent 继续运行
    // 只有当所有客户端都断开很长时间后才考虑暂停
  }

  // ==================== 消息处理 ====================

  private handleClientMessage(clientId: string, msg: ClientToServerMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const session = this.sessions.get(client.sessionId);
    if (!session) return;

    log(`← [${client.clientType}] ${msg.type}`);

    switch (msg.type) {
      case 'USER_MESSAGE':
        this.handleUserMessage(client, session, msg.payload);
        break;

      case 'USER_INTERACTION':
        this.handleUserInteraction(client, session, msg.payload);
        break;

      case 'USER_COMMAND':
        this.handleUserCommand(client, session, msg.payload);
        break;

      case 'REQUEST_FULL_STATE':
        this.sendToClient(clientId, { type: 'FULL_STATE', payload: session });
        break;

      case 'COMPONENT_EVENT':
        this.handleComponentEvent(client, session, msg.payload);
        break;

      case 'SYNC_DATA':
        this.handleSyncData(client, session, msg.payload);
        break;
    }
  }

  private handleUserMessage(
    client: ServerClientConnection,
    session: SessionState,
    payload: { content: string; metadata?: unknown }
  ): void {
    // 检查权限
    if (!this.syncEngine.canClientAccess(DATA_TYPES.MESSAGES, client, 'write')) {
      log(`Permission denied: ${client.clientType} cannot write messages`);
      return;
    }

    // 创建用户消息
    const userMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: session.sessionId,
      senderId: 'user-1',
      senderType: 'user',
      senderName: 'Me',
      content: payload.content,
      contentType: 'text',
      timestamp: new Date().toISOString(),
      metadata: payload.metadata,
    };

    // 保存到会话
    this.sessions.addMessage(session.sessionId, userMessage);

    // 广播给其他客户端
    this.broadcastDelta(session.sessionId, client.clientId, {
      messages: { added: [userMessage] },
    });

    // Forward to ContainerBridge if available, otherwise let DemoController handle
    const bridge = this.containerBridges.get(session.sessionId);
    if (bridge && bridge.connected) {
      log(`[UserMessage] Forwarding to ContainerBridge for session: ${session.sessionId}`);
      bridge.sendUserMessage(payload.content);
    } else {
      log(`[UserMessage] No container bridge for session: ${session.sessionId}`);
      // DemoController doesn't process user messages yet (it's step-driven)
    }
  }

  private handleUserInteraction(
    client: ServerClientConnection,
    session: SessionState,
    payload: { componentId: string; actionId: string; data?: unknown }
  ): void {
    log(`  Interaction: ${payload.componentId}:${payload.actionId}`);

    // 检查权限
    if (!this.syncEngine.canClientAccess(DATA_TYPES.COMPLETED_INTERACTIONS, client, 'write')) {
      log(`Permission denied: ${client.clientType} cannot trigger interactions`);
      return;
    }

    // 通知 Demo 控制器
    const controller = this.demoControllers.get(client.sessionId);
    if (controller) {
      controller.handleInteraction(payload.componentId, payload.actionId);
    }

    // 标记交互完成
    this.sessions.addCompletedInteraction(session.sessionId, payload.componentId);

    // 广播给所有客户端
    this.broadcastDelta(session.sessionId, null, {
      completedInteractions: { added: [payload.componentId] },
    });
  }

  private handleUserCommand(
    client: ServerClientConnection,
    session: SessionState,
    payload: { command: 'reset' | 'pause' | 'resume'; args?: unknown }
  ): void {
    log(`  Command: ${payload.command}`);

    const controller = this.demoControllers.get(client.sessionId);

    switch (payload.command) {
      case 'reset':
        this.resetSession(client.sessionId);
        break;
      case 'pause':
        controller?.pause();
        break;
      case 'resume':
        controller?.resume();
        break;
    }
  }

  private handleComponentEvent(
    client: ServerClientConnection,
    session: SessionState,
    payload: any
  ): void {
    // 组件事件报告，用于等待组件完成
    const controller = this.demoControllers.get(client.sessionId);
    if (controller) {
      controller.handleComponentEvent(payload);
    }
  }

  private handleSyncData(
    client: ServerClientConnection,
    session: SessionState,
    payload: { dataType: string; data: unknown }
  ): void {
    const { dataType, data } = payload;

    // 检查权限
    if (!this.syncEngine.canClientAccess(dataType, client, 'write')) {
      log(`Permission denied: ${client.clientType} cannot write ${dataType}`);
      return;
    }

    // 根据数据类型处理
    switch (dataType) {
      case DATA_TYPES.TIMELINE:
        this.sessions.addTimelineEvent(session.sessionId, data);
        this.broadcastDelta(session.sessionId, client.clientId, {
          timeline: { added: [data] },
        });
        break;

      case DATA_TYPES.STATE_SNAPSHOTS:
        this.sessions.addStateSnapshot(session.sessionId, data);
        this.broadcastDelta(session.sessionId, client.clientId, {
          stateSnapshots: { added: [data] },
        });
        break;

      case DATA_TYPES.COMPONENT_STATES:
        const componentData = data as Record<string, unknown>;
        for (const [component, state] of Object.entries(componentData)) {
          this.sessions.updateComponentState(session.sessionId, component, state);
        }
        this.broadcastDelta(session.sessionId, client.clientId, {
          componentStates: componentData,
        });
        break;
    }
  }

  // ==================== 广播和发送 ====================

  private broadcastDelta(
    sessionId: string,
    sourceClientId: string | null,
    delta: StateDelta
  ): void {
    const clients = this.getSessionClients(sessionId);

    for (const client of clients) {
      if (client.clientId === sourceClientId) continue;

      // 根据同步矩阵过滤数据
      const filteredDelta = this.filterDeltaForClient(delta, client);
      if (Object.keys(filteredDelta).length > 0) {
        this.sendToClient(client.clientId, {
          type: 'STATE_DELTA',
          payload: filteredDelta,
        });
      }
    }
  }

  private filterDeltaForClient(delta: StateDelta, client: ServerClientConnection): StateDelta {
    const filtered: StateDelta = {};

    if (delta.messages && this.syncEngine.canClientAccess(DATA_TYPES.MESSAGES, client, 'read')) {
      filtered.messages = delta.messages;
    }

    if (delta.tasks && this.syncEngine.canClientAccess(DATA_TYPES.TASKS, client, 'read')) {
      filtered.tasks = delta.tasks;
    }

    if (delta.completedInteractions && this.syncEngine.canClientAccess(DATA_TYPES.COMPLETED_INTERACTIONS, client, 'read')) {
      filtered.completedInteractions = delta.completedInteractions;
    }

    if (delta.timeline && this.syncEngine.canClientAccess(DATA_TYPES.TIMELINE, client, 'read')) {
      filtered.timeline = delta.timeline;
    }

    if (delta.stateSnapshots && this.syncEngine.canClientAccess(DATA_TYPES.STATE_SNAPSHOTS, client, 'read')) {
      filtered.stateSnapshots = delta.stateSnapshots;
    }

    if (delta.componentStates && this.syncEngine.canClientAccess(DATA_TYPES.COMPONENT_STATES, client, 'read')) {
      // 对于 partial 模式，需要进一步过滤
      const config = this.syncEngine.getRule(DATA_TYPES.COMPONENT_STATES)?.endpoints[client.clientType];
      if (config?.access === 'partial' && config.filter) {
        const filteredStates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(delta.componentStates)) {
          if (config.filter.includes(key)) {
            filteredStates[key] = value;
          }
        }
        if (Object.keys(filteredStates).length > 0) {
          filtered.componentStates = filteredStates;
        }
      } else {
        filtered.componentStates = delta.componentStates;
      }
    }

    if (delta.agentState && this.syncEngine.canClientAccess(DATA_TYPES.AGENT_STATE, client, 'read')) {
      filtered.agentState = delta.agentState;
    }

    return filtered;
  }

  private sendUIDirective(sessionId: string, directive: UIDirective): void {
    const clients = this.getSessionClients(sessionId);

    for (const client of clients) {
      if (this.canExecuteDirective(client, directive)) {
        this.sendToClient(client.clientId, {
          type: 'UI_DIRECTIVE',
          payload: directive,
        });
        log(`→ [${client.clientType}] UI_DIRECTIVE: ${directive.type}`);
      }
    }
  }

  private canExecuteDirective(client: ServerClientConnection, directive: UIDirective): boolean {
    // 检查目标能力
    if (directive.targetCapabilities && directive.targetCapabilities.length > 0) {
      return directive.targetCapabilities.some(cap => client.capabilities.includes(cap));
    }

    // 默认能力映射
    switch (directive.type) {
      case 'SWITCH_COMPONENT':
      case 'LOAD_DOCUMENT':
        return client.capabilities.includes('full_ui');
      case 'SHOW_NOTIFICATION':
      case 'UPDATE_TASK_STATUS':
      case 'HIGHLIGHT_MESSAGE':
        return true;
      default:
        return false;
    }
  }

  private sendToClient(clientId: string, message: ServerToClientMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private getSessionClients(sessionId: string): ServerClientConnection[] {
    return Array.from(this.clients.values())
      .filter(c => c.sessionId === sessionId);
  }

  // ==================== Session Controller Routing ====================

  /**
   * Initialize the appropriate controller for a session.
   * In 'auto' mode: try to find a running container for the workspace, use bridge if available.
   * In 'demo' mode: always use DemoController.
   * In 'bridge' mode: always try ContainerBridge (fail if no container).
   */
  private async initSessionController(sessionId: string): Promise<void> {
    if (BRIDGE_MODE === 'demo') {
      this.startDemoController(sessionId);
      return;
    }

    // Try to find a container for this workspace
    log(`[Router] Checking container binding for session: ${sessionId}`);
    const agentBinding = await fetchAgentBinding(sessionId);

    if (agentBinding && agentBinding.status === 'running' && agentBinding.gatewayUrl) {
      log(`[Router] Found running container for ${sessionId}: ${agentBinding.gatewayUrl}`);
      const success = await this.startContainerBridge(
        sessionId,
        agentBinding.gatewayUrl,
        agentBinding.container?.hostPort || 0
      );

      if (success) {
        log(`[Router] ContainerBridge active for ${sessionId}`);
        return;
      }

      log(`[Router] ContainerBridge failed, falling back to demo for ${sessionId}`);
    } else {
      log(`[Router] No running container for ${sessionId} (status: ${agentBinding?.status || 'none'})`);
    }

    // Fallback to demo mode
    if (BRIDGE_MODE !== 'bridge') {
      this.startDemoController(sessionId);
    }
  }

  /**
   * Start a ContainerBridge for a session
   */
  private async startContainerBridge(
    sessionId: string,
    gatewayUrl: string,
    hostPort: number
  ): Promise<boolean> {
    const callbacks = this.createControllerCallbacks(sessionId);
    const bridge = new ContainerBridge(gatewayUrl, hostPort, callbacks, sessionId);

    const connected = await bridge.connect();
    if (connected) {
      this.containerBridges.set(sessionId, bridge);
      return true;
    }

    bridge.disconnect();
    return false;
  }

  // ==================== Demo 控制器 ====================

  /**
   * Create shared controller callbacks for a session
   */
  private createControllerCallbacks(sessionId: string): DemoControllerCallbacks {
    return {
      onMessage: (message) => {
        this.sessions.addMessage(sessionId, message);
        this.broadcastDelta(sessionId, null, {
          messages: { added: [message] },
        });
      },

      onTaskUpdate: (tasks) => {
        this.sessions.setTasks(sessionId, tasks);
        this.broadcastDelta(sessionId, null, { tasks });
      },

      onUIDirective: (directive) => {
        this.sendUIDirective(sessionId, directive);
      },

      onAgentStateChange: (state) => {
        this.sessions.updateAgentState(sessionId, state);
        this.broadcastDelta(sessionId, null, { agentState: state });
      },

      onTimelineEvent: (event) => {
        this.sessions.addTimelineEvent(sessionId, event);
        this.broadcastDelta(sessionId, null, {
          timeline: { added: [event] },
        });
      },

      onStateSnapshot: (snapshot) => {
        this.sessions.addStateSnapshot(sessionId, snapshot);
        this.broadcastDelta(sessionId, null, {
          stateSnapshots: { added: [snapshot] },
        });
      },

      onReset: () => {
        // 重置会话状态
        this.sessions.delete(sessionId);
        const session = this.sessions.getOrCreate(sessionId, {
          participants: this.getDefaultParticipants(),
          tasks: this.getDefaultTasks(),
        });

        // 广播完整状态给所有客户端
        for (const client of this.getSessionClients(sessionId)) {
          this.sendToClient(client.clientId, {
            type: 'FULL_STATE',
            payload: session,
          });
        }
        log(`Session ${sessionId} state reset and broadcasted`);
      },
    };
  }

  private startDemoController(sessionId: string): void {
    log(`Starting demo controller for session: ${sessionId}`);

    const callbacks = this.createControllerCallbacks(sessionId);
    const controller = new DemoController(callbacks);
    this.demoControllers.set(sessionId, controller);

    // 延迟启动
    setTimeout(() => {
      controller.start();
    }, 500);
  }

  private resetSession(sessionId: string): void {
    log(`Resetting session: ${sessionId}`);

    // 停止容器桥接
    const bridge = this.containerBridges.get(sessionId);
    if (bridge) {
      bridge.disconnect();
      this.containerBridges.delete(sessionId);
    }

    // 停止现有控制器
    const controller = this.demoControllers.get(sessionId);
    if (controller) {
      controller.stop();
      this.demoControllers.delete(sessionId);
    }

    // 重新创建会话（使用种子数据）
    this.sessions.delete(sessionId);
    const seedData = generateSeedSession();
    const session = this.sessions.getOrCreate(sessionId, {
      participants: seedData.participants as unknown[],
      tasks: seedData.tasks as unknown[],
      messages: seedData.messages as unknown[],
      timeline: seedData.timeline as unknown[],
      componentStates: seedData.componentStates,
      agentState: seedData.agentState as AgentState,
    });

    log(`  Seed data reloaded: ${Object.keys(seedData.componentStates).length} components`);

    // 广播完整状态
    for (const client of this.getSessionClients(sessionId)) {
      this.sendToClient(client.clientId, {
        type: 'FULL_STATE',
        payload: session,
      });
    }

    // 重新启动控制器
    this.startDemoController(sessionId);
  }

  // ==================== 默认数据 ====================

  private getDefaultParticipants(): unknown[] {
    return [
      { id: 'user-1', name: 'Me', type: 'user', status: 'online', role: 'owner' },
      { id: 'agent-research', name: 'Aria (Research)', type: 'agent', status: 'online', role: 'agent' },
      { id: 'agent-code', name: 'CodeBot', type: 'agent', status: 'online', role: 'agent' },
      { id: 'agent-writing', name: 'Quill (Writing)', type: 'agent', status: 'online', role: 'agent' },
    ];
  }

  private getDefaultTasks(): unknown[] {
    return [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        description: 'Analyze VLA-RAIL paper, generate visualizations, write experiment section',
        status: 'pending',
        progress: 0,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'pending' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'pending' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'pending' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'pending' },
        ],
      },
    ];
  }

  // ==================== 生命周期 ====================

  private async shutdown(): Promise<void> {
    console.log('\n\nShutting down...');

    // 停止所有容器桥接
    for (const bridge of this.containerBridges.values()) {
      bridge.disconnect();
    }
    this.containerBridges.clear();

    // 停止所有 Demo 控制器
    for (const controller of this.demoControllers.values()) {
      controller.stop();
    }

    // 关闭所有连接
    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }

    // 保存会话数据
    await this.sessions.close();

    // 关闭 WebSocket 服务器
    this.wss.close();

    console.log('Server shutdown complete');
    process.exit(0);
  }
}

// ============================================================
// Container Bridge (OpenClaw Gateway proxy)
// ============================================================

/**
 * ContainerBridge connects to a real OpenClaw container's WebSocket gateway
 * and translates between the Prismer sync protocol and OpenClaw protocol.
 *
 * When a user sends a message, the bridge forwards it to the container.
 * When the container responds, the bridge translates it back to a chat message.
 */
class ContainerBridge {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMessages: string[] = [];
  private messageIdCounter = 0;

  constructor(
    private gatewayUrl: string,
    private containerHostPort: number,
    private callbacks: DemoControllerCallbacks,
    private sessionId: string
  ) {}

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        log(`[ContainerBridge] Connecting to OpenClaw gateway: ${this.gatewayUrl}`);
        this.ws = new WebSocket(this.gatewayUrl);

        const timeout = setTimeout(() => {
          log('[ContainerBridge] Connection timeout');
          this.ws?.close();
          resolve(false);
        }, 10000);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          log('[ContainerBridge] Connected to OpenClaw gateway');

          // Notify agent state
          this.callbacks.onAgentStateChange({ status: 'running' });

          // Flush pending messages
          for (const msg of this.pendingMessages) {
            this.ws?.send(msg);
          }
          this.pendingMessages = [];

          resolve(true);
        });

        this.ws.on('message', (data: Buffer | string) => {
          this.handleGatewayMessage(data.toString());
        });

        this.ws.on('close', () => {
          this.isConnected = false;
          log('[ContainerBridge] Disconnected from OpenClaw gateway');
          this.callbacks.onAgentStateChange({ status: 'idle' });
        });

        this.ws.on('error', (err: Error) => {
          log('[ContainerBridge] WebSocket error:', err.message);
          clearTimeout(timeout);
          resolve(false);
        });
      } catch (err) {
        log('[ContainerBridge] Failed to connect:', err);
        resolve(false);
      }
    });
  }

  /**
   * Send a user message to the OpenClaw container
   */
  async sendUserMessage(content: string): Promise<void> {
    const message = JSON.stringify({
      type: 'message',
      payload: {
        sessionId: this.sessionId,
        content,
        role: 'user',
      },
      timestamp: Date.now(),
    });

    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      this.pendingMessages.push(message);
      // Try to reconnect
      if (!this.isConnected) {
        this.connect();
      }
    }

    // Update agent state to show it's processing
    this.callbacks.onAgentStateChange({ status: 'running' });
  }

  /**
   * Handle messages received from the OpenClaw gateway
   */
  private handleGatewayMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      log(`[ContainerBridge] ← ${message.type}`);

      switch (message.type) {
        case 'connect.challenge':
          // Handle HMAC auth challenge
          this.handleAuthChallenge(message.payload);
          break;

        case 'connect.success':
          log('[ContainerBridge] Auth successful');
          break;

        case 'message': {
          // Agent response message
          const payload = message.payload;
          if (payload?.content || payload?.delta) {
            this.handleAgentResponse(payload);
          }
          break;
        }

        case 'tool_call': {
          // Agent is calling a tool
          const payload = message.payload;
          this.callbacks.onMessage({
            id: `msg-${Date.now()}-${this.messageIdCounter++}`,
            workspaceId: this.sessionId,
            senderId: 'agent-openclaw',
            senderType: 'agent',
            senderName: 'OpenClaw Agent',
            content: `🔧 Using tool: **${payload?.name || 'unknown'}**`,
            contentType: 'text',
            timestamp: new Date().toISOString(),
            actions: [{
              id: `action-${Date.now()}`,
              type: 'tool_use',
              status: 'running',
              description: payload?.name || 'Executing tool...',
              timestamp: new Date().toISOString(),
            }],
          });
          break;
        }

        case 'tool_result': {
          // Tool finished
          log('[ContainerBridge] Tool result received');
          break;
        }

        case 'state_update': {
          // Agent state change
          const payload = message.payload;
          if (payload?.agentState) {
            this.callbacks.onAgentStateChange(payload.agentState);
          }
          break;
        }

        case 'error': {
          const payload = message.payload;
          this.callbacks.onMessage({
            id: `msg-${Date.now()}-${this.messageIdCounter++}`,
            workspaceId: this.sessionId,
            senderId: 'system',
            senderType: 'system',
            senderName: 'System',
            content: `⚠️ Error: ${payload?.message || 'Unknown error'}`,
            contentType: 'text',
            timestamp: new Date().toISOString(),
          });
          break;
        }

        case 'pong':
          // Heartbeat response, ignore
          break;

        default:
          log(`[ContainerBridge] Unhandled message type: ${message.type}`);
      }
    } catch (err) {
      log('[ContainerBridge] Failed to parse message:', err);
    }
  }

  /**
   * Handle OpenClaw HMAC auth challenge
   */
  private handleAuthChallenge(payload: { nonce?: string }): void {
    // For MVP, send an empty/unsigned response
    // The container's auth may be configured to accept any response in dev mode
    log('[ContainerBridge] Auth challenge received, sending response');
    const response = JSON.stringify({
      type: 'connect.response',
      payload: {
        nonce: payload?.nonce || '',
        signature: '', // TODO: Implement HMAC-SHA256 signing with container auth key
      },
    });
    this.ws?.send(response);
  }

  /**
   * Translate OpenClaw agent response to Prismer chat message
   */
  private handleAgentResponse(payload: {
    content?: string;
    delta?: string;
    messageId?: string;
    isFinal?: boolean;
    role?: string;
  }): void {
    const content = payload.content || payload.delta || '';

    if (!content) return;

    // Create a chat message for the response
    this.callbacks.onMessage({
      id: payload.messageId || `msg-${Date.now()}-${this.messageIdCounter++}`,
      workspaceId: this.sessionId,
      senderId: 'agent-openclaw',
      senderType: 'agent',
      senderName: 'OpenClaw Agent',
      content,
      contentType: 'text',
      timestamp: new Date().toISOString(),
    });

    // If this is a final message, agent is back to idle
    if (payload.isFinal !== false) {
      this.callbacks.onAgentStateChange({ status: 'idle' });
    }
  }

  /**
   * Check if the bridge is connected to the container
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from the container
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }
}

/**
 * Fetch agent binding info from the Next.js API
 */
async function fetchAgentBinding(workspaceId: string): Promise<{
  id: string;
  status: string;
  gatewayUrl?: string;
  container?: { hostPort?: number; orchestrator?: string; status?: string };
} | null> {
  try {
    const res = await fetch(`${NEXT_API_BASE}/api/workspace/${workspaceId}/agent`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (err) {
    log('[fetchAgentBinding] Failed to fetch agent binding:', err);
    return null;
  }
}

// ============================================================
// Demo Controller (简化版，服务端运行)
// ============================================================

class DemoController {
  private callbacks: DemoControllerCallbacks;
  private isRunning = false;
  private isPaused = false;
  private currentStep = -1;
  private interactionResolvers: Map<string, () => void> = new Map();

  constructor(callbacks: DemoControllerCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.isPaused = false;
    this.currentStep = -1;
    
    log('Demo controller started');
    this.callbacks.onAgentStateChange({ status: 'running', currentStep: 0 });
    
    this.advanceToNextStep();
  }

  pause(): void {
    this.isPaused = true;
    this.callbacks.onAgentStateChange({ status: 'paused' });
    log('Demo controller paused');
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.callbacks.onAgentStateChange({ status: 'running' });
    log('Demo controller resumed');
  }

  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.interactionResolvers.clear();
    this.callbacks.onAgentStateChange({ status: 'idle' });
    log('Demo controller stopped');
  }

  reset(): void {
    // 停止当前运行
    this.stop();
    // 重置步骤
    this.currentStep = -1;
    // 清除会话状态
    this.callbacks.onReset();
    log('Demo controller reset - session cleared');
    // 重新开始
    this.start();
  }

  triggerNextStep(): void {
    if (!this.isRunning) {
      this.start();
    } else {
      this.advanceToNextStep();
    }
  }

  handleInteraction(componentId: string, actionId: string): void {
    const key = `${componentId}:${actionId}`;
    const resolver = this.interactionResolvers.get(key);
    
    if (resolver) {
      log(`Demo: Interaction matched: ${key}`);
      resolver();
      this.interactionResolvers.delete(key);
    }
  }

  // ========== 组件事件等待机制 ==========
  private componentEventResolvers: Map<string, () => void> = new Map();

  handleComponentEvent(event: { component: string; type: string; payload?: unknown }): void {
    const key = `${event.component}:${event.type}`;
    log(`Demo: Component event: ${key}`);
    
    const resolver = this.componentEventResolvers.get(key);
    if (resolver) {
      log(`Demo: Component event matched, resolving wait: ${key}`);
      resolver();
      this.componentEventResolvers.delete(key);
    }
  }

  /**
   * 等待组件事件（如 ready, contentLoaded）
   * @param component 组件名称
   * @param eventType 事件类型
   * @param timeoutMs 超时时间（默认5秒）
   */
  private async waitForComponentEvent(
    component: string, 
    eventType: string, 
    timeoutMs: number = 5000
  ): Promise<boolean> {
    const key = `${component}:${eventType}`;
    log(`Demo: Waiting for component event: ${key} (timeout: ${timeoutMs}ms)`);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        log(`Demo: Component event timeout: ${key}`);
        this.componentEventResolvers.delete(key);
        resolve(false); // 超时返回 false
      }, timeoutMs);

      this.componentEventResolvers.set(key, () => {
        clearTimeout(timeout);
        resolve(true); // 成功返回 true
      });
    });
  }

  /**
   * 等待组件就绪
   */
  private async waitForComponentReady(component: string, timeoutMs: number = 5000): Promise<boolean> {
    return this.waitForComponentEvent(component, 'ready', timeoutMs);
  }

  /**
   * 等待组件内容加载完成
   */
  private async waitForContentLoaded(component: string, timeoutMs: number = 10000): Promise<boolean> {
    return this.waitForComponentEvent(component, 'contentLoaded', timeoutMs);
  }

  private async advanceToNextStep(): Promise<void> {
    if (!this.isRunning || this.isPaused) return;

    this.currentStep++;
    this.callbacks.onAgentStateChange({ currentStep: this.currentStep });

    // Demo 流程 (严格对齐 mock: vlaEnhancedDemo.ts)
    switch (this.currentStep) {
      case 0: // step-1: Agent initiates
        await this.step0_AgentInitiates();
        break;
      case 1: // step-2: Load paper
        await this.step1_LoadPaper();
        break;
      case 2: // step-3: Load code
        await this.step2_LoadCode();
        break;
      case 3: // step-3b + step-3c: Execute + Show results
        await this.step3_RunBenchmark();
        break;
      case 4: // step-4: Generate visualization (auto)
        await this.step4_GenerateVisualization();
        break;
      case 5: // step-5: Ask to insert into paper
        await this.step5_AskInsertToPaper();
        break;
      case 6: // step-6: Write paper section (auto)
        await this.step6_WritePaperSection();
        break;
      case 7: // step-7: Compile paper (auto)
        await this.step7_CompilePaper();
        break;
      case 8: // step-8: Task complete
        await this.step8_TaskComplete();
        break;
      default:
        this.callbacks.onAgentStateChange({ status: 'idle' });
        log('Demo completed');
        return;
    }
  }

  private async step0_AgentInitiates(): Promise<void> {
    const message = {
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-research',
      senderType: 'agent',
      senderName: 'Aria (Research)',
      content: 'Good morning! I noticed your research progress on VLA models yesterday. There are a few newly published related papers today. Would you like me to help analyze them?',
      contentType: 'text',
      timestamp: new Date().toISOString(),
      interactiveComponents: [
        {
          type: 'button-group',
          id: 'step1-confirm',
          buttons: [
            { id: 'yes', label: 'Yes, start analysis', variant: 'primary' },
            { id: 'later', label: 'Maybe later', variant: 'secondary' },
          ],
        },
      ],
    };

    this.callbacks.onMessage(message);
    this.callbacks.onAgentStateChange({
      status: 'waiting_interaction',
      waitingFor: {
        componentId: 'step1-confirm',
        possibleActions: ['yes', 'later'],
      },
    });

    // 等待用户交互
    await this.waitForInteraction('step1-confirm', 'yes');
    
    this.callbacks.onAgentStateChange({ status: 'running' });
    await this.advanceToNextStep();
  }

  private async step1_LoadPaper(): Promise<void> {
    this.callbacks.onAgentStateChange({ status: 'running', currentStep: 1 });

    // 更新任务状态
    const tasks = [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        status: 'running',
        progress: 15,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'running' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'pending' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'pending' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'pending' },
        ],
      },
    ];
    this.callbacks.onTaskUpdate(tasks);

    // 发送 UI 指令：切换到 PDF 阅读器
    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'SWITCH_COMPONENT',
      payload: { component: 'pdf-reader' },
      targetCapabilities: ['full_ui'],
    });

    await delay(500);

    // 发送 UI 指令：加载文档
    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'LOAD_DOCUMENT',
      payload: { documentId: 'library/vla-rail.pdf' },
      targetCapabilities: ['full_ui'],
    });

    // 消息: 加载论文
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-research',
      senderType: 'agent',
      senderName: 'Aria (Research)',
      content: "Got it! I've loaded the VLA-RAIL paper into the PDF reader. Let me analyze the key contributions...\n\n📖 Check the **AI Chat** panel on the right side for the analysis.",
      contentType: 'text',
      timestamp: new Date().toISOString(),
    });

    await delay(1500);

    // 发送 PDF AI Chat 分析请求指令
    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'SEND_PDF_CHAT',
      payload: { 
        query: 'What are the key results and innovations of this paper? Please summarize the main contributions.',
      },
      targetCapabilities: ['full_ui'],
    });

    await delay(2000);

    // 模拟 PDF AI 分析响应 (流式)
    const analysisResponse = `## Key Contributions of VLA-RAIL

**1. Efficient Architecture**
- Introduces a compact 2.1B parameter model optimized for real-time robot control
- Achieves **62% lower inference latency** compared to RT-1 baseline

**2. Novel Training Approach**
- Rail-guided action prediction for smoother trajectories
- Multi-task pretraining on diverse manipulation datasets

**3. Performance Results**
- **93.4% success rate** on SIMPLER-Env benchmark
- Only 6.8GB memory usage, enabling edge deployment

**4. Key Innovation**
- Vision-Language-Action fusion with temporal attention
- Action chunking for efficient trajectory generation`;

    // 流式发送分析响应到 PDF Chat
    const lines = analysisResponse.split('\n');
    let partialContent = '';
    
    for (let i = 0; i < lines.length; i++) {
      partialContent += (i > 0 ? '\n' : '') + lines[i];
      
      this.callbacks.onUIDirective({
        id: `directive-pdf-chat-${Date.now()}-${i}`,
        type: 'PDF_CHAT_RESPONSE',
        payload: { 
          content: partialContent,
          isStreaming: i < lines.length - 1,
          isComplete: i === lines.length - 1,
        },
        targetCapabilities: ['full_ui'],
      });
      
      await delay(150);
    }

    // 更新任务进度
    const tasksUpdated = [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        status: 'running',
        progress: 30,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'completed' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'pending' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'pending' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'pending' },
        ],
      },
    ];
    this.callbacks.onTaskUpdate(tasksUpdated);

    // 添加时间线事件
    this.callbacks.onTimelineEvent({
      id: `timeline-${Date.now()}`,
      timestamp: Date.now(),
      componentType: 'pdf-reader',
      action: 'analyze',
      description: 'Analyzed VLA-RAIL paper key contributions',
      actorId: 'agent-research',
      actorType: 'agent',
    });

    // 分析完成后等待一会儿让用户看清
    await delay(2000);
    await this.advanceToNextStep();
  }

  private async step2_LoadCode(): Promise<void> {
    this.callbacks.onAgentStateChange({ status: 'running', currentStep: 2 });

    // 更新任务
    const tasks = [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        status: 'running',
        progress: 40,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'completed' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'running' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'pending' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'pending' },
        ],
      },
    ];
    this.callbacks.onTaskUpdate(tasks);

    // 先发送消息说明正在加载代码
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-code',
      senderType: 'agent',
      senderName: 'CodeBot',
      content: '📝 Generating benchmark script based on the paper analysis... Switching to **Code Playground**.',
      contentType: 'text',
      timestamp: new Date().toISOString(),
    });

    await delay(500);

    // 切换到代码编辑器
    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'SWITCH_COMPONENT',
      payload: { component: 'code-playground' },
      targetCapabilities: ['full_ui'],
    });

    // 等待组件就绪（最多5秒）
    const ready = await this.waitForComponentReady('code-playground', 5000);
    if (!ready) {
      log('[DemoController] Warning: code-playground ready timeout, proceeding anyway');
      await delay(500); // 回退到小延迟
    }

    // ========== 关键：先加载代码到 Code Playground ==========
    const benchmarkCode = `"""
VLA Model Benchmark Suite
=========================
Evaluates Vision-Language-Action models on robotic manipulation tasks.

Metrics: Inference latency, success rate, memory usage, motion smoothness
Benchmark: SIMPLER-Env (Google DeepMind, 2024)
"""

import time
import sys
import json
from dataclasses import dataclass
from typing import List, Dict
import random

# ============================================================
# Configuration
# ============================================================

@dataclass
class BenchmarkConfig:
    num_episodes: int = 100
    num_warmup: int = 10
    timeout_ms: float = 500.0
    tasks: List[str] = None
    
    def __post_init__(self):
        if self.tasks is None:
            self.tasks = [
                "pick_cube", "place_cube", "stack_blocks", 
                "open_drawer", "close_drawer", "pour_water"
            ]

config = BenchmarkConfig(num_episodes=50, num_warmup=5)

# ============================================================
# Model Definitions
# ============================================================

MODELS = {
    "RT-1": {
        "params": "35M",
        "base_latency": 120,
        "base_success": 72.3,
        "memory_gb": 8.2,
        "checkpoint": "rt1-robotics-transformer"
    },
    "OpenVLA": {
        "params": "7B", 
        "base_latency": 85,
        "base_success": 81.2,
        "memory_gb": 12.4,
        "checkpoint": "openvla-7b-prismatic"
    },
    "VLA-RAIL": {
        "params": "2.1B",
        "base_latency": 45,
        "base_success": 89.1,
        "memory_gb": 6.8,
        "checkpoint": "vla-rail-2b-v1"
    },
    "VLA-RAIL+": {
        "params": "2.3B",
        "base_latency": 32,
        "base_success": 93.4,
        "memory_gb": 7.2,
        "checkpoint": "vla-rail-plus-2b-v1"
    }
}

# ============================================================
# Benchmark Runner
# ============================================================

def progress_bar(current, total, width=40, prefix=""):
    percent = current / total
    filled = int(width * percent)
    bar = "█" * filled + "░" * (width - filled)
    sys.stdout.write(f"\\r{prefix} |{bar}| {percent*100:.1f}%")
    sys.stdout.flush()
    if current == total:
        print()

def simulate_inference(model_config: dict, task: str) -> Dict:
    base_latency = model_config["base_latency"]
    base_success = model_config["base_success"]
    latency = base_latency + random.gauss(0, base_latency * 0.05)
    success = random.random() < (base_success / 100)
    time.sleep(0.02)
    return {"latency_ms": max(1, latency), "success": success, "task": task}

def run_benchmark(model_name: str, model_config: dict) -> Dict:
    results = {"latencies": [], "successes": 0, "total": 0}
    total_runs = config.num_warmup + config.num_episodes
    
    for i in range(total_runs):
        task = random.choice(config.tasks)
        result = simulate_inference(model_config, task)
        if i >= config.num_warmup:
            results["latencies"].append(result["latency_ms"])
            results["successes"] += int(result["success"])
            results["total"] += 1
        progress_bar(i + 1, total_runs, prefix=f"  {model_name}")
    
    return results

# ============================================================
# Main Execution
# ============================================================

print("=" * 60)
print("  VLA Model Benchmark Suite v1.0")
print("  Benchmark: SIMPLER-Env | Episodes:", config.num_episodes)
print("=" * 60)

all_results = {}

for model_name, model_config in MODELS.items():
    print(f"\\n📦 Loading {model_name} ({model_config['params']} params)...")
    print(f"   Checkpoint: {model_config['checkpoint']}")
    time.sleep(0.3)
    
    print(f"\\n🔬 Running benchmark...")
    results = run_benchmark(model_name, model_config)
    
    avg_latency = sum(results["latencies"]) / len(results["latencies"])
    success_rate = (results["successes"] / results["total"]) * 100
    
    all_results[model_name] = {
        "avg_latency_ms": round(avg_latency, 1),
        "success_rate": round(success_rate, 1),
        "memory_gb": model_config["memory_gb"],
        "params": model_config["params"]
    }
    
    print(f"   ✓ Avg Latency: {avg_latency:.1f} ms")
    print(f"   ✓ Success Rate: {success_rate:.1f}%")

print("\\n" + "=" * 60)
print("  BENCHMARK RESULTS")
print("=" * 60)

for model, metrics in all_results.items():
    print(f"{model:<12} {metrics['avg_latency_ms']:>8.1f}ms {metrics['success_rate']:>9.1f}%")

print("\\n✅ Benchmark complete. Results saved to benchmark_results.json")
`;

    // 发送代码到 Code Playground (流式)
    log('[DemoController] Sending UPDATE_CODE directive');
    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'UPDATE_CODE',
      payload: { 
        code: benchmarkCode,
        language: 'python',
        filename: 'benchmark.py'
      },
      targetCapabilities: ['full_ui'],
    });

    // 等待代码内容加载完成（最多10秒）
    const loaded = await this.waitForContentLoaded('code-playground', 10000);
    if (!loaded) {
      log('[DemoController] Warning: code-playground contentLoaded timeout, proceeding anyway');
      await delay(1000); // 回退到小延迟
    }

    // 添加时间线事件
    this.callbacks.onTimelineEvent({
      id: `timeline-${Date.now()}`,
      timestamp: Date.now(),
      componentType: 'code-playground',
      action: 'code_generated',
      description: 'Generated VLA benchmark script',
      actorId: 'agent-code',
      actorType: 'agent',
    });

    // 更新任务进度
    const tasksUpdated = [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        status: 'running',
        progress: 50,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'completed' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'running' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'pending' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'pending' },
        ],
      },
    ];
    this.callbacks.onTaskUpdate(tasksUpdated);

    // 显示消息和交互按钮
    const message = {
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-code',
      senderType: 'agent',
      senderName: 'CodeBot',
      content: "I've loaded the benchmark script into the **Code Playground**. This will compare inference latency and success rates across different VLA models.",
      contentType: 'text',
      timestamp: new Date().toISOString(),
      interactiveComponents: [
        {
          type: 'button-group',
          id: 'step3-actions',
          buttons: [
            { id: 'run', label: 'Run Benchmark', variant: 'primary' },
          ],
        },
      ],
    };

    this.callbacks.onMessage(message);
    this.callbacks.onAgentStateChange({
      status: 'waiting_interaction',
      waitingFor: {
        componentId: 'step3-actions',
        possibleActions: ['run'],
      },
    });

    // 等待用户交互
    await this.waitForInteraction('step3-actions', 'run');
    
    // 继续下一步
    await delay(500);
    await this.advanceToNextStep();
  }

  private async step3_RunBenchmark(): Promise<void> {
    // 更新任务状态
    const tasks = [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        status: 'running',
        progress: 55,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'completed' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'running' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'pending' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'pending' },
        ],
      },
    ];
    this.callbacks.onTaskUpdate(tasks);

    this.callbacks.onAgentStateChange({ status: 'running', currentStep: 3 });

    // ========== Step 3b: 执行代码 (代码已在 step2 加载) ==========
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-code',
      senderType: 'agent',
      senderName: 'CodeBot',
      content: '🔄 Running benchmark... Watch the terminal output for real-time results.',
      contentType: 'text',
      timestamp: new Date().toISOString(),
    });

    await delay(800);

    // 发送执行代码指令
    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'EXECUTE_CODE',
      payload: { 
        command: 'python benchmark.py'
      },
      targetCapabilities: ['full_ui'],
    });

    await delay(500);

    // 流式模拟终端输出
    const terminalLogs = [
      '$ python benchmark.py',
      '============================================================',
      '  VLA Model Benchmark Suite v1.0',
      '  Benchmark: SIMPLER-Env | Episodes: 50',
      '============================================================',
      '',
      '📦 Loading RT-1 (35M params)...',
      '   Checkpoint: rt1-robotics-transformer',
      '',
      '🔬 Running benchmark...',
      '  RT-1          |████████████████████████████████████████| 100.0%',
      '   ✓ Avg Latency: 118.7 ms',
      '   ✓ Success Rate: 72.0%',
      '',
      '📦 Loading OpenVLA (7B params)...',
      '   Checkpoint: openvla-7b-prismatic',
      '',
      '🔬 Running benchmark...',
      '  OpenVLA       |████████████████████████████████████████| 100.0%',
      '   ✓ Avg Latency: 84.3 ms',
      '   ✓ Success Rate: 81.0%',
      '',
      '📦 Loading VLA-RAIL (2.1B params)...',
      '   Checkpoint: vla-rail-2b-v1',
      '',
      '🔬 Running benchmark...',
      '  VLA-RAIL      |████████████████████████████████████████| 100.0%',
      '   ✓ Avg Latency: 45.2 ms',
      '   ✓ Success Rate: 89.0%',
      '',
      '📦 Loading VLA-RAIL+ (2.3B params)...',
      '   Checkpoint: vla-rail-plus-2b-v1',
      '',
      '🔬 Running benchmark...',
      '  VLA-RAIL+     |████████████████████████████████████████| 100.0%',
      '   ✓ Avg Latency: 32.4 ms',
      '   ✓ Success Rate: 93.4%',
      '',
      '============================================================',
      '  BENCHMARK RESULTS',
      '============================================================',
      'RT-1            118.7ms     72.0%',
      'OpenVLA          84.3ms     81.0%',
      'VLA-RAIL         45.2ms     89.0%',
      'VLA-RAIL+        32.4ms     93.4%',
      '',
      '✅ Benchmark complete. Results saved to benchmark_results.json',
    ];

    // 流式发送终端日志
    for (let i = 0; i < terminalLogs.length; i++) {
      this.callbacks.onUIDirective({
        id: `directive-terminal-${Date.now()}-${i}`,
        type: 'TERMINAL_OUTPUT',
        payload: { 
          line: terminalLogs[i],
          append: true,
        },
        targetCapabilities: ['full_ui'],
      });
      
      // 根据内容类型调整延迟
      if (terminalLogs[i].includes('|████')) {
        await delay(400);
      } else if (terminalLogs[i].includes('Loading')) {
        await delay(300);
      } else if (terminalLogs[i].includes('Latency') || terminalLogs[i].includes('Success')) {
        await delay(200);
      } else {
        await delay(80);
      }
    }

    await delay(800);

    // Step 3.3: 更新任务进度
    const tasksUpdated = [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        status: 'running',
        progress: 65,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'completed' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'completed' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'running' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'pending' },
        ],
      },
    ];
    this.callbacks.onTaskUpdate(tasksUpdated);

    // Step 3.4: 切换到 Data 面板 (AGGrid)
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-code',
      senderType: 'agent',
      senderName: 'CodeBot',
      content: '📊 Loading benchmark results into Data panel...',
      contentType: 'text',
      timestamp: new Date().toISOString(),
    });

    await delay(300);

    // 切换到 Data 面板
    log('[DemoController] Switching to ag-grid component');
    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'SWITCH_COMPONENT',
      payload: { component: 'ag-grid' },
      targetCapabilities: ['full_ui'],
    });

    // 等待 AG Grid 组件就绪
    const gridReady = await this.waitForComponentReady('ag-grid', 5000);
    if (!gridReady) {
      log('[DemoController] Warning: ag-grid ready timeout, proceeding anyway');
      await delay(500);
    }

    // 发送数据到 AGGrid (与终端输出一致)
    log('[DemoController] Sending UPDATE_DATA_GRID directive');
    const benchmarkData = [
      { rank: 1, model: 'VLA-RAIL+', params: '2.3B', latency_ms: 32.4, success_rate: 93.4, memory_gb: 7.2 },
      { rank: 2, model: 'VLA-RAIL', params: '2.1B', latency_ms: 45.2, success_rate: 89.0, memory_gb: 6.8 },
      { rank: 3, model: 'OpenVLA', params: '7B', latency_ms: 84.3, success_rate: 81.0, memory_gb: 12.4 },
      { rank: 4, model: 'RT-1', params: '35M', latency_ms: 118.7, success_rate: 72.0, memory_gb: 8.2 },
    ];

    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'UPDATE_DATA_GRID',
      payload: { 
        data: benchmarkData,
        columns: [
          { field: 'rank', headerName: '#', width: 60 },
          { field: 'model', headerName: 'Model', width: 120 },
          { field: 'params', headerName: 'Params', width: 80 },
          { field: 'latency_ms', headerName: 'Latency (ms)', width: 110 },
          { field: 'success_rate', headerName: 'Success (%)', width: 110 },
          { field: 'memory_gb', headerName: 'Memory (GB)', width: 110 },
        ],
        title: 'VLA Model Benchmark Results'
      },
      targetCapabilities: ['full_ui'],
    });

    // 等待数据加载完成
    const dataLoaded = await this.waitForContentLoaded('ag-grid', 5000);
    if (!dataLoaded) {
      log('[DemoController] Warning: ag-grid contentLoaded timeout');
      await delay(500);
    }

    // Step 3c: 显示结果摘要并询问是否生成可视化 (与 mock step3c 对应)
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-code',
      senderType: 'agent',
      senderName: 'CodeBot',
      content: `✅ **Benchmark complete!** Results displayed in **Data Grid**.

**Key findings:**
- 🥇 **VLA-RAIL+** achieves **32.4ms** latency and **93.4%** success rate
- VLA-RAIL offers the best balance of speed and accuracy
- RT-1 has highest memory efficiency but lower performance

Would you like to generate visualizations for these results?`,
      contentType: 'markdown',
      timestamp: new Date().toISOString(),
      interactiveComponents: [
        {
          type: 'button-group',
          id: 'step3c-actions',  // 与 mock 保持一致
          buttons: [
            { id: 'visualize', label: 'Generate Visualization', variant: 'primary' },
            { id: 'skip', label: 'Skip to Paper', variant: 'secondary' },
          ],
        },
      ],
    });

    this.callbacks.onAgentStateChange({
      status: 'waiting_interaction',
      waitingFor: {
        componentId: 'step3c-actions',
        possibleActions: ['visualize', 'skip'],
      },
    });

    // 等待用户交互
    await this.waitForInteraction('step3c-actions', 'visualize');
    
    await delay(1000);
    await this.advanceToNextStep();
  }

  // ========== Step 4: Generate Visualization (对应 mock step-4) ==========
  // transition: auto, autoDelay: 2000
  private async step4_GenerateVisualization(): Promise<void> {
    this.callbacks.onAgentStateChange({ status: 'running', currentStep: 4 });

    // 更新任务状态
    const tasks = [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        status: 'running',
        progress: 70,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'completed' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'completed' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'running' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'pending' },
        ],
      },
    ];
    this.callbacks.onTaskUpdate(tasks);

    // 切换到 Jupyter Notebook
    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'SWITCH_COMPONENT',
      payload: { component: 'jupyter-notebook' },
      targetCapabilities: ['full_ui'],
    });

    // 消息: 开始生成可视化
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-code',
      senderType: 'agent',
      senderName: 'CodeBot',
      content: '📊 Running visualization code in Jupyter...',
      contentType: 'text',
      timestamp: new Date().toISOString(),
    });

    await delay(1500);

    // 发送 Jupyter 代码执行指令
    const visualizationCode = `import matplotlib.pyplot as plt
import numpy as np

# Benchmark data
models = ['RT-1', 'OpenVLA', 'VLA-RAIL', 'VLA-RAIL+']
latency = [118.7, 84.3, 45.2, 32.4]
success = [72.0, 81.0, 89.0, 93.4]
memory = [8.2, 12.4, 6.8, 7.2]

fig, axes = plt.subplots(1, 3, figsize=(14, 4))

# Latency comparison
ax1 = axes[0]
colors = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1']
ax1.barh(models, latency, color=colors)
ax1.set_xlabel('Latency (ms)')
ax1.set_title('Inference Latency')
ax1.invert_yaxis()

# Success rate
ax2 = axes[1]
ax2.barh(models, success, color=colors)
ax2.set_xlabel('Success Rate (%)')
ax2.set_title('Task Success Rate')
ax2.invert_yaxis()
ax2.set_xlim(0, 100)

# Memory usage
ax3 = axes[2]
ax3.barh(models, memory, color=colors)
ax3.set_xlabel('Memory (GB)')
ax3.set_title('GPU Memory Usage')
ax3.invert_yaxis()

plt.tight_layout()
plt.savefig('benchmark_comparison.png', dpi=150)
plt.show()
print("✅ Visualization saved to benchmark_comparison.png")`;

    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'UPDATE_NOTEBOOK',
      payload: { 
        cells: [
          { type: 'code', source: visualizationCode, outputs: [] }
        ],
        execute: true
      },
      targetCapabilities: ['full_ui'],
    });

    await delay(2000);

    // 消息: 可视化完成
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-code',
      senderType: 'agent',
      senderName: 'CodeBot',
      content: `🎨 **Visualization complete!** The charts show:

• **VLA-RAIL+** achieves the lowest latency at **32.4ms**
• **93.4% success rate** with VLA-RAIL+ variant
• Memory efficiency: VLA-RAIL uses only **6.8GB**`,
      contentType: 'markdown',
      timestamp: new Date().toISOString(),
    });

    // 更新任务状态 - subtask-3 完成
    const tasksAfter = [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        status: 'running',
        progress: 80,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'completed' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'completed' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'completed' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'pending' },
        ],
      },
    ];
    this.callbacks.onTaskUpdate(tasksAfter);

    // Auto advance after 2000ms delay
    await delay(2000);
    await this.advanceToNextStep();
  }

  // ========== Step 5: Ask to Insert into Paper (对应 mock step-5) ==========
  // transition: interaction, step5-actions:insert
  private async step5_AskInsertToPaper(): Promise<void> {
    this.callbacks.onAgentStateChange({ status: 'running', currentStep: 5 });

    // 消息: 询问是否插入到论文
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-writer',
      senderType: 'agent',
      senderName: 'Aria (Writing)',
      content: `Great results! Would you like me to insert the analysis conclusions and charts into your paper?

💡 *Tip: Use \`#\` to reference your LaTeX draft*`,
      contentType: 'markdown',
      timestamp: new Date().toISOString(),
      interactiveComponents: [
        {
          type: 'button-group',
          id: 'step5-actions',  // 与 mock 一致
          buttons: [
            { id: 'insert', label: 'Insert to #experiment.tex', variant: 'primary' },
            { id: 'skip', label: 'Skip', variant: 'secondary' },
          ],
        },
      ],
    });

    this.callbacks.onAgentStateChange({
      status: 'waiting_interaction',
      waitingFor: {
        componentId: 'step5-actions',
        possibleActions: ['insert', 'skip'],
      },
    });

    // 等待用户交互
    await this.waitForInteraction('step5-actions', 'insert');
    
    await delay(500);
    await this.advanceToNextStep();
  }

  // ========== Step 6: Write Paper Section (对应 mock step-6) ==========
  // transition: auto, autoDelay: 1500
  private async step6_WritePaperSection(): Promise<void> {
    this.callbacks.onAgentStateChange({ status: 'running', currentStep: 6 });

    // 更新任务状态
    const tasks = [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        status: 'running',
        progress: 90,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'completed' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'completed' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'completed' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'running' },
        ],
      },
    ];
    this.callbacks.onTaskUpdate(tasks);

    // 消息: 开始写入论文
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-writer',
      senderType: 'agent',
      senderName: 'Aria (Writing)',
      content: `📝 Inserting analysis and charts into **experiment.tex**...

The section includes:
• Benchmark methodology
• Performance comparison table
• Chart figures
• Key findings analysis`,
      contentType: 'markdown',
      timestamp: new Date().toISOString(),
    });

    await delay(500);

    // 切换到 LaTeX 编辑器
    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'SWITCH_COMPONENT',
      payload: { component: 'latex-editor' },
      targetCapabilities: ['full_ui'],
    });

    await delay(800);

    // 发送 LaTeX 内容更新指令
    const experimentLatex = `\\section{Experiments}

\\subsection{Benchmark Setup}
We evaluate our VLA-RAIL model against existing vision-language-action models 
using the SIMPLER-Env benchmark suite. The benchmark includes 50 episodes 
across 6 manipulation tasks: pick\\_cube, place\\_cube, stack\\_blocks, 
open\\_drawer, close\\_drawer, and pour\\_water.

\\subsection{Results}

\\begin{table}[h]
\\centering
\\caption{VLA Model Benchmark Comparison}
\\begin{tabular}{lccc}
\\toprule
Model & Latency (ms) & Success (\\%) & Memory (GB) \\\\
\\midrule
RT-1 & 118.7 & 72.0 & 8.2 \\\\
OpenVLA & 84.3 & 81.0 & 12.4 \\\\
VLA-RAIL & 45.2 & 89.0 & 6.8 \\\\
\\textbf{VLA-RAIL+} & \\textbf{32.4} & \\textbf{93.4} & 7.2 \\\\
\\bottomrule
\\end{tabular}
\\end{table}

\\begin{figure}[h]
\\centering
\\includegraphics[width=0.9\\textwidth]{benchmark_comparison.png}
\\caption{Performance comparison across VLA models.}
\\end{figure}

\\subsection{Analysis}
VLA-RAIL+ achieves the best performance with 32.4ms inference latency 
and 93.4\\% success rate. Compared to RT-1 baseline:
\\begin{itemize}
\\item \\textbf{72\\% lower latency} (32.4ms vs 118.7ms)
\\item \\textbf{21\\% higher success rate} (93.4\\% vs 72.0\\%)
\\item \\textbf{Efficient memory usage} at 7.2GB
\\end{itemize}`;

    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'UPDATE_LATEX',
      payload: { 
        file: 'experiment.tex',
        content: experimentLatex,
      },
      targetCapabilities: ['full_ui'],
    });

    // Auto advance after 1500ms delay
    await delay(1500);
    await this.advanceToNextStep();
  }

  // ========== Step 7: Compile Paper (对应 mock step-7) ==========
  // transition: auto, autoDelay: 2000
  private async step7_CompilePaper(): Promise<void> {
    this.callbacks.onAgentStateChange({ status: 'running', currentStep: 7 });

    // 发送编译指令
    this.callbacks.onUIDirective({
      id: `directive-${Date.now()}`,
      type: 'COMPILE_LATEX',
      payload: { 
        file: 'main.tex',
      },
      targetCapabilities: ['full_ui'],
    });

    await delay(1500);

    // 消息: 编译完成
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-writer',
      senderType: 'agent',
      senderName: 'Aria (Writing)',
      content: `📄 **Paper compiled successfully!**

The PDF preview shows the formatted experiment section with the performance comparison table and visualization charts.`,
      contentType: 'markdown',
      timestamp: new Date().toISOString(),
    });

    // Auto advance after 2000ms delay
    await delay(2000);
    await this.advanceToNextStep();
  }

  // ========== Step 8: Task Complete (对应 mock step-8) ==========
  private async step8_TaskComplete(): Promise<void> {
    // 更新任务状态 - 完成
    const tasks = [
      {
        id: 'task-vla-research',
        title: 'VLA Model Research Analysis',
        status: 'completed',
        progress: 100,
        subtasks: [
          { id: 'subtask-1', parentId: 'task-vla-research', title: 'Paper Analysis', status: 'completed' },
          { id: 'subtask-2', parentId: 'task-vla-research', title: 'Benchmark Setup', status: 'completed' },
          { id: 'subtask-3', parentId: 'task-vla-research', title: 'Visualization', status: 'completed' },
          { id: 'subtask-4', parentId: 'task-vla-research', title: 'Paper Writing', status: 'completed' },
        ],
      },
    ];
    this.callbacks.onTaskUpdate(tasks);

    // 消息: 任务完成摘要
    this.callbacks.onMessage({
      id: `msg-${Date.now()}`,
      workspaceId: 'default',
      senderId: 'agent-research',
      senderType: 'agent',
      senderName: 'Aria (Research)',
      content: `🎉 **Research Analysis Complete!**

**Summary:**
• Analyzed VLA-RAIL paper innovations
• Generated benchmark comparison visualizations  
• Drafted experiment section for paper

**Output Files:**
• \`benchmark_comparison.png\` - Visualization charts
• \`experiment.tex\` - Paper section
• Compiled PDF preview`,
      contentType: 'markdown',
      timestamp: new Date().toISOString(),
    });

    // 添加时间线事件
    this.callbacks.onTimelineEvent({
      id: `timeline-${Date.now()}`,
      sessionId: 'default',
      workspaceId: 'default',
      type: 'agent_completion',
      title: 'Research Analysis Completed',
      description: 'VLA model benchmark and paper section completed successfully',
      timestamp: new Date().toISOString(),
      metadata: {
        tasksCompleted: 4,
        artifactsGenerated: ['benchmark_results.json', 'visualization.ipynb', 'experiment_section.tex'],
      },
    });

    // Demo 完成
    this.callbacks.onAgentStateChange({ status: 'idle' });
    log('Demo flow completed successfully');
  }

  private waitForInteraction(componentId: string, actionId: string): Promise<void> {
    return new Promise((resolve) => {
      this.interactionResolvers.set(`${componentId}:${actionId}`, resolve);
    });
  }
}

// ============================================================
// Utilities
// ============================================================

function log(...args: any[]): void {
  if (DEBUG) {
    console.log(`[AgentServer]`, ...args);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Start Server
// ============================================================

new AgentServer(PORT);
