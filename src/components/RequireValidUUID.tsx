import React from 'react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { isUUID } from '../utils/validation';

interface RequireValidUUIDProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireValidUUID({ children, fallback }: RequireValidUUIDProps) {
  const { user, loading } = useEnhancedAuth();

  if (loading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-slate-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user?.id || !isUUID(user.id)) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="text-red-400 text-6xl">⚠️</div>
          <h2 className="text-xl font-semibold text-white">Session Error</h2>
          <p className="text-slate-400 max-w-md">
            Your session appears to be invalid. Please refresh the page or sign in again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/80 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
