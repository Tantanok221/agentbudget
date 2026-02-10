import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function fmtMoneyMYR(minor: number) {
  const v = (minor ?? 0) / 100;
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(v);
}

export function OverviewView({ data }: { data: any }) {
  const o = data?.overview;
  const month = data?.month;

  const tbb = Number(o?.budget?.toBeBudgeted?.available ?? 0);
  const netWorth = Number(o?.netWorth?.total ?? 0);
  const liquid = Number(o?.netWorth?.liquid ?? 0);
  const cashflow = o?.reports?.cashflow;
  const income = Number(cashflow?.income ?? 0);
  const expense = Number(cashflow?.expense ?? 0);
  const net = Number(cashflow?.net ?? 0);

  const topEnv = (o?.reports?.topSpending ?? []).slice(0, 5);
  const topPayee = (o?.reports?.topSpendingByPayee ?? []).slice(0, 5);

  const goals = o?.goals;
  const schedules = o?.schedules;
  const accounts = (o?.accounts?.list ?? []).slice().sort((a: any, b: any) => Number(b.balance ?? 0) - Number(a.balance ?? 0)).slice(0, 8);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Snapshot</span>
            <Badge variant="secondary">{month}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="opacity-70">To Be Budgeted</span><span>{fmtMoneyMYR(tbb)}</span></div>
          <div className="flex justify-between"><span className="opacity-70">Net worth</span><span>{fmtMoneyMYR(netWorth)}</span></div>
          <div className="flex justify-between"><span className="opacity-70">Liquid</span><span>{fmtMoneyMYR(liquid)}</span></div>
          <div className="flex justify-between"><span className="opacity-70">Month income</span><span>{fmtMoneyMYR(income)}</span></div>
          <div className="flex justify-between"><span className="opacity-70">Month expense</span><span>{fmtMoneyMYR(expense)}</span></div>
          <div className="flex justify-between"><span className="opacity-70">Month net</span><span>{fmtMoneyMYR(net)}</span></div>
        </CardContent>
      </Card>

      {goals ? (
        <Card>
          <CardHeader>
            <CardTitle>Goals & underfunded</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="opacity-70">Underfunded total</span><span>{fmtMoneyMYR(Number(goals.underfundedTotal ?? 0))}</span></div>
            <div className="font-semibold mt-2">Top underfunded</div>
            <ul className="list-disc pl-5 space-y-1">
              {(goals.topUnderfunded ?? []).slice(0, 5).map((t: any) => (
                <li key={t.envelopeId}>{t.name}: {fmtMoneyMYR(Number(t.underfunded ?? 0))}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Top spending</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
          <div>
            <div className="font-semibold mb-2">By envelope</div>
            <ul className="list-disc pl-5 space-y-1">
              {topEnv.length ? topEnv.map((r: any) => (
                <li key={r.envelopeId}>{r.name}: {fmtMoneyMYR(Number(r.spent ?? 0))}</li>
              )) : <li className="opacity-70">(none)</li>}
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">By payee</div>
            <ul className="list-disc pl-5 space-y-1">
              {topPayee.length ? topPayee.map((r: any, i: number) => (
                <li key={String(r.payeeId ?? i)}>{r.name}: {fmtMoneyMYR(Number(r.spent ?? 0))}</li>
              )) : <li className="opacity-70">(none)</li>}
            </ul>
          </div>
        </CardContent>
      </Card>

      {schedules ? (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming (next 7 days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="opacity-70">Overdue</span><span>{String(schedules?.counts?.overdue ?? 0)}</span></div>
            <div className="flex justify-between"><span className="opacity-70">Due soon</span><span>{String(schedules?.counts?.dueSoon ?? 0)}</span></div>
            <div className="font-semibold mt-2">Top due</div>
            <ul className="list-disc pl-5 space-y-1">
              {(schedules.topDue ?? []).slice(0, 5).map((d: any) => (
                <li key={d.occurrenceId}>{d.name} ({d.date}) — {fmtMoneyMYR(Number(d.amount ?? 0))}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {accounts.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Accounts (top balances)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="list-disc pl-5 space-y-1">
              {accounts.map((a: any) => (
                <li key={a.id}>{a.name} ({a.type}) — {fmtMoneyMYR(Number(a.balance ?? 0))}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
