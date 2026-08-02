import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIOD_LABELS, formatDate, gradeFor, periodRange, type PeriodKey } from "@/lib/hr";
import {
  STAGE_LABELS,
  STAGE_STEP_LABELS,
  canActOnStage,
  stageBadgeVariant,
  stepDone,
  type ApprovalStage,
} from "@/lib/evaluation-approval";

export const Route = createFileRoute("/_authenticated/evaluations")({
  head: () => ({
    meta: [
      { title: "تقييم الموظفين | الموارد البشرية" },
      { name: "description", content: "تقييم شهري وربعي يجمع بين إنجاز المهام والالتزام بالدوام ومعايير المدير." },
      { property: "og:title", content: "تقييم الموظفين | الموارد البشرية" },
      { property: "og:description", content: "درجات الأداء المعتمدة على المهام والدوام والمعايير الإدارية." },
    ],
  }),
  component: EvaluationsPage,
});

const WEIGHTS = { tasks: 0.5, attendance: 0.3, criteria: 0.2 };

function EvaluationsPage() {
  const { isManager, isHR, isDirector, employee } = useAuth();
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const [criteriaScore, setCriteriaScore] = useState("80");
  const [notes, setNotes] = useState("");
  const [computed, setComputed] = useState<{
    tasks: number;
    attendance: number;
    total: number;
    start: string;
    end: string;
  } | null>(null);

  const { data } = useQuery({
    queryKey: ["evaluations-page"],
    queryFn: async () => {
      const [employees, evaluations, approvals] = await Promise.all([
        supabase.from("employees").select("id, full_name").order("full_name"),
        supabase.from("evaluations").select("*").order("created_at", { ascending: false }),
        supabase
          .from("evaluation_approvals")
          .select("id, evaluation_id, stage, action, note, created_at")
          .order("created_at", { ascending: true }),
      ]);
      return {
        employees: employees.data ?? [],
        evaluations: evaluations.data ?? [],
        approvals: approvals.data ?? [],
      };
    },
  });

  const employees = data?.employees ?? [];
  const evaluations = data?.evaluations ?? [];
  const trail = (data?.approvals ?? []).reduce<Record<string, typeof approvalsSample>>((acc, a) => {
    (acc[a.evaluation_id] ??= []).push(a);
    return acc;
  }, {});
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.full_name ?? "—";


  const compute = useMutation({
    mutationFn: async () => {
      const { start, end } = periodRange(period);
      const [tasksRes, attRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("status, progress, weight, due_date, completed_at")
          .eq("assignee_id", employeeId)
          .gte("start_date", start)
          .lte("start_date", end),
        supabase
          .from("attendance_records")
          .select("status, late_minutes, early_leave_minutes")
          .eq("employee_id", employeeId)
          .gte("work_date", start)
          .lte("work_date", end),
      ]);

      const tasks = tasksRes.data ?? [];
      const totalWeight = tasks.reduce((s, t) => s + (t.weight || 1), 0);
      const earned = tasks.reduce((s, t) => {
        const base = (t.progress ?? 0) * (t.weight || 1);
        const late = t.status === "completed" && t.due_date && t.completed_at
          ? t.completed_at.slice(0, 10) > t.due_date
          : false;
        return s + (late ? base * 0.85 : base);
      }, 0);
      const tasksScore = totalWeight ? Math.min(100, Math.round(earned / totalWeight)) : 0;

      const att = attRes.data ?? [];
      const workDays = att.filter((a) => a.status !== "holiday").length;
      const presentDays = att.filter((a) => a.status === "present").length;
      const lateMinutes = att.reduce((s, a) => s + a.late_minutes + a.early_leave_minutes, 0);
      const presenceRate = workDays ? (presentDays / workDays) * 100 : 0;
      const attendanceScore = workDays
        ? Math.max(0, Math.round(presenceRate - lateMinutes / 30))
        : 0;

      const total = Math.round(
        tasksScore * WEIGHTS.tasks +
          attendanceScore * WEIGHTS.attendance +
          Number(criteriaScore) * WEIGHTS.criteria,
      );

      return { tasks: tasksScore, attendance: attendanceScore, total, start, end };
    },
    onSuccess: (r) => setComputed(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!computed) throw new Error("احسب الدرجات أولاً");
      const { error } = await supabase.from("evaluations").insert({
        employee_id: employeeId,
        evaluator_id: employee?.id ?? null,
        period,
        period_start: computed.start,
        period_end: computed.end,
        tasks_score: computed.tasks,
        attendance_score: computed.attendance,
        criteria_score: Number(criteriaScore),
        total_score: computed.total,
        grade: gradeFor(computed.total),
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ التقييم");
      setComputed(null);
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["evaluations-page"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("submit_evaluation", { _evaluation_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إرسال التقييم إلى مسار الاعتماد");
      void qc.invalidateQueries({ queryKey: ["evaluations-page"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (v: { id: string; action: "approved" | "returned"; note?: string }) => {
      const { error } = await supabase.rpc("decide_evaluation", {
        _evaluation_id: v.id,
        _action: v.action,
        _note: v.note ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.action === "approved" ? "تم اعتماد المرحلة" : "تمت إعادة التقييم للتعديل");
      void qc.invalidateQueries({ queryKey: ["evaluations-page"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="space-y-6">
      <PageHeader
        title="تقييم الموظفين"
        description="الدرجة النهائية = 50% إنجاز المهام + 30% الالتزام بالدوام + 20% معايير المدير"
      />

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تقييم جديد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>الموظف</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الموظف" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name}
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
              <div className="space-y-2">
                <Label>درجة معايير المدير (0-100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={criteriaScore}
                  onChange={(e) => setCriteriaScore(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => compute.mutate()}
                disabled={!employeeId || compute.isPending}
              >
                <Sparkles className="size-4" /> احتساب الدرجات
              </Button>
              <Button onClick={() => save.mutate()} disabled={!computed || save.isPending}>
                حفظ التقييم
              </Button>
            </div>

            {computed && (
              <div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-4">
                <Metric label="إنجاز المهام" value={computed.tasks} />
                <Metric label="الالتزام بالدوام" value={computed.attendance} />
                <Metric label="معايير المدير" value={Number(criteriaScore)} />
                <Metric label="الدرجة النهائية" value={computed.total} highlight />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">سجل التقييمات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {evaluations.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد تقييمات بعد.</p>
          )}
          {evaluations.map((ev) => {
            const stage = ev.approval_stage as ApprovalStage;
            const canAct = canActOnStage(stage, { isManager, isHR, isDirector });
            return (
              <div key={ev.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{nameOf(ev.employee_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {PERIOD_LABELS[ev.period]} — {formatDate(ev.period_start)} إلى {formatDate(ev.period_end)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      مهام {ev.tasks_score} — دوام {ev.attendance_score} — معايير {ev.criteria_score}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ev.grade ?? gradeFor(ev.total_score)}</Badge>
                    <span className="font-display text-xl font-bold text-primary">{ev.total_score}</span>
                    <Badge variant={stageBadgeVariant(stage)}>
                      {stage === "approved" && <CheckCircle2 className="ml-1 size-3" />}
                      {STAGE_LABELS[stage]}
                    </Badge>
                  </div>
                </div>

                <ApprovalTrack stage={stage} />

                {ev.return_reason && (
                  <p className="text-xs text-destructive">سبب الإعادة: {ev.return_reason}</p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {(stage === "draft" || stage === "returned") && isManager && (
                    <Button size="sm" onClick={() => submit.mutate(ev.id)} disabled={submit.isPending}>
                      <Send className="size-4" /> إرسال للاعتماد
                    </Button>
                  )}
                  {canAct && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => decide.mutate({ id: ev.id, action: "approved" })}
                        disabled={decide.isPending}
                      >
                        <CheckCircle2 className="size-4" /> اعتماد المرحلة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const note = window.prompt("سبب الإعادة للتعديل:")?.trim();
                          if (!note) return;
                          decide.mutate({ id: ev.id, action: "returned", note });
                        }}
                        disabled={decide.isPending}
                      >
                        <RotateCcw className="size-4" /> إعادة للتعديل
                      </Button>
                    </>
                  )}
                </div>

                {(trail[ev.id]?.length ?? 0) > 0 && (
                  <ul className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
                    {trail[ev.id]!.map((a) => (
                      <li key={a.id}>
                        {formatDate(a.created_at.slice(0, 10))} — {STAGE_LABELS[a.stage as ApprovalStage]}:{" "}
                        {a.action === "submitted"
                          ? "إرسال للاعتماد"
                          : a.action === "approved"
                            ? "اعتماد"
                            : "إعادة للتعديل"}
                        {a.note ? ` (${a.note})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          highlight
            ? "font-display text-3xl font-bold text-primary"
            : "font-display text-2xl font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}
