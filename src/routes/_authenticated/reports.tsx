import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileDown, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PERIOD_LABELS,
  TASK_STATUS_LABELS,
  formatDate,
  gradeFor,
  periodRange,
  type PeriodKey,
} from "@/lib/hr";
import { exportPdf, exportWord, type ReportDoc } from "@/lib/report-export";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "تقارير الإنجاز | الموارد البشرية" },
      { name: "description", content: "تقارير إنجاز يومية وأسبوعية وشهرية وربعية ونصف سنوية قابلة للتصدير Word وPDF." },
      { property: "og:title", content: "تقارير الإنجاز | الموارد البشرية" },
      { property: "og:description", content: "تقارير أداء الموظفين والأقسام مع التصدير إلى Word وPDF." },
    ],
  }),
  component: ReportsPage,
});

type Scope = "employee" | "section" | "department";
type ReportKind = "achievement" | "evaluation";

const SCOPE_LABELS: Record<Scope, string> = {
  employee: "الموظف",
  section: "القسم",
  department: "الإدارة",
};

function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>("achievement");
  const [scope, setScope] = useState<Scope>("employee");
  const [targetId, setTargetId] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("monthly");


  const { data: base } = useQuery({
    queryKey: ["report-base"],
    queryFn: async () => {
      const [employees, departments, sections] = await Promise.all([
        supabase.from("employees").select("id, full_name, department_id, section_id").order("full_name"),
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("sections").select("id, name, department_id").order("name"),
      ]);
      return {
        employees: employees.data ?? [],
        departments: departments.data ?? [],
        sections: sections.data ?? [],
      };
    },
  });

  const employees = base?.employees ?? [];
  const departments = base?.departments ?? [];
  const sections = base?.sections ?? [];

  const options =
    scope === "employee"
      ? employees.map((e) => ({ id: e.id, name: e.full_name }))
      : scope === "section"
        ? sections.map((s) => ({ id: s.id, name: s.name }))
        : departments.map((d) => ({ id: d.id, name: d.name }));

  const range = periodRange(period);

  const { data: report, isFetching } = useQuery({
    enabled: Boolean(targetId),
    queryKey: ["report", scope, targetId, period],
    queryFn: async () => {
      const memberIds =
        scope === "employee"
          ? [targetId]
          : employees
              .filter((e) => (scope === "section" ? e.section_id === targetId : e.department_id === targetId))
              .map((e) => e.id);

      if (memberIds.length === 0) return { tasks: [], attendance: [], memberIds };

      const [tasksRes, attRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .in("assignee_id", memberIds)
          .gte("start_date", range.start)
          .lte("start_date", range.end),
        supabase
          .from("attendance_records")
          .select("*")
          .in("employee_id", memberIds)
          .gte("work_date", range.start)
          .lte("work_date", range.end),
      ]);
      return { tasks: tasksRes.data ?? [], attendance: attRes.data ?? [], memberIds };
    },
  });

  const tasks = report?.tasks ?? [];
  const attendance = report?.attendance ?? [];
  const completed = tasks.filter((t) => t.status === "completed").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const overdue = tasks.filter(
    (t) => t.status !== "completed" && t.due_date && t.due_date < range.end,
  ).length;
  const avgProgress = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
    : 0;
  const lateMinutes = attendance.reduce((s, a) => s + a.late_minutes, 0);
  const presentDays = attendance.filter((a) => a.status === "present").length;

  const memberIds =
    scope === "employee"
      ? targetId
        ? [targetId]
        : []
      : employees
          .filter((e) => (scope === "section" ? e.section_id === targetId : e.department_id === targetId))
          .map((e) => e.id);

  const { data: evaluations = [], isFetching: loadingEvals } = useQuery({
    enabled: kind === "evaluation" && Boolean(targetId) && memberIds.length > 0,
    queryKey: ["report-evaluations", scope, targetId, period, range.start, range.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("evaluations")
        .select("*")
        .in("employee_id", memberIds)
        .lte("period_start", range.end)
        .gte("period_end", range.start)
        .order("total_score", { ascending: false });
      return data ?? [];
    },
  });

  const avgTotal = evaluations.length
    ? Math.round(evaluations.reduce((s, e) => s + Number(e.total_score), 0) / evaluations.length)
    : 0;
  const avgTasksScore = evaluations.length
    ? Math.round(evaluations.reduce((s, e) => s + Number(e.tasks_score), 0) / evaluations.length)
    : 0;
  const avgAttendanceScore = evaluations.length
    ? Math.round(evaluations.reduce((s, e) => s + Number(e.attendance_score), 0) / evaluations.length)
    : 0;
  const avgCriteriaScore = evaluations.length
    ? Math.round(evaluations.reduce((s, e) => s + Number(e.criteria_score), 0) / evaluations.length)
    : 0;
  const approvedCount = evaluations.filter((e) => e.approved).length;

  const targetName = options.find((o) => o.id === targetId)?.name ?? "";
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.full_name ?? "—";

  const buildEvaluationDoc = (): ReportDoc => ({
    title: `تقرير تقييم الأداء — ${SCOPE_LABELS[scope]} ${targetName}`,
    subtitle: `تقييم ${PERIOD_LABELS[period]} للأداء (المهام ٥٠٪ · الدوام ٣٠٪ · معايير المدير ٢٠٪)`,
    periodLabel: `${formatDate(range.start)} — ${formatDate(range.end)}`,
    meta: [
      { label: "عدد التقييمات", value: String(evaluations.length) },
      { label: "متوسط الدرجة الكلية", value: `${avgTotal}%` },
      { label: "التقدير العام", value: gradeFor(avgTotal) },
      { label: "المعتمدة", value: `${approvedCount} من ${evaluations.length}` },
    ],
    sections: [
      {
        heading: "الملخص التنفيذي",
        paragraphs: [
          `يشمل التقرير ${evaluations.length} تقييماً خلال الفترة، بمتوسط درجة كلية ${avgTotal}% وتقدير عام «${gradeFor(avgTotal)}»، واعتُمد منها ${approvedCount} تقييماً.`,
          `توزّع متوسط الدرجات على المحاور: إنجاز المهام ${avgTasksScore}%، الالتزام بالدوام ${avgAttendanceScore}%، معايير المدير ${avgCriteriaScore}%.`,
        ],
      },
      {
        heading: "متوسط محاور التقييم",
        table: {
          columns: ["إنجاز المهام (٥٠٪)", "الدوام (٣٠٪)", "معايير المدير (٢٠٪)", "الدرجة الكلية", "التقدير"],
          rows: [[`${avgTasksScore}%`, `${avgAttendanceScore}%`, `${avgCriteriaScore}%`, `${avgTotal}%`, gradeFor(avgTotal)]],
        },
      },
      {
        heading: "تفصيل تقييمات الموظفين",
        table: {
          columns: ["الموظف", "الفترة", "المهام", "الدوام", "المعايير", "الكلية", "التقدير", "الاعتماد"],
          rows: evaluations.map((e) => [
            nameOf(e.employee_id),
            `${formatDate(e.period_start)} — ${formatDate(e.period_end)}`,
            `${Math.round(Number(e.tasks_score))}%`,
            `${Math.round(Number(e.attendance_score))}%`,
            `${Math.round(Number(e.criteria_score))}%`,
            `${Math.round(Number(e.total_score))}%`,
            e.grade ?? gradeFor(Number(e.total_score)),
            e.approved ? "معتمد" : "غير معتمد",
          ]),
        },
      },
      {
        heading: "ملاحظات المقيّم",
        table: {
          columns: ["الموظف", "الملاحظات"],
          rows: evaluations.filter((e) => e.notes).map((e) => [nameOf(e.employee_id), e.notes ?? ""]),
        },
      },
    ],
  });

  const buildAchievementDoc = (): ReportDoc => ({

    title:
      scope === "employee"
        ? `تقرير إنجاز الموظف — ${targetName}`
        : scope === "section"
          ? `تقرير إنجاز القسم — ${targetName}`
          : `تقرير إنجاز الإدارة — ${targetName}`,
    subtitle: `تقرير ${PERIOD_LABELS[period]} للأداء والإنجاز`,
    periodLabel: `${formatDate(range.start)} — ${formatDate(range.end)}`,
    meta: [
      { label: "إجمالي المهام", value: String(tasks.length) },
      { label: "المنجزة", value: String(completed) },
      { label: "متوسط الإنجاز", value: `${avgProgress}%` },
      { label: "التقدير", value: gradeFor(avgProgress) },
    ],
    sections: [
      {
        heading: "الملخص التنفيذي",
        paragraphs: [
          `بلغ إجمالي المهام خلال الفترة ${tasks.length} مهمة، أُنجز منها ${completed} مهمة، ولا تزال ${inProgress} مهمة قيد التنفيذ، بينما تجاوزت ${overdue} مهمة تاريخ الاستحقاق.`,
          `متوسط نسبة الإنجاز العامة ${avgProgress}% بتقدير «${gradeFor(avgProgress)}»، وسُجل ${presentDays} يوم حضور بإجمالي ${lateMinutes} دقيقة تأخير.`,
        ],
      },
      {
        heading: "تفصيل المهام",
        table: {
          columns: ["المهمة", "المكلّف", "الأولوية", "الحالة", "الإنجاز", "الاستحقاق"],
          rows: tasks.map((t) => [
            t.title,
            nameOf(t.assignee_id),
            t.priority,
            TASK_STATUS_LABELS[t.status] ?? t.status,
            `${t.progress}%`,
            formatDate(t.due_date),
          ]),
        },
      },
      {
        heading: "مؤشرات الدوام",
        table: {
          columns: ["أيام الحضور", "أيام الغياب", "دقائق التأخير", "دقائق الانصراف المبكر"],
          rows: [
            [
              presentDays,
              attendance.filter((a) => a.status === "absent").length,
              lateMinutes,
              attendance.reduce((s, a) => s + a.early_leave_minutes, 0),
            ],
          ],
        },
      },
    ],
  });

  const buildDoc = (): ReportDoc =>
    kind === "evaluation" ? buildEvaluationDoc() : buildAchievementDoc();

  const fileName =
    kind === "evaluation"
      ? `تقرير-تقييم-الأداء-${PERIOD_LABELS[period]}-${targetName || "عام"}`
      : `تقرير-${PERIOD_LABELS[period]}-${targetName || "عام"}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={kind === "evaluation" ? "تقارير تقييم الأداء" : "تقارير الإنجاز"}
        description={
          kind === "evaluation"
            ? "تقارير تقييم أداء الموظفين والأقسام والإدارات مع محاور المهام والدوام ومعايير المدير"
            : "تقارير يومية وأسبوعية وشهرية وربعية ونصف سنوية للموظف أو القسم أو الإدارة"
        }

        action={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!targetId}
              onClick={() => {
                exportWord(buildDoc(), fileName);
                toast.success("تم تصدير ملف Word");
              }}
            >
              <FileDown className="size-4" /> تصدير Word
            </Button>
            <Button
              size="sm"
              disabled={!targetId}
              onClick={() => {
                if (!exportPdf(buildDoc())) toast.error("يرجى السماح بالنوافذ المنبثقة للطباعة");
              }}
            >
              <Printer className="size-4" /> تصدير PDF
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>نوع التقرير</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as ReportKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="achievement">تقرير الإنجاز</SelectItem>
              <SelectItem value="evaluation">تقرير تقييم الأداء</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>نطاق التقرير</Label>

          <Select
            value={scope}
            onValueChange={(v) => {
              setScope(v as Scope);
              setTargetId("");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">موظف</SelectItem>
              <SelectItem value="section">قسم</SelectItem>
              <SelectItem value="department">إدارة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>الجهة</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>الفترة</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!targetId && <p className="text-sm text-muted-foreground">اختر الجهة لعرض التقرير.</p>}
      {isFetching && <p className="text-sm text-muted-foreground">جارٍ إعداد التقرير…</p>}

      {targetId && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "إجمالي المهام", value: tasks.length },
              { label: "منجزة", value: completed },
              { label: "قيد التنفيذ", value: inProgress },
              { label: "متأخرة", value: overdue },
              { label: "متوسط الإنجاز", value: `${avgProgress}%` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-display text-2xl font-bold text-primary">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {formatDate(range.start)} — {formatDate(range.end)} · تفصيل المهام
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="p-3">المهمة</th>
                    <th className="p-3">المكلّف</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">الإنجاز</th>
                    <th className="p-3">الاستحقاق</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="p-3">{t.title}</td>
                      <td className="p-3">{nameOf(t.assignee_id)}</td>
                      <td className="p-3">{TASK_STATUS_LABELS[t.status]}</td>
                      <td className="p-3">{t.progress}%</td>
                      <td className="p-3">{formatDate(t.due_date)}</td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        لا توجد مهام ضمن هذه الفترة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
