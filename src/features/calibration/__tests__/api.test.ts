import { describe, it, expect, vi } from 'vitest';

// Mock the external transports so importing ../api doesn't require real
// Supabase environment variables. The coercion helpers are pure functions.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), eq: vi.fn(), single: vi.fn(), order: vi.fn() })) },
}));
vi.mock('../../../lib/fetch', () => ({ apiFetch: vi.fn() }));
vi.mock('../../../lib/ai', () => ({ chatCompletion: vi.fn() }));

import { coerceToString, coerceStringArray, coerceAnalysisResult, normalizeHistoryItem } from '../api';

// Real unit tests for the coercion helpers (moved verbatim from the page).
describe('calibration/api coercion helpers', () => {
  it('coerceToString flattens nested objects into key: value lines', () => {
    expect(coerceToString({ fears: 'x', shadow: 'y' })).toBe('fears: x\nshadow: y');
  });

  it('coerceToString handles primitives and nulls', () => {
    expect(coerceToString(null)).toBe('');
    expect(coerceToString(42)).toBe('42');
    expect(coerceToString(true)).toBe('true');
  });

  it('coerceStringArray wraps a lone string into an array', () => {
    expect(coerceStringArray('only')).toEqual(['only']);
    expect(coerceStringArray(123)).toEqual(['123']);
  });

  it('coerceAnalysisResult falls back to TDI and default task shape for garbage input', () => {
    const result = coerceAnalysisResult({ primaryType: 'XXX', tasks: 'nope' });
    expect(result.primaryType).toBe('TDI');
    expect(result.tasks).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('normalizeHistoryItem stamps ids and formats the date', () => {
    const item = normalizeHistoryItem({
      id: 'row-1',
      result: { primaryType: 'TJI', confidence: 80 },
      timestamp: '2026-01-15T00:00:00.000Z',
      scenarioSummary: 'summary',
    });
    expect(item.id).toBe('row-1');
    expect(item.primaryType).toBe('TJI');
    expect(item.scenarioSummary).toBe('summary');
    expect(item.tasks.length).toBe(0);
  });
});
