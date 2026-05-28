import { useState } from 'react';
import { Bot, User as UserIcon, Copy, ThumbsUp, ThumbsDown, RotateCcw, Check, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import type { AdvisorMessage } from '../../hooks/useAdvisorChat';

interface MessageProps {
  message: AdvisorMessage;
  reaction?: 'like' | 'dislike';
  onReaction: (id: string, reaction: 'like' | 'dislike') => void;
  onRetry?: (id: string) => void;
}

function formatTime(date?: Date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Convert single newlines into CommonMark hard breaks so the AI's intended
 * line-by-line layout survives the markdown renderer.
 *
 * Rules:
 *   - Blank lines (paragraph breaks) are preserved as-is.
 *   - Single newlines INSIDE fenced code blocks are preserved (code is
 *     literal — adding two spaces would change the source).
 *   - Single newlines between two non-blank lines get two trailing spaces
 *     prepended, which is the CommonMark hard-break syntax (renders as <br>).
 */
function prepareMarkdown(input: string): string {
  if (!input) return input;
  const segments = input.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return segments
    .map((seg, i) => {
      // Odd indices are the captured code blocks / inline code — leave alone.
      if (i % 2 === 1) return seg;
      // For non-code segments, turn a lone "\n" between two non-blank chars
      // into "  \n" (two spaces + newline = markdown hard break).
      return seg.replace(/([^\n])\n([^\n])/g, '$1  \n$2');
    })
    .join('');
}

/**
 * A single message bubble. The action toolbar is anchored below the bubble
 * (not floated to the right) so it works on mobile without clipping.
 */
export function Message({ message, reaction, onReaction, onRetry }: MessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('group flex gap-2.5', isUser && 'flex-row-reverse')}
    >
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          isUser ? 'bg-accent-primary' : 'bg-slate-700',
        )}
        aria-hidden="true"
      >
        {isUser ? <UserIcon className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-white" />}
      </div>

      <div className={cn('flex-1 min-w-0 max-w-[85%] sm:max-w-2xl space-y-1.5', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-accent-primary text-white rounded-tr-sm'
              : 'bg-slate-800/80 text-slate-100 rounded-tl-sm',
            message.failed && 'border border-red-500/40',
            // Visually distinguish the persisted "stream interrupted"
            // placeholder from a real model reply. Without this, the
            // placeholder uses the same bubble styling as a normal
            // assistant message and looks like the model literally said
            // "[interrupted before reply]". Italic + muted + dashed
            // border makes it read as system metadata.
            !isUser &&
              message.content === '[interrupted before reply]' &&
              'italic text-slate-400 bg-slate-800/40 border border-dashed border-slate-600/40',
          )}
        >
          {/* Empty assistant placeholder while waiting for the first token */}
          {!isUser && message.content === '' ? (
            <span className="inline-flex items-center gap-1 text-slate-400 italic">
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-pulse" />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '300ms' }} />
            </span>
          ) : !isUser && message.content === '[interrupted before reply]' ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <RotateCcw aria-hidden="true" className="w-3 h-3" />
              Cancelled before the model replied.
            </span>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none break-words prose-a:text-accent-primary prose-a:underline hover:prose-a:text-accent-secondary prose-code:text-accent-primary prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:hidden prose-code:after:hidden prose-strong:text-white prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
              <ReactMarkdown
                components={{
                  // Open every link in a new tab safely (treat AI output as untrusted).
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="break-all"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {/*
                  CommonMark treats a single \n between non-blank lines as a
                  soft break (usually rendered as a space), so a model emitting
                  "Line A\nLine B" would render as "Line A Line B". Here we
                  convert single newlines that aren't already part of a blank
                  line, list, heading, or code block into a hard break (two
                  trailing spaces + \n) so the user sees one line per line as
                  intended. Double-newlines (paragraph breaks) are preserved.
                */}
                {prepareMarkdown(message.content)}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Action row — visible on mobile (always) and on hover for desktop */}
        <div
          className={cn(
            'flex items-center gap-1 px-1',
            isUser ? 'justify-end' : 'justify-start',
            'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity',
          )}
        >
          {message.failed && onRetry ? (
            <>
              <span className="flex items-center gap-1 text-xs text-red-400">
                <AlertTriangle aria-hidden="true" className="w-3 h-3" />
                Failed to send
              </span>
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                aria-label="Retry message"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy message"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {copied ? (
                  <Check aria-hidden="true" className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy aria-hidden="true" className="w-3.5 h-3.5" />
                )}
              </button>
              {!isUser && (
                <>
                  <button
                    type="button"
                    onClick={() => onReaction(message.id, 'like')}
                    aria-label="Mark helpful"
                    aria-pressed={reaction === 'like'}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      reaction === 'like'
                        ? 'text-emerald-400 bg-emerald-400/10'
                        : 'text-slate-400 hover:text-white hover:bg-white/5',
                    )}
                  >
                    <ThumbsUp aria-hidden="true" className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReaction(message.id, 'dislike')}
                    aria-label="Mark not helpful"
                    aria-pressed={reaction === 'dislike'}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      reaction === 'dislike'
                        ? 'text-red-400 bg-red-400/10'
                        : 'text-slate-400 hover:text-white hover:bg-white/5',
                    )}
                  >
                    <ThumbsDown aria-hidden="true" className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}
          <span className="text-[10px] text-slate-500 ml-1">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    </motion.div>
  );
}
