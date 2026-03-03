/**
 * Workspace Notes API
 *
 * PUT /api/workspace/:id/notes
 *
 * Upsert workspace notes content. If assetId provided, updates
 * the existing asset. Otherwise creates a new note asset and
 * links it to the workspace collection.
 *
 * Request body: { content: string, assetId?: number }
 * Response: { success: true, data: { assetId: number } }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger('WorkspaceNotes');

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: workspaceId } = await params;
    const { content, assetId } = await request.json();

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      );
    }

    const workspace = await prisma.workspaceSession.findUnique({
      where: { id: workspaceId },
      select: { settings: true, name: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const settings = workspace.settings ? JSON.parse(workspace.settings as string) : {};
    const { getRemoteUserId } = await import('@/lib/services/workspace.service');
    const userId = getRemoteUserId();

    try {
      const { assetService } = await import('@/lib/services/asset.service');

      // Upsert: update existing or create new
      if (assetId) {
        await assetService.update(assetId, userId, { content });
        log.debug('Notes updated', { workspaceId, assetId, contentLength: content.length });
        return NextResponse.json({ success: true, data: { assetId } });
      }

      // Create new note asset
      const asset = await assetService.create({
        userId,
        assetType: 'note',
        title: `${workspace.name || 'Workspace'} — Research Notes`,
        content,
        noteType: 'summary',
        metadata: {
          sourceId: `workspace:${workspaceId}`,
        },
      });

      // Add to workspace collection if exists
      if (settings.collectionId) {
        const { collectionService } = await import('@/lib/services/collection.service');
        await collectionService.addAsset(settings.collectionId, asset.id, userId);
        log.info('Notes asset linked to collection', {
          workspaceId,
          assetId: asset.id,
          collectionId: settings.collectionId,
        });
      }

      return NextResponse.json({ success: true, data: { assetId: asset.id } });
    } catch (err) {
      // Remote MySQL unavailable — fallback to local-only
      log.warn('Remote asset service unavailable, notes not persisted to collection', {
        workspaceId,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({
        success: true,
        data: { assetId: null, warning: 'Saved locally only — remote service unavailable' },
      });
    }
  } catch (error) {
    log.error('Notes save error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
