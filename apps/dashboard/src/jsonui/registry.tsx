"use client";

import * as React from "react";
import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react";
import { uiCatalog } from "./catalog";
import { Card as SCard, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function toneToAlertVariant(tone: string) {
  // shadcn Alert has no variants by default; keep it minimal.
  return tone;
}

function toneToBadgeVariant(tone: string): any {
  // Use secondary for neutral; destructive for bad; outline for others.
  if (tone === "bad") return "destructive";
  if (tone === "neutral") return "secondary";
  return "outline";
}

function toneClass(tone: string) {
  if (tone === "good") return "text-emerald-600";
  if (tone === "warn") return "text-amber-600";
  if (tone === "bad") return "text-red-600";
  return "";
}

export const { registry } = defineRegistry(uiCatalog, {
  components: {
    Page: ({ props, children }) => (
      <div className="mx-auto max-w-3xl p-6 space-y-3">
        {props.title ? <h1 className="text-2xl font-bold leading-none">{props.title}</h1> : null}
        {props.subtitle ? <p className="text-sm opacity-70">{props.subtitle}</p> : null}
        {children}
      </div>
    ),
    Section: ({ props }) => (
      <div className="pt-2">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{props.title}</div>
        {props.description ? <div className="text-sm opacity-70 mt-1">{props.description}</div> : null}
      </div>
    ),
    Card: ({ props, children }) => (
      <SCard>
        {(props.title || props.description) ? (
          <CardHeader className="py-3">
            {props.title ? <CardTitle>{props.title}</CardTitle> : null}
            {props.description ? <CardDescription>{props.description}</CardDescription> : null}
          </CardHeader>
        ) : null}
        <CardContent className={(props.title || props.description) ? "pt-0 pb-3" : "py-3"}>{children}</CardContent>
      </SCard>
    ),
    Callout: ({ props }) => (
      <Alert className="py-3">
        {props.title ? <AlertTitle>{props.title}</AlertTitle> : null}
        <AlertDescription className="whitespace-pre-wrap">{props.message}</AlertDescription>
      </Alert>
    ),
    Badge: ({ props }) => (
      <Badge variant={toneToBadgeVariant(props.tone)}>{props.text}</Badge>
    ),
    MetricRow: ({ props }) => (
      <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
        <div className="min-w-0">
          <div className="truncate opacity-70">{props.label}</div>
          {props.hint ? <div className="text-xs opacity-60 truncate">{props.hint}</div> : null}
        </div>
        <div className={"font-medium " + toneClass(props.tone)}>{props.value}</div>
      </div>
    ),
    List: ({ props }) => (
      <div className="text-sm">
        {props.title ? <div className="font-semibold mb-2">{props.title}</div> : null}
        <ul className="list-disc pl-5 space-y-1">
          {props.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      </div>
    ),
    Divider: () => <Separator />,
  },
});

export function JsonUI({ spec }: { spec: any }) {
  return (
    <JSONUIProvider registry={registry} initialState={{}}>
      <Renderer spec={spec} registry={registry} />
    </JSONUIProvider>
  );
}
