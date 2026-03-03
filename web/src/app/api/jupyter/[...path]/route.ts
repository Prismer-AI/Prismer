/**
 * Jupyter Server Proxy
 *
 * 代理所有 Jupyter Server 请求，解决 CORS 问题
 *
 * 使用方式：
 * - 前端请求: /api/jupyter/{path}
 * - 代理到: JUPYTER_SERVER_URL/{path}
 *
 * 动态容器支持：
 * - 查询参数 ?port=XXXX 指定容器映射的 Jupyter 端口
 * - 无 port 参数时，使用 JUPYTER_SERVER_URL 环境变量或查询数据库
 */

import { NextRequest, NextResponse } from 'next/server';

// 从环境变量获取默认 Jupyter Server 配置
const DEFAULT_JUPYTER_URL = process.env.JUPYTER_SERVER_URL || 'http://localhost:8888';
const JUPYTER_TOKEN = process.env.JUPYTER_TOKEN || '';

/**
 * 解析目标 Jupyter Server URL
 * 优先级: query param port > env var > default
 */
function resolveJupyterUrl(request: NextRequest): string {
  const port = request.nextUrl.searchParams.get('port');
  if (port && /^\d+$/.test(port)) {
    return `http://localhost:${port}`;
  }
  return DEFAULT_JUPYTER_URL;
}

async function proxyRequest(
  request: NextRequest,
  path: string[],
  method: string
): Promise<NextResponse> {
  const jupyterUrl = resolveJupyterUrl(request);
  const targetPath = path.join('/');

  // Build query string without our custom 'port' param
  const url = new URL(request.url);
  url.searchParams.delete('port');
  const queryString = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
  const targetUrl = `${jupyterUrl}/${targetPath}${queryString}`;

  try {
    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
    };

    // 添加 Token 认证
    if (JUPYTER_TOKEN) {
      headers['Authorization'] = `token ${JUPYTER_TOKEN}`;
    }

    // 转发原始请求的认证头
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // 准备请求体
    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = await request.text();
      } catch {
        // 无请求体
      }
    }

    // 发送代理请求
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    // 获取响应数据
    const contentType = response.headers.get('Content-Type') || '';
    let responseBody: string | ArrayBuffer;

    if (contentType.includes('application/json')) {
      responseBody = await response.text();
    } else {
      responseBody = await response.arrayBuffer();
    }

    // 构建响应
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[Jupyter Proxy] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to connect to Jupyter Server',
        details: error instanceof Error ? error.message : 'Unknown error',
        targetUrl,
      },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'PATCH');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
