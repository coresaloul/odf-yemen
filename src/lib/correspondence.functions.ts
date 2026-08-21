/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const id = z.string().uuid();
const nullableText = z.string().trim().max(4000).nullable().optional();
const correspondenceInput = z.object({
  id: id.nullable().optional(),
  direction: z.enum(["incoming", "outgoing"]),
  subject: z.string().trim().min(2).max(500),
  body: nullableText,
  sender_name: z.string().trim().max(250).nullable().optional(),
  recipient_name: z.string().trim().max(250).nullable().optional(),
  external_reference: z.string().trim().max(120).nullable().optional(),
  correspondence_date: z.string().min(8).max(10),
  due_date: z.string().min(8).max(10).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  confidentiality: z.enum(["normal", "internal", "confidential", "very_confidential"]),
  assigned_to: id.nullable().optional(),
  notes: nullableText,
});

async function loadActor(admin: any, userId: string) {
  const { getRolesOf } = await import("@/lib/roles");
  const roles = await getRolesOf(admin, userId);
  const { data: employee } = await admin
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    userId,
    employeeId: employee?.id ?? null,
    canManage: roles.includes("executive_director") || roles.includes("hr"),
  };
}

function canAccess(
  row: { created_by: string; assigned_to: string | null },
  actor: Awaited<ReturnType<typeof loadActor>>,
) {
  return actor.canManage || row.created_by === actor.userId || row.assigned_to === actor.employeeId;
}

export const listCorrespondence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdmin } = await import("@/lib/org.server");
    const admin = getAdmin();
    const actor = await loadActor(admin, context.userId);
    const { data: rows, error } = await (admin.from("correspondence" as never) as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: employees, error: employeesError } = await admin
      .from("employees")
      .select("id, full_name")
      .order("full_name");
    if (employeesError) throw new Error(employeesError.message);
    return {
      rows: actor.canManage
        ? (rows ?? [])
        : (rows ?? []).filter((row: { created_by: string; assigned_to: string | null }) =>
            canAccess(row, actor),
          ),
      employees: employees ?? [],
      userId: context.userId,
    };
  });

export const saveCorrespondence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => correspondenceInput.parse(data))
  .handler(async ({ data, context }) => {
    const { getAdmin, writeAudit } = await import("@/lib/org.server");
    const admin = getAdmin();
    const actor = await loadActor(admin, context.userId);
    const payload = {
      direction: data.direction,
      subject: data.subject,
      body: data.body ?? null,
      sender_name: data.sender_name ?? null,
      recipient_name: data.recipient_name ?? null,
      external_reference: data.external_reference ?? null,
      correspondence_date: data.correspondence_date,
      due_date: data.due_date ?? null,
      priority: data.priority,
      confidentiality: data.confidentiality,
      assigned_to: data.assigned_to ?? null,
      notes: data.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    let correspondenceId = data.id ?? null;
    if (correspondenceId) {
      const { data: current } = await (admin.from("correspondence" as never) as any)
        .select("status, created_by, assigned_to")
        .eq("id", correspondenceId)
        .maybeSingle();
      if (!current) throw new Error("المعاملة غير موجودة");
      if (!canAccess(current, actor)) throw new Error("لا تملك صلاحية تعديل هذه المعاملة");
      if (!["draft", "registered"].includes(String(current.status)))
        throw new Error("لا يمكن تعديل معاملة قيد الإجراء أو مغلقة");
      const { error } = await (admin.from("correspondence" as never) as any)
        .update(payload)
        .eq("id", correspondenceId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await (admin.from("correspondence" as never) as any)
        .insert({ ...payload, created_by: context.userId, status: "draft" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      correspondenceId = row.id;
    }
    await writeAudit(context.userId, {
      action: data.id ? "تعديل" : "إضافة",
      entity: data.direction === "incoming" ? "وارد" : "صادر",
      entity_id: correspondenceId,
      entity_label: data.subject,
    });
    return { id: correspondenceId };
  });

export const submitCorrespondence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id }).parse(data))
  .handler(async ({ data, context }) => {
    const { getAdmin } = await import("@/lib/org.server");
    const admin = getAdmin();
    const actor = await loadActor(admin, context.userId);
    const { data: row, error: readError } = await (admin.from("correspondence" as never) as any)
      .select("id, direction, status")
      .eq("id", data.id)
      .maybeSingle();
    if (readError || !row) throw new Error("المعاملة غير موجودة");
    const { data: accessRow } = await (admin.from("correspondence" as never) as any)
      .select("created_by, assigned_to")
      .eq("id", data.id)
      .maybeSingle();
    if (!accessRow || !canAccess(accessRow, actor))
      throw new Error("لا تملك صلاحية تسجيل هذه المعاملة");
    if (row.status !== "draft") throw new Error("المعاملة مرسلة مسبقاً");
    const referenceNo = `${row.direction === "incoming" ? "IN" : "OUT"}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const { error } = await (admin.from("correspondence" as never) as any)
      .update({
        reference_no: referenceNo,
        status: "registered",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await (admin.from("correspondence_actions" as never) as any).insert({
      correspondence_id: data.id,
      action: "submitted",
      actor_id: context.userId,
    });
    return { referenceNo };
  });

export const updateCorrespondenceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id,
        status: z.enum(["in_progress", "waiting_response", "completed", "closed", "cancelled"]),
        note: nullableText,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getAdmin } = await import("@/lib/org.server");
    const admin = getAdmin();
    const actor = await loadActor(admin, context.userId);
    const { data: accessRow } = await (admin.from("correspondence" as never) as any)
      .select("created_by, assigned_to")
      .eq("id", data.id)
      .maybeSingle();
    if (!accessRow || !canAccess(accessRow, actor))
      throw new Error("لا تملك صلاحية تحديث هذه المعاملة");
    const { error } = await (admin.from("correspondence" as never) as any)
      .update({
        status: data.status,
        notes: data.note ?? null,
        updated_at: new Date().toISOString(),
        ...(data.status === "completed" || data.status === "closed"
          ? { completed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await (admin.from("correspondence_actions" as never) as any).insert({
      correspondence_id: data.id,
      action: data.status === "closed" ? "closed" : "status_changed",
      actor_id: context.userId,
      note: data.note ?? null,
    });
    return { ok: true };
  });

export const deleteCorrespondence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id }).parse(data))
  .handler(async ({ data, context }) => {
    const { getAdmin } = await import("@/lib/org.server");
    const admin = getAdmin();
    const actor = await loadActor(admin, context.userId);
    const { data: row } = await (admin.from("correspondence" as never) as any)
      .select("created_by, assigned_to, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || !canAccess(row, actor) || (!actor.canManage && row.status !== "draft"))
      throw new Error("لا تملك صلاحية حذف هذه المعاملة");
    const { error } = await (admin.from("correspondence" as never) as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
