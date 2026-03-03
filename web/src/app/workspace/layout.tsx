/**
 * Workspace Layout
 * Workspace-only shell layout for open-source release.
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspace | Prismer',
  description: 'Organize your research projects',
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
