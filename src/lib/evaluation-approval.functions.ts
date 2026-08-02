import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = {
  isDirector: boolean;
  isHr: boolean;
  employeeId: string | null;
  managedDepartments: string[];
  managedSections: string[];
};

async function loadContext(userId: string): Promise<Ctx> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

async function canSupervise(ctx: Ctx, employeeId: string) {
  if (ctx.isDirector) return true;
  if (!ctx.employeeId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

export const submitEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ evaluationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ev } = await supabaseAdmin
      .from("evaluations")
      .select("id, employee_id, approval_stage")
      .eq("id", data.evaluationId)
      .maybeSingle();
    if (!ev) throw new Error("التقييم غير موجود");
    if (!["draft", "returned"].includes(String(ev.approval_stage)))
      throw new Error("التقييم مُرسل للاعتماد بالفعل");

    const ctx = await loadContext(context.userId);
    const allowed = ctx.isDirector || ctx.isHr || (await canSupervise(ctx, ev.employee_id));
    if (!allowed) throw new Error("لا تملك صلاحية إرسال هذا التقييم");

    const { error } = await supabaseAdmin
      .from("evaluations")
      .update({
        approval_stage: "pending_manager",
        submitted_at: new Date().toISOString(),
        return_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ev.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("evaluation_approvals").insert({
      evaluation_id: ev.id,
      stage: "pending_manager",
      action: "submitted",
      actor_id: context.userId,
    });
    return { ok: true };
  });

export const decideEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        evaluationId: z.string().uuid(),
        action: z.enum(["approved", "returned"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ev } = await supabaseAdmin
      .from("evaluations")
      .select("id, employee_id, approval_stage")
      .eq("id", data.evaluationId)
      .maybeSingle();
    if (!ev) throw new Error("التقييم غير موجود");

    const stage = String(ev.approval_stage);
    const ctx = await loadContext(context.userId);
    let allowed = false;
    let nextStage: "pending_hr" | "pending_director" | "approved";
    if (stage === "pending_manager") {
      allowed = ctx.isDirector || (await canSupervise(ctx, ev.employee_id));
      nextStage = "pending_hr";
    } else if (stage === "pending_hr") {
      allowed = ctx.isHr;
      nextStage = "pending_director";
    } else if (stage === "pending_director") {
      allowed = ctx.isDirector;
      nextStage = "approved";
    } else {
      throw new Error("لا توجد مرحلة اعتماد قائمة لهذا التقييم");
    }
    if (!allowed) throw new Error("لا تملك صلاحية الاعتماد في هذه المرحلة");

    await supabaseAdmin.from("evaluation_approvals").insert({
      evaluation_id: ev.id,
      stage: stage as never,
      action: data.action,
      note: data.note ?? null,
      actor_id: context.userId,
    });

    const now = new Date().toISOString();
    if (data.action === "returned") {
      const { error } = await supabaseAdmin
        .from("evaluations")
        .update({
          approval_stage: "returned",
          approved: false,
          return_reason: data.note ?? null,
          updated_at: now,
        })
        .eq("id", ev.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const stamp =
      stage === "pending_manager"
        ? { manager_approved_by: context.userId, manager_approved_at: now }
        : stage === "pending_hr"
          ? { hr_approved_by: context.userId, hr_approved_at: now }
          : { director_approved_by: context.userId, director_approved_at: now };

    const { error } = await supabaseAdmin
      .from("evaluations")
      .update({
        ...stamp,
        approval_stage: nextStage,
        approved: nextStage === "approved",
        return_reason: null,
        updated_at: now,
      })
      .eq("id", ev.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
