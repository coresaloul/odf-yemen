import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Award, Building2, ClipboardList, Layers, Trophy } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  formatDate,
  periodRange,
  type PeriodKey,
} from "@/lib/hr";
import { PageHeader } from "@/components/PageHeader";
import { TopPerformerCard } from "@/components/dashboard/TopPerformerCard";
import { LeaderboardTable } from "@/components/dashboard/LeaderboardTable";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { DistributionCard } from "@/components/dashboard/DistributionCard";
import { formatMinutes } from "@/lib/attendance";
import {
  groupScores,
  rank,
  scoreEmployees,
  topOf,
  type MetricAttendance,
  type MetricEmployee,
  type MetricTask,
} from "@/lib/dashboard-metrics";

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

function Dashboard() {
  const { employee, isDirector, isHR, isManager } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const range = useMemo(() => periodRange(period), [period]);
  const today = new Date().toISOString().slice(0, 10);
  const orgWide = isDirector || isHR;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", range.start, range.end],
    queryFn: async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 30);
      const soonIso = soon.toISOString().slice(0, 10);
      const [employees, departments, sections, tasks, attendance, leaves, evaluations, docs] =
        await Promise.all([
          supabase
            .from("employees")
            .select("id, full_name, job_title, department_id, section_id, status"),
          supabase.from("departments").select("id, name"),
          supabase.from("sections").select("id, name, department_id"),
          supabase
            .from("tasks")
            .select(
              "id, title, status, priority, progress, due_date, assignee_id, completed_at, created_at, start_date",
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("attendance_records")
            .select(
              "employee_id, work_date, status, late_minutes, early_leave_minutes, permission_minutes",
            )
            .gte("work_date", range.start)
            .lte("work_date", range.end),
          supabase.from("leave_requests").select("id, employee_id, stage, start_date, end_date"),
          supabase.from("evaluations").select("id, employee_id, approval_stage"),
          supabase
            .from("employee_documents")
            .select("id, employee_id, title, expiry_date")
            .not("expiry_date", "is", null)
            .lte("expiry_date", soonIso),
        ]);
      return {
        employees: (employees.data ?? []) as MetricEmployee[],
        departments: departments.data ?? [],
        sections: sections.data ?? [],
        tasks: tasks.data ?? [],
        attendance: (attendance.data ?? []) as MetricAttendance[],
        leaves: leaves.data ?? [],
        evaluations: evaluations.data ?? [],
        docs: docs.data ?? [],
      };
    },
  });

  const allEmployees = data?.employees ?? [];
  const departments = data?.departments ?? [];
  const sections = data?.sections ?? [];

  /* ── نطاق العرض حسب الدور ── */
  const employees = useMemo(() => {
    if (orgWide) return allEmployees;
    if (isManager && employee?.department_id)
      return allEmployees.filter((e) => e.department_id === employee.department_id);
    return allEmployees.filter((e) => e.id === employee?.id);
  }, [allEmployees, orgWide, isManager, employee]);

  const scopeIds = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);

  const tasks = useMemo(
    () => (data?.tasks ?? []).filter((t) => scopeIds.has(t.assignee_id)),
    [data?.tasks, scopeIds],
  );
  const periodTasks = useMemo(
    () => tasks.filter((t) => t.start_date >= range.start && t.start_date <= range.end),
    [tasks, range],
  );
  const attendance = useMemo(
    () => (data?.attendance ?? []).filter((a) => scopeIds.has(a.employee_id)),
    [data?.attendance, scopeIds],
  );

  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? "";
  const sectionName = (id: string | null) => sections.find((s) => s.id === id)?.name ?? "";

  /* ── درجات الأداء ── */
  const employeeScores = useMemo(
    () =>
      scoreEmployees(
        employees.filter((e) => e.status === "active"),
        periodTasks as MetricTask[],
        attendance,
        (e) => sectionName(e.section_id) || deptName(e.department_id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, periodTasks, attendance, departments, sections],
  );

  const deptScores = useMemo(
    () =>
      groupScores(
        employeeScores,
        departments
          .filter((d) => employees.some((e) => e.department_id === d.id))
          .map((d) => ({ id: d.id, name: d.name })),
        (id) => employees.filter((e) => e.department_id === id).map((e) => e.id),
      ),
    [employeeScores, departments, employees],
  );

  const sectionScores = useMemo(
    () =>
      groupScores(
        employeeScores,
        sections
          .filter((s) => employees.some((e) => e.section_id === s.id))
          .map((s) => ({ id: s.id, name: s.name, subtitle: deptName(s.department_id) })),
        (id) => employees.filter((e) => e.section_id === id).map((e) => e.id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employeeScores, sections, employees, departments],
  );

  const topEmployee = topOf(employeeScores);
  const topDept = topOf(deptScores);
  const topSection = topOf(sectionScores);
  const myScore = employeeScores.find((s) => s.id === employee?.id) ?? null;
  const myRank = rank(employeeScores).findIndex((s) => s.id === employee?.id) + 1;

  /* ── مؤشرات عامة ── */
  const completed = periodTasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date < today,
  ).length;
  const dueSoon = tasks.filter((t) => {
    if (t.status === "completed" || t.status === "cancelled" || !t.due_date) return false;
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    return t.due_date >= today && t.due_date <= limit.toISOString().slice(0, 10);
  }).length;
  const rate = periodTasks.length ? Math.round((completed / periodTasks.length) * 100) : 0;
  const overallCompliance = employeeScores.length
    ? Math.round(employeeScores.reduce((s, e) => s + e.attendanceScore, 0) / employeeScores.length)
    : 0;

  const todayRows = attendance.filter((a) => a.work_date === today);
  const attendanceSlices = [
    {
      label: "حاضر في الموعد",
      value: todayRows.filter((a) => a.status === "present" && a.late_minutes === 0).length,
      className: "bg-primary",
    },
    {
      label: "متأخر",
      value: todayRows.filter((a) => a.status === "present" && a.late_minutes > 0).length,
      className: "bg-accent",
    },
    {
      label: "إجازة / إذن",
      value: todayRows.filter((a) => a.status === "leave" || a.status === "permission").length,
      className: "bg-muted-foreground/50",
    },
    {
      label: "غائب",
      value: todayRows.filter((a) => a.status === "absent").length,
      className: "bg-destructive",
    },
  ];

  const statusSlices = [
    {
      label: TASK_STATUS_LABELS["completed"] ?? "منجزة",
      value: periodTasks.filter((t) => t.status === "completed").length,
      className: "bg-primary",
    },
    {
      label: TASK_STATUS_LABELS["in_progress"] ?? "قيد التنفيذ",
      value: periodTasks.filter((t) => t.status === "in_progress").length,
      className: "bg-accent",
    },
    {
      label: TASK_STATUS_LABELS["new"] ?? "جديدة",
      value: periodTasks.filter((t) => t.status === "new").length,
      className: "bg-secondary",
    },
    {
      label: TASK_STATUS_LABELS["cancelled"] ?? "ملغاة",
      value: periodTasks.filter((t) => t.status === "cancelled").length,
      className: "bg-muted-foreground/50",
    },
  ];

  /* ── تنبيهات ── */
  const pendingLeaves = (data?.leaves ?? []).filter(
    (l) =>
      scopeIds.has(l.employee_id) &&
      ["pending_manager", "pending_hr", "pending_director"].includes(l.stage),
  ).length;
  const pendingEvaluations = (data?.evaluations ?? []).filter(
    (e) =>
      scopeIds.has(e.employee_id) &&
      ["pending_manager", "pending_hr", "pending_director"].includes(e.approval_stage),
  ).length;
  const expiringDocs = (data?.docs ?? []).filter((d) => scopeIds.has(d.employee_id)).length;

  const lateBoard = [...employeeScores]
    .filter((s) => s.lateMinutes > 0)
    .sort((a, b) => b.lateMinutes - a.lateMinutes)
    .slice(0, 5);

  const stats = [
    { label: "الموظفون", value: employees.length },
    { label: "الإدارات", value: orgWide ? departments.length : "—" },
    { label: "الأقسام", value: orgWide ? sections.length : "—" },
    { label: "مهام الفترة", value: periodTasks.length },
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
            <p>
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

      <p className="text-xs text-muted-foreground">
        الفترة: {formatDate(range.start)} — {formatDate(range.end)}
      </p>

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
            {rate}% من مهام الفترة منجزة ({completed} من {periodTasks.length})
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionCard
          title="حضور اليوم"
          total={todayRows.length}
          slices={attendanceSlices}
          footer={todayRows.length === 0 ? "لم تُسجَّل سجلات حضور لهذا اليوم بعد." : undefined}
        />
        <DistributionCard
          title="توزيع المهام حسب الحالة"
          total={periodTasks.length}
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
            { label: "طلبات إجازة بانتظار الاعتماد", count: pendingLeaves, to: "/leaves" },
            {
              label: "تقييمات ضمن مراحل الاعتماد",
              count: pendingEvaluations,
              to: "/evaluations",
            },
            {
              label: "وثائق موظفين تنتهي خلال ٣٠ يوماً",
              count: expiringDocs,
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
          {!isLoading && tasks.length === 0 && (
            <EmptyState compact icon={ClipboardList} title="لا توجد مهام بعد" />
          )}
          {tasks.slice(0, 8).map((t) => (
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
