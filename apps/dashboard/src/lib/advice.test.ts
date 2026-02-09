import { describe, expect, test } from 'vitest';
import { buildAdvice } from './advice';

describe('buildAdvice', () => {
  test('mentions TBB and underfunded when relevant', () => {
    const text = buildAdvice({
      question: 'can i buy a macbook',
      month: '2026-02',
      overview: {
        budget: { toBeBudgeted: { available: 0 } },
        goals: { underfundedTotal: 282627, topUnderfunded: [{ name: 'Macbook', underfunded: 63637 }] },
        schedules: { counts: { overdue: 0, dueSoon: 2 }, topDue: [{ name: 'Payroll', date: '2026-02-11', amount: 300500 }] },
        netWorth: { liquid: 213420 },
        reports: { cashflow: { income: 215310, expense: 1890, net: 213420 } },
      },
    });

    expect(text.toLowerCase()).toContain('to be budgeted');
    expect(text.toLowerCase()).toContain('underfunded');
    expect(text.toLowerCase()).toContain('payroll');
  });
});
