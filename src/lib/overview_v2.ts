import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { accounts, envelopes, scheduledPostings, scheduledTransactions, targets, transactionSplits, transactions } from '../db/schema.js';
import { parseMonthStrict } from './month.js';
import { generateDailyOccurrences, generateMonthlyOccurrences, generateWeeklyOccurrences, generateYearlyOccurrences, parseIsoDateOnly, fmtIsoDateOnly } from './schedule_rules.js';
import { computeUnderfunded } from './targets.js';
import { getMonthSummaryData } from './overview_impl.js';

function todayLocalIsoDateOnly(tz: string): string {
  const override = process.env.AGENTBUDGET_TODAY;
  if (override) {
    parseIsoDateOnly(override);
    return override;
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !d) throw new Error('Failed to compute local date');
  return `${y}-${m}-${d}`;
}

function addDaysIsoDateOnly(iso: string, days: number): string {
  const { y, m, d } = parseIsoDateOnly(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return fmtIsoDateOnly(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

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

  // Schedules window is based on local date (not UTC).
  const tz = 'Asia/Kuala_Lumpur';
  const scheduleFrom = todayLocalIsoDateOnly(tz);
  const scheduleTo = addDaysIsoDateOnly(scheduleFrom, 7);

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

  // Top spending by payee (outflows only, exclude transfers, budget accounts only)
  const payeeSpendRows = await db
    .select({ payeeId: transactions.payeeId, payeeName: transactions.payeeName, sum: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        gte(transactions.postedAt, startIso),
        lt(transactions.postedAt, endIso),
        sql`${transactions.transferGroupId} is null`,
        inArray(accounts.type, ['checking', 'savings', 'cash']),
      ),
    )
    .groupBy(transactions.payeeId, transactions.payeeName);

  const topSpendingByPayee = payeeSpendRows
    .map((r) => {
      const sum = Number(r.sum ?? 0);
      const spent = sum < 0 ? -sum : 0;
      const name = r.payeeName ?? '(no payee)';
      return { payeeId: r.payeeId ?? null, name, spent };
    })
    .filter((r) => r.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  // Schedules summary (unposted occurrences up to scheduleTo)
  const schedRows = await db
    .select()
    .from(scheduledTransactions)
    .where(eq(scheduledTransactions.archived, false));

  const topDueAll: any[] = [];
  let overdue = 0;
  let dueSoon = 0;

  for (const s of schedRows) {
    const rule = JSON.parse(s.ruleJson) as any;
    const clampTo = s.endDate && s.endDate < scheduleTo ? s.endDate : scheduleTo;
    if (clampTo < s.startDate) continue;

    let dates: string[] = [];
    if (rule.freq === 'daily') dates = generateDailyOccurrences(s.startDate, rule.interval, s.startDate, clampTo);
    else if (rule.freq === 'weekly') dates = generateWeeklyOccurrences(s.startDate, rule.weekdays, rule.interval, s.startDate, clampTo);
    else if (rule.freq === 'monthly') dates = generateMonthlyOccurrences(s.startDate, rule.monthDay, rule.interval, s.startDate, clampTo);
    else if (rule.freq === 'yearly') dates = generateYearlyOccurrences(s.startDate, rule.month, rule.monthDay, rule.interval, s.startDate, clampTo);

    if (!dates.length) continue;

    const posted = await db
      .select({ occurrenceDate: scheduledPostings.occurrenceDate })
      .from(scheduledPostings)
      .where(and(eq(scheduledPostings.scheduledId, s.id), inArray(scheduledPostings.occurrenceDate, dates)));
    const postedSet = new Set(posted.map((p) => p.occurrenceDate));

    for (const d of dates) {
      if (postedSet.has(d)) continue;
      if (d < scheduleFrom) overdue += 1;
      else dueSoon += 1;
      topDueAll.push({
        occurrenceId: `occ_${s.id}_${d}`,
        scheduledId: s.id,
        date: d,
        name: s.name,
        amount: Number(s.amount),
        accountId: s.accountId,
        envelopeId: s.envelopeId,
        payeeName: s.payeeName,
      });
    }
  }

  topDueAll.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const topDue = topDueAll.slice(0, 5);

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
    schedules: {
      window: { from: scheduleFrom, to: scheduleTo },
      counts: { overdue, dueSoon },
      topDue,
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
      topSpendingByPayee,
    },
    warnings: summary.warnings,
  };
}
