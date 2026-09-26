import { useCallback, useEffect, useState } from 'react';
import { applyUpdate, SW_UPDATED_EVENT, type SwUpdatedDetail } from '@/lib/sw';

/**
 * "New version available — reload" banner.
 *
 * Listens for the `swUpdated` CustomEvent dispatched by src/lib/sw.ts when a
 * new service worker is detected (waiting state). Renders nothing until an
 * update is pending; the "Reload now" action sends SKIP_WAITING and reloads
 * once the new worker takes control.
 */
export default function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const onUpdate = (event: Event): void => {
      const detail = (event as CustomEvent<SwUpdatedDetail>).detail;
      if (detail?.waiting) setWaiting(detail.waiting);
    };
    window.addEventListener(SW_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(SW_UPDATED_EVENT, onUpdate);
  }, []);

  const handleReload = useCallback(() => {
    if (waiting) applyUpdate(waiting);
  }, [waiting]);

  const handleDismiss = useCallback(() => setWaiting(null), []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4"
      data-testid="update-prompt"
    >
      <div className="flex items-center gap-3 rounded-xl border border-status-info/30 bg-mystic-900/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <span className="text-sm text-slate-100">
          New version available — reload to update.
        </span>
        <button
          type="button"
          onClick={handleReload}
          aria-label="Reload now to apply the new version"
          className="rounded-lg bg-accent-primary px-3 py-1.5 text-sm font-semibold text-mystic-950 transition-opacity hover:opacity-90"
        >
          Reload now
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss update prompt"
          className="rounded-lg px-2 py-1.5 text-sm text-slate-400 transition-colors hover:text-slate-100"
        >
          Later
        </button>
      </div>
    </div>
  );
}
