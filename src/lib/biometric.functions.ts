import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveBiometricDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(2, "اسم الجهاز قصير جداً").max(120),
        serial_number: z.string().trim().min(3, "الرقم التسلسلي غير صالح").max(64),
        location: z.string().trim().max(160).nullable().optional(),
        active: z.boolean().default(true),
        auto_generate: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const payload = {
      name: data.name,
      serial_number: data.serial_number,
      location: data.location ?? null,
      active: data.active,
      auto_generate: data.auto_generate,
    };
    if (data.id) {
      const { error } = await admin().from("biometric_devices").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const key = crypto.randomUUID().replace(/-/g, "");
      const { error } = await admin()
        .from("biometric_devices")
        .insert({ ...payload, auth_key: key });
      if (error) throw new Error(error.message);
    }
    await writeAudit(context.userId, {
      action: data.id ? "تعديل" : "إضافة",
      entity: "جهاز بصمة",
      entity_label: data.name,
    });
    return { ok: true };
  });

export const regenerateDeviceKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const key = crypto.randomUUID().replace(/-/g, "");
    const { error } = await admin()
      .from("biometric_devices")
      .update({ auth_key: key })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, { action: "تعديل", entity: "مفتاح ربط جهاز بصمة" });
    return { key };
  });

export const deleteBiometricDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const { error } = await admin().from("biometric_devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, { action: "حذف", entity: "جهاز بصمة" });
    return { ok: true };
  });

export const linkEmployeeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employee_id: z.string().uuid(),
        device_user_id: z.string().trim().max(32).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const value = data.device_user_id?.trim() ? data.device_user_id.trim() : null;
    const { error } = await admin()
      .from("employees")
      .update({ device_user_id: value })
      .eq("id", data.employee_id);
    if (error) throw new Error(error.message);

    // ربط البصمات السابقة غير المطابقة بهذا الموظف
    if (value) {
      await admin()
        .from("biometric_punches")
        .update({ employee_id: data.employee_id })
        .is("employee_id", null)
        .eq("device_user_id", value);
    }
    await writeAudit(context.userId, { action: "تعديل", entity: "ربط موظف بجهاز البصمة" });
    return { ok: true };
  });

export const regenerateDeviceAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ from: z.string(), to: z.string() })
      .refine((v) => v.to >= v.from, "المدى الزمني غير صالح")
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin } = await import("@/lib/attendance.server");
    const { generateAttendance } = await import("@/lib/biometric.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const res = await generateAttendance(data.from, data.to);
    await writeAudit(context.userId, {
      action: "توليد",
      entity: "حضور من البصمة",
      entity_label: `${data.from} — ${data.to}`,
    });
    return res;
  });
