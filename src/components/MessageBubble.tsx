import { Copy, RefreshCw, ThumbsUp, ThumbsDown, Bot, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { TypingIndicator } from './TypingIndicator';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  role: 'user' | 'model';
  content: string;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  className?: string;
}

export function MessageBubble({
  role,
  content,
  isStreaming = false,
  onRegenerate,
  className = ''
}: MessageBubbleProps) {
  const isUser = role === 'user';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Message copied to clipboard');
    } catch (_error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (isStreaming) {
    return (
      <div className={cn("flex gap-3 max-w-3xl", className)}>
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <TypingIndicator />
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3 max-w-3xl group", isUser ? "ml-auto flex-row-reverse" : "", className)}>
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
        isUser
          ? "bg-accent-primary"
          : "bg-slate-700"
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn("flex-1 min-w-0", isUser ? "text-right" : "")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 max-w-2xl inline-block",
          isUser
            ? "bg-accent-primary text-white ml-auto"
            : "bg-slate-800/50 backdrop-blur-sm border border-white/10 text-slate-200"
        )}>
          <div className="prose prose-invert max-w-none prose-sm">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-accent-primary">{children}</strong>,
                ul: ({ children }) => <ul className="space-y-1 mb-2">{children}</ul>,
                li: ({ children }) => <li className="flex items-start gap-2">
                  <span className="text-accent-primary mt-1.5 text-xs">•</span>
                  <span>{children}</span>
                </li>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Message Actions */}
        <div className={cn(
          "flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity",
          isUser ? "justify-end" : "justify-start"
        )}>
          <button
            onClick={copyToClipboard}
            className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Copy message"
            aria-label="Copy message"
          >
            <Copy className="w-4 h-4" />
          </button>

          {!isUser && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Regenerate response"
              aria-label="Regenerate response"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {!isUser && (
            <>
              <button
                className="p-2 rounded-lg bg-slate-700/50 hover:bg-green-600/50 text-slate-400 hover:text-green-400 transition-colors"
                title="Good response"
                aria-label="Mark as good response"
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button
                className="p-2 rounded-lg bg-slate-700/50 hover:bg-red-600/50 text-slate-400 hover:text-red-400 transition-colors"
                title="Poor response"
                aria-label="Mark as poor response"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
