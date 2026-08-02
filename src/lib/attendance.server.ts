import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_WORK_SETTINGS,
  type HolidayRow,
  type WorkSettings,
} from "@/lib/attendance";

export function admin() {
  return supabaseAdmin;
}

export async function loadWorkContext(): Promise<{
  settings: WorkSettings;
  holidays: HolidayRow[];
}> {
  const [{ data: s }, { data: h }] = await Promise.all([
    supabaseAdmin
      .from("work_settings")
      .select("work_days, start_time, end_time, grace_minutes")
      .maybeSingle(),
    supabaseAdmin.from("holidays").select("id, name, start_date, end_date, recurring_annually"),
  ]);
  const settings: WorkSettings = s
    ? {
        work_days: (s.work_days ?? DEFAULT_WORK_SETTINGS.work_days) as number[],
        start_time: String(s.start_time).slice(0, 5),
        end_time: String(s.end_time).slice(0, 5),
        grace_minutes: s.grace_minutes ?? 0,
      }
    : DEFAULT_WORK_SETTINGS;
  return { settings, holidays: (h ?? []) as HolidayRow[] };
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
