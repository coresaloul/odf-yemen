import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ───────────────── إدارة الورديات ───────────────── */

export const listShifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { admin } = await import("@/lib/attendance.server");
    const [{ data: shifts }, { data: assignments }] = await Promise.all([
      admin().from("work_shifts").select("*").order("is_default", { ascending: false }).order("name"),
      admin()
        .from("shift_assignments")
        .select(`
          id,
          shift_id,
          employee_id,
          department_id,
          section_id,
          start_date,
          end_date,
          notes,
          created_at,
          shift:work_shifts(id, name, code, color, start_time, end_time),
          employee:employees(id, full_name, employee_no),
          department:departments(id, name),
          section:sections(id, name)
        `)
        .order("start_date", { ascending: false }),
    ]);

    return {
      shifts: shifts ?? [],
      assignments: assignments ?? [],
    };
  });

const shiftInputSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2, "اسم الوردية قصير جداً").max(100),
  code: z.string().trim().min(2).max(50),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "توقيت الحضور غير صحيح"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "توقيت الانصراف غير صحيح"),
  work_days: z.array(z.number().int().min(0).max(6)).min(1, "اختر يوم عمل واحد على الأقل"),
  grace_minutes: z.number().int().min(0).max(240).default(10),
  is_night_shift: z.boolean().default(false),
  overtime_enabled: z.boolean().default(true),
  min_overtime_minutes: z.number().int().min(0).max(300).default(30),
  color: z.string().default("#3b82f6"),
  is_default: z.boolean().default(false),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

export const saveShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => shiftInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));

    // إذا تم تعيين هذه الوردية كافتراضية، نلغي الافتراضية عن الورديات الأخرى
    if (data.is_default) {
      await admin().from("work_shifts").update({ is_default: false }).neq("id", data.id ?? "");
    }

    const payload = {
      name: data.name,
      code: data.code,
      start_time: data.start_time,
      end_time: data.end_time,
      work_days: data.work_days,
      grace_minutes: data.grace_minutes,
      is_night_shift: data.is_night_shift,
      overtime_enabled: data.overtime_enabled,
      min_overtime_minutes: data.min_overtime_minutes,
      color: data.color,
      is_default: data.is_default,
      active: data.active,
      notes: data.notes ?? null,
    };

    if (data.id) {
      const { error } = await admin().from("work_shifts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin().from("work_shifts").insert(payload);
      if (error) throw new Error(error.message);
    }

    await writeAudit(context.userId, {
      action: data.id ? "تعديل" : "إضافة",
      entity: "وردية عمل",
      entity_label: data.name,
    });
    return { ok: true };
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));

    const { data: shift } = await admin()
      .from("work_shifts")
      .select("name, is_default")
      .eq("id", data.id)
      .maybeSingle();

    if (shift?.is_default) {
      throw new Error("لا يمكن حذف الوردية الافتراضية للنظام");
    }

    const { error } = await admin().from("work_shifts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await writeAudit(context.userId, {
      action: "حذف",
      entity: "وردية عمل",
      entity_label: shift?.name ?? null,
    });
    return { ok: true };
  });

/* ───────────────── تعيين الورديات ───────────────── */

const assignShiftSchema = z.object({
  shift_id: z.string().uuid("اختر الوردية"),
  target_type: z.enum(["employee", "department", "section"]),
  target_id: z.string().uuid("اختر الموظف أو الإدارة أو القسم"),
  start_date: z.string(),
  end_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const assignShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => assignShiftSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));

    const payload = {
      shift_id: data.shift_id,
      employee_id: data.target_type === "employee" ? data.target_id : null,
      department_id: data.target_type === "department" ? data.target_id : null,
      section_id: data.target_type === "section" ? data.target_id : null,
      start_date: data.start_date,
      end_date: data.end_date || null,
      notes: data.notes || null,
    };

    const { error } = await admin().from("shift_assignments").insert(payload);
    if (error) throw new Error(error.message);

    await writeAudit(context.userId, {
      action: "إضافة",
      entity: "تعيين وردية",
      entity_id: data.shift_id,
    });
    return { ok: true };
  });

export const deleteShiftAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));

    const { error } = await admin().from("shift_assignments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await writeAudit(context.userId, { action: "حذف", entity: "تعيين وردية" });
    return { ok: true };
  });
