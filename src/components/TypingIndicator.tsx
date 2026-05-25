import { Bot } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface TypingIndicatorProps {
  /** Extra classes for the outer wrapper. */
  className?: string;
  /** Dot size. Default 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * `bubble` (default) renders the dots inside a rounded bubble next to a Bot
   * avatar, matching the advisor chat layout.
   * `inline` renders just the dots in a pill — useful inside an existing
   * message bubble that already has its own avatar.
   */
  variant?: 'bubble' | 'inline';
}

/**
 * Three pulsing dots that show while the model is "thinking" before tokens
 * arrive. Single shared component for the advisor and any other chat UI.
 */
export function TypingIndicator({
  className,
  size = 'md',
  variant = 'bubble',
}: TypingIndicatorProps) {
  const dotSize = {
    sm: 'w-1 h-1',
    md: 'w-1.5 h-1.5',
    lg: 'w-2 h-2',
  }[size];

  const dots = (
    <>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={cn('rounded-full bg-slate-400 animate-pulse', dotSize)}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </>
  );

  if (variant === 'inline') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Advisor is typing"
        className={cn(
          'flex items-center gap-1 px-4 py-2 bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-2xl w-fit',
          className,
        )}
      >
        {dots}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      role="status"
      aria-live="polite"
      aria-label="Advisor is typing"
      className={cn('flex gap-3', className)}
    >
      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
        <Bot aria-hidden="true" className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-slate-800/80 rounded-2xl px-4 py-3 flex items-center gap-1.5">
        {dots}
      </div>
    </motion.div>
  );
}
