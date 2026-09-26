/**
 * Calibration feature — consolidated side effects.
 * Contains the 4 useEffect calls extracted verbatim from
 * src/pages/CalibrationPage.tsx, in their original order:
 *   1. Abort any in-flight analysis on unmount.
 *   2. Fetch a single analysis by `?id=` search param.
 *   3. Fetch the user's analysis history (with localStorage fallback).
 *   4. Persist history to localStorage (with quota fallback).
 * Dependency arrays and execution order are preserved exactly.
 */
import React from 'react';
import { toast } from 'sonner';
import { fetchAnalysisRow, fetchHistoryRows, normalizeHistoryItem } from '../api';
import type { AnalysisHistory, CalibrationMode } from '../types';

export interface CalibrationEffectsArgs {
  analysisId: string | null;
  user: { id: string } | null;
  analyzeAbortRef: React.MutableRefObject<AbortController | null>;
  setAnalysis: React.Dispatch<React.SetStateAction<AnalysisHistory | null>>;
  setMode: React.Dispatch<React.SetStateAction<CalibrationMode>>;
  setHistory: React.Dispatch<React.SetStateAction<AnalysisHistory[]>>;
  setIsLoadingHistory: React.Dispatch<React.SetStateAction<boolean>>;
  history: AnalysisHistory[];
}

export function useCalibrationEffects({
  analysisId,
  user,
  analyzeAbortRef,
  setAnalysis,
  setMode,
  setHistory,
  setIsLoadingHistory,
  history,
}: CalibrationEffectsArgs): void {
  // Effect 1 — cancel any in-flight analysis on unmount so it doesn't
  // outlive the page.
  React.useEffect(() => () => analyzeAbortRef.current?.abort(), []);

  // Effect 2 — deep-link fetch of a single analysis (?id=...).
  React.useEffect(() => {
    async function fetchAnalysisById() {
      if (!analysisId || !user) return;

      try {
        const data = await fetchAnalysisRow(analysisId);

        // Coerce the persisted blob into the render-safe shape before
        // committing to state. Older rows written by previous clients
        // (or by tools we no longer control) may have off-spec field
        // types — rendering them directly used to crash with
        // "Objects are not valid as a React child".
        const coerced = normalizeHistoryItem(data);
        setAnalysis(coerced);
        setMode('ai');
      } catch (error) {
        console.error('Failed to fetch analysis:', error);
        toast.error("Analysis not found");
      }
    }
    fetchAnalysisById();
  }, [analysisId, user, setAnalysis, setMode]);

  // Effect 3 — fetch the user's history.
  React.useEffect(() => {
    async function fetchHistory() {
      if (!user) {
        setIsLoadingHistory(false);
        return;
      }
      setIsLoadingHistory(true);
      try {
        const rows = await fetchHistoryRows(user.id);
        const fetchedHistory: AnalysisHistory[] = rows.map((doc) => normalizeHistoryItem(doc));
        setHistory(fetchedHistory);
      } catch (error) {
        console.error('Failed to fetch history:', error);
        // Fallback to local storage if offline or error
        const saved = localStorage.getItem('oracleHistory');
        if (saved) setHistory(JSON.parse(saved));
      } finally {
        setIsLoadingHistory(false);
      }
    }
    fetchHistory();
  }, [user, setHistory, setIsLoadingHistory]);

  // Effect 4 — mirror history into localStorage.
  React.useEffect(() => {
    try {
      localStorage.setItem('oracleHistory', JSON.stringify(history));
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === 'QuotaExceededError' || err.message?.includes('exceeded the quota')) {
        console.warn("localStorage quota exceeded for oracleHistory, keeping only last 20 items...");
        try {
          const lastItems = history.slice(0, 20); // history is sorted descending, so we keep the first 20 (newest)
          localStorage.setItem('oracleHistory', JSON.stringify(lastItems));
        } catch (finalError) {
          console.error("Failed to save oracleHistory to localStorage", finalError);
        }
      } else {
        console.error("Failed to save oracleHistory", e);
      }
    }
  }, [history]);
}
