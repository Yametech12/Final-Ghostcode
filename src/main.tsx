import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { EnhancedAuthProvider } from './contexts/EnhancedAuthContext';
import SessionErrorBoundary from './components/SessionErrorBoundary';
import App from './App';
import './index.css';
import { toast } from 'sonner';
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
        </EnhancedAuthProvider>
      </SessionErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
