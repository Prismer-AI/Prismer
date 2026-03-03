"use client";

/**
 * Storage Provider
 * 
 * 提供存储适配器的 React Context
 * 支持在组件树中访问存储服务
 * 
 * 默认使用 IndexedDB 进行持久化存储
 */

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import type { StorageAdapter } from './types';
import { MockStorageAdapter } from './mockAdapter';
import { IndexedDBAdapter } from './indexedDBAdapter';

// ============================================================
// Context
// ============================================================

const StorageContext = createContext<StorageAdapter | null>(null);

// ============================================================
// Provider
// ============================================================

type AdapterType = 'indexeddb' | 'mock';

interface StorageProviderProps {
  children: React.ReactNode;
  /** 自定义存储适配器 (用于测试或切换实现) */
  adapter?: StorageAdapter;
  /** 适配器类型，默认 'indexeddb' */
  adapterType?: AdapterType;
}

/**
 * Storage Provider Component
 * 
 * 包装应用组件，提供存储服务访问
 * 默认使用 IndexedDBAdapter 进行持久化
 */
export const StorageProvider: React.FC<StorageProviderProps> = ({
  children,
  adapter,
  adapterType = 'indexeddb',
}) => {
  // 使用传入的 adapter 或根据类型创建
  const storageAdapter = useMemo(() => {
    if (adapter) return adapter;
    
    // 在服务端使用 Mock
    if (typeof window === 'undefined') {
      return new MockStorageAdapter();
    }
    
    // 根据类型选择适配器
    switch (adapterType) {
      case 'indexeddb':
        return new IndexedDBAdapter();
      case 'mock':
      default:
        return new MockStorageAdapter();
    }
  }, [adapter, adapterType]);
  
  return (
    <StorageContext.Provider value={storageAdapter}>
      {children}
    </StorageContext.Provider>
  );
};

// ============================================================
// Hooks
// ============================================================

/**
 * 获取存储适配器
 * 
 * @throws Error 如果在 StorageProvider 外部使用
 */
export function useStorage(): StorageAdapter {
  const adapter = useContext(StorageContext);
  
  if (!adapter) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  
  return adapter;
}

/**
 * 安全获取存储适配器
 * 
 * @returns 存储适配器或 null
 */
export function useStorageSafe(): StorageAdapter | null {
  return useContext(StorageContext);
}

