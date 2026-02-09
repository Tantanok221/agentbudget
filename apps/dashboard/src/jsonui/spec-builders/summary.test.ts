import { describe, expect, test } from 'vitest';
import { buildSummarySpec } from './summary';

describe('buildSummarySpec', () => {
  test('returns a json-render spec with root/elements', () => {
    const spec = buildSummarySpec({
      title: 't',
      month: '2026-02',
      question: 'q',
      adviceText: 'advice',
      overview: {
        budget: { toBeBudgeted: { available: 0 } },
        netWorth: { liquid: 1, total: 2 },
        reports: { cashflow: { income: 3, expense: 4, net: -1 } },
      },
    });

    expect(typeof (spec as any).root).toBe('string');
    expect((spec as any).elements).toBeTruthy();
    expect((spec as any).elements[(spec as any).root]).toBeTruthy();
  });
});
