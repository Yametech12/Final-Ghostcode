import { describe, it, expect } from 'vitest';
import {
  buildRagPrompt,
  formatContextBlock,
  summarizeHistory,
  labelForSource,
  RAG_SECTION_HEADERS,
  NO_CONTEXT_NOTE,
} from './promptBuilder';
import type { RetrievedChunk } from './retriever';

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    sourceTable: 'field_reports',
    sourceId: '11111111-1111-1111-1111-111111111111',
    chunkIndex: 0,
    text: 'Scenario: she cancelled twice. Action: pulled back. Result: she re-engaged.',
    score: 0.82,
    similarity: 0.9,
    ageDays: 3,
    ...overrides,
  };
}

const baseInput = {
  baseSystemPrompt: 'You are Epimetheus, a relationship intelligence advisor.',
  history: [
    { role: 'user', content: 'hi' },
    { role: 'model', content: 'hello' },
  ],
  query: 'should I text her again?',
};

describe('labelForSource', () => {
  it('maps known source tables to readable labels', () => {
    expect(labelForSource('calibrations')).toBe('personality calibration');
    expect(labelForSource('field_reports')).toBe('field report');
    expect(labelForSource('favorites')).toBe('saved item');
  });

  it('falls back to the raw table name', () => {
    expect(labelForSource('mystery_table')).toBe('mystery_table');
  });
});

describe('formatContextBlock', () => {
  it('numbers chunks and includes the source label and score', () => {
    const block = formatContextBlock([chunk(), chunk({ sourceTable: 'favorites', sourceId: '2' })]);
    expect(block).toContain('[1] source=field report score=0.820');
    expect(block).toContain('[2] source=saved item');
  });

  it('returns the no-context note for an empty list', () => {
    expect(formatContextBlock([])).toBe(NO_CONTEXT_NOTE);
  });
});

describe('summarizeHistory', () => {
  it('describes an empty history explicitly', () => {
    expect(summarizeHistory([])).toBe('No earlier messages in this session.');
  });

  it('counts messages and normalises the model role to assistant', () => {
    const summary = summarizeHistory([
      { role: 'user', content: 'a' },
      { role: 'model', content: 'b' },
    ]);
    expect(summary).toContain('2 earlier message(s)');
    expect(summary).toContain('assistant');
  });
});

describe('buildRagPrompt', () => {
  it('emits all four sections in order with context present', () => {
    const messages = buildRagPrompt({ ...baseInput, chunks: [chunk()] });

    expect(messages[0].role).toBe('system');
    const system = messages[0].content;
    const systemIdx = system.indexOf(RAG_SECTION_HEADERS.system);
    const contextIdx = system.indexOf(RAG_SECTION_HEADERS.context);
    const recentIdx = system.indexOf(RAG_SECTION_HEADERS.recent);
    expect(systemIdx).toBe(0);
    expect(contextIdx).toBeGreaterThan(systemIdx);
    expect(recentIdx).toBeGreaterThan(contextIdx);
    expect(system).toContain(baseInput.baseSystemPrompt);
    expect(system).toContain('[1] source=field report');

    // History is preserved as real turns, then the query section closes it out.
    expect(messages).toHaveLength(4);
    expect(messages[1]).toEqual({ role: 'user', content: 'hi' });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'hello' });
    expect(messages[3].role).toBe('user');
    expect(messages[3].content).toBe(`${RAG_SECTION_HEADERS.query}\n${baseInput.query}`);
  });

  it('uses the no-context fallback when retrieval returned nothing', () => {
    const messages = buildRagPrompt({ ...baseInput, chunks: [] });
    const system = messages[0].content;

    expect(system).toContain(RAG_SECTION_HEADERS.context);
    expect(system).toContain(NO_CONTEXT_NOTE);
    expect(system).not.toContain('[1] source=');
    expect(messages[3].content).toContain(baseInput.query);
  });

  it('normalises a model role in history to assistant', () => {
    const messages = buildRagPrompt({ ...baseInput, chunks: [], history: [{ role: 'model', content: 'x' }] });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'x' });
  });

  it('supports the legacy un-sectioned shape', () => {
    const withContext = buildRagPrompt({ ...baseInput, chunks: [chunk()], sectioned: false });
    expect(withContext[0].content.startsWith(baseInput.baseSystemPrompt)).toBe(true);
    expect(withContext[0].content).toContain(RAG_SECTION_HEADERS.context);
    expect(withContext[3].content).toBe(baseInput.query);

    const withoutContext = buildRagPrompt({ ...baseInput, chunks: [], sectioned: false });
    expect(withoutContext[0].content).toBe(baseInput.baseSystemPrompt);
  });
});
