/**
 * Workspace File API - 单个文件操作
 *
 * GET    /api/workspace/[id]/files/[...path] - 读取文件内容
 * PUT    /api/workspace/[id]/files/[...path] - 更新文件内容
 * DELETE /api/workspace/[id]/files/[...path] - 删除文件
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createHash } from 'crypto';

interface Params {
  params: Promise<{ id: string; path: string[] }>;
}

/**
 * 计算内容的 SHA256 哈希
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * 从 path 数组构建文件路径
 */
function buildPath(pathSegments: string[]): string {
  return pathSegments.join('/');
}

/**
 * GET /api/workspace/[id]/files/[...path]
 *
 * 读取文件内容
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: workspaceId, path: pathSegments } = await params;
    const filePath = buildPath(pathSegments);

    const file = await prisma.workspaceFile.findUnique({
      where: {
        workspaceId_path: { workspaceId, path: filePath },
      },
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: file.id,
        path: file.path,
        content: file.content,
        hash: file.contentHash,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('GET /api/workspace/[id]/files/[...path] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspace/[id]/files/[...path]
 *
 * 更新文件内容 (upsert 语义)
 *
 * Request body:
 * {
 *   content: string,       // 新内容
 *   expectedHash?: string  // 可选: 期望的当前哈希，用于冲突检测
 * }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: workspaceId, path: pathSegments } = await params;
    const filePath = buildPath(pathSegments);
    const body = await request.json();
    const { content, expectedHash } = body;

    // 参数验证
    if (content === undefined || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'content is required' },
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

    // 检查现有文件
    const existing = await prisma.workspaceFile.findUnique({
      where: {
        workspaceId_path: { workspaceId, path: filePath },
      },
    });

    // 冲突检测
    if (expectedHash && existing && existing.contentHash !== expectedHash) {
      return NextResponse.json(
        {
          success: false,
          error: 'Content has been modified',
          code: 'CONFLICT',
          currentHash: existing.contentHash,
        },
        { status: 409 }
      );
    }

    const contentHash = hashContent(content);

    // Upsert 操作
    const file = await prisma.workspaceFile.upsert({
      where: {
        workspaceId_path: { workspaceId, path: filePath },
      },
      update: {
        content,
        contentHash,
      },
      create: {
        workspaceId,
        path: filePath,
        content,
        contentHash,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: file.id,
        path: file.path,
        hash: file.contentHash,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
        created: !existing,
      },
    });
  } catch (error) {
    console.error('PUT /api/workspace/[id]/files/[...path] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspace/[id]/files/[...path]
 *
 * 删除文件
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: workspaceId, path: pathSegments } = await params;
    const filePath = buildPath(pathSegments);

    const file = await prisma.workspaceFile.findUnique({
      where: {
        workspaceId_path: { workspaceId, path: filePath },
      },
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    await prisma.workspaceFile.delete({
      where: { id: file.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: file.id,
        path: file.path,
        deleted: true,
      },
    });
  } catch (error) {
    console.error('DELETE /api/workspace/[id]/files/[...path] error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
