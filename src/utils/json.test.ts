import { describe, it, expect } from 'vitest';
import { safeParseJSON } from './json';

describe('safeParseJSON', () => {
  it('returns the fallback for null input', () => {
    expect(safeParseJSON(null, { default: true })).toEqual({ default: true });
  });

  it('returns the fallback for empty string', () => {
    expect(safeParseJSON('', [])).toEqual([]);
  });

  it('parses plain JSON', () => {
    expect(safeParseJSON('{"a":1}', null)).toEqual({ a: 1 });
  });

  it('extracts JSON from a markdown code fence', () => {
    const md = '```json\n{"a":1}\n```';
    expect(safeParseJSON(md, null)).toEqual({ a: 1 });
  });

  it('extracts JSON between the first { and the last }', () => {
    const text = 'noise before {"a":1} noise after';
    expect(safeParseJSON(text, null)).toEqual({ a: 1 });
  });

  it('repairs JSON with missing closing braces', () => {
    const truncated = '{"a":{"b":1}';
    expect(safeParseJSON(truncated, null)).toEqual({ a: { b: 1 } });
  });

  it('returns the fallback when parsing is impossible', () => {
    expect(safeParseJSON('not json at all', 'fallback')).toBe('fallback');
  });
});
