import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EvaluationForm } from "@/components/evaluations/EvaluationForm";
import {
  EvaluationRecord,
  type ApprovalRow,
  type CriterionRow,
  type EvaluationRow,
  type GoalRow,
} from "@/components/evaluations/EvaluationRecord";
import { SelfAssessmentTab } from "@/components/evaluations/SelfAssessmentTab";
import { CriteriaTemplatesTab } from "@/components/evaluations/CriteriaTemplatesTab";
import { EVALUATION_PERIOD_LABELS, PERIOD_LABELS } from "@/lib/hr";
import { STAGE_LABELS, type ApprovalStage } from "@/lib/evaluation-approval";

export const Route = createFileRoute("/_authenticated/evaluations")({
  head: () => ({
    meta: [
      { title: "تقييم الأداء | مؤسسة اليتيم التنموية" },
      {
        name: "description",
        content:
          "تقييم أداء شهري وربعي ونصف سنوي وسنوي يجمع إنجاز المهام والالتزام بالدوام والمعايير السلوكية مع مسار اعتماد متكامل.",
      },
      { property: "og:title", content: "تقييم الأداء | مؤسسة اليتيم التنموية" },
      {
        property: "og:description",
        content: "درجات أداء تلقائية من المهام والدوام مع معايير سلوكية وخطط تحسين واعتماد إداري.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvaluationsPage,
});

function EvaluationsPage() {
  const { isManager, isHR, isDirector, employee } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");

  const { data } = useQuery({
    queryKey: ["evaluations-page"],
    queryFn: async () => {
      const [employees, evaluations, approvals, criteria, goals] = await Promise.all([
        supabase.from("employees").select("id, full_name").order("full_name"),
        supabase.from("evaluations").select("*").order("created_at", { ascending: false }),
        supabase
          .from("evaluation_approvals")
          .select("id, evaluation_id, stage, action, note, created_at")
          .order("created_at", { ascending: true }),
        supabase
          .from("evaluation_criteria")
          .select("id, evaluation_id, name, kind, weight, score, max_score, note"),
        supabase
          .from("evaluation_goals")
          .select("id, evaluation_id, title, metric, target_date, status"),
      ]);
      return {
        employees: employees.data ?? [],
        evaluations: (evaluations.data ?? []) as unknown as EvaluationRow[],
        approvals: (approvals.data ?? []) as ApprovalRow[],
        criteria: (criteria.data ?? []) as unknown as CriterionRow[],
        goals: (goals.data ?? []) as GoalRow[],
      };
    },
  });

  const employees = data?.employees ?? [];
  const evaluations = data?.evaluations ?? [];
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.full_name ?? "—";
  const refresh = () => void qc.invalidateQueries({ queryKey: ["evaluations-page"] });

  const grouped = useMemo(() => {
    const trail: Record<string, ApprovalRow[]> = {};
    for (const a of data?.approvals ?? []) (trail[a.evaluation_id] ??= []).push(a);
    const criteria: Record<string, CriterionRow[]> = {};
    for (const c of data?.criteria ?? []) (criteria[c.evaluation_id] ??= []).push(c);
    const goals: Record<string, GoalRow[]> = {};
    for (const g of data?.goals ?? []) (goals[g.evaluation_id] ??= []).push(g);
    return { trail, criteria, goals };
  }, [data]);

  const filtered = evaluations.filter((ev) => {
    if (periodFilter !== "all" && ev.period !== periodFilter) return false;
    if (stageFilter !== "all" && ev.approval_stage !== stageFilter) return false;
    if (search && !nameOf(ev.employee_id).includes(search.trim())) return false;
    return true;
  });

  const mine = evaluations.filter((ev) => employee && ev.employee_id === employee.id);
  const actor = { isManager, isHR, isDirector };

  const renderList = (rows: EvaluationRow[]) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground">لا توجد تقييمات مطابقة.</p>
    ) : (
      rows.map((ev) => (
        <EvaluationRecord
          key={ev.id}
          ev={ev}
          employeeName={nameOf(ev.employee_id)}
          criteria={grouped.criteria[ev.id] ?? []}
          goals={grouped.goals[ev.id] ?? []}
          trail={grouped.trail[ev.id] ?? []}
          actor={actor}
          isOwner={!!employee && ev.employee_id === employee.id}
          onChanged={refresh}
        />
      ))
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="تقييم الأداء"
        description="فترات شهرية وربعية ونصف سنوية وسنوية — إنجاز المهام والدوام يُحتسبان تلقائياً وتُضاف إليهما المعايير السلوكية"
      />

      <Tabs defaultValue={isManager || isHR ? "new" : "mine"}>
        <TabsList className="flex-wrap">
          {(isManager || isHR) && <TabsTrigger value="new">تقييم جديد</TabsTrigger>}
          <TabsTrigger value="records">سجل التقييمات</TabsTrigger>
          <TabsTrigger value="mine">تقييماتي</TabsTrigger>
          <TabsTrigger value="self">التقييم الذاتي</TabsTrigger>
          <TabsTrigger value="criteria">المعايير</TabsTrigger>
        </TabsList>

        {(isManager || isHR) && (
          <TabsContent value="new" className="mt-4">
            <EvaluationForm employees={employees} onSaved={refresh} />
          </TabsContent>
        )}

        <TabsContent value="records" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تصفية</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>بحث باسم الموظف</Label>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="الاسم" />
              </div>
              <div className="space-y-2">
                <Label>الفترة</Label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفترات</SelectItem>
                    {Object.entries(EVALUATION_PERIOD_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>مرحلة الاعتماد</Label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المراحل</SelectItem>
                    {Object.entries(STAGE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">{renderList(filtered)}</div>
        </TabsContent>

        <TabsContent value="mine" className="mt-4 space-y-3">
          {renderList(mine)}
          {mine.length > 0 && (
            <p className="text-xs text-muted-foreground">
              آخر تقييم: {PERIOD_LABELS[mine[0]!.period]} —{" "}
              {STAGE_LABELS[mine[0]!.approval_stage as ApprovalStage]}
            </p>
          )}
        </TabsContent>

        <TabsContent value="self" className="mt-4">
          <SelfAssessmentTab employeeId={employee?.id ?? null} />
        </TabsContent>

        <TabsContent value="criteria" className="mt-4">
          <CriteriaTemplatesTab canEdit={isDirector || isHR} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
