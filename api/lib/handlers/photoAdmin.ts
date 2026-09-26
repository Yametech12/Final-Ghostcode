/// <reference lib="dom" />
/** Signed-URL photo reads for the private user-uploads bucket + the privileged role write.
 *  api/lib/handlers.ts re-exports these for the explicit routes in api/_index.ts. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { log, serializeErr } from '../log.js';
import { isValidUUID } from '../auth.js';
import type { NormalizedRequest, NormalizedResponse } from '../types.js';

export const PROFILE_PHOTO_URL_TTL_SECONDS = 60 * 60;
function unauthorized(): NormalizedResponse { return { status: 401, body: { error: 'Authentication required', code: 'UNAUTHORIZED' } }; }
function badRequest(m: string, code = 'BAD_REQUEST'): NormalizedResponse { return { status: 400, body: { error: m, code } }; }
function serverError(m = 'Internal error', code = 'INTERNAL_ERROR'): NormalizedResponse { return { status: 500, body: { error: m, code } }; }
function storagePathFromPhotoRef(ref: string | null | undefined): string | null {
  if (typeof ref !== 'string') return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;

  // Shape 1 — already a bucket-relative path.
  if (trimmed.startsWith('users/')) return trimmed.split('?')[0];

  // Shape 2 — legacy public URL. The marker scopes the parse to OUR bucket, so
  // an unrelated URL that merely contains the substring can't be mistaken for
  // one of our objects.
  const marker = '/user-uploads/';
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return null; // shape 3 — external URL
  const path = trimmed.slice(idx + marker.length).split('?')[0];
  return path.startsWith('users/') ? path : null;
}

export async function handleGetMyProfilePhotoUrl(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('users')
    .select('photo_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    log.error('profile_photo_lookup_failed', { userId, err: serializeErr(error) });
    return serverError('Failed to load profile', 'PROFILE_LOOKUP_FAILED');
  }

  const path = storagePathFromPhotoRef(data?.photo_url);
  if (!path) {
    return {
      status: 200,
      body: { success: true, url: null, path: null, expiresIn: PROFILE_PHOTO_URL_TTL_SECONDS },
    };
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from('user-uploads')
    .createSignedUrl(path, PROFILE_PHOTO_URL_TTL_SECONDS);

  if (signErr || !signed?.signedUrl) {
    log.error('profile_photo_sign_failed', { userId, err: serializeErr(signErr) });
    return serverError('Failed to sign photo URL', 'SIGN_ERROR');
  }

  return {
    status: 200,
    body: {
      success: true,
      url: signed.signedUrl,
      path,
      expiresIn: PROFILE_PHOTO_URL_TTL_SECONDS,
    },
  };
}

export async function handleAdminGetUserPhotoUrl(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const adminId = req.user.id;
  const targetId = req.params?.id;

  if (!targetId || !isValidUUID(targetId)) {
    return badRequest('Valid user ID required', 'INVALID_USER_ID');
  }

  const { data: callerRow, error: callerErr } = await supabase
    .from('users')
    .select('role')
    .eq('id', adminId)
    .maybeSingle();

  if (callerErr) {
    log.error('admin_photo_caller_lookup_failed', {
      adminId,
      err: serializeErr(callerErr),
    });
    return serverError('Authorization check failed', 'AUTH_CHECK_FAILED');
  }
  if (!callerRow || callerRow.role !== 'admin') {
    return { status: 403, body: { error: 'Admin role required', code: 'FORBIDDEN' } };
  }

  const { data, error } = await supabase
    .from('users')
    .select('photo_url')
    .eq('id', targetId)
    .maybeSingle();

  if (error) {
    log.error('admin_photo_lookup_failed', { adminId, targetId, err: serializeErr(error) });
    return serverError('Failed to load profile', 'PROFILE_LOOKUP_FAILED');
  }

  const path = storagePathFromPhotoRef(data?.photo_url);
  if (!path) {
    return {
      status: 200,
      body: { success: true, url: null, path: null, expiresIn: PROFILE_PHOTO_URL_TTL_SECONDS },
    };
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from('user-uploads')
    .createSignedUrl(path, PROFILE_PHOTO_URL_TTL_SECONDS);

  if (signErr || !signed?.signedUrl) {
    log.error('admin_photo_sign_failed', { adminId, targetId, err: serializeErr(signErr) });
    return serverError('Failed to sign photo URL', 'SIGN_ERROR');
  }

  return {
    status: 200,
    body: { success: true, url: signed.signedUrl, path, expiresIn: PROFILE_PHOTO_URL_TTL_SECONDS },
  };
}

export async function handleAdminUpdateUserRole(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const adminId = req.user.id;
  const targetId = req.params?.id;
  const newRole = req.body?.role;

  if (!targetId || !isValidUUID(targetId)) {
    return badRequest('Valid user ID required', 'INVALID_USER_ID');
  }
  // Allow-list rather than pass-through: the value lands in a column with a
  // CHECK constraint, and a typo should be a 400, not a 500.
  if (newRole !== 'user' && newRole !== 'admin') {
    return badRequest("Role must be 'user' or 'admin'", 'INVALID_ROLE');
  }

  const { data: callerRow, error: callerErr } = await supabase
    .from('users')
    .select('role')
    .eq('id', adminId)
    .maybeSingle();

  if (callerErr) {
    log.error('admin_role_caller_lookup_failed', {
      adminId,
      err: serializeErr(callerErr),
    });
    return serverError('Authorization check failed', 'AUTH_CHECK_FAILED');
  }
  if (!callerRow || callerRow.role !== 'admin') {
    return { status: 403, body: { error: 'Admin role required', code: 'FORBIDDEN' } };
  }

  // Self-demotion would lock the last admin out of the dashboard with no
  // in-product route back, so it is refused here (mirrors CANNOT_SELF_DELETE).
  if (targetId === adminId) {
    return {
      status: 400,
      body: { error: 'Admins cannot change their own role', code: 'CANNOT_SELF_DEMOTE' },
    };
  }

  const { error: updateErr } = await supabase
    .from('users')
    .update({ role: newRole })
    .eq('id', targetId);

  if (updateErr) {
    log.error('admin_role_update_failed', {
      adminId,
      targetId,
      err: serializeErr(updateErr),
    });
    return serverError('Failed to update role', 'UPDATE_FAILED');
  }

  log.info('admin_user_role_updated', { adminId, targetId, newRole });
  return { status: 200, body: { success: true, id: targetId, role: newRole } };
}
