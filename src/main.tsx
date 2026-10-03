import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { EnhancedAuthProvider } from './contexts/EnhancedAuthContext';
import SessionErrorBoundary from './components/SessionErrorBoundary';
import App from './App';
import './index.css';
import { validateEnvironment } from './utils/env';
import { initSentry } from './lib/sentry';
import { initAnalytics } from './utils/analytics';

// Initialize Sentry early (no-op in dev or without DSN)
initSentry();

// Initialize product analytics early (no-op without VITE_GA_TRACKING_ID)
initAnalytics();

// Global unhandled promise rejection handler. We deliberately do NOT call
// preventDefault() unconditionally — Sentry's beforeSend already filters
// AbortError noise, and silencing every rejection hides real crashes.
// Only suppress the well-known "transient noise" patterns; report
// everything else to Sentry (no console spam in production).
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

  // Report to Sentry instead of console.error — keeps production consoles
  // clean while preserving full diagnostics for debugging.
  import('./lib/sentry').then(({ captureException }) => {
    captureException(
      reason instanceof Error ? reason : new Error(`Unhandled rejection: ${msg.slice(0, 200)}`),
    );
  }).catch(() => { /* ignore */ });
});

// Validate environment on startup
try {
  validateEnvironment();
} catch (err) {
  // Fatal startup error — report to Sentry (no console spam in production).
  import('./lib/sentry').then(({ captureException }) => {
    captureException(err instanceof Error ? err : new Error('Environment validation failed'));
  }).catch(() => { /* ignore */ });
  if (import.meta.env.DEV) {
    console.error('Environment validation failed:', err);
    // Escape the error message to prevent HTML injection (defense in depth,
    // even though this path is dev-only and err.message is developer-controlled).
    const safeMsg = String(err instanceof Error ? err.message : 'Missing environment variables')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; color: #ef4444; padding: 2rem; text-align: center;">
        <div>
          <h1>Configuration Error</h1>
          <p>${safeMsg}</p>
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
