/**
 * Sanitize AI-generated content before rendering.
 * Prevents prompt injection attacks where the AI might return HTML/script tags.
 * 
 * This is a lightweight sanitizer — for full HTML rendering, use DOMPurify.
 * Since we render AI responses as plain text (not dangerouslySetInnerHTML),
 * this is an extra safety layer for any edge cases.
 */

// Characters that could be used for HTML injection
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

/**
 * Escape HTML entities in a string to prevent XSS when rendered.
 * Use this for AI responses that might contain injected HTML.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Strip all HTML tags from a string.
 * More aggressive than escaping — removes tags entirely.
 *
 * Trims surrounding whitespace because callers of stripHtml hand in a complete
 * snippet, not a stream of partial tokens.
 */
export function stripHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Sanitize AI response content.
 *
 * IMPORTANT: this function is called *per SSE token* on the streaming path
 * (see `useAdvisorChat.performSend`). Tokens often start or end with a single
 * space or a newline — trimming them would silently glue words together
 * ("Hello" + " world" → "Helloworld") and collapse paragraph breaks. So we
 * deliberately do NOT trim here. Callers that hand in a *complete* string
 * can `.trim()` themselves if needed.
 */
export function sanitizeAiResponse(content: string): string {
  if (!content) return '';

  return content
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove iframe/object/embed
    .replace(/<(iframe|object|embed|form|input)[^>]*>/gi, '')
    // Remove event handlers
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocol
    .replace(/javascript\s*:/gi, '')
    // Remove data: protocol (can be used for XSS)
    .replace(/data\s*:\s*text\/html/gi, '');
  // No .trim() — whitespace between tokens is meaningful while streaming.
}

/**
 * Sanitize user input before sending to the server.
 * Less aggressive than AI sanitization — preserves most characters
 * but removes obvious injection attempts.
 */
export function sanitizeUserInput(input: string, maxLength = 5000): string {
  if (!input) return '';
  
  return input
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*["']/gi, '')
    .trim();
}
