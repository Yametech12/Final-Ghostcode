/**
 * Calibration feature — slim page shell (~composition only).
 * Behavior-preserving extraction of src/pages/CalibrationPage.tsx:
 * all state lives in useCalibrationState, side effects in
 * useCalibrationEffects, network/AI calls in api.ts, and JSX in
 * the colocated components. Routing imports remain stable via the
 * re-export in src/pages/CalibrationPage.tsx.
 */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Brain, UserCheck, PlayCircle, History, AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ScanningOverlay } from '../../components/calibration/ScanningOverlay';
import { useCalibrationState } from './hooks/useCalibrationState';
import { useCalibrationEffects } from './hooks/useCalibrationEffects';
import { AnalysisForm } from './components/AnalysisForm';
import { AnalysisResultView } from './components/AnalysisResultView';
import { ManualReference } from './components/ManualReference';
import { HistoryBrowser } from './components/HistoryBrowser';
import { QuizFlow } from './components/QuizFlow';

export default function CalibrationPage() {
  const state = useCalibrationState();
  const {
    analysisId,
    mode,
    setMode,
    structuredInput,
    setStructuredInput,
    clearForm,
    analysis,
    setAnalysis,
    isLoading,
    isScanning,
    cancelAnalysis,
    analyzeAbortRef,
    isCapturing,
    error,
    analysisRef,
    handleAnalyze,
    handleSaveImage,
    copiedText,
    handleCopy,
    taskFilter,
    setTaskFilter,
    taskSort,
    setTaskSort,
    taskCategory,
    setTaskCategory,
    taskSearch,
    setTaskSearch,
    filteredTasks,
    toggleTask,
    toggleAllTasks,
    user,
    setHistory,
    isLoadingHistory,
    history,
    historySearch,
    setHistorySearch,
    historyTypeFilter,
    setHistoryTypeFilter,
    filteredHistory,
    deleteHistoryItem,
    selectHistoryItem,
    currentScenarioIdx,
    setCurrentScenarioIdx,
    selectedType,
    setSelectedType,
    showPracticeResult,
    setShowPracticeResult,
    isGeneratingScenario,
    dynamicScenario,
    setDynamicScenario,
    generateDynamicScenario,
  } = state;

  useCalibrationEffects({
    analysisId,
    user,
    analyzeAbortRef,
    setAnalysis,
    setMode,
    setHistory,
    setIsLoadingHistory: state.setIsLoadingHistory,
    history,
  });

  return (
    <>
      {/* Scanning Overlay */}
      <AnimatePresence>
        {isScanning && (
          <ScanningOverlay visible={isScanning} onCancel={cancelAnalysis} />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-12 pb-24"
      >

      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          Calibration Lab
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-50">The Oracle</h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Advanced personality analysis and type calibration. Use the AI Oracle, practice your skills, or review past analyses.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={() => setMode('ai')}
          className={cn(
            "px-6 py-2 rounded-full font-bold transition-all border flex items-center gap-2",
            mode === 'ai' ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
          )}
        >
          <Brain className="w-4 h-4" /> AI Oracle
        </button>
        <button
          onClick={() => setMode('manual')}
          className={cn(
            "px-6 py-2 rounded-full font-bold transition-all border flex items-center gap-2",
            mode === 'manual' ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
          )}
        >
          <UserCheck className="w-4 h-4" /> Manual
        </button>
        <button
          onClick={() => setMode('practice')}
          className={cn(
            "px-6 py-2 rounded-full font-bold transition-all border flex items-center gap-2",
            mode === 'practice' ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
          )}
        >
          <PlayCircle className="w-4 h-4" /> Practice
        </button>
        <button
          onClick={() => setMode('history')}
          className={cn(
            "px-6 py-2 rounded-full font-bold transition-all border flex items-center gap-2",
            mode === 'history' ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
          )}
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>

      {mode === 'ai' && (
        <div className="space-y-6">
          <AnalysisForm
            structuredInput={structuredInput}
            onChange={setStructuredInput}
            onClear={clearForm}
            isLoading={isLoading}
            onAnalyze={handleAnalyze}
          />

          {error && (
            <div
              className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-4"
            >
              <AlertCircle className="w-6 h-6 shrink-0" />
              {error}
            </div>
          )}

          {isLoading && (
            <div className="space-y-8 animate-pulse opacity-50">
              <div className="space-y-8 p-6 sm:p-8 bg-mystic-950 rounded-3xl border border-white/5 shadow-2xl">
                <div className="text-center pb-6 border-b border-white/10">
                  <div className="h-8 w-64 bg-white/10 rounded mx-auto mb-4"></div>
                  <div className="h-4 w-32 bg-white/5 rounded mx-auto"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-card p-8 text-center space-y-4">
                    <div className="h-3 w-24 bg-white/5 rounded mx-auto"></div>
                    <div className="h-12 w-20 bg-white/10 rounded mx-auto"></div>
                  </div>
                  <div className="glass-card p-8 text-center space-y-4">
                    <div className="h-3 w-24 bg-white/5 rounded mx-auto"></div>
                    <div className="h-12 w-20 bg-white/10 rounded mx-auto"></div>
                  </div>
                  <div className="glass-card p-8 text-center space-y-4">
                    <div className="h-3 w-24 bg-white/5 rounded mx-auto"></div>
                    <div className="h-12 w-20 bg-white/10 rounded mx-auto"></div>
                  </div>
                </div>

                <div className="glass-card p-8 space-y-6">
                  <div className="h-6 w-48 bg-white/10 rounded"></div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-white/5 rounded"></div>
                    <div className="h-4 w-full bg-white/5 rounded"></div>
                    <div className="h-4 w-3/4 bg-white/5 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {analysis && !isLoading && (
            <AnalysisResultView
              analysis={analysis}
              analysisRef={analysisRef}
              copiedText={copiedText}
              onCopy={handleCopy}
              onClear={clearForm}
              onSaveImage={handleSaveImage}
              isCapturing={isCapturing}
              filteredTasks={filteredTasks}
              taskSearch={taskSearch}
              onTaskSearchChange={setTaskSearch}
              taskFilter={taskFilter}
              onTaskFilterChange={setTaskFilter}
              taskCategory={taskCategory}
              onTaskCategoryChange={setTaskCategory}
              taskSort={taskSort}
              onToggleSort={() => setTaskSort(taskSort === 'priority' ? 'dueDate' : taskSort === 'dueDate' ? 'category' : 'priority')}
              onToggleTask={toggleTask}
              onToggleAllTasks={toggleAllTasks}
            />
          )}
      </div>
    )}

      {mode === 'manual' && <ManualReference />}

      {mode === 'history' && (
        <HistoryBrowser
          historySearch={historySearch}
          onHistorySearchChange={setHistorySearch}
          historyTypeFilter={historyTypeFilter}
          onHistoryTypeFilterChange={setHistoryTypeFilter}
          isLoadingHistory={isLoadingHistory}
          filteredHistory={filteredHistory}
          onSelect={selectHistoryItem}
          onDelete={deleteHistoryItem}
        />
      )}

      {mode === 'practice' && (
        <QuizFlow
          dynamicScenario={dynamicScenario}
          onResetDynamic={() => setDynamicScenario(null)}
          onGenerateDynamic={generateDynamicScenario}
          isGeneratingScenario={isGeneratingScenario}
          currentScenarioIdx={currentScenarioIdx}
          onSetCurrentScenarioIdx={setCurrentScenarioIdx}
          selectedType={selectedType}
          onSelectType={setSelectedType}
          showPracticeResult={showPracticeResult}
          onSetShowPracticeResult={setShowPracticeResult}
          onResetAnswer={() => setSelectedType('')}
        />
      )}
    </motion.div>
    </>
  );
}
