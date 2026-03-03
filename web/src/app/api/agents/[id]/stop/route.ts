/**
 * Agent Stop API (Open-Source Stub)
 *
 * POST /api/agents/:id/stop
 *
 * In open-source mode the container is managed externally (docker-compose),
 * so this endpoint is a no-op that returns success.
 */

import { NextRequest, NextResponse } from 'next/server';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  return NextResponse.json({
    success: true,
    data: { id, status: 'stopped' },
  });
}
