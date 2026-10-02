import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Sparkles, RotateCcw } from 'lucide-react';
import Sigil from './Sigil';

/**
 * OracleDraw — the landing hero's signature interaction.
 *
 * "Consult the oracle": the visitor draws one of the 8 archetype cards
 * and sees its constellation sigil, name, and tagline. It turns the
 * abstract promise ("read people like constellations") into something
 * the visitor touches in the first 10 seconds.
 *
 * - No draw is ever "wrong": every card is a real archetype from the
 *   framework, with accurate name + tagline copy.
 * - Reduced motion: instant swap, no flip animation.
 * - Keyboard accessible: real <button type="button">s, aria-live announces the draw.
 */

interface Card {
  id: string;
  name: string;
  tagline: string;
  free: boolean;
}

const CARDS: Card[] = [
  { id: 'TDI', name: 'The Playette', tagline: 'Mysterious, sensitive beneath a cool exterior.', free: true },
  { id: 'TJI', name: 'The Social Butterfly', tagline: 'Energetic, enticing, always center of attention.', free: true },
  { id: 'NDI', name: 'The Hopeful Romantic', tagline: 'Old-fashioned, sentimental, looking for The One.', free: false },
  { id: 'NJI', name: 'The Cinderella', tagline: 'Classy, refined, waiting to be swept away.', free: false },
  { id: 'TDR', name: 'The Private Dancer', tagline: 'Mysterious shell, passionate giver inside.', free: false },
  { id: 'TJR', name: 'The Seductress', tagline: 'Confident, sexual, intimidatingly strong.', free: false },
  { id: 'NDR', name: 'The Connoisseur', tagline: 'Selective, practical, cautious giver.', free: false },
  { id: 'NJR', name: 'The Modern Woman', tagline: 'Independent, level-headed, healthy in love.', free: false },
];

export default function OracleDraw() {
  const reduceMotion = useReducedMotion();
  const [card, setCard] = useState<Card | null>(null);
  const [draws, setDraws] = useState(0);
  const lastIndex = useRef(-1);

  const draw = useCallback(() => {
    // Avoid repeating the same card twice in a row.
    let i = Math.floor(Math.random() * CARDS.length);
    if (CARDS.length > 1) {
      while (i === lastIndex.current) i = Math.floor(Math.random() * CARDS.length);
    }
    lastIndex.current = i;
    setCard(CARDS[i]);
    setDraws((d) => d + 1);
  }, []);

  return (
    <div className="oracle-frame grain relative overflow-hidden p-6 sm:p-8 text-left w-full max-w-sm mx-auto">
      <div className="codex-label mb-5 justify-center w-full" aria-hidden="true">
        The Oracle
      </div>

      <div className="min-h-[240px] flex flex-col items-center justify-center" aria-live="polite">
        <AnimatePresence mode="wait">
          {card ? (
            <motion.div
              key={`${card.id}-${draws}`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: 70, scale: 0.94 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, rotateY: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: -70, scale: 0.94 }}
              transition={{ duration: reduceMotion ? 0.15 : 0.45, ease: 'easeOut' }}
              className="flex flex-col items-center text-center"
              style={{ perspective: 800 }}
            >
              <div className="text-iris-300 mb-4">
                <Sigil id={card.id} size={88} title={`${card.name} sigil`} />
              </div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-iris-300 mb-2">
                {card.id}
              </div>
              <div className="hero-headline text-2xl text-slate-50 mb-2">{card.name}</div>
              <p className="text-sm text-slate-400 leading-relaxed max-w-[26ch]">{card.tagline}</p>
              <div className="mt-4">
                {card.free ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-status-success/10 border border-status-success/20 text-[10px] font-mono tracking-[0.2em] uppercase text-status-success">
                    Free profile
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-iris-500/10 border border-iris-500/25 text-[10px] font-mono tracking-[0.2em] uppercase text-iris-300">
                    Strategist unlock
                  </span>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center px-4"
            >
              <div className="text-iris-300/60 mb-4">
                <Sigil id="TDI" size={72} title="Unrevealed sigil" className="opacity-40" />
              </div>
              <p className="text-sm text-slate-400 leading-relaxed max-w-[30ch]">
                Eight archetypes chart the field. Draw a card and meet the first one the
                stars deal you.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={draw}
          className="oracle-btn inline-flex items-center gap-2 px-6 py-3 rounded-xl accent-gradient text-mystic-950 font-semibold text-sm tracking-wide shadow-xl shadow-accent-primary/15 transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          {card ? (
            <>
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Draw again
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Consult the oracle
            </>
          )}
        </button>
      </div>

      {draws > 0 && (
        <p className="mt-4 text-center font-mono text-[10px] tracking-[0.25em] uppercase text-slate-500">
          {draws} {draws === 1 ? 'reading' : 'readings'} cast
        </p>
      )}
    </div>
  );
}
