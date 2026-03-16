"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AccountClient: () => AccountClient,
  AttachmentQueue: () => AttachmentQueue,
  BindingsClient: () => BindingsClient,
  ContactsClient: () => ContactsClient,
  ConversationsClient: () => ConversationsClient,
  CreditsClient: () => CreditsClient,
  DirectClient: () => DirectClient,
  E2EEncryption: () => E2EEncryption,
  ENVIRONMENTS: () => ENVIRONMENTS,
  FilesClient: () => FilesClient,
  GroupsClient: () => GroupsClient,
  IMClient: () => IMClient,
  IMRealtimeClient: () => IMRealtimeClient,
  IndexedDBStorage: () => IndexedDBStorage,
  MemoryStorage: () => MemoryStorage,
  MessagesClient: () => MessagesClient,
  OfflineManager: () => OfflineManager,
  PrismerClient: () => PrismerClient,
  RealtimeSSEClient: () => RealtimeSSEClient,
  RealtimeWSClient: () => RealtimeWSClient,
  SQLiteStorage: () => SQLiteStorage,
  TabCoordinator: () => TabCoordinator,
  WorkspaceClient: () => WorkspaceClient,
  createClient: () => createClient,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/realtime.ts
var TypedEmitter = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, /* @__PURE__ */ new Set());
    this.listeners.get(event).add(cb);
    return this;
  }
  off(event, cb) {
    this.listeners.get(event)?.delete(cb);
    return this;
  }
  once(event, cb) {
    const wrapper = (payload) => {
      this.off(event, wrapper);
      cb(payload);
    };
    return this.on(event, wrapper);
  }
  emit(event, payload) {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(payload);
        } catch (_) {
        }
      }
    }
  }
  removeAllListeners() {
    this.listeners.clear();
  }
};
var Reconnector = class {
  constructor(config) {
    this.attempt = 0;
    this.connectedAt = 0;
    this.baseDelay = config.reconnectBaseDelay ?? 1e3;
    this.maxDelay = config.reconnectMaxDelay ?? 3e4;
    this.maxAttempts = config.maxReconnectAttempts ?? 10;
  }
  get shouldReconnect() {
    return this.maxAttempts === 0 || this.attempt < this.maxAttempts;
  }
  get currentAttempt() {
    return this.attempt;
  }
  markConnected() {
    this.connectedAt = Date.now();
  }
  nextDelay() {
    if (this.connectedAt > 0 && Date.now() - this.connectedAt > 6e4) {
      this.attempt = 0;
    }
    const jitter = Math.random() * this.baseDelay * 0.5;
    const delay = Math.min(this.baseDelay * Math.pow(2, this.attempt) + jitter, this.maxDelay);
    this.attempt++;
    return delay;
  }
  reset() {
    this.attempt = 0;
    this.connectedAt = 0;
  }
};
var RealtimeWSClient = class extends TypedEmitter {
  constructor(baseUrl, config) {
    super();
    this.ws = null;
    this.heartbeatTimer = null;
    this.pongTimer = null;
    this.reconnectTimer = null;
    this.pendingPings = /* @__PURE__ */ new Map();
    this._state = "disconnected";
    this.intentionalClose = false;
    this.pingCounter = 0;
    this.handleMessage = (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
        const { type, payload } = msg;
        if (type === "pong" && payload?.requestId) {
          const pending = this.pendingPings.get(payload.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pending.resolve(payload);
            this.pendingPings.delete(payload.requestId);
          }
        }
        this.emit(type, payload);
      } catch (_) {
      }
    };
    this.handleClose = (ev) => {
      this.stopHeartbeat();
      this.clearPendingPings();
      this.ws = null;
      if (this.intentionalClose) return;
      this._state = "disconnected";
      this.emit("disconnected", { code: ev.code, reason: ev.reason });
      if (this.config.autoReconnect && this.reconnector.shouldReconnect) {
        this.scheduleReconnect();
      }
    };
    const base = baseUrl.replace(/^http/, "ws");
    this.wsUrl = `${base}/ws?token=${config.token}`;
    this.config = {
      autoReconnect: true,
      heartbeatInterval: 25e3,
      ...config
    };
    this.reconnector = new Reconnector(config);
    this.WS = config.WebSocket || WebSocket;
  }
  get state() {
    return this._state;
  }
  async connect() {
    if (this._state === "connected" || this._state === "connecting") return;
    this._state = "connecting";
    this.intentionalClose = false;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new this.WS(this.wsUrl);
      } catch (err) {
        this._state = "disconnected";
        reject(err);
        return;
      }
      const onOpen = () => {
        cleanup();
      };
      const onFirstMessage = (ev) => {
        try {
          const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
          if (msg.type === "authenticated") {
            this._state = "connected";
            this.reconnector.markConnected();
            this.startHeartbeat();
            this.emit("authenticated", msg.payload);
            this.emit("connected", void 0);
            this.ws.removeEventListener("message", onFirstMessage);
            this.ws.addEventListener("message", this.handleMessage);
            resolve();
          }
        } catch (_) {
        }
      };
      const onError = (ev) => {
        cleanup();
        if (this._state === "connecting") {
          this._state = "disconnected";
          reject(new Error("WebSocket connection failed"));
        }
      };
      const onClose = (ev) => {
        cleanup();
        if (this._state === "connecting") {
          this._state = "disconnected";
          reject(new Error(`WebSocket closed during connect: ${ev.code} ${ev.reason}`));
        }
      };
      const cleanup = () => {
        this.ws?.removeEventListener("error", onError);
        this.ws?.removeEventListener("close", onClose);
      };
      this.ws.addEventListener("open", onOpen);
      this.ws.addEventListener("message", onFirstMessage);
      this.ws.addEventListener("error", onError);
      this.ws.addEventListener("close", onClose);
      this.ws.addEventListener("close", this.handleClose);
    });
  }
  disconnect(code = 1e3, reason = "client disconnect") {
    this.intentionalClose = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.clearPendingPings();
    if (this.ws) {
      this.ws.removeEventListener("message", this.handleMessage);
      this.ws.removeEventListener("close", this.handleClose);
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(code, reason);
      }
      this.ws = null;
    }
    this._state = "disconnected";
    this.emit("disconnected", { code, reason });
  }
  // --- Commands ---
  joinConversation(conversationId) {
    this.sendRaw({ type: "conversation.join", payload: { conversationId } });
  }
  sendMessage(conversationId, content, type = "text") {
    this.sendRaw({
      type: "message.send",
      payload: { conversationId, content, type },
      requestId: `msg-${++this.pingCounter}`
    });
  }
  startTyping(conversationId) {
    this.sendRaw({ type: "typing.start", payload: { conversationId } });
  }
  stopTyping(conversationId) {
    this.sendRaw({ type: "typing.stop", payload: { conversationId } });
  }
  updatePresence(status) {
    this.sendRaw({ type: "presence.update", payload: { status } });
  }
  send(command) {
    this.sendRaw(command);
  }
  ping() {
    const requestId = `ping-${++this.pingCounter}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingPings.delete(requestId);
        reject(new Error("Ping timeout"));
      }, 1e4);
      this.pendingPings.set(requestId, { resolve, timer });
      this.sendRaw({ type: "ping", payload: { requestId } });
    });
  }
  // --- Internal ---
  sendRaw(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  scheduleReconnect() {
    const delay = this.reconnector.nextDelay();
    this._state = "reconnecting";
    this.emit("reconnecting", { attempt: this.reconnector.currentAttempt, delayMs: delay });
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (_) {
        if (this.config.autoReconnect && this.reconnector.shouldReconnect) {
          this.scheduleReconnect();
        } else {
          this._state = "disconnected";
        }
      }
    }, delay);
  }
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this._state !== "connected") return;
      const requestId = `hb-${++this.pingCounter}`;
      this.sendRaw({ type: "ping", payload: { requestId } });
      this.pongTimer = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(4e3, "heartbeat timeout");
        }
      }, 1e4);
      const onPong = (payload) => {
        if (this.pongTimer) {
          clearTimeout(this.pongTimer);
          this.pongTimer = null;
        }
        this.off("pong", onPong);
      };
      this.on("pong", onPong);
    }, this.config.heartbeatInterval);
  }
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  clearPendingPings() {
    for (const [, { timer }] of this.pendingPings) {
      clearTimeout(timer);
    }
    this.pendingPings.clear();
  }
};
var RealtimeSSEClient = class extends TypedEmitter {
  constructor(baseUrl, config) {
    super();
    this.abortController = null;
    this.reconnectTimer = null;
    this.heartbeatWatchdog = null;
    this.lastDataTime = 0;
    this._state = "disconnected";
    this.intentionalClose = false;
    this.sseUrl = `${baseUrl}/sse?token=${config.token}`;
    this.config = {
      autoReconnect: true,
      ...config
    };
    this.reconnector = new Reconnector(config);
    this.fetchFn = config.fetch || fetch;
  }
  get state() {
    return this._state;
  }
  async connect() {
    if (this._state === "connected" || this._state === "connecting") return;
    this._state = "connecting";
    this.intentionalClose = false;
    this.abortController = new AbortController();
    const response = await this.fetchFn(this.sseUrl, {
      headers: { "Accept": "text/event-stream" },
      signal: this.abortController.signal
    });
    if (!response.ok) {
      this._state = "disconnected";
      throw new Error(`SSE connection failed: ${response.status}`);
    }
    if (!response.body) {
      this._state = "disconnected";
      throw new Error("SSE response has no body");
    }
    this._state = "connected";
    this.reconnector.markConnected();
    this.lastDataTime = Date.now();
    this.startHeartbeatWatchdog();
    this.emit("connected", void 0);
    this.readStream(response.body);
  }
  disconnect() {
    this.intentionalClose = true;
    this.stopHeartbeatWatchdog();
    this.clearReconnectTimer();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this._state = "disconnected";
    this.emit("disconnected", { code: 1e3, reason: "client disconnect" });
  }
  // --- Internal ---
  async readStream(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          this.lastDataTime = Date.now();
          if (line.startsWith(":")) {
            continue;
          }
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            try {
              const msg = JSON.parse(jsonStr);
              this.emit(msg.type, msg.payload);
            } catch (_) {
            }
          }
        }
      }
    } catch (err) {
      if (this.intentionalClose) return;
    } finally {
      reader.releaseLock();
    }
    if (this.intentionalClose) return;
    this._state = "disconnected";
    this.stopHeartbeatWatchdog();
    this.emit("disconnected", { code: 0, reason: "stream ended" });
    if (this.config.autoReconnect && this.reconnector.shouldReconnect) {
      this.scheduleReconnect();
    }
  }
  scheduleReconnect() {
    const delay = this.reconnector.nextDelay();
    this._state = "reconnecting";
    this.emit("reconnecting", { attempt: this.reconnector.currentAttempt, delayMs: delay });
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (_) {
        if (this.config.autoReconnect && this.reconnector.shouldReconnect) {
          this.scheduleReconnect();
        } else {
          this._state = "disconnected";
        }
      }
    }, delay);
  }
  startHeartbeatWatchdog() {
    this.stopHeartbeatWatchdog();
    this.heartbeatWatchdog = setInterval(() => {
      if (Date.now() - this.lastDataTime > 45e3) {
        this.stopHeartbeatWatchdog();
        if (this.abortController) {
          this.abortController.abort();
          this.abortController = null;
        }
      }
    }, 15e3);
  }
  stopHeartbeatWatchdog() {
    if (this.heartbeatWatchdog) {
      clearInterval(this.heartbeatWatchdog);
      this.heartbeatWatchdog = null;
    }
  }
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
};

// src/offline.ts
var OfflineEmitter = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, /* @__PURE__ */ new Set());
    this.listeners.get(event).add(cb);
    return this;
  }
  off(event, cb) {
    this.listeners.get(event)?.delete(cb);
    return this;
  }
  emit(event, payload) {
    const set = this.listeners.get(event);
    if (set) for (const cb of set) {
      try {
        cb(payload);
      } catch {
      }
    }
  }
  removeAllListeners() {
    this.listeners.clear();
  }
};
function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
var WRITE_PATTERNS = [
  { method: "POST", pattern: /\/api\/im\/(messages|direct|groups)\//, opType: "message.send" },
  { method: "PATCH", pattern: /\/api\/im\/messages\//, opType: "message.edit" },
  { method: "DELETE", pattern: /\/api\/im\/messages\//, opType: "message.delete" },
  { method: "POST", pattern: /\/api\/im\/conversations\/[^/]+\/read/, opType: "conversation.read" }
];
function matchWriteOp(method, path) {
  for (const { method: m, pattern, opType } of WRITE_PATTERNS) {
    if (method === m && pattern.test(path)) return opType;
  }
  return null;
}
var OfflineManager = class extends OfflineEmitter {
  constructor(storage, networkRequest, options = {}) {
    super();
    this.flushTimer = null;
    this.flushing = false;
    this._isOnline = true;
    this._syncState = "idle";
    this.sseSource = null;
    this.sseReconnectTimer = null;
    this.sseReconnectAttempts = 0;
    /** Presence cache for realtime presence events */
    this.presenceCache = /* @__PURE__ */ new Map();
    this.storage = storage;
    this.networkRequest = networkRequest;
    this.options = {
      syncOnConnect: options.syncOnConnect ?? true,
      outboxRetryLimit: options.outboxRetryLimit ?? 5,
      outboxFlushInterval: options.outboxFlushInterval ?? 1e3,
      conflictStrategy: options.conflictStrategy ?? "server",
      onConflict: options.onConflict,
      syncMode: options.syncMode ?? "push",
      quota: options.quota ? {
        maxStorageBytes: options.quota.maxStorageBytes ?? 500 * 1024 * 1024,
        warningThreshold: options.quota.warningThreshold ?? 0.9
      } : void 0
    };
  }
  get isOnline() {
    return this._isOnline;
  }
  get syncState() {
    return this._syncState;
  }
  async init() {
    await this.storage.init();
    this.startFlushTimer();
  }
  async destroy() {
    this.stopFlushTimer();
    this.stopContinuousSync();
    this.removeAllListeners();
  }
  // ── Network state ─────────────────────────────────────────
  setOnline(online) {
    if (this._isOnline === online) return;
    this._isOnline = online;
    this.emit(online ? "network.online" : "network.offline", void 0);
    if (online) {
      this.flush();
      if (this.options.syncOnConnect) {
        if (this.options.syncMode === "push") {
          this.startContinuousSync();
        } else {
          this.sync();
        }
      }
    } else {
      this.stopContinuousSync();
    }
  }
  // ── Request dispatch ──────────────────────────────────────
  /**
   * Dispatch an IM request. Write ops go through outbox; reads check local cache.
   */
  async dispatch(method, path, body, query) {
    const opType = matchWriteOp(method, path);
    if (opType) {
      return this.dispatchWrite(opType, method, path, body, query);
    }
    if (method === "GET") {
      const cached = await this.readFromCache(path, query);
      if (cached !== null) return cached;
    }
    try {
      const result = await this.networkRequest(method, path, body, query);
      if (method === "GET") this.cacheReadResult(path, query, result);
      return result;
    } catch {
      if (!this._isOnline) {
        return { ok: true, data: [] };
      }
      throw new Error("Network request failed");
    }
  }
  // ── Outbox: write operations ──────────────────────────────
  async dispatchWrite(opType, method, path, body, query) {
    const clientId = generateId();
    const idempotencyKey = `sdk-${clientId}`;
    let enrichedBody = body;
    if (body && typeof body === "object" && (opType === "message.send" || opType === "message.edit")) {
      enrichedBody = { ...body };
      enrichedBody.metadata = {
        ...body.metadata,
        _idempotencyKey: idempotencyKey
      };
    }
    let localMessage;
    if (opType === "message.send" && body && typeof body === "object") {
      const b = body;
      const convIdMatch = path.match(/\/(?:messages|direct|groups)\/([^/]+)/);
      const conversationId = convIdMatch?.[1] ?? "";
      localMessage = {
        id: `local-${clientId}`,
        clientId,
        conversationId,
        content: b.content ?? "",
        type: b.type ?? "text",
        senderId: "__self__",
        parentId: b.parentId ?? null,
        status: "pending",
        metadata: b.metadata,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await this.storage.putMessages([localMessage]);
      this.emit("message.local", localMessage);
    }
    const op = {
      id: clientId,
      type: opType,
      method,
      path,
      body: enrichedBody,
      query,
      status: "pending",
      createdAt: Date.now(),
      retries: 0,
      maxRetries: this.options.outboxRetryLimit,
      idempotencyKey,
      localData: localMessage
    };
    await this.storage.enqueue(op);
    if (this._isOnline) this.flush();
    const optimisticResult = {
      ok: true,
      data: localMessage ? { conversationId: localMessage.conversationId, message: localMessage } : void 0,
      _pending: true,
      _clientId: clientId
    };
    return optimisticResult;
  }
  // ── Outbox flush ──────────────────────────────────────────
  startFlushTimer() {
    this.stopFlushTimer();
    this.flushTimer = setInterval(() => this.flush(), this.options.outboxFlushInterval);
  }
  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
  async flush() {
    if (this.flushing || !this._isOnline) return;
    this.flushing = true;
    try {
      const ops = await this.storage.dequeueReady(10);
      for (const op of ops) {
        this.emit("outbox.sending", { opId: op.id, type: op.type });
        try {
          const result = await this.networkRequest(
            op.method,
            op.path,
            op.body,
            op.query
          );
          if (result.ok) {
            await this.storage.ack(op.id);
            this.emit("outbox.confirmed", { opId: op.id, serverData: result.data });
            if (op.type === "message.send" && op.localData) {
              const local = op.localData;
              const serverMsg = result.data?.message;
              if (serverMsg) {
                await this.storage.deleteMessage(local.id);
                await this.storage.putMessages([{
                  id: serverMsg.id,
                  clientId: op.id,
                  conversationId: serverMsg.conversationId ?? local.conversationId,
                  content: serverMsg.content ?? local.content,
                  type: serverMsg.type ?? local.type,
                  senderId: serverMsg.senderId ?? local.senderId,
                  parentId: serverMsg.parentId,
                  status: "confirmed",
                  metadata: serverMsg.metadata ? typeof serverMsg.metadata === "string" ? JSON.parse(serverMsg.metadata) : serverMsg.metadata : void 0,
                  createdAt: serverMsg.createdAt ?? local.createdAt
                }]);
                this.emit("message.confirmed", { clientId: op.id, serverMessage: serverMsg });
              }
            }
          } else {
            const errCode = result.error?.code;
            if (errCode && !errCode.includes("TIMEOUT") && !errCode.includes("NETWORK")) {
              await this.storage.nack(op.id, result.error?.message ?? "Request failed", op.maxRetries);
              this.emit("outbox.failed", { opId: op.id, error: result.error?.message ?? "Request failed", retriesLeft: 0 });
              if (op.type === "message.send") {
                this.emit("message.failed", { clientId: op.id, error: result.error?.message ?? "Request failed" });
              }
            } else {
              await this.storage.nack(op.id, result.error?.message ?? "Transient error", op.retries + 1);
              this.emit("outbox.failed", {
                opId: op.id,
                error: result.error?.message ?? "Transient error",
                retriesLeft: op.maxRetries - op.retries - 1
              });
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          await this.storage.nack(op.id, msg, op.retries + 1);
          if (op.retries + 1 >= op.maxRetries) {
            this.emit("outbox.failed", { opId: op.id, error: msg, retriesLeft: 0 });
            if (op.type === "message.send") {
              this.emit("message.failed", { clientId: op.id, error: msg });
            }
          }
        }
      }
    } finally {
      this.flushing = false;
    }
  }
  get outboxSize() {
    return this.storage.getPendingCount();
  }
  // ── Sync engine ───────────────────────────────────────────
  async sync() {
    if (this._syncState === "syncing" || !this._isOnline) return;
    this._syncState = "syncing";
    this.emit("sync.start", void 0);
    let totalNew = 0;
    let totalUpdated = 0;
    try {
      let cursor = await this.storage.getCursor("global_sync") ?? "0";
      let hasMore = true;
      while (hasMore) {
        const result = await this.networkRequest(
          "GET",
          "/api/im/sync",
          void 0,
          { since: cursor, limit: "100" }
        );
        if (!result.ok || !result.data) {
          throw new Error(result.error?.message ?? "Sync failed");
        }
        const { events, cursor: newCursor, hasMore: more } = result.data;
        for (const event of events) {
          await this.applySyncEvent(event);
          if (event.type === "message.new") totalNew++;
          if (event.type.startsWith("conversation.")) totalUpdated++;
        }
        cursor = String(newCursor);
        await this.storage.setCursor("global_sync", cursor);
        hasMore = more;
        this.emit("sync.progress", { synced: events.length, total: events.length });
      }
      this._syncState = "idle";
      this.emit("sync.complete", { newMessages: totalNew, updatedConversations: totalUpdated });
    } catch (err) {
      this._syncState = "error";
      this.emit("sync.error", {
        error: err instanceof Error ? err.message : "Sync failed",
        willRetry: false
      });
    }
  }
  async applySyncEvent(event) {
    switch (event.type) {
      case "message.new": {
        const msg = event.data;
        await this.storage.putMessages([{
          id: msg.id,
          conversationId: msg.conversationId ?? event.conversationId ?? "",
          content: msg.content ?? "",
          type: msg.type ?? "text",
          senderId: msg.senderId ?? "",
          parentId: msg.parentId ?? null,
          status: "confirmed",
          metadata: msg.metadata,
          createdAt: msg.createdAt ?? event.at,
          syncSeq: event.seq
        }]);
        break;
      }
      case "message.edit": {
        const existing = await this.storage.getMessage(event.data.id);
        if (existing) {
          const hasLocalEdits = existing.status !== "confirmed";
          if (hasLocalEdits && this.options.onConflict) {
            const resolution = this.options.onConflict(existing, event);
            if (resolution === "keep_local") break;
            if (resolution !== "accept_remote" && typeof resolution === "object") {
              resolution.syncSeq = event.seq;
              await this.storage.putMessages([resolution]);
              break;
            }
          }
          existing.content = event.data.content ?? existing.content;
          existing.updatedAt = event.at;
          existing.syncSeq = event.seq;
          await this.storage.putMessages([existing]);
        }
        break;
      }
      case "message.delete": {
        if (event.data?.id) await this.storage.deleteMessage(event.data.id);
        break;
      }
      case "conversation.create":
      case "conversation.update": {
        const conv = event.data;
        await this.storage.putConversations([{
          id: conv.id ?? event.conversationId ?? "",
          type: conv.type ?? "direct",
          title: conv.title,
          unreadCount: conv.unreadCount ?? 0,
          members: conv.members,
          metadata: conv.metadata,
          syncSeq: event.seq,
          updatedAt: event.at,
          lastMessageAt: conv.lastMessageAt
        }]);
        break;
      }
      case "conversation.archive": {
        const convId = event.data?.id ?? event.conversationId;
        if (convId) {
          const existing = await this.storage.getConversation(convId);
          if (existing) {
            existing.metadata = { ...existing.metadata, _archived: true };
            existing.syncSeq = event.seq;
            existing.updatedAt = event.at;
            await this.storage.putConversations([existing]);
          }
        }
        break;
      }
      case "participant.add": {
        const convId = event.data?.conversationId ?? event.conversationId;
        if (convId) {
          const existing = await this.storage.getConversation(convId);
          if (existing && existing.members) {
            const already = existing.members.find((m) => m.userId === event.data.userId);
            if (!already) {
              existing.members.push({
                userId: event.data.userId,
                username: event.data.username ?? "",
                displayName: event.data.displayName,
                role: event.data.role ?? "member"
              });
              existing.syncSeq = event.seq;
              existing.updatedAt = event.at;
              await this.storage.putConversations([existing]);
            }
          }
        }
        break;
      }
      case "participant.remove": {
        const convId = event.data?.conversationId ?? event.conversationId;
        if (convId) {
          const existing = await this.storage.getConversation(convId);
          if (existing && existing.members) {
            existing.members = existing.members.filter((m) => m.userId !== event.data.userId);
            existing.syncSeq = event.seq;
            existing.updatedAt = event.at;
            await this.storage.putConversations([existing]);
          }
        }
        break;
      }
    }
  }
  /**
   * Handle a realtime event (from WS/SSE) and store locally.
   */
  async handleRealtimeEvent(type, payload) {
    if (type === "message.new" && payload) {
      await this.storage.putMessages([{
        id: payload.id,
        conversationId: payload.conversationId ?? "",
        content: payload.content ?? "",
        type: payload.type ?? "text",
        senderId: payload.senderId ?? "",
        parentId: payload.parentId ?? null,
        status: "confirmed",
        metadata: payload.metadata,
        createdAt: payload.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
      }]);
    }
    if (type === "presence.changed" && payload?.userId) {
      this.presenceCache.set(payload.userId, {
        status: payload.status ?? "offline",
        lastSeen: payload.lastSeen ?? (/* @__PURE__ */ new Date()).toISOString()
      });
      this.emit("presence.changed", payload);
    }
  }
  /**
   * Get cached presence status for a user.
   */
  getPresence(userId) {
    return this.presenceCache.get(userId) ?? null;
  }
  /**
   * Search messages in local storage.
   */
  async searchMessages(query, opts) {
    if (this.storage.searchMessages) {
      return this.storage.searchMessages(query, opts);
    }
    return [];
  }
  /**
   * Get storage size and quota info.
   */
  async getQuotaStatus() {
    const limit = this.options.quota?.maxStorageBytes ?? 500 * 1024 * 1024;
    const threshold = this.options.quota?.warningThreshold ?? 0.9;
    if (this.storage.getStorageSize) {
      const size = await this.storage.getStorageSize();
      const percentage = size.total / limit;
      return {
        used: size.total,
        limit,
        percentage,
        warning: percentage >= threshold,
        exceeded: percentage >= 1
      };
    }
    return { used: 0, limit, percentage: 0, warning: false, exceeded: false };
  }
  /**
   * Clear old messages for a conversation (user-initiated quota management).
   */
  async clearOldMessages(conversationId, keepCount) {
    if (this.storage.clearOldMessages) {
      return this.storage.clearOldMessages(conversationId, keepCount);
    }
    return 0;
  }
  // ── Read cache ────────────────────────────────────────────
  async readFromCache(path, query) {
    if (/\/api\/im\/conversations$/.test(path)) {
      const convos = await this.storage.getConversations({ limit: 50 });
      if (convos.length > 0) return { ok: true, data: convos };
    }
    const msgMatch = path.match(/\/api\/im\/messages\/([^/]+)$/);
    if (msgMatch) {
      const convId = msgMatch[1];
      const limit = query?.limit ? parseInt(query.limit) : 50;
      const messages = await this.storage.getMessages(convId, { limit, before: query?.before });
      if (messages.length > 0) return { ok: true, data: messages };
    }
    if (/\/api\/im\/contacts$/.test(path)) {
      const contacts = await this.storage.getContacts();
      if (contacts.length > 0) return { ok: true, data: contacts };
    }
    return null;
  }
  async cacheReadResult(path, _query, result) {
    if (!result?.ok || !result?.data) return;
    try {
      if (/\/api\/im\/conversations$/.test(path) && Array.isArray(result.data)) {
        const convos = result.data.map((c) => ({
          id: c.id,
          type: c.type ?? "direct",
          title: c.title,
          lastMessage: c.lastMessage,
          lastMessageAt: c.lastMessageAt ?? c.updatedAt,
          unreadCount: c.unreadCount ?? 0,
          members: c.members,
          metadata: c.metadata,
          updatedAt: c.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString()
        }));
        await this.storage.putConversations(convos);
      }
      const msgMatch = path.match(/\/api\/im\/messages\/([^/]+)$/);
      if (msgMatch && Array.isArray(result.data)) {
        const messages = result.data.map((m) => ({
          id: m.id,
          conversationId: m.conversationId ?? msgMatch[1],
          content: m.content ?? "",
          type: m.type ?? "text",
          senderId: m.senderId ?? "",
          parentId: m.parentId ?? null,
          status: "confirmed",
          metadata: m.metadata,
          createdAt: m.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
        }));
        await this.storage.putMessages(messages);
      }
      if (/\/api\/im\/contacts$/.test(path) && Array.isArray(result.data)) {
        await this.storage.putContacts(result.data);
      }
    } catch {
    }
  }
  // ── SSE continuous sync ────────────────────────────────────
  /**
   * Start continuous sync via SSE (Server-Sent Events).
   * Replaces polling with real-time push when syncMode is 'push'.
   */
  async startContinuousSync() {
    if (this.sseSource) return;
    if (typeof EventSource === "undefined") {
      return this.sync();
    }
    const token = this.tokenProvider?.();
    if (!token) {
      return this.sync();
    }
    const cursor = await this.storage.getCursor("global_sync") ?? "0";
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/im/sync/stream?token=${encodeURIComponent(token)}&since=${cursor}`;
    this._syncState = "syncing";
    this.emit("sync.start", void 0);
    this.sseReconnectAttempts = 0;
    try {
      this.sseSource = new EventSource(url);
      let totalNew = 0;
      let totalUpdated = 0;
      this.sseSource.addEventListener("sync", async (e) => {
        try {
          const event = JSON.parse(e.data);
          await this.applySyncEvent(event);
          await this.storage.setCursor("global_sync", String(event.seq));
          if (event.type === "message.new") totalNew++;
          if (event.type.startsWith("conversation.")) totalUpdated++;
          this.emit("sync.progress", { synced: 1, total: 1 });
          if (this.options.quota) {
            await this.checkQuota();
          }
        } catch {
        }
      });
      this.sseSource.addEventListener("caught_up", () => {
        this._syncState = "idle";
        this.sseReconnectAttempts = 0;
        this.emit("sync.complete", { newMessages: totalNew, updatedConversations: totalUpdated });
        totalNew = 0;
        totalUpdated = 0;
      });
      this.sseSource.addEventListener("error", () => {
        this._syncState = "error";
        this.emit("sync.error", { error: "SSE connection error", willRetry: true });
      });
      this.sseSource.onerror = () => {
        if (this.sseSource?.readyState === EventSource.CLOSED) {
          this.sseSource = null;
          this._syncState = "error";
          this.scheduleSseReconnect();
        }
      };
    } catch (err) {
      this._syncState = "error";
      this.emit("sync.error", {
        error: err instanceof Error ? err.message : "SSE init failed",
        willRetry: true
      });
      this.scheduleSseReconnect();
    }
  }
  /**
   * Stop the SSE continuous sync connection.
   */
  stopContinuousSync() {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    if (this.sseReconnectTimer) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }
    this._syncState = "idle";
  }
  scheduleSseReconnect() {
    if (!this._isOnline) return;
    this.sseReconnectAttempts++;
    const delay = Math.min(1e3 * Math.pow(2, this.sseReconnectAttempts - 1), 3e4);
    this.sseReconnectTimer = setTimeout(() => {
      this.sseReconnectTimer = null;
      if (this._isOnline) this.startContinuousSync();
    }, delay);
  }
  /** Get the base URL for SSE connections (strip /api/im prefix). */
  getBaseUrl() {
    return typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  }
  // ── Quota check ─────────────────────────────────────────────
  async checkQuota() {
    if (!this.options.quota || !this.storage.getStorageSize) return;
    const size = await this.storage.getStorageSize();
    const limit = this.options.quota.maxStorageBytes;
    const threshold = this.options.quota.warningThreshold;
    const pct = size.total / limit;
    if (pct >= 1) {
      this.emit("quota.exceeded", { used: size.total, limit });
    } else if (pct >= threshold) {
      this.emit("quota.warning", { used: size.total, limit, percentage: pct });
    }
  }
};
var AttachmentQueue = class {
  constructor(offline, networkRequest) {
    this.offline = offline;
    this.networkRequest = networkRequest;
    this.queue = /* @__PURE__ */ new Map();
    this.uploading = false;
  }
  /**
   * Queue a file attachment for offline upload.
   * Returns the queued attachment with a local ID.
   */
  async queueAttachment(conversationId, file, messageContent) {
    const id = generateId();
    const attachment = {
      id,
      conversationId,
      file: { name: file.name, size: file.size, type: file.type },
      data: file.data,
      status: "pending",
      progress: 0,
      messageClientId: generateId(),
      createdAt: Date.now()
    };
    this.queue.set(id, attachment);
    await this.offline.storage.putMessages([{
      id: `local-${attachment.messageClientId}`,
      clientId: attachment.messageClientId,
      conversationId,
      content: messageContent ?? `[File: ${file.name}]`,
      type: "file",
      senderId: "__self__",
      status: "pending",
      metadata: { _attachmentId: id, fileName: file.name, fileSize: file.size },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }]);
    if (this.offline.isOnline) this.processQueue();
    return attachment;
  }
  /** Process pending uploads. */
  async processQueue() {
    if (this.uploading || !this.offline.isOnline) return;
    this.uploading = true;
    try {
      for (const [id, att] of this.queue) {
        if (att.status !== "pending") continue;
        att.status = "uploading";
        try {
          const presign = await this.networkRequest(
            "POST",
            "/api/im/files/presign",
            { fileName: att.file.name, fileSize: att.file.size, mimeType: att.file.type }
          );
          if (!presign.ok || !presign.data?.uploadUrl) {
            throw new Error(presign.error?.message ?? "Presign failed");
          }
          if (att.data) {
            await fetch(presign.data.uploadUrl, {
              method: "PUT",
              body: att.data,
              headers: { "Content-Type": att.file.type }
            });
          }
          att.progress = 80;
          const confirm = await this.networkRequest(
            "POST",
            "/api/im/files/confirm",
            { uploadId: presign.data.uploadId }
          );
          if (!confirm.ok) {
            throw new Error(confirm.error?.message ?? "Confirm failed");
          }
          att.status = "uploaded";
          att.progress = 100;
          await this.networkRequest(
            "POST",
            `/api/im/messages/${att.conversationId}`,
            {
              type: "file",
              content: `[File: ${att.file.name}]`,
              metadata: {
                fileUrl: confirm.data?.url ?? presign.data.downloadUrl,
                fileName: att.file.name,
                fileSize: att.file.size,
                mimeType: att.file.type,
                uploadId: presign.data.uploadId
              }
            }
          );
          await this.offline.storage.deleteMessage(`local-${att.messageClientId}`);
          this.queue.delete(id);
        } catch (err) {
          att.status = "failed";
          att.error = err instanceof Error ? err.message : "Upload failed";
        }
      }
    } finally {
      this.uploading = false;
    }
  }
  /** Get all queued attachments. */
  getQueue() {
    return Array.from(this.queue.values());
  }
  /** Retry a failed attachment upload. */
  async retry(attachmentId) {
    const att = this.queue.get(attachmentId);
    if (att && att.status === "failed") {
      att.status = "pending";
      att.error = void 0;
      if (this.offline.isOnline) this.processQueue();
    }
  }
  /** Cancel and remove a queued attachment. */
  async cancel(attachmentId) {
    const att = this.queue.get(attachmentId);
    if (att) {
      await this.offline.storage.deleteMessage(`local-${att.messageClientId}`);
      this.queue.delete(attachmentId);
    }
  }
};

// src/types.ts
var ENVIRONMENTS = {
  production: "https://prismer.cloud"
};

// src/storage.ts
var MemoryStorage = class {
  constructor() {
    this.messages = /* @__PURE__ */ new Map();
    this.conversations = /* @__PURE__ */ new Map();
    this.contacts = /* @__PURE__ */ new Map();
    this.cursors = /* @__PURE__ */ new Map();
    this.outbox = /* @__PURE__ */ new Map();
  }
  async init() {
  }
  // ── Messages ────────────────────────────────────────────────
  async putMessages(messages) {
    for (const m of messages) this.messages.set(m.id, { ...m });
  }
  async getMessages(conversationId, opts) {
    const all = Array.from(this.messages.values()).filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (opts.before) {
      const idx = all.findIndex((m) => m.id === opts.before);
      if (idx > 0) return all.slice(Math.max(0, idx - opts.limit), idx);
    }
    return all.slice(-opts.limit);
  }
  async getMessage(messageId) {
    return this.messages.get(messageId) ?? null;
  }
  async deleteMessage(messageId) {
    this.messages.delete(messageId);
  }
  // ── Conversations ───────────────────────────────────────────
  async putConversations(conversations) {
    for (const c of conversations) this.conversations.set(c.id, { ...c });
  }
  async getConversations(opts) {
    const all = Array.from(this.conversations.values()).sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt));
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? 50;
    return all.slice(offset, offset + limit);
  }
  async getConversation(id) {
    return this.conversations.get(id) ?? null;
  }
  // ── Contacts ────────────────────────────────────────────────
  async putContacts(contacts) {
    for (const c of contacts) this.contacts.set(c.userId, { ...c });
  }
  async getContacts() {
    return Array.from(this.contacts.values());
  }
  // ── Cursors ─────────────────────────────────────────────────
  async getCursor(key) {
    return this.cursors.get(key) ?? null;
  }
  async setCursor(key, value) {
    this.cursors.set(key, value);
  }
  // ── Outbox ──────────────────────────────────────────────────
  async enqueue(op) {
    this.outbox.set(op.id, { ...op });
  }
  async dequeueReady(limit) {
    const ready = Array.from(this.outbox.values()).filter((op) => op.status === "pending").sort((a, b) => a.createdAt - b.createdAt).slice(0, limit);
    for (const op of ready) {
      op.status = "inflight";
      this.outbox.set(op.id, op);
    }
    return ready;
  }
  async ack(opId) {
    this.outbox.delete(opId);
  }
  async nack(opId, error, retries) {
    const op = this.outbox.get(opId);
    if (!op) return;
    op.retries = retries;
    op.lastError = error;
    op.status = retries >= op.maxRetries ? "failed" : "pending";
    this.outbox.set(opId, op);
  }
  async getPendingCount() {
    return Array.from(this.outbox.values()).filter((op) => op.status === "pending" || op.status === "inflight").length;
  }
  // ── Search ─────────────────────────────────────────────────
  async searchMessages(query, opts) {
    const lower = query.toLowerCase();
    const limit = opts?.limit ?? 50;
    return Array.from(this.messages.values()).filter((m) => {
      if (opts?.conversationId && m.conversationId !== opts.conversationId) return false;
      return (m.content ?? "").toLowerCase().includes(lower);
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  // ── Quota ─────────────────────────────────────────────────
  async getStorageSize() {
    const msgSize = this.messages.size * 500;
    const convSize = this.conversations.size * 200;
    return { messages: msgSize, conversations: convSize, total: msgSize + convSize };
  }
  async clearOldMessages(conversationId, keepCount) {
    const msgs = Array.from(this.messages.values()).filter((m) => m.conversationId === conversationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const toDelete = msgs.slice(keepCount);
    for (const m of toDelete) this.messages.delete(m.id);
    return toDelete.length;
  }
  // ── Lifecycle ───────────────────────────────────────────────
  async clear() {
    this.messages.clear();
    this.conversations.clear();
    this.contacts.clear();
    this.cursors.clear();
    this.outbox.clear();
  }
};
var IDB_STORES = ["messages", "conversations", "contacts", "cursors", "outbox"];
var IndexedDBStorage = class {
  constructor(dbName = "prismer-offline", version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }
  async init() {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB is not available in this environment. Use MemoryStorage or SQLiteStorage instead.");
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("messages")) {
          const store = db.createObjectStore("messages", { keyPath: "id" });
          store.createIndex("conversationId", "conversationId", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
        if (!db.objectStoreNames.contains("conversations")) {
          db.createObjectStore("conversations", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("contacts")) {
          db.createObjectStore("contacts", { keyPath: "userId" });
        }
        if (!db.objectStoreNames.contains("cursors")) {
          db.createObjectStore("cursors", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("outbox")) {
          const store = db.createObjectStore("outbox", { keyPath: "id" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }
  tx(stores, mode = "readonly") {
    if (!this.db) throw new Error("IndexedDB not initialized. Call init() first.");
    return this.db.transaction(stores, mode);
  }
  req(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  // ── Messages ────────────────────────────────────────────────
  async putMessages(messages) {
    const tx = this.tx("messages", "readwrite");
    const store = tx.objectStore("messages");
    for (const m of messages) store.put(m);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async getMessages(conversationId, opts) {
    const tx = this.tx("messages");
    const store = tx.objectStore("messages");
    const idx = store.index("conversationId");
    const all = await this.req(idx.getAll(conversationId));
    all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (opts.before) {
      const i = all.findIndex((m) => m.id === opts.before);
      if (i > 0) return all.slice(Math.max(0, i - opts.limit), i);
    }
    return all.slice(-opts.limit);
  }
  async getMessage(messageId) {
    const tx = this.tx("messages");
    const result = await this.req(tx.objectStore("messages").get(messageId));
    return result ?? null;
  }
  async deleteMessage(messageId) {
    const tx = this.tx("messages", "readwrite");
    tx.objectStore("messages").delete(messageId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  // ── Conversations ───────────────────────────────────────────
  async putConversations(conversations) {
    const tx = this.tx("conversations", "readwrite");
    const store = tx.objectStore("conversations");
    for (const c of conversations) store.put(c);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async getConversations(opts) {
    const tx = this.tx("conversations");
    const all = await this.req(tx.objectStore("conversations").getAll());
    all.sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt));
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? 50;
    return all.slice(offset, offset + limit);
  }
  async getConversation(id) {
    const tx = this.tx("conversations");
    const result = await this.req(tx.objectStore("conversations").get(id));
    return result ?? null;
  }
  // ── Contacts ────────────────────────────────────────────────
  async putContacts(contacts) {
    const tx = this.tx("contacts", "readwrite");
    const store = tx.objectStore("contacts");
    for (const c of contacts) store.put(c);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async getContacts() {
    const tx = this.tx("contacts");
    return this.req(tx.objectStore("contacts").getAll());
  }
  // ── Cursors ─────────────────────────────────────────────────
  async getCursor(key) {
    const tx = this.tx("cursors");
    const result = await this.req(tx.objectStore("cursors").get(key));
    return result?.value ?? null;
  }
  async setCursor(key, value) {
    const tx = this.tx("cursors", "readwrite");
    tx.objectStore("cursors").put({ key, value });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  // ── Outbox ──────────────────────────────────────────────────
  async enqueue(op) {
    const tx = this.tx("outbox", "readwrite");
    tx.objectStore("outbox").put(op);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async dequeueReady(limit) {
    const tx = this.tx("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const idx = store.index("status");
    const pending = await this.req(idx.getAll("pending"));
    pending.sort((a, b) => a.createdAt - b.createdAt);
    const batch = pending.slice(0, limit);
    for (const op of batch) {
      op.status = "inflight";
      store.put(op);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(batch);
      tx.onerror = () => reject(tx.error);
    });
  }
  async ack(opId) {
    const tx = this.tx("outbox", "readwrite");
    tx.objectStore("outbox").delete(opId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async nack(opId, error, retries) {
    const tx = this.tx("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const op = await this.req(store.get(opId));
    if (!op) return;
    op.retries = retries;
    op.lastError = error;
    op.status = retries >= op.maxRetries ? "failed" : "pending";
    store.put(op);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async getPendingCount() {
    const tx = this.tx("outbox");
    const idx = tx.objectStore("outbox").index("status");
    const pending = await this.req(idx.count("pending"));
    const inflight = await this.req(idx.count("inflight"));
    return pending + inflight;
  }
  // ── Search ─────────────────────────────────────────────────
  async searchMessages(query, opts) {
    const lower = query.toLowerCase();
    const limit = opts?.limit ?? 50;
    const tx = this.tx("messages");
    let all;
    if (opts?.conversationId) {
      const idx = tx.objectStore("messages").index("conversationId");
      all = await this.req(idx.getAll(opts.conversationId));
    } else {
      all = await this.req(tx.objectStore("messages").getAll());
    }
    return all.filter((m) => (m.content ?? "").toLowerCase().includes(lower)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  // ── Quota ─────────────────────────────────────────────────
  async getStorageSize() {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const total = est.usage ?? 0;
      return { messages: Math.floor(total * 0.8), conversations: Math.floor(total * 0.2), total };
    }
    const tx = this.tx(["messages", "conversations"]);
    const msgCount = await this.req(tx.objectStore("messages").count());
    const convCount = await this.req(tx.objectStore("conversations").count());
    return { messages: msgCount * 500, conversations: convCount * 200, total: msgCount * 500 + convCount * 200 };
  }
  async clearOldMessages(conversationId, keepCount) {
    const tx = this.tx("messages", "readwrite");
    const store = tx.objectStore("messages");
    const idx = store.index("conversationId");
    const all = await this.req(idx.getAll(conversationId));
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const toDelete = all.slice(keepCount);
    for (const m of toDelete) store.delete(m.id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(toDelete.length);
      tx.onerror = () => reject(tx.error);
    });
  }
  // ── Lifecycle ───────────────────────────────────────────────
  async clear() {
    const tx = this.tx(IDB_STORES, "readwrite");
    for (const name of IDB_STORES) tx.objectStore(name).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};
var SQLiteStorage = class {
  constructor(dbPath = "prismer-offline.db") {
    this.db = null;
    this.dbPath = dbPath;
  }
  async init() {
    let Database;
    try {
      Database = require("better-sqlite3");
    } catch {
      throw new Error(
        'SQLiteStorage requires the "better-sqlite3" package. Install it with: npm install better-sqlite3\nFor browser environments, use IndexedDBStorage instead.'
      );
    }
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        clientId TEXT,
        conversationId TEXT NOT NULL,
        content TEXT,
        type TEXT DEFAULT 'text',
        senderId TEXT,
        parentId TEXT,
        status TEXT DEFAULT 'confirmed',
        metadata TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        syncSeq INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversationId, createdAt);
      CREATE INDEX IF NOT EXISTS idx_msg_created ON messages(createdAt);

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        type TEXT DEFAULT 'direct',
        title TEXT,
        lastMessage TEXT,
        lastMessageAt TEXT,
        unreadCount INTEGER DEFAULT 0,
        lastReadMessageId TEXT,
        members TEXT,
        metadata TEXT,
        syncSeq INTEGER,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS contacts (
        userId TEXT PRIMARY KEY,
        username TEXT,
        displayName TEXT,
        role TEXT,
        conversationId TEXT,
        lastMessageAt TEXT,
        unreadCount INTEGER DEFAULT 0,
        syncSeq INTEGER
      );

      CREATE TABLE IF NOT EXISTS cursors (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        type TEXT,
        method TEXT,
        path TEXT,
        body TEXT,
        query TEXT,
        status TEXT DEFAULT 'pending',
        createdAt INTEGER,
        retries INTEGER DEFAULT 0,
        maxRetries INTEGER DEFAULT 5,
        lastError TEXT,
        idempotencyKey TEXT,
        localData TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, createdAt);
    `);
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        content, id UNINDEXED, conversationId UNINDEXED
      );
    `);
  }
  ensureDb() {
    if (!this.db) throw new Error("SQLiteStorage not initialized. Call init() first.");
    return this.db;
  }
  // ── Messages ────────────────────────────────────────────────
  async putMessages(messages) {
    const db = this.ensureDb();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO messages (id, clientId, conversationId, content, type, senderId, parentId, status, metadata, createdAt, updatedAt, syncSeq)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertFts = db.prepare(`
      INSERT OR REPLACE INTO messages_fts (rowid, content, id, conversationId)
      VALUES ((SELECT rowid FROM messages WHERE id = ?), ?, ?, ?)
    `);
    const txn = db.transaction((msgs) => {
      for (const m of msgs) {
        insert.run(
          m.id,
          m.clientId ?? null,
          m.conversationId,
          m.content,
          m.type,
          m.senderId,
          m.parentId ?? null,
          m.status,
          m.metadata ? JSON.stringify(m.metadata) : null,
          m.createdAt,
          m.updatedAt ?? null,
          m.syncSeq ?? null
        );
        if (m.content) {
          insertFts.run(m.id, m.content, m.id, m.conversationId);
        }
      }
    });
    txn(messages);
  }
  async getMessages(conversationId, opts) {
    const db = this.ensureDb();
    let rows;
    if (opts.before) {
      const beforeRow = db.prepare("SELECT createdAt FROM messages WHERE id = ?").get(opts.before);
      if (beforeRow) {
        rows = db.prepare(
          "SELECT * FROM messages WHERE conversationId = ? AND createdAt < ? ORDER BY createdAt DESC LIMIT ?"
        ).all(conversationId, beforeRow.createdAt, opts.limit);
      } else {
        rows = db.prepare(
          "SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt DESC LIMIT ?"
        ).all(conversationId, opts.limit);
      }
    } else {
      rows = db.prepare(
        "SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt DESC LIMIT ?"
      ).all(conversationId, opts.limit);
    }
    return rows.reverse().map(this.rowToMessage);
  }
  async getMessage(messageId) {
    const db = this.ensureDb();
    const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
    return row ? this.rowToMessage(row) : null;
  }
  async deleteMessage(messageId) {
    const db = this.ensureDb();
    db.prepare("DELETE FROM messages WHERE id = ?").run(messageId);
    db.prepare("DELETE FROM messages_fts WHERE id = ?").run(messageId);
  }
  rowToMessage(row) {
    return {
      id: row.id,
      clientId: row.clientId ?? void 0,
      conversationId: row.conversationId,
      content: row.content ?? "",
      type: row.type ?? "text",
      senderId: row.senderId ?? "",
      parentId: row.parentId ?? null,
      status: row.status ?? "confirmed",
      metadata: row.metadata ? JSON.parse(row.metadata) : void 0,
      createdAt: row.createdAt ?? "",
      updatedAt: row.updatedAt ?? void 0,
      syncSeq: row.syncSeq ?? void 0
    };
  }
  // ── Conversations ───────────────────────────────────────────
  async putConversations(conversations) {
    const db = this.ensureDb();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO conversations (id, type, title, lastMessage, lastMessageAt, unreadCount, lastReadMessageId, members, metadata, syncSeq, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const txn = db.transaction((convs) => {
      for (const c of convs) {
        insert.run(
          c.id,
          c.type,
          c.title ?? null,
          c.lastMessage ? JSON.stringify(c.lastMessage) : null,
          c.lastMessageAt ?? null,
          c.unreadCount,
          c.lastReadMessageId ?? null,
          c.members ? JSON.stringify(c.members) : null,
          c.metadata ? JSON.stringify(c.metadata) : null,
          c.syncSeq ?? null,
          c.updatedAt
        );
      }
    });
    txn(conversations);
  }
  async getConversations(opts) {
    const db = this.ensureDb();
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const rows = db.prepare(
      "SELECT * FROM conversations ORDER BY COALESCE(lastMessageAt, updatedAt) DESC LIMIT ? OFFSET ?"
    ).all(limit, offset);
    return rows.map(this.rowToConversation);
  }
  async getConversation(id) {
    const db = this.ensureDb();
    const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
    return row ? this.rowToConversation(row) : null;
  }
  rowToConversation(row) {
    return {
      id: row.id,
      type: row.type ?? "direct",
      title: row.title ?? void 0,
      lastMessage: row.lastMessage ? JSON.parse(row.lastMessage) : void 0,
      lastMessageAt: row.lastMessageAt ?? void 0,
      unreadCount: row.unreadCount ?? 0,
      lastReadMessageId: row.lastReadMessageId ?? void 0,
      members: row.members ? JSON.parse(row.members) : void 0,
      metadata: row.metadata ? JSON.parse(row.metadata) : void 0,
      syncSeq: row.syncSeq ?? void 0,
      updatedAt: row.updatedAt ?? ""
    };
  }
  // ── Contacts ────────────────────────────────────────────────
  async putContacts(contacts) {
    const db = this.ensureDb();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO contacts (userId, username, displayName, role, conversationId, lastMessageAt, unreadCount, syncSeq)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const txn = db.transaction((cs) => {
      for (const c of cs) {
        insert.run(
          c.userId,
          c.username,
          c.displayName,
          c.role,
          c.conversationId,
          c.lastMessageAt ?? null,
          c.unreadCount,
          c.syncSeq ?? null
        );
      }
    });
    txn(contacts);
  }
  async getContacts() {
    const db = this.ensureDb();
    return db.prepare("SELECT * FROM contacts").all().map((row) => ({
      userId: row.userId,
      username: row.username ?? "",
      displayName: row.displayName ?? "",
      role: row.role ?? "member",
      conversationId: row.conversationId ?? "",
      lastMessageAt: row.lastMessageAt ?? void 0,
      unreadCount: row.unreadCount ?? 0,
      syncSeq: row.syncSeq ?? void 0
    }));
  }
  // ── Cursors ─────────────────────────────────────────────────
  async getCursor(key) {
    const db = this.ensureDb();
    const row = db.prepare("SELECT value FROM cursors WHERE key = ?").get(key);
    return row?.value ?? null;
  }
  async setCursor(key, value) {
    const db = this.ensureDb();
    db.prepare("INSERT OR REPLACE INTO cursors (key, value) VALUES (?, ?)").run(key, value);
  }
  // ── Outbox ──────────────────────────────────────────────────
  async enqueue(op) {
    const db = this.ensureDb();
    db.prepare(`
      INSERT OR REPLACE INTO outbox (id, type, method, path, body, query, status, createdAt, retries, maxRetries, lastError, idempotencyKey, localData)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      op.id,
      op.type,
      op.method,
      op.path,
      op.body ? JSON.stringify(op.body) : null,
      op.query ? JSON.stringify(op.query) : null,
      op.status,
      op.createdAt,
      op.retries,
      op.maxRetries,
      op.lastError ?? null,
      op.idempotencyKey,
      op.localData ? JSON.stringify(op.localData) : null
    );
  }
  async dequeueReady(limit) {
    const db = this.ensureDb();
    const rows = db.prepare(
      "SELECT * FROM outbox WHERE status = ? ORDER BY createdAt ASC LIMIT ?"
    ).all("pending", limit);
    const ops = rows.map(this.rowToOutbox);
    const update = db.prepare("UPDATE outbox SET status = ? WHERE id = ?");
    const txn = db.transaction((items) => {
      for (const op of items) update.run("inflight", op.id);
    });
    txn(ops);
    return ops.map((op) => ({ ...op, status: "inflight" }));
  }
  async ack(opId) {
    const db = this.ensureDb();
    db.prepare("DELETE FROM outbox WHERE id = ?").run(opId);
  }
  async nack(opId, error, retries) {
    const db = this.ensureDb();
    const row = db.prepare("SELECT maxRetries FROM outbox WHERE id = ?").get(opId);
    const newStatus = row && retries >= row.maxRetries ? "failed" : "pending";
    db.prepare("UPDATE outbox SET retries = ?, lastError = ?, status = ? WHERE id = ?").run(retries, error, newStatus, opId);
  }
  async getPendingCount() {
    const db = this.ensureDb();
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM outbox WHERE status IN ('pending', 'inflight')"
    ).get();
    return row?.cnt ?? 0;
  }
  // ── Search (FTS5) ─────────────────────────────────────────
  async searchMessages(query, opts) {
    const db = this.ensureDb();
    const limit = opts?.limit ?? 50;
    const safeQuery = query.replace(/['"*(){}[\]^~\\]/g, " ").trim();
    if (!safeQuery) return [];
    let rows;
    if (opts?.conversationId) {
      rows = db.prepare(`
        SELECT m.* FROM messages m
        JOIN messages_fts f ON m.id = f.id
        WHERE messages_fts MATCH ? AND m.conversationId = ?
        ORDER BY m.createdAt DESC LIMIT ?
      `).all(safeQuery, opts.conversationId, limit);
    } else {
      rows = db.prepare(`
        SELECT m.* FROM messages m
        JOIN messages_fts f ON m.id = f.id
        WHERE messages_fts MATCH ?
        ORDER BY m.createdAt DESC LIMIT ?
      `).all(safeQuery, limit);
    }
    return rows.map(this.rowToMessage);
  }
  // ── Quota ─────────────────────────────────────────────────
  async getStorageSize() {
    const db = this.ensureDb();
    const pageSize = db.pragma("page_size", { simple: true }) ?? 4096;
    const pageCount = db.pragma("page_count", { simple: true }) ?? 0;
    const total = pageSize * pageCount;
    const msgCount = db.prepare("SELECT COUNT(*) as cnt FROM messages").get()?.cnt ?? 0;
    const convCount = db.prepare("SELECT COUNT(*) as cnt FROM conversations").get()?.cnt ?? 0;
    const totalRecords = msgCount + convCount;
    const msgRatio = totalRecords > 0 ? msgCount / totalRecords : 0.8;
    return {
      messages: Math.floor(total * msgRatio),
      conversations: Math.floor(total * (1 - msgRatio)),
      total
    };
  }
  async clearOldMessages(conversationId, keepCount) {
    const db = this.ensureDb();
    const keepIds = db.prepare(
      "SELECT id FROM messages WHERE conversationId = ? ORDER BY createdAt DESC LIMIT ?"
    ).all(conversationId, keepCount).map((r) => r.id);
    if (keepIds.length === 0) return 0;
    const placeholders = keepIds.map(() => "?").join(",");
    const result = db.prepare(
      `DELETE FROM messages WHERE conversationId = ? AND id NOT IN (${placeholders})`
    ).run(conversationId, ...keepIds);
    db.prepare(
      `DELETE FROM messages_fts WHERE conversationId = ? AND id NOT IN (${placeholders})`
    ).run(conversationId, ...keepIds);
    return result.changes;
  }
  // ── Lifecycle ───────────────────────────────────────────────
  async clear() {
    const db = this.ensureDb();
    db.exec("DELETE FROM messages; DELETE FROM messages_fts; DELETE FROM conversations; DELETE FROM contacts; DELETE FROM cursors; DELETE FROM outbox;");
  }
  rowToOutbox(row) {
    return {
      id: row.id,
      type: row.type,
      method: row.method,
      path: row.path,
      body: row.body ? JSON.parse(row.body) : void 0,
      query: row.query ? JSON.parse(row.query) : void 0,
      status: row.status,
      createdAt: row.createdAt,
      retries: row.retries ?? 0,
      maxRetries: row.maxRetries ?? 5,
      lastError: row.lastError ?? void 0,
      idempotencyKey: row.idempotencyKey ?? "",
      localData: row.localData ? JSON.parse(row.localData) : void 0
    };
  }
};

// src/multitab.ts
var TabCoordinator = class {
  constructor(offline, channelName = "prismer-tab-sync") {
    this.offline = offline;
    this.channelName = channelName;
    this.channel = null;
    this._isLeader = false;
    this.disposed = false;
    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  get isLeader() {
    return this._isLeader;
  }
  /**
   * Initialize tab coordination.
   * Claims leadership immediately (last-login-wins).
   */
  init() {
    if (typeof BroadcastChannel === "undefined") {
      this._isLeader = true;
      return;
    }
    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = (e) => this.handleMessage(e.data);
    this.claimLeadership();
  }
  /**
   * Release leadership and clean up.
   */
  destroy() {
    this.disposed = true;
    if (this.channel) {
      if (this._isLeader) {
        this.broadcast({ type: "tab.release", tabId: this.tabId });
      }
      this.channel.close();
      this.channel = null;
    }
    this._isLeader = false;
  }
  /**
   * Relay a sync event to passive tabs.
   * Called by the leader tab after processing a sync event.
   */
  relaySyncEvent(event) {
    if (this._isLeader && this.channel) {
      this.broadcast({ type: "sync.event", tabId: this.tabId, payload: event });
    }
  }
  // ── Private ──────────────────────────────────────────────────
  claimLeadership() {
    this._isLeader = true;
    this.broadcast({ type: "tab.claim", tabId: this.tabId });
    this.onBecomeLeader();
  }
  demoteToPassive() {
    if (!this._isLeader) return;
    this._isLeader = false;
    this.onBecomePassive();
  }
  handleMessage(msg) {
    if (this.disposed) return;
    switch (msg.type) {
      case "tab.claim": {
        if (msg.tabId !== this.tabId) {
          this.demoteToPassive();
          this.broadcast({ type: "tab.ack", tabId: this.tabId });
        }
        break;
      }
      case "tab.release": {
        if (!this._isLeader) {
          this.claimLeadership();
        }
        break;
      }
      case "sync.event": {
        if (!this._isLeader && msg.payload) {
          this.offline["applySyncEvent"](msg.payload).catch(() => {
          });
        }
        break;
      }
    }
  }
  onBecomeLeader() {
  }
  onBecomePassive() {
    this.offline.stopContinuousSync();
  }
  broadcast(msg) {
    try {
      this.channel?.postMessage(msg);
    } catch {
    }
  }
};

// src/encryption.ts
function getSubtleCrypto() {
  if (typeof globalThis.crypto?.subtle !== "undefined") {
    return globalThis.crypto.subtle;
  }
  try {
    const { webcrypto } = require("crypto");
    return webcrypto.subtle;
  } catch {
    throw new Error("No SubtleCrypto available. Requires browser or Node.js 16+.");
  }
}
function getRandomValues(arr) {
  if (typeof globalThis.crypto?.getRandomValues !== "undefined") {
    return globalThis.crypto.getRandomValues(arr);
  }
  try {
    const { webcrypto } = require("crypto");
    return webcrypto.getRandomValues(arr);
  } catch {
    throw new Error("No crypto.getRandomValues available.");
  }
}
var subtle = () => getSubtleCrypto();
var PBKDF2_ITERATIONS = 1e5;
var SALT_LENGTH = 16;
var IV_LENGTH = 12;
var KEY_LENGTH = 256;
var E2EEncryption = class {
  constructor() {
    this.masterKey = null;
    this.keyPair = null;
    this.sessionKeys = /* @__PURE__ */ new Map();
    // conversationId → AES key
    this.salt = null;
  }
  /**
   * Initialize encryption with user passphrase.
   * Derives a master key via PBKDF2 and generates an ECDH key pair.
   */
  async init(passphrase) {
    this.salt = getRandomValues(new Uint8Array(SALT_LENGTH));
    const passphraseKey = await subtle().importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    this.masterKey = await subtle().deriveKey(
      {
        name: "PBKDF2",
        salt: this.salt,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256"
      },
      passphraseKey,
      { name: "AES-GCM", length: KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );
    this.keyPair = await subtle().generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
  }
  /**
   * Export public key for sharing with conversation peers.
   */
  async exportPublicKey() {
    if (!this.keyPair) throw new Error("E2E not initialized. Call init() first.");
    return subtle().exportKey("jwk", this.keyPair.publicKey);
  }
  /**
   * Derive a shared session key for a conversation using ECDH.
   * Call this with each peer's public key.
   */
  async deriveSessionKey(conversationId, peerPublicKey) {
    if (!this.keyPair) throw new Error("E2E not initialized. Call init() first.");
    const importedPeerKey = await subtle().importKey(
      "jwk",
      peerPublicKey,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );
    const sessionKey = await subtle().deriveKey(
      { name: "ECDH", public: importedPeerKey },
      this.keyPair.privateKey,
      { name: "AES-GCM", length: KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );
    this.sessionKeys.set(conversationId, sessionKey);
  }
  /**
   * Set a pre-shared session key for a conversation.
   * Useful when the key is exchanged out-of-band or derived from a group key.
   */
  async setSessionKey(conversationId, rawKey) {
    const key = await subtle().importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );
    this.sessionKeys.set(conversationId, key);
  }
  /**
   * Generate a random session key for a conversation.
   * Returns the raw key bytes for sharing with peers.
   */
  async generateSessionKey(conversationId) {
    const key = await subtle().generateKey(
      { name: "AES-GCM", length: KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
    this.sessionKeys.set(conversationId, key);
    return subtle().exportKey("raw", key);
  }
  /**
   * Encrypt plaintext for a conversation.
   * Returns base64-encoded ciphertext with prepended IV.
   */
  async encrypt(conversationId, plaintext) {
    const key = this.sessionKeys.get(conversationId);
    if (!key) throw new Error(`No session key for conversation ${conversationId}. Call deriveSessionKey() first.`);
    const iv = getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await subtle().encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return arrayBufferToBase64(combined.buffer);
  }
  /**
   * Decrypt ciphertext from a conversation.
   * Expects base64-encoded data with prepended IV.
   */
  async decrypt(conversationId, ciphertext) {
    const key = this.sessionKeys.get(conversationId);
    if (!key) throw new Error(`No session key for conversation ${conversationId}. Call deriveSessionKey() first.`);
    const combined = base64ToArrayBuffer(ciphertext);
    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);
    const decrypted = await subtle().decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  }
  /**
   * Check if a session key exists for a conversation.
   */
  hasSessionKey(conversationId) {
    return this.sessionKeys.has(conversationId);
  }
  /**
   * Remove session key for a conversation.
   */
  removeSessionKey(conversationId) {
    this.sessionKeys.delete(conversationId);
  }
  /**
   * Clear all keys and reset state.
   */
  destroy() {
    this.masterKey = null;
    this.keyPair = null;
    this.sessionKeys.clear();
    this.salt = null;
  }
};
function arrayBufferToBase64(buffer) {
  if (typeof btoa !== "undefined") {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return Buffer.from(buffer).toString("base64");
}
function base64ToArrayBuffer(base64) {
  if (typeof atob !== "undefined") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  const buf = Buffer.from(base64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

// src/index.ts
var AccountClient = class {
  constructor(_r) {
    this._r = _r;
  }
  /** Register an agent or human identity */
  async register(options) {
    return this._r("POST", "/api/im/register", options);
  }
  /** Get own identity, stats, bindings, credits */
  async me() {
    return this._r("GET", "/api/im/me");
  }
  /** Refresh JWT token */
  async refreshToken() {
    return this._r("POST", "/api/im/token/refresh");
  }
};
var DirectClient = class {
  constructor(_r) {
    this._r = _r;
  }
  /** Send a direct message to a user */
  async send(userId, content, options) {
    return this._r("POST", `/api/im/direct/${userId}/messages`, {
      content,
      type: options?.type ?? "text",
      metadata: options?.metadata,
      parentId: options?.parentId
    });
  }
  /** Get direct message history with a user */
  async getMessages(userId, options) {
    const query = {};
    if (options?.limit != null) query.limit = String(options.limit);
    if (options?.offset != null) query.offset = String(options.offset);
    return this._r("GET", `/api/im/direct/${userId}/messages`, void 0, query);
  }
};
var GroupsClient = class {
  constructor(_r) {
    this._r = _r;
  }
  /** Create a group chat */
  async create(options) {
    return this._r("POST", "/api/im/groups", options);
  }
  /** List groups you belong to */
  async list() {
    return this._r("GET", "/api/im/groups");
  }
  /** Get group details */
  async get(groupId) {
    return this._r("GET", `/api/im/groups/${groupId}`);
  }
  /** Send a message to a group */
  async send(groupId, content, options) {
    return this._r("POST", `/api/im/groups/${groupId}/messages`, {
      content,
      type: options?.type ?? "text",
      metadata: options?.metadata,
      parentId: options?.parentId
    });
  }
  /** Get group message history */
  async getMessages(groupId, options) {
    const query = {};
    if (options?.limit != null) query.limit = String(options.limit);
    if (options?.offset != null) query.offset = String(options.offset);
    return this._r("GET", `/api/im/groups/${groupId}/messages`, void 0, query);
  }
  /** Add a member to a group (owner/admin only) */
  async addMember(groupId, userId) {
    return this._r("POST", `/api/im/groups/${groupId}/members`, { userId });
  }
  /** Remove a member from a group (owner/admin only) */
  async removeMember(groupId, userId) {
    return this._r("DELETE", `/api/im/groups/${groupId}/members/${userId}`);
  }
};
var ConversationsClient = class {
  constructor(_r) {
    this._r = _r;
  }
  /** List conversations */
  async list(options) {
    const query = {};
    if (options?.withUnread) query.withUnread = "true";
    if (options?.unreadOnly) query.unreadOnly = "true";
    return this._r("GET", "/api/im/conversations", void 0, query);
  }
  /** Get conversation details */
  async get(conversationId) {
    return this._r("GET", `/api/im/conversations/${conversationId}`);
  }
  /** Create a direct conversation */
  async createDirect(userId) {
    return this._r("POST", "/api/im/conversations/direct", { userId });
  }
  /** Mark a conversation as read */
  async markAsRead(conversationId) {
    return this._r("POST", `/api/im/conversations/${conversationId}/read`);
  }
};
var MessagesClient = class {
  constructor(_r) {
    this._r = _r;
  }
  /** Send a message to a conversation */
  async send(conversationId, content, options) {
    return this._r("POST", `/api/im/messages/${conversationId}`, {
      content,
      type: options?.type ?? "text",
      metadata: options?.metadata,
      parentId: options?.parentId
    });
  }
  /** Get message history for a conversation */
  async getHistory(conversationId, options) {
    const query = {};
    if (options?.limit != null) query.limit = String(options.limit);
    if (options?.offset != null) query.offset = String(options.offset);
    return this._r("GET", `/api/im/messages/${conversationId}`, void 0, query);
  }
  /** Edit a message */
  async edit(conversationId, messageId, content) {
    return this._r("PATCH", `/api/im/messages/${conversationId}/${messageId}`, { content });
  }
  /** Delete a message */
  async delete(conversationId, messageId) {
    return this._r("DELETE", `/api/im/messages/${conversationId}/${messageId}`);
  }
};
var ContactsClient = class {
  constructor(_r) {
    this._r = _r;
  }
  /** List contacts (users you've communicated with) */
  async list() {
    return this._r("GET", "/api/im/contacts");
  }
  /** Discover agents by capability or type */
  async discover(options) {
    const query = {};
    if (options?.type) query.type = options.type;
    if (options?.capability) query.capability = options.capability;
    return this._r("GET", "/api/im/discover", void 0, query);
  }
};
var BindingsClient = class {
  constructor(_r) {
    this._r = _r;
  }
  /** Create a social binding */
  async create(options) {
    return this._r("POST", "/api/im/bindings", options);
  }
  /** Verify a binding with 6-digit code */
  async verify(bindingId, code) {
    return this._r("POST", `/api/im/bindings/${bindingId}/verify`, { code });
  }
  /** List bindings */
  async list() {
    return this._r("GET", "/api/im/bindings");
  }
  /** Delete a binding */
  async delete(bindingId) {
    return this._r("DELETE", `/api/im/bindings/${bindingId}`);
  }
};
var CreditsClient = class {
  constructor(_r) {
    this._r = _r;
  }
  /** Get credits balance */
  async get() {
    return this._r("GET", "/api/im/credits");
  }
  /** Get credit transaction history */
  async transactions(options) {
    const query = {};
    if (options?.limit != null) query.limit = String(options.limit);
    if (options?.offset != null) query.offset = String(options.offset);
    return this._r("GET", "/api/im/credits/transactions", void 0, query);
  }
};
var WorkspaceClient = class {
  constructor(_r) {
    this._r = _r;
  }
  /** Initialize a 1:1 workspace (1 user + 1 agent) */
  async init(options) {
    return this._r("POST", "/api/im/workspace/init", options);
  }
  /** Initialize a group workspace (multi-user + multi-agent) */
  async initGroup(options) {
    return this._r("POST", "/api/im/workspace/init-group", options);
  }
  /** Add an agent to a workspace */
  async addAgent(workspaceId, agentId) {
    return this._r("POST", `/api/im/workspace/${workspaceId}/agents`, { agentId });
  }
  /** List agents in a workspace */
  async listAgents(workspaceId) {
    return this._r("GET", `/api/im/workspace/${workspaceId}/agents`);
  }
  /** @mention autocomplete */
  async mentionAutocomplete(conversationId, query) {
    const q = { conversationId };
    if (query) q.q = query;
    return this._r("GET", "/api/im/workspace/mentions/autocomplete", void 0, q);
  }
};
function guessMimeType(fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    bmp: "image/bmp",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    xml: "application/xml",
    md: "text/markdown",
    yaml: "text/yaml",
    yml: "text/yaml",
    zip: "application/zip",
    gz: "application/gzip",
    tar: "application/x-tar",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm"
  };
  return map[ext] || "application/octet-stream";
}
var FilesClient = class {
  constructor(_r, _baseUrl, _fetchFn, _getAuthHeaders) {
    this._r = _r;
    this._baseUrl = _baseUrl;
    this._fetchFn = _fetchFn;
    this._getAuthHeaders = _getAuthHeaders;
  }
  /** Get a presigned upload URL */
  async presign(options) {
    return this._r("POST", "/api/im/files/presign", options);
  }
  /** Confirm an uploaded file (triggers validation + CDN activation) */
  async confirm(uploadId) {
    return this._r("POST", "/api/im/files/confirm", { uploadId });
  }
  /** Get storage quota */
  async quota() {
    return this._r("GET", "/api/im/files/quota");
  }
  /** Delete a file */
  async delete(uploadId) {
    return this._r("DELETE", `/api/im/files/${uploadId}`);
  }
  /** List allowed MIME types */
  async types() {
    return this._r("GET", "/api/im/files/types");
  }
  /** Initialize a multipart upload (for files > 10 MB) */
  async initMultipart(opts) {
    return this._r("POST", "/api/im/files/upload/init", opts);
  }
  /** Complete a multipart upload */
  async completeMultipart(uploadId, parts) {
    return this._r("POST", "/api/im/files/upload/complete", { uploadId, parts });
  }
  // --------------------------------------------------------------------------
  // High-level convenience methods
  // --------------------------------------------------------------------------
  /**
   * Upload a file (full lifecycle: presign → upload → confirm).
   *
   * @param input - File, Blob, Buffer, Uint8Array, or file path (Node.js string)
   * @param opts  - Optional fileName, mimeType, onProgress
   * @returns Confirmed upload result with CDN URL
   */
  async upload(input, opts) {
    let bytes;
    let fileName;
    if (typeof input === "string") {
      const fs = await import("fs");
      const path = await import("path");
      const buf = await fs.promises.readFile(input);
      bytes = new Uint8Array(buf);
      fileName = opts?.fileName || path.basename(input);
    } else if (typeof Blob !== "undefined" && input instanceof Blob) {
      const ab = await input.arrayBuffer();
      bytes = new Uint8Array(ab);
      fileName = opts?.fileName || (input instanceof File ? input.name : "");
      if (!fileName) throw new Error("fileName is required when uploading Blob without name");
    } else if (input instanceof Uint8Array) {
      bytes = input;
      fileName = opts?.fileName || "";
      if (!fileName) throw new Error("fileName is required when uploading Buffer or Uint8Array");
    } else {
      throw new Error("Unsupported input type");
    }
    const fileSize = bytes.byteLength;
    const mimeType = opts?.mimeType || guessMimeType(fileName);
    if (fileSize > 50 * 1024 * 1024) {
      throw new Error("File exceeds maximum size of 50 MB");
    }
    if (fileSize <= 10 * 1024 * 1024) {
      return this._uploadSimple(bytes, fileName, fileSize, mimeType, opts?.onProgress);
    }
    return this._uploadMultipart(bytes, fileName, fileSize, mimeType, opts?.onProgress);
  }
  /**
   * Upload a file and send it as a message in one call.
   *
   * @param conversationId - Target conversation
   * @param input          - File input (same as upload())
   * @param opts           - Upload options + optional message content/parentId
   */
  async sendFile(conversationId, input, opts) {
    const uploaded = await this.upload(input, opts);
    const msgRes = await this._r("POST", `/api/im/messages/${conversationId}`, {
      content: opts?.content || uploaded.fileName,
      type: "file",
      metadata: {
        uploadId: uploaded.uploadId,
        fileUrl: uploaded.cdnUrl,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType
      },
      parentId: opts?.parentId
    });
    if (!msgRes.ok) {
      throw new Error(msgRes.error?.message || "Failed to send file message");
    }
    return { upload: uploaded, message: msgRes.data };
  }
  // --------------------------------------------------------------------------
  // Private upload helpers
  // --------------------------------------------------------------------------
  async _uploadSimple(bytes, fileName, fileSize, mimeType, onProgress) {
    const presignRes = await this.presign({ fileName, fileSize, mimeType });
    if (!presignRes.ok || !presignRes.data) {
      throw new Error(presignRes.error?.message || "Presign failed");
    }
    const { uploadId, url, fields } = presignRes.data;
    const formData = new FormData();
    const isS3 = url.startsWith("http");
    const uploadUrl = isS3 ? url : `${this._baseUrl}${url}`;
    if (isS3) {
      for (const [k, v] of Object.entries(fields)) formData.append(k, v);
    }
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    formData.append("file", new Blob([ab], { type: mimeType }), fileName);
    const headers = {};
    if (!isS3) Object.assign(headers, this._getAuthHeaders());
    const resp = await this._fetchFn(uploadUrl, { method: "POST", body: formData, headers });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Upload failed (${resp.status}): ${text}`);
    }
    onProgress?.(fileSize, fileSize);
    const confirmRes = await this.confirm(uploadId);
    if (!confirmRes.ok || !confirmRes.data) {
      throw new Error(confirmRes.error?.message || "Confirm failed");
    }
    return confirmRes.data;
  }
  async _uploadMultipart(bytes, fileName, fileSize, mimeType, onProgress) {
    const initRes = await this.initMultipart({ fileName, fileSize, mimeType });
    if (!initRes.ok || !initRes.data) {
      throw new Error(initRes.error?.message || "Multipart init failed");
    }
    const { uploadId, parts: partUrls } = initRes.data;
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const completedParts = [];
    let uploaded = 0;
    for (const part of partUrls) {
      const start = (part.partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileSize);
      const chunk = bytes.slice(start, end);
      const isS3 = part.url.startsWith("http");
      const partUrl = isS3 ? part.url : `${this._baseUrl}${part.url}`;
      const headers = { "Content-Type": mimeType };
      if (!isS3) Object.assign(headers, this._getAuthHeaders());
      const resp = await this._fetchFn(partUrl, { method: "PUT", body: chunk, headers });
      if (!resp.ok) {
        throw new Error(`Part ${part.partNumber} upload failed (${resp.status})`);
      }
      const etag = resp.headers.get("ETag") || `"part-${part.partNumber}"`;
      completedParts.push({ partNumber: part.partNumber, etag });
      uploaded += chunk.byteLength;
      onProgress?.(uploaded, fileSize);
    }
    const completeRes = await this.completeMultipart(uploadId, completedParts);
    if (!completeRes.ok || !completeRes.data) {
      throw new Error(completeRes.error?.message || "Multipart complete failed");
    }
    return completeRes.data;
  }
};
var IMRealtimeClient = class {
  constructor(_wsBase) {
    this._wsBase = _wsBase;
  }
  /** Get the WebSocket URL */
  wsUrl(token) {
    const base = this._wsBase.replace(/^http/, "ws");
    return token ? `${base}/ws?token=${token}` : `${base}/ws`;
  }
  /** Get the SSE URL */
  sseUrl(token) {
    return token ? `${this._wsBase}/sse?token=${token}` : `${this._wsBase}/sse`;
  }
  /** Create a WebSocket client. Call .connect() to establish connection. */
  connectWS(config) {
    return new RealtimeWSClient(this._wsBase, config);
  }
  /** Create an SSE client. Call .connect() to establish connection. */
  connectSSE(config) {
    return new RealtimeSSEClient(this._wsBase, config);
  }
};
var IMClient = class {
  constructor(request, wsBase, fetchFn, getAuthHeaders, offlineManager) {
    this.account = new AccountClient(request);
    this.direct = new DirectClient(request);
    this.groups = new GroupsClient(request);
    this.conversations = new ConversationsClient(request);
    this.messages = new MessagesClient(request);
    this.contacts = new ContactsClient(request);
    this.bindings = new BindingsClient(request);
    this.credits = new CreditsClient(request);
    this.workspace = new WorkspaceClient(request);
    this.files = new FilesClient(request, wsBase, fetchFn, getAuthHeaders);
    this.realtime = new IMRealtimeClient(wsBase);
    this.offline = offlineManager ?? null;
  }
  /** IM health check */
  async health() {
    return this.account["_r"]("GET", "/api/im/health");
  }
};
var PrismerClient = class {
  constructor(config = {}) {
    this._offlineManager = null;
    if (config.apiKey && !config.apiKey.startsWith("sk-prismer-") && !config.apiKey.startsWith("eyJ")) {
      console.warn('Warning: API key should start with "sk-prismer-" (or "eyJ" for IM JWT)');
    }
    this.apiKey = config.apiKey || "";
    const envUrl = ENVIRONMENTS[config.environment || "production"];
    this.baseUrl = (config.baseUrl || envUrl).replace(/\/$/, "");
    this.timeout = config.timeout || 3e4;
    this.fetchFn = config.fetch || fetch;
    this.imAgent = config.imAgent;
    if (config.offline) {
      this._offlineManager = new OfflineManager(
        config.offline.storage,
        (m, p, b, q) => this._request(m, p, b, q),
        config.offline
      );
      this._offlineManager.init().catch(
        (err) => console.warn("[PrismerSDK] Offline storage init failed:", err)
      );
    }
    const imRequest = this._offlineManager ? (m, p, b, q) => this._offlineManager.dispatch(m, p, b, q) : (m, p, b, q) => this._request(m, p, b, q);
    this.im = new IMClient(
      imRequest,
      this.baseUrl,
      this.fetchFn,
      () => this._getAuthHeaders(),
      this._offlineManager
    );
  }
  /** Build auth headers for raw HTTP requests (used by file upload) */
  _getAuthHeaders() {
    const headers = {};
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
    if (this.imAgent) headers["X-IM-Agent"] = this.imAgent;
    return headers;
  }
  /**
   * Set or update the auth token (API key or IM JWT).
   * Useful after anonymous registration to set the returned JWT.
   */
  setToken(token) {
    this.apiKey = token;
  }
  /** Cleanup resources (offline manager, timers). Call when disposing the client. */
  async destroy() {
    if (this._offlineManager) {
      await this._offlineManager.destroy();
    }
  }
  // --------------------------------------------------------------------------
  // Internal request helper
  // --------------------------------------------------------------------------
  async _request(method, path, body, query, _isRetry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      let url = `${this.baseUrl}${path}`;
      if (query && Object.keys(query).length > 0) {
        url += "?" + new URLSearchParams(query).toString();
      }
      const headers = {};
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      if (this.imAgent) {
        headers["X-IM-Agent"] = this.imAgent;
      }
      const init = { method, headers, signal: controller.signal };
      if (body !== void 0) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }
      const response = await this.fetchFn(url, init);
      const data = await response.json();
      if (response.status === 401 && this.apiKey.startsWith("eyJ") && !_isRetry && !path.includes("/token/refresh")) {
        try {
          const refreshRes = await this._request("POST", "/api/im/token/refresh", void 0, void 0, true);
          if (refreshRes?.ok && refreshRes?.data?.token) {
            this.apiKey = refreshRes.data.token;
            return this._request(method, path, body, query, true);
          }
        } catch {
        }
      }
      if (!response.ok) {
        const err = data.error || { code: "HTTP_ERROR", message: `Request failed with status ${response.status}` };
        return { ...data, success: false, ok: false, error: err };
      }
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { success: false, ok: false, error: { code: "TIMEOUT", message: "Request timed out" } };
      }
      return {
        success: false,
        ok: false,
        error: { code: "NETWORK_ERROR", message: error instanceof Error ? error.message : "Unknown error" }
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
  // --------------------------------------------------------------------------
  // Context API
  // --------------------------------------------------------------------------
  /** Load content from URL(s) or search query */
  async load(input, options = {}) {
    return this._request("POST", "/api/context/load", {
      input,
      inputType: options.inputType,
      processUncached: options.processUncached,
      search: options.search,
      processing: options.processing,
      return: options.return,
      ranking: options.ranking
    });
  }
  /** Save content to Prismer cache */
  async save(options) {
    return this._request("POST", "/api/context/save", options);
  }
  /** Batch save multiple items (max 50) */
  async saveBatch(items) {
    return this.save({ items });
  }
  // --------------------------------------------------------------------------
  // Parse API
  // --------------------------------------------------------------------------
  /** Parse a document (PDF, image) into structured content */
  async parse(options) {
    return this._request("POST", "/api/parse", options);
  }
  /** Convenience: parse a PDF by URL */
  async parsePdf(url, mode = "fast") {
    return this.parse({ url, mode });
  }
  /** Check status of an async parse task */
  async parseStatus(taskId) {
    return this._request("GET", `/api/parse/status/${taskId}`);
  }
  /** Get result of a completed async parse task */
  async parseResult(taskId) {
    return this._request("GET", `/api/parse/result/${taskId}`);
  }
  // --------------------------------------------------------------------------
  // Convenience
  // --------------------------------------------------------------------------
  /** Search for content (convenience wrapper around load with query mode) */
  async search(query, options) {
    return this.load(query, {
      inputType: "query",
      search: options?.topK ? { topK: options.topK } : void 0,
      return: options?.returnTopK || options?.format ? { topK: options?.returnTopK, format: options?.format } : void 0,
      ranking: options?.ranking ? { preset: options.ranking } : void 0
    });
  }
};
var index_default = PrismerClient;
function createClient(config) {
  return new PrismerClient(config);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AccountClient,
  AttachmentQueue,
  BindingsClient,
  ContactsClient,
  ConversationsClient,
  CreditsClient,
  DirectClient,
  E2EEncryption,
  ENVIRONMENTS,
  FilesClient,
  GroupsClient,
  IMClient,
  IMRealtimeClient,
  IndexedDBStorage,
  MemoryStorage,
  MessagesClient,
  OfflineManager,
  PrismerClient,
  RealtimeSSEClient,
  RealtimeWSClient,
  SQLiteStorage,
  TabCoordinator,
  WorkspaceClient,
  createClient
});
