import React from 'react';
import { cn } from "../../lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circle' | 'rounded';
  shimmer?: boolean;
}

export function Skeleton({ className, variant = 'default', shimmer = true, ...props }: SkeletonProps) {
  const variantClasses = {
    default: 'rounded-md',
    circle: 'rounded-full',
    rounded: 'rounded-lg'
  };

  return (
    <div
      className={cn(
        "bg-gradient-to-r from-white/5 via-white/10 to-white/5",
        shimmer && "shimmer-effect",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

// Specialized skeleton components for common UI patterns
export function MessageSkeleton() {
  return (
    <div className="flex gap-3 p-4">
      <Skeleton className="w-8 h-8 shrink-0" variant="circle" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-card p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-20" variant="rounded" />
          <Skeleton className="h-8 w-20" variant="rounded" />
        </div>
      </div>
    </div>
  );
}
