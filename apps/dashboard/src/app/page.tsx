import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">agentbudget dashboard (shadcn)</h1>
      <Card>
        <CardHeader>
          <CardTitle>Go</CardTitle>
        </CardHeader>
        <CardContent>
          <Link className="underline" href="/dash">
            Open /dash
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
