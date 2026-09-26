/// <reference lib="dom" />
/**
 * Profile domain.
 *
 * Verbatim from api/lib/handlers.ts:
 *   handleUploadProfilePhoto   lines 118-210
 *   sniffImageMime             lines 212-223
 *
 * userId is still derived exclusively from req.user (the verified JWT) and the
 * magic-byte sniff is unchanged.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedRequest, NormalizedResponse, RouteDef } from '../types.js';
import { log, serializeErr } from '../log.js';
import { badRequest, serverError, unauthorized } from '../response.js';

/**
 * POST /api/upload/profile-photo — authenticated.
 * userId is ALWAYS derived from the JWT, never from the body. This prevents a
 * client from claiming someone else's userId and overwriting their photo path.
 */
export async function handleUploadProfilePhoto(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;

  const { base64Data } = req.body || {};
  if (!base64Data || typeof base64Data !== 'string') {
    return badRequest('Image data is required', 'MISSING_IMAGE_DATA');
  }

  const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
  if (!match) {
    return badRequest('Invalid image data format', 'INVALID_IMAGE_FORMAT');
  }
  const mimeSubtype = match[1].toLowerCase();
  const base64 = match[2];

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) throw new Error('Empty buffer');
  } catch {
    return badRequest('Failed to process image data', 'BUFFER_ERROR');
  }

  // 1MB cap
  if (buffer.length > 1024 * 1024) {
    return { status: 413, body: { error: 'Image too large', code: 'FILE_TOO_LARGE', maxSize: '1024KB' } };
  }

  // Magic-byte sniff: confirm the buffer matches the claimed format. Defends against
  // a client labeling an arbitrary blob as image/* to abuse storage.
  const sniffedMime = sniffImageMime(buffer);
  if (!sniffedMime) {
    return badRequest('Uploaded data is not a recognized image format', 'INVALID_IMAGE_BYTES');
  }
  // Use the sniffed type, not the client-claimed one.
  const ext = sniffedMime.split('/')[1] || 'jpg';
  void mimeSubtype; // accepted but not trusted

  // Stable filename per user — `upsert: true` overwrites the previous
  // upload in place, instead of accumulating one file per change. This
  // means a user with 100 profile updates has 1 file in storage, not 100,
  // and an overwritten photo is genuinely gone (subject to CDN cache TTL)
  // rather than retrievable via its old timestamped URL forever.
  //
  // We still version the *URL* with a `?v=<ts>` query so cache layers
  // (Supabase CDN, the user's browser) refetch on update without us
  // having to bust the cache by changing the path.
  const fileName = `users/${userId}/profile.${ext}`;
  const { error } = await supabase.storage
    .from('user-uploads')
    .upload(fileName, buffer, { contentType: sniffedMime, upsert: true });

  if (error) {
    log.error('storage_upload_failed', { userId, err: serializeErr(error) });
    return serverError('Storage upload failed', 'STORAGE_ERROR');
  }

  // Best-effort cleanup of legacy timestamped uploads from the previous
  // path scheme (`profile-<ts>.ext`). This runs once per upload and the
  // result is non-fatal — if the list/delete fails, the new file is still
  // saved correctly. Skipping on error keeps the happy path fast.
  try {
    const { data: existing } = await supabase.storage
      .from('user-uploads')
      .list(`users/${userId}`, { limit: 100 });
    const stale = (existing ?? [])
      .filter((f) => f.name.startsWith('profile-'))
      .map((f) => `users/${userId}/${f.name}`);
    if (stale.length > 0) {
      await supabase.storage.from('user-uploads').remove(stale);
    }
  } catch (cleanupErr) {
    log.warn('profile_photo_cleanup_skipped', { userId, err: serializeErr(cleanupErr) });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('user-uploads').getPublicUrl(fileName);

  // Version the URL so caches refetch on next update.
  const versioned = `${publicUrl}?v=${Date.now()}`;

  return { status: 200, body: { success: true, url: versioned, fileName } };
}

function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // GIF: GIF87a or GIF89a
  if (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif';
  // WEBP: RIFF....WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export const routes: RouteDef[] = [
  {
    method: 'POST',
    path: '/api/upload/profile-photo',
    auth: 'authenticated',
    handler: (req, supabase) => handleUploadProfilePhoto(req, supabase),
  },
];
