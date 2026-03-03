/**
 * Workspace Files Sync API - 批量同步
 *
 * POST /api/workspace/[id]/files/sync - Diff-based 文件同步
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createHash } from 'crypto';

interface Params {
  params: Promise<{ id: string }>;
}

interface FileManifestEntry {
  path: string;
  hash: string;
}

interface SyncRequest {
  files: FileManifestEntry[];
}

/**
 * 计算内容的 SHA256 哈希
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * POST /api/workspace/[id]/files/sync
 *
 * 基于 hash 的 diff 同步
 *
 * Request body:
 * {
 *   files: [{ path: string, hash: string }]
 * }
 *
 * Response:
 * {
 *   toUpload: string[],    // 客户端需要上传的文件路径 (服务端没有或 hash 不同)
 *   toDownload: string[],  // 客户端需要下载的文件路径 (服务端有但客户端没有)
 *   conflicts: [{          // 冲突文件 (双方都有修改)
 *     path: string,
 *     clientHash: string,
 *     serverHash: string
 *   }],
 *   unchanged: string[]    // 无需操作的文件
 * }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: workspaceId } = await params;
    const body: SyncRequest = await request.json();
    const { files: clientFiles } = body;

    // 参数验证
    if (!Array.isArray(clientFiles)) {
      return NextResponse.json(
        { success: false, error: 'files must be an array' },
        { status: 400 }
      );
    }

    // 验证 workspace 存在
    const workspace = await prisma.workspaceSession.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // 获取服务端文件列表
    const serverFiles = await prisma.workspaceFile.findMany({
      where: { workspaceId },
      select: {
        path: true,
        contentHash: true,
      },
    });

    // 构建 Map 方便查找
    const clientMap = new Map<string, string>();
    for (const f of clientFiles) {
      if (f.path && f.hash) {
        clientMap.set(f.path, f.hash);
      }
    }

    const serverMap = new Map<string, string>();
    for (const f of serverFiles) {
      serverMap.set(f.path, f.contentHash);
    }

    // 计算 diff
    const toUpload: string[] = [];
    const toDownload: string[] = [];
    const conflicts: { path: string; clientHash: string; serverHash: string }[] = [];
    const unchanged: string[] = [];

    // 检查客户端文件
    clientMap.forEach((clientHash, path) => {
      const serverHash = serverMap.get(path);

      if (!serverHash) {
        // 服务端没有，客户端需要上传
        toUpload.push(path);
      } else if (clientHash === serverHash) {
        // 相同，无需操作
        unchanged.push(path);
      } else {
        // 不同，标记为冲突 (简单策略: 服务端优先，客户端需要下载)
        // 高级策略可以根据时间戳或版本号判断
        conflicts.push({ path, clientHash, serverHash });
      }
    });

    // 检查服务端有但客户端没有的文件
    serverMap.forEach((_, path) => {
      if (!clientMap.has(path)) {
        toDownload.push(path);
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        toUpload,
        toDownload,
        conflicts,
        unchanged,
        summary: {
          upload: toUpload.length,
          download: toDownload.length,
          conflict: conflicts.length,
          unchanged: unchanged.length,
        },
      },
    });
  } catch (error) {
    console.error('POST /api/workspace/[id]/files/sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspace/[id]/files/sync
 *
 * 批量更新文件 (用于客户端上传)
 *
 * Request body:
 * {
 *   files: [{
 *     path: string,
 *     content: string
 *   }]
 * }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: workspaceId } = await params;
    const body = await request.json();
    const { files } = body;

    // 参数验证
    if (!Array.isArray(files)) {
      return NextResponse.json(
        { success: false, error: 'files must be an array' },
        { status: 400 }
      );
    }

    // 验证 workspace 存在
    const workspace = await prisma.workspaceSession.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // 批量 upsert
    const results: { path: string; hash: string; created: boolean }[] = [];

    for (const file of files) {
      if (!file.path || typeof file.content !== 'string') {
        continue;
      }

      const normalizedPath = file.path.replace(/^\/+/, '').replace(/\/+/g, '/');
      const contentHash = hashContent(file.content);

      const existing = await prisma.workspaceFile.findUnique({
        where: {
          workspaceId_path: { workspaceId, path: normalizedPath },
        },
      });

      await prisma.workspaceFile.upsert({
        where: {
          workspaceId_path: { workspaceId, path: normalizedPath },
        },
        update: {
          content: file.content,
          contentHash,
        },
        create: {
          workspaceId,
          path: normalizedPath,
          content: file.content,
          contentHash,
        },
      });

      results.push({
        path: normalizedPath,
        hash: contentHash,
        created: !existing,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: results.length,
        files: results,
      },
    });
  } catch (error) {
    console.error('PUT /api/workspace/[id]/files/sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
