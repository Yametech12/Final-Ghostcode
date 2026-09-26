interface StripeErrorProps {
  /** Human-friendly message to show. */
  message: string;
  /** Optional dismiss handler. When provided a close button renders. */
  onDismiss?: () => void;
}

/**
 * Friendly inline error UI for billing failures (checkout couldn't start,
 * portal unavailable, network error, …). Rendered inside the billing
 * components — never a raw console dump.
 */
export default function StripeError({ message, onDismiss }: StripeErrorProps) {
  return (
    <div
      role="alert"
      className="mt-3 flex items-start gap-3 rounded-xl border border-status-error/25 bg-status-error/10 px-4 py-3 text-sm text-slate-100"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-status-error/30 text-status-error"
      >
        !
      </span>
      <p className="flex-1 leading-relaxed">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
