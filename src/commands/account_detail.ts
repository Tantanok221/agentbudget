import { Command } from 'commander';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { accounts, envelopes, transactionSplits, transactions } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { requireNonEmpty } from '../lib/util.js';

async function resolveAccount(db: ReturnType<typeof makeDb>['db'], account: string) {
  const value = requireNonEmpty(account, 'Account is required');
  const byId = await db.select().from(accounts).where(eq(accounts.id, value)).limit(1);
  if (byId[0]) return byId[0];
  const byName = await db.select().from(accounts).where(eq(accounts.name, value)).limit(1);
  if (byName[0]) return byName[0];
  throw new Error(`Account not found: ${value}`);
}

export function registerAccountDetailCommand(program: Command) {
  const account = program.commands.find((c) => c.name() === 'account');
  if (!account) throw new Error('account command not registered');

  account
    .command('detail <account>')
    .description('Show account details: balances, counts, and recent transactions')
    .option('--limit <n>', 'Number of recent transactions', '10')
    .option('--statement-balance <minorUnits>', 'Optional statement/cleared balance to compute delta')
    .action(async function (accountArg: string) {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const acct = await resolveAccount(db, accountArg);

        const limit = Math.max(0, Math.min(200, Number.parseInt(String(cmd.opts().limit ?? '10'), 10) || 10));

        const balanceRows = await db
          .select({
            balance: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
            clearedBalance: sql<number>`coalesce(sum(case when ${transactions.cleared} in ('cleared','reconciled') then ${transactions.amount} else 0 end), 0)`,
            pendingBalance: sql<number>`coalesce(sum(case when ${transactions.cleared} = 'pending' then ${transactions.amount} else 0 end), 0)`,
            lastPostedAt: sql<string | null>`max(${transactions.postedAt})`,
            txCountTotal: sql<number>`count(*)`,
            txCountPending: sql<number>`sum(case when ${transactions.cleared} = 'pending' then 1 else 0 end)`,
            txCountCleared: sql<number>`sum(case when ${transactions.cleared} = 'cleared' then 1 else 0 end)`,
            txCountReconciled: sql<number>`sum(case when ${transactions.cleared} = 'reconciled' then 1 else 0 end)`,
          })
          .from(transactions)
          .where(eq(transactions.accountId, acct.id));

        const b = balanceRows[0] ?? {
          balance: 0,
          clearedBalance: 0,
          pendingBalance: 0,
          lastPostedAt: null,
          txCountTotal: 0,
          txCountPending: 0,
          txCountCleared: 0,
          txCountReconciled: 0,
        };

        const recent = limit
          ? await db
              .select()
              .from(transactions)
              .where(eq(transactions.accountId, acct.id))
              .orderBy(desc(transactions.postedAt))
              .limit(limit)
          : [];

        const ids = recent.map((t) => t.id);
        const splitsRows = ids.length
          ? await db
              .select({
                txId: transactionSplits.transactionId,
                amount: transactionSplits.amount,
                note: transactionSplits.note,
                envelopeName: envelopes.name,
                envelopeId: envelopes.id,
              })
              .from(transactionSplits)
              .innerJoin(envelopes, eq(envelopes.id, transactionSplits.envelopeId))
              .where(inArray(transactionSplits.transactionId, ids))
          : [];

        const byTx = new Map<string, any[]>();
        for (const s of splitsRows) {
          const arr = byTx.get(s.txId) ?? [];
          arr.push({ envelope: s.envelopeName, envelopeId: s.envelopeId, amount: s.amount, note: s.note });
          byTx.set(s.txId, arr);
        }

        const recentOut = recent.map((t) => ({ ...t, splits: byTx.get(t.id) ?? [] }));

        let reconcile: any = { statementBalance: null, delta: null };
        if (cmd.opts().statementBalance != null) {
          const statementBalance = Number.parseInt(String(cmd.opts().statementBalance), 10);
          if (!Number.isFinite(statementBalance)) throw new Error('Invalid --statement-balance');
          reconcile = {
            statementBalance,
            delta: statementBalance - Number(b.clearedBalance ?? 0),
          };
        }

        const out = {
          account: {
            id: acct.id,
            name: acct.name,
            type: acct.type,
            currency: acct.currency,
          },
          balances: {
            balance: Number(b.balance ?? 0),
            clearedBalance: Number(b.clearedBalance ?? 0),
            pendingBalance: Number(b.pendingBalance ?? 0),
          },
          counts: {
            txCountTotal: Number(b.txCountTotal ?? 0),
            txCountPending: Number(b.txCountPending ?? 0),
            txCountCleared: Number(b.txCountCleared ?? 0),
            txCountReconciled: Number(b.txCountReconciled ?? 0),
          },
          lastPostedAt: b.lastPostedAt ?? null,
          reconcile,
          recent: recentOut,
        };

        print(cmd, `Account ${acct.name}: balance=${out.balances.balance} cleared=${out.balances.clearedBalance}`, out);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
