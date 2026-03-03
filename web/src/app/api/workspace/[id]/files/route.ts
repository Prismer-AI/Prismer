/**
 * Workspace Files API - 文件列表和创建
 *
 * GET  /api/workspace/[id]/files - 列出所有工作空间文件
 * POST /api/workspace/[id]/files - 创建新文件
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createHash } from 'crypto';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * 计算内容的 SHA256 哈希
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * GET /api/workspace/[id]/files
 *
 * 列出工作空间的所有文件
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: workspaceId } = await params;

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

    // 获取所有文件
    const files = await prisma.workspaceFile.findMany({
      where: { workspaceId },
      select: {
        id: true,
        path: true,
        contentHash: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { path: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        workspaceId,
        files: files.map((f) => ({
          id: f.id,
          path: f.path,
          hash: f.contentHash,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        })),
        count: files.length,
      },
    });
  } catch (error) {
    console.error('GET /api/workspace/[id]/files error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspace/[id]/files
 *
 * 创建新文件
 *
 * Request body:
 * {
 *   path: string,    // 文件路径 (如 "IDENTITY.md", "skills/latex/SKILL.md")
 *   content: string  // 文件内容
 * }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: workspaceId } = await params;
    const body = await request.json();
    const { path, content } = body;

    // 参数验证
    if (!path || typeof path !== 'string') {
      return NextResponse.json(
        { success: false, error: 'path is required' },
        { status: 400 }
      );
    }

    if (content === undefined || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      );
    }

    // 规范化路径
    const normalizedPath = path.replace(/^\/+/, '').replace(/\/+/g, '/');

    // 验证路径格式
    if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
      return NextResponse.json(
        { success: false, error: 'Invalid path format' },
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

    // 检查文件是否已存在
    const existing = await prisma.workspaceFile.findUnique({
      where: {
        workspaceId_path: { workspaceId, path: normalizedPath },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'File already exists', code: 'FILE_EXISTS' },
        { status: 409 }
      );
    }

    // 创建文件
    const contentHash = hashContent(content);
    const file = await prisma.workspaceFile.create({
      data: {
        workspaceId,
        path: normalizedPath,
        content,
        contentHash,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: file.id,
          path: file.path,
          hash: file.contentHash,
          createdAt: file.createdAt.toISOString(),
          updatedAt: file.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/workspace/[id]/files error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
