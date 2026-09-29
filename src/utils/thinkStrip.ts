/**
 * Incremental <think> block stripper built for streaming.
 *
 * gpt-oss-120b and qwen3.5-122b wrap chain-of-thought in <think>…</think>.
 * Rendering it leaks raw reasoning prose into the advisor transcript. A
 * naive per-chunk `replace()` can't catch a tag split across two SSE chunks
 * ("<thi" + "nk>"), so this class:
 *
 *   • swallows everything from <think> until </think> (or end of stream);
 *   • holds back a trailing partial-tag prefix (≤ 7 chars) until the next
 *     chunk disambiguates it, so "<thi|nk>" is still caught;
 *   • on flush(), emits any held-back literal text and discards an
 *     unterminated think block entirely (it was all reasoning).
 *
 * Tags are matched case-sensitively and lowercase — both Regolo thinking
 * models emit lowercase <think>, matching the complete-string regex in
 * `stripThinking` (src/lib/ai.ts) for the non-streaming paths.
 */
const OPEN = '<think>';
const CLOSE = '</think>';

/** Length of the longest suffix of `text` that is a proper prefix of `tag`. */
function partialTagSuffixLength(text: string, tag: string): number {
  const max = Math.min(tag.length - 1, text.length);
  for (let len = max; len > 0; len--) {
    if (text.endsWith(tag.slice(0, len))) return len;
  }
  return 0;
}

export class ThinkStripper {
  private inThink = false;
  private tail = '';

  /** Feed one chunk; returns the display-safe text for it (may be empty). */
  push(chunk: string): string {
    if (!chunk) return '';
    let text = this.tail + chunk;
    this.tail = '';
    let out = '';

    while (text.length > 0) {
      if (this.inThink) {
        const end = text.indexOf(CLOSE);
        if (end === -1) {
          // Hold back a possible partial "</think>" at the tail; swallow the rest.
          const hold = partialTagSuffixLength(text, CLOSE);
          this.tail = hold > 0 ? text.slice(text.length - hold) : '';
          text = '';
          break;
        }
        text = text.slice(end + CLOSE.length);
        this.inThink = false;
        continue;
      }

      const start = text.indexOf(OPEN);
      if (start === -1) {
        // Emit everything except a possible partial "<think>" at the tail.
        const hold = partialTagSuffixLength(text, OPEN);
        const emit = text.length - hold;
        if (emit > 0) out += text.slice(0, emit);
        this.tail = hold > 0 ? text.slice(emit) : '';
        text = '';
        break;
      }
      if (start > 0) out += text.slice(0, start);
      text = text.slice(start + OPEN.length);
      this.inThink = true;
    }
    return out;
  }

  /**
   * End of stream: release held-back literal text; drop an unterminated
   * think block entirely (everything inside was reasoning, never meant
   * for display).
   */
  flush(): string {
    const rest = this.tail;
    this.tail = '';
    if (this.inThink) {
      this.inThink = false;
      return '';
    }
    return rest;
  }
}
