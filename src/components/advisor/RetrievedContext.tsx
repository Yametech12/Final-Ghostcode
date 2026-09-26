import { useState } from 'react';
import { ChevronDown, Database } from 'lucide-react';
import { labelForSource } from './sourceLabels';
import type { RetrievedContextChunk } from '../../hooks/useAdvisorChat';

interface RetrievedContextProps {
  chunks: RetrievedContextChunk[];
  /** Open by default — used on the first turn so users notice the panel. */
  defaultOpen?: boolean;
}

/**
 * "Context used" panel. Shows exactly which of the user's own saved rows were
 * retrieved for the current advisor turn, so the augmentation is visible rather
 * than implied. Renders nothing when there is no retrieved context.
 */
export function RetrievedContext({ chunks, defaultOpen = false }: RetrievedContextProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!chunks || chunks.length === 0) return null;

  const panelId = 'advisor-retrieved-context';
  const label = `Context used · ${chunks.length} ${chunks.length === 1 ? 'source' : 'sources'}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-1 sm:px-2" data-testid="retrieved-context">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-400 transition-colors hover:bg-white/10"
      >
        <Database className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="font-medium text-slate-300">{label}</span>
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          id={panelId}
          className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-400"
        >
          {chunks.map((chunk, index) => (
            <li
              key={`${chunk.sourceTable}-${chunk.sourceId}-${index}`}
              className="flex items-start gap-2"
            >
              <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                {labelForSource(chunk.sourceTable)}
              </span>
              <span className="flex-1 leading-relaxed">{chunk.preview}</span>
              <span className="shrink-0 tabular-nums opacity-70">{chunk.score.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RetrievedContext;
