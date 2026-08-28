import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, CalendarCheck } from "lucide-react";
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
    <Card className="overflow-hidden border-accent/40 bg-gradient-to-b from-card to-card/90 shadow-xs transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {icon}
            <span>{label}</span>
          </p>
          {performer && (
            <Badge variant="secondary" className="font-semibold">
              {performer.grade}
            </Badge>
          )}
        </div>

        {!performer ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <>
            <div>
              <p className="font-display text-base font-bold text-foreground sm:text-lg">{performer.name}</p>
              <p className="truncate text-xs text-muted-foreground">{performer.subtitle}</p>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold text-primary sm:text-4xl">
                {performer.score}%
              </span>
              <span className="text-xs text-muted-foreground">درجة التميز المجمعة</span>
            </div>

            <Progress value={performer.score} className="h-2" />

            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/40 p-2 text-center text-[11px]">
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <CheckCircle2 className="size-3 text-primary" />
                  <span>المهام</span>
                </div>
                <span className="font-bold text-foreground">{performer.tasksScore}%</span>
              </div>

              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <CalendarCheck className="size-3 text-emerald-500" />
                  <span>الدوام</span>
                </div>
                <span className="font-bold text-foreground">{performer.attendanceScore}%</span>
              </div>

              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Clock className="size-3 text-amber-500" />
                  <span>المواعيد</span>
                </div>
                <span className="font-bold text-foreground">{performer.punctualityScore}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>أنجز {performer.completedTasks} من {performer.totalTasks} مهمة</span>
              <span>حضور {performer.presentDays} يوم</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
