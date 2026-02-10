import { describe, expect, it } from 'vitest';
import { formatMinor } from '../src/lib/money.js';

describe('money formatting', () => {
  it('falls back gracefully when currency is not an ISO code', () => {
    // 1234.56 in minor units
    const s = formatMinor(123456, 'RM', 'en-MY');
    expect(s).toContain('1234');
    expect(s).toContain('56');
    // Should not throw; exact formatting may vary.
  });
});
