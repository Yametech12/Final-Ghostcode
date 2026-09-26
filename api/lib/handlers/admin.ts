/// <reference lib="dom" />
/**
 * Admin domain.
 *
 * Verbatim from api/lib/handlers.ts: handleAdminDeleteUser (lines 1297-1392).
 *
 * The server-side `role === 'admin'` re-check and the self-delete guard are
 * unchanged — the client route guard is still not trusted.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidUUID } from '../auth.js';
import { log, serializeErr } from '../log.js';
import { badRequest, serverError, unauthorized } from '../response.js';
import type { NormalizedRequest, NormalizedResponse, RouteDef } from '../types.js';

/**
 * DELETE /api/admin/users/:id — admin-only.
 *
 * Companion to handleDeleteMyAccount, but for AdminDashboard. Without
 * this endpoint, AdminDashboard.tsx was deleting only `public.users`
 * directly via the supabase client. After 20240101000700 added the
 * `public.users.id → auth.users.id ON DELETE CASCADE` foreign key, that
 * delete-from-public path leaves the auth.users row intact (the FK
 * cascade is one-way: auth → public). Result: a "ghost" account that
 * can still authenticate, can recreate its public.users row on next
 * sign-in, and bypasses every audit trail.
 *
 * This handler:
 *   1. Verifies the caller is an admin (role === 'admin' in public.users).
 *   2. Refuses to delete the caller's own account (the operator should
 *      use the self-serve endpoint with proper email confirmation).
 *   3. Deletes via supabase.auth.admin.deleteUser(targetId), which
 *      cascades through the FK to public.users → child tables → storage
 *      cleanup trigger. Same cascade semantics as the self-serve flow,
 *      just without the email confirmation step (admins are trusted to
 *      know what they're doing).
 */
export async function handleAdminDeleteUser(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const adminId = req.user.id;
  const targetId = req.params?.id;
  if (!targetId || !isValidUUID(targetId)) {
    return badRequest('Valid user ID required', 'INVALID_USER_ID');
  }
  if (targetId === adminId) {
    return {
      status: 400,
      body: {
        error: 'Admins cannot delete their own account here. Use the self-serve flow on your profile page.',
        code: 'CANNOT_SELF_DELETE',
      },
    };
  }

  // Verify the caller is actually an admin. The route guard on the
  // client checks this, but the client guard runs in the user's
  // browser — anyone with a valid JWT could call this endpoint
  // directly with curl. The server is the only enforcement that
  // matters.
  const { data: callerRow, error: callerErr } = await supabase
    .from('users')
    .select('role')
    .eq('id', adminId)
    .maybeSingle();
  if (callerErr) {
    log.error('admin_delete_caller_lookup_failed', {
      adminId,
      err: serializeErr(callerErr),
    });
    return serverError('Authorization check failed', 'AUTH_CHECK_FAILED');
  }
  if (!callerRow || callerRow.role !== 'admin') {
    return { status: 403, body: { error: 'Admin role required', code: 'FORBIDDEN' } };
  }

  // Drive the cascade from the auth side. The FK added in
  // 20240101000700 makes `public.users` (and every child table that
  // FKs to it) cascade automatically, AND the storage purge trigger
  // fires on `public.users` AFTER DELETE. Doing the auth delete first
  // here is the inverse order vs handleDeleteMyAccount because the
  // admin path doesn't worry about a "user can't sign in to retry"
  // scenario — if it fails, the operator just retries.
  const { error: authErr } = await supabase.auth.admin.deleteUser(targetId);
  if (authErr) {
    log.error('admin_delete_auth_failed', {
      adminId,
      targetId,
      err: serializeErr(authErr),
    });
    return serverError('Failed to delete user', 'DELETE_FAILED');
  }

  // Belt-and-braces: if for any reason the FK cascade didn't fire
  // (e.g. the user was created before 20240101000700 and the row
  // somehow escaped that migration's backfill), explicitly delete the
  // public row. This is a no-op when the cascade already worked.
  const { error: dbErr } = await supabase.from('users').delete().eq('id', targetId);
  if (dbErr) {
    log.warn('admin_delete_public_cleanup_failed', {
      adminId,
      targetId,
      err: serializeErr(dbErr),
    });
  }

  log.info('admin_user_deleted', { adminId, targetId });
  return { status: 200, body: { success: true } };
}

export const routes: RouteDef[] = [
  {
    method: 'DELETE',
    path: '/api/admin/users/:id',
    auth: 'authenticated',
    handler: (req, supabase) => handleAdminDeleteUser(req, supabase),
  },
];
