import { Link } from "@tanstack/react-router";
import {
  Award,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  ListChecks,
  Sparkles,
  TrendingUp,
  AlertCircle,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/attendance";
import { formatDate, PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/hr";
import type { PerformerScore } from "@/lib/dashboard-metrics";
import type { EmployeeLite } from "@/hooks/useAuth";

type EmployeeDashboardProps = {
  employee: EmployeeLite;
  summary: {
    totalEmployees: number;
    totalPeriodTasks: number;
    completedPeriodTasks: number;
    inProgressPeriodTasks: number;
    newPeriodTasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
    completionRate: number;
    avgCompliance: number;
    todayPresent: number;
    todayLate: number;
    todayLeave: number;
    todayAbsent: number;
  } | undefined;
  myScore: PerformerScore | null;
  myRank: number;
  totalRanked: number;
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    progress: number | null;
    due_date: string | null;
    created_at: string;
  }>;
  pendingLeaves: Array<{ id: string; stage: string; start_date: string; end_date: string; employee_name: string }>;
  pendingEvaluations: Array<{ id: string; approval_stage: string; employee_name: string }>;
};

export function EmployeeDashboardView({
  employee,
  summary,
  myScore,
  myRank,
  totalRanked,
  recentTasks,
  pendingLeaves,
  pendingEvaluations,
}: EmployeeDashboardProps) {
  const completed = summary?.completedPeriodTasks ?? 0;
  const totalPeriodTasks = summary?.totalPeriodTasks ?? 0;
  const overdue = summary?.overdueTasks ?? 0;
  const dueSoon = summary?.dueSoonTasks ?? 0;
  const rate = summary?.completionRate ?? 0;
  const compliance = summary?.avgCompliance ?? 100;

  return (
    <div className="space-y-6">
      {/* بطاقة الترحيب والتحفيز */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/90 via-primary to-primary/80 p-6 text-primary-foreground shadow-md">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-md">
              <Sparkles className="size-3.5 text-amber-300" />
              <span>مساحة العمل الشخصية</span>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              أهلاً بك، {employee?.full_name ?? "الموظف"}
            </h2>
            <p className="text-sm text-primary-foreground/80">
              {employee?.job_title ? `${employee.job_title} — ` : ""}
              متابعة يومية فورية لمهامك، دوامك، إجازاتك وقسائم رواتبك
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm" className="gap-1.5 shadow-xs">
              <Link to="/tasks">
                <ListChecks className="size-4" />
                <span>مهامي اليومية</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Link to="/leaves">
                <CalendarDays className="size-4" />
                <span>طلب إجازة</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* زخرفة خلفية هندسية ناعمة */}
        <div className="pointer-events-none absolute -left-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 right-1/4 size-40 rounded-full bg-accent/20 blur-xl" />
      </div>

      {/* المؤشرات الرئيسية للموظف */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="border-border/60 transition-all hover:shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">مهامي في الفترة</p>
              <ListChecks className="size-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {totalPeriodTasks}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>المنجزة: {completed}</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{rate}% إنجاز</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 transition-all hover:shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">التزامي بالدوام</p>
              <CalendarClock className="size-4 text-emerald-500" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 sm:text-3xl">
              {compliance}%
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>أيام الحضور: {myScore?.presentDays ?? 0}</span>
              <span>تأخير: {formatMinutes(myScore?.lateMinutes ?? 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 transition-all hover:shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">الترتيب بين الزملاء</p>
              <Award className="size-4 text-amber-500" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-amber-600 dark:text-amber-400 sm:text-3xl">
              {myRank > 0 ? `#${myRank}` : "—"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              من أصل {totalRanked > 0 ? totalRanked : "—"} موظف
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 transition-all hover:shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">مهام تستحق قريباً</p>
              <Clock className="size-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {dueSoon}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              خلال الـ ٧ أيام القادمة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* قسم الأداء الشخصي ونسبة الإنجاز */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* تفصيل درجة الأداء */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">تقييم أدائي العام</CardTitle>
              {myScore && <Badge variant="secondary">{myScore.grade}</Badge>}
            </div>
            <CardDescription className="text-xs">
              مؤشر مجمع لإنجاز المهام والالتزام بالمواعيد والدوام
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-extrabold text-primary">
                {myScore?.score ?? 0}%
              </span>
              <span className="text-xs text-muted-foreground">الدرجة الإجمالية</span>
            </div>
            <Progress value={myScore?.score ?? 0} className="h-2.5" />

            <div className="space-y-2.5 pt-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">إنجاز المهام (٤٠٪):</span>
                <span className="font-semibold">{myScore?.tasksScore ?? 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">الانضباط والدوام (٣٠٪):</span>
                <span className="font-semibold">{myScore?.attendanceScore ?? 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">الالتزام بالمواعيد (٣٠٪):</span>
                <span className="font-semibold">{myScore?.punctualityScore ?? 0}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* تنبيهات تحتاج انتباهك */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">تنبيهات وإشعارات شخصية</CardTitle>
            <CardDescription className="text-xs">
              المهام والطلبات التي تتطلب متابعتك الحالية
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {overdue > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>لديك {overdue} مهمة تجاوزت تاريخ الاستحقاق</span>
                </div>
                <Button asChild size="sm" variant="destructive">
                  <Link to="/tasks">عرض المهام</Link>
                </Button>
              </div>
            )}

            {pendingLeaves.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 shrink-0 text-primary" />
                  <span>لديك {pendingLeaves.length} طلب إجازة قيد المراجعة والاعتماد</span>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/leaves">متابعة الإجازات</Link>
                </Button>
              </div>
            )}

            {pendingEvaluations.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Award className="size-4 shrink-0 text-amber-500" />
                  <span>تقييم أداء جديد بانتظار استكمال مراحله أو اطلاعك</span>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/evaluations">عرض التقييم</Link>
                </Button>
              </div>
            )}

            {overdue === 0 && pendingLeaves.length === 0 && pendingEvaluations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                <CheckCircle2 className="size-8 text-emerald-500" />
                <p className="mt-2 text-sm font-medium">كل شيء على ما يرام!</p>
                <p className="text-xs">لا توجد تنبيهات معلقة أو مهام متأخرة حالياً.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* أحدث المهام المسندة إليك */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">مهامي الحالية</CardTitle>
            <CardDescription className="text-xs">
              أحدث التكليفات المسندة إليك لمتابعة إنجازها
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
            <Link to="/tasks">
              <span>عرض كل المهام</span>
              <ChevronLeft className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentTasks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="mx-auto size-8 opacity-40" />
              <p className="mt-2 text-sm font-medium">لا توجد مهام مسندة إليك بعد</p>
            </div>
          ) : (
            recentTasks.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    الاستحقاق: {formatDate(t.due_date)} · نسبة الإنجاز: {t.progress ?? 0}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{PRIORITY_LABELS[t.priority] ?? t.priority}</Badge>
                  <Badge variant={t.status === "completed" ? "default" : "secondary"}>
                    {TASK_STATUS_LABELS[t.status] ?? t.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
