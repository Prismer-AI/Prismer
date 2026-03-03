/**
 * ArtifactStore - Artifacts 状态管理
 * 
 * 实时收集和管理执行产物（图片、DataFrame、图表等）
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { immer } from '@/lib/zustand-immer-lite';

// ============================================================
// 类型定义
// ============================================================

export type ArtifactType = 'image' | 'dataframe' | 'chart' | 'file' | 'other';

export interface DetectedArtifact {
  id: string;
  name: string;
  cellId: string;
  outputIndex: number;
  type: ArtifactType;
  mimeType: string;
  data: string | object;
  size: number;
  thumbnail?: string;
  metadata: ArtifactMetadata;
  createdAt: string;
}

export interface ArtifactMetadata {
  width?: number;
  height?: number;
  rows?: number;
  columns?: number;
  format?: string;
  [key: string]: unknown;
}

// 使用普通对象替代 Map，避免 Immer/Zustand 的问题
interface ArtifactsRecord {
  [id: string]: DetectedArtifact;
}

interface ArtifactStore {
  // 状态 - 使用普通对象
  artifacts: ArtifactsRecord;
  artifactIds: string[]; // 保持顺序
  selectedArtifactId: string | null;
  
  // Actions
  addArtifact: (artifact: DetectedArtifact) => void;
  addArtifacts: (artifacts: DetectedArtifact[]) => void;
  removeArtifact: (id: string) => void;
  clearCellArtifacts: (cellId: string) => void;
  clearAll: () => void;
  selectArtifact: (id: string | null) => void;
}

// ============================================================
// Store 实现
// ============================================================

export const useArtifactStore = create<ArtifactStore>()(
  immer<ArtifactStore>((set) => ({
    artifacts: {},
    artifactIds: [],
    selectedArtifactId: null,
    
    addArtifact: (artifact) => {
      set((state) => {
        if (!state.artifacts[artifact.id]) {
          state.artifactIds.push(artifact.id);
        }
        state.artifacts[artifact.id] = artifact;
      });
    },
    
    addArtifacts: (artifacts) => {
      set((state) => {
        artifacts.forEach(artifact => {
          if (!state.artifacts[artifact.id]) {
            state.artifactIds.push(artifact.id);
          }
          state.artifacts[artifact.id] = artifact;
        });
      });
    },
    
    removeArtifact: (id) => {
      set((state) => {
        delete state.artifacts[id];
        state.artifactIds = state.artifactIds.filter(aid => aid !== id);
        if (state.selectedArtifactId === id) {
          state.selectedArtifactId = null;
        }
      });
    },
    
    clearCellArtifacts: (cellId) => {
      set((state) => {
        const toDelete = state.artifactIds.filter(
          id => state.artifacts[id]?.cellId === cellId
        );
        toDelete.forEach(id => {
          delete state.artifacts[id];
        });
        state.artifactIds = state.artifactIds.filter(id => !toDelete.includes(id));
      });
    },
    
    clearAll: () => {
      set((state) => {
        state.artifacts = {};
        state.artifactIds = [];
        state.selectedArtifactId = null;
      });
    },
    
    selectArtifact: (id) => {
      set({ selectedArtifactId: id });
    },
  }))
);

// ============================================================
// Selector Hooks - 使用稳定的 selector
// ============================================================

/**
 * 获取所有 Artifacts（按时间倒序）
 */
export function useArtifacts(): DetectedArtifact[] {
  const artifacts = useArtifactStore((state) => state.artifacts);
  const artifactIds = useArtifactStore((state) => state.artifactIds);
  
  return useMemo(() => {
    return artifactIds
      .map(id => artifacts[id])
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [artifacts, artifactIds]);
}

/**
 * 获取指定 Cell 的 Artifacts
 */
export function useArtifactsByCell(cellId: string): DetectedArtifact[] {
  const artifacts = useArtifacts();
  
  return useMemo(() => {
    return artifacts
      .filter(a => a.cellId === cellId)
      .sort((a, b) => a.outputIndex - b.outputIndex);
  }, [artifacts, cellId]);
}

/**
 * 获取指定类型的 Artifacts
 */
export function useArtifactsByType(type: ArtifactType): DetectedArtifact[] {
  const artifacts = useArtifacts();
  
  return useMemo(() => {
    return artifacts.filter(a => a.type === type);
  }, [artifacts, type]);
}

/**
 * 获取 Artifact 数量
 */
export function useArtifactCount(): number {
  return useArtifactStore((state) => state.artifactIds.length);
}

/**
 * 获取选中的 Artifact
 */
export function useSelectedArtifact(): DetectedArtifact | null {
  const selectedId = useArtifactStore((state) => state.selectedArtifactId);
  const artifact = useArtifactStore((state) => 
    state.selectedArtifactId ? state.artifacts[state.selectedArtifactId] : null
  );
  return artifact ?? null;
}
