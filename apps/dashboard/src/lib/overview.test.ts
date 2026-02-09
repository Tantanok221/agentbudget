import { describe, expect, test } from 'vitest';
import { getOverviewV2 } from '../../../../dist/lib/overview_v2.js';

describe('getOverviewV2 (imported from agentbudget internals)', () => {
  test('returns an overview object for a month', async () => {
    const out = await getOverviewV2('2026-02');
    expect(out).toBeTruthy();
    expect(out.month).toBe('2026-02');
    expect(out).toHaveProperty('budget');
    expect(out).toHaveProperty('reports');
  });
});
