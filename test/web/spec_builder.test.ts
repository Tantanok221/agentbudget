import { describe, expect, test } from 'vitest';
import { buildOverviewSpec } from '../../src/web/spec_builder.js';

describe('buildOverviewSpec', () => {
  test('returns a flat json-render spec with root+elements', () => {
    const spec = buildOverviewSpec({
      title: 't',
      month: '2026-02',
      overview: {
        budget: { toBeBudgeted: 0 },
        netWorth: { total: 0, liquid: 0 },
        reports: { cashflow: { income: 0, expense: 0, net: 0 }, topSpending: [], topSpendingByPayee: [] },
        accounts: { list: [] },
        goals: { underfundedTotal: 0, topUnderfunded: [] },
        schedules: { counts: { overdue: 0, dueSoon: 0 }, topDue: [] },
      },
      question: 'q',
    });

    expect(typeof (spec as any).root).toBe('string');
    expect((spec as any).root.length).toBeGreaterThan(0);
    expect(typeof (spec as any).elements).toBe('object');
    expect(Object.keys((spec as any).elements).length).toBeGreaterThan(0);
  });
});
