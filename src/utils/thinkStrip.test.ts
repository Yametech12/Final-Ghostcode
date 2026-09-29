import { describe, it, expect } from 'vitest';
import { ThinkStripper } from './thinkStrip';

/** Feed chunks sequentially and join all emitted output. */
function stream(chunks: string[]): string {
  const s = new ThinkStripper();
  return chunks.map(c => s.push(c)).join('') + s.flush();
}

describe('ThinkStripper', () => {
  it('passes plain text through unchanged', () => {
    expect(stream(['Hello ', 'world'])).toBe('Hello world');
  });

  it('removes a complete think block in one chunk', () => {
    expect(stream(['<think>secret reasoning</think>Visible answer'])).toBe('Visible answer');
  });

  it('removes a think block split across chunk boundaries', () => {
    expect(stream(['<thi', 'nk>reasoning</th', 'ink>Answer'])).toBe('Answer');
  });

  it('removes an unterminated think block at end of stream', () => {
    expect(stream(['<think>partial reasoning without close'])).toBe('');
  });

  it('keeps text before an unterminated think block', () => {
    expect(stream(['Visible intro <think>hidden'])).toBe('Visible intro ');
  });

  it('handles a leading partial tag across chunks', () => {
    expect(stream(['Hello <th', 'ink>x</think> world'])).toBe('Hello  world');
  });

  it('emits a held-back partial that turned out to be literal text', () => {
    // "<th" is held, then next chunk proves it's not a tag opener.
    expect(stream(['a <th', 'ing b'])).toBe('a <thing b');
  });

  it('emits a held-back close-tag prefix that is literal text', () => {
    expect(stream(['</th', 'ing'])).toBe('</thing');
  });

  it('handles multiple think blocks', () => {
    expect(stream(['<think>a</think>One<think>b</think>Two'])).toBe('OneTwo');
  });

  it('handles empty chunks safely', () => {
    expect(stream(['', 'ok', ''])).toBe('ok');
  });

  it('handles a tag split at the exact final character', () => {
    expect(stream(['text<think>', 'r</think>after'])).toBe('textafter');
  });

  it('flush with no pending data is a no-op', () => {
    const s = new ThinkStripper();
    expect(s.push('plain')).toBe('plain');
    expect(s.flush()).toBe('');
  });

  it('whitespace and newlines inside think blocks are removed', () => {
    expect(stream(['<think>\nline1\nline2\n</think>\n\nAnswer here'])).toBe('\n\nAnswer here');
  });
});
