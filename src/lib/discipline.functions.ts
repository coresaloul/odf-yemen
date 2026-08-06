import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const dateStr = z.string().min(8).max(10);

export const listDisciplineData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listDiscipline } = await import("@/lib/discipline.server");
    return listDiscipline(context.userId);
  });

export const saveRecognitionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: uuid.nullable().optional(),
        employee_id: uuid,
        type_id: uuid,
        title: z.string().min(2).max(200),
        reason: z.string().max(4000).nullable().optional(),
        award_date: dateStr,
        amount: z.number().min(0).max(100000000),
        target_month: dateStr.nullable().optional(),
        attachment_url: z.string().max(1000).nullable().optional(),
        submit: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveRecognition } = await import("@/lib/discipline.server");
    return saveRecognition(context.userId, data);
  });

export const saveSanctionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: uuid.nullable().optional(),
        employee_id: uuid,
        type_id: uuid,
        violation_date: dateStr,
        discovered_date: dateStr,
        violation_description: z.string().min(3).max(4000),
        employee_statement: z.string().max(4000).nullable().optional(),
        penalty_days: z.number().min(0).max(30),
        amount: z.number().min(0).max(100000000),
        target_month: dateStr.nullable().optional(),
        attachment_url: z.string().max(1000).nullable().optional(),
        submit: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveSanction } = await import("@/lib/discipline.server");
    return saveSanction(context.userId, data);
  });

export const deleteDisciplineRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ kind: z.enum(["recognition", "sanction"]), id: uuid }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { deleteRecord } = await import("@/lib/discipline.server");
    return deleteRecord(context.userId, data.kind, data.id);
  });

export const decideDisciplineRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        kind: z.enum(["recognition", "sanction"]),
        id: uuid,
        action: z.enum(["approved", "returned"]),
        note: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { decideRecord } = await import("@/lib/discipline.server");
    return decideRecord(context.userId, data.kind, data.id, data.action, data.note);
  });

export const submitDisciplineAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid, note: z.string().min(3).max(4000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { submitAppeal } = await import("@/lib/discipline.server");
    return submitAppeal(context.userId, data.id, data.note);
  });

export const decideDisciplineAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: uuid,
        decision: z.enum(["accepted", "rejected"]),
        note: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { decideAppeal } = await import("@/lib/discipline.server");
    return decideAppeal(context.userId, data.id, data.decision, data.note);
  });

export const getEmployeeSanctionHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ employee_id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { employeeSanctionHistory } = await import("@/lib/discipline.server");
    return employeeSanctionHistory(data.employee_id);
  });
