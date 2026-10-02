import { ArrowDown, AlertTriangle, X } from 'lucide-react';
import { useSmartScroll } from '../../hooks/useSmartScroll';
import { Message } from './Message';
import { EmptyState } from './EmptyState';
import type { AdvisorMessage } from '../../hooks/useAdvisorChat';

interface MessageListProps {
  messages: AdvisorMessage[];
  isStreaming: boolean;
  isSending: boolean;
  /** Fatal send failure (auth/plan/network) — shown as a banner above the composer. */
  errorMessage?: string | null;
  /** Retry the most recent failed exchange (re-sends the last user message). */
  onRetryLast?: () => void;
  onDismissError?: () => void;
  onReaction: (id: string, reaction: 'like' | 'dislike') => void;
  onRetry: (id: string) => void;
  onSelectPrompt: (prompt: string) => void;
}

/**
 * Scrollable area that lists messages or shows the empty state.
 * Uses smart-scroll: only auto-follows the bottom when the user is already there.
 */
export function MessageList({
  messages,
  isStreaming,
  isSending,
  errorMessage,
  onRetryLast,
  onDismissError,
  onReaction,
  onRetry,
  onSelectPrompt,
}: MessageListProps) {
  // Re-trigger autoscroll on every new chunk by tracking total content length.
  const totalContent = messages.reduce((acc, m) => acc + m.content.length, 0);
  const { containerRef, isAtBottom, scrollToBottom } = useSmartScroll(totalContent);

  // NOTE: no separate <TypingIndicator> here. The assistant bubble is
  // pre-added before the request fires and renders its own inline dots while
  // empty, so a standalone indicator would duplicate it (two "..." pills at
  // once — a regression the pre-added placeholder introduced).

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto px-1 sm:px-2"
        data-lenis-prevent
      >
        {messages.length === 0 ? (
          <EmptyState onSelectPrompt={onSelectPrompt} disabled={isSending} />
        ) : (
          <div
            className="flex flex-col gap-3 py-2 max-w-3xl mx-auto"
            // aria-live announces new assistant tokens to screen readers as they
            // stream in. "polite" so it doesn't interrupt the user mid-input;
            // "atomic=false" so only newly added nodes are read, not the
            // entire transcript on every chunk.
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-relevant="additions text"
          >
            {messages.map(message => (
              <Message
                key={message.id}
                message={message}
                onReaction={onReaction}
                onRetry={onRetry}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating "scroll to latest" button — only shown when user has scrolled up */}
      {!isAtBottom && messages.length > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to latest message"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-2 rounded-full bg-mystic-900/95 backdrop-blur border border-accent-primary/15 text-sm text-slate-200 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] hover:border-accent-primary/30 transition-colors"
        >
          <ArrowDown aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
          <span>Latest</span>
        </button>
      )}

      {/* Fatal send error — dismissible banner with retry, rendered inside the
          scroll area's parent so it stays visible regardless of scroll position. */}
      {errorMessage && !isStreaming && (
        <div
          role="alert"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 max-w-[90%] pl-3 pr-1.5 py-2 rounded-xl bg-status-error/10 border border-status-error/30 backdrop-blur shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]"
        >
          <AlertTriangle aria-hidden="true" className="w-4 h-4 text-status-error shrink-0" strokeWidth={1.5} />
          <span className="text-xs text-slate-100 min-w-0 truncate">{errorMessage}</span>
          {onRetryLast && (
            <button
              type="button"
              onClick={onRetryLast}
              className="shrink-0 px-2 py-1 rounded-lg text-xs font-semibold text-status-error hover:bg-status-error/15 transition-colors"
            >
              Retry
            </button>
          )}
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              aria-label="Dismiss error"
              className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
