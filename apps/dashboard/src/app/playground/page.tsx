import { JsonUI } from "@/jsonui/registry";
import { buildSummarySpec } from "@/jsonui/spec-builders/summary";

export default function PlaygroundPage() {
  const spec = buildSummarySpec({
    title: "UI Playground",
    subtitle: "json-render + shadcn component catalog",
    month: "2026-02",
    question: "How do I finance a MacBook purchase?",
    adviceText: "This is a placeholder narrative. The point is the layout is driven by a JSON spec, not hardcoded JSX.",
    overview: {
      budget: { toBeBudgeted: { available: 0 } },
      netWorth: { liquid: 213420, total: 213420 },
      reports: { cashflow: { income: 215310, expense: 1890, net: 213420 } },
    },
  });

  return <JsonUI spec={spec} />;
}
