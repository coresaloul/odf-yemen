import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type AttentionItem = {
  label: string;
  count: number;
  to: string;
  tone?: "danger" | "warning" | "default";
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  const active = items.filter((i) => i.count > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">تحتاج انتباهك</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد بنود عالقة — كل شيء على ما يرام.</p>
        )}
        {active.map((i) => (
          <Link
            key={i.label}
            to={i.to}
            className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <span className="text-sm">{i.label}</span>
            <Badge variant={i.tone === "danger" ? "destructive" : "secondary"}>{i.count}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
