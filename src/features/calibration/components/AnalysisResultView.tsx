/**
 * Calibration feature — analysis result report view.
 * JSX extracted verbatim from src/pages/CalibrationPage.tsx (mechanical refactor).
 */
import React from 'react';
import {
  Info, Zap, Target, CheckCircle2, AlertCircle, Shield,
  HandMetal, Brain, UserCheck, Sparkles, RotateCcw, Copy, Check,
  ChevronRight
} from 'lucide-react';
import { LogoIcon as LogoIconComponent } from '../../../components/Logo';
import { personalityTypes } from '../../../data/personalityTypes';
import FavoriteButton from '../../../components/FavoriteButton';
import { cn } from '../../../lib/utils';
import { TaskTracker } from './TaskTracker';
import type { AnalysisHistory, Task, TaskCategoryFilter, TaskFilter, TaskSort } from '../types';

interface AnalysisResultViewProps {
  analysis: AnalysisHistory;
  analysisRef: React.RefObject<HTMLDivElement | null>;
  copiedText: string | null;
  onCopy: (text: string) => void;
  onClear: () => void;
  onSaveImage: () => void;
  isCapturing: boolean;
  // task tracker props
  filteredTasks: Task[];
  taskSearch: string;
  onTaskSearchChange: (v: string) => void;
  taskFilter: TaskFilter;
  onTaskFilterChange: (v: TaskFilter) => void;
  taskCategory: TaskCategoryFilter;
  onTaskCategoryChange: (v: TaskCategoryFilter) => void;
  taskSort: TaskSort;
  onToggleSort: () => void;
  onToggleTask: (taskId: string) => void;
  onToggleAllTasks: (completed: boolean) => void;
}

export function AnalysisResultView({
  analysis,
  analysisRef,
  copiedText,
  onCopy,
  onClear,
  onSaveImage,
  isCapturing,
  filteredTasks,
  taskSearch,
  onTaskSearchChange,
  taskFilter,
  onTaskFilterChange,
  taskCategory,
  onTaskCategoryChange,
  taskSort,
  onToggleSort,
  onToggleTask,
  onToggleAllTasks,
}: AnalysisResultViewProps) {
  return (
    <div
      className="space-y-8"
    >
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onClear}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            New Analysis
          </button>
          <FavoriteButton
            contentId={analysis.id}
            contentType="calibration"
            title={`Analysis: ${analysis.primaryType} - ${analysis.scenarioSummary}`}
            className="bg-white/5 border border-white/10"
          />
        </div>
        <button
          onClick={onSaveImage}
          disabled={isCapturing}
          className="px-4 py-2 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs font-bold hover:bg-accent-primary/20 transition-all flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {isCapturing ? 'Capturing...' : 'Save Analysis as Image'}
        </button>
      </div>

      <div ref={analysisRef} className="space-y-8 p-6 sm:p-8 bg-mystic-950 rounded-3xl border border-white/5 shadow-2xl">
        <div className="text-center pb-6 border-b border-white/10">
          <h2 className="text-2xl font-semibold tracking-tight text-gradient uppercase">EPIMETHEUS ORACLE</h2>
          <p className="text-slate-500 text-sm mt-2">Analysis Report • {new Date().toLocaleDateString()}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-8 text-center space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Primary Type</h4>
            <div className="text-5xl font-black text-accent-primary italic">{analysis.primaryType}</div>
          </div>
          <div className="glass-card p-8 text-center space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Confidence</h4>
            <div className="text-5xl font-black text-white italic">{analysis.confidence}%</div>
          </div>
          <div className="glass-card p-8 text-center space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Secondary Type</h4>
            <div className="text-5xl font-black text-slate-500 italic">{analysis.secondaryType || 'N/A'}</div>
          </div>
        </div>

      <div className="glass-card p-8 space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-3">
          <Info className="w-6 h-6 text-accent-primary" />
          Oracle's Reasoning
        </h3>
        <p className="text-slate-300 leading-relaxed text-lg">
          {analysis.analysis}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-8 space-y-6">
          <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
            <LogoIconComponent className="w-6 h-6" />
            Cold Reader
          </h3>
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-accent-primary/60 mb-2 block">AI Generated Insight</span>
              <div className="relative group">
                <p className="text-lg text-slate-300 leading-relaxed italic border-l-2 border-accent-primary pl-4 pr-10">
                  "{analysis.coldReader}"
                </p>
                <button
                  onClick={() => onCopy(analysis.coldReader)}
                  className="absolute right-0 top-0 p-2 text-slate-500 hover:text-accent-primary transition-colors opacity-0 group-hover:opacity-100"
                  title="Copy to clipboard"
                >
                  {copiedText === analysis.coldReader ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {(() => {
              const typeData = personalityTypes.find(t => t.id === analysis.primaryType);
              if (typeData?.coldReads) {
                return (
                  <div className="pt-4 border-t border-white/5">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-3 block">Standard Type Reads</span>
                    <div className="space-y-4">
                      {typeData.coldReads.slice(0, 2).map((read, i) => (
                        <div key={i} className="relative group">
                          <p className="text-sm text-slate-400 italic pr-8">
                            "{read}"
                          </p>
                          <button
                            onClick={() => onCopy(read)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-accent-primary transition-colors opacity-0 group-hover:opacity-100"
                            title="Copy to clipboard"
                          >
                            {copiedText === read ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
        <div className="glass-card p-8 space-y-6">
          <h3 className="text-2xl font-bold flex items-center gap-3 text-amber-400">
            <Zap className="w-6 h-6" />
            How She Gets What She Wants
          </h3>
          <p className="text-slate-300 leading-relaxed">
            {analysis.howSheGetsWhatSheWants}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-8 space-y-4">
          <h4 className="text-xl font-bold flex items-center gap-3">
            <Target className="w-5 h-5 text-accent-primary" />
            Key Indicators Found
          </h4>
          <ul className="space-y-3">
            {analysis.indicators.map((indicator, i) => (
              <li key={i} className="flex items-start gap-3 text-slate-400">
                <CheckCircle2 className="w-5 h-5 text-accent-primary shrink-0 mt-0.5" />
                {indicator}
              </li>
            ))}
          </ul>
        </div>
        <TaskTracker
          analysis={analysis}
          filteredTasks={filteredTasks}
          taskSearch={taskSearch}
          onTaskSearchChange={onTaskSearchChange}
          taskFilter={taskFilter}
          onTaskFilterChange={onTaskFilterChange}
          taskCategory={taskCategory}
          onTaskCategoryChange={onTaskCategoryChange}
          taskSort={taskSort}
          onToggleSort={onToggleSort}
          onToggleTask={onToggleTask}
          onToggleAllTasks={onToggleAllTasks}
        />
        <div className="glass-card p-8 space-y-4">
          <h4 className="text-xl font-bold flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            What to Avoid
          </h4>
          <ul className="space-y-3">
            {analysis.whatToAvoid.map((avoid, i) => (
              <li key={i} className="flex items-start gap-3 text-slate-400">
                <CheckCircle2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                {avoid}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass-card p-8 space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
          <Shield className="w-6 h-6" />
          Relationship Strategy: Total Devotion
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {typeof analysis.relationshipAdvice === 'string' ? (
            <div className="col-span-3 space-y-2">
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.relationshipAdvice}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vision</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{analysis.relationshipAdvice?.vision || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Investment</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{analysis.relationshipAdvice?.investment || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Potential</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{analysis.relationshipAdvice?.potential || 'Not specified'}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="glass-card p-8 space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-3 text-purple-400">
          <HandMetal className="w-6 h-6" />
          Freak Dynamics: Bring Out the Freak
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {typeof analysis.freakDynamics === 'string' ? (
            <div className="col-span-3 space-y-2">
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.freakDynamics}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Kink & Novelty</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{analysis.freakDynamics?.kink || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Threesomes</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{analysis.freakDynamics?.threesomes || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Worship</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{analysis.freakDynamics?.worship || 'Not specified'}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="glass-card p-8 space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-3 text-red-400">
          <Brain className="w-6 h-6" />
          Dark Mind Breakdown
        </h3>
        <p className="text-lg text-slate-300 leading-relaxed">
          {analysis.darkMindBreakdown}
        </p>
      </div>

      <div className="glass-card p-8 space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
          <Zap className="w-6 h-6" />
          Interaction Strategy
        </h3>
        <p className="text-lg text-slate-300 leading-relaxed italic">
          "{analysis.interactionStrategy}"
        </p>
      </div>

      <div className="glass-card p-8 space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
          <Target className="w-6 h-6" />
          Behavioral Blueprint
        </h3>
        <div className="space-y-4">
          {(() => {
            const blueprint = Array.isArray(analysis.behavioralBlueprint)
              ? analysis.behavioralBlueprint.join('\n')
              : (typeof analysis.behavioralBlueprint === 'string' ? analysis.behavioralBlueprint : '');

            return blueprint.split(/\d+\.\s+/).filter(Boolean).map((step, i) => {
              const parts = step.split(/:\s*/);
              if (parts.length >= 2) {
                const title = parts[0].replace(/\*\*/g, '').trim();
                const content = parts.slice(1).join(': ').trim();
                return (
                  <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h4 className="font-bold text-accent-primary mb-2">{title}</h4>
                    <p className="text-slate-300">{content}</p>
                  </div>
                );
              }
              return (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-slate-300">{step.trim()}</p>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Type Intelligence — pulled from personalityTypes.ts */}
      {(() => {
        const typeData = personalityTypes.find(t => t.id === analysis.primaryType);
        if (!typeData) return null;
        return (
          <div className="space-y-6">
            {/* ETS Sequence */}
            {typeData.ets && typeData.ets.length > 0 && (
              <div className="glass-card p-8 space-y-4">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
                  <Zap className="w-6 h-6" />
                  Emotional Trigger Sequence (ETS)
                </h3>
                <div className="flex flex-wrap gap-3">
                  {typeData.ets.map((stage, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="px-4 py-2 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary font-bold text-sm">
                        {i + 1}. {stage}
                      </div>
                      {i < typeData.ets.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Traits */}
            {typeData.keyTraits && typeData.keyTraits.length > 0 && (
              <div className="glass-card p-8 space-y-4">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-amber-400">
                  <UserCheck className="w-6 h-6" />
                  Key Traits of a {typeData.name}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {typeData.keyTraits.map((trait, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300">
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Devotion Triggers & Red Flags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {typeData.devotionTriggers && typeData.devotionTriggers.length > 0 && (
                <div className="glass-card p-8 space-y-4">
                  <h4 className="text-xl font-bold flex items-center gap-3 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                    Devotion Triggers
                  </h4>
                  <ul className="space-y-2">
                    {typeData.devotionTriggers.map((trigger, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-emerald-400 mt-0.5 shrink-0">→</span>
                        {trigger}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {typeData.redFlags && typeData.redFlags.length > 0 && (
                <div className="glass-card p-8 space-y-4">
                  <h4 className="text-xl font-bold flex items-center gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    Red Flags (Avoid These)
                  </h4>
                  <ul className="space-y-2">
                    {typeData.redFlags.map((flag, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Where to Find Her + Dating Venues */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {typeData.whereToFindHer && typeData.whereToFindHer.length > 0 && (
                <div className="glass-card p-8 space-y-4">
                  <h4 className="text-xl font-bold flex items-center gap-3 text-slate-300">
                    <Target className="w-5 h-5 text-accent-primary" />
                    Where to Find Her
                  </h4>
                  <ul className="space-y-2">
                    {typeData.whereToFindHer.map((place, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-primary shrink-0" />
                        {place}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {typeData.dating?.ideas && typeData.dating.ideas.length > 0 && (
                <div className="glass-card p-8 space-y-4">
                  <h4 className="text-xl font-bold flex items-center gap-3 text-slate-300">
                    <Sparkles className="w-5 h-5 text-accent-primary" />
                    Date Ideas
                  </h4>
                  <ul className="space-y-2">
                    {typeData.dating.ideas.map((idea, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-primary shrink-0" />
                        {idea}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Mistype Warning */}
            {typeData.mistypeRedFlag && (
              <div className="glass-card p-6 bg-amber-500/5 border-amber-500/20 space-y-3">
                <h4 className="text-sm font-bold flex items-center gap-2 text-amber-400 uppercase tracking-widest">
                  <AlertCircle className="w-4 h-4" />
                  Mistype Warning
                </h4>
                <p className="text-sm text-slate-300">{typeData.mistypeRedFlag}</p>
              </div>
            )}
          </div>
        );
      })()}
      </div>
    </div>
  );
}
