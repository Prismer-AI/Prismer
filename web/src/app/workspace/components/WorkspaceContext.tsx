'use client';

import { createContext, useContext } from 'react';

interface WorkspaceContextValue {
  workspaceId: string;
}

export const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaceId: 'default',
});

export function useWorkspaceId(): string {
  return useContext(WorkspaceContext).workspaceId;
}
