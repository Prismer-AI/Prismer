/**
 * Layout Store
 *
 * Manages workspace layout state: chat panel, task panel, panel widths.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createWorkspaceIsolatedStorage } from '@/lib/storage/userStorageManager';
import type { TaskPanelHeight } from '../types';

const { storage: wsLayoutStorage, setWorkspaceId: setLayoutStoreWorkspaceId } =
  createWorkspaceIsolatedStorage<Pick<LayoutState, 'chatExpanded' | 'taskPanelHeight' | 'chatPanelWidth'>>('prismer-ws-layout', true);

export { setLayoutStoreWorkspaceId };

interface LayoutState {
  chatExpanded: boolean;
  taskPanelHeight: TaskPanelHeight;
  chatPanelWidth: number;
}

interface LayoutActions {
  toggleChat: () => void;
  expandChatToTask: (taskId: string) => void;
  setTaskPanelHeight: (height: TaskPanelHeight) => void;
  setChatPanelWidth: (width: number) => void;
  resetLayout: () => void;
}

const initialLayoutState: LayoutState = {
  chatExpanded: false,
  taskPanelHeight: 'collapsed',
  chatPanelWidth: 420,
};

export const useLayoutStore = create<LayoutState & LayoutActions>()(
  persist(
    (set) => ({
      ...initialLayoutState,

      toggleChat: () => {
        set((state) => ({ chatExpanded: !state.chatExpanded }));
      },

      expandChatToTask: () => {
        set({
          chatExpanded: true,
          taskPanelHeight: '80%',
        });
      },

      setTaskPanelHeight: (height) => {
        set({ taskPanelHeight: height });
      },

      setChatPanelWidth: (width) => {
        set({ chatPanelWidth: Math.max(280, Math.min(600, width)) });
      },

      resetLayout: () => {
        set(initialLayoutState);
      },
    }),
    {
      name: 'prismer-ws-layout',
      storage: wsLayoutStorage,
      version: 1,
      skipHydration: true,
    }
  )
);

// Selector hooks
export function useLayoutState() {
  const chatExpanded = useLayoutStore((s) => s.chatExpanded);
  const taskPanelHeight = useLayoutStore((s) => s.taskPanelHeight);
  const chatPanelWidth = useLayoutStore((s) => s.chatPanelWidth);
  return { chatExpanded, taskPanelHeight, chatPanelWidth };
}

export function useChatExpanded() {
  return useLayoutStore((s) => s.chatExpanded);
}
