// Mock flow store for standalone PDF reader
import { create } from "zustand";

interface FlowState {
  pendingItems: unknown[];
  setPendingItems: (items: unknown[]) => Promise<void>;
}

export const useFlowStore = create<FlowState>((set) => ({
  pendingItems: [],
  setPendingItems: async (items) => {
    console.log("[Mock FlowStore] setPendingItems:", items);
    set({ pendingItems: items });
  },
}));

