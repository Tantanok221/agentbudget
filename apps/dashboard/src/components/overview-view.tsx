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
    </div>
  );
}
