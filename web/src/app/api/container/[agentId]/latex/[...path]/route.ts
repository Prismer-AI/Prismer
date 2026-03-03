/**
 * Container LaTeX Proxy API
 *
 * Proxies requests to the LaTeX service running inside an agent container.
 *
 * Usage:
 * - Frontend: /api/container/{agentId}/latex/{path}
 * - Proxied to: container:8080/{path}
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  proxyToContainer,
  ContainerProxyError,
} from '@/lib/container/client';

type Params = Promise<{ agentId: string; path: string[] }>;

async function proxyRequest(
  request: NextRequest,
  params: Params,
  method: string
): Promise<NextResponse> {
  const { agentId, path } = await params;
  const targetPath = path.join('/');
  const url = new URL(request.url);
  const queryString = url.search;
  const fullPath = `${targetPath}${queryString}`;

  console.log(`[Container/LaTeX] ${method} agent=${agentId} path=/${fullPath}`);

  try {
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
    };

    // Forward auth header
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Get body for non-GET requests
    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = await request.text();
      } catch {
        // No body
      }
    }

    // Proxy to container
    const result = await proxyToContainer(agentId, 'latex', fullPath, {
      method,
      headers,
      body,
    });

    // Build response
    return new NextResponse(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers: {
        'Content-Type': result.contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[Container/LaTeX] Proxy error:', error);

    if (error instanceof ContainerProxyError) {
      const statusMap: Record<string, number> = {
        AGENT_NOT_FOUND: 404,
        CONTAINER_NOT_RUNNING: 503,
        URL_RESOLUTION_FAILED: 500,
        REQUEST_TIMEOUT: 504,
        CONNECTION_FAILED: 502,
      };

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: statusMap[error.code] || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to proxy request to container',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  return proxyRequest(request, params, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  return proxyRequest(request, params, 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  return proxyRequest(request, params, 'PUT');
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  return proxyRequest(request, params, 'DELETE');
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  return proxyRequest(request, params, 'PATCH');
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
