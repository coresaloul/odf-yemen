import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  scoreAttendance,
  scoreTasks,
  weightedAverage,
  type AttendanceScoreDetails,
  type TaskScoreDetails,
} from "./evaluation-scoring";

export type EvalCtx = {
  isDirector: boolean;
  isHr: boolean;
  employeeId: string | null;
  managedDepartments: string[];
  managedSections: string[];
};

export async function loadEvalContext(userId: string): Promise<EvalCtx> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roleList = (roles ?? []).map((r) => String(r.role));
  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  const employeeId = emp?.id ?? null;
  let managedDepartments: string[] = [];
  let managedSections: string[] = [];
  if (employeeId) {
    const [{ data: deps }, { data: secs }] = await Promise.all([
      supabaseAdmin.from("departments").select("id").eq("manager_id", employeeId),
      supabaseAdmin.from("sections").select("id").eq("manager_id", employeeId),
    ]);
    managedDepartments = (deps ?? []).map((d) => d.id);
    managedSections = (secs ?? []).map((s) => s.id);
  }
  return {
    isDirector: roleList.includes("executive_director"),
    isHr: roleList.includes("hr"),
    employeeId,
    managedDepartments,
    managedSections,
  };
}

export async function canEvaluate(ctx: EvalCtx, employeeId: string) {
  if (ctx.isDirector) return true;
  if (!ctx.employeeId) return false;
  const { data: e } = await supabaseAdmin
    .from("employees")
    .select("manager_id, department_id, section_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (!e) return false;
  return (
    e.manager_id === ctx.employeeId ||
    (!!e.department_id && ctx.managedDepartments.includes(e.department_id)) ||
    (!!e.section_id && ctx.managedSections.includes(e.section_id))
  );
}

export async function canViewEmployee(ctx: EvalCtx, employeeId: string) {
  if (ctx.isHr || ctx.employeeId === employeeId) return true;
  return canEvaluate(ctx, employeeId);
}

export type AutoScores = {
  tasks: { score: number; details: TaskScoreDetails };
  attendance: { score: number; details: AttendanceScoreDetails };
};

export async function computeAuto(
  employeeId: string,
  start: string,
  end: string,
): Promise<AutoScores> {
  const [tasksRes, attRes] = await Promise.all([
    supabaseAdmin
      .from("tasks")
      .select("status, progress, weight, due_date, completed_at")
      .eq("assignee_id", employeeId)
      .gte("start_date", start)
      .lte("start_date", end),
    supabaseAdmin
      .from("attendance_records")
      .select("status, late_minutes, early_leave_minutes")
      .eq("employee_id", employeeId)
      .gte("work_date", start)
      .lte("work_date", end),
  ]);
  return {
    tasks: scoreTasks(tasksRes.data ?? []),
    attendance: scoreAttendance(attRes.data ?? []),
  };
}

export type TemplateRow = {
  id: string;
  name: string;
  kind: string;
  weight: number;
  max_score: number;
};

export async function loadTemplates(period: string): Promise<TemplateRow[]> {
  const { data } = await supabaseAdmin
    .from("evaluation_criteria_templates")
    .select("id, name, kind, weight, max_score, applies_periods, active, sort_order")
    .eq("active", true)
    .order("sort_order");
  return ((data ?? []) as (TemplateRow & { applies_periods: string[] })[])
    .filter((t) => !t.applies_periods?.length || t.applies_periods.includes(period))
    .map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      weight: Number(t.weight),
      max_score: Number(t.max_score),
    }));
}

export type BehaviorInput = { templateId: string; score: number; note?: string | null };

export function buildTotals(
  templates: TemplateRow[],
  auto: AutoScores,
  behavior: BehaviorInput[],
) {
  const tasksT = templates.filter((t) => t.kind === "tasks");
  const attT = templates.filter((t) => t.kind === "attendance");
  const behT = templates.filter((t) => t.kind === "behavior");

  const tasksWeight = tasksT.reduce((s, t) => s + t.weight, 0);
  const attWeight = attT.reduce((s, t) => s + t.weight, 0);

  const behItems = behT.map((t) => {
    const found = behavior.find((b) => b.templateId === t.id);
    return {
      template: t,
      score: Math.max(0, Math.min(t.max_score, Number(found?.score ?? 0))),
      note: found?.note ?? null,
    };
  });
  const behWeight = behT.reduce((s, t) => s + t.weight, 0);
  const criteriaScore = weightedAverage(
    behItems.map((b) => ({ weight: b.template.weight, score: b.score, maxScore: b.template.max_score })),
  );

  const totalWeight = tasksWeight + attWeight + behWeight || 100;
  const total = Math.round(
    (auto.tasks.score * tasksWeight + auto.attendance.score * attWeight + criteriaScore * behWeight) /
      totalWeight,
  );

  return {
    tasksWeight,
    attWeight,
    behWeight,
    criteriaScore,
    total,
    behItems,
    tasksTemplateId: tasksT[0]?.id ?? null,
    attTemplateId: attT[0]?.id ?? null,
  };
}

export async function writeCriteriaRows(
  evaluationId: string,
  templates: TemplateRow[],
  auto: AutoScores,
  totals: ReturnType<typeof buildTotals>,
) {
  await supabaseAdmin.from("evaluation_criteria").delete().eq("evaluation_id", evaluationId);
  const rows: Record<string, unknown>[] = [];
  const tasksT = templates.find((t) => t.kind === "tasks");
  const attT = templates.find((t) => t.kind === "attendance");
  if (tasksT) {
    rows.push({
      evaluation_id: evaluationId,
      template_id: tasksT.id,
      kind: "tasks",
      name: tasksT.name,
      weight: Math.round(tasksT.weight),
      max_score: 100,
      score: auto.tasks.score,
      details: auto.tasks.details,
    });
  }
  if (attT) {
    rows.push({
      evaluation_id: evaluationId,
      template_id: attT.id,
      kind: "attendance",
      name: attT.name,
      weight: Math.round(attT.weight),
      max_score: 100,
      score: auto.attendance.score,
      details: auto.attendance.details,
    });
  }
  for (const b of totals.behItems) {
    rows.push({
      evaluation_id: evaluationId,
      template_id: b.template.id,
      kind: "behavior",
      name: b.template.name,
      weight: Math.round(b.template.weight),
      max_score: b.template.max_score,
      score: b.score,
      note: b.note,
    });
  }
  if (rows.length) await supabaseAdmin.from("evaluation_criteria").insert(rows as never);
}

export async function notifyEmployee(employeeId: string, title: string, body: string) {
  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("user_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (!emp?.user_id) return;
  await supabaseAdmin.from("notifications").insert({
    user_id: emp.user_id,
    title,
    body,
    type: "evaluation",
  });
}
