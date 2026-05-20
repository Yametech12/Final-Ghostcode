import { Sparkles, Bot, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { promptCategories } from './prompts';

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

/**
 * Shown when the chat has no messages. Welcomes the user and offers
 * grouped prompt suggestions. Clicking a prompt sends it immediately.
 */
export function EmptyState({ onSelectPrompt, disabled }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-8 sm:py-12 max-w-3xl mx-auto w-full"
    >
      <div className="w-14 h-14 rounded-2xl accent-gradient flex items-center justify-center shadow-lg shadow-accent-primary/15 mb-4">
        <Bot aria-hidden="true" className="w-7 h-7 text-mystic-950" strokeWidth={1.5} />
      </div>
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100 mb-2">
        How can I help you read the room?
      </h2>
      <p className="text-slate-400 text-sm sm:text-base max-w-xl mb-8">
        I'm Epimetheus — your tactical advisor for navigating dating, relationships, and personality dynamics.
      </p>

      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
        {promptCategories.map(category => (
          <div
            key={category.title}
            className="rounded-2xl border border-slate-700/30 bg-white/[0.03] p-4 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles aria-hidden="true" className="w-3.5 h-3.5 text-accent-primary" strokeWidth={1.5} />
              <h3 className="text-sm font-semibold text-slate-100 tracking-tight">{category.title}</h3>
            </div>
            <p className="text-xs text-slate-400 mb-2">{category.description}</p>
            <ul className="flex flex-col gap-1.5">
              {category.prompts.map(prompt => (
                <li key={prompt}>
                  <button
                    type="button"
                    onClick={() => onSelectPrompt(prompt)}
                    disabled={disabled}
                    aria-label={`Ask: ${prompt}`}
                    className="group/prompt relative w-full text-left text-xs text-slate-200 hover:text-slate-100 bg-white/[0.03] hover:bg-accent-primary/10 border border-slate-700/30 hover:border-accent-primary/30 rounded-lg px-3 py-2.5 pr-8 transition-colors duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="block leading-snug">{prompt}</span>
                    <ArrowUpRight
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-hover/prompt:text-accent-primary group-hover/prompt:translate-x-0.5 group-hover/prompt:-translate-y-[calc(50%+2px)] transition-all"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500 mt-6">
        Tap any suggestion to send, or type your own question below.
      </p>
    </motion.div>
  );
}
