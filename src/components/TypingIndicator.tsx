interface TypingIndicatorProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TypingIndicator({ className = '', size = 'md' }: TypingIndicatorProps) {
  const sizeClasses = {
    sm: 'w-1 h-1',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };

  const dotClass = `bg-slate-400 rounded-full animate-bounce ${sizeClasses[size]}`;

  return (
    <div className={`flex items-center gap-1 px-4 py-2 bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-2xl w-fit ${className}`}>
      <span className={dotClass} style={{ animationDelay: '0ms' }} />
      <span className={dotClass} style={{ animationDelay: '150ms' }} />
      <span className={dotClass} style={{ animationDelay: '300ms' }} />
    </div>
  );
}
