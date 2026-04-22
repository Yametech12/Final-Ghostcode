import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  errorDetails?: string;
}

export default class SessionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: 'Something went wrong.', errorDetails: undefined };
  }

  static getDerivedStateFromError(error: Error): State {
    let errorMessage = 'Something went wrong.';
    let errorDetails: string | undefined;

    if (error.message?.includes('uuid') || error.message?.includes('invalid input syntax')) {
      errorMessage = 'Your session expired. Please refresh the page.';
      errorDetails = 'Session timeout or invalid authentication.';
    } else if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
      errorMessage = 'AI service is temporarily busy. Please try again.';
      errorDetails = 'Server error - the service may be overloaded.';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Network connection issue. Check your internet.';
      errorDetails = 'Unable to connect to the server.';
    } else if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('PERMISSION_DENIED')) {
      errorMessage = 'Authentication error. Please sign in again.';
      errorDetails = 'Invalid or expired credentials.';
    }

    return { hasError: true, errorMessage, errorDetails };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SessionErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: 'Something went wrong.', errorDetails: undefined });
    this.props.onReset?.();
    // Clear any cached data and reload
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0508] p-4">
          <div className="max-w-md w-full bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-red-500/20 text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-12 h-12 text-red-400" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Oops!</h2>
            <p className="text-slate-300 mb-4">{this.state.errorMessage}</p>

            {this.state.errorDetails && (
              <p className="text-slate-500 text-sm mb-6">{this.state.errorDetails}</p>
            )}

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-medium py-3 rounded-xl transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh & Retry
            </button>

            <p className="text-slate-500 text-xs mt-4">
              If this persists, try clearing your browser cache or contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
