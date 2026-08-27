import { Card, CardContent } from "@/components/ui/card";

interface TaskStatsProps {
  total: number;
  running: number;
  done: number;
  late: number;
  avg: number;
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "danger";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${tone === "danger" ? "text-destructive" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function TaskStats({ total, running, done, late, avg }: TaskStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="إجمالي المهام" value={total} />
      <StatCard label="قيد التنفيذ" value={running} />
      <StatCard label="منجزة" value={done} />
      <StatCard label="متأخرة" value={late} tone="danger" />
      <StatCard label="متوسط الإنجاز" value={`${avg}%`} />
    </div>
  );
}
