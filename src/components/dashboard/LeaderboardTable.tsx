import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PerformerScore } from "@/lib/dashboard-metrics";

export function LeaderboardTable({
  title,
  entityLabel,
  rows,
  limit = 5,
}: {
  title: string;
  entityLabel: string;
  rows: PerformerScore[];
  limit?: number;
}) {
  const shown = rows.slice(0, limit);

  const rankBadge = (index: number) => {
    if (index === 0) {
      return (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 font-bold text-xs" title="المركز الأول">
          🥇
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-slate-500/20 text-slate-600 font-bold text-xs" title="المركز الثاني">
          🥈
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-700/20 text-amber-800 font-bold text-xs" title="المركز الثالث">
          🥉
        </span>
      );
    }
    return <span className="font-semibold text-xs text-muted-foreground">{index + 1}</span>;
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <span className="text-xs text-muted-foreground">أفضل {shown.length}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">لا توجد بيانات كافية خلال الفترة.</p>
        ) : (
          <>
            {/* عرض بطاقات أنيقة على الموبايل */}
            <div className="divide-y border-t sm:hidden">
              {shown.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3.5 hover:bg-muted/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">{rankBadge(i)}</div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-sm text-foreground">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.completedTasks} من {r.totalTasks} مهمة منجزة
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-display font-bold text-primary text-base">{r.score}%</span>
                    <Badge variant={i === 0 ? "default" : "secondary"} className="text-[10px] py-0 px-1.5">
                      {r.grade}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* عرض الجدول للشاشات المتوسطة والكبيرة */}
            <div className="hidden sm:block touch-scroll overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12 text-center">الترتيب</TableHead>
                    <TableHead>{entityLabel}</TableHead>
                    <TableHead className="text-center">المهام (المنجزة / الإجمالي)</TableHead>
                    <TableHead className="text-center">نسبة الإتمام</TableHead>
                    <TableHead className="text-center">درجة المهام والإنتاجية</TableHead>
                    <TableHead className="text-center">التقدير</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r, i) => {
                    const completionPct = r.totalTasks > 0
                      ? Math.round((r.completedTasks / r.totalTasks) * 100)
                      : 0;

                    return (
                      <TableRow key={r.id} className="hover:bg-muted/30">
                        <TableCell className="text-center">{rankBadge(i)}</TableCell>
                        <TableCell>
                          <p className="font-semibold text-foreground">{r.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{r.completedTasks}</span> / {r.totalTasks}
                        </TableCell>
                        <TableCell className="text-center font-medium">{completionPct}%</TableCell>
                        <TableCell className="text-center font-bold text-primary text-base">
                          {r.score}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={i === 0 ? "default" : "outline"} className="font-medium">
                            {r.grade}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
