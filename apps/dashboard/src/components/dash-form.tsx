"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DashForm() {
  const router = useRouter();
  const sp = useSearchParams();

  const [month, setMonth] = React.useState(sp.get("month") ?? "");
  const [q, setQ] = React.useState(sp.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (month.trim()) url.searchParams.set("month", month.trim());
    else url.searchParams.delete("month");
    if (q.trim()) url.searchParams.set("q", q.trim());
    else url.searchParams.delete("q");
    router.push(url.pathname + "?" + url.searchParams.toString());
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="month">
          Month (YYYY-MM)
        </label>
        <input
          id="month"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          placeholder="2026-02"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="q">
          Question
        </label>
        <input
          id="q"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          placeholder="how to finance macbook purchase"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit">Update</Button>
        <Button type="button" variant="outline" onClick={() => {
          setMonth("");
          setQ("");
          router.push("/dash");
        }}>
          Reset
        </Button>
      </div>
    </form>
  );
}
