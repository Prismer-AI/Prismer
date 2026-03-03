/**
 * State Sync Server (Enhanced with Persistence)
 *
 * WebSocket 服务器，用于在多端之间同步状态
 * Phase 3D: 添加会话持久化支持
 *
 * 启动方式: npx tsx scripts/sync-server.ts
 *
 * 功能:
 * - 广播状态变更到所有连接的客户端
 * - 新客户端连接时发送当前完整状态
 * - 支持增量更新和全量同步
 * - 会话持久化到数据库 (可选)
 */

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = parseInt(process.env.SYNC_PORT || '3456');
const ENABLE_PERSISTENCE = process.env.SYNC_PERSISTENCE !== 'false';

// ============================================================
// Types
// ============================================================

interface SharedState {
  messages: unknown[];
  tasks: unknown[];
  participants: unknown[];
  currentDemoStepIndex: number;
  completedInteractions: string[];
  componentStates: Record<string, unknown>;
  agentState: {
    status: 'idle' | 'running' | 'waiting_interaction' | 'paused' | 'error';
    waitingFor?: {
      componentId: string;
      possibleActions: string[];
    };
  };
}

interface ClientInfo {
  id: string;
  type: string;
  capabilities: string[];
  platform: string;
  sessionId: string;
  connectedAt: number;
}

// ============================================================
// Persistence Interface (simplified for server-side)
// ============================================================

interface SessionPersistence {
  saveSession(sessionId: string, state: SharedState): Promise<void>;
  loadSession(sessionId: string): Promise<SharedState | null>;
  healthCheck(): Promise<boolean>;
}

// Memory persistence implementation
class MemoryPersistence implements SessionPersistence {
  private sessions = new Map<string, SharedState>();

  async saveSession(sessionId: string, state: SharedState): Promise<void> {
    this.sessions.set(sessionId, JSON.parse(JSON.stringify(state)));
  }

  async loadSession(sessionId: string): Promise<SharedState | null> {
    const state = this.sessions.get(sessionId);
    return state ? JSON.parse(JSON.stringify(state)) : null;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// ============================================================
// Server State
// ============================================================

// 会话状态映射
const sessionStates = new Map<string, SharedState>();

// 已连接的客户端
const clients = new Map<WebSocket, ClientInfo>();

// 持久化实例
const persistence: SessionPersistence = new MemoryPersistence();

// 默认会话状态
function createDefaultState(): SharedState {
  return {
    messages: [],
    tasks: [],
    participants: [],
    currentDemoStepIndex: -1,
    completedInteractions: [],
    componentStates: {},
    agentState: { status: 'idle' },
  };
}

// 获取或创建会话状态
async function getSessionState(sessionId: string): Promise<SharedState> {
  let state = sessionStates.get(sessionId);

  if (!state && ENABLE_PERSISTENCE) {
    state = await persistence.loadSession(sessionId) ?? undefined;
    if (state) {
      sessionStates.set(sessionId, state);
    }
  }

  if (!state) {
    state = createDefaultState();
    sessionStates.set(sessionId, state);
  }

  return state;
}

// 保存会话状态
async function saveSessionState(sessionId: string, state: SharedState): Promise<void> {
  sessionStates.set(sessionId, state);

  if (ENABLE_PERSISTENCE) {
    try {
      await persistence.saveSession(sessionId, state);
    } catch (error) {
      console.error(`[Sync] Failed to persist session ${sessionId}:`, error);
    }
  }
}

// ============================================================
// HTTP Server
// ============================================================

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health') {
    const persistenceHealthy = await persistence.healthCheck();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      clients: clients.size,
      sessions: sessionStates.size,
      persistence: persistenceHealthy,
      uptime: process.uptime(),
    }));
    return;
  }

  // Get state for session
  if (req.url?.startsWith('/state')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const sessionId = url.searchParams.get('session') || 'default';
    const state = await getSessionState(sessionId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
    return;
  }

  // Demo control endpoints
  if (req.url === '/demo/start' && req.method === 'POST') {
    // Trigger demo start for all connected clients
    broadcastToAll({
      type: 'DEMO_CONTROL',
      payload: { action: 'start' },
      timestamp: Date.now(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.url === '/demo/reset' && req.method === 'POST') {
    // Reset demo state
    const defaultState = createDefaultState();
    for (const sessionId of sessionStates.keys()) {
      sessionStates.set(sessionId, { ...defaultState });
    }

    broadcastToAll({
      type: 'RESET',
      timestamp: Date.now(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.url === '/demo/clear-messages' && req.method === 'POST') {
    for (const state of sessionStates.values()) {
      state.messages = [];
    }

    broadcastToAll({
      type: 'STATE_UPDATE',
      payload: { messages: [] },
      timestamp: Date.now(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.url === '/demo/next-step' && req.method === 'POST') {
    broadcastToAll({
      type: 'DEMO_CONTROL',
      payload: { action: 'next_step' },
      timestamp: Date.now(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404);
  res.end();
});

// ============================================================
// WebSocket Server
// ============================================================

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws, req) => {
  // Parse session from query string
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get('session') || 'default';

  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const clientInfo: ClientInfo = {
    id: clientId,
    type: 'unknown',
    capabilities: [],
    platform: 'unknown',
    sessionId,
    connectedAt: Date.now(),
  };

  clients.set(ws, clientInfo);

  console.log(`\n🔌 Client connected: ${clientId}`);
  console.log(`   Session: ${sessionId}`);
  console.log(`   From: ${req.socket.remoteAddress}`);
  console.log(`   Total clients: ${clients.size}`);

  // Send current state
  const state = await getSessionState(sessionId);
  ws.send(JSON.stringify({
    type: 'FULL_STATE',
    payload: state,
    timestamp: Date.now(),
  }));

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const info = clients.get(ws);
      if (!info) return;

      console.log(`\n📨 Received from ${info.id}:`, message.type);

      switch (message.type) {
        case 'REGISTER_CLIENT': {
          // Update client info
          info.type = message.payload.clientType || 'unknown';
          info.capabilities = message.payload.capabilities || [];
          info.platform = message.payload.platform || 'unknown';

          console.log(`   Client registered: ${info.type} (${info.platform})`);

          // Notify other clients
          broadcastToSession(ws, info.sessionId, {
            type: 'CLIENT_JOINED',
            payload: {
              clientId: info.id,
              clientType: info.type,
              platform: info.platform,
            },
            timestamp: Date.now(),
          });
          break;
        }

        case 'STATE_UPDATE': {
          const state = await getSessionState(info.sessionId);
          Object.assign(state, message.payload);
          await saveSessionState(info.sessionId, state);

          console.log(`   Updated keys: ${Object.keys(message.payload).join(', ')}`);

          broadcastToSession(ws, info.sessionId, {
            type: 'STATE_UPDATE',
            payload: message.payload,
            timestamp: Date.now(),
            source: info.id,
          });
          break;
        }

        case 'ADD_MESSAGE': {
          const state = await getSessionState(info.sessionId);
          state.messages = [...state.messages, message.payload];
          await saveSessionState(info.sessionId, state);

          console.log(`   New message added, total: ${state.messages.length}`);

          broadcastToSession(ws, info.sessionId, {
            type: 'ADD_MESSAGE',
            payload: message.payload,
            timestamp: Date.now(),
            source: info.id,
          });
          break;
        }

        case 'UPDATE_TASK': {
          const state = await getSessionState(info.sessionId);
          state.tasks = state.tasks.map((task) => {
            const t = task as { id: string };
            return t.id === message.payload.id ? { ...t, ...message.payload } : task;
          });
          await saveSessionState(info.sessionId, state);

          broadcastToSession(ws, info.sessionId, {
            type: 'UPDATE_TASK',
            payload: message.payload,
            timestamp: Date.now(),
            source: info.id,
          });
          break;
        }

        case 'USER_INTERACTION':
        case 'INTERACTION': {
          const state = await getSessionState(info.sessionId);
          const componentId = message.payload.componentId;

          if (!state.completedInteractions.includes(componentId)) {
            state.completedInteractions.push(componentId);
          }

          // Clear waiting state if agent was waiting for this
          if (state.agentState.waitingFor?.componentId === componentId) {
            state.agentState = { status: 'running' };
          }

          await saveSessionState(info.sessionId, state);

          broadcastToSession(ws, info.sessionId, {
            type: 'INTERACTION',
            payload: message.payload,
            timestamp: Date.now(),
            source: info.id,
          });
          break;
        }

        case 'REQUEST_FULL_STATE': {
          const state = await getSessionState(info.sessionId);
          ws.send(JSON.stringify({
            type: 'FULL_STATE',
            payload: state,
            timestamp: Date.now(),
          }));
          break;
        }

        case 'RESET': {
          const newState = createDefaultState();
          sessionStates.set(info.sessionId, newState);
          await saveSessionState(info.sessionId, newState);

          broadcastToSession(null, info.sessionId, {
            type: 'RESET',
            timestamp: Date.now(),
            source: info.id,
          });
          console.log('   🔄 State reset');
          break;
        }

        case 'COMPONENT_EVENT': {
          // Forward component events to other clients
          broadcastToSession(ws, info.sessionId, {
            type: 'COMPONENT_EVENT',
            payload: message.payload,
            timestamp: Date.now(),
            source: info.id,
          });
          break;
        }

        case 'SYNC_DATA': {
          // Handle sync data based on dataType
          const { dataType, data } = message.payload;
          const state = await getSessionState(info.sessionId);

          if (dataType === 'componentStates') {
            state.componentStates = {
              ...state.componentStates,
              ...data,
            };
          } else if (dataType === 'agentState') {
            state.agentState = {
              ...state.agentState,
              ...data,
            };
          }

          await saveSessionState(info.sessionId, state);

          broadcastToSession(ws, info.sessionId, {
            type: 'SYNC_DATA',
            payload: message.payload,
            timestamp: Date.now(),
            source: info.id,
          });
          break;
        }
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    if (info) {
      // Notify other clients
      broadcastToSession(ws, info.sessionId, {
        type: 'CLIENT_LEFT',
        payload: { clientId: info.id },
        timestamp: Date.now(),
      });

      clients.delete(ws);
      console.log(`\n👋 Client disconnected: ${info.id}`);
      console.log(`   Remaining clients: ${clients.size}`);
    }
  });

  ws.on('error', (err) => {
    const info = clients.get(ws);
    console.error(`WebSocket error for ${info?.id || 'unknown'}:`, err);
    clients.delete(ws);
  });
});

// ============================================================
// Broadcast Helpers
// ============================================================

function broadcastToSession(sender: WebSocket | null, sessionId: string, message: object) {
  const data = JSON.stringify(message);
  let sent = 0;

  clients.forEach((info, client) => {
    if (client !== sender &&
        info.sessionId === sessionId &&
        client.readyState === WebSocket.OPEN) {
      client.send(data);
      sent++;
    }
  });

  if (sent > 0) {
    console.log(`   📡 Broadcasted to ${sent} client(s) in session ${sessionId}`);
  }
}

function broadcastToAll(message: object) {
  const data = JSON.stringify(message);
  let sent = 0;

  clients.forEach((_, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      sent++;
    }
  });

  if (sent > 0) {
    console.log(`   📡 Broadcasted to all ${sent} client(s)`);
  }
}

// ============================================================
// Start Server
// ============================================================

server.listen(PORT, () => {
  console.log('═'.repeat(50));
  console.log('  🚀 Pisa State Sync Server (v2 with Persistence)');
  console.log('═'.repeat(50));
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`  Health:    http://localhost:${PORT}/health`);
  console.log(`  State:     http://localhost:${PORT}/state?session=<id>`);
  console.log(`  Persistence: ${ENABLE_PERSISTENCE ? 'enabled' : 'disabled'}`);
  console.log('═'.repeat(50));
  console.log('\nDemo Control Endpoints:');
  console.log(`  POST http://localhost:${PORT}/demo/start`);
  console.log(`  POST http://localhost:${PORT}/demo/reset`);
  console.log(`  POST http://localhost:${PORT}/demo/clear-messages`);
  console.log(`  POST http://localhost:${PORT}/demo/next-step`);
  console.log('═'.repeat(50));
  console.log('\nWaiting for connections...\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  wss.close();
  server.close();
  process.exit(0);
});
