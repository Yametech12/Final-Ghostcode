/// <reference lib="dom" />
/**
 * Shared backend contracts.
 *
 * Verbatim from api/lib/handlers.ts lines 17-35 — the two interfaces below are
 * unchanged, so api/server.ts, api/_index.ts, api/lib/tierGate.ts and
 * api/lib/handlers.test.ts see exactly the same shapes as before.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface NormalizedRequest {
  method: string;
  body: any;
  query: Record<string, any>;
  params: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  /** Authenticated Supabase user (resolved upstream from Authorization header). May be null. */
  user: User | null;
}

export interface NormalizedResponse {
  status: number;
  body?: any;
  /** SSE stream — when set, body is ignored and the caller streams via this iterable. */
  stream?: AsyncIterable<string>;
  /** Optional cancellation hook. The HTTP layer should call this when the
   *  client disconnects so the upstream Regolo stream stops being consumed. */
  cancel?: () => void;
}

/**
 * A single HTTP route. This is new scaffolding, not moved code: it exists so
 * api/_index.ts can register routes from a declarative table instead of
 * repeating `normalize()` + `send()` seventeen times.
 *
 * `path` is the Express-style path including the `/api` prefix; `__PARAMS__`
 * sections are only used by Express. api/server.ts keeps its own matcher and
 * is intentionally left byte-identical.
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface BaseRoute {
  method: HttpMethod;
  path: string;
  auth: 'public' | 'authenticated';
}

/** Normal route: goes through normalize() then send(). */
export interface HandlerRoute extends BaseRoute {
  handler: (req: NormalizedRequest, supabase: SupabaseClient) => Promise<NormalizedResponse>;
}

/** Route that answers with a fixed JSON payload and never touches Supabase. */
export interface StaticRoute extends BaseRoute {
  staticResponse: { status: number; body: Record<string, unknown> };
}

export type RouteDef = HandlerRoute | StaticRoute;

export function isStaticRoute(route: RouteDef): route is StaticRoute {
  return 'staticResponse' in route;
}
