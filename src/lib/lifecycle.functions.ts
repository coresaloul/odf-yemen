import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const dateStr = z.string().min(8).max(10);
const kindEnum = z.enum(["onboarding", "offboarding"]);

export const listLifecycleData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listLifecycle } = await import("@/lib/lifecycle.server");
    return listLifecycle(context.userId);
  });

export const getLifecycleDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ employee_id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { getEmployeeLifecycle } = await import("@/lib/lifecycle.server");
    return getEmployeeLifecycle(context.userId, data.employee_id);
  });

export const generateLifecycleChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ employee_id: uuid, kind: kindEnum }).parse(data))
  .handler(async ({ data, context }) => {
    const { generateChecklist } = await import("@/lib/lifecycle.server");
    return generateChecklist(context.userId, data.employee_id, data.kind);
  });

export const toggleLifecycleItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: uuid, done: z.boolean(), note: z.string().max(1000).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { toggleChecklistItem } = await import("@/lib/lifecycle.server");
    return toggleChecklistItem(context.userId, data.id, data.done, data.note);
  });

export const addLifecycleItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employee_id: uuid,
        kind: kindEnum,
        title: z.string().min(2).max(200),
        owner_role: z.string().min(2).max(30),
        due_date: dateStr.nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { addChecklistItem } = await import("@/lib/lifecycle.server");
    return addChecklistItem(context.userId, data);
  });

export const addLifecycleEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employee_id: uuid,
        event_type: z.string().min(2).max(40),
        title: z.string().min(2).max(200),
        details: z.string().max(4000).nullable().optional(),
        event_date: dateStr.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { addEvent } = await import("@/lib/lifecycle.server");
    return addEvent(
      context.userId,
      data.employee_id,
      data.event_type,
      data.title,
      data.details ?? null,
      data.event_date,
    );
  });

export const saveEmploymentMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employee_id: uuid,
        movement_type: z.enum([
          "promotion",
          "transfer",
          "salary_change",
          "title_change",
          "contract_renewal",
        ]),
        effective_date: dateStr,
        from_value: z.string().max(300).nullable().optional(),
        to_value: z.string().max(300).nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
        apply: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveMovement } = await import("@/lib/lifecycle.server");
    return saveMovement(context.userId, data);
  });

export const confirmEmployeeProbation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ employee_id: uuid, note: z.string().max(2000).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { confirmProbation } = await import("@/lib/lifecycle.server");
    return confirmProbation(context.userId, data.employee_id, data.note);
  });

export const startEmployeeOffboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employee_id: uuid,
        termination_type: z.string().min(2).max(40),
        notice_date: dateStr.nullable().optional(),
        last_working_day: dateStr,
        reason: z.string().max(4000).nullable().optional(),
        settlement_amount: z.number().min(0).max(100000000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { startOffboarding } = await import("@/lib/lifecycle.server");
    return startOffboarding(context.userId, data);
  });

export const completeEmployeeOffboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ employee_id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { completeOffboarding } = await import("@/lib/lifecycle.server");
    return completeOffboarding(context.userId, data.employee_id);
  });
