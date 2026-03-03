/**
 * Container Compatibility Checker
 *
 * Validates that container component versions match what the backend expects.
 * Uses docker/compatibility.json as the source of truth for expected versions.
 */

import compatibilityData from '../../../docker/compatibility.json';

// ============================================================
// Types
// ============================================================

export interface ComponentCompatibility {
  version: string;
  minBackendApi: string;
  description: string;
}

export interface CompatibilityMatrix {
  imageVersion: string;
  components: Record<string, ComponentCompatibility>;
  backendApiVersion: string;
}

export interface CompatibilityResult {
  /** All versions match */
  compatible: boolean;
  /** List of version mismatches */
  mismatches: Array<{
    component: string;
    expected: string;
    actual: string | null;
  }>;
  /** Container-reported versions (if available) */
  containerVersions: Record<string, string>;
}

// ============================================================
// Compatibility Matrix
// ============================================================

export const COMPATIBILITY: CompatibilityMatrix = compatibilityData as CompatibilityMatrix;

// ============================================================
// Check Function
// ============================================================

/**
 * Check container component versions against the compatibility matrix.
 *
 * @param containerVersions - Versions reported by the container (from gateway root `/`)
 * @returns Compatibility result with any mismatches
 */
export function checkVersionCompatibility(
  containerVersions: Record<string, string>,
): CompatibilityResult {
  const mismatches: CompatibilityResult['mismatches'] = [];

  for (const [name, expected] of Object.entries(COMPATIBILITY.components)) {
    const actual = containerVersions[name] ?? null;
    if (actual !== null && actual !== expected.version) {
      mismatches.push({ component: name, expected: expected.version, actual });
    } else if (actual === null) {
      mismatches.push({ component: name, expected: expected.version, actual: null });
    }
  }

  return {
    compatible: mismatches.length === 0,
    mismatches,
    containerVersions,
  };
}
