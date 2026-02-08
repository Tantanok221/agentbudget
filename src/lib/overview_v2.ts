import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { accounts, envelopes, targets, transactionSplits, transactions } from '../db/schema.js';
import { parseMonthStrict } from './month.js';
import { computeUnderfunded } from './targets.js';
import { getMonthSummaryData } from './overview_impl.js';

function sumPosNeg(amounts: number[]) {
  let income = 0;
  let expense = 0;
  for (const a of amounts) {
    if (a > 0) income += a;
    else if (a < 0) expense += -a;
  }
  return { income, expense, net: income - expense };
}

export async function getOverviewV2(monthArg: string) {
  const { month, startIso, endIso } = parseMonthStrict(monthArg);
  const { db } = makeDb();

  // Budget snapshot (rollover-aware) using existing summary impl.
  const { summary } = await getMonthSummaryData(month, true);

  const overspentEnvelopes = summary.envelopes
    .filter((e: any) => e.overspent)
    .map((e: any) => ({ envelopeId: e.envelopeId, name: e.name, available: e.available }))
    .sort((a: any, b: any) => a.available - b.available);

  const topNegativeEnvelopes = summary.envelopes
    .map((e: any) => ({ envelopeId: e.envelopeId, name: e.name, available: e.available }))
    .sort((a: any, b: any) => a.available - b.available)
    .slice(0, 5);

  // Goals/underfunded
  const tgtRows = await db
    .select({
      envelopeId: targets.envelopeId,
      type: targets.type,
      amount: targets.amount,
      targetAmount: targets.targetAmount,
      targetMonth: targets.targetMonth,
      startMonth: targets.startMonth,
    })
    .from(targets)
    .where(eq(targets.archived, false));

  const tgtByEnv = new Map<string, any>();
  for (const t of tgtRows) tgtByEnv.set(t.envelopeId, t);

  const underfundedItems = summary.envelopes
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
        envelopeId: e.envelopeId,
        name: e.name,
        groupName: e.groupName,
        isHidden: e.isHidden,
        target,
        metrics: { availableStart, budgetedThisMonth },
        underfunded,
      };
    })
    .filter(Boolean) as any[];

  const underfundedTotal = underfundedItems.reduce((a, r) => a + r.underfunded, 0);
  const topUnderfunded = underfundedItems
    .slice()
    .sort((a, b) => b.underfunded - a.underfunded)
    .slice(0, 5);

  // Net worth / liquid
  const txAgg = await db
    .select({
      accountId: transactions.accountId,
      balance: sql<number>`sum(${transactions.amount})`,
      clearedBalance: sql<number>`sum(case when ${transactions.cleared} in ('cleared','reconciled') then ${transactions.amount} else 0 end)`,
      pendingBalance: sql<number>`sum(case when ${transactions.cleared} = 'pending' then ${transactions.amount} else 0 end)`,
      lastPostedAt: sql<string | null>`max(${transactions.postedAt})`,
    })
    .from(transactions)
    .groupBy(transactions.accountId);

  const byAcct = new Map<string, any>();
  for (const r of txAgg)
    byAcct.set(r.accountId, {
      balance: Number(r.balance ?? 0),
      clearedBalance: Number(r.clearedBalance ?? 0),
      pendingBalance: Number(r.pendingBalance ?? 0),
      lastPostedAt: r.lastPostedAt ?? null,
    });

  const acctBase = await db.select().from(accounts).orderBy(desc(accounts.name));
  const acctRows = acctBase.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    balance: byAcct.get(a.id)?.balance ?? 0,
    clearedBalance: byAcct.get(a.id)?.clearedBalance ?? 0,
    pendingBalance: byAcct.get(a.id)?.pendingBalance ?? 0,
    lastPostedAt: byAcct.get(a.id)?.lastPostedAt ?? null,
  }));

  const liquid = acctRows
    .filter((a) => a.type === 'checking' || a.type === 'savings' || a.type === 'cash')
    .reduce((s, a) => s + a.balance, 0);
  const tracking = acctRows.filter((a) => a.type === 'tracking').reduce((s, a) => s + a.balance, 0);
  const total = liquid + tracking;

  // Cashflow for the month (budget accounts only), excluding transfers.
  // Exclude tracking accounts from cashflow.
  const monthTx = await db
    .select({ amount: transactions.amount })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        gte(transactions.postedAt, startIso),
        lt(transactions.postedAt, endIso),
        sql`${transactions.transferGroupId} is null`,
        inArray(accounts.type, ['checking', 'savings', 'cash']),
      ),
    );

  const cashflow = sumPosNeg(monthTx.map((r) => Number(r.amount ?? 0)));

  // Top spending by envelope for the month (splits), ignore system envelopes later via name filter.
  const envRows = await db.select({ id: envelopes.id, name: envelopes.name, isSystem: envelopes.isSystem }).from(envelopes);
  const envById = new Map(envRows.map((e) => [e.id, e] as const));
  const envIds = envRows.map((e) => e.id);

  const spendRows = envIds.length
    ? await db
        .select({ envId: transactionSplits.envelopeId, sum: sql<number>`sum(${transactionSplits.amount})` })
        .from(transactionSplits)
        .innerJoin(transactions, eq(transactions.id, transactionSplits.transactionId))
        .where(and(inArray(transactionSplits.envelopeId, envIds), gte(transactions.postedAt, startIso), lt(transactions.postedAt, endIso)))
        .groupBy(transactionSplits.envelopeId)
    : [];

  const topSpending = spendRows
    .map((r) => {
      const env = envById.get(r.envId);
      const sum = Number(r.sum ?? 0);
      // spending is negative activity; convert to positive spent.
      const spent = sum < 0 ? -sum : 0;
      return env && !env.isSystem ? { envelopeId: r.envId, name: env.name, spent } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.spent - a.spent)
    .slice(0, 5);

  const flags = {
    overbudget: summary.tbb.available < 0,
    overspent: overspentEnvelopes.length > 0,
    hasPending: acctRows.some((a) => a.pendingBalance !== 0),
  };

  return {
    month,
    currency: summary.currency,
    flags,
    budget: {
      toBeBudgeted: summary.tbb,
      overspentEnvelopes,
      topNegativeEnvelopes,
    },
    goals: {
      underfundedTotal,
      topUnderfunded,
    },
    netWorth: {
      liquid,
      tracking,
      total,
    },
    accounts: {
      list: acctRows,
    },
    reports: {
      cashflow,
      topSpending,
    },
    warnings: summary.warnings,
  };
}
