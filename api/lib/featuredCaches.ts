/**
 * Featured (hot-read) caches — cache-aside wrappers around `withCache` for
 * content that is identical for every user.
 *
 * WHAT IS CACHED
 * --------------
 * Only static reference material:
 *   • the Epimetheus type-framework block of the advisor system prompt
 *   • the response-guidelines + worked-examples block
 *   • the personality type → context sentence map (per type)
 *   • the personality type catalog (for pickers / admin screens)
 *
 * These blocks are re-assembled on every `/api/advisor/chat` call in
 * `handlers.ts` otherwise. They are several kilobytes of constant text, so
 * caching them keeps that work off the hot path and makes the copy editable
 * from one place (the cache key) instead of only by redeploying.
 *
 * The loader is always supplied by the caller, so this module holds no copy of
 * the prompt text — there is exactly one source of truth for it in
 * `handlers.ts`, which is what keeps the cached value byte-identical to the
 * pre-migration inline template.
 *
 * WHAT IS NEVER CACHED
 * --------------------
 * No user PII, ever. The per-user half of the prompt interpolates the caller's
 * trait scores, type id, recent session titles and message bodies — all of
 * that is assembled fresh on every request and is deliberately absent from this
 * module. Every static key here is a fixed string with no user id in it, so the
 * entries are safe to share across tenants. The only user-derived key is the
 * per-type sentence, whose input is a personality type id (`TDI`), not a user.
 *
 * Key namespace: `prompt:` / `catalog:` so ops can inspect or flush precisely
 * that slice of Redis.
 */

import { withCache, cache } from './cache.js';

export const PROMPT_TYPE_FRAMEWORK_KEY = 'prompt:advisor:type-framework';
export const PROMPT_RESPONSE_GUIDELINES_KEY = 'prompt:advisor:response-guidelines';
export const PROMPT_TYPE_CONTEXT_KEY = 'prompt:advisor:type-context';
export const PERSONALITY_CATALOG_KEY = 'catalog:personality-types';

export const PROMPT_BLOCK_TTL_SEC = 300;        // 5 min — static text
export const TYPE_CONTEXT_TTL_SEC = 3600;       // 1 h — pure lookup table
export const PERSONALITY_CATALOG_TTL_SEC = 3600;

/**
 * Cache-aside read of a static prompt block. `loader` is invoked only on a
 * miss, and a Redis failure falls through to it (see `withCache`) — a broken
 * cache can never blank out the system prompt.
 */
export async function getCachedPromptBlock(
  key: string,
  ttlSec: number,
  loader: () => string,
): Promise<string> {
  return withCache<string>(key, ttlSec, loader);
}

/**
 * Per-type context sentence. The cache key is derived from the type id only —
 * `prompt:advisor:type-context:TDI` — so no user identity reaches Redis.
 */
export async function getPersonalityTypeContext(
  typeId: string,
  loader: (id: string) => string,
): Promise<string> {
  return withCache<string>(`${PROMPT_TYPE_CONTEXT_KEY}:${typeId}`, TYPE_CONTEXT_TTL_SEC, () =>
    loader(typeId),
  );
}

export interface PersonalityTypeSummary {
  id: string;
  context: string;
}

/** The full 8-type catalog, cached as a unit (every consumer wants the list). */
export async function getPersonalityTypeCatalog(
  loader: () => PersonalityTypeSummary[],
): Promise<PersonalityTypeSummary[]> {
  return withCache<PersonalityTypeSummary[]>(
    PERSONALITY_CATALOG_KEY,
    PERSONALITY_CATALOG_TTL_SEC,
    loader,
  );
}

/**
 * Drop every featured entry so the next read rebuilds it. Call after a prompt
 * template or catalog content change ships. `type-context` keys are per id, so
 * they are written with a bounded TTL rather than swept one by one.
 */
export async function invalidateFeaturedCaches(): Promise<void> {
  await Promise.all([
    cache.del(PROMPT_TYPE_FRAMEWORK_KEY),
    cache.del(PROMPT_RESPONSE_GUIDELINES_KEY),
    cache.del(PERSONALITY_CATALOG_KEY),
  ]);
}
