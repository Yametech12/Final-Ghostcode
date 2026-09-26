/**
 * Prompt builder for RAG-augmented advisor turns.
 *
 * Composes four explicit sections so the model can tell retrieved evidence
 * apart from instructions and conversation:
 *
 *   # SYSTEM            — the existing Epimetheus advisor prompt
 *   # RETRIEVED CONTEXT — numbered chunks with source + score labels
 *   # RECENT MESSAGES   — a compact digest of the session history
 *   # USER QUERY         — the newest user message
 *
 * When retrieval returns nothing the RETRIEVED CONTEXT section is still
 * emitted, carrying NO_CONTEXT_NOTE. That keeps the prompt shape stable (one
 * code path, no special-casing downstream) and explicitly tells the model that
 * the absence of context is expected rather than an omission it should
 * speculate about.
 */

import type { RetrievedChunk } from './retriever';

export interface PromptHistoryMessage {
  role: string;
  content: string;
}

export interface BuildRagPromptInput {
  baseSystemPrompt: string;
  chunks: RetrievedChunk[];
  history: PromptHistoryMessage[];
  query: string;
  /** When false, falls back to the pre-RAG shape (system + history + query). */
  sectioned?: boolean;
}

export const RAG_SECTION_HEADERS = {
  system: '# SYSTEM',
  context: '# RETRIEVED CONTEXT',
  recent: '# RECENT MESSAGES',
  query: '# USER QUERY',
} as const;

export const NO_CONTEXT_NOTE =
  'No stored context was retrieved for this turn. Answer from the profile data above and the conversation history only; do not claim to remember details that are not present.';

const SOURCE_LABELS: Record<string, string> = {
  calibrations: 'personality calibration',
  field_reports: 'field report',
  favorites: 'saved item',
};

export function labelForSource(sourceTable: string): string {
  return SOURCE_LABELS[sourceTable] ?? sourceTable;
}

/** Human-readable labels for the UI, kept next to the server-side mapping. */
export function formatContextBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return NO_CONTEXT_NOTE;
  return chunks
    .map((chunk, index) => {
      const label = labelForSource(chunk.sourceTable);
      const age = chunk.ageDays > 0 ? `${Math.round(chunk.ageDays)}d old` : 'current';
      return `[${index + 1}] source=${label} score=${chunk.score.toFixed(3)} (${age})\n${chunk.text}`;
    })
    .join('\n\n');
}

export function summarizeHistory(history: PromptHistoryMessage[]): string {
  if (history.length === 0) return 'No earlier messages in this session.';
  const roles = history
    .map((m) => (m.role === 'model' ? 'assistant' : m.role))
    .join(', ');
  return `${history.length} earlier message(s) in this session, oldest first: ${roles}.`;
}

export function buildRagPrompt(input: BuildRagPromptInput): PromptHistoryMessage[] {
  const { baseSystemPrompt, chunks, history, query, sectioned = true } = input;

  const normalizedHistory: PromptHistoryMessage[] = history.map((m) => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.content,
  }));

  if (!sectioned) {
    const contextSuffix =
      chunks.length > 0 ? `\n\n${RAG_SECTION_HEADERS.context}\n${formatContextBlock(chunks)}` : '';
    return [
      { role: 'system', content: `${baseSystemPrompt}${contextSuffix}` },
      ...normalizedHistory,
      { role: 'user', content: query },
    ];
  }

  const systemContent = [
    `${RAG_SECTION_HEADERS.system}\n${baseSystemPrompt}`,
    `${RAG_SECTION_HEADERS.context}\n${formatContextBlock(chunks)}`,
    `${RAG_SECTION_HEADERS.recent}\n${summarizeHistory(history)}`,
  ].join('\n\n');

  return [
    { role: 'system', content: systemContent },
    ...normalizedHistory,
    { role: 'user', content: `${RAG_SECTION_HEADERS.query}\n${query}` },
  ];
}
