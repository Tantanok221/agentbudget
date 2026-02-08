import { Command } from 'commander';
import { desc, eq, sql } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { accounts, envelopes, transactions } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { parseMonthStrict } from '../lib/month.js';

function monthFromNowUtc() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function registerOverviewCommand(program: Command) {
  program
    .command('overview')
    .description('High-level status: accounts, overspent, overbudget, key warnings')
    .option('--month <YYYY-MM>', 'Month to summarize (defaults to current UTC month)')
    .action(async function () {
      const cmd = this as Command;
      try {
        const monthArg = cmd.opts().month ? String(cmd.opts().month) : monthFromNowUtc();
        const { month } = parseMonthStrict(monthArg);

        // compute month summary via existing logic by importing command module dynamically
        const { getMonthSummaryData } = await import('../lib/overview_impl.js');
        const { summary, accounts: acctRows } = await getMonthSummaryData(month, false);

        const overspentEnvelopes = summary.envelopes.filter((e: any) => e.overspent);
        const overbudget = summary.tbb.available < 0;

        const out = {
          month: summary.month,
          currency: summary.currency,
          flags: {
            overspent: overspentEnvelopes.length > 0,
            overbudget,
          },
          tbb: summary.tbb,
          overspentEnvelopes,
          accounts: acctRows,
          totals: summary.totals,
          warnings: summary.warnings,
        };

        const human = [
          `Month: ${out.month}`,
          `TBB available: ${out.tbb.available}`,
          out.flags.overbudget ? 'Overbudget: YES' : 'Overbudget: no',
          out.flags.overspent ? `Overspent envelopes: ${overspentEnvelopes.length}` : 'Overspent envelopes: 0',
          `Accounts: ${out.accounts.length}`,
        ].join('\n');

        print(cmd, human, out);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
