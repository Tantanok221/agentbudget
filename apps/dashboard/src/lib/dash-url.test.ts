import { describe, expect, test } from 'vitest';
import { buildLegacyDashUrl } from './dash-url';

describe('buildLegacyDashUrl', () => {
  test('includes month and q when provided', () => {
    const url = buildLegacyDashUrl({ month: '2026-02', q: 'hello world' });
    expect(url).toContain('month=2026-02');
    expect(url).toContain('q=hello+world');
  });

  test('omits params when missing', () => {
    const url = buildLegacyDashUrl({});
    expect(url).toBe('http://127.0.0.1:8788/dash');
  });
});
