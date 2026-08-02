import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ───────────────── إعدادات الدوام ───────────────── */

export const saveWorkSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        work_days: z.array(z.number().int().min(0).max(6)).min(1, "اختر يوم عمل واحد على الأقل"),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
        end_time: z.string().regex(/^\d{2}:\d{2}$/),
        grace_minutes: z.number().int().min(0).max(240),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const { error } = await admin()
      .from("work_settings")
      .upsert({ id: true, ...data }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, { action: "تعديل", entity: "إعدادات الدوام" });
    return { ok: true };
  });

/* ───────────────── العطل الرسمية ───────────────── */

export const saveHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(2, "اسم العطلة قصير جداً").max(120),
        start_date: z.string(),
        end_date: z.string(),
        recurring_annually: z.boolean().default(false),
      })
      .refine((v) => v.end_date >= v.start_date, "تاريخ النهاية قبل البداية")
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const payload = {
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
      recurring_annually: data.recurring_annually,
    };
    if (data.id) {
      const { error } = await admin().from("holidays").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin().from("holidays").insert(payload);
      if (error) throw new Error(error.message);
    }
    await writeAudit(context.userId, {
      action: data.id ? "تعديل" : "إضافة",
      entity: "عطلة رسمية",
      entity_label: data.name,
    });
    return { ok: true };
  });

export const deleteHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const { error } = await admin().from("holidays").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, { action: "حذف", entity: "عطلة رسمية" });
    return { ok: true };
  });

/* ───────────────── أنواع الإجازات ───────────────── */

export const saveLeaveType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        annual_days: z.number().min(0).max(400),
        active: z.boolean(),
        requires_attachment: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const { error } = await admin()
      .from("leave_types")
      .update({
        annual_days: data.annual_days,
        active: data.active,
        requires_attachment: data.requires_attachment,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, { action: "تعديل", entity: "نوع إجازة" });
    return { ok: true };
  });

/* ───────────────── سجلات الحضور ───────────────── */

const recordSchema = z.object({
  employee_id: z.string().uuid(),
  work_date: z.string(),
  check_in: z.string().nullable().optional(),
  check_out: z.string().nullable().optional(),
  status: z.enum(["present", "absent", "leave", "holiday", "permission"]),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const saveAttendanceRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => recordSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin, loadWorkContext } = await import(
      "@/lib/attendance.server"
    );
    const { computeAttendance } = await import("@/lib/attendance");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const { settings } = await loadWorkContext();

    const { data: existing } = await admin()
      .from("attendance_records")
      .select("permission_minutes")
      .eq("employee_id", data.employee_id)
      .eq("work_date", data.work_date)
      .maybeSingle();

    const permission = existing?.permission_minutes ?? 0;
    const calc =
      data.status === "present" || data.status === "permission"
        ? computeAttendance(
            {
              check_in: data.check_in ?? null,
              check_out: data.check_out ?? null,
              permission_minutes: permission,
            },
            settings,
          )
        : { late_minutes: 0, early_leave_minutes: 0, worked_minutes: 0 };

    const { error } = await admin()
      .from("attendance_records")
      .upsert(
        {
          employee_id: data.employee_id,
          work_date: data.work_date,
          check_in: data.check_in || null,
          check_out: data.check_out || null,
          status: data.status,
          notes: data.notes ?? null,
          permission_minutes: permission,
          source: "manual",
          ...calc,
        },
        { onConflict: "employee_id,work_date" },
      );
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, {
      action: "تعديل",
      entity: "سجل دوام",
      entity_id: data.employee_id,
      entity_label: data.work_date,
    });
    return { ok: true };
  });

export const deleteAttendanceRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const { error } = await admin().from("attendance_records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, { action: "حذف", entity: "سجل دوام" });
    return { ok: true };
  });

/** استيراد سجلات جهاز البصمة بعد المعاينة */
export const importAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              employee_id: z.string().uuid(),
              work_date: z.string(),
              check_in: z.string().nullable(),
              check_out: z.string().nullable(),
            }),
          )
          .min(1, "لا توجد صفوف صالحة للاستيراد")
          .max(5000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin, loadWorkContext } = await import(
      "@/lib/attendance.server"
    );
    const { computeAttendance, isOffDay } = await import("@/lib/attendance");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const { settings, holidays } = await loadWorkContext();

    // الإجازات المعتمدة ضمن نطاق الملف
    const dates = data.rows.map((r) => r.work_date).sort();
    const minDate = dates[0]!;
    const maxDate = dates[dates.length - 1]!;
    const { data: leaves } = await admin()
      .from("leave_requests")
      .select("employee_id, start_date, end_date, kind")
      .eq("stage", "approved")
      .lte("start_date", maxDate)
      .gte("end_date", minDate);

    const onLeave = (employeeId: string, date: string) =>
      (leaves ?? []).some(
        (l) =>
          l.employee_id === employeeId &&
          l.kind === "leave" &&
          date >= l.start_date &&
          date <= l.end_date,
      );

    const { data: existing } = await admin()
      .from("attendance_records")
      .select("employee_id, work_date, permission_minutes")
      .gte("work_date", minDate)
      .lte("work_date", maxDate);
    const permMap = new Map(
      (existing ?? []).map((r) => [`${r.employee_id}|${r.work_date}`, r.permission_minutes ?? 0]),
    );

    const payload = data.rows.map((r) => {
      const permission = permMap.get(`${r.employee_id}|${r.work_date}`) ?? 0;
      const off = isOffDay(r.work_date, settings, holidays);
      const hasIn = !!r.check_in;
      const status = off
        ? "holiday"
        : onLeave(r.employee_id, r.work_date)
          ? "leave"
          : hasIn
            ? permission > 0
              ? "permission"
              : "present"
            : "absent";
      const calc =
        status === "present" || status === "permission"
          ? computeAttendance(
              { check_in: r.check_in, check_out: r.check_out, permission_minutes: permission },
              settings,
            )
          : { late_minutes: 0, early_leave_minutes: 0, worked_minutes: 0 };
      return {
        employee_id: r.employee_id,
        work_date: r.work_date,
        check_in: r.check_in,
        check_out: r.check_out,
        status: status as "present" | "absent" | "leave" | "holiday" | "permission",
        permission_minutes: permission,
        source: "import",
        ...calc,
      };
    });

    const { error } = await admin()
      .from("attendance_records")
      .upsert(payload, { onConflict: "employee_id,work_date" });
    if (error) throw new Error(error.message);

    await writeAudit(context.userId, {
      action: "استيراد",
      entity: "سجلات دوام",
      entity_label: `${payload.length} سجل (${minDate} — ${maxDate})`,
    });
    return { imported: payload.length };
  });

/** توليد سجلات غياب/عطلة للأيام غير المسجّلة ضمن فترة */
export const fillMissingAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ start: z.string(), end: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin, loadWorkContext } = await import(
      "@/lib/attendance.server"
    );
    const { listDates, isOffDay } = await import("@/lib/attendance");
    assertAdmin(await loadActor(context.userId));
    const { settings, holidays } = await loadWorkContext();

    const [{ data: employees }, { data: existing }, { data: leaves }] = await Promise.all([
      admin().from("employees").select("id").eq("status", "active"),
      admin()
        .from("attendance_records")
        .select("employee_id, work_date")
        .gte("work_date", data.start)
        .lte("work_date", data.end),
      admin()
        .from("leave_requests")
        .select("employee_id, start_date, end_date, kind")
        .eq("stage", "approved")
        .eq("kind", "leave")
        .lte("start_date", data.end)
        .gte("end_date", data.start),
    ]);

    const have = new Set((existing ?? []).map((r) => `${r.employee_id}|${r.work_date}`));
    const days = listDates(data.start, data.end);
    const rows: Record<string, unknown>[] = [];
    for (const emp of employees ?? []) {
      for (const day of days) {
        if (have.has(`${emp.id}|${day}`)) continue;
        const off = isOffDay(day, settings, holidays);
        const leave = (leaves ?? []).some(
          (l) => l.employee_id === emp.id && day >= l.start_date && day <= l.end_date,
        );
        rows.push({
          employee_id: emp.id,
          work_date: day,
          status: off ? "holiday" : leave ? "leave" : "absent",
          late_minutes: 0,
          early_leave_minutes: 0,
          worked_minutes: 0,
          source: "system",
        });
      }
    }
    if (rows.length === 0) return { created: 0 };
    const { error } = await admin()
      .from("attendance_records")
      .upsert(rows as never, { onConflict: "employee_id,work_date" });
    if (error) throw new Error(error.message);
    return { created: rows.length };
  });
