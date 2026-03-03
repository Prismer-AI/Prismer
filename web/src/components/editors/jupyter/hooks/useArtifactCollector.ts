/**
 * useArtifactCollector - 自动收集 Cell 输出中的 Artifacts
 * 
 * 监听 cell:output 和 cell:executed 事件，
 * 自动检测并添加到 ArtifactStore
 */

import { useEffect, useCallback, useRef } from 'react';
import { on } from '../store/eventBus';
import { useArtifactStore, type DetectedArtifact } from '../store/artifactStore';
import { detectArtifacts, detectAllArtifacts } from '../services/ArtifactDetector';
import { useNotebookStore } from '../store/notebookStore';
import type { Output } from '../types';

interface UseArtifactCollectorOptions {
  /** 是否启用收集 */
  enabled?: boolean;
  /** 执行完成时是否清除旧 Artifacts */
  clearOnExecute?: boolean;
}

export function useArtifactCollector(options: UseArtifactCollectorOptions = {}) {
  const { enabled = true, clearOnExecute = true } = options;
  
  const addArtifacts = useArtifactStore((state) => state.addArtifacts);
  const clearCellArtifacts = useArtifactStore((state) => state.clearCellArtifacts);
  
  // 获取 artifacts 用于去重检查
  const artifactsRef = useRef<Record<string, DetectedArtifact>>({});
  
  // 订阅 artifacts 变化
  useEffect(() => {
    return useArtifactStore.subscribe((state) => {
      artifactsRef.current = state.artifacts;
    });
  }, []);
  
  const cells = useNotebookStore((state) => state.cells);
  
  // 追踪已处理的输出，避免重复
  const processedOutputs = useRef<Set<string>>(new Set());

  // 处理单个输出
  const handleOutput = useCallback((data: { cellId: string; output: Output }) => {
    if (!enabled) return;
    
    const { cellId, output } = data;
    
    // 生成输出标识
    const outputKey = `${cellId}_${JSON.stringify(output).slice(0, 100)}`;
    if (processedOutputs.current.has(outputKey)) {
      return;
    }
    processedOutputs.current.add(outputKey);
    
    // 检测 Artifacts
    const cell = cells.find(c => c.id === cellId);
    if (!cell || cell.type !== 'code') return;
    
    const codeCell = cell as { outputs: Output[] };
    const outputIndex = codeCell.outputs.length - 1;
    
    const artifacts = detectArtifacts(cellId, output, outputIndex);
    
    if (artifacts.length > 0) {
      console.log(`[ArtifactCollector] Detected ${artifacts.length} artifacts from cell ${cellId}`);
      addArtifacts(artifacts);
    }
  }, [enabled, cells, addArtifacts]);

  // 处理执行开始 - 清除旧 Artifacts
  const handleExecuting = useCallback((data: { cellId: string }) => {
    if (!enabled || !clearOnExecute) return;
    
    const { cellId } = data;
    console.log(`[ArtifactCollector] Clearing artifacts for cell ${cellId}`);
    clearCellArtifacts(cellId);
    
    // 清除已处理输出的缓存
    const keysToRemove = Array.from(processedOutputs.current)
      .filter(key => key.startsWith(cellId));
    keysToRemove.forEach(key => processedOutputs.current.delete(key));
  }, [enabled, clearOnExecute, clearCellArtifacts]);

  // 处理执行完成 - 扫描所有输出
  const handleExecuted = useCallback((data: { cellId: string; success: boolean }) => {
    if (!enabled) return;
    
    const { cellId, success } = data;
    if (!success) return;
    
    // 获取 Cell 的所有输出
    const cell = cells.find(c => c.id === cellId);
    if (!cell || cell.type !== 'code') return;
    
    const codeCell = cell as { outputs: Output[] };
    
    // 检测所有输出中的 Artifacts
    const result = detectAllArtifacts(cellId, codeCell.outputs);
    
    if (result.hasArtifacts) {
      console.log(`[ArtifactCollector] Found ${result.artifacts.length} artifacts after execution`);
      
      // 避免重复添加 - 使用 ref 中的当前状态
      const currentArtifacts = artifactsRef.current;
      const existing = Object.values(currentArtifacts).filter(
        (a: DetectedArtifact) => a.cellId === cellId
      );
      
      const newArtifacts = result.artifacts.filter(
        (a: DetectedArtifact) => !existing.some((e: DetectedArtifact) => 
          e.cellId === a.cellId && 
          e.outputIndex === a.outputIndex &&
          e.mimeType === a.mimeType
        )
      );
      
      if (newArtifacts.length > 0) {
        addArtifacts(newArtifacts);
      }
    }
  }, [enabled, cells, addArtifacts]);

  // 订阅事件
  useEffect(() => {
    if (!enabled) return;

    const unsubOutput = on('cell:output', handleOutput);
    const unsubExecuting = on('cell:executing', handleExecuting);
    const unsubExecuted = on('cell:executed', handleExecuted);

    return () => {
      unsubOutput();
      unsubExecuting();
      unsubExecuted();
    };
  }, [enabled, handleOutput, handleExecuting, handleExecuted]);

  // 手动扫描所有 Cells
  const scanAllCells = useCallback(() => {
    if (!enabled) return;

    let totalArtifacts = 0;
    
    cells.forEach(cell => {
      if (cell.type !== 'code') return;
      
      const codeCell = cell as { id: string; outputs: Output[] };
      const result = detectAllArtifacts(codeCell.id, codeCell.outputs);
      
      if (result.hasArtifacts) {
        addArtifacts(result.artifacts);
        totalArtifacts += result.artifacts.length;
      }
    });

    console.log(`[ArtifactCollector] Scanned all cells, found ${totalArtifacts} artifacts`);
  }, [enabled, cells, addArtifacts]);

  return {
    scanAllCells,
  };
}

export default useArtifactCollector;
