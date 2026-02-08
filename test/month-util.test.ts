import { describe, expect, it } from 'vitest';
import { parseMonthStrict } from '../src/lib/month.js';

describe('parseMonthStrict', () => {
  it('parses YYYY-MM to correct UTC bounds', () => {
    const m = parseMonthStrict('2026-02');
    expect(m.month).toBe('2026-02');
    expect(m.startIso).toBe('2026-02-01T00:00:00.000Z');
    expect(m.endIso).toBe('2026-03-01T00:00:00.000Z');
    expect(m.prevEndIso).toBe(m.startIso);
  });

  it('rejects invalid format', () => {
    expect(() => parseMonthStrict('2026/02')).toThrow(/YYYY-MM/);
    expect(() => parseMonthStrict('hello')).toThrow(/YYYY-MM/);
  });
});
