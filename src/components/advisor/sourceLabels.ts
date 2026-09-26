/**
 * Human-readable labels for RAG source tables. Kept in sync by hand with
 * `SOURCE_LABELS` in api/lib/rag/promptBuilder.ts (server side) — the client
 * never receives the mapping from the server.
 */
const SOURCE_LABELS: Record<string, string> = {
  calibrations: 'calibration',
  field_reports: 'field report',
  favorites: 'saved item',
};

export function labelForSource(sourceTable: string): string {
  return SOURCE_LABELS[sourceTable] ?? sourceTable;
}
