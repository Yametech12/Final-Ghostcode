/**
 * Server-side sanitization for every inbound AI prompt field (SEC-12).
 *
 * The client already sanitizes on render (sanitizeAiResponse in
 * src/utils/sanitizeHtml.ts), but the server previously persisted and
 * forwarded raw user text to Regolo. A crafted payload could:
 *   • inject fake `system:` / `assistant:` lines to steer the model
 *     (prompt-injection via role spoofing)
 *   • smuggle control characters / zero-width junk into stored history
 *   • exceed the documented size caps at the field level
 *
 * This module is the single server-side choke point: every handler that
 * accepts free-text AI input (advisor chat, ai/chat, calibration, oracle)
 * runs fields through `sanitizePromptField` before use or persistence.
 */

/** Visible ASCII + printable Unicode; strips control chars except \n\r\t. */
// eslint-disable-next-line no-control-regex -- stripping control chars is this module's purpose
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** Zero-width and bidi-override characters used to hide payloads. */
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
/** Role-spoofing lines, e.g. "system: ignore previous instructions". */
const ROLE_SPOOF = /^\s*(system|assistant|developer|tool)\s*[:\uFF1A]/gim;

const MAX_FIELD_LENGTHS = {
  chatMessage: 12_000, // advisor/ai chat bodies
  systemPrompt: 8_000, // system prompts assembled server-side
  title: 200, // session titles, display labels
  generic: 4_000, // everything else
} as const;

export type PromptFieldKind = keyof typeof MAX_FIELD_LENGTHS;

export interface SanitizeResult {
  text: string;
  changed: boolean;
  truncated: boolean;
}

/**
 * Sanitize a single free-text prompt field.
 *
 * @param raw     The client-supplied string.
 * @param kind    Field class determining the length cap.
 * @param options.maxLength  Overrides the per-kind cap (must be ≤ cap).
 */
export function sanitizePromptField(
  raw: unknown,
  kind: PromptFieldKind = 'generic',
  options: { maxLength?: number } = {},
): SanitizeResult {
  if (typeof raw !== 'string') {
    return { text: '', changed: raw != null, truncated: false };
  }

  const cap = Math.min(options.maxLength ?? MAX_FIELD_LENGTHS[kind], MAX_FIELD_LENGTHS[kind]);

  const stripped = raw
    .replace(CONTROL_CHARS, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(ROLE_SPOOF, 'user:');

  const truncated = stripped.length > cap;
  const text = truncated ? stripped.slice(0, cap) : stripped;

  return { text, changed: text !== raw, truncated };
}

/**
 * Convenience for chat payloads: sanitize and reject empty results.
 * Returns null when nothing usable remains (caller should 400).
 */
export function sanitizeChatMessage(raw: unknown): string | null {
  const { text } = sanitizePromptField(raw, 'chatMessage');
  return text.trim().length > 0 ? text : null;
}

/**
 * Walks a messages array (OpenAI chat shape) and sanitizes every string
 * content in place (returns a new array). Handles multimodal arrays by
 * sanitizing `text` parts only — image_url parts are validated elsewhere.
 */
export function sanitizeMessageArray(
  messages: unknown,
  options: { maxLength?: number } = {},
): Array<{ role: string; content: unknown }> {
  if (!Array.isArray(messages)) return [];
  return messages.map((m: any) => {
    if (!m || typeof m !== 'object') return { role: 'user', content: '' };
    const role = typeof m.role === 'string' ? m.role : 'user';
    if (typeof m.content === 'string') {
      return { role, content: sanitizePromptField(m.content, 'chatMessage', options).text };
    }
    if (Array.isArray(m.content)) {
      return {
        role,
        content: m.content.map((part: any) =>
          part && typeof part === 'object' && typeof part.text === 'string'
            ? { ...part, text: sanitizePromptField(part.text, 'chatMessage', options).text }
            : part,
        ),
      };
    }
    return { role, content: m.content };
  });
}
