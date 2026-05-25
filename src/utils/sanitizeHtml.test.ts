import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripHtml,
  sanitizeAiResponse,
  sanitizeUserInput,
} from './sanitizeHtml';

describe('escapeHtml', () => {
  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes the five HTML metacharacters', () => {
    expect(escapeHtml(`<a href="x" onclick='boom'>&</a>`))
      .toBe('&lt;a href=&quot;x&quot; onclick=&#x27;boom&#x27;&gt;&amp;&lt;/a&gt;');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('stripHtml', () => {
  it('removes script tags and their content', () => {
    expect(stripHtml('safe<script>alert(1)</script>after')).toBe('safeafter');
  });

  it('removes style tags and their content', () => {
    expect(stripHtml('a<style>.x{}</style>b')).toBe('ab');
  });

  it('strips arbitrary tags', () => {
    expect(stripHtml('<p>hello <b>world</b></p>')).toBe('hello world');
  });

  it('removes javascript: URLs and event handlers', () => {
    expect(stripHtml('<a href="javascript:alert(1)" onclick=evil>x</a>'))
      .toBe('x');
  });

  it('trims surrounding whitespace (this is a complete-snippet helper)', () => {
    expect(stripHtml('  hi  ')).toBe('hi');
  });
});

describe('sanitizeAiResponse', () => {
  it('preserves leading and trailing whitespace (regression: trim bug)', () => {
    // Regression: an earlier version called .trim() and broke the streaming
    // chat path because adjacent tokens like "Hello" + " world" got glued.
    expect(sanitizeAiResponse(' hello ')).toBe(' hello ');
    expect(sanitizeAiResponse('\nparagraph\n')).toBe('\nparagraph\n');
  });

  it('does not glue tokens when called per-chunk', () => {
    const tokens = ['Hello', ' world', '!'];
    expect(tokens.map(sanitizeAiResponse).join('')).toBe('Hello world!');
  });

  it('removes <script>, <iframe>, <object>, <embed>, <form>, <input> tags', () => {
    expect(sanitizeAiResponse('a<script>x</script>b')).toBe('ab');
    expect(sanitizeAiResponse('a<iframe src=x></iframe>b'))
      .toBe('a</iframe>b'); // opener removed, closer left as plain text
    expect(sanitizeAiResponse('a<object data=x>b')).toBe('ab');
    expect(sanitizeAiResponse('a<embed src=x>b')).toBe('ab');
    expect(sanitizeAiResponse('a<form action=x>b')).toBe('ab');
    expect(sanitizeAiResponse('a<input type=text>b')).toBe('ab');
  });

  it('strips inline event handlers and javascript: URLs', () => {
    expect(sanitizeAiResponse('<a href="javascript:bad" onclick="boom">x</a>'))
      .toBe('<a href="bad" >x</a>');
  });

  it('strips data:text/html URLs', () => {
    expect(sanitizeAiResponse('href=data:text/html,evil'))
      .toBe('href=,evil');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeAiResponse('')).toBe('');
  });
});

describe('sanitizeUserInput', () => {
  it('removes script tags and javascript: protocols', () => {
    expect(sanitizeUserInput('hi<script>x</script> there javascript:bad'))
      .toBe('hi there bad');
  });

  it('truncates to maxLength', () => {
    expect(sanitizeUserInput('abcdefghij', 4)).toBe('abcd');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeUserInput('  hi  ')).toBe('hi');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeUserInput('')).toBe('');
  });
});
