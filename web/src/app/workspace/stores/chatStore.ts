/**
 * Chat Store
 *
 * Manages workspace chat messages, participants, and interaction tracking.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createWorkspaceIsolatedStorage } from '@/lib/storage/userStorageManager';
import type { Participant, ExtendedChatMessage } from '../types';

const { storage: wsChatStorage, setWorkspaceId: setChatStoreWorkspaceId } =
  createWorkspaceIsolatedStorage<Pick<ChatState, 'messages' | 'completedInteractions' | 'sessions' | 'activeSessionId'>>('prismer-ws-chat', true);

export { setChatStoreWorkspaceId };

export interface ChatSession {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  preview: string;
}

interface ToolCallEntry {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  success?: boolean;
}

interface ChatState {
  messages: ExtendedChatMessage[];
  participants: Participant[];
  completedInteractions: Set<string>;
  thinkingStatus: string | null;
  /** Extended thinking content from agent (may be streamed incrementally) */
  thinkingContent: string | null;
  /** Current tool call being executed (for display in thinking panel) */
  currentToolCall: ToolCallEntry | null;
  /** History of tool calls in current interaction */
  toolCallHistory: ToolCallEntry[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  /** When viewing a historical snapshot, messages after this index are grayed out */
  visibleMessageBound: number | null;
}

interface ChatActions {
  addMessage: (message: ExtendedChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ExtendedChatMessage>) => void;
  clearMessages: () => void;
  setParticipants: (participants: Participant[]) => void;
  setMessages: (messages: ExtendedChatMessage[]) => void;
  addMessageIfNew: (message: ExtendedChatMessage) => boolean;
  markInteractionComplete: (componentId: string) => void;
  setCompletedInteractions: (interactions: Set<string> | string[]) => void;
  addCompletedInteraction: (componentId: string) => void;
  setThinkingStatus: (status: string | null) => void;
  setThinkingContent: (content: string | null) => void;
  startToolCall: (id: string, name: string) => void;
  endToolCall: (id: string, success: boolean) => void;
  clearToolCalls: () => void;
  /** Set visible message boundary for timeline history view */
  restoreToMessageIndex: (messageCount: number) => void;
  /** Exit history view mode — clear boundary, show all messages */
  exitHistoryView: () => void;
  startNewSession: (title?: string) => void;
  switchToSession: (sessionId: string) => void;
  computeSessions: () => void;
  resetChat: () => void;
}

const initialChatState: ChatState = {
  messages: [],
  participants: [],
  completedInteractions: new Set<string>(),
  thinkingStatus: null,
  thinkingContent: null,
  currentToolCall: null,
  toolCallHistory: [],
  sessions: [],
  activeSessionId: null,
  visibleMessageBound: null,
};

export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    (set, get) => ({
      ...initialChatState,

      addMessage: (message) => {
        set((state) => ({
          messages: [...state.messages, message],
        }));
      },

      updateMessage: (id, updates) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }));
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      setParticipants: (participants) => {
        set({ participants });
      },

      setMessages: (messages) => {
        set({ messages });
      },

      addMessageIfNew: (message) => {
        const state = get();
        if (state.messages.some((m) => m.id === message.id)) {
          return false;
        }
        set((prev) => ({
          messages: [...prev.messages, message],
        }));
        return true;
      },

      markInteractionComplete: (componentId) => {
        set((state) => ({
          completedInteractions: new Set([...state.completedInteractions, componentId]),
        }));
      },

      setCompletedInteractions: (interactions) => {
        const interactionSet = interactions instanceof Set
          ? interactions
          : new Set(interactions);
        set({ completedInteractions: interactionSet });
      },

      addCompletedInteraction: (componentId) => {
        set((state) => {
          if (state.completedInteractions.has(componentId)) {
            return state;
          }
          return {
            completedInteractions: new Set([...state.completedInteractions, componentId]),
          };
        });
      },

      setThinkingStatus: (status) => {
        set({ thinkingStatus: status });
      },

      setThinkingContent: (content) => {
        set({ thinkingContent: content });
      },

      startToolCall: (id, name) => {
        const entry: ToolCallEntry = { id, name, startedAt: Date.now() };
        set((state) => ({
          currentToolCall: entry,
          toolCallHistory: [...state.toolCallHistory, entry],
        }));
      },

      endToolCall: (id, success) => {
        set((state) => ({
          currentToolCall: state.currentToolCall?.id === id ? null : state.currentToolCall,
          toolCallHistory: state.toolCallHistory.map((t) =>
            t.id === id ? { ...t, endedAt: Date.now(), success } : t
          ),
        }));
      },

      clearToolCalls: () => {
        set({ currentToolCall: null, toolCallHistory: [] });
      },

      restoreToMessageIndex: (messageCount) => {
        set({ visibleMessageBound: messageCount });
      },

      exitHistoryView: () => {
        set({ visibleMessageBound: null });
      },

      startNewSession: (title) => {
        const sessionId = `session-${Date.now()}`;
        const sessionTitle = title || `Session ${(get().sessions.length || 0) + 1}`;
        const now = new Date().toISOString();

        // End the current active session
        const sessions = get().sessions.map((s) =>
          s.id === get().activeSessionId ? { ...s, endedAt: now } : s
        );

        // Insert session boundary marker into messages
        const boundaryMessage: ExtendedChatMessage = {
          id: `boundary-${sessionId}`,
          workspaceId: '',
          senderId: 'system',
          senderType: 'agent',
          senderName: 'System',
          content: '',
          contentType: 'text',
          timestamp: now,
          metadata: { isSessionBoundary: true, sessionId, sessionTitle },
        };

        // Create new session
        const newSession: ChatSession = {
          id: sessionId,
          title: sessionTitle,
          startedAt: now,
          endedAt: null,
          messageCount: 0,
          preview: '',
        };

        set((state) => ({
          messages: [...state.messages, boundaryMessage],
          sessions: [...sessions, newSession],
          activeSessionId: sessionId,
        }));
      },

      switchToSession: (sessionId) => {
        set({ activeSessionId: sessionId });
        // Scroll to session boundary in the DOM
        setTimeout(() => {
          const el = document.getElementById(`session-boundary-${sessionId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      },

      computeSessions: () => {
        const { messages } = get();
        const sessions: ChatSession[] = [];
        let currentSession: ChatSession | null = null;

        for (const msg of messages) {
          if (msg.metadata?.isSessionBoundary) {
            // End previous session
            if (currentSession) {
              currentSession.endedAt = msg.timestamp;
              sessions.push(currentSession);
            }
            // Start new session from boundary
            currentSession = {
              id: msg.metadata.sessionId as string,
              title: (msg.metadata.sessionTitle as string) || 'Untitled',
              startedAt: msg.timestamp,
              endedAt: null,
              messageCount: 0,
              preview: '',
            };
          } else if (msg.senderType === 'user' || msg.senderType === 'agent') {
            if (!currentSession) {
              // First messages before any boundary → implicit "Session 1"
              currentSession = {
                id: 'session-initial',
                title: 'Session 1',
                startedAt: msg.timestamp,
                endedAt: null,
                messageCount: 0,
                preview: '',
              };
            }
            currentSession.messageCount++;
            if (!currentSession.preview && msg.senderType === 'user') {
              currentSession.preview = msg.content.slice(0, 60);
            }
          }
        }

        // Push last session
        if (currentSession) {
          sessions.push(currentSession);
        }

        const activeId = sessions.length > 0 ? sessions[sessions.length - 1].id : null;
        set({ sessions, activeSessionId: activeId });
      },

      resetChat: () => {
        set(initialChatState);
      },
    }),
    {
      name: 'prismer-ws-chat',
      storage: wsChatStorage,
      version: 1,
      skipHydration: true,
      partialize: (state) => ({
        messages: state.messages.slice(-200),
        completedInteractions: [...state.completedInteractions] as unknown as Set<string>,
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ChatState>;
        return {
          ...currentState,
          ...persisted,
          completedInteractions: persisted?.completedInteractions
            ? new Set(persisted.completedInteractions as unknown as string[])
            : currentState.completedInteractions,
          sessions: persisted?.sessions || currentState.sessions,
          activeSessionId: persisted?.activeSessionId || currentState.activeSessionId,
        };
      },
    }
  )
);

// Selector hooks
export function useCompletedInteractions() {
  return useChatStore((s) => s.completedInteractions);
}
