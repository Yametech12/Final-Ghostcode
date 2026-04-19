import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { EnhancedAuthProvider } from './contexts/EnhancedAuthContext';
import SessionErrorBoundary from './components/SessionErrorBoundary';
import App from './App';
import './index.css';

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  event.preventDefault();
});

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