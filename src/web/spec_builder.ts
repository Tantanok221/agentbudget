import { flatToTree } from '@json-render/react';
import { fmtMoneyMYR, fmtMonthLabel } from './format.js';

function toneForTbb(tbbMinor: number): 'good' | 'warn' | 'bad' | 'neutral' {
  if (tbbMinor < 0) return 'bad';
  if (tbbMinor === 0) return 'warn';
  return 'good';
}

type FlatEl = { key: string; parentKey?: string; type: string; props: any; visible?: any };

export function buildOverviewSpec(params: {
  title: string;
  month: string;
  overview: any;
  question?: string;
}) {
  const { title, month, overview, question } = params;

  const tbb = Number(overview?.budget?.toBeBudgeted?.available ?? 0);
  const cashflow = overview?.reports?.cashflow;
  const topEnv = overview?.reports?.topSpending ?? [];
  const topPayee = overview?.reports?.topSpendingByPayee ?? [];
  const accounts = overview?.accounts?.list ?? [];
  const goals = overview?.goals;
  const schedules = overview?.schedules;

  const els: FlatEl[] = [];

  // Root page
  els.push({ key: 'page', type: 'Page', props: { title } });

  // Optional question card
  if (question) {
    els.push({ key: 'q', parentKey: 'page', type: 'Alert', props: { tone: 'info', title: 'Question', message: question } });
  }

  // Snapshot card
  els.push({ key: 'snap', parentKey: 'page', type: 'Card', props: { title: `Snapshot — ${fmtMonthLabel(month)}` } });
  els.push({ key: 'snap_tbb', parentKey: 'snap', type: 'Metric', props: { label: 'To Be Budgeted', value: fmtMoneyMYR(tbb), tone: toneForTbb(tbb) } });
  els.push({ key: 'snap_nw', parentKey: 'snap', type: 'Metric', props: { label: 'Net worth (total)', value: fmtMoneyMYR(Number(overview?.netWorth?.total ?? 0)) } });
  els.push({ key: 'snap_liq', parentKey: 'snap', type: 'Metric', props: { label: 'Liquid', value: fmtMoneyMYR(Number(overview?.netWorth?.liquid ?? 0)) } });
  els.push({ key: 'snap_inc', parentKey: 'snap', type: 'Metric', props: { label: 'Month income', value: fmtMoneyMYR(Number(cashflow?.income ?? 0)) } });
  els.push({ key: 'snap_exp', parentKey: 'snap', type: 'Metric', props: { label: 'Month expense', value: fmtMoneyMYR(Number(cashflow?.expense ?? 0)) } });
  els.push({ key: 'snap_net', parentKey: 'snap', type: 'Metric', props: { label: 'Month net', value: fmtMoneyMYR(Number(cashflow?.net ?? 0)), tone: Number(cashflow?.net ?? 0) >= 0 ? 'good' : 'bad' } });

  // Goals / underfunded
  if (goals) {
    const under = Number(goals?.underfundedTotal ?? 0);
    const top = (goals?.topUnderfunded ?? []).slice(0, 5);

    els.push({ key: 'goals', parentKey: 'page', type: 'Card', props: { title: 'Goals & underfunded' } });
    els.push({ key: 'goals_total', parentKey: 'goals', type: 'Metric', props: { label: 'Underfunded total', value: fmtMoneyMYR(under), tone: under > 0 ? 'warn' : 'good' } });

    if (top.length) {
      els.push({
        key: 'goals_list',
        parentKey: 'goals',
        type: 'List',
        props: { title: 'Top underfunded', items: top.map((t: any) => `${t.name}: ${fmtMoneyMYR(Number(t.underfunded ?? 0))}`) },
      });
    } else {
      els.push({
        key: 'goals_ok',
        parentKey: 'goals',
        type: 'Alert',
        props: { tone: 'good', message: 'No underfunded targets detected. You’re either disciplined… or you haven’t set targets yet.' },
      });
    }
  }

  // Top spending
  els.push({ key: 'spend', parentKey: 'page', type: 'Card', props: { title: 'Top spending (month)' } });
  if (topEnv?.length) {
    els.push({ key: 'spend_env', parentKey: 'spend', type: 'List', props: { title: 'By envelope', items: topEnv.map((r: any) => `${r.name}: ${fmtMoneyMYR(Number(r.spent ?? 0))}`) } });
  } else {
    els.push({ key: 'spend_none', parentKey: 'spend', type: 'Alert', props: { tone: 'info', message: 'No spending data found for this month (or everything is transfers / tracking).' } });
  }
  if (topPayee?.length) {
    els.push({ key: 'spend_payee', parentKey: 'spend', type: 'List', props: { title: 'By payee', items: topPayee.map((r: any) => `${r.name}: ${fmtMoneyMYR(Number(r.spent ?? 0))}`) } });
  }

  // Upcoming schedules
  if (schedules) {
    const counts = schedules?.counts ?? {};
    const topDue = schedules?.topDue ?? [];

    els.push({ key: 'sched', parentKey: 'page', type: 'Card', props: { title: 'Upcoming (next 7 days)' } });
    els.push({ key: 'sched_od', parentKey: 'sched', type: 'Metric', props: { label: 'Overdue', value: String(counts.overdue ?? 0), tone: (counts.overdue ?? 0) > 0 ? 'bad' : 'neutral' } });
    els.push({ key: 'sched_ds', parentKey: 'sched', type: 'Metric', props: { label: 'Due soon', value: String(counts.dueSoon ?? 0), tone: (counts.dueSoon ?? 0) > 0 ? 'warn' : 'neutral' } });

    if (topDue.length) {
      els.push({ key: 'sched_list', parentKey: 'sched', type: 'List', props: { title: 'Top due', items: topDue.map((d: any) => `${d.name} (${d.date}) — ${fmtMoneyMYR(Number(d.amount ?? 0))}`) } });
    } else {
      els.push({ key: 'sched_ok', parentKey: 'sched', type: 'Alert', props: { tone: 'good', message: 'Nothing due soon. Peace, briefly.' } });
    }
  }

  // Accounts
  if (accounts?.length) {
    const top = accounts
      .slice()
      .sort((a: any, b: any) => Number(b.balance ?? 0) - Number(a.balance ?? 0))
      .slice(0, 8);

    els.push({ key: 'accts', parentKey: 'page', type: 'Card', props: { title: 'Accounts (top balances)' } });
    els.push({ key: 'accts_list', parentKey: 'accts', type: 'List', props: { items: top.map((a: any) => `${a.name} (${a.type}) — ${fmtMoneyMYR(Number(a.balance ?? 0))}`) } });
  }

  return flatToTree(els as any);
}
