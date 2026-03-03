/**
 * Task Store
 *
 * Manages workspace tasks, subtasks, and active task selection.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createWorkspaceIsolatedStorage } from '@/lib/storage/userStorageManager';
import type { Task, TaskStatus } from '../types';

const { storage: wsTaskStorage, setWorkspaceId: setTaskStoreWorkspaceId } =
  createWorkspaceIsolatedStorage<Pick<TaskState, 'tasks' | 'activeTaskId'>>('prismer-ws-tasks', true);

export { setTaskStoreWorkspaceId };

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
}

interface TaskActions {
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateSubtaskStatus: (taskId: string, subtaskId: string, status: TaskStatus) => void;
  setActiveTaskId: (id: string | null) => void;
  resetTasks: () => void;
}

const initialTaskState: TaskState = {
  tasks: [],
  activeTaskId: null,
};

export const useTaskStore = create<TaskState & TaskActions>()(
  persist(
    (set) => ({
      ...initialTaskState,

      setTasks: (tasks) => {
        set({ tasks });
      },

      addTask: (task) => {
        set((state) => ({
          tasks: [...state.tasks, task],
        }));
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      updateSubtaskStatus: (taskId, subtaskId, status) => {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id !== taskId) return task;

            const updatedSubtasks = (task.subtasks || []).map((subtask) =>
              subtask.id === subtaskId ? { ...subtask, status } : subtask
            );

            const completedCount = updatedSubtasks.filter((s) => s.status === 'completed').length;
            const totalCount = updatedSubtasks.length;
            const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            let taskStatus: TaskStatus = task.status;
            if (progress === 100) {
              taskStatus = 'completed';
            } else if (progress > 0 || updatedSubtasks.some((s) => s.status === 'running')) {
              taskStatus = 'running';
            }

            return { ...task, subtasks: updatedSubtasks, progress, status: taskStatus };
          }),
        }));
      },

      setActiveTaskId: (id) => {
        set({ activeTaskId: id });
      },

      resetTasks: () => {
        set(initialTaskState);
      },
    }),
    {
      name: 'prismer-ws-tasks',
      storage: wsTaskStorage,
      version: 1,
      skipHydration: true,
    }
  )
);

// Selector hooks
export function useCurrentTask() {
  return useTaskStore((state) => {
    const runningTask = state.tasks.find((t) => t.status === 'running');
    if (runningTask) return runningTask;
    if (state.activeTaskId) {
      return state.tasks.find((t) => t.id === state.activeTaskId) || null;
    }
    return state.tasks[0] || null;
  });
}
