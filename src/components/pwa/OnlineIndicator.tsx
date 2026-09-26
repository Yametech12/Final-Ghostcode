import { useEffect, useState } from 'react';

/**
 * Tiny network-status badge. Renders nothing while online; shows an
 * "Offline — some features unavailable" pill when the browser reports no
 * connectivity (navigator.onLine + online/offline events).
 */
export default function OnlineIndicator() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="online-indicator"
      className="fixed inset-x-0 top-0 z-[60] flex justify-center"
    >
      <div className="mt-2 rounded-full border border-status-warning/40 bg-mystic-900/95 px-4 py-1.5 text-xs font-medium text-status-warning shadow-md">
        Offline — cached pages only
      </div>
    </div>
  );
}
