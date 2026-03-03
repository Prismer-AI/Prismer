/**
 * Storage Layer Exports
 */

// Types
export type {
  StorageAdapter,
  PaperMeta,
  PaperData,
  OCRResult,
  ChatSession,
  StoredChatMessage,
  CrossPaperCitation,
  Notebook,
  NoteEntry,
  NoteEntryType,
  ReferenceMetadata,
} from './types';

// Adapters
export { MockStorageAdapter, getMockStorageAdapter } from './mockAdapter';
export { IndexedDBAdapter, getIndexedDBAdapter, resetIndexedDBAdapter, deleteIndexedDB } from './indexedDBAdapter';

// User Storage Manager
export {
  getUserStorageManager,
  createUserIsolatedStorage,
  useCurrentStorageUserId,
  useUserStorageKey,
  useUserStorageEvents,
  USER_ISOLATED_STORAGE_KEYS,
  INDEXED_DB_NAME,
} from './userStorageManager';
export type { UserStorageEvent, UserStorageEventHandler } from './userStorageManager';

// Provider and Hooks
export { StorageProvider, useStorage, useStorageSafe } from './provider';
export {
  usePaperList,
  usePaper,
  useChatSessionList,
  useChatSession,
  useNotebookList,
  useNotebook,
} from './hooks';

