/**
 * useContentSync — Debounced content synchronization hook
 *
 * Provides debounced content change handlers that update componentStore.
 * Used by editor components (LaTeX, Code, Notes) to avoid flooding
 * the sync engine with every keystroke.
 *
 * @example
 * ```typescript
 * const syncContent = useContentSync('latex-editor', 'content', 500);
 *
 * // In your onChange handler:
 * const handleChange = (newContent: string) => {
 *   syncContent(newContent);
 * };
 * ```
 */

'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useComponentStore } from '@/app/workspace/stores/componentStore';
import type { ComponentStates } from '@/types/workspace';

/**
 * Create a debounced content sync function for a specific component field.
 *
 * @param componentType - Which component (e.g., 'latex-editor')
 * @param fieldName - Which field to sync (e.g., 'content')
 * @param delayMs - Debounce delay in milliseconds (default: 500)
 */
export function useContentSync<K extends keyof ComponentStates>(
  componentType: K,
  fieldName: string,
  delayMs = 500
): (value: unknown) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateComponentState = useComponentStore((s) => s.updateComponentState);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useCallback(
    (value: unknown) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        updateComponentState(componentType, {
          [fieldName]: value,
        } as Partial<ComponentStates[K]>);
      }, delayMs);
    },
    [componentType, fieldName, delayMs, updateComponentState]
  );
}

/**
 * Create a debounced sync function for multiple fields at once.
 *
 * @example
 * ```typescript
 * const syncState = useMultiFieldContentSync('code-playground', 300);
 * syncState({ selectedFile: 'index.ts', mode: 'frontend' });
 * ```
 */
export function useMultiFieldContentSync<K extends keyof ComponentStates>(
  componentType: K,
  delayMs = 500
): (fields: Partial<ComponentStates[K]>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<ComponentStates[K]>>({});
  const updateComponentState = useComponentStore((s) => s.updateComponentState);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useCallback(
    (fields: Partial<ComponentStates[K]>) => {
      // Merge pending updates
      pendingRef.current = { ...pendingRef.current, ...fields };

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        updateComponentState(componentType, pendingRef.current);
        pendingRef.current = {};
      }, delayMs);
    },
    [componentType, delayMs, updateComponentState]
  );
}
