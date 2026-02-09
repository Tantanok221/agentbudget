import { Command } from 'commander';
import { print, printError } from '../lib/output.js';
import { parseMonthStrict } from '../lib/month.js';
import { formatMinor } from '../lib/money.js';

function monthFromNowUtc() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function fmtMinor(n: number, currency: string) {
  return formatMinor(n, currency);
}

function fmtInt(n: number) {
  return n.toLocaleString('en-US');
}

export function registerOverviewCommand(program: Command) {
  program
    .command('overview')
    .description('Dashboard: budget health, goals, cashflow, net worth, accounts')
    .option('--month <YYYY-MM>', 'Month to summarize (defaults to current UTC month)')
    .action(async function () {
      const cmd = this as Command;
      try {
        const monthArg = cmd.opts().month ? String(cmd.opts().month) : monthFromNowUtc();
        const { month } = parseMonthStrict(monthArg);

        const { getOverviewV2 } = await import('../lib/overview_v2.js');
        const out = await getOverviewV2(month);

        const topOverspent = out.budget.overspentEnvelopes
          .slice(0, 2)
          .map((e: any) => `${e.name} ${fmtMinor(e.available, out.currency)}`)
          .join('; ');
        const topUnderfunded = out.goals.topUnderfunded
          .slice(0, 3)
          .map((e: any) => `${e.name} ${fmtMinor(e.underfunded, out.currency)}`)
          .join('; ');

        const human = [
          `AGENTBUDGET OVERVIEW — ${out.month} (${out.currency})`,
          '',
          'BUDGET',
          `To Be Budgeted: ${fmtMinor(out.budget.toBeBudgeted.available, out.currency)}   Underfunded: ${fmtMinor(out.goals.underfundedTotal, out.currency)}`,
          out.flags.overbudget ? 'Overbudget: YES' : 'Overbudget: no',
          out.flags.overspent ? `Overspent: ${out.budget.overspentEnvelopes.length}${topOverspent ? ` (${topOverspent})` : ''}` : 'Overspent: 0',
          '',
          'CASHFLOW (month)',
          `Income: ${fmtMinor(out.reports.cashflow.income, out.currency)}   Expense: ${fmtMinor(out.reports.cashflow.expense, out.currency)}   Net: ${fmtMinor(out.reports.cashflow.net, out.currency)}`,
          '',
          'NET WORTH',
          `Liquid: ${fmtMinor(out.netWorth.liquid, out.currency)}   Tracking: ${fmtMinor(out.netWorth.tracking, out.currency)}   Total: ${fmtMinor(out.netWorth.total, out.currency)}`,
          '',
          'TOP UNDERFUNDED',
          topUnderfunded || '(none)',
          '',
          'SCHEDULES (next 7d, local time)',
          `Overdue: ${fmtInt(out.schedules.counts.overdue)}   Due soon: ${fmtInt(out.schedules.counts.dueSoon)}`,
        ].join('\n');

        print(cmd, human, out);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
