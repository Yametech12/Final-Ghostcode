import React from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { useLazyRender } from '../../hooks/useVirtualList';

interface HistoryItem {
  id: string;
  primaryType: string;
  secondaryType?: string | null;
  confidence: number;
  date: string;
  scenarioSummary?: string;
}

interface HistoryListProps {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

/**
 * Lazy-rendered history list.
 * Renders 20 items initially, loads more as the user scrolls.
 * Replaces the previous "render all 100+ items at once" approach.
 */
export default function HistoryList({ items, onSelect, onDelete }: HistoryListProps) {
  const { renderedItems, sentinelRef, hasMore } = useLazyRender(items, 20);

  return (
    <>
      {renderedItems.map((item) => (
        <div
          key={item.id}
          className="group glass-card p-6 space-y-4 cursor-pointer hover:bg-white/5 transition-all duration-300 border-white/5 hover:border-accent-primary/30 relative overflow-hidden"
          onClick={() => onSelect(item)}
        >
          {/* Background Glow */}
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-accent-primary/5 rounded-full blur-3xl group-hover:bg-accent-primary/10 transition-all" />

          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-accent-primary italic tracking-tighter">{item.primaryType}</span>
                <div className="h-4 w-px bg-white/10" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.date}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-200 line-clamp-1 group-hover:text-accent-primary transition-colors">
                {item.scenarioSummary}
              </h4>
            </div>
            <button
              onClick={(e) => onDelete(e, item.id)}
              aria-label="Delete analysis"
              className="p-2 rounded-lg bg-red-500/0 hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
              title="Delete analysis"
            >
              <RotateCcw className="w-4 h-4 rotate-45" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
            <div className="flex items-center gap-4">
              <div className="space-y-0.5">
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Confidence</div>
                <div className="text-sm font-bold text-white">{item.confidence}%</div>
              </div>
              {item.secondaryType && (
                <div className="space-y-0.5">
                  <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Secondary</div>
                  <div className="text-sm font-bold text-slate-400">{item.secondaryType}</div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-accent-primary font-bold text-xs group-hover:translate-x-1 transition-transform">
              View Report
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      ))}

      {/* Sentinel element triggers loading more items when scrolled into view */}
      {hasMore && (
        <div ref={sentinelRef} className="md:col-span-2 py-8 text-center text-slate-500 text-sm">
          Loading more...
        </div>
      )}
    </>
  );
}
