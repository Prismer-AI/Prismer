/**
 * State Snapshot Manager
 * 
 * 状态快照管理器 - 用于捕获、存储、恢复 UI 状态
 * 支持时间线回放和状态对比
 */

import type {
  StateSnapshot,
  ComponentType,
  ComponentStates,
  TaskPanelHeight,
  DiffChange,
} from '../types';

// ============================================================
// Types
// ============================================================

export interface SnapshotCaptureOptions {
  includeContent?: boolean;
  maxSnapshots?: number;
}

export interface StateSource {
  chatExpanded: boolean;
  chatPanelWidth: number;
  taskPanelHeight: TaskPanelHeight;
  activeComponent: ComponentType;
  componentStates: ComponentStates;
  activeDiff: {
    component: ComponentType;
    file?: string;
    changes: DiffChange[];
  } | null;
}

// ============================================================
// Snapshot Manager
// ============================================================

export class StateSnapshotManager {
  private snapshots: Map<string, StateSnapshot> = new Map();
  private snapshotOrder: string[] = [];
  private maxSnapshots: number;

  constructor(maxSnapshots = 100) {
    this.maxSnapshots = maxSnapshots;
  }

  /**
   * 捕获当前状态快照
   */
  capture(source: StateSource, options?: SnapshotCaptureOptions): StateSnapshot {
    const snapshot: StateSnapshot = {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      layout: {
        chatExpanded: source.chatExpanded,
        chatPanelWidth: source.chatPanelWidth,
        taskPanelHeight: source.taskPanelHeight,
        activeComponent: source.activeComponent,
      },
      components: options?.includeContent
        ? this.deepClone(source.componentStates) as ComponentStates
        : { ...source.componentStates },
      diff: source.activeDiff || undefined,
    };

    this.addSnapshot(snapshot);
    return snapshot;
  }

  /**
   * 添加快照
   */
  addSnapshot(snapshot: StateSnapshot): void {
    // 检查是否超出限制
    while (this.snapshotOrder.length >= this.maxSnapshots) {
      const oldestId = this.snapshotOrder.shift();
      if (oldestId) {
        this.snapshots.delete(oldestId);
      }
    }

    this.snapshots.set(snapshot.id, snapshot);
    this.snapshotOrder.push(snapshot.id);
  }

  /**
   * 获取快照
   */
  getSnapshot(id: string): StateSnapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * 获取所有快照 (按时间排序)
   */
  getAllSnapshots(): StateSnapshot[] {
    return this.snapshotOrder
      .map((id) => this.snapshots.get(id))
      .filter((s): s is StateSnapshot => !!s);
  }

  /**
   * 获取最近的 N 个快照
   */
  getRecentSnapshots(count: number): StateSnapshot[] {
    return this.getAllSnapshots().slice(-count);
  }

  /**
   * 获取某个时间点附近的快照
   */
  getSnapshotAtTime(timestamp: number): StateSnapshot | undefined {
    const snapshots = this.getAllSnapshots();
    
    // 找到最接近的快照
    let closest: StateSnapshot | undefined;
    let minDiff = Infinity;

    for (const snapshot of snapshots) {
      const diff = Math.abs(snapshot.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = snapshot;
      }
    }

    return closest;
  }

  /**
   * 获取时间范围内的快照
   */
  getSnapshotsInRange(startTime: number, endTime: number): StateSnapshot[] {
    return this.getAllSnapshots().filter(
      (s) => s.timestamp >= startTime && s.timestamp <= endTime
    );
  }

  /**
   * 比较两个快照的差异
   */
  compareSnapshots(
    snapshotA: StateSnapshot,
    snapshotB: StateSnapshot
  ): SnapshotDiff {
    const diff: SnapshotDiff = {
      layoutChanges: {},
      componentChanges: {},
      timestamp: {
        from: snapshotA.timestamp,
        to: snapshotB.timestamp,
      },
    };

    // 比较布局
    const layoutKeys = Object.keys(snapshotA.layout) as (keyof StateSnapshot['layout'])[];
    for (const key of layoutKeys) {
      if (snapshotA.layout[key] !== snapshotB.layout[key]) {
        (diff.layoutChanges as Record<string, { from: unknown; to: unknown }>)[key] = {
          from: snapshotA.layout[key],
          to: snapshotB.layout[key],
        };
      }
    }

    // 比较组件状态
    const allComponents = new Set([
      ...Object.keys(snapshotA.components),
      ...Object.keys(snapshotB.components),
    ]);

    for (const component of allComponents) {
      const key = component as keyof ComponentStates;
      const stateA = snapshotA.components[key];
      const stateB = snapshotB.components[key];

      if (JSON.stringify(stateA) !== JSON.stringify(stateB)) {
        (diff.componentChanges as Record<string, { from: unknown; to: unknown }>)[key] = {
          from: stateA,
          to: stateB,
        };
      }
    }

    return diff;
  }

  /**
   * 清空所有快照
   */
  clear(): void {
    this.snapshots.clear();
    this.snapshotOrder = [];
  }

  /**
   * 删除指定快照
   */
  deleteSnapshot(id: string): boolean {
    const index = this.snapshotOrder.indexOf(id);
    if (index !== -1) {
      this.snapshotOrder.splice(index, 1);
      this.snapshots.delete(id);
      return true;
    }
    return false;
  }

  /**
   * 导出快照 (用于持久化)
   */
  export(): { snapshots: StateSnapshot[]; exportedAt: number } {
    return {
      snapshots: this.getAllSnapshots(),
      exportedAt: Date.now(),
    };
  }

  /**
   * 导入快照
   */
  import(data: { snapshots: StateSnapshot[] }): void {
    for (const snapshot of data.snapshots) {
      this.addSnapshot(snapshot);
    }
  }

  // ==================== 工具方法 ====================

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private shallowClone<T extends Record<string, unknown>>(obj: T): T {
    const result = {} as T;
    for (const key of Object.keys(obj) as (keyof T)[]) {
      result[key] = obj[key];
    }
    return result;
  }
}

// ============================================================
// Types for Diff
// ============================================================

export interface SnapshotDiff {
  layoutChanges: Partial<{
    [K in keyof StateSnapshot['layout']]: {
      from: StateSnapshot['layout'][K];
      to: StateSnapshot['layout'][K];
    };
  }>;
  componentChanges: Partial<{
    [K in keyof ComponentStates]: {
      from: ComponentStates[K] | undefined;
      to: ComponentStates[K] | undefined;
    };
  }>;
  timestamp: {
    from: number;
    to: number;
  };
}

// ============================================================
// Factory
// ============================================================

/**
 * 创建状态快照管理器
 */
export function createSnapshotManager(maxSnapshots?: number): StateSnapshotManager {
  return new StateSnapshotManager(maxSnapshots);
}

// ============================================================
// Singleton Instance
// ============================================================

let defaultManager: StateSnapshotManager | null = null;

/**
 * 获取默认的快照管理器实例
 */
export function getDefaultSnapshotManager(): StateSnapshotManager {
  if (!defaultManager) {
    defaultManager = new StateSnapshotManager();
  }
  return defaultManager;
}
