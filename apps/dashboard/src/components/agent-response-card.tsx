import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AgentResponseCard({ text }: { text: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pixel’s take</CardTitle>
      </CardHeader>
      <CardContent className="text-sm whitespace-pre-wrap">
        {text}
      </CardContent>
    </Card>
  );
}
