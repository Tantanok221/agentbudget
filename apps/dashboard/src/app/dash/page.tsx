import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashForm } from "@/components/dash-form";
import { OverviewView } from "@/components/overview-view";
import { AgentResponseCard } from "@/components/agent-response-card";

function currentMonthKL(): string {
  const tz = "Asia/Kuala_Lumpur";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  if (!y || !m) throw new Error("Failed to compute current month");
  return `${y}-${m}`;
}

export default async function DashPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : currentMonthKL();
  const q = typeof sp.q === "string" ? sp.q : "";

  const res = await fetch(`http://127.0.0.1:8790/api/overview?month=${encodeURIComponent(month)}`, {
    cache: "no-store",
  });
  const data = await res.json();

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">agentbudget dashboard</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link className="text-sm underline opacity-80 hover:opacity-100" href="/">
            home
          </Link>
        </div>
      </div>

      <Alert>
        <AlertTitle>Mode</AlertTitle>
        <AlertDescription>
          Next.js-only now. No legacy server.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Question</CardTitle>
        </CardHeader>
        <CardContent>
          <DashForm />
        </CardContent>
      </Card>

      {data?.ok ? (
        <>
          {q ? (
            <Alert>
              <AlertTitle>Question</AlertTitle>
              <AlertDescription>{q}</AlertDescription>
            </Alert>
          ) : null}
          <OverviewView data={data} />
          <AgentResponseCard />
        </>
      ) : (
        <Alert>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{String(data?.error ?? "Unknown error")}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
