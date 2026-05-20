import { motion } from 'motion/react';
import Logo from './Logo';
import { Skeleton } from './ui/Skeleton';
import LoadingScreen from './LoadingScreen';
import '../styles/loading.css';

export function LoadingSpinner({ size = "md", message, className }: { size?: "sm" | "md" | "lg"; message?: string; className?: string }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className || ''}`}>
      <div
        className={`${sizeClasses[size]} loading-spinner`}
      />
      {message && <p className="text-sm text-white/70">{message}</p>}
    </div>
  );
}

export { LoadingScreen };

export function InlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5">
      <div className="relative">
        {/* Outer pulsing ring */}
        <motion.div
          className="absolute -inset-3 rounded-2xl border border-accent-primary/20"
          animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="inline-loader-container">
          <div className="inline-loader-glow" />
          <div className="inline-loader-ring" />
          <div className="inline-loader-logo">
            <Logo size="md" />
          </div>
        </div>
      </div>
      <motion.p
        className="text-xs text-slate-400 font-mono tracking-wider"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {message || 'Loading...'}
      </motion.p>
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