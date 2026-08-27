import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_SHIFT,
  DEFAULT_WORK_SETTINGS,
  type HolidayRow,
  type ShiftRow,
  type WorkSettings,
} from "@/lib/attendance";

export function admin() {
  return supabaseAdmin;
}

export async function loadWorkContext(): Promise<{
  settings: WorkSettings;
  holidays: HolidayRow[];
  shifts: ShiftRow[];
  defaultShift: ShiftRow;
}> {
  const [{ data: s }, { data: h }, { data: shiftsData }] = await Promise.all([
    supabaseAdmin
      .from("work_settings")
      .select("work_days, start_time, end_time, grace_minutes")
      .maybeSingle(),
    supabaseAdmin.from("holidays").select("id, name, start_date, end_date, recurring_annually"),
    supabaseAdmin.from("work_shifts").select("*").order("name"),
  ]);

  const shifts: ShiftRow[] = (shiftsData ?? []).map((sh) => ({
    id: String(sh.id),
    name: String(sh.name),
    code: String(sh.code),
    start_time: String(sh.start_time).slice(0, 5),
    end_time: String(sh.end_time).slice(0, 5),
    work_days: (sh.work_days ?? [0, 1, 2, 3, 4]) as number[],
    grace_minutes: Number(sh.grace_minutes ?? 10),
    is_night_shift: Boolean(sh.is_night_shift ?? false),
    overtime_enabled: Boolean(sh.overtime_enabled ?? true),
    min_overtime_minutes: Number(sh.min_overtime_minutes ?? 30),
    color: String(sh.color ?? "#0284c7"),
    is_default: Boolean(sh.is_default ?? false),
    active: Boolean(sh.active ?? true),
    notes: sh.notes ? String(sh.notes) : null,
  }));

  const defaultShift =
    shifts.find((sh) => sh.is_default && sh.active) ??
    shifts.find((sh) => sh.active) ??
    DEFAULT_SHIFT;

  const settings: WorkSettings = s
    ? {
        work_days: (s.work_days ?? defaultShift.work_days) as number[],
        start_time: String(s.start_time).slice(0, 5),
        end_time: String(s.end_time).slice(0, 5),
        grace_minutes: s.grace_minutes ?? defaultShift.grace_minutes,
      }
    : {
        work_days: defaultShift.work_days,
        start_time: defaultShift.start_time,
        end_time: defaultShift.end_time,
        grace_minutes: defaultShift.grace_minutes,
      };

  return { settings, holidays: (h ?? []) as HolidayRow[], shifts, defaultShift };
}

/**
 * جلب وتحديد الوردية الفعالة لمجموعة من الموظفين في نطاق زمني
 * بترتيب الأولوية: تعيين الموظف > تعيين القسم > تعيين الإدارة > الوردية الافتراضية
 */
export async function resolveEmployeesShiftsMap(
  employeeIds: string[],
  startDate: string,
  endDate: string,
): Promise<{
  getShift: (employeeId: string, workDate: string) => ShiftRow;
}> {
  const { shifts, defaultShift } = await loadWorkContext();
  const shiftById = new Map(shifts.map((s) => [s.id, s]));

  const [{ data: emps }, { data: assignments }] = await Promise.all([
    supabaseAdmin
      .from("employees")
      .select("id, department_id, section_id")
      .in("id", employeeIds),
    supabaseAdmin
      .from("shift_assignments")
      .select("shift_id, employee_id, department_id, section_id, start_date, end_date")
      .or(`end_date.is.null,end_date.gte.${startDate}`)
      .lte("start_date", endDate),
  ]);

  const empMap = new Map((emps ?? []).map((e) => [e.id, e]));
  const activeAssignments = assignments ?? [];

  return {
    getShift: (employeeId: string, workDate: string) => {
      const emp = empMap.get(employeeId);

      // 1. فحص تعيين الموظف المباشر
      const empAssign = activeAssignments.find(
        (a) =>
          a.employee_id === employeeId &&
          workDate >= a.start_date &&
          (!a.end_date || workDate <= a.end_date),
      );
      if (empAssign && shiftById.has(empAssign.shift_id)) {
        return shiftById.get(empAssign.shift_id)!;
      }

      // 2. فحص تعيين القسم
      if (emp?.section_id) {
        const secAssign = activeAssignments.find(
          (a) =>
            a.section_id === emp.section_id &&
            workDate >= a.start_date &&
            (!a.end_date || workDate <= a.end_date),
        );
        if (secAssign && shiftById.has(secAssign.shift_id)) {
          return shiftById.get(secAssign.shift_id)!;
        }
      }

      // 3. فحص تعيين الإدارة
      if (emp?.department_id) {
        const deptAssign = activeAssignments.find(
          (a) =>
            a.department_id === emp.department_id &&
            workDate >= a.start_date &&
            (!a.end_date || workDate <= a.end_date),
        );
        if (deptAssign && shiftById.has(deptAssign.shift_id)) {
          return shiftById.get(deptAssign.shift_id)!;
        }
      }

      // 4. الوردية الافتراضية
      return defaultShift;
    },
  };
}

export type ActorContext = {
  isDirector: boolean;
  isHr: boolean;
  employeeId: string | null;
  managedDepartments: string[];
  managedSections: string[];
};

export async function loadActor(userId: string): Promise<ActorContext> {
  const [{ data: roles }, { data: emp }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("employees").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  const roleList = (roles ?? []).map((r) => String(r.role));
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

export async function canSupervise(ctx: ActorContext, employeeId: string) {
  if (ctx.isDirector || ctx.isHr) return true;
  if (!ctx.employeeId) return false;
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

export function assertAdmin(ctx: ActorContext) {
  if (!ctx.isDirector && !ctx.isHr)
    throw new Error("غير مصرح: هذا الإجراء للمدير التنفيذي أو الموارد البشرية فقط");
}

/** إشعار داخل النظام مع احترام تفضيلات المستخدم */
export async function notifyInApp(
  userId: string | null,
  payload: { title: string; body?: string | null },
) {
  if (!userId) return;
  const { data: prefs } = await supabaseAdmin
    .from("notification_preferences")
    .select("inapp_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (prefs && prefs.inapp_enabled === false) return;
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title: payload.title,
    body: payload.body ?? null,
    type: "leave",
  });
}

export async function wantsLeaveEmail(userId: string | null) {
  if (!userId) return true;
  const { data } = await supabaseAdmin
    .from("notification_preferences")
    .select("email_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  return !data || data.email_enabled !== false;
}

export async function sendLeaveEmail(
  to: string | null,
  data: {
    recipientName: string;
    leaveType: string;
    period: string;
    status: string;
    note?: string | null;
  },
  idempotencyKey: string,
) {
  if (!to) return;
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("leave-status", to, { templateData: data, idempotencyKey });
  } catch {
    /* لا يجب أن يفشل الإجراء بسبب البريد */
  }
}
