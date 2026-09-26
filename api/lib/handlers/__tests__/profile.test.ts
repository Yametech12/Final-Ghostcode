import { describe, it, expect } from 'vitest';
import { handleUploadProfilePhoto } from '../profile';
import type { NormalizedRequest } from '../../types';
import { makeSupabaseDouble, USER_A } from '../../testHelpers/supabaseDouble';

const fakeUser = { id: USER_A, email: 'u@example.com' } as any;

function makeReq(over: Partial<NormalizedRequest> = {}): NormalizedRequest {
  return { method: 'POST', body: {}, query: {}, params: {}, headers: {}, user: fakeUser, ...over };
}

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const validPngBase64 = `data:image/png;base64,${Buffer.concat([PNG_HEADER, Buffer.alloc(20)]).toString('base64')}`;

describe('profile module — handleUploadProfilePhoto', () => {
  it('returns 401 when unauthenticated', async () => {
    const r = await handleUploadProfilePhoto(makeReq({ user: null }), makeSupabaseDouble());
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 MISSING_IMAGE_DATA when base64Data is absent', async () => {
    const r = await handleUploadProfilePhoto(makeReq({ body: {} }), makeSupabaseDouble());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('MISSING_IMAGE_DATA');
  });

  it('returns 400 INVALID_IMAGE_FORMAT for a malformed data URL', async () => {
    const r = await handleUploadProfilePhoto(makeReq({ body: { base64Data: 'not-a-data-url' } }), makeSupabaseDouble());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_IMAGE_FORMAT');
  });

  it('rejects a claimed PNG whose magic bytes say otherwise', async () => {
    const fake = `data:image/png;base64,${Buffer.from('hello world!!').toString('base64')}`;
    const r = await handleUploadProfilePhoto(makeReq({ body: { base64Data: fake } }), makeSupabaseDouble());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_IMAGE_BYTES');
  });

  it('returns 413 FILE_TOO_LARGE above 1 MB', async () => {
    const big = Buffer.concat([PNG_HEADER, Buffer.alloc(1024 * 1024 + 1)]);
    const r = await handleUploadProfilePhoto(
      makeReq({ body: { base64Data: `data:image/png;base64,${big.toString('base64')}` } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(413);
    expect(r.body.code).toBe('FILE_TOO_LARGE');
    expect(r.body.maxSize).toBe('1024KB');
  });

  it('uploads a valid PNG and returns the versioned URL + deterministic filename', async () => {
    const r = await handleUploadProfilePhoto(makeReq({ body: { base64Data: validPngBase64 } }), makeSupabaseDouble());
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.url.startsWith('https://cdn.example/photo.png?v=')).toBe(true);
    expect(r.body.fileName).toBe(`users/${USER_A}/profile.png`);
  });

  it('returns 500 STORAGE_ERROR when the upload fails', async () => {
    const r = await handleUploadProfilePhoto(
      makeReq({ body: { base64Data: validPngBase64 } }),
      makeSupabaseDouble({ storageUpload: { error: { message: 'boom' } } }),
    );
    expect(r.status).toBe(500);
    expect(r.body.code).toBe('STORAGE_ERROR');
  });

  it('derives the filename from the JWT user, never from the body', async () => {
    const r = await handleUploadProfilePhoto(
      makeReq({ body: { base64Data: validPngBase64, userId: 'attacker-chosen-id' } }),
      makeSupabaseDouble(),
    );
    expect(r.body.fileName.startsWith(`users/${USER_A}/`)).toBe(true);
    expect(r.body.fileName).not.toContain('attacker-chosen-id');
  });
});
