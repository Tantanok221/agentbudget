import { parseMonthStrict } from './month.js';

export type Target =
  | { type: 'monthly'; amount: number }
  | { type: 'needed_for_spending'; amount: number }
  | { type: 'by_date'; targetAmount: number; targetMonth: string; startMonth: string };

export function monthsBetweenInclusive(fromMonth: string, toMonth: string) {
  // inclusive count of months between YYYY-MM strings.
  parseMonthStrict(fromMonth);
  parseMonthStrict(toMonth);
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  const from = fy * 12 + (fm - 1);
  const to = ty * 12 + (tm - 1);
  return to - from + 1;
}

export function ceilDiv(n: number, d: number) {
  if (d <= 0) throw new Error('d must be > 0');
  return Math.floor((n + d - 1) / d);
}

export function computeUnderfunded(args: {
  month: string;
  target: Target;
  budgetedThisMonth: number;
  availableStart: number;
}) {
  const { month, target, budgetedThisMonth, availableStart } = args;
  parseMonthStrict(month);

  if (target.type === 'monthly') {
    return Math.max(0, target.amount - budgetedThisMonth);
  }

  if (target.type === 'needed_for_spending') {
    const cur = availableStart + budgetedThisMonth;
    return Math.max(0, target.amount - cur);
  }

  // by_date, evenly spread remaining needed by target month
  const remaining = Math.max(0, target.targetAmount - availableStart);
  if (month < target.startMonth) return 0;
  if (month > target.targetMonth) return 0;

  const monthsRemaining = monthsBetweenInclusive(month, target.targetMonth);
  return ceilDiv(remaining, monthsRemaining);
}
