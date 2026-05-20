import { ArrowDown } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useSmartScroll } from '../../hooks/useSmartScroll';
import { Message } from './Message';
import { TypingIndicator } from './TypingIndicator';
import { EmptyState } from './EmptyState';
import type { AdvisorMessage } from '../../hooks/useAdvisorChat';

interface MessageListProps {
  messages: AdvisorMessage[];
  isStreaming: boolean;
  isSending: boolean;
  reactions: Record<string, 'like' | 'dislike' | undefined>;
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
  reactions,
  onReaction,
  onRetry,
  onSelectPrompt,
}: MessageListProps) {
  // Re-trigger autoscroll on every new chunk by tracking total content length.
  const totalContent = messages.reduce((acc, m) => acc + m.content.length, 0);
  const { containerRef, isAtBottom, scrollToBottom } = useSmartScroll(totalContent);

  // Show typing indicator only when streaming AND the last message is empty (no tokens yet).
  const lastMessage = messages[messages.length - 1];
  const showTyping = isStreaming && (!lastMessage || lastMessage.role !== 'model' || lastMessage.content === '');

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
          <div className="flex flex-col gap-3 py-2 max-w-3xl mx-auto">
            {messages.map(message => (
              <Message
                key={message.id}
                message={message}
                reaction={reactions[message.id]}
                onReaction={onReaction}
                onRetry={onRetry}
              />
            ))}
            <AnimatePresence>{showTyping && <TypingIndicator />}</AnimatePresence>
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
    </div>
  );
}
