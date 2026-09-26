/**
 * Calibration feature — history browser view.
 * JSX extracted verbatim from src/pages/CalibrationPage.tsx (mechanical refactor).
 */
import React from 'react';
import { Filter, History } from 'lucide-react';
import { personalityTypes } from '../../../data/personalityTypes';
import HistoryListComponent from '../../../components/calibration/HistoryList';
import type { AnalysisHistory } from '../types';

interface HistoryBrowserProps {
  historySearch: string;
  onHistorySearchChange: (v: string) => void;
  historyTypeFilter: string;
  onHistoryTypeFilterChange: (v: string) => void;
  isLoadingHistory: boolean;
  filteredHistory: AnalysisHistory[];
  onSelect: (item: AnalysisHistory) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export function HistoryBrowser({
  historySearch,
  onHistorySearchChange,
  historyTypeFilter,
  onHistoryTypeFilterChange,
  isLoadingHistory,
  filteredHistory,
  onSelect,
  onDelete,
}: HistoryBrowserProps) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass-card p-4">
        <div className="relative flex-1 w-full">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search history..."
            value={historySearch}
            onChange={(e) => onHistorySearchChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent-primary/50 transition-all"
          />
        </div>
        <select
          value={historyTypeFilter}
          onChange={(e) => onHistoryTypeFilterChange(e.target.value)}
          className="w-full md:w-48 bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-accent-primary/50 transition-all"
        >
          <option value="all">All Types</option>
          {personalityTypes.map(t => (
            <option key={t.id} value={t.id}>{t.id}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoadingHistory ? (
          // Skeleton Loading State
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="glass-card p-6 space-y-4 border-white/5 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div className="space-y-2 w-full">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-16 bg-white/5 rounded animate-pulse" />
                    <div className="h-4 w-px bg-white/10" />
                    <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse mt-2" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <div className="h-2 w-12 bg-white/5 rounded animate-pulse" />
                    <div className="h-4 w-8 bg-white/5 rounded animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-12 bg-white/5 rounded animate-pulse" />
                    <div className="h-4 w-8 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))
        ) : filteredHistory.length === 0 ? (
          <div className="md:col-span-2 glass-card p-12 text-center space-y-4">
            <History className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-xl font-bold text-white">No Matches Found</h3>
            <p className="text-slate-400">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <HistoryListComponent
            items={filteredHistory}
            onSelect={(item) => onSelect(item as AnalysisHistory)}
            onDelete={onDelete}
          />
        )}
    </div>
  </div>
  );
}
