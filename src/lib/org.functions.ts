import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminRole } from "@/lib/roles";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function actorName(admin: AdminClient, userId: string) {
  const { data } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name ?? null;
}

export async function writeAudit(
  admin: AdminClient,
  actor: { id: string; name: string | null },
  entry: {
    action: string;
    entity: string;
    entity_id?: string | null;
    entity_label?: string | null;
    details?: Record<string, unknown> | null;
  },
) {
  await admin.from("audit_log").insert({
    actor_id: actor.id,
    actor_name: actor.name,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entity_id ?? null,
    entity_label: entry.entity_label ?? null,
    details: (entry.details ?? null) as never,
  });
}

const uuid = z.string().uuid();
const optUuid = z.string().uuid().nullable().optional();

/* ───────────────────────── الإدارات ───────────────────────── */

export const saveDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: optUuid,
        name: z.string().trim().min(2, "اسم الإدارة قصير جداً").max(120),
        description: z.string().trim().max(1000).nullable().optional(),
        manager_id: optUuid,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const admin = await getAdmin();
    const payload = {
      name: data.name,
      description: data.description ?? null,
      manager_id: data.manager_id ?? null,
    };
    let id = data.id ?? null;
    if (id) {
      const { error } = await admin.from("departments").update(payload).eq("id", id);
      if (error) throw new Error(mapDbError(error.message));
    } else {
      const { data: row, error } = await admin
        .from("departments")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(mapDbError(error.message));
      id = row.id;
    }
    await writeAudit(admin, { id: context.userId, name: await actorName(admin, context.userId) }, {
      action: data.id ? "تعديل" : "إضافة",
      entity: "إدارة",
      entity_id: id,
      entity_label: data.name,
    });
    return { id };
  });

export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const admin = await getAdmin();

    const [{ count: secCount }, { count: empCount }, { data: dept }] = await Promise.all([
      admin.from("sections").select("id", { count: "exact", head: true }).eq("department_id", data.id),
      admin.from("employees").select("id", { count: "exact", head: true }).eq("department_id", data.id),
      admin.from("departments").select("name").eq("id", data.id).maybeSingle(),
    ]);

    if ((secCount ?? 0) > 0 || (empCount ?? 0) > 0) {
      throw new Error(
        `لا يمكن حذف الإدارة: يتبعها ${secCount ?? 0} قسم و${empCount ?? 0} موظف. انقلهم إلى وحدة أخرى أولاً.`,
      );
    }
    const { error } = await admin.from("departments").delete().eq("id", data.id);
    if (error) throw new Error(mapDbError(error.message));

    await writeAudit(admin, { id: context.userId, name: await actorName(admin, context.userId) }, {
      action: "حذف",
      entity: "إدارة",
      entity_id: data.id,
      entity_label: dept?.name ?? null,
    });
    return { ok: true };
  });

/* ───────────────────────── الأقسام ───────────────────────── */

export const saveSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: optUuid,
        department_id: uuid,
        name: z.string().trim().min(2, "اسم القسم قصير جداً").max(120),
        description: z.string().trim().max(1000).nullable().optional(),
        manager_id: optUuid,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const admin = await getAdmin();
    const payload = {
      department_id: data.department_id,
      name: data.name,
      description: data.description ?? null,
      manager_id: data.manager_id ?? null,
    };
    let id = data.id ?? null;
    if (id) {
      const { error } = await admin.from("sections").update(payload).eq("id", id);
      if (error) throw new Error(mapDbError(error.message));
      // مزامنة موظفي القسم مع الإدارة الجديدة عند نقل القسم
      await admin
        .from("employees")
        .update({ department_id: data.department_id })
        .eq("section_id", id);
    } else {
      const { data: row, error } = await admin.from("sections").insert(payload).select("id").single();
      if (error) throw new Error(mapDbError(error.message));
      id = row.id;
    }
    await writeAudit(admin, { id: context.userId, name: await actorName(admin, context.userId) }, {
      action: data.id ? "تعديل" : "إضافة",
      entity: "قسم",
      entity_id: id,
      entity_label: data.name,
    });
    return { id };
  });

export const deleteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const admin = await getAdmin();
    const [{ count: empCount }, { data: sec }] = await Promise.all([
      admin.from("employees").select("id", { count: "exact", head: true }).eq("section_id", data.id),
      admin.from("sections").select("name").eq("id", data.id).maybeSingle(),
    ]);
    if ((empCount ?? 0) > 0) {
      throw new Error(`لا يمكن حذف القسم: يتبعه ${empCount} موظف. انقلهم إلى قسم آخر أولاً.`);
    }
    const { error } = await admin.from("sections").delete().eq("id", data.id);
    if (error) throw new Error(mapDbError(error.message));
    await writeAudit(admin, { id: context.userId, name: await actorName(admin, context.userId) }, {
      action: "حذف",
      entity: "قسم",
      entity_id: data.id,
      entity_label: sec?.name ?? null,
    });
    return { ok: true };
  });

/* ───────────────────────── الموظفون ───────────────────────── */

export const moveEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employeeIds: z.array(uuid).min(1).max(500),
        department_id: optUuid,
        section_id: optUuid,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const admin = await getAdmin();
    const { error } = await admin
      .from("employees")
      .update({ department_id: data.department_id ?? null, section_id: data.section_id ?? null })
      .in("id", data.employeeIds);
    if (error) throw new Error(mapDbError(error.message));
    await writeAudit(admin, { id: context.userId, name: await actorName(admin, context.userId) }, {
      action: "نقل تنظيمي",
      entity: "موظفون",
      entity_label: `${data.employeeIds.length} موظف`,
      details: { department_id: data.department_id, section_id: data.section_id },
    });
    return { moved: data.employeeIds.length };
  });

export const setEmployeeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employeeIds: z.array(uuid).min(1).max(500),
        status: z.enum(["active", "on_leave", "terminated"]),
        reassignTo: optUuid,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const admin = await getAdmin();

    const { data: rows, error: readErr } = await admin
      .from("employees")
      .select("id, full_name, user_id")
      .in("id", data.employeeIds);
    if (readErr) throw new Error(readErr.message);

    const { error } = await admin
      .from("employees")
      .update({ status: data.status })
      .in("id", data.employeeIds);
    if (error) throw new Error(mapDbError(error.message));

    let reassigned = 0;
    if (data.status === "terminated") {
      // إعادة إسناد المهام المفتوحة
      if (data.reassignTo) {
        const { data: moved } = await admin
          .from("tasks")
          .update({ assignee_id: data.reassignTo })
          .in("assignee_id", data.employeeIds)
          .in("status", ["new", "in_progress"])
          .select("id");
        reassigned = moved?.length ?? 0;
      }
      // تعطيل حسابات المستخدمين المرتبطة
      for (const row of rows ?? []) {
        if (!row.user_id || row.user_id === context.userId) continue;
        await admin.auth.admin.updateUserById(row.user_id, {
          ban_duration: "876000h",
        } as never);
      }
    } else {
      for (const row of rows ?? []) {
        if (!row.user_id) continue;
        await admin.auth.admin.updateUserById(row.user_id, { ban_duration: "none" } as never);
      }
    }

    await writeAudit(admin, { id: context.userId, name: await actorName(admin, context.userId) }, {
      action: "تغيير حالة",
      entity: "موظفون",
      entity_label: (rows ?? []).map((r) => r.full_name).join("، ").slice(0, 200),
      details: { status: data.status, reassigned },
    });
    return { updated: data.employeeIds.length, reassigned };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const admin = await getAdmin();

    const [{ count: tasks }, { count: evals }, { count: managed }, { data: emp }] =
      await Promise.all([
        admin.from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", data.id),
        admin
          .from("evaluations")
          .select("id", { count: "exact", head: true })
          .eq("employee_id", data.id),
        admin.from("employees").select("id", { count: "exact", head: true }).eq("manager_id", data.id),
        admin.from("employees").select("full_name, user_id").eq("id", data.id).maybeSingle(),
      ]);

    if ((tasks ?? 0) > 0 || (evals ?? 0) > 0 || (managed ?? 0) > 0) {
      throw new Error(
        `لا يمكن حذف الموظف نهائياً: مرتبط بـ ${tasks ?? 0} مهمة و${evals ?? 0} تقييم و${managed ?? 0} موظف تابع. استخدم «إنهاء الخدمة» بدل الحذف للحفاظ على السجلات.`,
      );
    }

    const { error } = await admin.from("employees").delete().eq("id", data.id);
    if (error) throw new Error(mapDbError(error.message));

    await writeAudit(admin, { id: context.userId, name: await actorName(admin, context.userId) }, {
      action: "حذف",
      entity: "موظف",
      entity_id: data.id,
      entity_label: emp?.full_name ?? null,
    });
    return { ok: true };
  });

/* ───────────────────────── إحصاءات ───────────────────────── */

export type OrgUnitStats = {
  id: string;
  employees: number;
  openTasks: number;
  avgProgress: number;
};

export const getOrgStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ departments: OrgUnitStats[]; sections: OrgUnitStats[] }> => {
    const supabase = context.supabase;
    const [{ data: employees }, { data: tasks }] = await Promise.all([
      supabase.from("employees").select("id, department_id, section_id, status"),
      supabase.from("tasks").select("assignee_id, status, progress"),
    ]);

    const empRows = employees ?? [];
    const taskRows = tasks ?? [];
    const empIndex = new Map(empRows.map((e) => [e.id, e]));

    const build = (key: "department_id" | "section_id") => {
      const map = new Map<string, { employees: number; openTasks: number; sum: number; n: number }>();
      for (const e of empRows) {
        const k = e[key];
        if (!k) continue;
        const cur = map.get(k) ?? { employees: 0, openTasks: 0, sum: 0, n: 0 };
        if (e.status !== "terminated") cur.employees += 1;
        map.set(k, cur);
      }
      for (const t of taskRows) {
        const emp = empIndex.get(t.assignee_id);
        const k = emp?.[key];
        if (!k) continue;
        const cur = map.get(k) ?? { employees: 0, openTasks: 0, sum: 0, n: 0 };
        if (t.status === "new" || t.status === "in_progress") cur.openTasks += 1;
        cur.sum += t.progress ?? 0;
        cur.n += 1;
        map.set(k, cur);
      }
      return [...map.entries()].map(([id, v]) => ({
        id,
        employees: v.employees,
        openTasks: v.openTasks,
        avgProgress: v.n ? Math.round(v.sum / v.n) : 0,
      }));
    };

    return { departments: build("department_id"), sections: build("section_id") };
  });

/* ───────────────────────── سجل التدقيق ───────────────────────── */

export type AuditRow = {
  id: string;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_label: string | null;
  created_at: string;
};

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditRow[]> => {
    await assertAdminRole(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("audit_log")
      .select("id, actor_name, action, entity, entity_label, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as AuditRow[];
  });

function mapDbError(message: string) {
  if (message.includes("departments_name_unique_idx")) return "يوجد إدارة بنفس الاسم بالفعل";
  if (message.includes("sections_dept_name_unique_idx")) return "يوجد قسم بنفس الاسم داخل هذه الإدارة";
  if (message.includes("employees_employee_no_unique_idx")) return "الرقم الوظيفي مستخدم مسبقاً";
  if (message.includes("violates foreign key")) return "لا يمكن تنفيذ العملية لوجود سجلات مرتبطة";
  return message;
}
