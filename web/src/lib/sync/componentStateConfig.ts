/**
 * Component State Sync Configuration
 *
 * 定义每个组件状态字段的同步策略
 * 用于控制哪些状态需要同步、持久化、以及移动端访问权限
 */

import type { ComponentStates } from '@/types/workspace';

// ============================================================
// Types
// ============================================================

/** 同步模式 */
export type SyncMode = 'bidirectional' | 'broadcast' | 'local';

/** 移动端访问权限 */
export type MobileAccess = 'read' | 'write' | 'none';

/** 字段同步配置 */
export interface FieldSyncConfig {
  /** 同步模式 */
  sync: SyncMode;
  /** 是否持久化 */
  persistence: boolean;
  /** 移动端访问权限 */
  mobileAccess: MobileAccess;
}

/** 组件状态同步配置 */
export interface ComponentStateSyncConfig<T> {
  componentType: keyof ComponentStates;
  description: string;
  /** 移动端是否需要此组件状态 */
  mobileRelevant: boolean;
  /** 字段级配置 */
  fields: {
    [K in keyof T]?: FieldSyncConfig;
  };
}

// ============================================================
// Component State Configurations
// ============================================================

/**
 * PDF Reader 状态同步配置
 */
export const pdfReaderConfig: ComponentStateSyncConfig<ComponentStates['pdf-reader']> = {
  componentType: 'pdf-reader',
  description: 'PDF 阅读器状态',
  mobileRelevant: false, // 移动端没有 PDF 阅读器
  fields: {
    documentId: { sync: 'bidirectional', persistence: true, mobileAccess: 'read' },
    currentPage: { sync: 'bidirectional', persistence: true, mobileAccess: 'read' },
    highlights: { sync: 'bidirectional', persistence: true, mobileAccess: 'read' },
    totalPages: { sync: 'broadcast', persistence: false, mobileAccess: 'read' },
    zoom: { sync: 'local', persistence: false, mobileAccess: 'none' },
  },
};

/**
 * LaTeX Editor 状态同步配置
 */
export const latexEditorConfig: ComponentStateSyncConfig<ComponentStates['latex-editor']> = {
  componentType: 'latex-editor',
  description: 'LaTeX 编辑器状态',
  mobileRelevant: false,
  fields: {
    activeFile: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    content: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    cursorPosition: { sync: 'local', persistence: false, mobileAccess: 'none' },
    compiledPdfUrl: { sync: 'local', persistence: false, mobileAccess: 'none' },
  },
};

/**
 * Code Playground 状态同步配置
 */
export const codePlaygroundConfig: ComponentStateSyncConfig<ComponentStates['code-playground']> = {
  componentType: 'code-playground',
  description: '代码编辑器状态',
  mobileRelevant: false,
  fields: {
    mode: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    template: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    selectedFile: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    terminalOutput: { sync: 'local', persistence: false, mobileAccess: 'none' },
    previewUrl: { sync: 'local', persistence: false, mobileAccess: 'none' },
  },
};

/**
 * AI Editor 状态同步配置
 */
export const aiEditorConfig: ComponentStateSyncConfig<ComponentStates['ai-editor']> = {
  componentType: 'ai-editor',
  description: 'AI 编辑器状态',
  mobileRelevant: false,
  fields: {
    content: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    documentId: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
  },
};

/**
 * AG Grid 状态同步配置
 */
export const agGridConfig: ComponentStateSyncConfig<ComponentStates['ag-grid']> = {
  componentType: 'ag-grid',
  description: '数据表格状态',
  mobileRelevant: false,
  fields: {
    selectedRowIds: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    filterModel: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    sortModel: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
  },
};

/**
 * Jupyter Notebook 状态同步配置
 */
export const jupyterNotebookConfig: ComponentStateSyncConfig<ComponentStates['jupyter-notebook']> = {
  componentType: 'jupyter-notebook',
  description: 'Jupyter Notebook 状态',
  mobileRelevant: false,
  fields: {
    activeCellIndex: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    cellCount: { sync: 'broadcast', persistence: false, mobileAccess: 'none' },
    kernelStatus: { sync: 'broadcast', persistence: false, mobileAccess: 'read' },
    sessionId: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    executionCount: { sync: 'broadcast', persistence: false, mobileAccess: 'none' },
    cells: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
  },
};

/**
 * Bento Gallery 状态同步配置
 */
export const bentoGalleryConfig: ComponentStateSyncConfig<ComponentStates['bento-gallery']> = {
  componentType: 'bento-gallery',
  description: '图片画廊状态',
  mobileRelevant: false,
  fields: {
    selectedImageId: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
  },
};

/**
 * Three Viewer 状态同步配置
 */
export const threeViewerConfig: ComponentStateSyncConfig<ComponentStates['three-viewer']> = {
  componentType: 'three-viewer',
  description: '3D 查看器状态',
  mobileRelevant: false,
  fields: {
    modelId: { sync: 'bidirectional', persistence: true, mobileAccess: 'none' },
    cameraPosition: { sync: 'local', persistence: false, mobileAccess: 'none' },
  },
};

// ============================================================
// Registry
// ============================================================

/** 所有组件状态配置 */
export const componentStateConfigs: Record<string, ComponentStateSyncConfig<any>> = {
  'pdf-reader': pdfReaderConfig,
  'latex-editor': latexEditorConfig,
  'code-playground': codePlaygroundConfig,
  'jupyter-notebook': jupyterNotebookConfig,
  'ai-editor': aiEditorConfig,
  'ag-grid': agGridConfig,
  'bento-gallery': bentoGalleryConfig,
  'three-viewer': threeViewerConfig,
};

// ============================================================
// Utility Functions
// ============================================================

/**
 * 获取组件的同步配置
 */
export function getComponentConfig(componentType: string): ComponentStateSyncConfig<any> | undefined {
  return componentStateConfigs[componentType];
}

/**
 * 检查字段是否需要同步
 */
export function shouldSyncField(
  componentType: string,
  fieldName: string
): boolean {
  const config = getComponentConfig(componentType);
  if (!config) return false;
  
  const fieldConfig = config.fields[fieldName];
  return fieldConfig?.sync !== 'local';
}

/**
 * 检查字段是否需要持久化
 */
export function shouldPersistField(
  componentType: string,
  fieldName: string
): boolean {
  const config = getComponentConfig(componentType);
  if (!config) return false;
  
  const fieldConfig = config.fields[fieldName];
  return fieldConfig?.persistence ?? false;
}

/**
 * 检查移动端是否可以访问字段
 */
export function canMobileAccess(
  componentType: string,
  fieldName: string,
  mode: 'read' | 'write'
): boolean {
  const config = getComponentConfig(componentType);
  if (!config) return false;
  
  const fieldConfig = config.fields[fieldName];
  if (!fieldConfig) return false;
  
  if (fieldConfig.mobileAccess === 'none') return false;
  if (mode === 'read') return true;
  if (mode === 'write') return fieldConfig.mobileAccess === 'write';
  return false;
}

/**
 * 过滤组件状态，仅保留需要同步的字段
 */
export function filterSyncableState<T extends Record<string, any>>(
  componentType: string,
  state: T
): Partial<T> {
  const config = getComponentConfig(componentType);
  if (!config) return state;
  
  const filtered: Partial<T> = {};
  for (const [key, value] of Object.entries(state)) {
    if (shouldSyncField(componentType, key)) {
      (filtered as any)[key] = value;
    }
  }
  return filtered;
}

/**
 * 过滤组件状态，仅保留需要持久化的字段
 */
export function filterPersistableState<T extends Record<string, any>>(
  componentType: string,
  state: T
): Partial<T> {
  const config = getComponentConfig(componentType);
  if (!config) return state;
  
  const filtered: Partial<T> = {};
  for (const [key, value] of Object.entries(state)) {
    if (shouldPersistField(componentType, key)) {
      (filtered as any)[key] = value;
    }
  }
  return filtered;
}

/**
 * 过滤组件状态，仅保留移动端可访问的字段
 */
export function filterMobileAccessibleState<T extends Record<string, any>>(
  componentType: string,
  state: T
): Partial<T> {
  const config = getComponentConfig(componentType);
  if (!config || !config.mobileRelevant) return {};
  
  const filtered: Partial<T> = {};
  for (const [key, value] of Object.entries(state)) {
    if (canMobileAccess(componentType, key, 'read')) {
      (filtered as any)[key] = value;
    }
  }
  return filtered;
}

/**
 * 获取移动端相关的组件类型
 */
export function getMobileRelevantComponents(): string[] {
  return Object.entries(componentStateConfigs)
    .filter(([_, config]) => config.mobileRelevant)
    .map(([type]) => type);
}

/**
 * 过滤整个 ComponentStates，仅保留移动端相关的状态
 */
export function filterComponentStatesForMobile(
  states: Record<string, any>
): Record<string, any> {
  const filtered: Record<string, any> = {};
  
  for (const [componentType, state] of Object.entries(states)) {
    const mobileState = filterMobileAccessibleState(componentType, state);
    if (Object.keys(mobileState).length > 0) {
      filtered[componentType] = mobileState;
    }
  }
  
  return filtered;
}

export default componentStateConfigs;
