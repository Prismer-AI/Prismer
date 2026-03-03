/**
 * Component Store
 *
 * Manages the active editor component, per-component state, and diff viewer.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createWorkspaceIsolatedStorage } from '@/lib/storage/userStorageManager';
import type { ComponentType, ComponentStates, DiffChange } from '../types';
import { DISABLED_COMPONENTS } from '@/types/workspace';

const { storage: wsComponentStorage, setWorkspaceId: setComponentStoreWorkspaceId } =
  createWorkspaceIsolatedStorage<Pick<ComponentState, 'activeComponent' | 'componentStates'>>('prismer-ws-components', true);

export { setComponentStoreWorkspaceId };

interface ComponentState {
  activeComponent: ComponentType;
  componentStates: ComponentStates;
  activeDiff: {
    component: ComponentType;
    file?: string;
    changes: DiffChange[];
  } | null;
}

interface ComponentActions {
  setActiveComponent: (type: ComponentType) => void;
  updateComponentState: <K extends keyof ComponentStates>(
    component: K,
    state: Partial<ComponentStates[K]>
  ) => void;
  setComponentStates: (states: ComponentStates) => void;
  setActiveDiff: (diff: ComponentState['activeDiff']) => void;
  clearDiff: () => void;
  resetComponents: () => void;
}

const initialComponentState: ComponentState = {
  activeComponent: 'ai-editor',
  componentStates: {},
  activeDiff: null,
};

export const useComponentStore = create<ComponentState & ComponentActions>()(
  persist(
    (set) => ({
      ...initialComponentState,

      setActiveComponent: (type) => {
        if (DISABLED_COMPONENTS.has(type)) return;
        set({ activeComponent: type });
      },

      updateComponentState: (component, state) => {
        set((prev) => ({
          componentStates: {
            ...prev.componentStates,
            [component]: {
              ...prev.componentStates[component],
              ...state,
            },
          },
        }));
      },

      setComponentStates: (states) => {
        set({ componentStates: states });
      },

      setActiveDiff: (diff) => {
        set({ activeDiff: diff });
      },

      clearDiff: () => {
        set({ activeDiff: null });
      },

      resetComponents: () => {
        set(initialComponentState);
      },
    }),
    {
      name: 'prismer-ws-components',
      storage: wsComponentStorage,
      version: 1,
      skipHydration: true,
      partialize: (state) => ({
        activeComponent: state.activeComponent,
        componentStates: state.componentStates,
      }),
    }
  )
);

// Selector hooks
export function useActiveComponent() {
  return useComponentStore((s) => s.activeComponent);
}

export function useComponentState<K extends keyof ComponentStates>(component: K) {
  return useComponentStore((s) => s.componentStates[component]);
}

export function useActiveDiff() {
  return useComponentStore((s) => s.activeDiff);
}
