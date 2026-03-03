/**
 * Session Store
 *
 * 会话状态持久化存储
 * 支持内存 + JSON 文件持久化
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SessionState, AgentState } from '../src/lib/sync/types';

// ============================================================
// Types
// ============================================================

export interface SessionStoreConfig {
  /** 数据存储目录 */
  dataDir: string;
  /** 自动保存间隔 (ms)，0 表示禁用 */
  autoSaveInterval: number;
  /** 最大快照数量 */
  maxSnapshots: number;
  /** 最大时间线事件数量 */
  maxTimelineEvents: number;
  /** 是否启用调试日志 */
  debug: boolean;
}

export interface StoredSession extends SessionState {
  /** 存储版本 */
  _version: string;
  /** 最后持久化时间 */
  _lastPersistedAt: number;
}

// ============================================================
// Default Config
// ============================================================

const DEFAULT_CONFIG: SessionStoreConfig = {
  dataDir: path.join(process.cwd(), 'data', 'sessions'),
  autoSaveInterval: 30000, // 30 秒
  maxSnapshots: 100,
  maxTimelineEvents: 1000,
  debug: process.env.NODE_ENV === 'development',
};

// ============================================================
// Session Store Implementation
// ============================================================

export class SessionStore {
  private config: SessionStoreConfig;
  private sessions: Map<string, SessionState> = new Map();
  private dirty: Set<string> = new Set(); // 需要持久化的会话
  private autoSaveTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<SessionStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureDataDir();
    
    if (this.config.autoSaveInterval > 0) {
      this.startAutoSave();
    }
  }

  // ==================== 基础操作 ====================

  /**
   * 获取会话
   */
  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取或创建会话
   */
  getOrCreate(sessionId: string, initialState?: Partial<SessionState>): SessionState {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // 尝试从文件加载
      session = this.loadFromFile(sessionId) ?? undefined;
      
      if (!session) {
        // 创建新会话
        session = this.createSession(sessionId, initialState);
        this.log(`Created new session: ${sessionId}`);
      } else {
        this.log(`Loaded session from file: ${sessionId}`);
      }
      
      this.sessions.set(sessionId, session);
    }
    
    return session;
  }

  /**
   * 保存会话到内存
   */
  save(session: SessionState): void {
    session.updatedAt = Date.now();
    this.sessions.set(session.sessionId, session);
    this.dirty.add(session.sessionId);
  }

  /**
   * 删除会话
   */
  delete(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    this.dirty.delete(sessionId);
    
    // 删除文件
    const filePath = this.getFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.log(`Deleted session file: ${sessionId}`);
    }
    
    return deleted;
  }

  /**
   * 获取所有会话 ID
   */
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * 会话是否存在
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId) || fs.existsSync(this.getFilePath(sessionId));
  }

  // ==================== 状态更新 ====================

  /**
   * 添加消息
   */
  addMessage(sessionId: string, message: unknown): void {
    const session = this.get(sessionId);
    if (!session) return;

    session.messages.push(message);
    session.updatedAt = Date.now();
    this.dirty.add(sessionId);
  }

  /**
   * 更新任务
   */
  setTasks(sessionId: string, tasks: unknown[]): void {
    const session = this.get(sessionId);
    if (!session) return;

    session.tasks = tasks;
    session.updatedAt = Date.now();
    this.dirty.add(sessionId);
  }

  /**
   * 添加已完成交互
   */
  addCompletedInteraction(sessionId: string, componentId: string): void {
    const session = this.get(sessionId);
    if (!session) return;

    if (!session.completedInteractions.includes(componentId)) {
      session.completedInteractions.push(componentId);
      session.updatedAt = Date.now();
      this.dirty.add(sessionId);
    }
  }

  /**
   * 添加时间线事件
   */
  addTimelineEvent(sessionId: string, event: unknown): void {
    const session = this.get(sessionId);
    if (!session) return;

    session.timeline.push(event);
    
    // 限制时间线事件数量
    if (session.timeline.length > this.config.maxTimelineEvents) {
      session.timeline = session.timeline.slice(-this.config.maxTimelineEvents);
    }
    
    session.updatedAt = Date.now();
    this.dirty.add(sessionId);
  }

  /**
   * 添加状态快照
   */
  addStateSnapshot(sessionId: string, snapshot: unknown): void {
    const session = this.get(sessionId);
    if (!session) return;

    session.stateSnapshots.push(snapshot);
    
    // 限制快照数量
    if (session.stateSnapshots.length > this.config.maxSnapshots) {
      session.stateSnapshots = session.stateSnapshots.slice(-this.config.maxSnapshots);
    }
    
    session.updatedAt = Date.now();
    this.dirty.add(sessionId);
  }

  /**
   * 更新组件状态
   */
  updateComponentState(sessionId: string, component: string, state: unknown): void {
    const session = this.get(sessionId);
    if (!session) return;

    session.componentStates[component] = state;
    session.updatedAt = Date.now();
    this.dirty.add(sessionId);
  }

  /**
   * 更新 Agent 状态
   */
  updateAgentState(sessionId: string, agentState: Partial<AgentState>): void {
    const session = this.get(sessionId);
    if (!session) return;

    session.agentState = { ...session.agentState, ...agentState };
    session.updatedAt = Date.now();
    this.dirty.add(sessionId);
  }

  // ==================== 持久化 ====================

  /**
   * 持久化所有脏数据
   */
  async persistAll(): Promise<void> {
    const dirtyIds = Array.from(this.dirty);
    
    for (const sessionId of dirtyIds) {
      await this.persist(sessionId);
    }
    
    if (dirtyIds.length > 0) {
      this.log(`Persisted ${dirtyIds.length} session(s)`);
    }
  }

  /**
   * 持久化单个会话
   */
  async persist(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const stored: StoredSession = {
      ...session,
      _version: '1.0.0',
      _lastPersistedAt: Date.now(),
    };

    const filePath = this.getFilePath(sessionId);
    const content = JSON.stringify(stored, null, 2);
    
    await fs.promises.writeFile(filePath, content, 'utf-8');
    this.dirty.delete(sessionId);
    
    this.log(`Persisted session: ${sessionId}`);
  }

  /**
   * 从文件加载会话
   */
  loadFromFile(sessionId: string): SessionState | null {
    const filePath = this.getFilePath(sessionId);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stored: StoredSession = JSON.parse(content);
      
      // 移除存储元数据
      const { _version, _lastPersistedAt, ...session } = stored;
      
      return session as SessionState;
    } catch (err) {
      console.error(`[SessionStore] Failed to load session ${sessionId}:`, err);
      return null;
    }
  }

  /**
   * 加载所有持久化的会话
   */
  loadAll(): void {
    if (!fs.existsSync(this.config.dataDir)) {
      return;
    }

    const files = fs.readdirSync(this.config.dataDir)
      .filter(f => f.endsWith('.json'));

    for (const file of files) {
      const sessionId = path.basename(file, '.json');
      const session = this.loadFromFile(sessionId);
      
      if (session) {
        this.sessions.set(sessionId, session);
        this.log(`Loaded session: ${sessionId}`);
      }
    }
    
    this.log(`Loaded ${this.sessions.size} session(s) from disk`);
  }

  // ==================== 生命周期 ====================

  /**
   * 启动自动保存
   */
  startAutoSave(): void {
    if (this.autoSaveTimer) {
      return;
    }

    this.autoSaveTimer = setInterval(() => {
      this.persistAll().catch(err => {
        console.error('[SessionStore] Auto-save failed:', err);
      });
    }, this.config.autoSaveInterval);
    
    this.log(`Auto-save started (interval: ${this.config.autoSaveInterval}ms)`);
  }

  /**
   * 停止自动保存
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      this.log('Auto-save stopped');
    }
  }

  /**
   * 关闭存储（保存所有数据）
   */
  async close(): Promise<void> {
    this.stopAutoSave();
    await this.persistAll();
    this.log('Session store closed');
  }

  // ==================== 工具方法 ====================

  private createSession(sessionId: string, initialState?: Partial<SessionState>): SessionState {
    const now = Date.now();
    
    return {
      sessionId,
      messages: [],
      tasks: [],
      participants: [],
      completedInteractions: [],
      timeline: [],
      stateSnapshots: [],
      componentStates: {},
      agentState: {
        status: 'idle',
        currentStep: 0,
        totalSteps: 0,
      },
      createdAt: now,
      updatedAt: now,
      ...initialState,
    };
  }

  private getFilePath(sessionId: string): string {
    // 确保 sessionId 安全用于文件名
    const safeId = sessionId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.config.dataDir, `${safeId}.json`);
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
      this.log(`Created data directory: ${this.config.dataDir}`);
    }
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[SessionStore] ${message}`);
    }
  }
}

// ============================================================
// Factory Functions
// ============================================================

/**
 * 创建会话存储
 */
export function createSessionStore(config?: Partial<SessionStoreConfig>): SessionStore {
  return new SessionStore(config);
}

/**
 * 创建内存会话存储（不持久化）
 */
export function createMemoryStore(): SessionStore {
  return new SessionStore({
    autoSaveInterval: 0,
    dataDir: '/tmp/pisa-sessions',
  });
}
