import { motion } from 'motion/react';
import Logo from './Logo';
import { Skeleton } from './ui/Skeleton';
import LoadingScreen from './LoadingScreen';

export function LoadingSpinner({ size = "md", message, className }: { size?: "sm" | "md" | "lg"; message?: string; className?: string }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className || ''}`}>
      <div
        className={`${sizeClasses[size]} border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin`}
        style={{ animationDuration: '1s' }}
      />
      {message && <p className="text-sm text-white/70">{message}</p>}
    </div>
  );
}

export { LoadingScreen };

export function InlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-accent-primary/20 blur-md animate-pulse" />
        <div
          className="absolute inset-0 rounded-full border-4 border-accent-primary/30 border-t-accent-primary animate-spin"
          style={{ animationDuration: '1s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Logo size="md" />
        </div>
      </div>
      {message && (
        <motion.p
          className="text-sm text-white/60 font-mono tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}

export function ContentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32" />
      <div className="space-y-2">
        <Skeleton className="h-3" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}