/**
 * User Storage Manager
 * 
 * 管理用户级别的存储隔离
 * - 跟踪当前登录用户
 * - 管理存储 key 前缀
 * - 登录/登出时的数据清理和切换
 * - 事件通知机制
 */

// ============================================================================
// Constants
// ============================================================================

const GUEST_PREFIX = 'guest';
const USER_PREFIX = 'user';

// 需要用户隔离的 localStorage keys
export const USER_ISOLATED_STORAGE_KEYS = [
  'reader-store',
  'chat-session-storage',
  'notebook-storage',
  'insight-storage',
  'ai-store',
  'prismer-collections',
  'pdf-store',
  'citation-store',
] as const;

// IndexedDB 数据库名
export const INDEXED_DB_NAME = 'pisa_reader_db';

// ============================================================================
// Types
// ============================================================================

export type UserStorageEvent = 
  | { type: 'login'; userId: string }
  | { type: 'logout' }
  | { type: 'switch'; fromUserId: string | null; toUserId: string };

export type UserStorageEventHandler = (event: UserStorageEvent) => void | Promise<void>;

// ============================================================================
// User Storage Manager
// ============================================================================

class UserStorageManager {
  private currentUserId: string | null = null;
  private eventHandlers: Set<UserStorageEventHandler> = new Set();
  private initialized = false;

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * 初始化管理器
   * 从 localStorage 恢复当前用户状态
   */
  initialize(): void {
    if (this.initialized || typeof window === 'undefined') return;

    try {
      // 从 auth store 恢复用户状态
      const authData = localStorage.getItem('pisa-auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        if (parsed.state?.user?.id) {
          this.currentUserId = parsed.state.user.id;
          console.log('[UserStorageManager] Restored user:', this.currentUserId);
        }
      }
    } catch (error) {
      console.error('[UserStorageManager] Failed to restore user state:', error);
    }

    this.initialized = true;
  }

  // ============================================================================
  // User State
  // ============================================================================

  /**
   * 获取当前用户 ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * 检查是否已登录
   */
  isLoggedIn(): boolean {
    return this.currentUserId !== null;
  }

  /**
   * 获取存储前缀
   */
  getStoragePrefix(): string {
    return this.currentUserId 
      ? `${USER_PREFIX}-${this.currentUserId}`
      : GUEST_PREFIX;
  }

  /**
   * 获取用户特定的存储 key
   */
  getUserStorageKey(baseKey: string): string {
    const prefix = this.getStoragePrefix();
    return `${prefix}:${baseKey}`;
  }

  // ============================================================================
  // Login / Logout
  // ============================================================================

  /**
   * 处理用户登录
   */
  async onLogin(userId: string): Promise<void> {
    const previousUserId = this.currentUserId;
    
    console.log('[UserStorageManager] Login:', userId);

    // 1. 清理访客数据（如果之前是访客）
    if (!previousUserId) {
      await this.clearGuestData();
    }

    // 2. 更新当前用户
    this.currentUserId = userId;

    // 3. 通知所有监听者
    await this.emitEvent(
      previousUserId 
        ? { type: 'switch', fromUserId: previousUserId, toUserId: userId }
        : { type: 'login', userId }
    );

    console.log('[UserStorageManager] Login complete');
  }

  /**
   * 处理用户登出
   */
  async onLogout(): Promise<void> {
    console.log('[UserStorageManager] Logout');

    // 1. 清理当前用户的本地数据
    await this.clearCurrentUserData();

    // 2. 重置用户状态
    this.currentUserId = null;

    // 3. 通知所有监听者
    await this.emitEvent({ type: 'logout' });

    console.log('[UserStorageManager] Logout complete');
  }

  // ============================================================================
  // Data Management
  // ============================================================================

  /**
   * 清理访客数据
   */
  async clearGuestData(): Promise<void> {
    console.log('[UserStorageManager] Clearing guest data...');
    
    // 清理带有 guest 前缀的数据
    this.clearPrefixedLocalStorage(GUEST_PREFIX);
    
    // 也清理没有前缀的旧数据（兼容迁移）
    this.clearLegacyLocalStorage();
  }

  /**
   * 清理当前用户的本地数据
   */
  async clearCurrentUserData(): Promise<void> {
    console.log('[UserStorageManager] Clearing current user data...');
    
    if (this.currentUserId) {
      // 清理用户前缀的数据
      this.clearPrefixedLocalStorage(`${USER_PREFIX}-${this.currentUserId}`);
    }
    
    // 清理所有没有前缀的旧格式数据
    this.clearLegacyLocalStorage();
    
    // 清理 IndexedDB
    await this.clearIndexedDB();
  }

  /**
   * 清理带有特定前缀的 localStorage 数据
   */
  private clearPrefixedLocalStorage(prefix: string): void {
    if (typeof window === 'undefined') return;
    
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${prefix}:`)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('[UserStorageManager] Removed:', key);
    });
  }

  /**
   * 清理旧格式的 localStorage 数据（没有用户前缀）
   */
  private clearLegacyLocalStorage(): void {
    if (typeof window === 'undefined') return;
    
    USER_ISOLATED_STORAGE_KEYS.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log('[UserStorageManager] Removed legacy key:', key);
      }
    });
  }

  /**
   * 清理 IndexedDB
   */
  private async clearIndexedDB(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    return new Promise((resolve) => {
      try {
        const request = indexedDB.deleteDatabase(INDEXED_DB_NAME);
        
        request.onsuccess = () => {
          console.log('[UserStorageManager] IndexedDB deleted');
          resolve();
        };
        
        request.onerror = () => {
          console.error('[UserStorageManager] Failed to delete IndexedDB');
          resolve(); // 继续执行，不阻塞
        };
        
        request.onblocked = () => {
          console.warn('[UserStorageManager] IndexedDB deletion blocked');
          resolve(); // 继续执行
        };
      } catch (error) {
        console.error('[UserStorageManager] IndexedDB deletion error:', error);
        resolve();
      }
    });
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * 订阅用户存储事件
   */
  subscribe(handler: UserStorageEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * 发送事件到所有监听者
   */
  private async emitEvent(event: UserStorageEvent): Promise<void> {
    const handlers = Array.from(this.eventHandlers);
    
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('[UserStorageManager] Event handler error:', error);
      }
    }
  }

  // ============================================================================
  // Storage Helpers
  // ============================================================================

  /**
   * 检查是否有访客数据
   */
  hasGuestData(): boolean {
    if (typeof window === 'undefined') return false;
    
    // 检查旧格式数据
    for (const key of USER_ISOLATED_STORAGE_KEYS) {
      if (localStorage.getItem(key)) {
        return true;
      }
    }
    
    // 检查新格式访客数据
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${GUEST_PREFIX}:`)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 迁移旧格式数据到用户前缀格式
   * 用于首次升级
   */
  async migrateLegacyDataToUser(userId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    
    console.log('[UserStorageManager] Migrating legacy data to user:', userId);
    
    const prefix = `${USER_PREFIX}-${userId}`;
    
    for (const key of USER_ISOLATED_STORAGE_KEYS) {
      const data = localStorage.getItem(key);
      if (data) {
        // 移动到新 key
        localStorage.setItem(`${prefix}:${key}`, data);
        localStorage.removeItem(key);
        console.log(`[UserStorageManager] Migrated: ${key} -> ${prefix}:${key}`);
      }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: UserStorageManager | null = null;

export function getUserStorageManager(): UserStorageManager {
  if (!instance) {
    instance = new UserStorageManager();
    instance.initialize();
  }
  return instance;
}

// ============================================================================
// Hooks
// ============================================================================

import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Hook: 获取当前用户 ID
 */
export function useCurrentStorageUserId(): string | null {
  const manager = getUserStorageManager();
  
  return useSyncExternalStore(
    (callback) => manager.subscribe(() => callback()),
    () => manager.getCurrentUserId(),
    () => null
  );
}

/**
 * Hook: 获取用户特定的存储 key
 */
export function useUserStorageKey(baseKey: string): string {
  const userId = useCurrentStorageUserId();
  const manager = getUserStorageManager();
  
  return manager.getUserStorageKey(baseKey);
}

/**
 * Hook: 监听用户存储事件
 */
export function useUserStorageEvents(handler: UserStorageEventHandler): void {
  const manager = getUserStorageManager();
  
  useEffect(() => {
    return manager.subscribe(handler);
  }, [handler]);
}

// ============================================================================
// Zustand Storage Creator
// ============================================================================

import { createJSONStorage, type PersistStorage } from 'zustand/middleware';

/**
 * 创建用户隔离的 Zustand storage
 * 
 * @param baseKey - 基础存储 key
 * @param requireAuth - 是否需要登录才能持久化（默认 true）
 */
export function createUserIsolatedStorage<T>(
  baseKey: string,
  requireAuth: boolean = true
): PersistStorage<T> {
  const manager = getUserStorageManager();
  
  // createJSONStorage returns undefined only when getStorage() returns undefined,
  // which won't happen here since we always provide a valid storage object
  return createJSONStorage<T>(() => ({
    getItem: (name: string): string | null => {
      if (typeof window === 'undefined') return null;
      
      // 如果需要登录但用户未登录，返回 null
      if (requireAuth && !manager.isLoggedIn()) {
        return null;
      }
      
      const key = manager.getUserStorageKey(baseKey);
      return localStorage.getItem(key);
    },
    
    setItem: (name: string, value: string): void => {
      if (typeof window === 'undefined') return;
      
      // 如果需要登录但用户未登录，不保存
      if (requireAuth && !manager.isLoggedIn()) {
        console.log(`[Storage] Skip saving ${baseKey}: user not logged in`);
        return;
      }
      
      const key = manager.getUserStorageKey(baseKey);
      localStorage.setItem(key, value);
    },
    
    removeItem: (name: string): void => {
      if (typeof window === 'undefined') return;
      
      const key = manager.getUserStorageKey(baseKey);
      localStorage.removeItem(key);
    },
  })) as PersistStorage<T>;
}

// ============================================================================
// Workspace-Isolated Zustand Storage Creator
// ============================================================================

/**
 * 创建 workspace 隔离的 Zustand storage
 * Key 格式: `user-${userId}:${baseKey}:ws-${workspaceId}`
 *
 * workspaceId 是可变的 — 在 rehydrate() 前调用 setWorkspaceId() 来切换 workspace。
 * 配合 skipHydration: true 使用，由 initializeWorkspace() 统一控制 hydration 时机。
 *
 * @param baseKey - 基础存储 key
 * @param requireAuth - 是否需要登录才能持久化（默认 true）
 */
export function createWorkspaceIsolatedStorage<T>(
  baseKey: string,
  requireAuth: boolean = true
): { storage: PersistStorage<T>; setWorkspaceId: (id: string) => void } {
  const manager = getUserStorageManager();
  let currentWorkspaceId = 'default';

  const storage = createJSONStorage<T>(() => ({
    getItem: (name: string): string | null => {
      if (typeof window === 'undefined') return null;
      if (requireAuth && !manager.isLoggedIn()) return null;
      const key = `${manager.getUserStorageKey(baseKey)}:ws-${currentWorkspaceId}`;
      return localStorage.getItem(key);
    },

    setItem: (name: string, value: string): void => {
      if (typeof window === 'undefined') return;
      if (requireAuth && !manager.isLoggedIn()) return;
      const key = `${manager.getUserStorageKey(baseKey)}:ws-${currentWorkspaceId}`;
      localStorage.setItem(key, value);
    },

    removeItem: (name: string): void => {
      if (typeof window === 'undefined') return;
      const key = `${manager.getUserStorageKey(baseKey)}:ws-${currentWorkspaceId}`;
      localStorage.removeItem(key);
    },
  })) as PersistStorage<T>;

  return {
    storage,
    setWorkspaceId: (id: string) => { currentWorkspaceId = id; },
  };
}

export default UserStorageManager;
