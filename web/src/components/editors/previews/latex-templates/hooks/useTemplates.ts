"use client";

import { useState, useCallback, useMemo } from "react";
import { templateService } from "../services/TemplateService";
import type {
  TemplateMetadata,
  TemplateFiles,
  TemplateFilters,
  TemplateCategory,
  ServiceResponse,
} from "../types";

// ============================================================
// useTemplates Hook
// ============================================================

interface UseTemplatesReturn {
  // Data
  templates: TemplateMetadata[];
  categories: ReturnType<typeof templateService.getCategories>;
  featuredTemplates: TemplateMetadata[];
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Filters
  filters: TemplateFilters;
  setFilters: (filters: TemplateFilters) => void;
  setSearchQuery: (query: string) => void;
  setCategory: (category: TemplateCategory | null) => void;
  clearFilters: () => void;
  
  // Actions
  downloadTemplate: (id: string) => Promise<ServiceResponse<TemplateFiles>>;
  importFromGitHub: (url: string) => Promise<ServiceResponse<TemplateFiles>>;
  searchGitHub: (query: string) => Promise<ServiceResponse<TemplateMetadata[]>>;
}

export function useTemplates(): UseTemplatesReturn {
  const [filters, setFilters] = useState<TemplateFilters>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get categories
  const categories = useMemo(() => {
    return templateService.getCategories();
  }, []);

  // Get featured templates
  const featuredTemplates = useMemo(() => {
    return templateService.getFeaturedTemplates(8);
  }, []);

  // Filter templates
  const templates = useMemo(() => {
    return templateService.searchTemplates(filters);
  }, [filters]);

  // Update search query
  const setSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, query }));
  }, []);

  // Update category filter
  const setCategory = useCallback((category: TemplateCategory | null) => {
    setFilters(prev => ({ 
      ...prev, 
      category: category || undefined 
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Download template
  const downloadTemplate = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await templateService.downloadTemplate(id);
      if (!result.success) {
        setError(result.error || "Download failed");
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Import from GitHub
  const importFromGitHub = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await templateService.importFromGitHub(url);
      if (!result.success) {
        setError(result.error || "Import failed");
      }
      return {
        success: result.success,
        data: result.data?.files,
        error: result.error,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search GitHub
  const searchGitHub = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await templateService.searchGitHub(query);
      if (!result.success) {
        setError(result.error || "Search failed");
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    templates,
    categories,
    featuredTemplates,
    isLoading,
    error,
    filters,
    setFilters,
    setSearchQuery,
    setCategory,
    clearFilters,
    downloadTemplate,
    importFromGitHub,
    searchGitHub,
  };
}
