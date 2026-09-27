/**
 * Per-user daily AI token ledger (SEC-14).
 *
 * Every AI-spending handler calls `consumeDailyTokens` BEFORE dispatching
 * to Regolo. The RPC (20240101000900_security_patch_pack.sql) atomically
 * reserves the estimated tokens and refuses when the user's daily cap is
 * exhausted — the handler then returns 429 so no upstream spend occurs.
 *
 * Estimation is deliberately conservative (over-estimates by ~10%): the
 * ledger is a spend circuit-breaker, not a billing system. Actual usage
 * tracking can be added later by reconciling provider usage reports.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { log, serializeErr } from './log.js';

/** Heuristic: ~4 chars per token for English prose, +10% headroom. */
export function estimateTokens(text: string): number {
  return Math.ceil((text.length / 4) * 1.1);
}

export function estimateMessagesTokens(messages: Array<{ content: unknown }>): number {
  let total = 0;
  for (const m of messages) {
    if (typeof m?.content === 'string') {
      total += estimateTokens(m.content);
    } else if (Array.isArray(m?.content)) {
      for (const part of m.content) {
        if (part && typeof part === 'object' && typeof part.text === 'string') {
          total += estimateTokens(part.text);
        }
        // Image parts: fixed conservative estimate (vision payloads are large)
        else if (part && typeof part === 'object' && part.type === 'image_url') {
          total += 1200;
        }
      }
    }
  }
  return total;
}

/** Per-tier daily caps (estimated tokens). Tune per economics. */
export const DAILY_CAPS = {
  strategist: 120_000,
  oracle: 400_000,
} as const;

export type BudgetTier = keyof typeof DAILY_CAPS;

export interface BudgetCheckResult {
  allowed: boolean;
  tokensUsed: number | null;
  cap: number | null;
  /** True when the ledger itself failed — handlers decide fail-open/closed. */
  ledgerError: boolean;
}

/**
 * Attempt to reserve `estimatedTokens` against the user's daily budget.
 * Returns allowed=false when the cap would be exceeded (nothing reserved).
 */
export async function consumeDailyTokens(
  supabase: SupabaseClient,
  userId: string,
  estimatedTokens: number,
  tier: BudgetTier,
): Promise<BudgetCheckResult> {
  const cap = DAILY_CAPS[tier];
  try {
    const { data, error } = await supabase.rpc('consume_ai_tokens', {
      p_user_id: userId,
      p_model: 'default',
      p_estimated_tokens: estimatedTokens,
      p_daily_cap: cap,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const used = typeof row?.tokens_used === 'number' ? row.tokens_used : null;
    return {
      allowed: row?.allowed === true,
      tokensUsed: used,
      cap,
      ledgerError: false,
    };
  } catch (err) {
    // Ledger unavailable: log loudly. Handlers receive ledgerError=true and
    // can choose to fail open (availability) — the per-minute rate limiter
    // still bounds abuse while the ledger is down.
    log.error('ai_budget_ledger_failed', { userId, err: serializeErr(err) });
    return { allowed: true, tokensUsed: null, cap: null, ledgerError: true };
  }
}

/** Standard 429 body for exhausted budgets. */
export function budgetExceededResponse(cap: number) {
  return {
    status: 429 as const,
    body: {
      error: 'Daily AI budget exhausted. Resets at 00:00 UTC.',
      code: 'DAILY_BUDGET_EXCEEDED',
      dailyCap: cap,
    },
  };
}
