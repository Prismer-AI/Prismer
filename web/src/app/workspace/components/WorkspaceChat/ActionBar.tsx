'use client';

/**
 * ActionBar
 *
 * Floating action bar above the input - renders interactive components
 * from the latest agent message. Hides after user interacts.
 */

import React, { memo, useMemo } from 'react';
import { InteractiveComponentRenderer } from '../InteractiveComponents';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import type { ExtendedChatMessage, InteractionEvent } from '../../types';

interface ActionBarProps {
  messages: ExtendedChatMessage[];
  onInteraction: (event: InteractionEvent) => void;
}

export const ActionBar = memo(function ActionBar({
  messages,
  onInteraction,
}: ActionBarProps) {
  // Get completed interactions from store
  const completedInteractions = useWorkspaceStore((state) => state.completedInteractions);

  // Find the latest message with interactive components that hasn't been completed
  const latestInteractiveMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.interactiveComponents && msg.interactiveComponents.length > 0) {
        // Check if any component in this message hasn't been interacted with
        const hasUncompletedComponent = msg.interactiveComponents.some(
          (comp) => !completedInteractions.has(comp.id)
        );
        if (hasUncompletedComponent) {
          // Filter to only show uncompleted components
          return {
            ...msg,
            interactiveComponents: msg.interactiveComponents.filter(
              (comp) => !completedInteractions.has(comp.id)
            ),
          };
        }
      }
    }
    return null;
  }, [messages, completedInteractions]);

  if (!latestInteractiveMessage || latestInteractiveMessage.interactiveComponents!.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2">
      <InteractiveComponentRenderer
        components={latestInteractiveMessage.interactiveComponents!}
        messageId={latestInteractiveMessage.id}
        onInteraction={onInteraction}
        layout="horizontal"
      />
    </div>
  );
});

export default ActionBar;
