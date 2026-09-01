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
  ShieldCheck,
  Activity,
  Users,
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
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
import { EmployeeDashboardView } from "@/components/dashboard/EmployeeDashboardView";
import { ManagerDashboardView } from "@/components/dashboard/ManagerDashboardView";
import { SecretariatDashboardView } from "@/components/dashboard/SecretariatDashboardView";
import { formatMinutes } from "@/lib/attendance";
import {
  rank,
  topOf,
  scoreEmployees,
  groupScores,
  type PerformerScore,
  type MetricEmployee,
  type MetricTask,
  type MetricAttendance,
} from "@/lib/dashboard-metrics";
import {
  formatDate,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type PeriodKey,
  periodRange,
} from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة المعلومات | مدير" },
      {
        name: "description",
        content:
          "لوحة قيادة مخصصة حسب الأدوار والصلاحيات: الموظف، المدير المباشر، الموارد البشرية، السكرتارية والمدير التنفيذي.",
      },
      { property: "og:title", content: "لوحة المعلومات | مدير" },
      {
        property: "og:description",
        content: "مؤشرات الأداء، الحضور، الإنجاز، والموافقات والتنبيهات المخصصة لحظياً.",
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

/** جلب بيانات لوحة القيادة عبر الاستعلام المباشر كخيار احتياطي موثوق 100% */
async function fetchDashboardFallback(
  range: { start: string; end: string },
  orgWide: boolean,
  isManager: boolean,
  currentEmp: { id?: string; department_id?: string | null } | null,
): Promise<DashboardAnalyticsPayload> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const soonIso = soon.toISOString().slice(0, 10);

  const [
    employeesRes,
    departmentsRes,
    sectionsRes,
    tasksRes,
    attendanceRes,
    todayAttendanceRes,
    leavesRes,
    evaluationsRes,
    docsRes,
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, job_title, department_id, section_id, status")
      .eq("status", "active"),
    supabase.from("departments").select("id, name"),
    supabase.from("sections").select("id, name, department_id"),
    supabase
      .from("tasks")
      .select("id, title, status, priority, progress, weight, due_date, assignee_id, completed_at, created_at, start_date"),
    supabase
      .from("attendance_records")
      .select("employee_id, work_date, status, late_minutes, early_leave_minutes, permission_minutes, overtime_minutes")
      .gte("work_date", range.start)
      .lte("work_date", range.end),
    supabase
      .from("attendance_records")
      .select("employee_id, status, late_minutes")
      .eq("work_date", todayStr),
    supabase
      .from("leave_requests")
      .select("id, employee_id, stage, start_date, end_date")
      .in("stage", ["pending_manager", "pending_hr", "pending_director"]),
    supabase
      .from("evaluations")
      .select("id, employee_id, approval_stage, total_score, approved, period_start, period_end"),
    supabase
      .from("employee_documents")
      .select("id, employee_id, title, expiry_date")
      .not("expiry_date", "is", null)
      .lte("expiry_date", soonIso),
  ]);

  const allEmployees = (employeesRes.data ?? []) as MetricEmployee[];
  const departments = departmentsRes.data ?? [];
  const sections = sectionsRes.data ?? [];
  const allTasks = (tasksRes.data ?? []) as MetricTask[];
  const attendance = (attendanceRes.data ?? []) as MetricAttendance[];
  const todayAtt = todayAttendanceRes.data ?? [];
  const leaves = leavesRes.data ?? [];
  const evaluations = evaluationsRes.data ?? [];
  const docs = docsRes.data ?? [];

  let targetEmployees = allEmployees;
  if (!orgWide) {
    if (isManager && currentEmp?.department_id) {
      targetEmployees = allEmployees.filter((e) => e.department_id === currentEmp.department_id);
    } else if (currentEmp?.id) {
      targetEmployees = allEmployees.filter((e) => e.id === currentEmp.id);
    }
  }

  const targetIds = new Set(targetEmployees.map((e) => e.id));
  const targetEmpMap = new Map(allEmployees.map((e) => [e.id, e]));

  const deptMap = new Map(departments.map((d) => [d.id, d.name]));
  const secMap = new Map(sections.map((s) => [s.id, s.name]));

  const unitNameOf = (e: MetricEmployee) => {
    if (e.section_id && secMap.has(e.section_id)) return secMap.get(e.section_id)!;
    if (e.department_id && deptMap.has(e.department_id)) return deptMap.get(e.department_id)!;
    return "";
  };

  const periodTasks = allTasks.filter((t) => {
    if (!targetIds.has(t.assignee_id)) return false;
    const sDate = t.start_date || (t as any).created_at?.slice(0, 10);
    const dDate = t.due_date;
    const cDate = t.completed_at?.slice(0, 10);
    return (
      (sDate && sDate >= range.start && sDate <= range.end) ||
      (dDate && dDate >= range.start && dDate <= range.end) ||
      (cDate && cDate >= range.start && cDate <= range.end) ||
      t.status !== "completed"
    );
  });

  const completedPeriodTasks = periodTasks.filter((t) => t.status === "completed").length;
  const inProgressPeriodTasks = periodTasks.filter((t) => t.status === "in_progress").length;
  const newPeriodTasks = periodTasks.filter((t) => t.status === "new").length;

  const targetActiveTasks = allTasks.filter(
    (t) => targetIds.has(t.assignee_id) && t.status !== "completed" && t.status !== "cancelled",
  );
  const overdueTasks = targetActiveTasks.filter((t) => t.due_date && t.due_date < todayStr).length;

  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);
  const next7DaysStr = next7Days.toISOString().slice(0, 10);
  const dueSoonTasks = targetActiveTasks.filter(
    (t) => t.due_date && t.due_date >= todayStr && t.due_date <= next7DaysStr,
  ).length;

  const completionRate =
    periodTasks.length > 0 ? Math.round((completedPeriodTasks / periodTasks.length) * 100) : 0;

  const targetAtt = attendance.filter((a) => targetIds.has(a.employee_id));
  const targetTodayAtt = todayAtt.filter((a) => targetIds.has(a.employee_id));

  // حساب درجات الموظفين
  const employeeScores = scoreEmployees(targetEmployees, periodTasks, targetAtt, unitNameOf);

  // حساب درجات كافة الموظفين لتجميع الإدارات والأقسام بدقة
  const allEmployeeScores =
    orgWide ? employeeScores : scoreEmployees(allEmployees, allTasks, attendance, unitNameOf);

  const avgCompliance =
    employeeScores.length > 0 && employeeScores.some((s) => s.presentDays > 0)
      ? Math.round(
          employeeScores.reduce((acc, s) => acc + s.attendanceScore, 0) / employeeScores.length,
        )
      : 100;

  const deptScores = groupScores(
    allEmployeeScores,
    departments,
    (deptId) => allEmployees.filter((e) => e.department_id === deptId).map((e) => e.id),
  );

  const sectionScores = groupScores(
    allEmployeeScores,
    sections,
    (secId) => allEmployees.filter((e) => e.section_id === secId).map((e) => e.id),
  );

  return {
    summary: {
      totalEmployees: targetEmployees.length,
      totalPeriodTasks: periodTasks.length,
      completedPeriodTasks,
      inProgressPeriodTasks,
      newPeriodTasks,
      overdueTasks,
      dueSoonTasks,
      completionRate,
      avgCompliance,
      todayPresent: targetTodayAtt.filter((a) => a.status === "present").length,
      todayLate: targetTodayAtt.filter(
        (a) => a.status === "present" && (a.late_minutes ?? 0) > 0,
      ).length,
      todayLeave: targetTodayAtt.filter(
        (a) => a.status === "leave" || a.status === "permission",
      ).length,
      todayAbsent: targetTodayAtt.filter((a) => a.status === "absent").length,
    },
    employeeScores,
    deptScores,
    sectionScores,
    expiringDocs: docs
      .filter((d) => targetIds.has(d.employee_id))
      .map((d) => ({
        id: d.id,
        title: d.title,
        expiry_date: d.expiry_date ?? "",
        employee_name: targetEmpMap.get(d.employee_id)?.full_name ?? "—",
      })),
    pendingLeaves: leaves
      .filter((l) => targetIds.has(l.employee_id))
      .map((l) => ({
        id: l.id,
        stage: l.stage,
        start_date: l.start_date,
        end_date: l.end_date,
        employee_name: targetEmpMap.get(l.employee_id)?.full_name ?? "—",
      })),
    pendingEvaluations: evaluations
      .filter((ev) => targetIds.has(ev.employee_id) && !ev.approved)
      .map((ev) => ({
        id: ev.id,
        approval_stage: ev.approval_stage ?? "pending",
        employee_name: targetEmpMap.get(ev.employee_id)?.full_name ?? "—",
      })),
  };
}

function Dashboard() {
  const { employee, isDirector, isHR, isManager, isSecretariat } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const range = useMemo(() => periodRange(period), [period]);
  const orgWide = isDirector || isHR;

  // ──── استعلام بيانات لوحة المعلومات (مع دعم الاستدعاء المباشر والاحتياطي الفوري) ────
  const { data: analytics, isLoading } = useQuery({
    queryKey: [
      "dashboard-analytics-payload",
      range.start,
      range.end,
      orgWide,
      isManager,
      employee?.id,
      employee?.department_id,
    ],
    queryFn: async (): Promise<DashboardAnalyticsPayload> => {
      try {
        const scopeEmpId = !orgWide && !isManager ? employee?.id : undefined;
        const scopeDeptId = isManager ? employee?.department_id : undefined;
        const { data, error } = await supabase.rpc("get_dashboard_analytics", {
          p_start_date: range.start,
          p_end_date: range.end,
          p_is_org_wide: orgWide,
          ...(scopeEmpId ? { p_scope_emp_id: scopeEmpId } : {}),
          ...(scopeDeptId ? { p_scope_dept_id: scopeDeptId } : {}),
        });

        if (!error && data && (data as any).summary) {
          return data as DashboardAnalyticsPayload;
        }
      } catch (err) {
        console.warn("RPC unavailable, using resilient fallback queries:", err);
      }

      // Fallback query
      return fetchDashboardFallback(range, orgWide, isManager, employee);
    },
  });

  // ──── استعلام المهام الحديثة ────
  const { data: recentTasks = [] } = useQuery({
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

  const totalToday =
    (summary?.todayPresent ?? 0) +
    (summary?.todayLate ?? 0) +
    (summary?.todayLeave ?? 0) +
    (summary?.todayAbsent ?? 0);

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
      {/* شريط الإجراءات السريعة في أعلى لوحة المعلومات */}
      <QuickActionsBar />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            الفترة الزمنية المحددة: {formatDate(range.start)} — {formatDate(range.end)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Zap className="size-3.5 fill-current" /> معالجة فورية فائقة السرعة
          </span>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">الفترة:</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-32">
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
        </div>
      </div>

      {/* ─── التبديل الديناميكي للعرض حسب الدور ─── */}

      {/* 1. عرض السكرتارية إذا كان المستخدم سكرتارية وليس مديراً أو HR أو تنفيذي */}
      {!orgWide && !isManager && isSecretariat && (
        <SecretariatDashboardView employee={employee} recentTasks={recentTasks} />
      )}

      {/* 2. عرض الموظف العادي إذا لم يكن مديراً أو HR أو تنفيذي */}
      {!orgWide && !isManager && !isSecretariat && (
        <EmployeeDashboardView
          employee={employee}
          summary={summary}
          myScore={myScore}
          myRank={myRank}
          totalRanked={rank(employeeScores).length}
          recentTasks={recentTasks}
          pendingLeaves={analytics?.pendingLeaves ?? []}
          pendingEvaluations={analytics?.pendingEvaluations ?? []}
        />
      )}

      {/* 3. عرض المدير المباشر إذا كان مديراً وليس إدارياً شاملاً (HR/Director) */}
      {isManager && !orgWide && (
        <ManagerDashboardView
          employee={employee}
          summary={summary}
          employeeScores={employeeScores}
          sectionScores={sectionScores}
          topEmployee={topEmployee}
          recentTasks={recentTasks}
          pendingLeaves={analytics?.pendingLeaves ?? []}
          pendingEvaluations={analytics?.pendingEvaluations ?? []}
        />
      )}

      {/* 4. عرض الإدارة العليا والموارد البشرية (Org-Wide) */}
      {orgWide && (
        <div className="space-y-6">
          <PageHeader
            title={isDirector ? "لوحة القيادة الاستراتيجية" : "لوحة الموارد البشرية والعمليات"}
            description={
              isDirector
                ? "رؤية بانورامية شاملة لمؤشرات الأداء المؤسسي، الانضباط، مسارات الاعتماد وشرف التميز"
                : "متابعة القوة العاملة، الدوام، الإجازات، مسيرات الرواتب والوثائق المؤسسية"
            }
          />

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

          {/* لوحة الشرف المؤسسية */}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">نسبة إنجاز مهام الفترة للمؤسسة</CardTitle>
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
              title="حضور اليوم على مستوى المؤسسة"
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

          <div className="grid gap-4 lg:grid-cols-2">
            <LeaderboardTable
              title="أفضل ٥ موظفين"
              entityLabel="الموظف"
              rows={rank(employeeScores)}
            />
            <LeaderboardTable title="ترتيب الأقسام" entityLabel="القسم" rows={rank(sectionScores)} />
          </div>

          <LeaderboardTable title="ترتيب الإدارات" entityLabel="الإدارة" rows={rank(deptScores)} />

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
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">أحدث المهام في النظام</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <ListSkeleton rows={3} />}
              {!isLoading && recentTasks.length === 0 && (
                <EmptyState compact icon={ClipboardList} title="لا توجد مهام بعد" />
              )}
              {recentTasks.map((t) => (
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
      )}
    </div>
  );
}
