import { Bot, Trash2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdvisorHeaderProps {
  isStreaming: boolean;
  hasMessages: boolean;
  onExport: () => void;
  onClear: () => void;
}

/**
 * Title bar for the Advisor — shows live status and the export/clear actions.
 */
export function AdvisorHeader({ isStreaming, hasMessages, onExport, onClear }: AdvisorHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-4 shrink-0 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-xl accent-gradient flex items-center justify-center shadow-md shadow-accent-primary/15">
            <Bot aria-hidden="true" className="w-5 h-5 text-mystic-950" strokeWidth={1.5} />
          </div>
          <AnimatePresence>
            {isStreaming && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-status-success rounded-full ring-2 ring-mystic-950 animate-pulse"
                aria-hidden="true"
              />
            )}
          </AnimatePresence>
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-100 truncate">Epimetheus Advisor</h1>
          <p className="text-xs text-slate-400 truncate">
            {isStreaming ? (
              <span className="text-status-success">Thinking…</span>
            ) : (
              'AI-powered relationship intelligence'
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onExport}
          disabled={!hasMessages}
          aria-label="Export conversation"
          title="Export conversation"
          className="tap-target rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Download aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasMessages}
          aria-label="Clear conversation"
          title="Clear conversation"
          className="tap-target rounded-xl text-slate-400 hover:text-status-error hover:bg-status-error/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
