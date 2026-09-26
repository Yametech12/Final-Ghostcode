// Typed service-worker registration + lifecycle wrapper.
//
// Responsibilities:
//   • register('/sw.js') — PROD only (dev serves unhashed modules; a SW would
//     cache them and break HMR).
//   • Trigger an immediate update check so newly deployed SWs are discovered
//     without waiting for the browser's 24h refresh.
//   • Page-side cleanup of old-version caches (the SW also cleans up on
//     activate; this covers tabs that never re-activate).
//   • Dispatch a window `swUpdated` CustomEvent when a new waiting worker is
//     detected, so UI (src/components/pwa/UpdatePrompt.tsx) can offer reload.

export const SW_UPDATED_EVENT = 'swUpdated';
export const SW_URL = '/sw.js';

export interface SwUpdatedDetail {
  /** The waiting service worker that will take over once applied. */
  waiting: ServiceWorker;
}

declare global {
  interface WindowEventMap {
    swUpdated: CustomEvent<SwUpdatedDetail>;
  }
}

// Cache kinds written by the current sw.js release (public/sw.js).
// Anything under the `epimetheus-` prefix that is NOT the newest lexical
// member of its kind belongs to an older deploy and can be deleted.
export const CACHE_PREFIX = 'epimetheus-';
const CACHE_KINDS = ['shell', 'offline', 'static', 'images'] as const;

/**
 * Keep only the lexically-newest cache per kind; return the stale names.
 * Pure function — no side effects, safe to unit-test.
 */
export function staleCacheNames(cacheNames: string[]): string[] {
  const newestByKind = new Map<string, string>();
  const stale: string[] = [];
  for (const name of cacheNames) {
    const kind = CACHE_KINDS.find((k) => name.startsWith(`${CACHE_PREFIX}${k}-`));
    if (!kind) continue; // foreign cache — leave it alone
    const current = newestByKind.get(kind);
    if (!current) {
      newestByKind.set(kind, name);
      continue;
    }
    if (name > current) {
      newestByKind.set(kind, name);
      stale.push(current);
    } else {
      stale.push(name);
    }
  }
  return stale;
}

/**
 * Delete caches from previous SW versions. The SW's own `activate` handler
 * does this too — this is a belt-and-braces pass for long-lived tabs.
 */
export async function cleanupOldCaches(): Promise<string[]> {
  if (typeof caches === 'undefined') return [];
  const keys = await caches.keys();
  const stale = staleCacheNames(keys);
  await Promise.all(stale.map((name) => caches.delete(name)));
  return stale;
}

/**
 * Register the service worker and wire the update-detection flow.
 * Resolves with the registration, or null when SW is unsupported / dev mode.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  if (!import.meta.env.PROD) return null;

  try {
    const registration = await navigator.serviceWorker.register(SW_URL);

    // Best-effort page-side cleanup of previous-version caches.
    void cleanupOldCaches().catch(() => undefined);

    // Force an update check on every load so newly deployed SWs are
    // discovered without a cold reload.
    registration.update().catch(() => undefined);

    const notify = (worker: ServiceWorker): void => {
      window.dispatchEvent(
        new CustomEvent<SwUpdatedDetail>(SW_UPDATED_EVENT, { detail: { waiting: worker } })
      );
    };

    // A waiting worker exists at registration time when the user was
    // already on a page when the SW updated.
    if (registration.waiting && navigator.serviceWorker.controller) {
      notify(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          notify(installing);
        }
      });
    });

    return registration;
  } catch (err) {
    console.warn('[SW] Registration failed:', err);
    return null;
  }
}

/**
 * Activate the waiting worker, then reload once it takes control.
 * Used by the UpdatePrompt "Reload now" action.
 */
export function applyUpdate(worker: ServiceWorker): void {
  worker.postMessage({ type: 'SKIP_WAITING' });
  // The new SW will claim clients; reload once it does.
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => window.location.reload(),
    { once: true }
  );
}
