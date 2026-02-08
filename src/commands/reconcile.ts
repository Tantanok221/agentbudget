import { Command } from 'commander';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { accounts, envelopes, transactionSplits, transactions } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
// (no month helpers needed here)
import { newId, nowIsoUtc, requireNonEmpty } from '../lib/util.js';
import { TBB_NAME_DEFAULT } from './system.js';

async function resolveAccountId(db: ReturnType<typeof makeDb>['db'], account: string): Promise<{ id: string; name: string }> {
  const value = requireNonEmpty(account, 'Account is required');
  const byId = await db.select().from(accounts).where(eq(accounts.id, value)).limit(1);
  if (byId[0]) return { id: byId[0].id, name: byId[0].name };
  const byName = await db.select().from(accounts).where(eq(accounts.name, value)).limit(1);
  if (byName[0]) return { id: byName[0].id, name: byName[0].name };
  throw new Error(`Account not found: ${value}`);
}

async function getTbbEnvelopeId(db: ReturnType<typeof makeDb>['db']) {
  const tbb = await db
    .select({ id: envelopes.id, name: envelopes.name })
    .from(envelopes)
    .where(eq(envelopes.name, TBB_NAME_DEFAULT))
    .limit(1);
  if (!tbb[0]) {
    throw Object.assign(new Error(`To Be Budgeted envelope not found. Run: agentbudget system init`), { code: 'MISSING_TBB' });
  }
  return tbb[0].id;
}

async function computeClearedBalance(db: ReturnType<typeof makeDb>['db'], accountId: string) {
  const rows = await db
    .select({ sum: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), inArray(transactions.cleared, ['cleared', 'reconciled'])));
  return Number(rows[0]?.sum ?? 0);
}

export function registerReconcileCommands(program: Command) {
  const account = program.commands.find((c) => c.name() === 'account');
  if (!account) throw new Error('account command not registered');

  account
    .command('reconcile-preview <account>')
    .description('Preview reconcile delta vs a statement balance')
    .requiredOption('--statement-balance <minorUnits>', 'Statement/cleared balance (integer minor units)')
    .action(async function (accountArg: string) {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const acct = await resolveAccountId(db, accountArg);
        const statementBalance = Number.parseInt(String(cmd.opts().statementBalance), 10);
        if (!Number.isFinite(statementBalance)) throw new Error('Invalid --statement-balance');

        const clearedBalance = await computeClearedBalance(db, acct.id);
        const delta = statementBalance - clearedBalance;

        print(cmd, `Cleared balance=${clearedBalance} statement=${statementBalance} delta=${delta}`, {
          accountId: acct.id,
          accountName: acct.name,
          clearedBalance,
          statementBalance,
          delta,
        });
      } catch (err: any) {
        printError(cmd, err, err?.code);
        process.exitCode = 2;
      }
    });

  account
    .command('reconcile <account>')
    .description('Reconcile an account to a statement balance (creates an adjustment if needed)')
    .requiredOption('--statement-balance <minorUnits>', 'Statement/cleared balance (integer minor units)')
    .requiredOption('--date <date>', 'Reconcile date (ISO or YYYY-MM-DD)')
    .action(async function (accountArg: string) {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const acct = await resolveAccountId(db, accountArg);

        const statementBalance = Number.parseInt(String(cmd.opts().statementBalance), 10);
        if (!Number.isFinite(statementBalance)) throw new Error('Invalid --statement-balance');
        const postedAt = new Date(String(cmd.opts().date)).toISOString();

        const clearedBalance = await computeClearedBalance(db, acct.id);
        const delta = statementBalance - clearedBalance;

        let adjustment: any = null;
        if (delta !== 0) {
          const tbbId = await getTbbEnvelopeId(db);

          const adjTx = {
            id: newId('tx'),
            externalId: null,
            transferGroupId: null,
            transferPeerId: null,
            accountId: acct.id,
            postedAt,
            amount: delta,
            payeeName: 'Reconciliation Adjustment',
            memo: 'Auto adjustment to match statement balance',
            cleared: 'reconciled' as const,
            skipBudget: false,
            createdAt: nowIsoUtc(),
          };

          await db.insert(transactions).values(adjTx);
          await db.insert(transactionSplits).values({
            id: newId('split'),
            transactionId: adjTx.id,
            envelopeId: tbbId,
            amount: delta,
            note: 'reconcile-adjustment',
          });

          adjustment = adjTx;
        }

        // Mark all currently cleared txs as reconciled for this account (including ones before reconcile date).
        await db
          .update(transactions)
          .set({ cleared: 'reconciled' })
          .where(and(eq(transactions.accountId, acct.id), eq(transactions.cleared, 'cleared')));

        print(cmd, `Reconciled ${acct.name}. delta=${delta}`, {
          accountId: acct.id,
          accountName: acct.name,
          statementBalance,
          clearedBalance,
          delta,
          adjustment,
        });
      } catch (err: any) {
        printError(cmd, err, err?.code);
        process.exitCode = 2;
      }
    });
}
