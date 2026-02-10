/**
 * Prismer Cloud SDK — Type definitions
 */

// ============================================================================
// Environment
// ============================================================================

export type Environment = 'production';

export const ENVIRONMENTS: Record<Environment, string> = {
  production: 'https://prismer.cloud',
} as const;

// ============================================================================
// Config
// ============================================================================

export interface PrismerConfig {
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
}

// ============================================================================
// Context API Types
// ============================================================================

export interface LoadOptions {
  inputType?: 'auto' | 'url' | 'urls' | 'query';
  processUncached?: boolean;
  search?: { topK?: number };
  processing?: { strategy?: 'auto' | 'fast' | 'quality'; maxConcurrent?: number };
  return?: { format?: 'hqcc' | 'raw' | 'both'; topK?: number };
  ranking?: {
    preset?: 'cache_first' | 'relevance_first' | 'balanced';
    custom?: { cacheHit?: number; relevance?: number; freshness?: number; quality?: number };
  };
}

export interface RankingFactors {
  cache: number;
  relevance: number;
  freshness: number;
  quality: number;
}

export interface LoadResultItem {
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
  ranking?: { score: number; factors: RankingFactors };
  meta?: Record<string, any>;
}

export interface SingleUrlCost { credits: number; cached: boolean }
export interface BatchUrlCost { credits: number; cached: number }
export interface QueryCost { searchCredits: number; compressionCredits: number; totalCredits: number; savedByCache: number }

export interface BatchSummary { total: number; found: number; notFound: number; cached: number; processed: number }
export interface QuerySummary { query: string; searched: number; cacheHits: number; compressed: number; returned: number }

export interface LoadResult {
  success: boolean;
  requestId?: string;
  mode?: 'single_url' | 'batch_urls' | 'query';
  result?: LoadResultItem;
  results?: LoadResultItem[];
  summary?: BatchSummary | QuerySummary;
  cost?: SingleUrlCost | BatchUrlCost | QueryCost;
  processingTime?: number;
  error?: { code: string; message: string };
}

export interface SaveOptions {
  url: string;
  hqcc: string;
  raw?: string;
  meta?: Record<string, any>;
}

export interface SaveBatchOptions {
  items: SaveOptions[];
}

export interface SaveResult {
  success: boolean;
  status?: string;
  url?: string;
  results?: Array<{ url: string; status: string }>;
  summary?: { total: number; created: number; exists: number };
  error?: { code: string; message: string };
}

// ============================================================================
// Parse API Types
// ============================================================================

export interface ParseOptions {
  url?: string;
  base64?: string;
  filename?: string;
  mode?: 'fast' | 'hires' | 'auto';
  output?: 'markdown' | 'json';
  image_mode?: 'embedded' | 's3';
  wait?: boolean;
}

export interface ParseDocumentImage {
  page: number;
  url: string;
  caption?: string;
}

export interface ParseDocument {
  markdown?: string;
  text?: string;
  pageCount: number;
  metadata?: { title?: string; author?: string; [key: string]: any };
  images?: ParseDocumentImage[];
  estimatedTime?: number;
}

export interface ParseUsage {
  inputPages: number;
  inputImages: number;
  outputChars: number;
  outputTokens: number;
}

export interface ParseCostBreakdown {
  pages: number;
  images: number;
}

export interface ParseCost {
  credits: number;
  breakdown?: ParseCostBreakdown;
}

export interface ParseResult {
  success: boolean;
  requestId?: string;
  mode?: string;
  async?: boolean;
  document?: ParseDocument;
  usage?: ParseUsage;
  cost?: ParseCost;
  taskId?: string;
  status?: string;
  endpoints?: { status: string; result: string; stream: string };
  processingTime?: number;
  error?: { code: string; message: string };
}

// ============================================================================
// IM API Types
// ============================================================================

export interface IMRegisterOptions {
  type: 'agent' | 'human';
  username: string;
  displayName: string;
  agentType?: 'assistant' | 'specialist' | 'orchestrator' | 'tool' | 'bot';
  capabilities?: string[];
  description?: string;
  endpoint?: string;
}

export interface IMRegisterData {
  imUserId: string;
  username: string;
  displayName: string;
  role: string;
  token: string;
  expiresIn: string;
  capabilities?: string[];
  isNew: boolean;
}

export interface IMUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  agentType?: string;
}

export interface IMAgentCard {
  agentType: string;
  capabilities: string[];
  description?: string;
  status: string;
}

export interface IMMeData {
  user: IMUser;
  agentCard?: IMAgentCard;
  stats: { conversationCount: number; directCount?: number; groupCount?: number; contactCount: number; messagesSent: number; unreadCount: number };
  bindings: Array<{ platform: string; status: string; externalName?: string }>;
  credits: { balance: number; totalSpent: number };
}

export interface IMTokenData {
  token: string;
  expiresIn: string;
}

export interface IMMessage {
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

export interface IMRouting {
  mode: string;
  targets: Array<{ userId: string; username?: string }>;
}

export interface IMMessageData {
  conversationId: string;
  message: IMMessage;
  routing?: IMRouting;
}

export interface IMGroupMember {
  userId: string;
  username: string;
  displayName?: string;
  role: string;
}

export interface IMGroupData {
  groupId: string;
  title: string;
  description?: string;
  members: IMGroupMember[];
}

export interface IMContact {
  username: string;
  displayName: string;
  role: string;
  lastMessageAt?: string;
  unreadCount: number;
  conversationId: string;
}

export interface IMDiscoverAgent {
  username: string;
  displayName: string;
  agentType?: string;
  capabilities?: string[];
  status: string;
}

export interface IMBindingData {
  bindingId: string;
  platform: string;
  status: string;
  verificationCode: string;
}

export interface IMBinding {
  bindingId: string;
  platform: string;
  status: string;
  externalName?: string;
}

export interface IMCreditsData {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface IMTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface IMConversation {
  id: string;
  type: string;
  title?: string;
  lastMessage?: IMMessage;
  unreadCount?: number;
  members?: IMGroupMember[];
  createdAt: string;
  updatedAt?: string;
}

export interface IMWorkspaceData {
  workspaceId?: string;
  conversationId: string;
  user?: { imUserId: string; token: string };
  agent?: any;
}

export interface IMWorkspaceInitOptions {
  workspaceId: string;
  userId: string;
  userDisplayName: string;
}

export interface IMWorkspaceInitGroupOptions {
  workspaceId: string;
  title: string;
  users: Array<{ userId: string; displayName: string }>;
}

export interface IMAutocompleteResult {
  userId: string;
  username: string;
  displayName: string;
  role: string;
}

export interface IMCreateGroupOptions {
  title: string;
  description?: string;
  members?: string[];
  metadata?: Record<string, any>;
}

export interface IMCreateBindingOptions {
  platform: 'telegram' | 'discord' | 'slack' | 'wechat' | 'x' | 'line';
  botToken: string;
  chatId?: string;
  channelId?: string;
}

export interface IMSendOptions {
  type?: 'text' | 'markdown' | 'code' | 'image' | 'file' | 'tool_call' | 'tool_result' | 'system_event' | 'thinking';
  metadata?: Record<string, any>;
  parentId?: string;
}

export interface IMPaginationOptions {
  limit?: number;
  offset?: number;
}

export interface IMConversationsOptions {
  withUnread?: boolean;
  unreadOnly?: boolean;
}

export interface IMDiscoverOptions {
  type?: string;
  capability?: string;
}

/** Generic IM API response wrapper */
export interface IMResult<T = any> {
  ok: boolean;
  data?: T;
  meta?: { total?: number; pageSize?: number };
  error?: { code: string; message: string };
}

/** Internal request function type */
export type RequestFn = <T>(method: string, path: string, body?: unknown, query?: Record<string, string>) => Promise<T>;
