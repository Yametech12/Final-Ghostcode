/// <reference lib="dom" />
/**
 * Calibration domain.
 *
 * Verbatim from api/lib/handlers.ts: handleCalibrationAnalyze (lines 974-1053).
 *
 * NOTE (pre-existing gap, deliberately NOT changed): this handler is exported
 * and covered by api/lib/handlers.test.ts, but it is mounted by NEITHER
 * api/_index.ts NOR api/server.ts — there is no `/api/calibration/analyze`
 * route in the baseline, even though the rate-limit bucket logic in both
 * adapters reserves a `calibration/` prefix. Mounting it would be a behaviour
 * change (a new public endpoint), so the refactor preserves the gap exactly
 * and only records it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCompletion, DEFAULT_MODEL } from '../../_config.js';
import { requireTier } from '../tierGate.js';
import { log, serializeErr } from '../log.js';
import { badRequest, serverError, unauthorized } from '../response.js';
import type { NormalizedRequest, NormalizedResponse, RouteDef } from '../types.js';

/**
 * POST /api/calibration/analyze — authenticated.
 */
export async function handleCalibrationAnalyze(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;
  const userId = req.user.id;
  const { typeId, answers } = req.body || {};

  if (!typeId || !answers) return badRequest('Missing required fields');

  const prompt = `You are a personality analysis system. Based on the following answers to a "${typeId}" calibration, extract a JSON object with:
- 5 primary traits (each with name and score 0-100)
- 3 archetypes (e.g., "The Strategist", "The Empath")
- A short summary (2 sentences)

Answers: ${JSON.stringify(answers)}

Return ONLY valid JSON:
{
  "traits": [{"name": "Openness", "score": 78}],
  "archetypes": ["...", "...", "..."],
  "summary": "..."
}`;

  try {
    const completion: any = await createCompletion({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    const content = completion?.choices?.[0]?.message?.content;
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return serverError('AI returned invalid analysis format', 'AI_PARSE_ERROR');
    }

    // Validate shape and cap string lengths.
    if (!Array.isArray(parsed.traits) || !Array.isArray(parsed.archetypes) || typeof parsed.summary !== 'string') {
      return serverError('AI returned invalid analysis structure', 'AI_SHAPE_ERROR');
    }
    parsed.summary = String(parsed.summary).slice(0, 1000);
    parsed.archetypes = parsed.archetypes.slice(0, 5).map((a: any) => String(a).slice(0, 200));
    parsed.traits = parsed.traits.slice(0, 10).map((t: any) => ({
      name: String(t?.name || 'Unknown').slice(0, 100),
      score: Math.max(0, Math.min(100, Number(t?.score) || 0)),
    }));

    const { data, error } = await supabase
      .from('calibrations')
      .insert({
        user_id: userId,
        type_id: typeId,
        answers,
        traits: parsed,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { status: 200, body: { success: true, calibration: data, traits: parsed } };
  } catch (err) {
    log.error('calibration_analysis_failed', { userId, err: serializeErr(err) });
    return serverError(
      'Failed to analyze calibration',
      'CALIBRATION_ERROR'
    );
  }
}

/**
 * Intentionally empty: handleCalibrationAnalyze is not reachable over HTTP in
 * the baseline. Kept as an explicit empty array (rather than omitted) so the
 * absence is visible and testable.
 */
export const routes: RouteDef[] = [];
