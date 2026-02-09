import { describe, expect, test } from 'vitest';
import { buildDashboardViewModel } from './viewmodel';

describe('buildDashboardViewModel', () => {
  test('includes sections for goals, schedules, and accounts when present', () => {
    const vm = buildDashboardViewModel({
      q: 'test question',
      month: '2026-02',
      overview: {
        budget: { toBeBudgeted: { available: 0 } },
        netWorth: { total: 100, liquid: 50 },
        reports: {
          cashflow: { income: 10, expense: 5, net: 5 },
          topSpending: [{ envelopeId: 'e1', name: 'Food', spent: 123 }],
          topSpendingByPayee: [{ payeeId: 'p1', name: 'Grab', spent: 99 }],
        },
        goals: {
          underfundedTotal: 42,
          topUnderfunded: [{ envelopeId: 'e2', name: 'Macbook', underfunded: 4200 }],
        },
        schedules: {
          counts: { overdue: 1, dueSoon: 2 },
          topDue: [{ occurrenceId: 'o1', name: 'Payroll', date: '2026-02-11', amount: 300500 }],
        },
        accounts: {
          list: [{ id: 'a1', name: 'Savings', type: 'savings', balance: 131000 }],
        },
      },
    });

    expect(vm.question).toBe('test question');
    expect(vm.sections.map((s) => s.id)).toEqual(
      expect.arrayContaining(['snapshot', 'top_spending', 'goals', 'schedules', 'accounts', 'agent_response']),
    );
  });
});
