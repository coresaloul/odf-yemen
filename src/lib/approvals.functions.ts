import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const timeSchema = z
  .string()
  .trim()
  .max(8)
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listPending } = await import("@/lib/approvals.server");
    return listPending(context.userId);
  });

export const submitTaskForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ taskId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { submitTask } = await import("@/lib/approvals.server");
    return submitTask(context.userId, data.taskId);
  });

export const decideTaskApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        taskId: z.string().uuid(),
        action: z.enum(["approved", "returned"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { decideTask } = await import("@/lib/approvals.server");
    return decideTask(context.userId, data.taskId, data.action, data.note);
  });

/* ───────────── تصحيح الحضور ───────────── */

export const listCorrectionRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, loadActor, canSupervise } = await import("@/lib/attendance.server");
    const actor = await loadActor(context.userId);
    const { data } = await admin()
      .from("attendance_correction_requests")
      .select("*, employees:employee_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(300);
    const rows = data ?? [];
    if (actor.isDirector || actor.isHr) return rows;
    const out = [];
    for (const r of rows) {
      if (r.employee_id === actor.employeeId || (await canSupervise(actor, r.employee_id)))
        out.push(r);
    }
    return out;
  });

export const saveCorrectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        employee_id: z.string().uuid(),
        work_date: z.string(),
        correction_type: z.string().min(1),
        requested_check_in: timeSchema,
        requested_check_out: timeSchema,
        reason: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveCorrection } = await import("@/lib/approvals.server");
    return saveCorrection(context.userId, data);
  });

export const submitCorrectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { submitCorrection } = await import("@/lib/approvals.server");
    return submitCorrection(context.userId, data.id);
  });

export const deleteCorrectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteCorrection } = await import("@/lib/approvals.server");
    return deleteCorrection(context.userId, data.id);
  });

export const decideCorrectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approved", "returned"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { decideCorrection } = await import("@/lib/approvals.server");
    return decideCorrection(context.userId, data.id, data.action, data.note);
  });
