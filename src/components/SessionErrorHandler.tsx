import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

interface SessionErrorHandlerProps {
  className?: string;
  showRetryButton?: boolean;
  compact?: boolean;
}

export default function SessionErrorHandler({
  className,
  showRetryButton = true,
  compact = false
}: SessionErrorHandlerProps) {
  const { error, loading, retrySession } = useAuth();

  if (!error || loading) return null;

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2",
        className
      )}>
        <WifiOff className="w-4 h-4" />
        <span>Connection issue</span>
        {showRetryButton && (
          <button
            onClick={retrySession}
            className="ml-auto flex items-center gap-1 text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded transition-colors"
            disabled={loading}
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-red-50 border border-red-200 rounded-lg p-4",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800 mb-1">
            Session Loading Failed
          </h3>
          <p className="text-sm text-red-700 mb-3">
            We couldn't load your session. This might be due to a network issue or server timeout.
          </p>
          {showRetryButton && (
            <button
              onClick={retrySession}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 border border-red-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              {loading ? 'Retrying...' : 'Try Again'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}