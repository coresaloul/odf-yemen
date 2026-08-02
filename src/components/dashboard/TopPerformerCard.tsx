import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { PerformerScore } from "@/lib/dashboard-metrics";

export function TopPerformerCard({
  label,
  icon,
  performer,
  emptyText = "لا توجد بيانات كافية خلال الفترة",
}: {
  label: string;
  icon: React.ReactNode;
  performer: PerformerScore | null;
  emptyText?: string;
}) {
  return (
    <Card className="overflow-hidden border-accent/40">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {icon}
            {label}
          </p>
          {performer && <Badge variant="secondary">{performer.grade}</Badge>}
        </div>

        {!performer ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <>
            <div>
              <p className="font-display text-lg font-bold">{performer.name}</p>
              <p className="truncate text-xs text-muted-foreground">{performer.subtitle}</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="font-display text-3xl font-bold text-primary">
                {performer.score}%
              </span>
              <span className="pb-1 text-xs text-muted-foreground">درجة الأداء</span>
            </div>
            <Progress value={performer.score} />
            <p className="text-xs text-muted-foreground">
              {performer.tasksScore}٪ إنجاز مهام · {performer.attendanceScore}٪ التزام دوام ·{" "}
              {performer.punctualityScore}٪ التزام بالمواعيد
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
