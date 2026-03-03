/**
 * Task Types
 *
 * Workspace task and subtask definitions.
 * Used by workspace stores and sync layer.
 */

import type { ComponentType } from '@/lib/events/types';

/** Task status */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'error';

/** Subtask */
export interface SubTask {
  id: string;
  parentId: string;
  title: string;
  status: TaskStatus;
  duration?: number;
  details?: string;
}

/** Task output */
export interface TaskOutput {
  id: string;
  taskId: string;
  type: 'text' | 'file' | 'code' | 'image';
  content: string;
  timestamp: string;
  componentTarget?: ComponentType;
}

/** Task */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  progress?: number;
  startTime?: string;
  endTime?: string;
  subtasks?: SubTask[];
  outputs?: TaskOutput[];
}
