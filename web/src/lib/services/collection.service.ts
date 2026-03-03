/**
 * Collection Service — stub for open-source version
 * Remote collection features are not available in local mode.
 */

export const collectionService = {
  create: async (..._args: unknown[]) => ({ id: 0 }),
  findByUser: async (..._args: unknown[]) => [],
  addAsset: async (..._args: unknown[]) => null,
  getById: async (..._args: unknown[]) => null,
};
