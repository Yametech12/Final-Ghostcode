import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home, ChevronDown, ClipboardCopy, Check } from 'lucide-react';
import { isAppError } from '../lib/errors';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** Sentry event id for the captured error, when Sentry is configured. */
  sentryEventId: string | null;
  /** Whether the raw technical details expander is open (hidden by default). */
  showDetails: boolean;
  /** Whether the details were copied to the clipboard (transient feedback). */
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    sentryEventId: null,
    showDetails: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Forward to Sentry and keep the event id so support can correlate a
    // user-reported bug with the server-side trace. No-op if not configured.
    import('@sentry/react')
      .then((Sentry) => {
        const eventId = Sentry.captureException(error, {
          extra: { componentStack: errorInfo.componentStack },
        });
        if (eventId) this.setState({ sentryEventId: eventId });
      })
      .catch(() => {
        // Sentry unavailable — already logged to console
      });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  private handleCopyDetails = () => {
    const { error, sentryEventId } = this.state;
    const details = [
      `Message: ${error?.message ?? 'unknown'}`,
      error?.stack ? `Stack:\n${error.stack}` : null,
      sentryEventId ? `Sentry event ID: ${sentryEventId}` : null,
      `URL: ${window.location.href}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    navigator.clipboard
      .writeText(details)
      .then(() => {
        this.setState({ copied: true });
        window.setTimeout(() => this.setState({ copied: false }), 2000);
      })
      .catch(() => {
        // Clipboard unavailable (permissions / insecure context) — ignore.
      });
  };

  private renderFriendlyMessage(): { headline: string; body: string } {
    const error = this.state.error;
    try {
      if (error?.message) {
        if (error.message.includes('Failed to fetch dynamically imported module')) {
          return {
            headline: 'Update available',
            body: 'A new version of the application is available. Please refresh the page to update.',
          };
        }
        if (isAppError(error) && error.operationType) {
          return {
            headline: 'Database hiccup',
            body: 'We hit a problem talking to the database. Your data is safe — try again in a moment.',
          };
        }
      }
    } catch {
      // fall through to the generic message
    }
    return {
      headline: 'Something went wrong on our end',
      body: 'An unexpected error occurred. We\'ve been notified automatically — try again, or head back home.',
    };
  }

  public render() {
    if (this.state.hasError) {
      const { headline, body } = this.renderFriendlyMessage();
      const { error, sentryEventId, showDetails, copied } = this.state;
      const rawMessage = error?.message ?? 'Unknown error';

      return (
        <div className="min-h-screen bg-mystic-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card p-8 space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto border border-red-500/30">
              <AlertTriangle className="w-10 h-10 text-red-500" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white" role="heading" aria-level={2}>
                {headline}
              </h2>
              <p className="text-slate-400">{body}</p>
            </div>

            {/* Raw technical details are hidden by default and opt-in only. */}
            <div className="text-left">
              <button
                type="button"
                onClick={this.handleCopyDetails}
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
                aria-label="Copy error details to clipboard for support"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-status-success" aria-hidden="true" />
                ) : (
                  <ClipboardCopy className="w-4 h-4" aria-hidden="true" />
                )}
                {copied ? 'Copied!' : 'Copy error details'}
              </button>

              <button
                type="button"
                onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                aria-expanded={showDetails}
                aria-controls="error-technical-details"
                className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
                {showDetails ? 'Hide technical details' : 'Show technical details'}
              </button>

              {showDetails && (
                <div
                  id="error-technical-details"
                  className="mt-2 p-4 rounded-xl bg-black/40 border border-white/5 overflow-hidden"
                >
                  <p className="text-xs font-mono text-red-400 break-words">{rawMessage}</p>
                  {error?.stack && (
                    <pre className="mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-500 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                      {error.stack}
                    </pre>
                  )}
                  {sentryEventId && (
                    <div className="mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-500">
                      Sentry event ID: <span className="text-slate-300 select-all">{sentryEventId}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Retry
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 py-3 rounded-xl accent-gradient text-white font-bold hover:scale-[1.02] transition-all"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
