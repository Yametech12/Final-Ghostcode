/// <reference lib="dom" />
/**
 * Oracle analysis domain (the persisted CalibrationPage results).
 *
 * Verbatim from api/lib/handlers.ts:
 *   sanitizeOracleResult              lines 718-778   (private)
 *   handleCreateOracleAnalysis        lines 780-843
 *   sanitizeTask                     lines 845-872   (private)
 *   handleUpdateOracleAnalysisTasks   lines 874-936
 *   handleDeleteOracleAnalysis        lines 938-972
 *
 * The length/shape clamps are the only thing standing between a compromised
 * client and an arbitrarily large JSON blob in Postgres, so they are copied
 * with the exact same limits (20 KB input, 20 tasks, 4000-char analysis...).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidUUID } from '../auth.js';
import { requireTier } from '../tierGate.js';
import { log, serializeErr } from '../log.js';
import { badRequest, serverError, unauthorized } from '../response.js';
import type { NormalizedRequest, NormalizedResponse, RouteDef } from '../types.js';

/**
 * Validate and normalize an Oracle analysis result before persisting.
 * Mirrors the AnalysisResult interface in src/pages/CalibrationPage.tsx but
 * applies length/shape clamps so a malicious client can't push an arbitrary
 * blob into Postgres. Returns a sanitized copy or null if structurally invalid.
 */
function sanitizeOracleResult(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;

  const VALID_TYPES = new Set(['TDI', 'TJI', 'TDR', 'TJR', 'NDI', 'NJI', 'NDR', 'NJR']);
  const VALID_PRIORITY = new Set(['low', 'medium', 'high']);
  const VALID_CATEGORY = new Set(['communication', 'physical', 'logistics', 'psychology']);

  const primaryType = String(raw.primaryType || '').toUpperCase();
  if (!VALID_TYPES.has(primaryType)) return null;

  const confidence = Math.max(0, Math.min(100, Number(raw.confidence) || 0));
  const secondaryType =
    raw.secondaryType && VALID_TYPES.has(String(raw.secondaryType).toUpperCase())
      ? String(raw.secondaryType).toUpperCase()
      : null;

  const clampStr = (v: any, max: number) => String(v ?? '').slice(0, max);
  const clampStrArr = (v: any, maxItems: number, maxLen: number) =>
    Array.isArray(v) ? v.slice(0, maxItems).map((x) => clampStr(x, maxLen)) : [];

  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.slice(0, 20).map((t: any, i: number) => ({
        id: clampStr(t?.id || `task-${Date.now()}-${i}`, 80),
        title: clampStr(t?.title, 200),
        description: clampStr(t?.description, 1000),
        priority: VALID_PRIORITY.has(t?.priority) ? t.priority : 'medium',
        dueDate: clampStr(t?.dueDate, 50),
        completed: Boolean(t?.completed),
        category: VALID_CATEGORY.has(t?.category) ? t.category : 'psychology',
      }))
    : [];

  const objOf3 = (v: any, k1: string, k2: string, k3: string, max: number) => ({
    [k1]: clampStr(v?.[k1], max),
    [k2]: clampStr(v?.[k2], max),
    [k3]: clampStr(v?.[k3], max),
  });

  return {
    primaryType,
    confidence,
    secondaryType,
    analysis: clampStr(raw.analysis, 4000),
    indicators: clampStrArr(raw.indicators, 10, 500),
    tasks,
    coldReader: clampStr(raw.coldReader, 1000),
    howSheGetsWhatSheWants: clampStr(raw.howSheGetsWhatSheWants, 2000),
    whatToAvoid: clampStrArr(raw.whatToAvoid, 10, 500),
    relationshipAdvice: objOf3(raw.relationshipAdvice, 'vision', 'investment', 'potential', 1500),
    freakDynamics: objOf3(raw.freakDynamics, 'kink', 'threesomes', 'worship', 1500),
    darkMindBreakdown: clampStr(raw.darkMindBreakdown, 4000),
    behavioralBlueprint: clampStr(raw.behavioralBlueprint, 4000),
    interactionStrategy: clampStr(raw.interactionStrategy, 2000),
  };
}

/**
 * POST /api/oracle/analyses — authenticated.
 * Persists a CalibrationPage AI Oracle result. Previously the client wrote
 * directly to the oracle_analyses table — RLS protected user_id ownership but
 * not the JSON shape. This endpoint validates and clamps the payload so a
 * compromised client can't bloat the column with arbitrary data.
 *
 * Body: { input: object, result: object, scenarioSummary?: string }
 * Returns: { id, ...persisted row }
 */
export async function handleCreateOracleAnalysis(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {  if (!req.user) return unauthorized();
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;
  const userId = req.user.id;

  const { input, result, scenarioSummary } = req.body || {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return badRequest('input must be an object');
  }
  // Cap the input blob — it's a structured form, never large in practice.
  const inputJson = JSON.stringify(input);
  if (inputJson.length > 20_000) {
    return badRequest('input payload too large (max 20KB)');
  }

  const sanitized = sanitizeOracleResult(result);
  if (!sanitized) {
    return badRequest('result has invalid shape', 'INVALID_RESULT');
  }

  const summary =
    typeof scenarioSummary === 'string' ? scenarioSummary.slice(0, 200) : '';

  // Belt-and-braces: ensure a users row exists so the FK doesn't fail on first
  // analysis. The auth context normally creates this on sign-in but a stale
  // tab can race past it.
  await supabase.from('users').upsert(
    { id: userId, email: req.user.email ?? null },
    { onConflict: 'id', ignoreDuplicates: false }
  );

  const { data: inserted, error } = await supabase
    .from('oracle_analyses')
    .insert({
      user_id: userId,
      input,
      result: sanitized,
      scenario_summary: summary,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    log.error('oracle_analysis_insert_failed', { userId, err: serializeErr(error) });
    return serverError('Failed to save analysis', 'DB_INSERT_ERROR');
  }

  return { status: 200, body: { id: inserted.id, analysis: inserted } };
}

/**
 * Sanitize a single task before merging into result.tasks. Mirrors the
 * per-task clamps in sanitizeOracleResult so a compromised client can't
 * smuggle arbitrary blobs into the JSON column via the patch endpoint.
 */
function sanitizeTask(raw: any, fallbackId: string): {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  completed: boolean;
  category: 'communication' | 'physical' | 'logistics' | 'psychology';
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const VALID_PRIORITY = new Set(['low', 'medium', 'high']);
  const VALID_CATEGORY = new Set(['communication', 'physical', 'logistics', 'psychology']);
  const clamp = (v: any, max: number) => String(v ?? '').slice(0, max);
  return {
    id: clamp(raw.id || fallbackId, 80),
    title: clamp(raw.title, 200),
    description: clamp(raw.description, 1000),
    priority: VALID_PRIORITY.has(raw.priority) ? raw.priority : 'medium',
    dueDate: clamp(raw.dueDate, 50),
    completed: Boolean(raw.completed),
    category: VALID_CATEGORY.has(raw.category) ? raw.category : 'psychology',
  };
}

/**
 * PATCH /api/oracle/analyses/:id/tasks — authenticated.
 *
 * Replaces `result.tasks` on an existing oracle_analyses row owned by the
 * caller. Used by CalibrationPage's task toggle / "mark all" actions, which
 * previously wrote directly to the table. RLS still enforces ownership, but
 * the server now also re-validates the task shape and caps the array length,
 * matching what `handleCreateOracleAnalysis` does on insert.
 *
 * Body: { tasks: Task[] }
 */
export async function handleUpdateOracleAnalysisTasks(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;
  const userId = req.user.id;
  const id = req.params.id;
  if (!isValidUUID(id)) return badRequest('Invalid analysis id', 'INVALID_UUID');

  const rawTasks = req.body?.tasks;
  if (!Array.isArray(rawTasks)) {
    return badRequest('tasks must be an array');
  }
  if (rawTasks.length > 50) {
    return badRequest('Too many tasks (max 50)');
  }

  const sanitizedTasks = rawTasks
    .map((t: any, i: number) => sanitizeTask(t, `task-${id}-${i}`))
    .filter((t): t is NonNullable<ReturnType<typeof sanitizeTask>> => t !== null);

  // Confirm ownership before mutating. RLS would also block, but a 404 is a
  // friendlier response than a silent zero-row update.
  const { data: existing } = await supabase
    .from('oracle_analyses')
    .select('user_id, result')
    .eq('id', id)
    .maybeSingle();

  if (!existing || existing.user_id !== userId) {
    return { status: 404, body: { error: 'Analysis not found', code: 'NOT_FOUND' } };
  }

  // Merge tasks into the existing result blob rather than overwriting the row.
  const nextResult = { ...(existing.result ?? {}), tasks: sanitizedTasks };

  const { data: updated, error } = await supabase
    .from('oracle_analyses')
    .update({ result: nextResult })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    log.error('oracle_tasks_update_failed', { userId, analysisId: id, err: serializeErr(error) });
    return serverError('Failed to update tasks', 'DB_UPDATE_ERROR');
  }

  return { status: 200, body: { id: updated.id, tasks: sanitizedTasks } };
}

/**
 * DELETE /api/oracle/analyses/:id — authenticated.
 *
 * Owner-only delete of a single oracle_analyses row. Mirrors the pattern
 * used by /api/advisor/session/:id (verify ownership, return 404 if not
 * found, then delete).
 */
export async function handleDeleteOracleAnalysis(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  // No tier gate on DELETE — owners can always clean up after themselves
  // even after a tier downgrade. Mirrors handleDeleteAdvisorSession.
  const userId = req.user.id;
  const id = req.params.id;
  if (!isValidUUID(id)) return badRequest('Invalid analysis id', 'INVALID_UUID');

  const { data: existing } = await supabase
    .from('oracle_analyses')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (!existing || existing.user_id !== userId) {
    return { status: 404, body: { error: 'Analysis not found', code: 'NOT_FOUND' } };
  }

  const { error } = await supabase.from('oracle_analyses').delete().eq('id', id);
  if (error) {
    log.error('oracle_analysis_delete_failed', { userId, analysisId: id, err: serializeErr(error) });
    return serverError('Failed to delete analysis', 'DB_DELETE_ERROR');
  }
  return { status: 200, body: { success: true } };
}

export const routes: RouteDef[] = [
  {
    method: 'POST',
    path: '/api/oracle/analyses',
    auth: 'authenticated',
    handler: (req, supabase) => handleCreateOracleAnalysis(req, supabase),
  },
  {
    method: 'PATCH',
    path: '/api/oracle/analyses/:id/tasks',
    auth: 'authenticated',
    handler: (req, supabase) => handleUpdateOracleAnalysisTasks(req, supabase),
  },
  {
    method: 'DELETE',
    path: '/api/oracle/analyses/:id',
    auth: 'authenticated',
    handler: (req, supabase) => handleDeleteOracleAnalysis(req, supabase),
  },
];
