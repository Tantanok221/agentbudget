import { desc, eq, inArray, lt, gte, and, sql } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { accounts, allocations, budgetMonths, envelopeMoves, envelopes, transactionSplits, transactions } from '../db/schema.js';
import { parseMonthStrict } from './month.js';
import { TBB_NAME_DEFAULT } from '../commands/system.js';
import { getBudgetCurrency } from './settings.js';

function mapSum(rows: Array<{ key: string; sum: number | null | undefined }>) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.key, Number(r.sum ?? 0));
  return m;
}

export async function getMonthSummaryData(monthArg: string, includeHidden: boolean) {
  const { month, startIso, endIso, prevEndIso } = parseMonthStrict(monthArg);
  const { db } = makeDb();

  const tbb = await db
    .select()
    .from(envelopes)
    .where(and(eq(envelopes.isSystem, true), eq(envelopes.name, TBB_NAME_DEFAULT)))
    .limit(1);
  if (!tbb[0]) {
    throw Object.assign(new Error(`To Be Budgeted envelope not found. Run: agentbudget system init`), { code: 'MISSING_TBB' });
  }

  const envRows = await db
    .select()
    .from(envelopes)
    .where(includeHidden ? undefined as any : eq(envelopes.isHidden, false));
  const envs = includeHidden ? envRows : envRows.filter((e) => !e.isHidden);
  const envIds = envs.map((e) => e.id);

  const prevActivity = envIds.length
    ? await db
        .select({ key: transactionSplits.envelopeId, sum: sql<number>`sum(${transactionSplits.amount})` })
        .from(transactionSplits)
        .innerJoin(transactions, eq(transactions.id, transactionSplits.transactionId))
        .where(and(inArray(transactionSplits.envelopeId, envIds), lt(transactions.postedAt, prevEndIso)))
        .groupBy(transactionSplits.envelopeId)
    : [];

  const curActivity = envIds.length
    ? await db
        .select({ key: transactionSplits.envelopeId, sum: sql<number>`sum(${transactionSplits.amount})` })
        .from(transactionSplits)
        .innerJoin(transactions, eq(transactions.id, transactionSplits.transactionId))
        .where(and(inArray(transactionSplits.envelopeId, envIds), gte(transactions.postedAt, startIso), lt(transactions.postedAt, endIso)))
        .groupBy(transactionSplits.envelopeId)
    : [];

  const prevBudgeted = envIds.length
    ? await db
        .select({ key: allocations.envelopeId, sum: sql<number>`sum(${allocations.amount})` })
        .from(allocations)
        .innerJoin(budgetMonths, eq(budgetMonths.id, allocations.budgetMonthId))
        .where(and(inArray(allocations.envelopeId, envIds), lt(budgetMonths.month, month)))
        .groupBy(allocations.envelopeId)
    : [];

  const curBudgeted = envIds.length
    ? await db
        .select({ key: allocations.envelopeId, sum: sql<number>`sum(${allocations.amount})` })
        .from(allocations)
        .innerJoin(budgetMonths, eq(budgetMonths.id, allocations.budgetMonthId))
        .where(and(inArray(allocations.envelopeId, envIds), eq(budgetMonths.month, month)))
        .groupBy(allocations.envelopeId)
    : [];

  const prevMovesIn = envIds.length
    ? await db
        .select({ key: envelopeMoves.toEnvelopeId, sum: sql<number>`sum(${envelopeMoves.amount})` })
        .from(envelopeMoves)
        .innerJoin(budgetMonths, eq(budgetMonths.id, envelopeMoves.budgetMonthId))
        .where(and(inArray(envelopeMoves.toEnvelopeId, envIds), lt(budgetMonths.month, month)))
        .groupBy(envelopeMoves.toEnvelopeId)
    : [];

  const prevMovesOut = envIds.length
    ? await db
        .select({ key: envelopeMoves.fromEnvelopeId, sum: sql<number>`sum(${envelopeMoves.amount})` })
        .from(envelopeMoves)
        .innerJoin(budgetMonths, eq(budgetMonths.id, envelopeMoves.budgetMonthId))
        .where(and(inArray(envelopeMoves.fromEnvelopeId, envIds), lt(budgetMonths.month, month)))
        .groupBy(envelopeMoves.fromEnvelopeId)
    : [];

  const curMovesIn = envIds.length
    ? await db
        .select({ key: envelopeMoves.toEnvelopeId, sum: sql<number>`sum(${envelopeMoves.amount})` })
        .from(envelopeMoves)
        .innerJoin(budgetMonths, eq(budgetMonths.id, envelopeMoves.budgetMonthId))
        .where(and(inArray(envelopeMoves.toEnvelopeId, envIds), eq(budgetMonths.month, month)))
        .groupBy(envelopeMoves.toEnvelopeId)
    : [];

  const curMovesOut = envIds.length
    ? await db
        .select({ key: envelopeMoves.fromEnvelopeId, sum: sql<number>`sum(${envelopeMoves.amount})` })
        .from(envelopeMoves)
        .innerJoin(budgetMonths, eq(budgetMonths.id, envelopeMoves.budgetMonthId))
        .where(and(inArray(envelopeMoves.fromEnvelopeId, envIds), eq(budgetMonths.month, month)))
        .groupBy(envelopeMoves.fromEnvelopeId)
    : [];

  const prevActM = mapSum(prevActivity);
  const curActM = mapSum(curActivity);
  const prevBudM = mapSum(prevBudgeted);
  const curBudM = mapSum(curBudgeted);
  const prevInM = mapSum(prevMovesIn);
  const prevOutM = mapSum(prevMovesOut);
  const curInM = mapSum(curMovesIn);
  const curOutM = mapSum(curMovesOut);

  const envelopeSummaries = envs.map((e) => {
    const availableStart = (prevBudM.get(e.id) ?? 0) + (prevActM.get(e.id) ?? 0) + (prevInM.get(e.id) ?? 0) - (prevOutM.get(e.id) ?? 0);
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

  const summary = {
    month,
    currency: await getBudgetCurrency(db),
    system: { tbbEnvelopeId: tbb[0].id, tbbEnvelopeName: tbb[0].name },
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

  // accounts: balances are all-time sums (not month-bound)
  const txAgg = await db
    .select({
      accountId: transactions.accountId,
      balance: sql<number>`sum(${transactions.amount})`,
      lastPostedAt: sql<string | null>`max(${transactions.postedAt})`,
    })
    .from(transactions)
    .groupBy(transactions.accountId);

  const byAcct = new Map<string, { balance: number; lastPostedAt: string | null }>();
  for (const r of txAgg) byAcct.set(r.accountId, { balance: Number(r.balance ?? 0), lastPostedAt: r.lastPostedAt ?? null });

  const acctBase = await db.select().from(accounts).orderBy(desc(accounts.name));
  const acctRows = acctBase.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    balance: byAcct.get(a.id)?.balance ?? 0,
    lastPostedAt: byAcct.get(a.id)?.lastPostedAt ?? null,
  }));

  return { summary, accounts: acctRows };
}
