import { Bot } from 'lucide-react';
import { motion } from 'motion/react';

/**
 * Three pulsing dots that show while the model is "thinking" before tokens arrive.
 */
export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex gap-3"
      aria-live="polite"
      aria-label="Advisor is typing"
    >
      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
        <Bot aria-hidden="true" className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-slate-800/80 rounded-2xl px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </motion.div>
  );
}
