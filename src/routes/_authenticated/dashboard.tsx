import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة المعلومات | الموارد البشرية" },
      { name: "description", content: "نظرة عامة على الموظفين والمهام والإنجاز في مؤسسة اليتيم التنموية." },
      { property: "og:title", content: "لوحة المعلومات | الموارد البشرية" },
      { property: "og:description", content: "مؤشرات الأداء والمهام والإنجاز لحظياً." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { employee, isDirector } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [employees, departments, sections, tasks] = await Promise.all([
        supabase.from("employees").select("id, status"),
        supabase.from("departments").select("id"),
        supabase.from("sections").select("id"),
        supabase
          .from("tasks")
          .select("id, title, status, priority, progress, due_date, assignee_id")
          .order("created_at", { ascending: false }),
      ]);
      return {
        employees: employees.data ?? [],
        departments: departments.data ?? [],
        sections: sections.data ?? [],
        tasks: tasks.data ?? [],
      };
    },
  });

  const tasks = data?.tasks ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date < today,
  ).length;
  const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const stats = [
    { label: "الموظفون", value: data?.employees.length ?? 0 },
    { label: "الإدارات", value: data?.departments.length ?? 0 },
    { label: "الأقسام", value: data?.sections.length ?? 0 },
    { label: "المهام", value: tasks.length },
    { label: "منجزة", value: completed },
    { label: "متأخرة", value: overdue },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`أهلاً ${employee?.full_name ?? ""}`}
        description={
          isDirector
            ? "عرض شامل لكل إدارات وأقسام المؤسسة"
            : "متابعة المهام والإنجاز الخاص بنطاق عملك"
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-3xl font-bold text-primary">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">نسبة الإنجاز العامة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={rate} />
          <p className="text-sm text-muted-foreground">{rate}% من المهام منجزة</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">أحدث المهام</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
          {!isLoading && tasks.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد مهام بعد.</p>
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
