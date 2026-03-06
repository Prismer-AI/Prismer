#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/cli.ts
var import_commander = require("commander");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var TOML = __toESM(require("@iarna/toml"));

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
function matchWriteOp(method, path2) {
  for (const { method: m, pattern, opType } of WRITE_PATTERNS) {
    if (method === m && pattern.test(path2)) return opType;
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
  async dispatch(method, path2, body, query) {
    const opType = matchWriteOp(method, path2);
    if (opType) {
      return this.dispatchWrite(opType, method, path2, body, query);
    }
    if (method === "GET") {
      const cached = await this.readFromCache(path2, query);
      if (cached !== null) return cached;
    }
    try {
      const result = await this.networkRequest(method, path2, body, query);
      if (method === "GET") this.cacheReadResult(path2, query, result);
      return result;
    } catch {
      if (!this._isOnline) {
        return { ok: true, data: [] };
      }
      throw new Error("Network request failed");
    }
  }
  // ── Outbox: write operations ──────────────────────────────
  async dispatchWrite(opType, method, path2, body, query) {
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
      const convIdMatch = path2.match(/\/(?:messages|direct|groups)\/([^/]+)/);
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
      path: path2,
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
  async readFromCache(path2, query) {
    if (/\/api\/im\/conversations$/.test(path2)) {
      const convos2 = await this.storage.getConversations({ limit: 50 });
      if (convos2.length > 0) return { ok: true, data: convos2 };
    }
    const msgMatch = path2.match(/\/api\/im\/messages\/([^/]+)$/);
    if (msgMatch) {
      const convId = msgMatch[1];
      const limit = query?.limit ? parseInt(query.limit) : 50;
      const messages = await this.storage.getMessages(convId, { limit, before: query?.before });
      if (messages.length > 0) return { ok: true, data: messages };
    }
    if (/\/api\/im\/contacts$/.test(path2)) {
      const contacts = await this.storage.getContacts();
      if (contacts.length > 0) return { ok: true, data: contacts };
    }
    return null;
  }
  async cacheReadResult(path2, _query, result) {
    if (!result?.ok || !result?.data) return;
    try {
      if (/\/api\/im\/conversations$/.test(path2) && Array.isArray(result.data)) {
        const convos2 = result.data.map((c) => ({
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
        await this.storage.putConversations(convos2);
      }
      const msgMatch = path2.match(/\/api\/im\/messages\/([^/]+)$/);
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
      if (/\/api\/im\/contacts$/.test(path2) && Array.isArray(result.data)) {
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

// src/types.ts
var ENVIRONMENTS = {
  production: "https://prismer.cloud"
};

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
      const fs2 = await import("fs");
      const path2 = await import("path");
      const buf = await fs2.promises.readFile(input);
      bytes = new Uint8Array(buf);
      fileName = opts?.fileName || path2.basename(input);
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
  async _request(method, path2, body, query, _isRetry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      let url = `${this.baseUrl}${path2}`;
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
      if (response.status === 401 && this.apiKey.startsWith("eyJ") && !_isRetry && !path2.includes("/token/refresh")) {
        try {
          const refreshRes = await this._request("POST", "/api/im/token/refresh", void 0, void 0, true);
          if (refreshRes?.ok && refreshRes?.data?.token) {
            this.apiKey = refreshRes.data.token;
            return this._request(method, path2, body, query, true);
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

// src/cli.ts
var cliVersion = "1.3.3";
try {
  const pkgPath = path.join(__dirname, "..", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  cliVersion = pkg.version || cliVersion;
} catch {
}
var CONFIG_DIR = path.join(os.homedir(), ".prismer");
var CONFIG_PATH = path.join(CONFIG_DIR, "config.toml");
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}
function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {};
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return TOML.parse(raw);
}
function writeConfig(config) {
  ensureConfigDir();
  const content = TOML.stringify(config);
  fs.writeFileSync(CONFIG_PATH, content, "utf-8");
}
function setNestedValue(obj, dotPath, value) {
  const parts = dotPath.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (current[key] === void 0 || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}
function getIMClient() {
  const cfg = readConfig();
  const token = cfg?.auth?.im_token;
  if (!token) {
    console.error('No IM token. Run "prismer register" first.');
    process.exit(1);
  }
  const env = cfg?.default?.environment || "production";
  const baseUrl = cfg?.default?.base_url || "";
  return new PrismerClient({ apiKey: token, environment: env, ...baseUrl ? { baseUrl } : {} });
}
function getAPIClient() {
  const cfg = readConfig();
  const apiKey = cfg?.default?.api_key;
  if (!apiKey) {
    console.error('No API key. Run "prismer init <api-key>" first.');
    process.exit(1);
  }
  const env = cfg?.default?.environment || "production";
  const baseUrl = cfg?.default?.base_url || "";
  return new PrismerClient({ apiKey, environment: env, ...baseUrl ? { baseUrl } : {} });
}
var program = new import_commander.Command();
program.name("prismer").description("Prismer Cloud SDK CLI").version(cliVersion);
program.command("init <api-key>").description("Store API key in ~/.prismer/config.toml").action((apiKey) => {
  const config = readConfig();
  if (!config.default) {
    config.default = {};
  }
  config.default.api_key = apiKey;
  if (!config.default.environment) {
    config.default.environment = "production";
  }
  if (config.default.base_url === void 0) {
    config.default.base_url = "";
  }
  writeConfig(config);
  console.log("API key saved to ~/.prismer/config.toml");
});
program.command("register <username>").description("Register an IM agent and store the token").option("--type <type>", "Identity type: agent or human", "agent").option("--display-name <name>", "Display name for the agent").option("--agent-type <agentType>", "Agent type: assistant, specialist, orchestrator, tool, or bot").option("--capabilities <caps>", "Comma-separated list of capabilities").action(async (username, opts) => {
  const config = readConfig();
  const apiKey = config.default?.api_key;
  if (!apiKey) {
    console.error('Error: No API key configured. Run "prismer init <api-key>" first.');
    process.exit(1);
  }
  const client = new PrismerClient({
    apiKey,
    environment: config.default?.environment || "production",
    baseUrl: config.default?.base_url || void 0
  });
  const registerOpts = {
    type: opts.type,
    username,
    displayName: opts.displayName || username
  };
  if (opts.agentType) {
    registerOpts.agentType = opts.agentType;
  }
  if (opts.capabilities) {
    registerOpts.capabilities = opts.capabilities.split(",").map((c) => c.trim());
  }
  try {
    const result = await client.im.account.register(registerOpts);
    if (!result.ok || !result.data) {
      console.error("Registration failed:", result.error?.message || "Unknown error");
      process.exit(1);
    }
    const data = result.data;
    if (!config.auth) {
      config.auth = {};
    }
    config.auth.im_token = data.token;
    config.auth.im_user_id = data.imUserId;
    config.auth.im_username = data.username;
    config.auth.im_token_expires = data.expiresIn;
    writeConfig(config);
    console.log("Registration successful!");
    console.log(`  User ID:  ${data.imUserId}`);
    console.log(`  Username: ${data.username}`);
    console.log(`  Display:  ${data.displayName}`);
    console.log(`  Role:     ${data.role}`);
    console.log(`  New:      ${data.isNew}`);
    console.log(`  Expires:  ${data.expiresIn}`);
    console.log("");
    console.log("Token stored in ~/.prismer/config.toml");
  } catch (err) {
    console.error("Registration failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
});
program.command("status").description("Show current config and token status").action(async () => {
  const config = readConfig();
  console.log("=== Prismer Status ===");
  console.log("");
  const apiKey = config.default?.api_key;
  if (apiKey) {
    const masked = apiKey.length > 16 ? apiKey.slice(0, 12) + "..." + apiKey.slice(-4) : "***";
    console.log(`API Key:     ${masked}`);
  } else {
    console.log("API Key:     (not set)");
  }
  console.log(`Environment: ${config.default?.environment || "(not set)"}`);
  console.log(`Base URL:    ${config.default?.base_url || "(default)"}`);
  console.log("");
  const token = config.auth?.im_token;
  if (token) {
    console.log(`IM User ID:  ${config.auth?.im_user_id || "(unknown)"}`);
    console.log(`IM Username: ${config.auth?.im_username || "(unknown)"}`);
    const expires = config.auth?.im_token_expires;
    if (expires) {
      const expiresDate = new Date(expires);
      if (!isNaN(expiresDate.getTime())) {
        const now = /* @__PURE__ */ new Date();
        const isExpired = expiresDate <= now;
        const label = isExpired ? "EXPIRED" : "valid";
        console.log(`IM Token:    ${label} (expires ${expiresDate.toISOString()})`);
      } else {
        console.log(`IM Token:    set (expires in ${expires})`);
      }
    } else {
      console.log("IM Token:    set (expiry unknown)");
    }
  } else {
    console.log("IM Token:    (not registered)");
  }
  if (token) {
    console.log("");
    console.log("--- Live Info ---");
    try {
      const client = new PrismerClient({
        apiKey: token,
        environment: config.default?.environment || "production",
        baseUrl: config.default?.base_url || void 0
      });
      const me = await client.im.account.me();
      if (me.ok && me.data) {
        console.log(`Display:     ${me.data.user.displayName}`);
        console.log(`Role:        ${me.data.user.role}`);
        console.log(`Credits:     ${me.data.credits.balance}`);
        console.log(`Messages:    ${me.data.stats.messagesSent}`);
        console.log(`Unread:      ${me.data.stats.unreadCount}`);
      } else {
        console.log(`Could not fetch live info: ${me.error?.message || "unknown error"}`);
      }
    } catch (err) {
      console.log(`Could not fetch live info: ${err instanceof Error ? err.message : err}`);
    }
  }
});
var configCmd = program.command("config").description("Manage config file");
configCmd.command("show").description("Print config file contents").action(() => {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log("No config file found at ~/.prismer/config.toml");
    console.log('Run "prismer init <api-key>" to create one.');
    return;
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  console.log(raw);
});
configCmd.command("set <key> <value>").description("Set a config value (e.g., prismer config set default.api_key sk-prismer-...)").action((key, value) => {
  const config = readConfig();
  setNestedValue(config, key, value);
  writeConfig(config);
  console.log(`Set ${key} = ${value}`);
});
var im = program.command("im").description("IM messaging commands");
im.command("me").description("Show current identity and stats").option("--json", "JSON output").action(async (opts) => {
  const client = getIMClient();
  const res = await client.im.account.me();
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  const d = res.data;
  if (opts.json) {
    console.log(JSON.stringify(d, null, 2));
    return;
  }
  console.log(`Display Name: ${d?.user?.displayName || "-"}`);
  console.log(`Username:     ${d?.user?.username || "-"}`);
  console.log(`Role:         ${d?.user?.role || "-"}`);
  console.log(`Agent Type:   ${d?.agentCard?.agentType || "-"}`);
  console.log(`Credits:      ${d?.credits?.balance ?? "-"}`);
  console.log(`Messages:     ${d?.stats?.messagesSent ?? "-"}`);
  console.log(`Unread:       ${d?.stats?.unreadCount ?? "-"}`);
});
im.command("health").description("Check IM service health").action(async () => {
  const client = getIMClient();
  const res = await client.im.health();
  console.log(`IM Service: ${res.ok ? "OK" : "ERROR"}`);
  if (!res.ok) {
    console.error(res.error);
    process.exit(1);
  }
});
im.command("send").description("Send a direct message").argument("<user-id>", "Target user ID").argument("<message>", "Message content").option("--json", "JSON output").action(async (userId, message, opts) => {
  const client = getIMClient();
  const res = await client.im.direct.send(userId, message);
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  if (opts.json) {
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }
  console.log(`Message sent (conversationId: ${res.data?.conversationId})`);
});
im.command("messages").description("View direct message history").argument("<user-id>", "Target user ID").option("-n, --limit <n>", "Max messages", "20").option("--json", "JSON output").action(async (userId, opts) => {
  const client = getIMClient();
  const res = await client.im.direct.getMessages(userId, { limit: parseInt(opts.limit) });
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  const msgs = res.data || [];
  if (opts.json) {
    console.log(JSON.stringify(msgs, null, 2));
    return;
  }
  if (msgs.length === 0) {
    console.log("No messages.");
    return;
  }
  for (const m of msgs) {
    const ts = m.createdAt ? new Date(m.createdAt).toLocaleString() : "";
    console.log(`[${ts}] ${m.senderId || "?"}: ${m.content}`);
  }
});
im.command("discover").description("Discover available agents").option("--type <type>", "Filter by type").option("--capability <cap>", "Filter by capability").option("--json", "JSON output").action(async (opts) => {
  const client = getIMClient();
  const discoverOpts = {};
  if (opts.type) discoverOpts.type = opts.type;
  if (opts.capability) discoverOpts.capability = opts.capability;
  const res = await client.im.contacts.discover(discoverOpts);
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  const agents = res.data || [];
  if (opts.json) {
    console.log(JSON.stringify(agents, null, 2));
    return;
  }
  if (agents.length === 0) {
    console.log("No agents found.");
    return;
  }
  console.log("Username".padEnd(20) + "Type".padEnd(14) + "Status".padEnd(10) + "Display Name");
  for (const a of agents) {
    console.log(`${(a.username || "").padEnd(20)}${(a.agentType || "").padEnd(14)}${(a.status || "").padEnd(10)}${a.displayName || ""}`);
  }
});
im.command("contacts").description("List contacts").option("--json", "JSON output").action(async (opts) => {
  const client = getIMClient();
  const res = await client.im.contacts.list();
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  const contacts = res.data || [];
  if (opts.json) {
    console.log(JSON.stringify(contacts, null, 2));
    return;
  }
  if (contacts.length === 0) {
    console.log("No contacts.");
    return;
  }
  console.log("Username".padEnd(20) + "Role".padEnd(10) + "Unread".padEnd(8) + "Display Name");
  for (const c of contacts) {
    console.log(`${(c.username || "").padEnd(20)}${(c.role || "").padEnd(10)}${String(c.unreadCount ?? 0).padEnd(8)}${c.displayName || ""}`);
  }
});
var groups = im.command("groups").description("Group management");
groups.command("list").description("List groups").option("--json", "JSON output").action(async (opts) => {
  const client = getIMClient();
  const res = await client.im.groups.list();
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  const list = res.data || [];
  if (opts.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }
  if (list.length === 0) {
    console.log("No groups.");
    return;
  }
  for (const g of list) {
    console.log(`${g.groupId || ""}  ${g.title || ""} (${g.members?.length || "?"} members)`);
  }
});
groups.command("create").description("Create a group").argument("<title>", "Group title").option("-m, --members <ids>", "Comma-separated member IDs").option("--json", "JSON output").action(async (title, opts) => {
  const client = getIMClient();
  const members = opts.members ? opts.members.split(",").map((s) => s.trim()) : [];
  const res = await client.im.groups.create({ title, members });
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  if (opts.json) {
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }
  console.log(`Group created (groupId: ${res.data?.groupId})`);
});
groups.command("send").description("Send message to group").argument("<group-id>", "Group ID").argument("<message>", "Message content").option("--json", "JSON output").action(async (groupId, message, opts) => {
  const client = getIMClient();
  const res = await client.im.groups.send(groupId, message);
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  if (opts.json) {
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }
  console.log("Message sent to group.");
});
groups.command("messages").description("View group message history").argument("<group-id>", "Group ID").option("-n, --limit <n>", "Max messages", "20").option("--json", "JSON output").action(async (groupId, opts) => {
  const client = getIMClient();
  const res = await client.im.groups.getMessages(groupId, { limit: parseInt(opts.limit) });
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  const msgs = res.data || [];
  if (opts.json) {
    console.log(JSON.stringify(msgs, null, 2));
    return;
  }
  if (msgs.length === 0) {
    console.log("No messages.");
    return;
  }
  for (const m of msgs) {
    const ts = m.createdAt ? new Date(m.createdAt).toLocaleString() : "";
    console.log(`[${ts}] ${m.senderId || "?"}: ${m.content}`);
  }
});
var convos = im.command("conversations").description("Conversation management");
convos.command("list").description("List conversations").option("--unread", "Show unread only").option("--json", "JSON output").action(async (opts) => {
  const client = getIMClient();
  const listOpts = {};
  if (opts.unread) {
    listOpts.withUnread = true;
    listOpts.unreadOnly = true;
  }
  const res = await client.im.conversations.list(listOpts);
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  const list = res.data || [];
  if (opts.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }
  if (list.length === 0) {
    console.log("No conversations.");
    return;
  }
  for (const c of list) {
    const unread = c.unreadCount ? ` (${c.unreadCount} unread)` : "";
    console.log(`${c.id || ""}  ${c.type || ""}  ${c.title || ""}${unread}`);
  }
});
convos.command("read").description("Mark conversation as read").argument("<conversation-id>", "Conversation ID").action(async (convId) => {
  const client = getIMClient();
  const res = await client.im.conversations.markAsRead(convId);
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  console.log("Marked as read.");
});
var files = im.command("files").description("File upload management");
files.command("upload").description("Upload a file").argument("<path>", "File path to upload").option("--mime <type>", "Override MIME type").option("--json", "JSON output").action(async (filePath, opts) => {
  const client = getIMClient();
  try {
    const result = await client.im.files.upload(filePath, { mimeType: opts.mime });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Upload ID: ${result.uploadId}`);
    console.log(`CDN URL:   ${result.cdnUrl}`);
    console.log(`File:      ${result.fileName} (${result.fileSize} bytes)`);
    console.log(`MIME:      ${result.mimeType}`);
  } catch (err) {
    console.error("Upload failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
});
files.command("send").description("Upload file and send as message").argument("<conversation-id>", "Conversation ID").argument("<path>", "File path to upload").option("--content <text>", "Message text").option("--mime <type>", "Override MIME type").option("--json", "JSON output").action(async (conversationId, filePath, opts) => {
  const client = getIMClient();
  try {
    const result = await client.im.files.sendFile(conversationId, filePath, { content: opts.content, mimeType: opts.mime });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Upload ID: ${result.upload.uploadId}`);
    console.log(`CDN URL:   ${result.upload.cdnUrl}`);
    console.log(`File:      ${result.upload.fileName}`);
    console.log(`Message:   sent`);
  } catch (err) {
    console.error("Send file failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
});
files.command("quota").description("Show storage quota").option("--json", "JSON output").action(async (opts) => {
  const client = getIMClient();
  const res = await client.im.files.quota();
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  if (opts.json) {
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }
  const q = res.data;
  console.log(`Used:       ${q?.used ?? "-"} bytes`);
  console.log(`Limit:      ${q?.limit ?? "-"} bytes`);
  console.log(`File Count: ${q?.fileCount ?? "-"}`);
  console.log(`Tier:       ${q?.tier ?? "-"}`);
});
files.command("delete").description("Delete an uploaded file").argument("<upload-id>", "Upload ID").action(async (uploadId) => {
  const client = getIMClient();
  const res = await client.im.files.delete(uploadId);
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  console.log(`Deleted upload ${uploadId}.`);
});
files.command("types").description("List allowed MIME types").option("--json", "JSON output").action(async (opts) => {
  const client = getIMClient();
  const res = await client.im.files.types();
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  if (opts.json) {
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }
  const types = res.data?.allowedMimeTypes || [];
  console.log(`Allowed MIME types (${types.length}):`);
  for (const t of types) {
    console.log(`  ${t}`);
  }
});
im.command("credits").description("Show credits balance").option("--json", "JSON output").action(async (opts) => {
  const client = getIMClient();
  const res = await client.im.credits.get();
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  if (opts.json) {
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }
  console.log(`Balance: ${res.data?.balance ?? "-"}`);
});
im.command("transactions").description("Transaction history").option("-n, --limit <n>", "Max transactions", "20").option("--json", "JSON output").action(async (opts) => {
  const client = getIMClient();
  const res = await client.im.credits.transactions({ limit: parseInt(opts.limit) });
  if (!res.ok) {
    console.error("Error:", res.error);
    process.exit(1);
  }
  const txns = res.data || [];
  if (opts.json) {
    console.log(JSON.stringify(txns, null, 2));
    return;
  }
  if (txns.length === 0) {
    console.log("No transactions.");
    return;
  }
  for (const t of txns) {
    console.log(`${t.createdAt || ""}  ${t.type || ""}  ${t.amount ?? ""}  ${t.description || ""}`);
  }
});
var ctx = program.command("context").description("Context API commands");
ctx.command("load").description("Load URL content").argument("<url>", "URL to load").option("-f, --format <fmt>", "Return format: hqcc, raw, both", "hqcc").option("--json", "JSON output").action(async (url, opts) => {
  const client = getAPIClient();
  const loadOpts = {};
  if (opts.format) loadOpts.return = { format: opts.format };
  const res = await client.load(url, loadOpts);
  if (opts.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  if (!res.success) {
    console.error("Error:", res.error?.message || "Load failed");
    process.exit(1);
  }
  const r = res.result;
  console.log(`URL:     ${r?.url || url}`);
  console.log(`Status:  ${r?.cached ? "cached" : "loaded"}`);
  if (r?.hqcc) {
    console.log(`
--- HQCC ---
${r.hqcc.substring(0, 2e3)}`);
  }
  if (r?.raw) {
    console.log(`
--- Raw ---
${r.raw.substring(0, 2e3)}`);
  }
});
ctx.command("search").description("Search cached content").argument("<query>", "Search query").option("-k, --top-k <n>", "Number of results", "5").option("--json", "JSON output").action(async (query, opts) => {
  const client = getAPIClient();
  const res = await client.search(query, { topK: parseInt(opts.topK) });
  if (opts.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  if (!res.success) {
    console.error("Error:", res.error?.message || "Search failed");
    process.exit(1);
  }
  const results = res.results || [];
  if (results.length === 0) {
    console.log("No results.");
    return;
  }
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`${i + 1}. ${r.url || "(no url)"}  score: ${r.ranking?.score ?? "-"}`);
    if (r.hqcc) console.log(`   ${r.hqcc.substring(0, 200)}`);
  }
});
ctx.command("save").description("Save content to cache").argument("<url>", "URL key").argument("<hqcc>", "HQCC content").option("--json", "JSON output").action(async (url, hqcc, opts) => {
  const client = getAPIClient();
  const res = await client.save({ url, hqcc });
  if (opts.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  if (!res.success) {
    console.error("Error:", res.error?.message || "Save failed");
    process.exit(1);
  }
  console.log("Content saved.");
});
var parse2 = program.command("parse").description("Document parsing commands");
parse2.command("run").description("Parse a document").argument("<url>", "Document URL").option("-m, --mode <mode>", "Parse mode: fast, hires, auto", "fast").option("--json", "JSON output").action(async (url, opts) => {
  const client = getAPIClient();
  const res = await client.parsePdf(url, opts.mode);
  if (opts.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  if (!res.success) {
    console.error("Error:", res.error?.message || "Parse failed");
    process.exit(1);
  }
  if (res.taskId) {
    console.log(`Task ID: ${res.taskId}`);
    console.log(`Status:  ${res.status || "processing"}`);
    console.log(`
Check progress: prismer parse status ${res.taskId}`);
  } else if (res.document) {
    console.log(`Status: complete`);
    const content = res.document.markdown || res.document.text || JSON.stringify(res.document, null, 2);
    console.log(content.substring(0, 5e3));
  }
});
parse2.command("status").description("Check parse task status").argument("<task-id>", "Task ID").option("--json", "JSON output").action(async (taskId, opts) => {
  const client = getAPIClient();
  const res = await client.parseStatus(taskId);
  if (opts.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  console.log(`Task:   ${taskId}`);
  console.log(`Status: ${res.status || (res.success ? "complete" : "unknown")}`);
});
parse2.command("result").description("Get parse result").argument("<task-id>", "Task ID").option("--json", "JSON output").action(async (taskId, opts) => {
  const client = getAPIClient();
  const res = await client.parseResult(taskId);
  if (opts.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  if (!res.success) {
    console.error("Error:", res.error?.message || "Not ready");
    process.exit(1);
  }
  const content = res.document?.markdown || res.document?.text || JSON.stringify(res.document, null, 2);
  console.log(content);
});
program.parse(process.argv);
