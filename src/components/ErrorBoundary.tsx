import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * Generic React error boundary for route-level and component-level crashes.
 *
 * Design principles:
 * - Users see a clear, jargon-free message — never raw error text, stack
 *   traces, or internal operation details.
 * - The full technical error goes to Sentry (via lib/sentry) for debugging.
 * - A retry path is always offered; the boundary resets cleanly.
 */

interface Props {
  children: ReactNode;
  /** Optional label shown in Sentry context (e.g. route name). */
  label?: string;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report the full technical details to Sentry — never to the UI.
    import('../lib/sentry').then(({ captureException }) => {
      captureException(error, {
        componentStack: errorInfo.componentStack,
        boundaryLabel: this.props.label ?? 'generic',
      });
    }).catch(() => {
      // Sentry unavailable — error is still captured by the global
      // unhandled-rejection / window.onerror handlers as a fallback.
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  private handleGoHome = () => {
    this.setState({ hasError: false });
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-mystic-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card p-8 space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto border border-red-500/30">
              <AlertTriangle className="w-10 h-10 text-red-500" aria-hidden />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-50">Something went wrong</h2>
              <p className="text-slate-400">
                This part of the app ran into a problem. Your data is safe —
                try again, or head home and come back.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-100 font-bold hover:bg-white/10 transition-all"
              >
                <RotateCcw className="w-4 h-4" aria-hidden />
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 py-3 rounded-xl accent-gradient text-mystic-950 font-bold hover:scale-[1.02] transition-all"
              >
                <Home className="w-4 h-4" aria-hidden />
                Home
              </button>
            </div>

            <p className="text-xs text-slate-500">
              If this keeps happening, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
