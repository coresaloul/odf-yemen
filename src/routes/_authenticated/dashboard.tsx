import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Building2,
  ClipboardList,
  Layers,
  Trophy,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ListSkeleton } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { TopPerformerCard } from "@/components/dashboard/TopPerformerCard";
import { LeaderboardTable } from "@/components/dashboard/LeaderboardTable";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { DistributionCard } from "@/components/dashboard/DistributionCard";
import { formatMinutes } from "@/lib/attendance";
import { rank, topOf, type PerformerScore } from "@/lib/dashboard-metrics";
import {
  formatDate,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  periodRange,
  type PeriodKey,
} from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة المعلومات | الموارد البشرية" },
      {
        name: "description",
        content:
          "لوحة قيادة لأداء مؤسسة اليتيم التنموية: أفضل موظف وأفضل إدارة وقسم، الحضور، المهام والتنبيهات.",
      },
      { property: "og:title", content: "لوحة المعلومات | الموارد البشرية" },
      {
        property: "og:description",
        content: "لوحة شرف الأداء ومؤشرات المهام والدوام والتنبيهات لحظياً.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "daily", label: "اليوم" },
  { key: "weekly", label: "أسبوعي" },
  { key: "monthly", label: "شهري" },
  { key: "quarterly", label: "ربع سنوي" },
];

type DashboardAnalyticsPayload = {
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
  };
  employeeScores: PerformerScore[];
  deptScores: PerformerScore[];
  sectionScores: PerformerScore[];
  expiringDocs: Array<{ id: string; title: string; expiry_date: string; employee_name: string }>;
  pendingLeaves: Array<{ id: string; stage: string; start_date: string; end_date: string; employee_name: string }>;
  pendingEvaluations: Array<{ id: string; approval_stage: string; employee_name: string }>;
};

function Dashboard() {
  const { employee, isDirector, isHR, isManager } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const range = useMemo(() => periodRange(period), [period]);
  const orgWide = isDirector || isHR;

  // ──── استعلام RPC فائق السرعة لقاعدة البيانات ────
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["dashboard-analytics-rpc", range.start, range.end, orgWide, isManager, employee?.id, employee?.department_id],
    queryFn: async (): Promise<DashboardAnalyticsPayload> => {
      const { data, error } = await supabase.rpc("get_dashboard_analytics", {
        p_start_date: range.start,
        p_end_date: range.end,
        p_scope_emp_id: (!orgWide && !isManager) ? (employee?.id ?? undefined) : undefined,
        p_scope_dept_id: isManager ? (employee?.department_id ?? undefined) : undefined,
        p_is_org_wide: orgWide,
      });

      if (error) {
        console.error("RPC get_dashboard_analytics error:", error);
        throw error;
      }
      return data as DashboardAnalyticsPayload;
    },
  });

  // ──── استعلام خفيف لأحدث المهام المعروضة في الأسفل ────
  const { data: recentTasks } = useQuery({
    queryKey: ["dashboard-recent-tasks", orgWide, isManager, employee?.id, employee?.department_id],
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("id, title, status, priority, progress, due_date, assignee_id, created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      if (!orgWide) {
        if (isManager && employee?.department_id) {
          const { data: empIds } = await supabase
            .from("employees")
            .select("id")
            .eq("department_id", employee.department_id);
          const ids = (empIds ?? []).map((e) => e.id);
          if (ids.length > 0) q = q.in("assignee_id", ids);
        } else if (employee?.id) {
          q = q.eq("assignee_id", employee.id);
        }
      }

      const { data } = await q;
      return data ?? [];
    },
  });

  const summary = analytics?.summary;
  const employeeScores = analytics?.employeeScores ?? [];
  const deptScores = analytics?.deptScores ?? [];
  const sectionScores = analytics?.sectionScores ?? [];

  const topEmployee = topOf(employeeScores);
  const topDept = topOf(deptScores);
  const topSection = topOf(sectionScores);
  const myScore = employeeScores.find((s) => s.id === employee?.id) ?? null;
  const myRank = rank(employeeScores).findIndex((s) => s.id === employee?.id) + 1;

  /* ── مؤشرات عامة ── */
  const completed = summary?.completedPeriodTasks ?? 0;
  const totalPeriodTasks = summary?.totalPeriodTasks ?? 0;
  const overdue = summary?.overdueTasks ?? 0;
  const dueSoon = summary?.dueSoonTasks ?? 0;
  const rate = summary?.completionRate ?? 0;
  const overallCompliance = summary?.avgCompliance ?? 0;

  const totalToday = (summary?.todayPresent ?? 0) + (summary?.todayLate ?? 0) + (summary?.todayLeave ?? 0) + (summary?.todayAbsent ?? 0);
  const attendanceSlices = [
    {
      label: "حاضر في الموعد",
      value: summary?.todayPresent ?? 0,
      className: "bg-primary",
    },
    {
      label: "متأخر",
      value: summary?.todayLate ?? 0,
      className: "bg-accent",
    },
    {
      label: "إجازة / إذن",
      value: summary?.todayLeave ?? 0,
      className: "bg-muted-foreground/50",
    },
    {
      label: "غائب",
      value: summary?.todayAbsent ?? 0,
      className: "bg-destructive",
    },
  ];

  const statusSlices = [
    {
      label: TASK_STATUS_LABELS["completed"] ?? "منجزة",
      value: summary?.completedPeriodTasks ?? 0,
      className: "bg-primary",
    },
    {
      label: TASK_STATUS_LABELS["in_progress"] ?? "قيد التنفيذ",
      value: summary?.inProgressPeriodTasks ?? 0,
      className: "bg-accent",
    },
    {
      label: TASK_STATUS_LABELS["new"] ?? "جديدة",
      value: summary?.newPeriodTasks ?? 0,
      className: "bg-secondary",
    },
  ];

  const lateBoard = [...employeeScores]
    .filter((s) => s.lateMinutes > 0)
    .sort((a, b) => b.lateMinutes - a.lateMinutes)
    .slice(0, 5);

  const stats = [
    { label: "الموظفون", value: summary?.totalEmployees ?? 0 },
    { label: "الإدارات", value: orgWide ? deptScores.length : "—" },
    { label: "الأقسام", value: orgWide ? sectionScores.length : "—" },
    { label: "مهام الفترة", value: totalPeriodTasks },
    { label: "نسبة الالتزام", value: `${overallCompliance}%` },
    { label: "مستحقة خلال ٧ أيام", value: dueSoon },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`أهلاً ${employee?.full_name ?? ""}`}
        description={
          <div className="space-y-1">
            {employee?.job_title ? <p>{employee.job_title}</p> : null}
            <p className="flex items-center gap-1.5">
              {orgWide
                ? "لوحة قيادة شاملة لكل إدارات وأقسام المؤسسة"
                : isManager
                  ? "أداء نطاق إدارتك ومؤشرات فريقك"
                  : "متابعة أدائك ومهامك والتزامك بالدوام"}
            </p>
          </div>
        }
        action={
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">الفترة</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          الفترة: {formatDate(range.start)} — {formatDate(range.end)}
        </p>
        <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
          <Zap className="size-3.5 fill-current" /> معالجة فورية فائقة السرعة عبر قاعدة البيانات
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-primary sm:text-3xl">
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* لوحة الشرف */}
      {orgWide || isManager ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <TopPerformerCard
            label="أفضل موظف"
            icon={<Trophy className="size-4 text-accent" />}
            performer={topEmployee}
          />
          <TopPerformerCard
            label="أفضل إدارة"
            icon={<Building2 className="size-4 text-accent" />}
            performer={topDept}
          />
          <TopPerformerCard
            label="أفضل قسم"
            icon={<Layers className="size-4 text-accent" />}
            performer={topSection}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <TopPerformerCard
            label="أدائي خلال الفترة"
            icon={<Award className="size-4 text-accent" />}
            performer={myScore}
          />
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="text-xs text-muted-foreground">ترتيبي بين الزملاء</p>
              <p className="font-display text-3xl font-bold text-primary">
                {myRank > 0 ? `${myRank}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                من أصل {rank(employeeScores).length} موظف مشمول بالتقييم
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="text-xs text-muted-foreground">إجمالي التأخير خلال الفترة</p>
              <p className="font-display text-3xl font-bold text-primary">
                {formatMinutes(myScore?.lateMinutes ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {myScore?.presentDays ?? 0} يوم حضور مسجّل
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">نسبة إنجاز مهام الفترة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={rate} />
          <p className="text-sm text-muted-foreground">
            {rate}% من مهام الفترة منجزة ({completed} من {totalPeriodTasks})
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionCard
          title="حضور اليوم"
          total={totalToday}
          slices={attendanceSlices}
          footer={totalToday === 0 ? "لم تُسجَّل سجلات حضور لهذا اليوم بعد." : undefined}
        />
        <DistributionCard
          title="توزيع المهام حسب الحالة"
          total={totalPeriodTasks}
          slices={statusSlices}
        />
      </div>

      {(orgWide || isManager) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <LeaderboardTable
            title="أفضل ٥ موظفين"
            entityLabel="الموظف"
            rows={rank(employeeScores)}
          />
          <LeaderboardTable title="ترتيب الأقسام" entityLabel="القسم" rows={rank(sectionScores)} />
        </div>
      )}

      {orgWide && (
        <LeaderboardTable title="ترتيب الإدارات" entityLabel="الإدارة" rows={rank(deptScores)} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <AttentionList
          items={[
            { label: "مهام متأخرة عن الاستحقاق", count: overdue, to: "/tasks", tone: "danger" },
            {
              label: "طلبات إجازة بانتظار الاعتماد",
              count: (analytics?.pendingLeaves ?? []).length,
              to: "/leaves",
            },
            {
              label: "تقييمات ضمن مراحل الاعتماد",
              count: (analytics?.pendingEvaluations ?? []).length,
              to: "/evaluations",
            },
            {
              label: "وثائق موظفين تنتهي خلال ٣٠ يوماً",
              count: (analytics?.expiringDocs ?? []).length,
              to: "/employees",
              tone: "danger",
            },
          ]}
        />

        {orgWide || isManager ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">الأكثر تأخراً خلال الفترة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lateBoard.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد حالات تأخير مسجّلة.</p>
              )}
              {lateBoard.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.subtitle}</p>
                  </div>
                  <Badge variant="outline">{formatMinutes(e.lateMinutes)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">أحدث المهام</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <ListSkeleton rows={3} />}
          {!isLoading && (recentTasks ?? []).length === 0 && (
            <EmptyState compact icon={ClipboardList} title="لا توجد مهام بعد" />
          )}
          {(recentTasks ?? []).map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  الاستحقاق: {formatDate(t.due_date)} — التقدم: {t.progress}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{PRIORITY_LABELS[t.priority]}</Badge>
                <Badge variant={t.status === "completed" ? "default" : "secondary"}>
                  {TASK_STATUS_LABELS[t.status]}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
