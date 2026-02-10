import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AgentResponseCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pixel’s take</CardTitle>
      </CardHeader>
      <CardContent className="text-sm opacity-80">
        (coming soon) — this will be the narrative answer / plan, separate from the data cards.
      </CardContent>
    </Card>
  );
}
