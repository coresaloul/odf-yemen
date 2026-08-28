import { Link } from "@tanstack/react-router";
import {
  Users,
  CheckCircle2,
  CalendarDays,
  ListChecks,
  Trophy,
  ClipboardCheck,
  ChevronLeft,
  CalendarClock,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TopPerformerCard } from "@/components/dashboard/TopPerformerCard";
import { LeaderboardTable } from "@/components/dashboard/LeaderboardTable";
import { DistributionCard } from "@/components/dashboard/DistributionCard";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { rank } from "@/lib/dashboard-metrics";
import { formatDate, PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/hr";
import type { PerformerScore } from "@/lib/dashboard-metrics";
import type { EmployeeLite } from "@/hooks/useAuth";

type ManagerDashboardProps = {
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
  employeeScores: PerformerScore[];
  sectionScores: PerformerScore[];
  topEmployee: PerformerScore | null;
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

export function ManagerDashboardView({
  employee,
  summary,
  employeeScores,
  sectionScores,
  topEmployee,
  recentTasks,
  pendingLeaves,
  pendingEvaluations,
}: ManagerDashboardProps) {
  const totalEmployees = summary?.totalEmployees ?? 0;
  const completed = summary?.completedPeriodTasks ?? 0;
  const totalPeriodTasks = summary?.totalPeriodTasks ?? 0;
  const overdue = summary?.overdueTasks ?? 0;
  const dueSoon = summary?.dueSoonTasks ?? 0;
  const rate = summary?.completionRate ?? 0;
  const avgCompliance = summary?.avgCompliance ?? 0;

  const totalToday =
    (summary?.todayPresent ?? 0) +
    (summary?.todayLate ?? 0) +
    (summary?.todayLeave ?? 0) +
    (summary?.todayAbsent ?? 0);

  const attendanceSlices = [
    { label: "حاضر في الموعد", value: summary?.todayPresent ?? 0, className: "bg-primary" },
    { label: "متأخر", value: summary?.todayLate ?? 0, className: "bg-amber-500" },
    { label: "إجازة / إذن", value: summary?.todayLeave ?? 0, className: "bg-muted-foreground/50" },
    { label: "غائب", value: summary?.todayAbsent ?? 0, className: "bg-destructive" },
  ];

  return (
    <div className="space-y-6">
      {/* بطاقة رأس لوحة المدير */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-primary/90 p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-200 backdrop-blur-md">
              <Building2 className="size-3.5 text-blue-300" />
              <span>لوحة إشراف الفريق والإدارة</span>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              إدارة الفريق — {employee?.full_name ?? "المدير"}
            </h2>
            <p className="text-sm text-slate-300">
              متابعة حضور وإنتاجية موظفي إدارتك، واعتماد الإجازات والتقييمات وتكليف المهام
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
              <Link to="/approvals">
                <ClipboardCheck className="size-4" />
                <span>مركز الموافقات</span>
                {pendingLeaves.length + pendingEvaluations.length > 0 && (
                  <Badge variant="secondary" className="mr-1 size-5 rounded-full p-0 text-center font-mono text-[10px]">
                    {pendingLeaves.length + pendingEvaluations.length}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20">
              <Link to="/tasks">
                <ListChecks className="size-4" />
                <span>تكليف مهمة للفريق</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* المؤشرات السريعة للفريق */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">موظفو الفريق</p>
              <Users className="size-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {totalEmployees}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">على رأس العمل</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">نسبة إنجاز مهام الفريق</p>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 sm:text-3xl">
              {rate}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {completed} من {totalPeriodTasks} مهمة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">انضباط الفريق بالدوام</p>
              <CalendarClock className="size-4 text-blue-500" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-blue-600 dark:text-blue-400 sm:text-3xl">
              {avgCompliance}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">معدل التزام الفترة</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">مهام متأخرة بالفريق</p>
              <AlertTriangle className="size-4 text-destructive" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-destructive sm:text-3xl">
              {overdue}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              مستحقة قريباً: {dueSoon}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* لوحة شرف الفريق وتوزيع الحضور */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <TopPerformerCard
            label="أفضل موظف في الفريق"
            icon={<Trophy className="size-4 text-amber-500" />}
            performer={topEmployee}
            emptyText="لا توجد بيانات كافية للفريق خلال الفترة"
          />
        </div>

        <div className="lg:col-span-2">
          <DistributionCard
            title="حضور فريق العمل اليوم"
            total={totalToday}
            slices={attendanceSlices}
            footer={totalToday === 0 ? "لم تسجل سجلات حضور اليوم بعد." : undefined}
          />
        </div>
      </div>

      {/* جدول ترتيب الفريق والتنبيهات */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeaderboardTable
            title="ترتيب أداء موظفي الفريق"
            entityLabel="الموظف"
            rows={rank(employeeScores)}
            limit={6}
          />
        </div>

        <div className="lg:col-span-1">
          <AttentionList
            items={[
              {
                label: "طلبات إجازة بانتظار اعتمادك",
                count: pendingLeaves.length,
                to: "/approvals",
                tone: pendingLeaves.length > 0 ? "warning" : "default",
              },
              {
                label: "تقييمات ضمن مرحلة اعتمادك",
                count: pendingEvaluations.length,
                to: "/evaluations",
              },
              {
                label: "مهام متأخرة عن موعدها بالفريق",
                count: overdue,
                to: "/tasks",
                tone: "danger",
              },
            ]}
          />
        </div>
      </div>

      {/* أحدث مهام الفريق */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">أحدث مهام فريق العمل</CardTitle>
            <CardDescription className="text-xs">
              متابعة تقدم التكليفات والمهام النشطة بإدارتك
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
            <Link to="/tasks">
              <span>إدارة كافة المهام</span>
              <ChevronLeft className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentTasks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <ListChecks className="mx-auto size-8 opacity-40" />
              <p className="mt-2 text-sm font-medium">لا توجد مهام لفريق العمل حالياً</p>
            </div>
          ) : (
            recentTasks.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    الاستحقاق: {formatDate(t.due_date)} · التقدم: {t.progress ?? 0}%
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
