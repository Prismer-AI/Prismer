/**
 * Skill Store - Frontend state management for skills
 *
 * Manages skill discovery, installation, and workspace skill state.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

// ============================================================
// Types
// ============================================================

export type SkillCategory =
  | 'latex'
  | 'jupyter'
  | 'pdf'
  | 'citation'
  | 'data'
  | 'writing'
  | 'general';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  version: string;
  installed: boolean;
  builtin: boolean;
  tools: string[];
  author?: string;
  repository?: string;
}

export interface SkillDetails {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  version: string;
  installed: boolean;
  builtin: boolean;
  tools: SkillTool[];
  dependencies: string[];
  author?: string;
  repository?: string;
}

export interface SkillTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface SkillState {
  // Data
  skills: Skill[];
  installedSkills: Skill[];
  selectedSkill: SkillDetails | null;
  categories: SkillCategory[];

  // UI State
  isLoading: boolean;
  isInstalling: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: SkillCategory | null;

  // Actions (agentId or workspaceId = which agent's installed state to show; when omitted, builtin-only as installed)
  fetchSkills: (options?: { query?: string; category?: SkillCategory; agentId?: string; workspaceId?: string }) => Promise<void>;
  fetchSkillDetails: (id: string) => Promise<void>;
  installSkill: (id: string, workspaceId?: string, agentId?: string) => Promise<boolean>;
  uninstallSkill: (id: string, agentId?: string, workspaceId?: string) => Promise<boolean>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: SkillCategory | null) => void;
  clearSelection: () => void;
  clearError: () => void;
}

// ============================================================
// Store Implementation
// ============================================================

export const useSkillStore = create<SkillState>()(
  devtools(
    (set, get) => ({
      // Initial state
      skills: [],
      installedSkills: [],
      selectedSkill: null,
      categories: ['latex', 'jupyter', 'pdf', 'citation', 'data', 'writing', 'general'],
      isLoading: false,
      isInstalling: false,
      error: null,
      searchQuery: '',
      selectedCategory: null,

      // Fetch skills from API (agentId => installed state reflects that agent)
      fetchSkills: async (options = {}) => {
        set({ isLoading: true, error: null });

        try {
          const params = new URLSearchParams();
          if (options.query) params.set('q', options.query);
          if (options.category) params.set('category', options.category);
          if (options.agentId) params.set('agentId', options.agentId);
          if (options.workspaceId) params.set('workspaceId', options.workspaceId);

          const response = await fetch(`/api/skills?${params.toString()}`);
          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || 'Failed to fetch skills');
          }

          const skills = data.data.skills as Skill[];
          const installed = skills.filter((s) => s.installed);

          set({
            skills,
            installedSkills: installed,
            categories: data.data.categories || get().categories,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch skills',
            isLoading: false,
          });
        }
      },

      // Fetch single skill details
      fetchSkillDetails: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`/api/skills/${id}`);
          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || 'Failed to fetch skill details');
          }

          set({
            selectedSkill: data.data as SkillDetails,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch skill details',
            isLoading: false,
          });
        }
      },

      // Install skill (agentId or workspaceId for which agent to install to)
      installSkill: async (id: string, workspaceId?: string, agentId?: string) => {
        set({ isInstalling: true, error: null });

        try {
          const response = await fetch(`/api/skills/${id}/install`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentInstanceId: agentId, workspaceId }),
          });
          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || 'Failed to install skill');
          }

          await get().fetchSkills({ agentId, workspaceId });

          set({ isInstalling: false });
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to install skill',
            isInstalling: false,
          });
          return false;
        }
      },

      // Uninstall skill (agentId or workspaceId for which agent to uninstall from)
      uninstallSkill: async (id: string, agentId?: string, workspaceId?: string) => {
        set({ isInstalling: true, error: null });

        try {
          const params = new URLSearchParams();
          if (agentId) params.set('agentInstanceId', agentId);
          if (workspaceId) params.set('workspaceId', workspaceId);
          const qs = params.toString();
          const response = await fetch(`/api/skills/${id}${qs ? `?${qs}` : ''}`, {
            method: 'DELETE',
          });
          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || 'Failed to uninstall skill');
          }

          await get().fetchSkills({ agentId, workspaceId });

          set({ isInstalling: false });
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to uninstall skill',
            isInstalling: false,
          });
          return false;
        }
      },

      // UI actions
      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      setSelectedCategory: (category: SkillCategory | null) => {
        set({ selectedCategory: category });
      },

      clearSelection: () => {
        set({ selectedSkill: null });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'skill-store' }
  )
);

// ============================================================
// Selector Hooks
// ============================================================

export function useSkills() {
  return useSkillStore((state) => state.skills);
}

export function useInstalledSkills() {
  return useSkillStore((state) => state.installedSkills);
}

export function useSelectedSkill() {
  return useSkillStore((state) => state.selectedSkill);
}

export function useSkillLoading() {
  return useSkillStore(
    useShallow((state) => ({
      isLoading: state.isLoading,
      isInstalling: state.isInstalling,
      error: state.error,
    }))
  );
}

export function useSkillActions() {
  return useSkillStore(
    useShallow((state) => ({
      fetchSkills: state.fetchSkills,
      fetchSkillDetails: state.fetchSkillDetails,
      installSkill: state.installSkill,
      uninstallSkill: state.uninstallSkill,
      setSearchQuery: state.setSearchQuery,
      setSelectedCategory: state.setSelectedCategory,
      clearSelection: state.clearSelection,
      clearError: state.clearError,
    }))
  );
}

export function useSkillFilters() {
  return useSkillStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      selectedCategory: state.selectedCategory,
      categories: state.categories,
    }))
  );
}

// ============================================================
// Filtered Skills Selector
// ============================================================

export function useFilteredSkills() {
  const skills = useSkillStore((state) => state.skills);
  const searchQuery = useSkillStore((state) => state.searchQuery);
  const selectedCategory = useSkillStore((state) => state.selectedCategory);

  return skills.filter((skill) => {
    // Filter by category
    if (selectedCategory && skill.category !== selectedCategory) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        skill.id.toLowerCase().includes(q) ||
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q)
      );
    }

    return true;
  });
}
