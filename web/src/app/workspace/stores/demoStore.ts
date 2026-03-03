/**
 * Demo Store
 *
 * Manages demo flow playback state and interaction tracking.
 */

import { create } from 'zustand';
import type { DemoFlowConfig, InteractionEvent } from '../types';
import { useChatStore } from './chatStore';
import { useTimelineStore } from './timelineStore';

interface DemoState {
  demoConfig: DemoFlowConfig | null;
  currentDemoStepIndex: number;
  isDemoRunning: boolean;
}

interface DemoActions {
  loadDemoConfig: (config: DemoFlowConfig) => void;
  startDemo: () => void;
  pauseDemo: () => void;
  nextDemoStep: () => Promise<void>;
  prevDemoStep: () => void;
  goToDemoStep: (index: number) => Promise<void>;
  handleInteraction: (event: InteractionEvent) => Promise<void>;
  resetDemo: () => void;
}

const initialDemoState: DemoState = {
  demoConfig: null,
  currentDemoStepIndex: -1,
  isDemoRunning: false,
};

export const useDemoStore = create<DemoState & DemoActions>()(
  (set, get) => ({
    ...initialDemoState,

    loadDemoConfig: (config) => {
      set({
        demoConfig: config,
        currentDemoStepIndex: -1,
        isDemoRunning: false,
      });
    },

    startDemo: () => {
      const state = get();
      if (!state.demoConfig) return;
      set({ isDemoRunning: true });
      get().nextDemoStep();
    },

    pauseDemo: () => {
      set({ isDemoRunning: false });
    },

    nextDemoStep: async () => {
      const state = get();
      if (!state.demoConfig) return;

      const nextIndex = state.currentDemoStepIndex + 1;
      if (nextIndex >= state.demoConfig.steps.length) {
        set({ isDemoRunning: false });
        return;
      }

      await get().goToDemoStep(nextIndex);
    },

    prevDemoStep: () => {
      const state = get();
      if (!state.demoConfig || state.currentDemoStepIndex <= 0) return;
      get().goToDemoStep(state.currentDemoStepIndex - 1);
    },

    goToDemoStep: async (index) => {
      const state = get();
      if (!state.demoConfig || index < 0 || index >= state.demoConfig.steps.length) return;

      const step = state.demoConfig.steps[index];
      set({ currentDemoStepIndex: index });

      const chatStore = useChatStore.getState();
      const timelineStore = useTimelineStore.getState();

      for (const message of step.messages) {
        chatStore.addMessage(message);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      for (const event of step.timelineEvents) {
        timelineStore.addTimelineEvent(event);
        if (event.stateSnapshot) {
          timelineStore.addSnapshot(event.stateSnapshot);
        }
      }
    },

    handleInteraction: async (event) => {
      useChatStore.getState().markInteractionComplete(event.componentId);
      console.log('[Interaction]', event);
      useTimelineStore.getState().captureSnapshot();
    },

    resetDemo: () => {
      set(initialDemoState);
    },
  })
);

// Selector hook
export function useDemoState() {
  const demoConfig = useDemoStore((s) => s.demoConfig);
  const currentDemoStepIndex = useDemoStore((s) => s.currentDemoStepIndex);
  const isDemoRunning = useDemoStore((s) => s.isDemoRunning);

  return {
    demoConfig,
    currentStep: currentDemoStepIndex >= 0 && demoConfig
      ? demoConfig.steps[currentDemoStepIndex]
      : null,
    currentStepIndex: currentDemoStepIndex,
    totalSteps: demoConfig?.steps.length ?? 0,
    isRunning: isDemoRunning,
  };
}
