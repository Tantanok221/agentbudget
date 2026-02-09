import { Command } from 'commander';
import fs from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { makeDb } from '../db/client.js';
import { allocations, budgetMonths, envelopeMoves, envelopes, targets } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { parseMonthStrict } from '../lib/month.js';
import { newId, nowIsoUtc, requireNonEmpty } from '../lib/util.js';
import { TBB_NAME_DEFAULT } from './system.js';

const AllocationItemSchema = z.object({
  envelope: z.string().min(1),
  amount: z.number().finite(),
});

const AllocateInputSchema = z.object({
  allocations: z.array(AllocationItemSchema).min(1),
  note: z.string().optional(),
});

async function resolveEnvelopeId(db: ReturnType<typeof makeDb>['db'], envelope: string): Promise<string> {
  const value = requireNonEmpty(envelope, 'Envelope is required');
  const byId = await db.select().from(envelopes).where(eq(envelopes.id, value)).limit(1);
  if (byId[0]) return byId[0].id;
  const byName = await db.select().from(envelopes).where(eq(envelopes.name, value)).limit(1);
  if (byName[0]) return byName[0].id;
  throw new Error(`Envelope not found: ${value}`);
}

async function getOrCreateBudgetMonthId(db: ReturnType<typeof makeDb>['db'], month: string) {
  const existing = await db.select().from(budgetMonths).where(eq(budgetMonths.month, month)).limit(1);
  if (existing[0]) return existing[0].id;
  const row = { id: newId('bm'), month, currency: 'MYR', createdAt: nowIsoUtc() };
  await db.insert(budgetMonths).values(row);
  return row.id;
}

import { getMonthSummaryData } from '../lib/overview_impl.js';
import { computeUnderfunded } from '../lib/targets.js';

export function registerBudgetCommands(program: Command) {
  const budget = program.command('budget').description('Budget allocations and moves').addHelpCommand(false);

  budget.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  budget
    .command('allocate')
    .description('Allocate money to envelopes for a month (YNAB-like)')
    .argument('<month>', 'YYYY-MM')
    .requiredOption('--from-json <path>', 'Path to JSON file: { allocations: [{envelope,amount}], note? }')
    .action(async function (monthArg: string) {
      const cmd = this as Command;
      try {
        const { month } = parseMonthStrict(monthArg);
        const opts = cmd.opts();
        const path = requireNonEmpty(String(opts.fromJson), '--from-json is required');

        const raw = await fs.readFile(path, 'utf-8');
        const parsed = JSON.parse(raw);
        const val = AllocateInputSchema.parse(parsed);

        const { db } = makeDb();

        const tbb = await db
          .select()
          .from(envelopes)
          .where(eq(envelopes.name, TBB_NAME_DEFAULT))
          .limit(1);

        if (!tbb[0]) {
          throw Object.assign(new Error(`To Be Budgeted envelope not found. Run: agentbudget system init`), {
            code: 'MISSING_TBB',
          });
        }

        const budgetMonthId = await getOrCreateBudgetMonthId(db, month);

        // Resolve envelope ids and build allocation rows
        const rows: Array<any> = [];
        let total = 0;

        for (const a of val.allocations) {
          const envelopeId = await resolveEnvelopeId(db, a.envelope);
          const amount = Math.trunc(a.amount);
          total += amount;
          rows.push({
            id: newId('alloc'),
            budgetMonthId,
            envelopeId,
            amount,
            source: 'manual' as const,
            note: val.note ?? null,
            createdAt: nowIsoUtc(),
          });
        }

        // Mirror entry for TBB (negative total) so month summary can compute TBB budgeted cleanly.
        if (total !== 0) {
          rows.push({
            id: newId('alloc'),
            budgetMonthId,
            envelopeId: tbb[0].id,
            amount: -total,
            source: 'manual' as const,
            note: val.note ? `TBB offset: ${val.note}` : 'TBB offset',
            createdAt: nowIsoUtc(),
          });
        }

        await db.insert(allocations).values(rows);

        print(cmd, `Allocated for ${month}: items=${val.allocations.length} total=${total}`, {
          month,
          budgetMonthId,
          total,
          inserted: rows.length,
        });
      } catch (err: any) {
        const code = err?.code as string | undefined;
        printError(cmd, err, code);
        process.exitCode = code === 'MISSING_TBB' ? 3 : 2;
      }
    });

  budget
    .command('move')
    .description('Move budget between envelopes within a month')
    .argument('<month>', 'YYYY-MM')
    .requiredOption('--from <envelope>', 'From envelope name/id')
    .requiredOption('--to <envelope>', 'To envelope name/id')
    .requiredOption('--amount <major>', 'Positive amount in major units (e.g. 100 or 100.00)')
    .option('--note <note>', 'Note')
    .action(async function (monthArg: string) {
      const cmd = this as Command;
      try {
        const { month } = parseMonthStrict(monthArg);
        const opts = cmd.opts();

        const { parseMajorToMinor } = await import('../lib/money.js');
        const amount = parseMajorToMinor(String(opts.amount));
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('--amount must be a positive amount');

        const { db } = makeDb();
        const budgetMonthId = await getOrCreateBudgetMonthId(db, month);

        const fromEnvelopeId = await resolveEnvelopeId(db, String(opts.from));
        const toEnvelopeId = await resolveEnvelopeId(db, String(opts.to));
        if (fromEnvelopeId === toEnvelopeId) throw new Error('from and to envelopes must be different');

        const row = {
          id: newId('move'),
          budgetMonthId,
          fromEnvelopeId,
          toEnvelopeId,
          amount,
          note: opts.note ? String(opts.note) : null,
          createdAt: nowIsoUtc(),
        };

        await db.insert(envelopeMoves).values(row);

        print(cmd, `Moved ${amount} in ${month}: ${opts.from} -> ${opts.to}`, row);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  budget
    .command('underfunded')
    .description('Compute recommended budget amounts from targets for a month')
    .argument('<month>', 'YYYY-MM')
    .action(async function (monthArg: string) {
      const cmd = this as Command;
      try {
        const { month } = parseMonthStrict(monthArg);
        const { db } = makeDb();

        const { summary } = await getMonthSummaryData(month, true);

        const tgtRows = await db
          .select({
            id: targets.id,
            envelopeId: targets.envelopeId,
            type: targets.type,
            amount: targets.amount,
            targetAmount: targets.targetAmount,
            targetMonth: targets.targetMonth,
            startMonth: targets.startMonth,
            note: targets.note,
          })
          .from(targets)
          .where(eq(targets.archived, false));

        const tgtByEnv = new Map<string, any>();
        for (const t of tgtRows) tgtByEnv.set(t.envelopeId, t);

        const items = summary.envelopes
          .map((e: any) => {
            const t = tgtByEnv.get(e.envelopeId);
            if (!t) return null;

            const target =
              t.type === 'monthly'
                ? ({ type: 'monthly', amount: Number(t.amount ?? 0) } as const)
                : t.type === 'needed_for_spending'
                  ? ({ type: 'needed_for_spending', amount: Number(t.amount ?? 0) } as const)
                  : ({
                      type: 'by_date',
                      targetAmount: Number(t.targetAmount ?? 0),
                      targetMonth: String(t.targetMonth),
                      startMonth: String(t.startMonth),
                    } as const);

            const budgetedThisMonth = Number(e.budgeted ?? 0);
            const availableStart = Number(e.availableStart ?? 0);

            const underfunded = computeUnderfunded({ month, target, budgetedThisMonth, availableStart });

            return {
              envelope: {
                envelopeId: e.envelopeId,
                name: e.name,
                groupName: e.groupName,
                isHidden: e.isHidden,
              },
              target,
              metrics: {
                budgetedThisMonth,
                availableStart,
              },
              underfunded,
            };
          })
          .filter(Boolean);

        const totalUnderfunded = items.reduce((a: number, r: any) => a + r.underfunded, 0);

        print(cmd, `Underfunded ${month}: ${totalUnderfunded}`, {
          month,
          totalUnderfunded,
          items,
        });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
