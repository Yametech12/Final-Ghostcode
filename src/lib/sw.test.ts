import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyUpdate,
  cleanupOldCaches,
  registerServiceWorker,
  staleCacheNames,
  SW_UPDATED_EVENT,
  SW_URL,
} from './sw';

// ---------------------------------------------------------------------------
// staleCacheNames — pure helper
// ---------------------------------------------------------------------------

describe('staleCacheNames', () => {
  it('keeps the newest cache per kind and flags older ones as stale', () => {
    const caches = [
      'epimetheus-shell-v2-old-aaa',
      'epimetheus-shell-v3-new-bbb',
      'epimetheus-static-v2-old-aaa',
      'epimetheus-static-v3-new-bbb',
      'epimetheus-offline-v3-new-bbb',
      'epimetheus-images-v3-new-bbb',
    ];
    expect(staleCacheNames(caches)).toEqual([
      'epimetheus-shell-v2-old-aaa',
      'epimetheus-static-v2-old-aaa',
    ]);
  });

  it('returns the newer name as stale when input order is reversed', () => {
    const caches = ['epimetheus-shell-v3-new-bbb', 'epimetheus-shell-v2-old-aaa'];
    expect(staleCacheNames(caches)).toEqual(['epimetheus-shell-v2-old-aaa']);
  });

  it('never flags foreign caches (no epimetheus- prefix / unknown kind)', () => {
    const caches = ['workbox-precache-v2', 'epimetheus-mystery-xyz', 'other-app-cache'];
    expect(staleCacheNames(caches)).toEqual([]);
  });

  it('returns empty for empty or single-entry input', () => {
    expect(staleCacheNames([])).toEqual([]);
    expect(staleCacheNames(['epimetheus-shell-v3-abc'])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// cleanupOldCaches — Cache API interaction
// ---------------------------------------------------------------------------

describe('cleanupOldCaches', () => {
  let deleteMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    deleteMock = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue([
        'epimetheus-shell-v2-old-aaa',
        'epimetheus-shell-v3-new-bbb',
        'foreign-cache',
      ]),
      delete: deleteMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deletes only stale epimetheus caches and returns their names', async () => {
    const deleted = await cleanupOldCaches();
    expect(deleted).toEqual(['epimetheus-shell-v2-old-aaa']);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith('epimetheus-shell-v2-old-aaa');
  });
});

// ---------------------------------------------------------------------------
// registerServiceWorker — navigator.serviceWorker interaction
// ---------------------------------------------------------------------------

function fakeRegistration() {
  return {
    waiting: null,
    installing: null,
    active: null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
  } as unknown as ServiceWorkerRegistration;
}

describe('registerServiceWorker', () => {
  let registerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registerMock = vi.fn().mockResolvedValue(fakeRegistration());
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: registerMock, addEventListener: vi.fn(), controller: null },
      configurable: true,
    });
    vi.stubEnv('PROD', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('registers /sw.js and triggers an immediate update check', async () => {
    const registration = await registerServiceWorker();
    expect(registerMock).toHaveBeenCalledWith(SW_URL);
    expect(registration).not.toBeNull();
    expect((registration as ServiceWorkerRegistration).update).toHaveBeenCalled();
  });

  it('returns null and does not register when PROD is false (dev mode)', async () => {
    vi.stubEnv('PROD', false);
    const registration = await registerServiceWorker();
    expect(registration).toBeNull();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('dispatches swUpdated when a waiting worker is already present', async () => {
    const waiting = { postMessage: vi.fn() } as unknown as ServiceWorker;
    const registration = fakeRegistration() as ServiceWorkerRegistration;
    (registration as { waiting: ServiceWorker | null }).waiting = waiting;
    registerMock.mockResolvedValue(registration);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: registerMock, addEventListener: vi.fn(), controller: {} },
      configurable: true,
    });

    const listener = vi.fn();
    window.addEventListener(SW_UPDATED_EVENT, listener);
    await registerServiceWorker();
    window.removeEventListener(SW_UPDATED_EVENT, listener);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.waiting).toBe(waiting);
  });

  it('resolves null when registration rejects (never throws)', async () => {
    registerMock.mockRejectedValue(new Error('register failed'));
    const result = await registerServiceWorker();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyUpdate — SKIP_WAITING + controllerchange reload
// ---------------------------------------------------------------------------

describe('applyUpdate', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('posts SKIP_WAITING to the waiting worker and listens for controllerchange', () => {
    const addEventListenerMock = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { addEventListener: addEventListenerMock },
      configurable: true,
    });
    const postMessage = vi.fn();
    const worker = { postMessage } as unknown as ServiceWorker;

    applyUpdate(worker);

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(addEventListenerMock).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
      { once: true }
    );
  });
});
