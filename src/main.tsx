import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { EnhancedAuthProvider } from './contexts/EnhancedAuthContext';
import SessionErrorBoundary from './components/SessionErrorBoundary';
import App from './App';
import './index.css';
import { Toaster } from 'sonner';
import { validateEnvironment } from './utils/env';
import { initSentry } from './lib/sentry';

// Initialize Sentry early (no-op in dev or without DSN)
initSentry();

// Global unhandled promise rejection handler. We deliberately do NOT call
// preventDefault() unconditionally — Sentry's beforeSend already filters
// AbortError noise, and silencing every rejection hides real crashes.
// Only suppress the well-known "transient noise" patterns; let everything
// else surface so we can fix it.
window.addEventListener('unhandledrejection', (event) => {
  const reason: any = event.reason;
  const msg: string =
    (reason && (reason.message || reason.name)) || String(reason || '');

  const isNoise =
    msg.includes('AbortError') ||
    msg.includes('The user aborted') ||
    msg.includes('signal is aborted') ||
    // ResizeObserver loop limit is a known browser non-issue
    msg.includes('ResizeObserver loop');

  if (isNoise) {
    event.preventDefault();
    return;
  }

  console.error('Unhandled Promise Rejection:', reason);
});

// Validate environment on startup
try {
  validateEnvironment();
} catch (err) {
  console.error('Environment validation failed:', err);
  // Show error to user in development
  if (import.meta.env.DEV) {
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; color: var(--color-status-error); padding: 2rem; text-align: center;">
        <div>
          <h1>Configuration Error</h1>
          <p>${err instanceof Error ? err.message : 'Missing environment variables'}</p>
          <p>Please check your .env file and restart the development server.</p>
        </div>
      </div>
    `;
    throw err;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionErrorBoundary>
        <EnhancedAuthProvider>
          <App />
          {/* Phase 2 — sonner Toaster themed against luxury palette (Req 9.7).
              Sonner reads CSS variables from the toaster element for its colors. */}
          <Toaster
            position="top-right"
            theme="dark"
            richColors={false}
            closeButton
            duration={4000}
            style={{
              // Map sonner's CSS variables onto the design tokens instead of
              // literals, so the toaster follows the light/dark theme flip.
              // The toaster element lives in the document, so var()/color-mix
              // resolve against the live palette.
              ['--normal-bg' as string]: 'color-mix(in srgb, var(--color-mystic-900) 95%, transparent)',
              ['--normal-text' as string]: 'var(--color-slate-100)',
              ['--normal-border' as string]: 'color-mix(in srgb, var(--color-accent-primary) 12%, transparent)',
              ['--success-bg' as string]: 'color-mix(in srgb, var(--color-mystic-900) 95%, transparent)',
              ['--success-text' as string]: 'var(--color-status-success)',
              ['--success-border' as string]: 'color-mix(in srgb, var(--color-status-success) 30%, transparent)',
              ['--error-bg' as string]: 'color-mix(in srgb, var(--color-mystic-900) 95%, transparent)',
              ['--error-text' as string]: 'var(--color-status-error)',
              ['--error-border' as string]: 'color-mix(in srgb, var(--color-status-error) 40%, transparent)',
              ['--warning-bg' as string]: 'color-mix(in srgb, var(--color-mystic-900) 95%, transparent)',
              ['--warning-text' as string]: 'var(--color-status-warning)',
              ['--warning-border' as string]: 'color-mix(in srgb, var(--color-status-warning) 30%, transparent)',
              ['--info-bg' as string]: 'color-mix(in srgb, var(--color-mystic-900) 95%, transparent)',
              ['--info-text' as string]: 'var(--color-status-info)',
              ['--info-border' as string]: 'color-mix(in srgb, var(--color-status-info) 30%, transparent)',
            }}
            toastOptions={{
              className:
                'backdrop-blur-xl shadow-popover rounded-xl',
            }}
          />
        </EnhancedAuthProvider>
      </SessionErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);

// Register service worker for PWA installability.
// On every load we check for a new SW; if one is waiting, prompt the user
// to refresh so they don't stay stuck on stale code after a deploy.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[SW] Registered:', registration.scope);

        // Force an update check on every load so newly deployed SWs are
        // discovered without a cold reload.
        registration.update().catch(() => undefined);

        const promptUpdate = (worker: ServiceWorker) => {
          // Lazy import sonner to avoid pulling it into the SW registration path
          // before the main bundle has loaded it.
          import('sonner')
            .then(({ toast }) => {
              toast('A new version is available', {
                description: 'Refresh to load the latest update.',
                action: {
                  label: 'Refresh',
                  onClick: () => {
                    worker.postMessage({ type: 'SKIP_WAITING' });
                    // The new SW will take control; reload once it does.
                    navigator.serviceWorker.addEventListener(
                      'controllerchange',
                      () => window.location.reload(),
                      { once: true },
                    );
                  },
                },
                duration: Infinity,
              });
            })
            .catch(() => {
              // Toast unavailable — fall back to a console hint.
              console.info('[SW] New version available. Reload to update.');
            });
        };

        // A waiting worker exists at registration time when the user was
        // already on a page when the SW updated.
        if (registration.waiting) promptUpdate(registration.waiting);

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              promptUpdate(installing);
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  });
}
