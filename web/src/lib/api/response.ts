/**
 * Unified API Response Helpers
 *
 * Standard response format for all API routes:
 *   Success: { success: true, data: T, pagination?: {...} }
 *   Error:   { success: false, error: string }
 */

import { NextResponse } from 'next/server';

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function success<T>(data: T, pagination?: Pagination) {
  return NextResponse.json({
    success: true as const,
    data,
    ...(pagination ? { pagination } : {}),
  });
}

export function error(status: number, message: string) {
  return NextResponse.json(
    { success: false as const, error: message },
    { status }
  );
}

export function unauthorized(message = 'Unauthorized') {
  return error(401, message);
}

export function notFound(message = 'Not found') {
  return error(404, message);
}

export function badRequest(message = 'Bad request') {
  return error(400, message);
}

export function serverError(message = 'Internal server error') {
  return error(500, message);
}
