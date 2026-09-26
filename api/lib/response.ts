/// <reference lib="dom" />
/**
 * Shared NormalizedResponse factories.
 *
 * Verbatim from api/lib/handlers.ts lines 39-49. Every domain module imports
 * these instead of redefining them, so the `code`/`error` strings stay in one
 * place.
 */
import type { NormalizedResponse } from './types.js';

export function unauthorized(): NormalizedResponse {
  return { status: 401, body: { error: 'Authentication required', code: 'UNAUTHORIZED' } };
}

export function badRequest(message: string, code = 'BAD_REQUEST'): NormalizedResponse {
  return { status: 400, body: { error: message, code } };
}

export function serverError(message = 'Internal error', code = 'INTERNAL_ERROR'): NormalizedResponse {
  return { status: 500, body: { error: message, code } };
}
