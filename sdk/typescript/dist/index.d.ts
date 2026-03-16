/**
 * Prismer Cloud Real-Time Client — WebSocket & SSE transports.
 *
 * @example
 * ```typescript
 * const ws = client.im.connectWS({ token: jwtToken });
 * await ws.connect();
 *
 * ws.on('message.new', (msg) => console.log(msg.content));
 * ws.joinConversation('conv-123');
 * ws.sendMessage('conv-123', 'Hello!');
 *
 * // SSE (server-push only, auto-joins all conversations)
 * const sse = client.im.connectSSE({ token: jwtToken });
 * await sse.connect();
 * sse.on('message.new', (msg) => console.log(msg.content));
 * ```
 */
interface AuthenticatedPayload {
    userId: string;
    username: string;
}
interface MessageNewPayload {
    id: string;
    conversationId: string;
    content: string;
    type: string;
    senderId: string;
    routing?: {
        mode: string;
        targets: Array<{
            userId: string;
            username?: string;
        }>;
    };
    metadata?: Record<string, any>;
    createdAt: string;
}
interface TypingIndicatorPayload {
    conversationId: string;
    userId: string;
    isTyping: boolean;
}
interface PresenceChangedPayload {
    userId: string;
    status: string;
}
interface PongPayload {
    requestId: string;
}
interface ErrorPayload {
    message: string;
}
interface DisconnectedPayload {
    code: number;
    reason: string;
}
interface ReconnectingPayload {
    attempt: number;
    delayMs: number;
}
interface RealtimeEventMap {
    'authenticated': AuthenticatedPayload;
    'message.new': MessageNewPayload;
    'typing.indicator': TypingIndicatorPayload;
    'presence.changed': PresenceChangedPayload;
    'pong': PongPayload;
    'error': ErrorPayload;
    'connected': undefined;
    'disconnected': DisconnectedPayload;
    'reconnecting': ReconnectingPayload;
}
type RealtimeEventType = keyof RealtimeEventMap;
interface RealtimeCommand {
    type: string;
    payload: unknown;
    requestId?: string;
}
interface RealtimeConfig {
    /** JWT token for authentication */
    token: string;
    /** Auto-reconnect on disconnect (default: true) */
    autoReconnect?: boolean;
    /** Max reconnection attempts (default: 10, 0 = unlimited) */
    maxReconnectAttempts?: number;
    /** Base delay for exponential backoff in ms (default: 1000) */
    reconnectBaseDelay?: number;
    /** Max delay cap in ms (default: 30000) */
    reconnectMaxDelay?: number;
    /** Heartbeat interval in ms (default: 25000) */
    heartbeatInterval?: number;
    /** Custom WebSocket constructor (for Node <21 or test mocks) */
    WebSocket?: new (url: string) => WebSocket;
    /** Custom fetch implementation (for SSE streaming) */
    fetch?: typeof fetch;
}
type RealtimeState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
type Listener$1<T> = (payload: T) => void;
declare class TypedEmitter {
    private listeners;
    on<E extends RealtimeEventType>(event: E, cb: Listener$1<RealtimeEventMap[E]>): this;
    off<E extends RealtimeEventType>(event: E, cb: Listener$1<RealtimeEventMap[E]>): this;
    once<E extends RealtimeEventType>(event: E, cb: Listener$1<RealtimeEventMap[E]>): this;
    protected emit<E extends RealtimeEventType>(event: E, payload: RealtimeEventMap[E]): void;
    protected removeAllListeners(): void;
}
declare class RealtimeWSClient extends TypedEmitter {
    private ws;
    private reconnector;
    private heartbeatTimer;
    private pongTimer;
    private reconnectTimer;
    private pendingPings;
    private _state;
    private intentionalClose;
    private readonly wsUrl;
    private readonly config;
    private readonly WS;
    private pingCounter;
    get state(): RealtimeState;
    constructor(baseUrl: string, config: RealtimeConfig);
    connect(): Promise<void>;
    disconnect(code?: number, reason?: string): void;
    joinConversation(conversationId: string): void;
    sendMessage(conversationId: string, content: string, type?: string): void;
    startTyping(conversationId: string): void;
    stopTyping(conversationId: string): void;
    updatePresence(status: string): void;
    send(command: RealtimeCommand): void;
    ping(): Promise<PongPayload>;
    private sendRaw;
    private handleMessage;
    private handleClose;
    private scheduleReconnect;
    private startHeartbeat;
    private stopHeartbeat;
    private clearReconnectTimer;
    private clearPendingPings;
}
declare class RealtimeSSEClient extends TypedEmitter {
    private abortController;
    private reconnector;
    private reconnectTimer;
    private heartbeatWatchdog;
    private lastDataTime;
    private _state;
    private intentionalClose;
    private readonly sseUrl;
    private readonly config;
    private readonly fetchFn;
    get state(): RealtimeState;
    constructor(baseUrl: string, config: RealtimeConfig);
    connect(): Promise<void>;
    disconnect(): void;
    private readStream;
    private scheduleReconnect;
    private startHeartbeatWatchdog;
    private stopHeartbeatWatchdog;
    private clearReconnectTimer;
}

/**
 * Prismer SDK — Storage adapters for offline-first IM.
 *
 * Three built-in implementations:
 *   - MemoryStorage   — in-process Map, for tests / stateless agents
 *   - IndexedDBStorage — browser-persistent, for web apps
 *   - (future) SQLiteStorage — Node.js / React Native
 */
interface StoredMessage {
    id: string;
    clientId?: string;
    conversationId: string;
    content: string;
    type: string;
    senderId: string;
    parentId?: string | null;
    status: 'pending' | 'sent' | 'confirmed' | 'failed';
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt?: string;
    syncSeq?: number;
}
interface StoredConversation {
    id: string;
    type: 'direct' | 'group';
    title?: string;
    lastMessage?: StoredMessage;
    lastMessageAt?: string;
    unreadCount: number;
    lastReadMessageId?: string;
    members?: Array<{
        userId: string;
        username: string;
        displayName?: string;
        role: string;
    }>;
    metadata?: Record<string, any>;
    syncSeq?: number;
    updatedAt: string;
}
interface StoredContact {
    userId: string;
    username: string;
    displayName: string;
    role: string;
    conversationId: string;
    lastMessageAt?: string;
    unreadCount: number;
    syncSeq?: number;
}
interface OutboxOperation {
    id: string;
    type: 'message.send' | 'message.edit' | 'message.delete' | 'conversation.read';
    method: string;
    path: string;
    body?: unknown;
    query?: Record<string, string>;
    status: 'pending' | 'inflight' | 'confirmed' | 'failed';
    createdAt: number;
    retries: number;
    maxRetries: number;
    lastError?: string;
    idempotencyKey: string;
    /** Local data for optimistic UI (e.g., the pending message) */
    localData?: unknown;
}
interface StorageAdapter {
    /** Initialize the storage (open DB, create tables, etc.) */
    init(): Promise<void>;
    putMessages(messages: StoredMessage[]): Promise<void>;
    getMessages(conversationId: string, opts: {
        limit: number;
        before?: string;
    }): Promise<StoredMessage[]>;
    getMessage(messageId: string): Promise<StoredMessage | null>;
    deleteMessage(messageId: string): Promise<void>;
    putConversations(conversations: StoredConversation[]): Promise<void>;
    getConversations(opts?: {
        limit: number;
        offset?: number;
    }): Promise<StoredConversation[]>;
    getConversation(id: string): Promise<StoredConversation | null>;
    putContacts(contacts: StoredContact[]): Promise<void>;
    getContacts(): Promise<StoredContact[]>;
    getCursor(key: string): Promise<string | null>;
    setCursor(key: string, value: string): Promise<void>;
    enqueue(op: OutboxOperation): Promise<void>;
    dequeueReady(limit: number): Promise<OutboxOperation[]>;
    ack(opId: string): Promise<void>;
    nack(opId: string, error: string, retries: number): Promise<void>;
    getPendingCount(): Promise<number>;
    clear(): Promise<void>;
    /** Full-text search over message content. SQLiteStorage uses FTS5; others use basic contains. */
    searchMessages?(query: string, opts?: {
        conversationId?: string;
        limit?: number;
    }): Promise<StoredMessage[]>;
    /** Approximate storage size in bytes by category. */
    getStorageSize?(): Promise<{
        messages: number;
        conversations: number;
        total: number;
    }>;
    /** Delete oldest messages in a conversation, keeping the newest `keepCount`. Returns deleted count. */
    clearOldMessages?(conversationId: string, keepCount: number): Promise<number>;
}
declare class MemoryStorage implements StorageAdapter {
    private messages;
    private conversations;
    private contacts;
    private cursors;
    private outbox;
    init(): Promise<void>;
    putMessages(messages: StoredMessage[]): Promise<void>;
    getMessages(conversationId: string, opts: {
        limit: number;
        before?: string;
    }): Promise<StoredMessage[]>;
    getMessage(messageId: string): Promise<StoredMessage | null>;
    deleteMessage(messageId: string): Promise<void>;
    putConversations(conversations: StoredConversation[]): Promise<void>;
    getConversations(opts?: {
        limit: number;
        offset?: number;
    }): Promise<StoredConversation[]>;
    getConversation(id: string): Promise<StoredConversation | null>;
    putContacts(contacts: StoredContact[]): Promise<void>;
    getContacts(): Promise<StoredContact[]>;
    getCursor(key: string): Promise<string | null>;
    setCursor(key: string, value: string): Promise<void>;
    enqueue(op: OutboxOperation): Promise<void>;
    dequeueReady(limit: number): Promise<OutboxOperation[]>;
    ack(opId: string): Promise<void>;
    nack(opId: string, error: string, retries: number): Promise<void>;
    getPendingCount(): Promise<number>;
    searchMessages(query: string, opts?: {
        conversationId?: string;
        limit?: number;
    }): Promise<StoredMessage[]>;
    getStorageSize(): Promise<{
        messages: number;
        conversations: number;
        total: number;
    }>;
    clearOldMessages(conversationId: string, keepCount: number): Promise<number>;
    clear(): Promise<void>;
}
declare class IndexedDBStorage implements StorageAdapter {
    private dbName;
    private version;
    private db;
    constructor(dbName?: string, version?: number);
    init(): Promise<void>;
    private tx;
    private req;
    putMessages(messages: StoredMessage[]): Promise<void>;
    getMessages(conversationId: string, opts: {
        limit: number;
        before?: string;
    }): Promise<StoredMessage[]>;
    getMessage(messageId: string): Promise<StoredMessage | null>;
    deleteMessage(messageId: string): Promise<void>;
    putConversations(conversations: StoredConversation[]): Promise<void>;
    getConversations(opts?: {
        limit: number;
        offset?: number;
    }): Promise<StoredConversation[]>;
    getConversation(id: string): Promise<StoredConversation | null>;
    putContacts(contacts: StoredContact[]): Promise<void>;
    getContacts(): Promise<StoredContact[]>;
    getCursor(key: string): Promise<string | null>;
    setCursor(key: string, value: string): Promise<void>;
    enqueue(op: OutboxOperation): Promise<void>;
    dequeueReady(limit: number): Promise<OutboxOperation[]>;
    ack(opId: string): Promise<void>;
    nack(opId: string, error: string, retries: number): Promise<void>;
    getPendingCount(): Promise<number>;
    searchMessages(query: string, opts?: {
        conversationId?: string;
        limit?: number;
    }): Promise<StoredMessage[]>;
    getStorageSize(): Promise<{
        messages: number;
        conversations: number;
        total: number;
    }>;
    clearOldMessages(conversationId: string, keepCount: number): Promise<number>;
    clear(): Promise<void>;
}
/**
 * SQLiteStorage uses `better-sqlite3` for synchronous, fast local persistence.
 * Includes FTS5 full-text search for message content.
 *
 * Usage:
 *   import { SQLiteStorage } from 'prismer/storage';
 *   const storage = new SQLiteStorage('./my-app.db');
 *   await storage.init();
 */
declare class SQLiteStorage implements StorageAdapter {
    private db;
    private dbPath;
    constructor(dbPath?: string);
    init(): Promise<void>;
    private ensureDb;
    putMessages(messages: StoredMessage[]): Promise<void>;
    getMessages(conversationId: string, opts: {
        limit: number;
        before?: string;
    }): Promise<StoredMessage[]>;
    getMessage(messageId: string): Promise<StoredMessage | null>;
    deleteMessage(messageId: string): Promise<void>;
    private rowToMessage;
    putConversations(conversations: StoredConversation[]): Promise<void>;
    getConversations(opts?: {
        limit: number;
        offset?: number;
    }): Promise<StoredConversation[]>;
    getConversation(id: string): Promise<StoredConversation | null>;
    private rowToConversation;
    putContacts(contacts: StoredContact[]): Promise<void>;
    getContacts(): Promise<StoredContact[]>;
    getCursor(key: string): Promise<string | null>;
    setCursor(key: string, value: string): Promise<void>;
    enqueue(op: OutboxOperation): Promise<void>;
    dequeueReady(limit: number): Promise<OutboxOperation[]>;
    ack(opId: string): Promise<void>;
    nack(opId: string, error: string, retries: number): Promise<void>;
    getPendingCount(): Promise<number>;
    searchMessages(query: string, opts?: {
        conversationId?: string;
        limit?: number;
    }): Promise<StoredMessage[]>;
    getStorageSize(): Promise<{
        messages: number;
        conversations: number;
        total: number;
    }>;
    clearOldMessages(conversationId: string, keepCount: number): Promise<number>;
    clear(): Promise<void>;
    private rowToOutbox;
}

type Environment = 'production';
declare const ENVIRONMENTS: Record<Environment, string>;
interface PrismerConfig {
    /** API Key (starts with sk-prismer-) or IM JWT token. Optional for anonymous IM registration. */
    apiKey?: string;
    /** Environment preset (default: 'production'). Sets the base URL automatically. */
    environment?: Environment;
    /** Base URL override. Takes priority over `environment` if both are set. */
    baseUrl?: string;
    /** Request timeout in ms (default: 30000) */
    timeout?: number;
    /** Custom fetch implementation */
    fetch?: typeof fetch;
    /** Default X-IM-Agent header for IM requests (select which agent identity to use) */
    imAgent?: string;
    /** Enable offline-first mode for IM with local persistence and sync */
    offline?: OfflineConfig;
}
interface LoadOptions {
    inputType?: 'auto' | 'url' | 'urls' | 'query';
    processUncached?: boolean;
    search?: {
        topK?: number;
    };
    processing?: {
        strategy?: 'auto' | 'fast' | 'quality';
        maxConcurrent?: number;
    };
    return?: {
        format?: 'hqcc' | 'raw' | 'both';
        topK?: number;
    };
    ranking?: {
        preset?: 'cache_first' | 'relevance_first' | 'balanced';
        custom?: {
            cacheHit?: number;
            relevance?: number;
            freshness?: number;
            quality?: number;
        };
    };
}
interface RankingFactors {
    cache: number;
    relevance: number;
    freshness: number;
    quality: number;
}
interface LoadResultItem {
    rank?: number;
    url: string;
    title?: string;
    hqcc?: string | null;
    raw?: string;
    cached: boolean;
    cachedAt?: string;
    processed?: boolean;
    found?: boolean;
    error?: string;
    ranking?: {
        score: number;
        factors: RankingFactors;
    };
    meta?: Record<string, any>;
}
interface SingleUrlCost {
    credits: number;
    cached: boolean;
}
interface BatchUrlCost {
    credits: number;
    cached: number;
}
interface QueryCost {
    searchCredits: number;
    compressionCredits: number;
    totalCredits: number;
    savedByCache: number;
}
interface BatchSummary {
    total: number;
    found: number;
    notFound: number;
    cached: number;
    processed: number;
}
interface QuerySummary {
    query: string;
    searched: number;
    cacheHits: number;
    compressed: number;
    returned: number;
}
interface LoadResult {
    success: boolean;
    requestId?: string;
    mode?: 'single_url' | 'batch_urls' | 'query';
    result?: LoadResultItem;
    results?: LoadResultItem[];
    summary?: BatchSummary | QuerySummary;
    cost?: SingleUrlCost | BatchUrlCost | QueryCost;
    processingTime?: number;
    error?: {
        code: string;
        message: string;
    };
}
interface SaveOptions {
    url: string;
    hqcc: string;
    raw?: string;
    visibility?: 'public' | 'private' | 'unlisted';
    meta?: Record<string, any>;
}
interface SaveBatchOptions {
    items: SaveOptions[];
}
interface SaveResult {
    success: boolean;
    status?: string;
    url?: string;
    content_uri?: string;
    visibility?: string;
    results?: Array<{
        url: string;
        status: string;
        content_uri?: string;
    }>;
    summary?: {
        total: number;
        created: number;
        updated?: number;
        failed?: number;
        exists?: number;
    };
    error?: {
        code: string;
        message: string;
    };
}
interface ParseOptions {
    url?: string;
    base64?: string;
    filename?: string;
    mode?: 'fast' | 'hires' | 'auto';
    output?: 'markdown' | 'json';
    image_mode?: 'embedded' | 's3';
    wait?: boolean;
}
interface ParseDocumentImage {
    page: number;
    url: string;
    caption?: string;
}
interface ParseDocument {
    markdown?: string;
    text?: string;
    pageCount: number;
    metadata?: {
        title?: string;
        author?: string;
        [key: string]: any;
    };
    images?: ParseDocumentImage[];
    estimatedTime?: number;
}
interface ParseUsage {
    inputPages: number;
    inputImages: number;
    outputChars: number;
    outputTokens: number;
}
interface ParseCostBreakdown {
    pages: number;
    images: number;
}
interface ParseCost {
    credits: number;
    breakdown?: ParseCostBreakdown;
}
interface ParseResult {
    success: boolean;
    requestId?: string;
    mode?: string;
    async?: boolean;
    document?: ParseDocument;
    usage?: ParseUsage;
    cost?: ParseCost;
    taskId?: string;
    status?: string;
    endpoints?: {
        status: string;
        result: string;
        stream: string;
    };
    processingTime?: number;
    error?: {
        code: string;
        message: string;
    };
}
interface IMRegisterOptions {
    type: 'agent' | 'human';
    username: string;
    displayName: string;
    agentType?: 'assistant' | 'specialist' | 'orchestrator' | 'tool' | 'bot';
    capabilities?: string[];
    description?: string;
    endpoint?: string;
}
interface IMRegisterData {
    imUserId: string;
    username: string;
    displayName: string;
    role: string;
    token: string;
    expiresIn: string;
    capabilities?: string[];
    isNew: boolean;
}
interface IMUser {
    id: string;
    username: string;
    displayName: string;
    role: string;
    agentType?: string;
}
interface IMAgentCard {
    agentType: string;
    capabilities: string[];
    description?: string;
    status: string;
}
interface IMMeData {
    user: IMUser;
    agentCard?: IMAgentCard;
    stats: {
        conversationCount: number;
        directCount?: number;
        groupCount?: number;
        contactCount: number;
        messagesSent: number;
        unreadCount: number;
    };
    bindings: Array<{
        platform: string;
        status: string;
        externalName?: string;
    }>;
    credits: {
        balance: number;
        totalSpent: number;
    };
}
interface IMTokenData {
    token: string;
    expiresIn: string;
}
interface IMMessage {
    id: string;
    conversationId?: string;
    content: string;
    type: string;
    senderId: string;
    parentId?: string | null;
    status?: string;
    createdAt: string;
    updatedAt?: string;
    metadata?: Record<string, any> | string;
}
interface IMRouting {
    mode: string;
    targets: Array<{
        userId: string;
        username?: string;
    }>;
}
interface IMMessageData {
    conversationId: string;
    message: IMMessage;
    routing?: IMRouting;
}
interface IMGroupMember {
    userId: string;
    username: string;
    displayName?: string;
    role: string;
}
interface IMGroupData {
    groupId: string;
    title: string;
    description?: string;
    members: IMGroupMember[];
}
interface IMContact {
    username: string;
    displayName: string;
    role: string;
    lastMessageAt?: string;
    unreadCount: number;
    conversationId: string;
}
interface IMDiscoverAgent {
    username: string;
    displayName: string;
    agentType?: string;
    capabilities?: string[];
    status: string;
}
interface IMBindingData {
    bindingId: string;
    platform: string;
    status: string;
    verificationCode: string;
}
interface IMBinding {
    bindingId: string;
    platform: string;
    status: string;
    externalName?: string;
}
interface IMCreditsData {
    balance: number;
    totalEarned: number;
    totalSpent: number;
}
interface IMTransaction {
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
}
interface IMConversation {
    id: string;
    type: string;
    title?: string;
    lastMessage?: IMMessage;
    unreadCount?: number;
    members?: IMGroupMember[];
    createdAt: string;
    updatedAt?: string;
}
interface IMWorkspaceData {
    workspaceId?: string;
    conversationId: string;
    user?: {
        imUserId: string;
        token: string;
    };
    agent?: any;
}
interface IMWorkspaceInitOptions {
    workspaceId: string;
    userId: string;
    userDisplayName: string;
}
interface IMWorkspaceInitGroupOptions {
    workspaceId: string;
    title: string;
    users: Array<{
        userId: string;
        displayName: string;
    }>;
}
interface IMAutocompleteResult {
    userId: string;
    username: string;
    displayName: string;
    role: string;
}
interface IMCreateGroupOptions {
    title: string;
    description?: string;
    members?: string[];
    metadata?: Record<string, any>;
}
interface IMCreateBindingOptions {
    platform: 'telegram' | 'discord' | 'slack' | 'wechat' | 'x' | 'line';
    botToken: string;
    chatId?: string;
    channelId?: string;
}
interface IMSendOptions {
    type?: 'text' | 'markdown' | 'code' | 'image' | 'file' | 'tool_call' | 'tool_result' | 'system_event' | 'thinking';
    metadata?: Record<string, any>;
    parentId?: string;
}
interface IMPaginationOptions {
    limit?: number;
    offset?: number;
}
interface IMConversationsOptions {
    withUnread?: boolean;
    unreadOnly?: boolean;
}
interface IMDiscoverOptions {
    type?: string;
    capability?: string;
}
interface IMPresignOptions {
    fileName: string;
    fileSize: number;
    mimeType: string;
}
interface IMPresignResult {
    uploadId: string;
    url: string;
    fields: Record<string, string>;
    expiresAt: string;
}
interface IMConfirmResult {
    uploadId: string;
    cdnUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    sha256: string | null;
    cost: number;
}
interface IMFileQuota {
    used: number;
    limit: number;
    tier: string;
    fileCount: number;
}
/** Input source for upload() — polymorphic across Node.js and browser */
type FileInput = File | Blob | Buffer | Uint8Array | string;
interface UploadOptions {
    /** File name (required if input is Buffer/Uint8Array/Blob without name) */
    fileName?: string;
    /** MIME type (auto-detected from fileName extension if not provided) */
    mimeType?: string;
    /** Progress callback */
    onProgress?: (uploaded: number, total: number) => void;
}
interface UploadResult {
    uploadId: string;
    cdnUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    sha256: string | null;
    cost: number;
}
interface SendFileOptions extends UploadOptions {
    /** Message content (defaults to fileName) */
    content?: string;
    /** Parent message ID for threading */
    parentId?: string;
}
interface SendFileResult {
    upload: UploadResult;
    message: any;
}
interface IMMultipartInitResult {
    uploadId: string;
    parts: Array<{
        partNumber: number;
        url: string;
    }>;
    expiresAt: string;
}
/** Generic IM API response wrapper */
interface IMResult<T = any> {
    ok: boolean;
    data?: T;
    meta?: {
        total?: number;
        pageSize?: number;
    };
    error?: {
        code: string;
        message: string;
    };
}
interface OfflineConfig {
    /** Storage adapter implementation (IndexedDBStorage, MemoryStorage, SQLiteStorage) */
    storage: StorageAdapter;
    /** Auto-sync on reconnect (default: true) */
    syncOnConnect?: boolean;
    /** Max retries per outbox operation (default: 5) */
    outboxRetryLimit?: number;
    /** Outbox flush interval in ms (default: 1000) */
    outboxFlushInterval?: number;
    /** Conflict strategy: 'server' = server wins, 'client' = client wins (default: 'server') */
    conflictStrategy?: 'server' | 'client';
    /** Custom conflict resolver — called when server and local message diverge */
    onConflict?: (local: StoredMessage, remote: {
        type: string;
        data: any;
        seq: number;
    }) => 'keep_local' | 'accept_remote' | StoredMessage;
    /** Sync mode: 'push' = SSE continuous stream, 'poll' = periodic polling (default: 'push') */
    syncMode?: 'push' | 'poll';
    /** Enable multi-tab coordination via BroadcastChannel (default: true in browser, false in Node.js) */
    multiTab?: boolean;
    /** E2E encryption config */
    e2e?: {
        enabled: boolean;
        /** User passphrase for master key derivation (PBKDF2) */
        passphrase: string;
    };
    /** Storage quota config */
    quota?: {
        /** Max storage size in bytes (default: 500MB) */
        maxStorageBytes?: number;
        /** Warning threshold 0-1 (default: 0.9 = 90%) */
        warningThreshold?: number;
    };
}
/** Internal request function type */
type RequestFn = <T>(method: string, path: string, body?: unknown, query?: Record<string, string>) => Promise<T>;

/**
 * Prismer SDK — Offline Manager, Outbox Queue, and Sync Engine.
 *
 * Orchestrates local persistence, optimistic writes, and incremental sync.
 */

interface SyncEvent {
    seq: number;
    type: string;
    data: any;
    conversationId?: string;
    at: string;
}
interface SyncResult {
    events: SyncEvent[];
    cursor: number;
    hasMore: boolean;
}
interface OfflineEventMap {
    'sync.start': undefined;
    'sync.progress': {
        synced: number;
        total: number;
    };
    'sync.complete': {
        newMessages: number;
        updatedConversations: number;
    };
    'sync.error': {
        error: string;
        willRetry: boolean;
    };
    'outbox.sending': {
        opId: string;
        type: string;
    };
    'outbox.confirmed': {
        opId: string;
        serverData: any;
    };
    'outbox.failed': {
        opId: string;
        error: string;
        retriesLeft: number;
    };
    'message.local': StoredMessage;
    'message.confirmed': {
        clientId: string;
        serverMessage: any;
    };
    'message.failed': {
        clientId: string;
        error: string;
    };
    'network.online': undefined;
    'network.offline': undefined;
    'presence.changed': {
        userId: string;
        status: string;
        lastSeen?: string;
    };
    'quota.warning': {
        used: number;
        limit: number;
        percentage: number;
    };
    'quota.exceeded': {
        used: number;
        limit: number;
    };
}
type OfflineEventType = keyof OfflineEventMap;
type Listener<T> = (payload: T) => void;
declare class OfflineEmitter {
    private listeners;
    on<E extends OfflineEventType>(event: E, cb: Listener<OfflineEventMap[E]>): this;
    off<E extends OfflineEventType>(event: E, cb: Listener<OfflineEventMap[E]>): this;
    emit<E extends OfflineEventType>(event: E, payload: OfflineEventMap[E]): void;
    removeAllListeners(): void;
}
declare class OfflineManager extends OfflineEmitter {
    readonly storage: StorageAdapter;
    private networkRequest;
    private options;
    private flushTimer;
    private flushing;
    private _isOnline;
    private _syncState;
    private sseSource;
    private sseReconnectTimer;
    private sseReconnectAttempts;
    /** Presence cache for realtime presence events */
    private presenceCache;
    /** Auth token provider — set by PrismerClient for SSE auth */
    tokenProvider?: () => string | undefined;
    get isOnline(): boolean;
    get syncState(): string;
    constructor(storage: StorageAdapter, networkRequest: RequestFn, options?: Omit<OfflineConfig, 'storage'>);
    init(): Promise<void>;
    destroy(): Promise<void>;
    setOnline(online: boolean): void;
    /**
     * Dispatch an IM request. Write ops go through outbox; reads check local cache.
     */
    dispatch<T>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T>;
    private dispatchWrite;
    private startFlushTimer;
    private stopFlushTimer;
    flush(): Promise<void>;
    get outboxSize(): Promise<number>;
    sync(): Promise<void>;
    private applySyncEvent;
    /**
     * Handle a realtime event (from WS/SSE) and store locally.
     */
    handleRealtimeEvent(type: string, payload: any): Promise<void>;
    /**
     * Get cached presence status for a user.
     */
    getPresence(userId: string): {
        status: string;
        lastSeen: string;
    } | null;
    /**
     * Search messages in local storage.
     */
    searchMessages(query: string, opts?: {
        conversationId?: string;
        limit?: number;
    }): Promise<StoredMessage[]>;
    /**
     * Get storage size and quota info.
     */
    getQuotaStatus(): Promise<{
        used: number;
        limit: number;
        percentage: number;
        warning: boolean;
        exceeded: boolean;
    }>;
    /**
     * Clear old messages for a conversation (user-initiated quota management).
     */
    clearOldMessages(conversationId: string, keepCount: number): Promise<number>;
    private readFromCache;
    private cacheReadResult;
    /**
     * Start continuous sync via SSE (Server-Sent Events).
     * Replaces polling with real-time push when syncMode is 'push'.
     */
    startContinuousSync(): Promise<void>;
    /**
     * Stop the SSE continuous sync connection.
     */
    stopContinuousSync(): void;
    private scheduleSseReconnect;
    /** Get the base URL for SSE connections (strip /api/im prefix). */
    private getBaseUrl;
    private checkQuota;
}
interface QueuedAttachment {
    id: string;
    conversationId: string;
    file: {
        name: string;
        size: number;
        type: string;
    };
    /** File data — stored in memory for MemoryStorage, in IndexedDB/SQLite for persistent */
    data?: ArrayBuffer;
    status: 'pending' | 'uploading' | 'uploaded' | 'failed';
    progress: number;
    messageClientId: string;
    error?: string;
    createdAt: number;
}
/**
 * AttachmentQueue manages offline file uploads.
 * Files are queued locally and uploaded when online, then a message
 * is sent referencing the uploaded file.
 */
declare class AttachmentQueue {
    private offline;
    private networkRequest;
    private queue;
    private uploading;
    constructor(offline: OfflineManager, networkRequest: RequestFn);
    /**
     * Queue a file attachment for offline upload.
     * Returns the queued attachment with a local ID.
     */
    queueAttachment(conversationId: string, file: {
        name: string;
        size: number;
        type: string;
        data: ArrayBuffer;
    }, messageContent?: string): Promise<QueuedAttachment>;
    /** Process pending uploads. */
    processQueue(): Promise<void>;
    /** Get all queued attachments. */
    getQueue(): QueuedAttachment[];
    /** Retry a failed attachment upload. */
    retry(attachmentId: string): Promise<void>;
    /** Cancel and remove a queued attachment. */
    cancel(attachmentId: string): Promise<void>;
}

/**
 * Prismer SDK — Multi-Tab Coordination
 *
 * Uses BroadcastChannel API to coordinate multiple browser tabs.
 * Protocol: "Last login wins" — the most recently opened tab becomes leader.
 * Leader runs outbox flush + sync. Passive tabs receive events from leader.
 *
 * Fallback: In environments without BroadcastChannel (Node.js, old browsers),
 * this is a no-op — single-tab/single-process behavior.
 */

/**
 * TabCoordinator manages leadership election and event relay
 * between multiple browser tabs sharing the same IndexedDB.
 */
declare class TabCoordinator {
    private offline;
    private channelName;
    private channel;
    private tabId;
    private _isLeader;
    private disposed;
    get isLeader(): boolean;
    constructor(offline: OfflineManager, channelName?: string);
    /**
     * Initialize tab coordination.
     * Claims leadership immediately (last-login-wins).
     */
    init(): void;
    /**
     * Release leadership and clean up.
     */
    destroy(): void;
    /**
     * Relay a sync event to passive tabs.
     * Called by the leader tab after processing a sync event.
     */
    relaySyncEvent(event: SyncEvent): void;
    private claimLeadership;
    private demoteToPassive;
    private handleMessage;
    private onBecomeLeader;
    private onBecomePassive;
    private broadcast;
}

/**
 * Prismer SDK — E2E Encryption
 *
 * Industry-standard end-to-end encryption for IM messages.
 *
 * - Per-conversation symmetric key: AES-256-GCM
 * - Key exchange: ECDH P-256
 * - Master key derivation: PBKDF2-SHA256
 * - Key storage: Encrypted with master key
 * - Runtime: Web Crypto API (browser) / node:crypto (Node.js)
 *
 * The server only sees ciphertext — it cannot decrypt message content.
 */
/**
 * E2EEncryption manages per-conversation symmetric keys and
 * encrypts/decrypts message content using AES-256-GCM.
 *
 * Usage:
 *   const e2e = new E2EEncryption();
 *   await e2e.init('user-passphrase');
 *   const ciphertext = await e2e.encrypt('conv-123', 'Hello!');
 *   const plaintext = await e2e.decrypt('conv-123', ciphertext);
 */
declare class E2EEncryption {
    private masterKey;
    private keyPair;
    private sessionKeys;
    private salt;
    /**
     * Initialize encryption with user passphrase.
     * Derives a master key via PBKDF2 and generates an ECDH key pair.
     */
    init(passphrase: string): Promise<void>;
    /**
     * Export public key for sharing with conversation peers.
     */
    exportPublicKey(): Promise<JsonWebKey>;
    /**
     * Derive a shared session key for a conversation using ECDH.
     * Call this with each peer's public key.
     */
    deriveSessionKey(conversationId: string, peerPublicKey: JsonWebKey): Promise<void>;
    /**
     * Set a pre-shared session key for a conversation.
     * Useful when the key is exchanged out-of-band or derived from a group key.
     */
    setSessionKey(conversationId: string, rawKey: ArrayBuffer): Promise<void>;
    /**
     * Generate a random session key for a conversation.
     * Returns the raw key bytes for sharing with peers.
     */
    generateSessionKey(conversationId: string): Promise<ArrayBuffer>;
    /**
     * Encrypt plaintext for a conversation.
     * Returns base64-encoded ciphertext with prepended IV.
     */
    encrypt(conversationId: string, plaintext: string): Promise<string>;
    /**
     * Decrypt ciphertext from a conversation.
     * Expects base64-encoded data with prepended IV.
     */
    decrypt(conversationId: string, ciphertext: string): Promise<string>;
    /**
     * Check if a session key exists for a conversation.
     */
    hasSessionKey(conversationId: string): boolean;
    /**
     * Remove session key for a conversation.
     */
    removeSessionKey(conversationId: string): void;
    /**
     * Clear all keys and reset state.
     */
    destroy(): void;
}

/**
 * Prismer Cloud SDK for TypeScript/JavaScript
 *
 * @example
 * ```typescript
 * import { PrismerClient } from '@prismer/sdk';
 *
 * const client = new PrismerClient({ apiKey: 'sk-prismer-...' });
 *
 * // Context API
 * const result = await client.load('https://example.com');
 *
 * // Parse API
 * const pdf = await client.parsePdf('https://arxiv.org/pdf/2401.00001.pdf');
 *
 * // IM API (sub-module pattern)
 * const reg = await client.im.account.register({ type: 'agent', username: 'my-agent', displayName: 'My Agent' });
 * await client.im.direct.send('user-123', 'Hello!');
 * const groups = await client.im.groups.list();
 * const convos = await client.im.conversations.list();
 * ```
 */

/** Account management: register, identity, token refresh */
declare class AccountClient {
    private _r;
    constructor(_r: RequestFn);
    /** Register an agent or human identity */
    register(options: IMRegisterOptions): Promise<IMResult<IMRegisterData>>;
    /** Get own identity, stats, bindings, credits */
    me(): Promise<IMResult<IMMeData>>;
    /** Refresh JWT token */
    refreshToken(): Promise<IMResult<IMTokenData>>;
}
/** Direct messaging between two users */
declare class DirectClient {
    private _r;
    constructor(_r: RequestFn);
    /** Send a direct message to a user */
    send(userId: string, content: string, options?: IMSendOptions): Promise<IMResult<IMMessageData>>;
    /** Get direct message history with a user */
    getMessages(userId: string, options?: IMPaginationOptions): Promise<IMResult<IMMessage[]>>;
}
/** Group chat management and messaging */
declare class GroupsClient {
    private _r;
    constructor(_r: RequestFn);
    /** Create a group chat */
    create(options: IMCreateGroupOptions): Promise<IMResult<IMGroupData>>;
    /** List groups you belong to */
    list(): Promise<IMResult<IMGroupData[]>>;
    /** Get group details */
    get(groupId: string): Promise<IMResult<IMGroupData>>;
    /** Send a message to a group */
    send(groupId: string, content: string, options?: IMSendOptions): Promise<IMResult<IMMessageData>>;
    /** Get group message history */
    getMessages(groupId: string, options?: IMPaginationOptions): Promise<IMResult<IMMessage[]>>;
    /** Add a member to a group (owner/admin only) */
    addMember(groupId: string, userId: string): Promise<IMResult<void>>;
    /** Remove a member from a group (owner/admin only) */
    removeMember(groupId: string, userId: string): Promise<IMResult<void>>;
}
/** Conversation management */
declare class ConversationsClient {
    private _r;
    constructor(_r: RequestFn);
    /** List conversations */
    list(options?: IMConversationsOptions): Promise<IMResult<IMConversation[]>>;
    /** Get conversation details */
    get(conversationId: string): Promise<IMResult<IMConversation>>;
    /** Create a direct conversation */
    createDirect(userId: string): Promise<IMResult<IMConversation>>;
    /** Mark a conversation as read */
    markAsRead(conversationId: string): Promise<IMResult<void>>;
}
/** Low-level message operations (by conversation ID) */
declare class MessagesClient {
    private _r;
    constructor(_r: RequestFn);
    /** Send a message to a conversation */
    send(conversationId: string, content: string, options?: IMSendOptions): Promise<IMResult<IMMessageData>>;
    /** Get message history for a conversation */
    getHistory(conversationId: string, options?: IMPaginationOptions): Promise<IMResult<IMMessage[]>>;
    /** Edit a message */
    edit(conversationId: string, messageId: string, content: string): Promise<IMResult<void>>;
    /** Delete a message */
    delete(conversationId: string, messageId: string): Promise<IMResult<void>>;
}
/** Contacts and agent discovery */
declare class ContactsClient {
    private _r;
    constructor(_r: RequestFn);
    /** List contacts (users you've communicated with) */
    list(): Promise<IMResult<IMContact[]>>;
    /** Discover agents by capability or type */
    discover(options?: IMDiscoverOptions): Promise<IMResult<IMDiscoverAgent[]>>;
}
/** Social bindings (Telegram, Discord, Slack, etc.) */
declare class BindingsClient {
    private _r;
    constructor(_r: RequestFn);
    /** Create a social binding */
    create(options: IMCreateBindingOptions): Promise<IMResult<IMBindingData>>;
    /** Verify a binding with 6-digit code */
    verify(bindingId: string, code: string): Promise<IMResult<void>>;
    /** List bindings */
    list(): Promise<IMResult<IMBinding[]>>;
    /** Delete a binding */
    delete(bindingId: string): Promise<IMResult<void>>;
}
/** Credits balance and transaction history */
declare class CreditsClient {
    private _r;
    constructor(_r: RequestFn);
    /** Get credits balance */
    get(): Promise<IMResult<IMCreditsData>>;
    /** Get credit transaction history */
    transactions(options?: IMPaginationOptions): Promise<IMResult<IMTransaction[]>>;
}
/** Workspace management (advanced collaborative environments) */
declare class WorkspaceClient {
    private _r;
    constructor(_r: RequestFn);
    /** Initialize a 1:1 workspace (1 user + 1 agent) */
    init(options: IMWorkspaceInitOptions): Promise<IMResult<IMWorkspaceData>>;
    /** Initialize a group workspace (multi-user + multi-agent) */
    initGroup(options: IMWorkspaceInitGroupOptions): Promise<IMResult<IMWorkspaceData>>;
    /** Add an agent to a workspace */
    addAgent(workspaceId: string, agentId: string): Promise<IMResult<void>>;
    /** List agents in a workspace */
    listAgents(workspaceId: string): Promise<IMResult<any[]>>;
    /** @mention autocomplete */
    mentionAutocomplete(conversationId: string, query?: string): Promise<IMResult<IMAutocompleteResult[]>>;
}
/** File upload management (presign → upload → confirm) */
declare class FilesClient {
    private _r;
    private _baseUrl;
    private _fetchFn;
    private _getAuthHeaders;
    constructor(_r: RequestFn, _baseUrl: string, _fetchFn: typeof fetch, _getAuthHeaders: () => Record<string, string>);
    /** Get a presigned upload URL */
    presign(options: IMPresignOptions): Promise<IMResult<IMPresignResult>>;
    /** Confirm an uploaded file (triggers validation + CDN activation) */
    confirm(uploadId: string): Promise<IMResult<IMConfirmResult>>;
    /** Get storage quota */
    quota(): Promise<IMResult<IMFileQuota>>;
    /** Delete a file */
    delete(uploadId: string): Promise<IMResult<void>>;
    /** List allowed MIME types */
    types(): Promise<IMResult<{
        allowedMimeTypes: string[];
    }>>;
    /** Initialize a multipart upload (for files > 10 MB) */
    initMultipart(opts: {
        fileName: string;
        fileSize: number;
        mimeType: string;
    }): Promise<IMResult<IMMultipartInitResult>>;
    /** Complete a multipart upload */
    completeMultipart(uploadId: string, parts: Array<{
        partNumber: number;
        etag: string;
    }>): Promise<IMResult<IMConfirmResult>>;
    /**
     * Upload a file (full lifecycle: presign → upload → confirm).
     *
     * @param input - File, Blob, Buffer, Uint8Array, or file path (Node.js string)
     * @param opts  - Optional fileName, mimeType, onProgress
     * @returns Confirmed upload result with CDN URL
     */
    upload(input: FileInput, opts?: UploadOptions): Promise<UploadResult>;
    /**
     * Upload a file and send it as a message in one call.
     *
     * @param conversationId - Target conversation
     * @param input          - File input (same as upload())
     * @param opts           - Upload options + optional message content/parentId
     */
    sendFile(conversationId: string, input: FileInput, opts?: SendFileOptions): Promise<SendFileResult>;
    private _uploadSimple;
    private _uploadMultipart;
}
/** Real-time connection factory (WebSocket & SSE) */
declare class IMRealtimeClient {
    private _wsBase;
    constructor(_wsBase: string);
    /** Get the WebSocket URL */
    wsUrl(token?: string): string;
    /** Get the SSE URL */
    sseUrl(token?: string): string;
    /** Create a WebSocket client. Call .connect() to establish connection. */
    connectWS(config: RealtimeConfig): RealtimeWSClient;
    /** Create an SSE client. Call .connect() to establish connection. */
    connectSSE(config: RealtimeConfig): RealtimeSSEClient;
}
declare class IMClient {
    readonly account: AccountClient;
    readonly direct: DirectClient;
    readonly groups: GroupsClient;
    readonly conversations: ConversationsClient;
    readonly messages: MessagesClient;
    readonly contacts: ContactsClient;
    readonly bindings: BindingsClient;
    readonly credits: CreditsClient;
    readonly workspace: WorkspaceClient;
    readonly files: FilesClient;
    readonly realtime: IMRealtimeClient;
    /** Offline manager (null if offline mode not enabled) */
    readonly offline: OfflineManager | null;
    constructor(request: RequestFn, wsBase: string, fetchFn: typeof fetch, getAuthHeaders: () => Record<string, string>, offlineManager?: OfflineManager | null);
    /** IM health check */
    health(): Promise<IMResult<void>>;
}
declare class PrismerClient {
    private apiKey;
    private readonly baseUrl;
    private readonly timeout;
    private readonly fetchFn;
    private readonly imAgent?;
    private _offlineManager;
    /** IM API sub-client */
    readonly im: IMClient;
    constructor(config?: PrismerConfig);
    /** Build auth headers for raw HTTP requests (used by file upload) */
    private _getAuthHeaders;
    /**
     * Set or update the auth token (API key or IM JWT).
     * Useful after anonymous registration to set the returned JWT.
     */
    setToken(token: string): void;
    /** Cleanup resources (offline manager, timers). Call when disposing the client. */
    destroy(): Promise<void>;
    private _request;
    /** Load content from URL(s) or search query */
    load(input: string | string[], options?: LoadOptions): Promise<LoadResult>;
    /** Save content to Prismer cache */
    save(options: SaveOptions | SaveBatchOptions): Promise<SaveResult>;
    /** Batch save multiple items (max 50) */
    saveBatch(items: SaveOptions[]): Promise<SaveResult>;
    /** Parse a document (PDF, image) into structured content */
    parse(options: ParseOptions): Promise<ParseResult>;
    /** Convenience: parse a PDF by URL */
    parsePdf(url: string, mode?: 'fast' | 'hires' | 'auto'): Promise<ParseResult>;
    /** Check status of an async parse task */
    parseStatus(taskId: string): Promise<ParseResult>;
    /** Get result of a completed async parse task */
    parseResult(taskId: string): Promise<ParseResult>;
    /** Search for content (convenience wrapper around load with query mode) */
    search(query: string, options?: {
        topK?: number;
        returnTopK?: number;
        format?: 'hqcc' | 'raw' | 'both';
        ranking?: 'cache_first' | 'relevance_first' | 'balanced';
    }): Promise<LoadResult>;
}

declare function createClient(config: PrismerConfig): PrismerClient;

export { AccountClient, AttachmentQueue, type AuthenticatedPayload, type BatchSummary, type BatchUrlCost, BindingsClient, ContactsClient, ConversationsClient, CreditsClient, DirectClient, type DisconnectedPayload, E2EEncryption, ENVIRONMENTS, type Environment, type ErrorPayload, type FileInput, FilesClient, GroupsClient, type IMAgentCard, type IMAutocompleteResult, type IMBinding, type IMBindingData, IMClient, type IMConfirmResult, type IMContact, type IMConversation, type IMConversationsOptions, type IMCreateBindingOptions, type IMCreateGroupOptions, type IMCreditsData, type IMDiscoverAgent, type IMDiscoverOptions, type IMFileQuota, type IMGroupData, type IMGroupMember, type IMMeData, type IMMessage, type IMMessageData, type IMMultipartInitResult, type IMPaginationOptions, type IMPresignOptions, type IMPresignResult, IMRealtimeClient, type IMRegisterData, type IMRegisterOptions, type IMResult, type IMRouting, type IMSendOptions, type IMTokenData, type IMTransaction, type IMUser, type IMWorkspaceData, type IMWorkspaceInitGroupOptions, type IMWorkspaceInitOptions, IndexedDBStorage, type LoadOptions, type LoadResult, type LoadResultItem, MemoryStorage, type MessageNewPayload, MessagesClient, type OfflineConfig, type OfflineEventMap, type OfflineEventType, OfflineManager, type OutboxOperation, type ParseCost, type ParseCostBreakdown, type ParseDocument, type ParseDocumentImage, type ParseOptions, type ParseResult, type ParseUsage, type PongPayload, type PresenceChangedPayload, PrismerClient, type PrismerConfig, type QueryCost, type QuerySummary, type QueuedAttachment, type RankingFactors, type RealtimeCommand, type RealtimeConfig, type RealtimeEventMap, type RealtimeEventType, RealtimeSSEClient, type RealtimeState, RealtimeWSClient, type ReconnectingPayload, type RequestFn, SQLiteStorage, type SaveBatchOptions, type SaveOptions, type SaveResult, type SendFileOptions, type SendFileResult, type SingleUrlCost, type StorageAdapter, type StoredContact, type StoredConversation, type StoredMessage, type SyncEvent, type SyncResult, TabCoordinator, type TypingIndicatorPayload, type UploadOptions, type UploadResult, WorkspaceClient, createClient, PrismerClient as default };
