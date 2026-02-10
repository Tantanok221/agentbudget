import { Command } from 'commander';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { allocations, budgetMonths, envelopeMoves, envelopes, transactionSplits, transactions } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { TBB_NAME_DEFAULT } from './system.js';

import { parseMonthStrict } from '../lib/month.js';

export function registerMonthCommands(program: Command) {
  const month = program.command('month').description('Month-based summaries').addHelpCommand(false);

  month.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  month
    .command('summary')
    .description('Summarize a calendar month (includes rollover)')
    .argument('<month>', 'YYYY-MM')
    .option('--hidden', 'include hidden envelopes', false)
    .action(async function (monthArg: string) {
      const cmd = this as Command;
      try {
        const { month, startIso, endIso, prevEndIso } = parseMonthStrict(monthArg);
        const includeHidden = Boolean(cmd.opts().hidden);

        const { db } = makeDb();

        const tbb = await db
          .select()
          .from(envelopes)
          .where(and(eq(envelopes.isSystem, true), eq(envelopes.name, TBB_NAME_DEFAULT)))
          .limit(1);

        if (!tbb[0]) {
          // Friendly message. JSON mode handled by printError in CLI; we want a structured error.
          throw Object.assign(new Error(`To Be Budgeted envelope not found. Run: agentbudget system init`), {
            code: 'MISSING_TBB',
          });
        }

        const envRows = await db
          .select()
          .from(envelopes)
          .where(includeHidden ? undefined as any : eq(envelopes.isHidden, false));

        const envs = includeHidden ? envRows : envRows.filter((e) => !e.isHidden);
        const envIds = envs.map((e) => e.id);

        // Helpers: sums by envelope for prev and current month
        // Activity (tx splits)
        const prevActivity = envIds.length
          ? await db
              .select({ envelopeId: transactionSplits.envelopeId, sum: sql<number>`sum(${transactionSplits.amount})` })
              .from(transactionSplits)
              .innerJoin(transactions, eq(transactions.id, transactionSplits.transactionId))
              .where(and(inArray(transactionSplits.envelopeId, envIds), lt(transactions.postedAt, prevEndIso)))
              .groupBy(transactionSplits.envelopeId)
          : [];

        const curActivity = envIds.length
          ? await db
              .select({ envelopeId: transactionSplits.envelopeId, sum: sql<number>`sum(${transactionSplits.amount})` })
              .from(transactionSplits)
              .innerJoin(transactions, eq(transactions.id, transactionSplits.transactionId))
              .where(and(inArray(transactionSplits.envelopeId, envIds), gte(transactions.postedAt, startIso), lt(transactions.postedAt, endIso)))
              .groupBy(transactionSplits.envelopeId)
          : [];

        // Allocations via budget_months.month
        const prevBudgeted = envIds.length
          ? await db
              .select({ envelopeId: allocations.envelopeId, sum: sql<number>`sum(${allocations.amount})` })
              .from(allocations)
              .innerJoin(budgetMonths, eq(budgetMonths.id, allocations.budgetMonthId))
              .where(and(inArray(allocations.envelopeId, envIds), lt(budgetMonths.month, month)))
              .groupBy(allocations.envelopeId)
          : [];

        const curBudgeted = envIds.length
          ? await db
              .select({ envelopeId: allocations.envelopeId, sum: sql<number>`sum(${allocations.amount})` })
              .from(allocations)
              .innerJoin(budgetMonths, eq(budgetMonths.id, allocations.budgetMonthId))
              .where(and(inArray(allocations.envelopeId, envIds), eq(budgetMonths.month, month)))
              .groupBy(allocations.envelopeId)
          : [];

        // Moves
        const prevMovesIn = envIds.length
          ? await db
              .select({ envelopeId: envelopeMoves.toEnvelopeId, sum: sql<number>`sum(${envelopeMoves.amount})` })
              .from(envelopeMoves)
              .innerJoin(budgetMonths, eq(budgetMonths.id, envelopeMoves.budgetMonthId))
              .where(and(inArray(envelopeMoves.toEnvelopeId, envIds), lt(budgetMonths.month, month)))
              .groupBy(envelopeMoves.toEnvelopeId)
          : [];

        const prevMovesOut = envIds.length
          ? await db
              .select({ envelopeId: envelopeMoves.fromEnvelopeId, sum: sql<number>`sum(${envelopeMoves.amount})` })
              .from(envelopeMoves)
              .innerJoin(budgetMonths, eq(budgetMonths.id, envelopeMoves.budgetMonthId))
              .where(and(inArray(envelopeMoves.fromEnvelopeId, envIds), lt(budgetMonths.month, month)))
              .groupBy(envelopeMoves.fromEnvelopeId)
          : [];

        const curMovesIn = envIds.length
          ? await db
              .select({ envelopeId: envelopeMoves.toEnvelopeId, sum: sql<number>`sum(${envelopeMoves.amount})` })
              .from(envelopeMoves)
              .innerJoin(budgetMonths, eq(budgetMonths.id, envelopeMoves.budgetMonthId))
              .where(and(inArray(envelopeMoves.toEnvelopeId, envIds), eq(budgetMonths.month, month)))
              .groupBy(envelopeMoves.toEnvelopeId)
          : [];

        const curMovesOut = envIds.length
          ? await db
              .select({ envelopeId: envelopeMoves.fromEnvelopeId, sum: sql<number>`sum(${envelopeMoves.amount})` })
              .from(envelopeMoves)
              .innerJoin(budgetMonths, eq(budgetMonths.id, envelopeMoves.budgetMonthId))
              .where(and(inArray(envelopeMoves.fromEnvelopeId, envIds), eq(budgetMonths.month, month)))
              .groupBy(envelopeMoves.fromEnvelopeId)
          : [];

        const mapSum = (rows: Array<{ envelopeId: string; sum: number | null | undefined }>) => {
          const m = new Map<string, number>();
          for (const r of rows) m.set(r.envelopeId, Number(r.sum ?? 0));
          return m;
        };

        const prevActM = mapSum(prevActivity);
        const curActM = mapSum(curActivity);
        const prevBudM = mapSum(prevBudgeted);
        const curBudM = mapSum(curBudgeted);
        const prevInM = mapSum(prevMovesIn);
        const prevOutM = mapSum(prevMovesOut);
        const curInM = mapSum(curMovesIn);
        const curOutM = mapSum(curMovesOut);

        const envelopeSummaries = envs.map((e) => {
          const availableStart =
            (prevBudM.get(e.id) ?? 0) +
            (prevActM.get(e.id) ?? 0) +
            (prevInM.get(e.id) ?? 0) -
            (prevOutM.get(e.id) ?? 0);

          const budgeted = curBudM.get(e.id) ?? 0;
          const activity = curActM.get(e.id) ?? 0;
          const movedIn = curInM.get(e.id) ?? 0;
          const movedOut = curOutM.get(e.id) ?? 0;

          const available = availableStart + budgeted + activity + movedIn - movedOut;

          return {
            envelopeId: e.id,
            name: e.name,
            groupName: e.groupName,
            isHidden: e.isHidden,
            isSystem: e.isSystem,
            budgeted,
            activity,
            movedIn,
            movedOut,
            availableStart,
            available,
            overspent: available < 0,
          };
        });

        const tbbRow = envelopeSummaries.find((e) => e.envelopeId === tbb[0].id) ?? null;

        const visibleSummaries = includeHidden ? envelopeSummaries : envelopeSummaries.filter((e) => !e.isHidden);

        const totals = {
          budgeted: visibleSummaries.reduce((a, r) => a + r.budgeted, 0),
          activity: visibleSummaries.reduce((a, r) => a + r.activity, 0),
          available: visibleSummaries.reduce((a, r) => a + r.available, 0),
          overspentCount: visibleSummaries.filter((r) => r.overspent).length,
        };

        const out = {
          month,
          currency: process.env.AGENTBUDGET_CURRENCY ?? 'MYR',
          system: {
            tbbEnvelopeId: tbb[0].id,
            tbbEnvelopeName: tbb[0].name,
          },
          tbb: tbbRow
            ? {
                budgeted: tbbRow.budgeted,
                activity: tbbRow.activity,
                availableStart: tbbRow.availableStart,
                available: tbbRow.available,
              }
            : { budgeted: 0, activity: 0, availableStart: 0, available: 0 },
          envelopes: visibleSummaries.filter((e) => e.envelopeId !== tbb[0].id),
          totals,
          warnings: [] as string[],
        };

        print(cmd, `Month ${month}: envelopes=${out.envelopes.length} TBB_available=${out.tbb.available}`, out);
      } catch (err: any) {
        const code = err?.code as string | undefined;
        printError(cmd, err, code);
        process.exitCode = code === 'MISSING_TBB' ? 3 : 2;
      }
    });
}
