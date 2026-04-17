

// Simple, clean loading spinner
export function LoadingSpinner({ size = "md", message }: { size?: "sm" | "md" | "lg"; message?: string }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-3">
      <div className={`${sizeClasses[size]} border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin`} />
      {message && <p className="text-sm text-white/70">{message}</p>}
    </div>
  );
}

// Main loading screen for app initialization
export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-mystic-950 flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-white/70">Loading Epimetheus...</p>
      </div>
    </div>
  );
}

// Inline loading for page transitions
export function InlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <LoadingSpinner size="md" message={message} />
    </div>
  );
}

// Skeleton loader for content
export function ContentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-3/4"></div>
      <div className="h-4 bg-white/10 rounded w-1/2"></div>
      <div className="h-32 bg-white/10 rounded"></div>
      <div className="space-y-2">
        <div className="h-3 bg-white/10 rounded"></div>
        <div className="h-3 bg-white/10 rounded w-5/6"></div>
        <div className="h-3 bg-white/10 rounded w-4/6"></div>
      </div>
    </div>
  );
}