import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ListTodo, ShieldCheck, Award } from "lucide-react";
import type { PerformerScore } from "@/lib/dashboard-metrics";

export function TopPerformerCard({
  label,
  icon,
  performer,
  emptyText = "لا توجد مهام منجزة مستوفية للشروط خلال الفترة",
}: {
  label: string;
  icon: React.ReactNode;
  performer: PerformerScore | null;
  emptyText?: string;
}) {
  const completionRate = performer && performer.totalTasks > 0
    ? Math.round((performer.completedTasks / performer.totalTasks) * 100)
    : 0;

  return (
    <Card className="overflow-hidden border-accent/40 bg-gradient-to-b from-card to-card/90 shadow-xs transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {icon}
            <span>{label}</span>
          </p>
          {performer && (
            <div className="flex items-center gap-1.5">
              {performer.eligible ? (
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-[10px] gap-1 px-1.5 py-0">
                  <ShieldCheck className="size-2.5" /> مستوفٍ للشروط
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {performer.completedTasks >= 1 ? "متقدم" : "قيد الإنجاز"}
                </Badge>
              )}
              <Badge variant="outline" className="font-semibold text-xs">
                {performer.grade}
              </Badge>
            </div>
          )}
        </div>

        {!performer ? (
          <div className="py-4 text-center">
            <p className="text-sm font-medium text-muted-foreground">{emptyText}</p>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              (يعتمد احتساب أفضل موظف ولوحة الشرف حصرياً على إنجاز وجودة المهام)
            </p>
          </div>
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
              <span className="text-xs text-muted-foreground">درجة إنجاز وجودة المهام</span>
            </div>

            <Progress value={performer.score} className="h-2" />

            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/40 p-2 text-center text-[11px]">
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  <span>المنجزة</span>
                </div>
                <span className="font-bold text-foreground">{performer.completedTasks}</span>
              </div>

              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <ListTodo className="size-3 text-primary" />
                  <span>إجمالي المهام</span>
                </div>
                <span className="font-bold text-foreground">{performer.totalTasks}</span>
              </div>

              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Award className="size-3 text-amber-500" />
                  <span>نسبة الإتمام</span>
                </div>
                <span className="font-bold text-foreground">{completionRate}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">
                أنجز {performer.completedTasks} من أصل {performer.totalTasks} مهمة
              </span>
              <span className="text-primary font-medium">معيار المهام فقط ١٠٠٪</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
