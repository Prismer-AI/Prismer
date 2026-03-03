/**
 * Container Image Version — Single Source of Truth
 *
 * ALL references to the container image tag MUST import from this file.
 * When bumping the container version:
 *   1. Update CONTAINER_IMAGE_VERSION here
 *   2. Follow the full checklist in docs/CONTAINER_PROTOCOL.md
 */

export const CONTAINER_BASE_VERSION = '5.0';
export const CONTAINER_IMAGE_VERSION = '5.0';
export const CONTAINER_IMAGE_TAG = `v${CONTAINER_IMAGE_VERSION}-openclaw`;
export const CONTAINER_IMAGE =
  process.env.CONTAINER_IMAGE || `prismer-academic:${CONTAINER_IMAGE_TAG}`;
