import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isFirestoreError = false;
      let firestoreDetails = null;

      try {
        if (this.state.error?.message) {
          if (this.state.error.message.includes('Failed to fetch dynamically imported module')) {
            errorMessage = "A new version of the application is available. Please refresh the page to update.";
          } else {
            const parsed = JSON.parse(this.state.error.message);
            if (parsed.error && parsed.operationType) {
              isFirestoreError = true;
              firestoreDetails = parsed;
              errorMessage = `Database Error: ${parsed.error}`;
            }
          }
        }
      } catch {
        // Not a JSON error message
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-mystic-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card p-8 space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto border border-red-500/30">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">System Malfunction</h2>
              <p className="text-slate-400">
                {isFirestoreError 
                  ? "We encountered an issue communicating with the secure database."
                  : "Something went wrong while processing the application state."}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-left overflow-hidden">
              <p className="text-xs font-mono text-red-400 break-words">
                {errorMessage}
              </p>
              {isFirestoreError && firestoreDetails && (
                <div className="mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-500">
                  Operation: {firestoreDetails.operationType} | Path: {firestoreDetails.path}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 py-3 rounded-xl accent-gradient text-white font-bold hover:scale-[1.02] transition-all"
              >
                <Home className="w-4 h-4" />
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
