import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { captureException } from '../lib/sentry';

export function EnvironmentDebug() {
  const [envInfo, setEnvInfo] = useState<any>({});
  const [minimized, setMinimized] = useState(false);
  const [sentryStatus, setSentryStatus] = useState<string | null>(null);

  useEffect(() => {
    const showDebug = import.meta.env.DEV || window.location.search.includes('debug=1');

    if (showDebug) {
      const info = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        online: navigator.onLine,
        cookiesEnabled: navigator.cookieEnabled,
        viteEnvKeys: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')),
        mode: import.meta.env.MODE,
        prod: import.meta.env.PROD,
        dev: import.meta.env.DEV,
      };

      setEnvInfo(info);
      console.log('🔍 Environment Debug Info:', info);
    }
  }, []);

  if (Object.keys(envInfo).length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded-lg text-xs font-mono max-w-sm z-50 border border-white/20">
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-white/10 rounded px-2 py-1"
        onClick={() => setMinimized(!minimized)}
      >
        <span className="font-bold text-yellow-400">🔍 Env Debug</span>
        <button className="text-gray-400 hover:text-white">
          {minimized ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        </button>
      </div>
      {!minimized && (
        <div className="mt-2 space-y-1 max-h-56 overflow-auto">
          {Object.entries(envInfo).map(([key, value]) => (
            <div key={key} className="flex justify-between px-2">
              <span className="text-gray-400">{key}:</span>
              <span className="text-green-400 ml-2 truncate">{String(value)}</span>
            </div>
          ))}

          {/*
            Sentry verification button — dev-only (this whole component
            is gated by import.meta.env.DEV in App.tsx). Throws an error
            inside a try/catch and forwards via captureException so we
            can confirm the DSN is wired without actually breaking the
            page. The literal "throw without catch" pattern from Sentry's
            onboarding guide tears down React for the rest of the
            session — handy once, painful while iterating.
          */}
          <div className="mt-3 pt-2 border-t border-white/10 px-2 space-y-1">
            <div className="text-yellow-400 font-bold">Sentry test</div>
            <button
              type="button"
              onClick={() => {
                try {
                  throw new Error('Epimetheus dev Sentry probe — ignore');
                } catch (e) {
                  captureException(e, { source: 'EnvironmentDebug.probe' });
                  setSentryStatus(
                    import.meta.env.PROD
                      ? 'Captured (check Sentry inbox)'
                      : 'Skipped: Sentry is disabled in dev',
                  );
                }
              }}
              className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded px-2 py-1 text-[10px]"
            >
              Send test event
            </button>
            {sentryStatus && (
              <div className="text-[10px] text-gray-300">{sentryStatus}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
