import { Command } from 'commander';
import { print, printError } from '../lib/output.js';
import { parseMonthStrict } from '../lib/month.js';

function monthFromNowUtc() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function fmt(n: number) {
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

        const topOverspent = out.budget.overspentEnvelopes.slice(0, 2).map((e: any) => `${e.name} ${fmt(e.available)}`).join('; ');
        const topUnderfunded = out.goals.topUnderfunded.slice(0, 3).map((e: any) => `${e.name} ${fmt(e.underfunded)}`).join('; ');

        const human = [
          `AGENTBUDGET OVERVIEW — ${out.month}`,
          '',
          'BUDGET',
          `To Be Budgeted: ${fmt(out.budget.toBeBudgeted.available)}   Underfunded: ${fmt(out.goals.underfundedTotal)}`,
          out.flags.overbudget ? 'Overbudget: YES' : 'Overbudget: no',
          out.flags.overspent ? `Overspent: ${out.budget.overspentEnvelopes.length}${topOverspent ? ` (${topOverspent})` : ''}` : 'Overspent: 0',
          '',
          'CASHFLOW (month)',
          `Income: ${fmt(out.reports.cashflow.income)}   Expense: ${fmt(out.reports.cashflow.expense)}   Net: ${fmt(out.reports.cashflow.net)}`,
          '',
          'NET WORTH',
          `Liquid: ${fmt(out.netWorth.liquid)}   Tracking: ${fmt(out.netWorth.tracking)}   Total: ${fmt(out.netWorth.total)}`,
          '',
          'TOP UNDERFUNDED',
          topUnderfunded || '(none)',
          '',
          'SCHEDULES (next 7d, local time)',
          `Overdue: ${out.schedules.counts.overdue}   Due soon: ${out.schedules.counts.dueSoon}`,
        ].join('\n');

        print(cmd, human, out);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
