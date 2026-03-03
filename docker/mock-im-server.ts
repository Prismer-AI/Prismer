/**
 * Mock IM Server for Testing
 *
 * 用于在 PrismerCloud IM 未就绪时测试 OpenClaw 集成。
 *
 * 运行:
 *   npx tsx mock-im-server.ts
 *
 * 功能:
 *   - WebSocket 连接 (ws://localhost:3456/ws)
 *   - 消息收发
 *   - UIDirective 接收和日志
 *   - SkillEvent 接收和日志
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';

const PORT = 3456;

// ============================================================
// Types
// ============================================================

interface IMMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'markdown' | 'code' | 'system_event';
  metadata?: {
    prismer?: {
      type: 'ui_directive' | 'skill_event';
      directive?: unknown;
      skillEvent?: unknown;
    };
  };
  createdAt: string;
}

interface WSMessage {
  type: string;
  payload: unknown;
}

// ============================================================
// State
// ============================================================

const clients = new Map<string, WebSocket>();
const messages: IMMessage[] = [];

// ============================================================
// HTTP Server
// ============================================================

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'mock-im-server' }));
    return;
  }

  // Send message API
  if (url.pathname.startsWith('/api/im/messages') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const message: IMMessage = {
          id: `msg-${Date.now()}`,
          conversationId: url.pathname.split('/')[4] || 'test',
          senderId: 'agent',
          content: data.content,
          type: data.type || 'text',
          metadata: data.metadata,
          createdAt: new Date().toISOString(),
        };

        messages.push(message);

        // Log UIDirective or SkillEvent
        if (message.metadata?.prismer) {
          const prismerData = message.metadata.prismer;
          if (prismerData.type === 'ui_directive') {
            console.log('\n📱 UIDirective Received:');
            console.log(JSON.stringify(prismerData.directive, null, 2));
          } else if (prismerData.type === 'skill_event') {
            console.log('\n🛠️ SkillEvent Received:');
            console.log(JSON.stringify(prismerData.skillEvent, null, 2));
          }
        } else {
          console.log(`\n💬 Message: ${message.content}`);
        }

        // Broadcast to WebSocket clients
        broadcast({
          type: 'message.new',
          payload: message,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          data: { conversationId: message.conversationId, message },
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: { message: 'Invalid JSON' } }));
      }
    });
    return;
  }

  // Get messages API
  if (url.pathname.startsWith('/api/im/messages') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, data: { messages } }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: { message: 'Not Found' } }));
});

// ============================================================
// WebSocket Server
// ============================================================

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const token = url.searchParams.get('token') || 'anonymous';
  const clientId = `client-${Date.now()}`;

  clients.set(clientId, ws);
  console.log(`\n🔌 WebSocket connected: ${clientId} (token: ${token})`);

  // Send authenticated event
  ws.send(JSON.stringify({
    type: 'authenticated',
    payload: { clientId, token },
  }));

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`\n📥 WS Message from ${clientId}:`, msg);

      // Handle different message types
      if (msg.type === 'message.send') {
        const message: IMMessage = {
          id: `msg-${Date.now()}`,
          conversationId: msg.conversationId || 'test',
          senderId: clientId,
          content: msg.content,
          type: msg.messageType || 'text',
          metadata: msg.metadata,
          createdAt: new Date().toISOString(),
        };

        messages.push(message);

        // Broadcast to all clients
        broadcast({
          type: 'message.new',
          payload: message,
        });
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`\n🔌 WebSocket disconnected: ${clientId}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  });
});

function broadcast(message: WSMessage) {
  const data = JSON.stringify(message);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

// ============================================================
// Start Server
// ============================================================

httpServer.listen(PORT, () => {
  console.log('============================================================');
  console.log('  Mock IM Server for OpenClaw Testing');
  console.log('============================================================');
  console.log(`\n  HTTP API:    http://localhost:${PORT}`);
  console.log(`  WebSocket:   ws://localhost:${PORT}/ws?token=<token>`);
  console.log(`  Health:      http://localhost:${PORT}/health`);
  console.log('\n  Endpoints:');
  console.log(`    POST /api/im/messages/:conversationId  - Send message`);
  console.log(`    GET  /api/im/messages/:conversationId  - Get messages`);
  console.log('\n============================================================');
  console.log('  Waiting for connections...\n');
});

// ============================================================
// Interactive CLI
// ============================================================

// 允许从命令行发送测试消息
process.stdin.setEncoding('utf8');
process.stdin.on('readable', () => {
  let chunk: string | null;
  while ((chunk = process.stdin.read() as string | null) !== null) {
    const input = chunk.trim();
    if (input) {
      // 发送测试消息给所有连接的 agent
      const message: IMMessage = {
        id: `msg-${Date.now()}`,
        conversationId: 'test',
        senderId: 'user',
        content: input,
        type: 'text',
        createdAt: new Date().toISOString(),
      };

      messages.push(message);
      broadcast({
        type: 'message.new',
        payload: message,
      });

      console.log(`\n📤 Sent to agents: "${input}"`);
    }
  }
});

console.log('💡 Type a message and press Enter to send it to connected agents.\n');
