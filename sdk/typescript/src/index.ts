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

import { RealtimeWSClient, RealtimeSSEClient } from './realtime';
import type { RealtimeConfig } from './realtime';

// Re-export all types
export * from './types';
export {
  RealtimeWSClient,
  RealtimeSSEClient,
  type RealtimeConfig,
  type RealtimeState,
  type RealtimeCommand,
  type RealtimeEventMap,
  type RealtimeEventType,
  type AuthenticatedPayload,
  type MessageNewPayload,
  type TypingIndicatorPayload,
  type PresenceChangedPayload,
  type PongPayload,
  type ErrorPayload,
  type DisconnectedPayload,
  type ReconnectingPayload,
} from './realtime';

import type {
  PrismerConfig,
  Environment,
  LoadOptions,
  LoadResult,
  SaveOptions,
  SaveBatchOptions,
  SaveResult,
  ParseOptions,
  ParseResult,
  IMRegisterOptions,
  IMRegisterData,
  IMMeData,
  IMTokenData,
  IMSendOptions,
  IMMessageData,
  IMPaginationOptions,
  IMMessage,
  IMCreateGroupOptions,
  IMGroupData,
  IMConversationsOptions,
  IMConversation,
  IMContact,
  IMDiscoverOptions,
  IMDiscoverAgent,
  IMCreateBindingOptions,
  IMBindingData,
  IMBinding,
  IMCreditsData,
  IMTransaction,
  IMWorkspaceData,
  IMAutocompleteResult,
  IMResult,
  RequestFn,
} from './types';

import { ENVIRONMENTS } from './types';

// ============================================================================
// IM Sub-Clients
// ============================================================================

/** Account management: register, identity, token refresh */
export class AccountClient {
  constructor(private _r: RequestFn) {}

  /** Register an agent or human identity */
  async register(options: IMRegisterOptions): Promise<IMResult<IMRegisterData>> {
    return this._r('POST', '/api/im/register', options);
  }

  /** Get own identity, stats, bindings, credits */
  async me(): Promise<IMResult<IMMeData>> {
    return this._r('GET', '/api/im/me');
  }

  /** Refresh JWT token */
  async refreshToken(): Promise<IMResult<IMTokenData>> {
    return this._r('POST', '/api/im/token/refresh');
  }
}

/** Direct messaging between two users */
export class DirectClient {
  constructor(private _r: RequestFn) {}

  /** Send a direct message to a user */
  async send(userId: string, content: string, options?: IMSendOptions): Promise<IMResult<IMMessageData>> {
    return this._r('POST', `/api/im/direct/${userId}/messages`, {
      content,
      type: options?.type ?? 'text',
      metadata: options?.metadata,
      parentId: options?.parentId,
    });
  }

  /** Get direct message history with a user */
  async getMessages(userId: string, options?: IMPaginationOptions): Promise<IMResult<IMMessage[]>> {
    const query: Record<string, string> = {};
    if (options?.limit) query.limit = String(options.limit);
    if (options?.offset) query.offset = String(options.offset);
    return this._r('GET', `/api/im/direct/${userId}/messages`, undefined, query);
  }
}

/** Group chat management and messaging */
export class GroupsClient {
  constructor(private _r: RequestFn) {}

  /** Create a group chat */
  async create(options: IMCreateGroupOptions): Promise<IMResult<IMGroupData>> {
    return this._r('POST', '/api/im/groups', options);
  }

  /** List groups you belong to */
  async list(): Promise<IMResult<IMGroupData[]>> {
    return this._r('GET', '/api/im/groups');
  }

  /** Get group details */
  async get(groupId: string): Promise<IMResult<IMGroupData>> {
    return this._r('GET', `/api/im/groups/${groupId}`);
  }

  /** Send a message to a group */
  async send(groupId: string, content: string, options?: IMSendOptions): Promise<IMResult<IMMessageData>> {
    return this._r('POST', `/api/im/groups/${groupId}/messages`, {
      content,
      type: options?.type ?? 'text',
      metadata: options?.metadata,
      parentId: options?.parentId,
    });
  }

  /** Get group message history */
  async getMessages(groupId: string, options?: IMPaginationOptions): Promise<IMResult<IMMessage[]>> {
    const query: Record<string, string> = {};
    if (options?.limit) query.limit = String(options.limit);
    if (options?.offset) query.offset = String(options.offset);
    return this._r('GET', `/api/im/groups/${groupId}/messages`, undefined, query);
  }

  /** Add a member to a group (owner/admin only) */
  async addMember(groupId: string, userId: string): Promise<IMResult<void>> {
    return this._r('POST', `/api/im/groups/${groupId}/members`, { userId });
  }

  /** Remove a member from a group (owner/admin only) */
  async removeMember(groupId: string, userId: string): Promise<IMResult<void>> {
    return this._r('DELETE', `/api/im/groups/${groupId}/members/${userId}`);
  }
}

/** Conversation management */
export class ConversationsClient {
  constructor(private _r: RequestFn) {}

  /** List conversations */
  async list(options?: IMConversationsOptions): Promise<IMResult<IMConversation[]>> {
    const query: Record<string, string> = {};
    if (options?.withUnread) query.withUnread = 'true';
    if (options?.unreadOnly) query.unreadOnly = 'true';
    return this._r('GET', '/api/im/conversations', undefined, query);
  }

  /** Get conversation details */
  async get(conversationId: string): Promise<IMResult<IMConversation>> {
    return this._r('GET', `/api/im/conversations/${conversationId}`);
  }

  /** Create a direct conversation */
  async createDirect(userId: string): Promise<IMResult<IMConversation>> {
    return this._r('POST', '/api/im/conversations/direct', { userId });
  }

  /** Mark a conversation as read */
  async markAsRead(conversationId: string): Promise<IMResult<void>> {
    return this._r('POST', `/api/im/conversations/${conversationId}/read`);
  }
}

/** Low-level message operations (by conversation ID) */
export class MessagesClient {
  constructor(private _r: RequestFn) {}

  /** Send a message to a conversation */
  async send(conversationId: string, content: string, options?: IMSendOptions): Promise<IMResult<IMMessageData>> {
    return this._r('POST', `/api/im/messages/${conversationId}`, {
      content,
      type: options?.type ?? 'text',
      metadata: options?.metadata,
      parentId: options?.parentId,
    });
  }

  /** Get message history for a conversation */
  async getHistory(conversationId: string, options?: IMPaginationOptions): Promise<IMResult<IMMessage[]>> {
    const query: Record<string, string> = {};
    if (options?.limit) query.limit = String(options.limit);
    if (options?.offset) query.offset = String(options.offset);
    return this._r('GET', `/api/im/messages/${conversationId}`, undefined, query);
  }

  /** Edit a message */
  async edit(conversationId: string, messageId: string, content: string): Promise<IMResult<void>> {
    return this._r('PATCH', `/api/im/messages/${conversationId}/${messageId}`, { content });
  }

  /** Delete a message */
  async delete(conversationId: string, messageId: string): Promise<IMResult<void>> {
    return this._r('DELETE', `/api/im/messages/${conversationId}/${messageId}`);
  }
}

/** Contacts and agent discovery */
export class ContactsClient {
  constructor(private _r: RequestFn) {}

  /** List contacts (users you've communicated with) */
  async list(): Promise<IMResult<IMContact[]>> {
    return this._r('GET', '/api/im/contacts');
  }

  /** Discover agents by capability or type */
  async discover(options?: IMDiscoverOptions): Promise<IMResult<IMDiscoverAgent[]>> {
    const query: Record<string, string> = {};
    if (options?.type) query.type = options.type;
    if (options?.capability) query.capability = options.capability;
    return this._r('GET', '/api/im/discover', undefined, query);
  }
}

/** Social bindings (Telegram, Discord, Slack, etc.) */
export class BindingsClient {
  constructor(private _r: RequestFn) {}

  /** Create a social binding */
  async create(options: IMCreateBindingOptions): Promise<IMResult<IMBindingData>> {
    return this._r('POST', '/api/im/bindings', options);
  }

  /** Verify a binding with 6-digit code */
  async verify(bindingId: string, code: string): Promise<IMResult<void>> {
    return this._r('POST', `/api/im/bindings/${bindingId}/verify`, { code });
  }

  /** List bindings */
  async list(): Promise<IMResult<IMBinding[]>> {
    return this._r('GET', '/api/im/bindings');
  }

  /** Delete a binding */
  async delete(bindingId: string): Promise<IMResult<void>> {
    return this._r('DELETE', `/api/im/bindings/${bindingId}`);
  }
}

/** Credits balance and transaction history */
export class CreditsClient {
  constructor(private _r: RequestFn) {}

  /** Get credits balance */
  async get(): Promise<IMResult<IMCreditsData>> {
    return this._r('GET', '/api/im/credits');
  }

  /** Get credit transaction history */
  async transactions(options?: IMPaginationOptions): Promise<IMResult<IMTransaction[]>> {
    const query: Record<string, string> = {};
    if (options?.limit) query.limit = String(options.limit);
    if (options?.offset) query.offset = String(options.offset);
    return this._r('GET', '/api/im/credits/transactions', undefined, query);
  }
}

/** Workspace management (advanced collaborative environments) */
export class WorkspaceClient {
  constructor(private _r: RequestFn) {}

  /** Initialize a 1:1 workspace (1 user + 1 agent) */
  async init(): Promise<IMResult<IMWorkspaceData>> {
    return this._r('POST', '/api/im/workspace/init');
  }

  /** Initialize a group workspace (multi-user + multi-agent) */
  async initGroup(): Promise<IMResult<IMWorkspaceData>> {
    return this._r('POST', '/api/im/workspace/init-group');
  }

  /** Add an agent to a workspace */
  async addAgent(workspaceId: string, agentId: string): Promise<IMResult<void>> {
    return this._r('POST', `/api/im/workspace/${workspaceId}/agents`, { agentId });
  }

  /** List agents in a workspace */
  async listAgents(workspaceId: string): Promise<IMResult<any[]>> {
    return this._r('GET', `/api/im/workspace/${workspaceId}/agents`);
  }

  /** @mention autocomplete */
  async mentionAutocomplete(query?: string): Promise<IMResult<IMAutocompleteResult[]>> {
    const q: Record<string, string> = {};
    if (query) q.q = query;
    return this._r('GET', '/api/im/workspace/mentions/autocomplete', undefined, q);
  }
}

/** Real-time connection factory (WebSocket & SSE) */
export class IMRealtimeClient {
  constructor(private _wsBase: string) {}

  /** Get the WebSocket URL */
  wsUrl(token?: string): string {
    const base = this._wsBase.replace(/^http/, 'ws');
    return token ? `${base}/ws?token=${token}` : `${base}/ws`;
  }

  /** Get the SSE URL */
  sseUrl(token?: string): string {
    return token ? `${this._wsBase}/sse?token=${token}` : `${this._wsBase}/sse`;
  }

  /** Create a WebSocket client. Call .connect() to establish connection. */
  connectWS(config: RealtimeConfig): RealtimeWSClient {
    return new RealtimeWSClient(this._wsBase, config);
  }

  /** Create an SSE client. Call .connect() to establish connection. */
  connectSSE(config: RealtimeConfig): RealtimeSSEClient {
    return new RealtimeSSEClient(this._wsBase, config);
  }
}

// ============================================================================
// IM Client (orchestrates sub-modules)
// ============================================================================

export class IMClient {
  readonly account: AccountClient;
  readonly direct: DirectClient;
  readonly groups: GroupsClient;
  readonly conversations: ConversationsClient;
  readonly messages: MessagesClient;
  readonly contacts: ContactsClient;
  readonly bindings: BindingsClient;
  readonly credits: CreditsClient;
  readonly workspace: WorkspaceClient;
  readonly realtime: IMRealtimeClient;

  constructor(request: RequestFn, wsBase: string) {
    this.account = new AccountClient(request);
    this.direct = new DirectClient(request);
    this.groups = new GroupsClient(request);
    this.conversations = new ConversationsClient(request);
    this.messages = new MessagesClient(request);
    this.contacts = new ContactsClient(request);
    this.bindings = new BindingsClient(request);
    this.credits = new CreditsClient(request);
    this.workspace = new WorkspaceClient(request);
    this.realtime = new IMRealtimeClient(wsBase);
  }

  /** IM health check */
  async health(): Promise<IMResult<void>> {
    return this.account['_r']('GET', '/api/im/health');
  }
}

// ============================================================================
// Prismer Client
// ============================================================================

export class PrismerClient {
  private apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly fetchFn: typeof fetch;
  private readonly imAgent?: string;

  /** IM API sub-client */
  readonly im: IMClient;

  constructor(config: PrismerConfig = {}) {
    if (config.apiKey && !config.apiKey.startsWith('sk-prismer-') && !config.apiKey.startsWith('eyJ')) {
      console.warn('Warning: API key should start with "sk-prismer-" (or "eyJ" for IM JWT)');
    }

    this.apiKey = config.apiKey || '';
    const envUrl = ENVIRONMENTS[config.environment || 'production'];
    this.baseUrl = (config.baseUrl || envUrl).replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
    this.fetchFn = config.fetch || fetch;
    this.imAgent = config.imAgent;

    this.im = new IMClient(
      (method, path, body, query) => this._request(method, path, body, query),
      this.baseUrl,
    );
  }

  /**
   * Set or update the auth token (API key or IM JWT).
   * Useful after anonymous registration to set the returned JWT.
   */
  setToken(token: string): void {
    this.apiKey = token;
  }

  // --------------------------------------------------------------------------
  // Internal request helper
  // --------------------------------------------------------------------------

  private async _request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      let url = `${this.baseUrl}${path}`;
      if (query && Object.keys(query).length > 0) {
        url += '?' + new URLSearchParams(query).toString();
      }

      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      if (this.imAgent) {
        headers['X-IM-Agent'] = this.imAgent;
      }

      const init: RequestInit = { method, headers, signal: controller.signal };

      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }

      const response = await this.fetchFn(url, init);
      const data = await response.json();

      if (!response.ok) {
        const err = data.error || { code: 'HTTP_ERROR', message: `Request failed with status ${response.status}` };
        return { ...data, success: false, ok: false, error: err } as T;
      }

      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, ok: false, error: { code: 'TIMEOUT', message: 'Request timed out' } } as T;
      }
      return {
        success: false,
        ok: false,
        error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
      } as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // --------------------------------------------------------------------------
  // Context API
  // --------------------------------------------------------------------------

  /** Load content from URL(s) or search query */
  async load(input: string | string[], options: LoadOptions = {}): Promise<LoadResult> {
    return this._request('POST', '/api/context/load', {
      input,
      inputType: options.inputType,
      processUncached: options.processUncached,
      search: options.search,
      processing: options.processing,
      return: options.return,
      ranking: options.ranking,
    });
  }

  /** Save content to Prismer cache */
  async save(options: SaveOptions | SaveBatchOptions): Promise<SaveResult> {
    return this._request('POST', '/api/context/save', options);
  }

  /** Batch save multiple items (max 50) */
  async saveBatch(items: SaveOptions[]): Promise<SaveResult> {
    return this.save({ items });
  }

  // --------------------------------------------------------------------------
  // Parse API
  // --------------------------------------------------------------------------

  /** Parse a document (PDF, image) into structured content */
  async parse(options: ParseOptions): Promise<ParseResult> {
    return this._request('POST', '/api/parse', options);
  }

  /** Convenience: parse a PDF by URL */
  async parsePdf(url: string, mode: 'fast' | 'hires' | 'auto' = 'fast'): Promise<ParseResult> {
    return this.parse({ url, mode });
  }

  /** Check status of an async parse task */
  async parseStatus(taskId: string): Promise<ParseResult> {
    return this._request('GET', `/api/parse/status/${taskId}`);
  }

  /** Get result of a completed async parse task */
  async parseResult(taskId: string): Promise<ParseResult> {
    return this._request('GET', `/api/parse/result/${taskId}`);
  }

  // --------------------------------------------------------------------------
  // Convenience
  // --------------------------------------------------------------------------

  /** Search for content (convenience wrapper around load with query mode) */
  async search(
    query: string,
    options?: { topK?: number; returnTopK?: number; format?: 'hqcc' | 'raw' | 'both'; ranking?: 'cache_first' | 'relevance_first' | 'balanced' },
  ): Promise<LoadResult> {
    return this.load(query, {
      inputType: 'query',
      search: options?.topK ? { topK: options.topK } : undefined,
      return: (options?.returnTopK || options?.format)
        ? { topK: options?.returnTopK, format: options?.format }
        : undefined,
      ranking: options?.ranking ? { preset: options.ranking } : undefined,
    });
  }
}

export default PrismerClient;

export function createClient(config: PrismerConfig): PrismerClient {
  return new PrismerClient(config);
}
