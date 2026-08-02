import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const periodSchema = z.enum(["monthly", "quarterly", "semiannual", "annual"]);

export const getAutoScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employeeId: z.string().uuid(),
        start: z.string().min(10),
        end: z.string().min(10),
        period: periodSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadEvalContext, canViewEmployee, computeAuto, loadTemplates } = await import(
      "@/lib/evaluation.server"
    );
    const ctx = await loadEvalContext(context.userId);
    if (!(await canViewEmployee(ctx, data.employeeId)))
      throw new Error("لا تملك صلاحية عرض بيانات هذا الموظف");
    const [auto, templates] = await Promise.all([
      computeAuto(data.employeeId, data.start, data.end),
      loadTemplates(data.period),
    ]);
    return { auto, templates };
  });

export const saveEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employeeId: z.string().uuid(),
        period: periodSchema,
        periodStart: z.string().min(10),
        periodEnd: z.string().min(10),
        behavior: z
          .array(
            z.object({
              templateId: z.string().uuid(),
              score: z.number().min(0).max(1000),
              note: z.string().trim().max(500).optional(),
            }),
          )
          .default([]),
        notes: z.string().trim().max(2000).optional(),
        strengths: z.string().trim().max(2000).optional(),
        improvements: z.string().trim().max(2000).optional(),
        goals: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(300),
              metric: z.string().trim().max(300).optional(),
              targetDate: z.string().max(10).optional(),
            }),
          )
          .default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      loadEvalContext,
      canEvaluate,
      computeAuto,
      loadTemplates,
      buildTotals,
      writeCriteriaRows,
    } = await import("@/lib/evaluation.server");
    const { gradeFor } = await import("@/lib/hr");

    const ctx = await loadEvalContext(context.userId);
    if (!(ctx.isHr || (await canEvaluate(ctx, data.employeeId))))
      throw new Error("لا تملك صلاحية تقييم هذا الموظف");

    const [auto, templates] = await Promise.all([
      computeAuto(data.employeeId, data.periodStart, data.periodEnd),
      loadTemplates(data.period),
    ]);
    const totals = buildTotals(templates, auto, data.behavior);

    const { data: existing } = await supabaseAdmin
      .from("evaluations")
      .select("id, approval_stage")
      .eq("employee_id", data.employeeId)
      .eq("period", data.period)
      .eq("period_start", data.periodStart)
      .maybeSingle();

    if (existing && !["draft", "returned"].includes(String(existing.approval_stage)))
      throw new Error("يوجد تقييم لهذه الفترة داخل مسار الاعتماد بالفعل");

    const payload = {
      employee_id: data.employeeId,
      evaluator_id: context.userId,
      period: data.period as never,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      tasks_score: auto.tasks.score,
      attendance_score: auto.attendance.score,
      criteria_score: totals.criteriaScore,
      total_score: totals.total,
      grade: gradeFor(totals.total),
      notes: data.notes ?? null,
      strengths: data.strengths ?? null,
      improvements: data.improvements ?? null,
      approval_stage: "draft" as never,
      updated_at: new Date().toISOString(),
    };

    let evaluationId = existing?.id ?? "";
    if (existing) {
      const { error } = await supabaseAdmin.from("evaluations").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("evaluations")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      evaluationId = inserted.id;
    }

    await writeCriteriaRows(evaluationId, templates, auto, totals);

    await supabaseAdmin.from("evaluation_goals").delete().eq("evaluation_id", evaluationId);
    if (data.goals.length) {
      await supabaseAdmin.from("evaluation_goals").insert(
        data.goals.map((g) => ({
          evaluation_id: evaluationId,
          title: g.title,
          metric: g.metric ?? null,
          target_date: g.targetDate || null,
        })) as never,
      );
    }

    return { id: evaluationId, total: totals.total };
  });

export const updateGoalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        goalId: z.string().uuid(),
        status: z.enum(["planned", "in_progress", "achieved", "missed"]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadEvalContext, canEvaluate } = await import("@/lib/evaluation.server");
    const { data: goal } = await supabaseAdmin
      .from("evaluation_goals")
      .select("id, evaluation_id, evaluations(employee_id)")
      .eq("id", data.goalId)
      .maybeSingle();
    if (!goal) throw new Error("الهدف غير موجود");
    const employeeId = (goal as unknown as { evaluations: { employee_id: string } }).evaluations
      .employee_id;
    const ctx = await loadEvalContext(context.userId);
    if (!(ctx.isHr || (await canEvaluate(ctx, employeeId))))
      throw new Error("لا تملك صلاحية تعديل هذا الهدف");
    const { error } = await supabaseAdmin
      .from("evaluation_goals")
      .update({ status: data.status, achievement_note: data.note ?? null })
      .eq("id", data.goalId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acknowledgeEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        evaluationId: z.string().uuid(),
        status: z.enum(["acknowledged", "disputed"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadEvalContext } = await import("@/lib/evaluation.server");
    const ctx = await loadEvalContext(context.userId);
    const { data: ev } = await supabaseAdmin
      .from("evaluations")
      .select("id, employee_id, approval_stage")
      .eq("id", data.evaluationId)
      .maybeSingle();
    if (!ev) throw new Error("التقييم غير موجود");
    if (ev.employee_id !== ctx.employeeId) throw new Error("هذا الإجراء يخص صاحب التقييم فقط");
    if (String(ev.approval_stage) !== "approved")
      throw new Error("لا يمكن الإقرار قبل الاعتماد النهائي");
    if (data.status === "disputed" && !data.note) throw new Error("يرجى كتابة سبب التظلم");

    const { error } = await supabaseAdmin
      .from("evaluations")
      .update({
        acknowledgement_status: data.status,
        acknowledged_at: new Date().toISOString(),
        acknowledgement_note: data.note ?? null,
      })
      .eq("id", ev.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSelfAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        period: periodSchema,
        periodStart: z.string().min(10),
        periodEnd: z.string().min(10),
        scores: z.record(z.string(), z.number().min(0).max(1000)).default({}),
        achievements: z.string().trim().max(2000).optional(),
        challenges: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadEvalContext } = await import("@/lib/evaluation.server");
    const ctx = await loadEvalContext(context.userId);
    if (!ctx.employeeId) throw new Error("حسابك غير مرتبط بسجل موظف");
    const { error } = await supabaseAdmin.from("evaluation_self_assessments").upsert(
      {
        employee_id: ctx.employeeId,
        period: data.period as never,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        scores: data.scores as never,
        achievements: data.achievements ?? null,
        challenges: data.challenges ?? null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id,period,period_start" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
