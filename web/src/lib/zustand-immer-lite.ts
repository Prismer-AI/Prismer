import type { StoreApi } from 'zustand';

type ImmerSet<T> = (fn: T | Partial<T> | ((draft: T) => void)) => void;
type ImmerGet<T> = () => T;
type ImmerInitializer<T> = (set: ImmerSet<T>, get: ImmerGet<T>, store: StoreApi<T>) => T;

/**
 * Lightweight immer-like middleware for Zustand.
 *
 * Supports mutative updater functions without requiring the `immer` package.
 * When an updater mutates state in place and returns void, we return a shallow
 * copy to ensure Zustand emits updates.
 */
export function immer<T>(initializer: ImmerInitializer<T>) {
  return (origSet: StoreApi<T>['setState'], get: () => T, store: StoreApi<T>): T => {
    const wrappedSet: ImmerSet<T> = (partial) => {
      if (typeof partial === 'function') {
        origSet((state: T) => {
          const result = (partial as (draft: T) => unknown)(state);
          if (result === undefined) {
            return { ...(state as object) } as T;
          }
          return result as T | Partial<T>;
        });
        return;
      }
      origSet(partial as T | Partial<T>);
    };
    return initializer(wrappedSet, get, store);
  };
}

