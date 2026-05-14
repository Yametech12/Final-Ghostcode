import React, { useEffect, useRef } from 'react';
import { Send, Square, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { followUpSuggestions } from './prompts';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  isSending: boolean;
  showFollowUps: boolean;
  onSelectFollowUp: (prompt: string) => void;
}

const MAX_LENGTH = 2000;
const MAX_TEXTAREA_HEIGHT = 160;

/**
 * Multi-line text input with auto-resize, character counter, follow-up chips,
 * and a send/stop button that swaps based on streaming state.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  isSending,
  showFollowUps,
  onSelectFollowUp,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea up to MAX_TEXTAREA_HEIGHT
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const remaining = MAX_LENGTH - value.length;
  const tooLong = remaining < 0;
  const trimmed = value.trim();
  const canSend = !!trimmed && !isSending && !tooLong;

  return (
    <div className="shrink-0 max-w-3xl mx-auto w-full">
      {/* Follow-up chips */}
      {showFollowUps && (
        <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Sparkles aria-hidden="true" className="w-3.5 h-3.5 text-accent-primary shrink-0" />
          {followUpSuggestions.map(suggestion => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSelectFollowUp(suggestion)}
              disabled={isSending}
              aria-label={`Send: ${suggestion}`}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs text-accent-primary bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/20 hover:border-accent-primary/50 hover:text-white active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-2 bg-slate-800/80 border border-slate-600/60 focus-within:border-accent-primary/60 rounded-2xl p-2 transition-colors">
        <label htmlFor="advisor-composer" className="sr-only">Message Epimetheus</label>
        <textarea
          id="advisor-composer"
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Epimetheus for advice..."
          rows={1}
          aria-label="Message"
          className="flex-1 bg-transparent border-0 px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed max-h-40"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="tap-target rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0 transition-colors"
          >
            <Square aria-hidden="true" className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
            className={cn(
              'tap-target rounded-xl shrink-0 transition-colors',
              canSend
                ? 'bg-accent-primary text-white hover:bg-accent-primary/90'
                : 'bg-white/5 text-slate-500 cursor-not-allowed',
            )}
          >
            <Send aria-hidden="true" className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Hint row: keyboard tip on left, char count on right */}
      <div className="flex items-center justify-between mt-1.5 px-1 text-[11px] text-slate-500">
        <span className="hidden sm:inline">
          <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded font-mono">Enter</kbd> to send,{' '}
          <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded font-mono">Shift+Enter</kbd> for new line
        </span>
        <span className={cn('ml-auto', tooLong && 'text-red-400 font-semibold')}>
          {value.length}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
