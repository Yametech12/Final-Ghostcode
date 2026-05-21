import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { EnhancedAuthProvider } from './contexts/EnhancedAuthContext';
import SessionErrorBoundary from './components/SessionErrorBoundary';
import App from './App';
import './index.css';
import { Toaster } from 'sonner';
import { validateEnvironment } from './utils/env';

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  event.preventDefault();
});

// Validate environment on startup
try {
  validateEnvironment();
} catch (err) {
  console.error('Environment validation failed:', err);
  // Show error to user in development
  if (import.meta.env.DEV) {
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; color: #ef4444; padding: 2rem; text-align: center;">
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
              // Map sonner's CSS variables to the luxury palette tokens.
              ['--normal-bg' as string]: 'rgba(22, 17, 24, 0.95)',
              ['--normal-text' as string]: '#F0EBE3',
              ['--normal-border' as string]: 'rgba(232, 199, 126, 0.12)',
              ['--success-bg' as string]: 'rgba(22, 17, 24, 0.95)',
              ['--success-text' as string]: '#6FA083',
              ['--success-border' as string]: 'rgba(111, 160, 131, 0.30)',
              ['--error-bg' as string]: 'rgba(22, 17, 24, 0.95)',
              ['--error-text' as string]: '#C77A6F',
              ['--error-border' as string]: 'rgba(199, 122, 111, 0.40)',
              ['--warning-bg' as string]: 'rgba(22, 17, 24, 0.95)',
              ['--warning-text' as string]: '#C99B5B',
              ['--warning-border' as string]: 'rgba(201, 155, 91, 0.30)',
              ['--info-bg' as string]: 'rgba(22, 17, 24, 0.95)',
              ['--info-text' as string]: '#7A93A8',
              ['--info-border' as string]: 'rgba(122, 147, 168, 0.30)',
            }}
            toastOptions={{
              className:
                'backdrop-blur-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] rounded-xl',
            }}
          />
        </EnhancedAuthProvider>
      </SessionErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);

// Register service worker for PWA installability
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('[SW] Registered:', registration.scope);
    }).catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });
  });
}
