/// <reference lib="dom" />
/**
 * Self-serve account lifecycle.
 *
 * Verbatim from api/lib/handlers.ts: handleDeleteMyAccount (lines 1208-1295).
 *
 * The delete ORDER (public.users first, then auth.admin.deleteUser) is the
 * documented retry-safe order and is preserved exactly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { log, serializeErr } from '../log.js';
import { badRequest, serverError, unauthorized } from '../response.js';
import type { NormalizedRequest, NormalizedResponse, RouteDef } from '../types.js';

/**
 * DELETE /api/users/me — authenticated.
 *
 * Self-serve account deletion. The user submits a confirmation phrase
 * (their own email, lowercased) so a single accidental click can't wipe
 * the account; the request body must include `{ confirm: <email> }`.
 *
 * Order of operations:
 *   1. Verify the auth header → req.user (already done by the caller).
 *   2. Verify the confirmation phrase matches the authenticated email.
 *   3. Call supabase.auth.admin.deleteUser(uid). This deletes the row in
 *      auth.users, which cascades to public.users via the FK, which in
 *      turn cascades to every child table (advisor_*, calibrations,
 *      oracle_analyses, dossiers, favorites, assessment_results, …) and
 *      fires the trg_purge_user_storage_objects trigger so files in
 *      `users/<uid>/` get deleted from storage.
 *
 * After this returns, the client should:
 *   - Drop its local auth state (signOut + clear localStorage scoped
 *     keys; in this codebase that means letting the SIGNED_OUT event
 *     fire, which the auth context already handles).
 *   - Redirect to the public landing page.
 *
 * Privacy Policy section 8 promises the user can delete their account
 * from inside the app; this endpoint is what makes that promise truthful.
 */
export async function handleDeleteMyAccount(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;
  const userEmail = (req.user.email || '').toLowerCase();

  const confirmRaw = req.body?.confirm;
  if (typeof confirmRaw !== 'string') {
    return badRequest('Confirmation phrase is required', 'CONFIRM_REQUIRED');
  }
  // The user must type their email back at us to delete. This is enough
  // friction to prevent fat-finger account loss without being annoying.
  if (confirmRaw.trim().toLowerCase() !== userEmail) {
    return badRequest(
      'Confirmation phrase does not match the account email',
      'CONFIRM_MISMATCH'
    );
  }
  if (!userEmail) {
    // No email on file (shouldn't happen for a verified user, but guard
    // anyway — the empty-string equality above would let the user past).
    return badRequest('Account has no email; contact support', 'NO_EMAIL');
  }

  // supabase.auth.admin.* requires the service role client, which is what
  // the API server uses by construction. Do not expose this surface to
  // anon-keyed clients.
  //
  // Order:
  //   1. DELETE FROM public.users — this fires the storage cleanup
  //      trigger AND cascades to every child table via FKs. If it fails,
  //      the auth row still exists and the user can retry. We avoid the
  //      reverse order (auth first, then public) because a failure
  //      between them leaves an orphan: auth gone, public present, no
  //      way for the user to retry because they can no longer sign in.
  //   2. supabase.auth.admin.deleteUser — once public is gone the auth
  //      row has nothing to point at; the auth.users → public.users FK
  //      added by 20240101000700 cascades the other way too on auth
  //      delete, so this final step also acts as belt-and-braces for
  //      anyone who hit this endpoint pre-FK migration.
  try {
    const { error: dbErr } = await supabase.from('users').delete().eq('id', userId);
    if (dbErr) throw dbErr;
  } catch (dbErr) {
    log.error('account_delete_db_step_failed', { userId, err: serializeErr(dbErr) });
    return serverError('Failed to delete account', 'DELETE_FAILED');
  }

  const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
  if (authErr) {
    // public.users is already gone; the user can't sign in anymore. Log
    // loudly so an operator can clean up the orphan auth row manually,
    // but report success to the client because the user-visible state
    // (no app data, can't sign in) matches "deleted".
    log.warn('account_delete_auth_step_orphan', { userId, err: serializeErr(authErr) });
  }

  log.info('account_deleted', { userId });
  return { status: 200, body: { success: true } };
}

export const routes: RouteDef[] = [
  {
    method: 'DELETE',
    path: '/api/users/me',
    auth: 'authenticated',
    handler: (req, supabase) => handleDeleteMyAccount(req, supabase),
  },
];
