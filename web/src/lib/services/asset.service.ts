/**
 * Asset Service — stub for open-source version
 * Remote asset features are not available in local mode.
 */

export const assetService = {
  create: async (..._args: unknown[]) => ({ id: 0 }),
  findByUser: async (..._args: unknown[]) => [],
  findById: async (..._args: unknown[]) => null,
  update: async (..._args: unknown[]) => null,
};
