import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cardContentClass, cardHeaderClass } from "@/lib/ui-density";

export function AgentResponseCard({ text }: { text: string }) {
  return (
    <Card>
      <CardHeader className={cardHeaderClass}>
        <CardTitle>Pixel’s take</CardTitle>
      </CardHeader>
      <CardContent className={`${cardContentClass} text-sm whitespace-pre-wrap`}>
        {text}
      </CardContent>
    </Card>
  );
}
