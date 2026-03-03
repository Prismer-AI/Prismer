/**
 * Workspace File Sync Service
 *
 * Downloads files from the container (via proxy) and uploads to S3,
 * then creates an asset in remote MySQL and links it to the
 * workspace collection.
 *
 * Triggered asynchronously by the directive receiver when a directive
 * contains file references (e.g., LATEX_COMPILE_COMPLETE with pdfUrl).
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { proxyToContainer } from '@/lib/container/client';
import { createLogger } from '@/lib/logger';
import prisma from '@/lib/prisma';

const log = createLogger('WorkspaceFileSync');

interface FileSyncResult {
  success: boolean;
  assetId?: number;
  s3Key?: string;
  error?: string;
}

interface FileSyncOptions {
  workspaceId: string;
  title: string;
  assetType: 'paper' | 'note';
  contentType?: string;
}

/**
 * Download a file from the container and sync it to S3 + collection.
 *
 * @param agentId - Agent instance ID (for container proxy routing)
 * @param service - Container service ('latex' | 'jupyter')
 * @param containerPath - Path within the container service
 * @param options - Workspace and asset metadata
 */
export async function syncFileFromContainer(
  agentId: string,
  service: 'latex' | 'jupyter',
  containerPath: string,
  options: FileSyncOptions
): Promise<FileSyncResult> {
  try {
    log.info('Starting file sync', {
      agentId,
      service,
      containerPath,
      workspaceId: options.workspaceId,
    });

    // Step 1: Download from container via proxy
    const result = await proxyToContainer(agentId, service, containerPath, {
      method: 'GET',
    });

    if (!result.ok) {
      throw new Error(`Container returned ${result.status}: ${result.statusText}`);
    }

    // Step 2: Upload to S3
    const filename = containerPath.split('/').pop() || 'file';
    const s3Key = `workspace/${options.workspaceId}/${service}/${Date.now()}-${filename}`;

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      throw new Error('[WorkspaceFileSync] AWS credentials and bucket must be configured');
    }
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const bodyBuffer = result.body instanceof ArrayBuffer
      ? Buffer.from(result.body)
      : Buffer.from(result.body as string, 'binary');

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Body: bodyBuffer,
      ContentType: options.contentType || result.contentType || 'application/octet-stream',
    }));

    log.info('File uploaded to S3', { s3Key, size: bodyBuffer.length });

    // Step 3: Create asset in remote MySQL
    const { assetService } = await import('./asset.service');
    const { getRemoteUserId } = await import('./workspace.service');
    const userId = getRemoteUserId();
    const asset = await assetService.create({
      userId,
      assetType: options.assetType,
      title: options.title,
      source: 'upload',
      pdfS3Key: s3Key,
      metadata: {
        sourceId: `workspace:${options.workspaceId}`,
        fileName: filename,
      },
    });

    // Step 4: Link to workspace collection
    const workspace = await prisma.workspaceSession.findUnique({
      where: { id: options.workspaceId },
      select: { settings: true },
    });

    if (workspace?.settings) {
      const settings = JSON.parse(workspace.settings as string);
      if (settings.collectionId) {
        const { collectionService } = await import('./collection.service');
        await collectionService.addAsset(settings.collectionId, asset.id, userId);
        log.info('Asset linked to workspace collection', {
          assetId: asset.id,
          collectionId: settings.collectionId,
        });
      }
    }

    log.info('File sync complete', { agentId, s3Key, assetId: asset.id });
    return { success: true, assetId: asset.id, s3Key };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error('File sync failed', {
      agentId,
      service,
      containerPath,
      error: errorMsg,
    });
    return { success: false, error: errorMsg };
  }
}
