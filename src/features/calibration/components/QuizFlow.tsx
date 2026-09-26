/**
 * Calibration feature — practice / quiz mode.
 * JSX extracted verbatim from src/pages/CalibrationPage.tsx (mechanical refactor).
 */
import React from 'react';
import {
  Target, Loader2, AlertCircle, CheckCircle2, Sparkles, RotateCcw, ArrowRight
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { personalityTypes } from '../../../data/personalityTypes';
import { practiceScenarios } from '../types';
import type { DynamicScenario } from '../types';

interface QuizFlowProps {
  dynamicScenario: DynamicScenario | null;
  onResetDynamic: () => void;
  onGenerateDynamic: () => void;
  isGeneratingScenario: boolean;
  currentScenarioIdx: number;
  onSetCurrentScenarioIdx: React.Dispatch<React.SetStateAction<number>>;
  selectedType: string;
  onSelectType: (t: string) => void;
  showPracticeResult: boolean;
  onSetShowPracticeResult: (v: boolean) => void;
  onResetAnswer: () => void;
}

export function QuizFlow({
  dynamicScenario,
  onResetDynamic,
  onGenerateDynamic,
  isGeneratingScenario,
  currentScenarioIdx,
  onSetCurrentScenarioIdx,
  selectedType,
  onSelectType,
  showPracticeResult,
  onSetShowPracticeResult,
  onResetAnswer,
}: QuizFlowProps) {
  return (
    <div className="space-y-8">
      <div className="flex justify-center gap-4">
        <button
          onClick={() => {
            onResetDynamic();
            onSetCurrentScenarioIdx(0);
            onSetShowPracticeResult(false);
            onResetAnswer();
          }}
          className={cn(
            "px-6 py-2 rounded-full font-bold transition-all border",
            !dynamicScenario ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
          )}
        >
          Static Scenarios
        </button>
        <button
          onClick={onGenerateDynamic}
          disabled={isGeneratingScenario}
          className={cn(
            "px-6 py-2 rounded-full font-bold transition-all border flex items-center gap-2",
            dynamicScenario ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
          )}
        >
          {isGeneratingScenario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          AI Dynamic Scenario
        </button>
      </div>

      <div className="glass-card p-8 space-y-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <Target className="w-6 h-6 text-accent-primary" />
            {dynamicScenario ? 'AI Generated Scenario' : `Scenario ${currentScenarioIdx + 1} of ${practiceScenarios.length}`}
          </h3>
          {!dynamicScenario && (
            <div className="text-slate-400 font-mono">
              {currentScenarioIdx + 1} / {practiceScenarios.length}
            </div>
          )}
        </div>

        <p className="text-xl text-slate-300 leading-relaxed italic">
          "{dynamicScenario ? dynamicScenario.text : practiceScenarios[currentScenarioIdx].text}"
        </p>

        {!showPracticeResult ? (
          <div className="space-y-6">
            <h4 className="font-bold text-slate-400 uppercase tracking-widest text-sm">Select her type:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {personalityTypes.map(pt => (
                <button
                  key={pt.id}
                  onClick={() => onSelectType(pt.id)}
                  className={cn(
                    "p-4 rounded-xl border text-center transition-all font-bold",
                    selectedType === pt.id
                      ? "bg-accent-primary/20 border-accent-primary text-accent-primary"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                  )}
                >
                  {pt.id}
                </button>
              ))}
            </div>
            <button
              onClick={() => onSetShowPracticeResult(true)}
              disabled={!selectedType}
              className="w-full py-4 rounded-xl accent-gradient text-white font-bold disabled:opacity-50 transition-all"
            >
              Submit Answer
            </button>
          </div>
        ) : (
          <div
            className="space-y-6"
          >
            {(() => {
              const correctType = dynamicScenario ? dynamicScenario.correctType : practiceScenarios[currentScenarioIdx].correctType;
              const explanation = dynamicScenario ? dynamicScenario.explanation : practiceScenarios[currentScenarioIdx].explanation;
              const isCorrect = selectedType === correctType;

              return (
                <>
                  <div className={cn(
                    "p-6 rounded-2xl border flex items-start gap-4",
                    isCorrect
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  )}>
                    {isCorrect ? (
                      <CheckCircle2 className="w-6 h-6 shrink-0" />
                    ) : (
                      <AlertCircle className="w-6 h-6 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-lg mb-2">
                        {isCorrect ? "Correct!" : `Incorrect. The correct type is ${correctType}.`}
                      </h4>
                      <p className="text-sm opacity-80 leading-relaxed">
                        {explanation}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    {dynamicScenario ? (
                      <button
                        onClick={onGenerateDynamic}
                        className="flex-1 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        New AI Scenario
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (currentScenarioIdx < practiceScenarios.length - 1) {
                            onSetCurrentScenarioIdx(prev => prev + 1);
                            onResetAnswer();
                            onSetShowPracticeResult(false);
                          } else {
                            onSetCurrentScenarioIdx(0);
                            onResetAnswer();
                            onSetShowPracticeResult(false);
                          }
                        }}
                        className="flex-1 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                      >
                        {currentScenarioIdx < practiceScenarios.length - 1 ? (
                          <>Next Scenario <ArrowRight className="w-4 h-4" /></>
                        ) : (
                          <>Restart Practice <RotateCcw className="w-4 h-4" /></>
                        )}
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
