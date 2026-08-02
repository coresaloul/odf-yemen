import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, Send, ThumbsUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApprovalTrack } from "./ApprovalTrack";
import { acknowledgeEvaluation } from "@/lib/evaluation.functions";
import { submitEvaluation, decideEvaluation } from "@/lib/evaluation-approval.functions";
import {
  STAGE_LABELS,
  canActOnStage,
  stageBadgeVariant,
  type ApprovalStage,
} from "@/lib/evaluation-approval";
import { PERIOD_LABELS, acknowledgementLabel, formatDate, gradeFor } from "@/lib/hr";

export type EvaluationRow = {
  id: string;
  employee_id: string;
  period: string;
  period_start: string;
  period_end: string;
  tasks_score: number;
  attendance_score: number;
  criteria_score: number;
  total_score: number;
  grade: string | null;
  notes: string | null;
  strengths: string | null;
  improvements: string | null;
  approval_stage: string;
  return_reason: string | null;
  acknowledgement_status: string;
  acknowledgement_note: string | null;
};

export type CriterionRow = {
  id: string;
  evaluation_id: string;
  name: string;
  kind: string;
  weight: number;
  score: number;
  max_score: number;
  note: string | null;
};

export type GoalRow = {
  id: string;
  evaluation_id: string;
  title: string;
  metric: string | null;
  target_date: string | null;
  status: string;
};

export type ApprovalRow = {
  id: string;
  evaluation_id: string;
  stage: string;
  action: string;
  note: string | null;
  created_at: string;
};

const GOAL_LABELS: Record<string, string> = {
  planned: "مخطط",
  in_progress: "قيد التنفيذ",
  achieved: "تم تحقيقه",
  missed: "لم يتحقق",
};

export function EvaluationRecord({
  ev,
  employeeName,
  criteria,
  goals,
  trail,
  actor,
  isOwner,
  onChanged,
}: {
  ev: EvaluationRow;
  employeeName: string;
  criteria: CriterionRow[];
  goals: GoalRow[];
  trail: ApprovalRow[];
  actor: { isManager: boolean; isHR: boolean; isDirector: boolean };
  isOwner: boolean;
  onChanged: () => void;
}) {
  const stage = ev.approval_stage as ApprovalStage;
  const canAct = canActOnStage(stage, actor);
  const submitFn = useServerFn(submitEvaluation);
  const decideFn = useServerFn(decideEvaluation);
  const ackFn = useServerFn(acknowledgeEvaluation);

  const submit = useMutation({
    mutationFn: async () => {
      await submitFn({ data: { evaluationId: ev.id } });
    },
    onSuccess: () => {
      toast.success("تم إرسال التقييم إلى مسار الاعتماد");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (v: { action: "approved" | "returned"; note?: string }) => {
      await decideFn({
        data: { evaluationId: ev.id, action: v.action, ...(v.note ? { note: v.note } : {}) },
      });
    },
    onSuccess: (_d, v) => {
      toast.success(v.action === "approved" ? "تم اعتماد المرحلة" : "تمت إعادة التقييم للتعديل");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acknowledge = useMutation({
    mutationFn: async (v: { status: "acknowledged" | "disputed"; note?: string }) => {
      await ackFn({
        data: { evaluationId: ev.id, status: v.status, ...(v.note ? { note: v.note } : {}) },
      });
    },
    onSuccess: () => {
      toast.success("تم تسجيل إقرارك");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{employeeName}</p>
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

      {criteria.length > 0 && (
        <ul className="grid gap-1 border-t pt-2 text-xs text-muted-foreground sm:grid-cols-2">
          {criteria.map((c) => (
            <li key={c.id}>
              {c.name}: {c.score}/{c.max_score} (وزن {c.weight}%)
              {c.note ? ` — ${c.note}` : ""}
            </li>
          ))}
        </ul>
      )}

      {(ev.strengths || ev.improvements || ev.notes) && (
        <div className="space-y-1 border-t pt-2 text-xs">
          {ev.strengths && <p>نقاط القوة: {ev.strengths}</p>}
          {ev.improvements && <p>مجالات التحسين: {ev.improvements}</p>}
          {ev.notes && <p className="text-muted-foreground">ملاحظات: {ev.notes}</p>}
        </div>
      )}

      {goals.length > 0 && (
        <ul className="space-y-1 border-t pt-2 text-xs">
          {goals.map((g) => (
            <li key={g.id}>
              🎯 {g.title}
              {g.metric ? ` — ${g.metric}` : ""}
              {g.target_date ? ` — حتى ${formatDate(g.target_date)}` : ""}{" "}
              <Badge variant="outline">{GOAL_LABELS[g.status] ?? g.status}</Badge>
            </li>
          ))}
        </ul>
      )}

      {ev.return_reason && (
        <p className="text-xs text-destructive">سبب الإعادة: {ev.return_reason}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(stage === "draft" || stage === "returned") && (actor.isManager || actor.isHR) && (
          <Button size="sm" onClick={() => submit.mutate()} disabled={submit.isPending}>
            <Send className="size-4" /> إرسال للاعتماد
          </Button>
        )}
        {canAct && (
          <>
            <Button
              size="sm"
              onClick={() => decide.mutate({ action: "approved" })}
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
                decide.mutate({ action: "returned", note });
              }}
              disabled={decide.isPending}
            >
              <RotateCcw className="size-4" /> إعادة للتعديل
            </Button>
          </>
        )}
        {isOwner && stage === "approved" && ev.acknowledgement_status === "pending" && (
          <>
            <Button
              size="sm"
              onClick={() => acknowledge.mutate({ status: "acknowledged" })}
              disabled={acknowledge.isPending}
            >
              <ThumbsUp className="size-4" /> إقرار بالاطلاع
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const note = window.prompt("سبب التظلم:")?.trim();
                if (!note) return;
                acknowledge.mutate({ status: "disputed", note });
              }}
              disabled={acknowledge.isPending}
            >
              <AlertTriangle className="size-4" /> تسجيل تظلم
            </Button>
          </>
        )}
        {stage === "approved" && (
          <Badge variant="secondary">{acknowledgementLabel(ev.acknowledgement_status)}</Badge>
        )}
      </div>

      {ev.acknowledgement_note && (
        <p className="text-xs text-muted-foreground">ملاحظة الموظف: {ev.acknowledgement_note}</p>
      )}

      {trail.length > 0 && (
        <ul className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
          {trail.map((a) => (
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
}
