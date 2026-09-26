import { useCallback, useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { apiFetch } from '../../lib/fetch';

const HINT_DISMISSED_KEY = 'epimetheus:rag-hint-dismissed';

/**
 * First-run explainer for advisor retrieval, with the privacy opt-out switch.
 *
 * - Hidden after dismissal (localStorage) or when `/api/rag/status` is
 *   unreachable — the hint never blocks chat.
 * - The toggle persists `users.preferences.useRagForAdvisor` server-side; the
 *   server is the source of truth, so a failed write reports the real reason
 *   instead of pretending to have saved.
 */
export function RagHint() {
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    try {
      if (window.localStorage.getItem(HINT_DISMISSED_KEY) === '1') return;
    } catch {
      /* storage unavailable (private mode) — show the hint anyway */
    }

    apiFetch('/api/rag/status')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { useRagForAdvisor?: boolean } | null) => {
        if (cancelled) return;
        setVisible(true);
        if (data && typeof data.useRagForAdvisor === 'boolean') setEnabled(data.useRagForAdvisor);
      })
      .catch(() => {
        /* endpoint unavailable — stay silent */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(HINT_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    setNotice(null);
    try {
      const response = await apiFetch('/api/rag/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const data = response.ok ? await response.json() : null;
      if (!data || data.ok !== true) {
        setEnabled(!next);
        setNotice(
          data?.reason === 'PREFERENCES_UNAVAILABLE'
            ? 'Preferences are not available yet on this deployment.'
            : 'Could not save that preference. Please try again.',
        );
      }
    } catch {
      setEnabled(!next);
      setNotice('Could not save that preference. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [enabled]);

  if (!visible) return null;

  return (
    <div
      className="mx-auto flex w-full max-w-3xl items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400"
      role="note"
      data-testid="rag-hint"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />

      <div className="flex-1 space-y-1">
        <p className="text-slate-300">
          This advisor can ground its answers in your own history — calibrations, field reports and
          saved items. You can see exactly what was used under each reply.
        </p>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggle}
            disabled={saving}
            className="h-3.5 w-3.5 accent-amber-500"
            aria-describedby="rag-hint-toggle-help"
          />
          <span>Use my saved data as context</span>
        </label>
        <span id="rag-hint-toggle-help" className="sr-only">
          When disabled, the advisor answers without retrieving your saved data.
        </span>

        {notice && (
          <p className="text-amber-300" role="alert">
            {notice}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss context hint"
        className="mt-0.5 rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default RagHint;
