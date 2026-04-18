import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  isSessionError: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class SessionErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isSessionError: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Check if this is a session-related error
    const isSessionError = error.message?.includes('session') ||
                          error.message?.includes('auth') ||
                          error.message?.includes('timeout') ||
                          error.message?.includes('unauthorized') ||
                          error.name === 'AuthError';

    return {
      hasError: true,
      error,
      isSessionError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // logErrorToService(error, errorInfo);
    }

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isSessionError: false
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportBug = () => {
    // Open bug report modal or redirect to support
    const subject = encodeURIComponent('Application Error Report');
    const body = encodeURIComponent(`
Error Details:
${this.state.error?.message}

Stack Trace:
${this.state.error?.stack}

Component Stack:
${this.state.errorInfo?.componentStack}

Please describe what you were doing when this error occurred:
[Your description here]
    `);

    window.open(`mailto:support@epimetheus.ai?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.handleRetry} />;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-mystic-950 via-mystic-900 to-mystic-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-mystic-900/80 backdrop-blur-xl border border-red-500/20 rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            <h1 className="text-xl font-bold text-white mb-2">
              {this.state.isSessionError ? 'Session Error' : 'Something went wrong'}
            </h1>

            <p className="text-mystic-300 text-sm mb-6 leading-relaxed">
              {this.state.isSessionError
                ? 'There was an issue with your session. This might be due to a network problem or authentication timeout.'
                : 'An unexpected error occurred. Our team has been notified.'
              }
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-mystic-400 cursor-pointer hover:text-mystic-300 mb-2">
                  Error Details (Development)
                </summary>
                <div className="bg-black/20 rounded p-3 text-xs font-mono text-red-300 overflow-auto max-h-32">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="whitespace-pre-wrap mt-1">{this.state.error.stack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-mystic-800 hover:bg-mystic-700 text-mystic-200 rounded-lg font-medium transition-colors"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>

              <button
                onClick={this.handleReportBug}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-mystic-800 hover:bg-mystic-700 text-mystic-200 rounded-lg font-medium transition-colors text-sm"
              >
                <Bug className="w-4 h-4" />
                Report Issue
              </button>
            </div>

            <p className="text-xs text-mystic-500 mt-4">
              If this problem persists, please contact support@epimetheus.ai
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for using error boundary in functional components
export function useErrorHandler() {
  const auth = useEnhancedAuth();

  return React.useCallback((error: Error, context?: string) => {
    console.error(`Error handled by useErrorHandler${context ? ` in ${context}` : ''}:`, error);

    // If it's a session error, try to recover
    if (error.message?.includes('session') || error.message?.includes('auth')) {
      console.log('Session error detected, attempting recovery...');
      auth.retrySession();
    }

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // errorReportingService.captureException(error);
    }
  }, [auth]);
}

export default SessionErrorBoundary;