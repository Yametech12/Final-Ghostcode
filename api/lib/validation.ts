/**
 * Server-side input validation primitives.
 *
 * Shared by all API handlers (Express dev path and Vercel serverless path
 * both call the same handlers in `handlers.ts`, so validation lives here,
 * next to them).
 *
 * Design rules:
 *  - Type-check BEFORE string operations. `!message?.trim()` guards
 *    null/undefined but not numbers/objects — `(12345).trim()` is a
 *    TypeError, which used to surface as an unhandled 500 (audit H-4).
 *  - Every length cap comes from BOUNDS so the numbers live in one place.
 *  - Helpers THROW ValidationError; handlers catch it once and convert it
 *    to a normalized 400 response via `validationErrorResponse`.
 */

/** Server-side size/clamp bounds for every dangerous input field. */
export const BOUNDS = {
  /** Advisor chat user message. */
  MAX_MESSAGE_CHARS: 4000,
  /** Advisor session title (stored + injected into the system prompt). */
  MAX_TITLE_CHARS: 200,
  MAX_SESSION_TITLE_LEN: 200,
  MAX_NAME_CHARS: 80,
  MAX_BIO_CHARS: 500,
  /** Calibration `answers` payload, in KB. */
  MAX_ANSWERS_KB: 10,
  /** Reference ceiling for JSON bodies (Express global limit is 1mb). */
  MAX_BODY_BYTES: 100_000,
  MIN_TEMPERATURE: 0,
  MAX_TEMPERATURE: 1,
  MAX_OUTPUT_TOKENS: 4096,
  /** History window for advisor chat context. */
  MAX_HISTORY_MESSAGES: 50,
  /** Hard cap on tasks per oracle analysis (matches the handler check). */
  MAX_TASKS_PER_ANALYSIS: 50,
  /** Data-URL length cap for profile photo uploads (≈3.6MB decoded). */
  MAX_B64_DATAURL_BYTES: 5_242_880,
  /** Hard cap on advisor_messages rows per session (guard returns 429). */
  MAX_MESSAGES_PER_SESSION: 200,
} as const;

/** Typed validation failure — carries the HTTP status + wire error code. */
export class ValidationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = 'BAD_REQUEST', status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
    this.code = code;
  }
}

/** The `{ status, body }` shape returned by the shared handlers. */
export interface NormalizedErrorBody {
  status: number;
  body: { error: string; code?: string };
}

/**
 * Convert a thrown ValidationError into a normalized 4xx response.
 * Re-throws anything that is NOT a ValidationError so genuine bugs still
 * bubble up to the 500 path instead of being masked as client errors.
 */
export function validationErrorResponse(err: unknown): NormalizedErrorBody {
  if (err instanceof ValidationError) {
    return { status: err.status, body: { error: err.message, code: err.code } };
  }
  throw err;
}

/**
 * Require a real string, trimmed, within `maxLen`.
 * Throws ValidationError (4xx, never a TypeError) for non-strings.
 */
export function requireString(input: unknown, fieldName: string, maxLen: number): string {
  if (typeof input !== 'string') {
    throw new ValidationError(
      `${fieldName} must be a string`,
      `${fieldName.toUpperCase()}_INVALID_TYPE`,
    );
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${fieldName} is required`, `${fieldName.toUpperCase()}_EMPTY`);
  }
  if (trimmed.length > maxLen) {
    throw new ValidationError(
      `${fieldName} too long (max ${maxLen} chars)`,
      `${fieldName.toUpperCase()}_TOO_LONG`,
    );
  }
  return trimmed;
}

/**
 * Coerce to an integer and clamp to [min, max]. Non-finite input falls back.
 * Use for cost knobs the client should influence but not control
 * (`max_tokens`, pagination limits, …).
 */
export function clampInt(
  input: unknown,
  fieldName: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/**
 * Coerce to a finite float and clamp to [min, max]. Non-finite input
 * (NaN, Infinity, `{"temperature": {"a":1}}`) falls back.
 */
export function clampFloat(
  input: unknown,
  fieldName: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Require a JSON string (or JSON-serializable value serialized here) that
 * parses and fits within `maxLenKb` kilobytes. Returns the JSON text.
 * Used for payloads that get persisted and/or interpolated into LLM prompts
 * (calibration `answers`), where both size and structure matter.
 */
export function requireJsonString(
  input: unknown,
  fieldName: string,
  maxLenKb: number,
): string {
  if (input == null) {
    throw new ValidationError(`${fieldName} required`, `${fieldName.toUpperCase()}_MISSING`);
  }
  let json: string;
  if (typeof input === 'string') {
    json = input;
  } else if (typeof input === 'object') {
    try {
      json = JSON.stringify(input);
    } catch {
      throw new ValidationError(
        `${fieldName} must be JSON-serializable`,
        `${fieldName.toUpperCase()}_TYPE`,
      );
    }
  } else {
    throw new ValidationError(`${fieldName} must be an object`, `${fieldName.toUpperCase()}_TYPE`);
  }
  if (json.length > maxLenKb * 1024) {
    throw new ValidationError(
      `${fieldName} too large (max ${maxLenKb}KB)`,
      `${fieldName.toUpperCase()}_TOO_LARGE`,
    );
  }
  try {
    JSON.parse(json);
  } catch {
    throw new ValidationError(
      `${fieldName} must be valid JSON`,
      `${fieldName.toUpperCase()}_INVALID_JSON`,
    );
  }
  return json;
}
