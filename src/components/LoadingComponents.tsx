


import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Logo from './Logo';
import { Skeleton } from './ui/Skeleton';

const loadingMessages = [
  "Initializing EPIMETHEUS system...",
  "Loading personality matrix...",
  "Calibrating assessment engine...",
  "Syncing field reports...",
  "Ready."
];

// Simple, clean loading spinner
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

// Main loading screen for app initialization
export function LoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-mystic-950 flex items-center justify-center p-8 overflow-hidden relative">
      {/* Atmospheric background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-primary/10 rounded-full blur-[120px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-secondary/10 rounded-full blur-[120px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Main content */}
      <motion.div
        className="text-center space-y-8 relative z-10"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Animated logo */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            filter: [
              "drop-shadow(0 0 20px rgba(var(--color-accent-primary), 0.3))",
              "drop-shadow(0 0 30px rgba(var(--color-accent-primary), 0.5))",
              "drop-shadow(0 0 20px rgba(var(--color-accent-primary), 0.3))"
            ]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Logo size="lg" className="glow-accent" />
        </motion.div>

        {/* Spinner */}
        <LoadingSpinner size="lg" />

        {/* Animated loading message */}
        <motion.div
          className="min-h-[60px] flex items-center justify-center"
          key={messageIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="text-white/70 text-sm tracking-wide">{loadingMessages[messageIndex]}</p>
        </motion.div>

        {/* Progress indicators */}
        <div className="flex items-center justify-center gap-2 pt-4">
          {loadingMessages.map((_, idx) => (
            <motion.div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                idx === messageIndex
                  ? 'bg-accent-primary scale-125'
                  : idx < messageIndex
                    ? 'bg-accent-primary/40'
                    : 'bg-white/20'
              }`}
              animate={{
                scale: idx === messageIndex ? [1, 1.2, 1] : 1
              }}
              transition={{
                duration: 1.5,
                repeat: idx === messageIndex ? Infinity : 0,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>

        {/* Bottom accent line */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-accent-primary/50 to-transparent"
          animate={{
            scaleX: [0.5, 1, 0.5],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.div>
    </div>
  );
}

// Inline loading for page transitions
export function InlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="relative w-16 h-16">
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-full bg-accent-primary/20 blur-md" />
        {/* Animated ring */}
        <div
          className="absolute inset-0 rounded-full border-4 border-accent-primary/30 border-t-accent-primary animate-spin"
          style={{ animationDuration: '1s' }}
        />
        {/* Centered logo */}
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

// Skeleton loader for content
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

