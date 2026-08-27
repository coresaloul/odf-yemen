import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeAttendance, isOffDay } from "@/lib/attendance";
import { loadWorkContext, resolveEmployeesShiftsMap } from "@/lib/attendance.server";

export type PunchInput = {
  device_user_id: string;
  punched_at: string; // ISO
  punch_type?: string | null;
  raw?: string | null;
};

/** التحقق من الجهاز عبر الرقم التسلسلي ومفتاح الربط */
export async function verifyDevice(serial: string | null, key: string | null) {
  if (!serial) return null;
  const { data } = await supabaseAdmin
    .from("biometric_devices")
    .select("id, serial_number, auth_key, active, auto_generate")
    .eq("serial_number", serial)
    .maybeSingle();
  if (!data || !data.active) return null;
  if (data.auth_key && data.auth_key !== key) return null;
  return data;
}

export async function touchDevice(deviceId: string, added: number) {
  const { data } = await supabaseAdmin
    .from("biometric_devices")
    .select("punches_count")
    .eq("id", deviceId)
    .maybeSingle();
  await supabaseAdmin
    .from("biometric_devices")
    .update({
      last_seen_at: new Date().toISOString(),
      punches_count: (data?.punches_count ?? 0) + added,
    })
    .eq("id", deviceId);
}

/** حفظ البصمات الخام مع تجاهل المكرر، ثم توليد الحضور للأيام المتأثرة */
export async function ingestPunches(
  device: { id: string; serial_number: string; auto_generate: boolean },
  punches: PunchInput[],
) {
  if (punches.length === 0) return { inserted: 0 };

  const ids = [...new Set(punches.map((p) => p.device_user_id))];
  const { data: emps } = await supabaseAdmin
    .from("employees")
    .select("id, device_user_id")
    .in("device_user_id", ids);
  const map = new Map((emps ?? []).map((e) => [String(e.device_user_id), e.id]));

  const rows = punches.map((p) => ({
    device_id: device.id,
    device_serial: device.serial_number,
    device_user_id: p.device_user_id,
    employee_id: map.get(p.device_user_id) ?? null,
    punched_at: p.punched_at,
    punch_type: p.punch_type ?? null,
    raw: p.raw ?? null,
    processed: false,
  }));

  const { error } = await supabaseAdmin
    .from("biometric_punches")
    .upsert(rows, { onConflict: "device_serial,device_user_id,punched_at", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  if (device.auto_generate) {
    const dates = [...new Set(punches.map((p) => p.punched_at.slice(0, 10)))].sort();
    await generateAttendance(dates[0]!, dates[dates.length - 1]!);
  }
  return { inserted: rows.length };
}

/** توليد سجلات الحضور من البصمات الخام لفترة محددة مع تطبيق الوردية واحتساب الإضافي */
export async function generateAttendance(from: string, to: string) {
  const { holidays } = await loadWorkContext();
  const { data: punches } = await supabaseAdmin
    .from("biometric_punches")
    .select("id, employee_id, punched_at")
    .not("employee_id", "is", null)
    .gte("punched_at", `${from}T00:00:00`)
    .lte("punched_at", `${to}T23:59:59`)
    .order("punched_at");

  const list = punches ?? [];
  if (list.length === 0) return { generated: 0 };

  const grouped = new Map<string, string[]>(); // employee|date -> times HH:MM
  for (const p of list) {
    const dt = new Date(p.punched_at);
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate(),
    ).padStart(2, "0")}`;
    const time = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
    const key = `${p.employee_id}|${date}`;
    const arr = grouped.get(key) ?? [];
    arr.push(time);
    grouped.set(key, arr);
  }

  const keys = [...grouped.keys()];
  const dates = [...new Set(keys.map((k) => k.split("|")[1]!))].sort();
  const minDate = dates[0]!;
  const maxDate = dates[dates.length - 1]!;
  const employeeIds = [...new Set(keys.map((k) => k.split("|")[0]!))];

  const [{ data: leaves }, { data: existing }, { getShift }] = await Promise.all([
    supabaseAdmin
      .from("leave_requests")
      .select("employee_id, start_date, end_date, kind")
      .eq("stage", "approved")
      .in("employee_id", employeeIds)
      .lte("start_date", maxDate)
      .gte("end_date", minDate),
    supabaseAdmin
      .from("attendance_records")
      .select("employee_id, work_date, permission_minutes, source")
      .in("employee_id", employeeIds)
      .gte("work_date", minDate)
      .lte("work_date", maxDate),
    resolveEmployeesShiftsMap(employeeIds, minDate, maxDate),
  ]);

  const permMap = new Map(
    (existing ?? []).map((r) => [`${r.employee_id}|${r.work_date}`, r.permission_minutes ?? 0]),
  );
  const manualKeys = new Set(
    (existing ?? [])
      .filter((r) => r.source === "manual")
      .map((r) => `${r.employee_id}|${r.work_date}`),
  );

  const payload = keys
    .filter((k) => !manualKeys.has(k)) // لا نطمس التعديلات اليدوية
    .map((k) => {
      const [employeeId, workDate] = k.split("|") as [string, string];
      const shift = getShift(employeeId, workDate);
      const times = (grouped.get(k) ?? []).sort();
      const checkIn = times[0] ?? null;
      const checkOut = times.length > 1 ? times[times.length - 1]! : null;
      const permission = permMap.get(k) ?? 0;
      const off = isOffDay(workDate, shift, holidays);
      const onLeave = (leaves ?? []).some(
        (l) =>
          l.employee_id === employeeId &&
          l.kind === "leave" &&
          workDate >= l.start_date &&
          workDate <= l.end_date,
      );
      const status = off ? "holiday" : onLeave ? "leave" : permission > 0 ? "permission" : "present";
      const calc =
        status === "present" || status === "permission"
          ? computeAttendance(
              { check_in: checkIn, check_out: checkOut, permission_minutes: permission },
              shift,
              { isOffDay: off },
            )
          : { late_minutes: 0, early_leave_minutes: 0, worked_minutes: 0, overtime_minutes: 0 };
      return {
        employee_id: employeeId,
        work_date: workDate,
        check_in: checkIn,
        check_out: checkOut,
        status: status as "present" | "absent" | "leave" | "holiday" | "permission",
        permission_minutes: permission,
        source: "device",
        shift_id: shift.id !== "default" ? shift.id : null,
        ...calc,
      };
    });

  if (payload.length > 0) {
    const { error } = await supabaseAdmin
      .from("attendance_records")
      .upsert(payload, { onConflict: "employee_id,work_date" });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("biometric_punches")
      .update({ processed: true })
      .in(
        "id",
        list.map((p) => p.id),
      );
  }
  return { generated: payload.length };
}
