/**
 * Calibration feature — consolidated state hook.
 * Contains all 21 useState calls (plus refs, callbacks, memos and actions)
 * extracted verbatim from src/pages/CalibrationPage.tsx (mechanical refactor).
 * Side effects (useEffect) live in useCalibrationEffects; network calls in api.ts.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useEnhancedAuth } from '../../../contexts/EnhancedAuthContext';
import { parseApiError } from '../../../lib/apiError';
import {
  requestAnalysis,
  requestDynamicScenario,
  saveAnalysis,
  updateAnalysisTasks,
  deleteAnalysisOnServer,
} from '../api';
import {
  EMPTY_STRUCTURED_INPUT,
  taskLabel,
  taskBody,
} from '../types';
import type {
  AnalysisHistory,
  CalibrationMode,
  DynamicScenario,
  StructuredInput,
  TaskCategoryFilter,
  TaskFilter,
  TaskSort,
} from '../types';

export function useCalibrationState() {
  const [searchParams] = useSearchParams();
  const analysisId = searchParams.get('id');
  const [mode, setMode] = useState<CalibrationMode>('ai');

  // AI Oracle State
  const [structuredInput, setStructuredInput] = useState<StructuredInput>(EMPTY_STRUCTURED_INPUT);

  const [analysis, setAnalysis] = useState<AnalysisHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // AbortController for the in-flight Oracle call. Lets the scanning overlay's
  // Cancel button bail out of a long-running completion. The server-side
  // request to Regolo continues but we discard the partial result.
  const analyzeAbortRef = useRef<AbortController | null>(null);

  const cancelAnalysis = useCallback(() => {
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    setIsScanning(false);
    setIsLoading(false);
  }, []);

  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analysisRef = useRef<HTMLDivElement | null>(null);

  // Task Filtering & Sorting State
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [taskSort, setTaskSort] = useState<TaskSort>('priority');
  const [taskCategory, setTaskCategory] = useState<TaskCategoryFilter>('all');

  const [taskSearch, setTaskSearch] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredTasks = useMemo(() => {
    if (!analysis) return [];
    const tasks = analysis.tasks || [];
    return tasks.filter(task => {
      const statusMatch = taskFilter === 'all' ||
                        (taskFilter === 'completed' && task.completed) ||
                        (taskFilter === 'pending' && !task.completed);
      const categoryMatch = taskCategory === 'all' || (task.category || '').toLowerCase() === taskCategory.toLowerCase();
      const searchMatch = (taskLabel(task) + ' ' + taskBody(task)).toLowerCase().includes(taskSearch.toLowerCase());
      return statusMatch && categoryMatch && searchMatch;
    }).sort((a, b) => {
      if (taskSort === 'priority') {
        const pMap = { high: 3, medium: 2, low: 1 };
        return pMap[b.priority] - pMap[a.priority];
      }
      if (taskSort === 'category') {
        return a.category.localeCompare(b.category);
      }
      const dueDateOrder: Record<string, number> = { 'Day 1': 1, 'Day 3': 2, 'Week 1': 3, 'Week 2': 4, 'Month 1': 5 };
      return (dueDateOrder[a.dueDate] ?? 99) - (dueDateOrder[b.dueDate] ?? 99);
    });
  }, [analysis, taskFilter, taskSort, taskCategory, taskSearch]);

  // History State
  const { user } = useEnhancedAuth();
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Practice State
  const [currentScenarioIdx, setCurrentScenarioIdx] = useState(0);
  const [selectedType, setSelectedType] = useState('');
  const [showPracticeResult, setShowPracticeResult] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [dynamicScenario, setDynamicScenario] = useState<DynamicScenario | null>(null);

  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all');

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const searchLower = historySearch.toLowerCase();
      const scenarioSummary = item.scenarioSummary ?? '';
      const primaryType = item.primaryType ?? '';
      const matchesSearch = scenarioSummary.toLowerCase().includes(searchLower) ||
                           primaryType.toLowerCase().includes(searchLower);
      const matchesType = historyTypeFilter === 'all' || primaryType === historyTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [history, historySearch, historyTypeFilter]);

  const clearForm = () => {
    setStructuredInput(EMPTY_STRUCTURED_INPUT);
    setAnalysis(null);
    setError(null);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleTask = async (taskId: string) => {
    const currentAnalysisId = analysis?.id;
    if (!currentAnalysisId || !analysis) return;

    // Compute updated tasks synchronously using the current analysis state
    // This is safe enough for single clicks, and we'll use functional updates for the state
    const updatedTasks = analysis.tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );

    setAnalysis(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === taskId ? { ...t, completed: !t.completed } : t
        )
      };
    });

    // Update history
    setHistory(prev => prev.map(item => {
      if (item.id === currentAnalysisId) {
        return {
          ...item,
          tasks: item.tasks.map(t =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
          )
        };
      }
      return item;
    }));

    // Persist via the validated server endpoint. The previous direct
    // supabase.from('oracle_analyses').update({ 'result.tasks': … }) call
    // also wrote to a literal column named 'result.tasks' instead of patching
    // the JSON column, so this also fixes that bug.
    if (user && currentAnalysisId) {
      try {
        const response = await updateAnalysisTasks(currentAnalysisId, updatedTasks);
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Update failed: ${response.status}`);
        }
      } catch (err) {
        console.error('Failed to update task:', err);
        toast.error("Failed to update task. Please try again.");
      }
    }
  };

  const toggleAllTasks = async (completed: boolean) => {
    const currentAnalysisId = analysis?.id;
    if (!currentAnalysisId || !analysis) return;

    const updatedTasks = analysis.tasks.map(t => ({ ...t, completed }));

    setAnalysis(prev => {
      if (!prev) return prev;
      return { ...prev, tasks: prev.tasks.map(t => ({ ...t, completed })) };
    });

    setHistory(prev => prev.map(item => {
      if (item.id === currentAnalysisId) {
        return { ...item, tasks: item.tasks.map(t => ({ ...t, completed })) };
      }
      return item;
    }));

    if (user && currentAnalysisId) {
      try {
        const response = await updateAnalysisTasks(currentAnalysisId, updatedTasks);
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Update failed: ${response.status}`);
        }
        toast.success(completed ? "All tasks marked as complete" : "All tasks marked as pending");
      } catch (err) {
        console.error('Failed to update tasks:', err);
        toast.error("Failed to update tasks. Please try again.");
      }
    }
  };

  const handleSaveImage = async () => {
    if (!analysisRef.current) return;
    setIsCapturing(true);
    try {
      // Dynamic import keeps html2canvas out of the main bundle.
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(analysisRef.current, {
        backgroundColor: '#0a0508',
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `epimetheus-analysis-${analysis?.primaryType}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to capture screenshot:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const generateDynamicScenario = async () => {
    setIsGeneratingScenario(true);
    setShowPracticeResult(false);
    setSelectedType('');
    try {
      const result = await requestDynamicScenario();
      setDynamicScenario(result);
    } catch (err) {
      console.error("Failed to generate scenario:", err);
      const msg = err instanceof Error ? err.message : 'Failed to generate scenario';
      toast.error(msg);
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const deleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const response = await deleteAnalysisOnServer(id);
      if (!response.ok) {
        // Use the centralized parser so we surface the structured shape
        // (code + retryAfter for rate limits, requestId for support
        // correlation) rather than a flat "Delete failed: 503" string.
        const parsed = await parseApiError(response);
        if (response.status === 401) {
          toast.error('Your session expired. Please sign in again to delete.');
          return;
        }
        if (parsed.code === 'RATE_LIMITED' && parsed.retryAfter) {
          toast.error(`You're going too fast. Try again in ${parsed.retryAfter}s.`);
          return;
        }
        throw new Error(parsed.message);
      }
      setHistory(prev => prev.filter(item => item.id !== id));
      toast.success("Analysis deleted from history");
      if (analysis?.id === id) {
        setAnalysis(null);
      }
    } catch (err) {
      console.error('Failed to delete analysis:', err);
      const msg = err instanceof Error ? err.message : 'Failed to delete analysis';
      toast.error(msg);
    }
  };

  const handleAnalyze = async () => {
    const hasInput = Object.values(structuredInput).some(val => typeof val === 'string' && val.trim() !== '');
    if (!hasInput) {
      setError("Please provide at least some details about the scenario.");
      return;
    }

    setIsLoading(true);
    setIsScanning(true);
    setError(null);

    // Wire a fresh AbortController for this run so the user's "Cancel" click
    // on the scanning overlay can bail out of `chatCompletion`.
    analyzeAbortRef.current?.abort();
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    try {
      const data = await requestAnalysis(structuredInput, controller.signal);

      const scenarioSummary = structuredInput.additionalNotes.slice(0, 50) || structuredInput.conversationTopic || structuredInput.clothingStyle || 'Guided Analysis';

      const newHistoryItem: AnalysisHistory = {
        ...data,
        id: Date.now().toString(), // Temporary ID
        date: new Date().toLocaleDateString(),
        scenarioSummary,
      };

      setAnalysis(newHistoryItem);
      setHistory(prev => [newHistoryItem, ...prev]);

      if (user) {
        try {
          const response = await saveAnalysis(structuredInput, data, scenarioSummary);

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.error || `Save failed: ${response.status}`);
          }

          const saved = await response.json();
          const insertedId = saved?.id ?? saved?.analysis?.id;

          if (insertedId) {
            // Update the history item with the real Supabase ID
            setHistory(prev => prev.map(item =>
              item.id === newHistoryItem.id ? { ...item, id: insertedId } : item
            ));
            setAnalysis(prev => prev?.id === newHistoryItem.id ? { ...prev, id: insertedId } : prev);
          }
        } catch (dbErr) {
          console.error('Failed to save analysis to server:', dbErr);
          // Don't throw here, we still want to show the result to the user
        }
      }

    } catch (err) {
      // User-initiated cancellation — silently exit, no toast/error banner.
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('The Oracle is currently unavailable. Please check your API key or try again later.');
      }
      console.error(err);
    } finally {
      analyzeAbortRef.current = null;
      setIsLoading(false);
      setIsScanning(false);
    }
  };

  const selectHistoryItem = (item: AnalysisHistory) => {
    setAnalysis(item);
    setMode('ai');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    // routing / mode
    analysisId,
    mode,
    setMode,
    // AI oracle state
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
    // copy
    copiedText,
    handleCopy,
    // tasks
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
    // history
    user,
    history,
    setHistory,
    isLoadingHistory,
    setIsLoadingHistory,
    historySearch,
    setHistorySearch,
    historyTypeFilter,
    setHistoryTypeFilter,
    filteredHistory,
    deleteHistoryItem,
    selectHistoryItem,
    // practice
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
  };
}

export type CalibrationState = ReturnType<typeof useCalibrationState>;
