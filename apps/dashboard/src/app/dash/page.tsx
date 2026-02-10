import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashForm } from "@/components/dash-form";
import { buildLegacyDashUrl } from "@/lib/dash-url";

export default async function DashPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const url = buildLegacyDashUrl({ month, q });

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
        <AlertTitle>Status</AlertTitle>
        <AlertDescription>
          Shadcn UI scaffold is live. Next we’ll render the json-render spec here instead of linking out.
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

      <Card>
        <CardHeader>
          <CardTitle>Open dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm opacity-80">Month: {month ?? "(default)"}</div>
          <div className="text-sm opacity-80">Question: {q ?? "(none)"}</div>
          <Separator />
          <a className="underline" href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
