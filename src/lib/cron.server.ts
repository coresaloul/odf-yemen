import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isOffDay } from "@/lib/attendance";
import { loadWorkContext, resolveEmployeesShiftsMap } from "@/lib/attendance.server";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

export type CronTaskResult = {
  task: string;
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
};

/**
 * 1. فحص ومعالجة الغياب والتأخير اليومية
 * يفحص الموظفين النشطين في تاريخ محدد (أو اليوم) ويسجل الغياب لمن لم يسجلوا بصمة حضور
 * دون وجود إجازة معتمدة أو عطلة رسمية.
 */
export async function auditDailyAttendance(targetDate?: string): Promise<CronTaskResult> {
  const date = targetDate ?? new Date().toISOString().slice(0, 10);
  const { holidays } = await loadWorkContext();

  // جلب الموظفين النشطين وسجلات الدوام والإجازات لتاريخ اليوم
  const [{ data: employees }, { data: records }, { data: leaves }] = await Promise.all([
    supabaseAdmin.from("employees").select("id, full_name, manager_id, department_id, section_id").eq("status", "active"),
    supabaseAdmin.from("attendance_records").select("employee_id, status, check_in").eq("work_date", date),
    supabaseAdmin
      .from("leave_requests")
      .select("employee_id, start_date, end_date, kind")
      .eq("stage", "approved")
      .lte("start_date", date)
      .gte("end_date", date),
  ]);

  const activeEmps = employees ?? [];
  const empIds = activeEmps.map((e) => e.id);
  const { getShift } = await resolveEmployeesShiftsMap(empIds, date, date);

  const existingMap = new Map((records ?? []).map((r) => [r.employee_id, r]));
  const leaveSet = new Set((leaves ?? []).filter((l) => l.kind === "leave").map((l) => l.employee_id));

  const missingRows: Record<string, unknown>[] = [];
  const absentEmpNames: string[] = [];

  for (const emp of activeEmps) {
    const shift = getShift(emp.id, date);
    const off = isOffDay(date, shift, holidays);
    const existing = existingMap.get(emp.id);

    // إذا كان الموظف مسجل حضور أو إجازة مسبقاً نتخطاه
    if (existing && (existing.check_in || existing.status === "present" || existing.status === "permission" || existing.status === "leave")) {
      continue;
    }

    if (off) {
      if (!existing) {
        missingRows.push({
          employee_id: emp.id,
          work_date: date,
          status: "holiday",
          late_minutes: 0,
          early_leave_minutes: 0,
          worked_minutes: 0,
          overtime_minutes: 0,
          shift_id: shift.id !== "default" ? shift.id : null,
          source: "system",
        });
      }
    } else if (leaveSet.has(emp.id)) {
      if (!existing) {
        missingRows.push({
          employee_id: emp.id,
          work_date: date,
          status: "leave",
          late_minutes: 0,
          early_leave_minutes: 0,
          worked_minutes: 0,
          overtime_minutes: 0,
          shift_id: shift.id !== "default" ? shift.id : null,
          source: "system",
        });
      }
    } else {
      // غياب غير مبرر
      missingRows.push({
        employee_id: emp.id,
        work_date: date,
        status: "absent",
        late_minutes: 0,
        early_leave_minutes: 0,
        worked_minutes: 0,
        overtime_minutes: 0,
        shift_id: shift.id !== "default" ? shift.id : null,
        source: "system",
      });
      absentEmpNames.push(emp.full_name);
    }
  }

  if (missingRows.length > 0) {
    const { error } = await supabaseAdmin
      .from("attendance_records")
      .upsert(missingRows as never, { onConflict: "employee_id,work_date" });
    if (error) throw new Error(error.message);
  }

  // إرسال إشعار للموارد البشرية والإدارة في حال وجود غياب
  if (absentEmpNames.length > 0) {
    const { data: hrUsers } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["executive_director", "hr"]);

    const notifications = (hrUsers ?? []).map((u) => ({
      user_id: u.user_id,
      title: `تقرير الغياب اليومي (${date})`,
      body: `تم تسجيل ${absentEmpNames.length} حالة غياب اليوم: ${absentEmpNames.slice(0, 3).join("، ")}${absentEmpNames.length > 3 ? ` و ${absentEmpNames.length - 3} آخرين` : ""}`,
      type: "attendance_audit",
    }));

    if (notifications.length > 0) {
      await supabaseAdmin.from("notifications").insert(notifications);
    }
  }

  return {
    task: "auditDailyAttendance",
    success: true,
    message: `تم فحص الدوام ليوم ${date}: تم تسجيل ${missingRows.length} سجل (${absentEmpNames.length} غياب).`,
    details: { totalChecked: activeEmps.length, recorded: missingRows.length, absentCount: absentEmpNames.length },
  };
}

/**
 * 2. فحص وتنبيهات انتهاء الوثائق والعقود
 * يفحص وثائق الموظفين المنتهية أو التي تنتهي خلال (30 يوماً، 15 يوماً، 7 أيام)
 * ويرسل تنبيهات داخل النظام
 */
export async function checkDocumentExpirations(): Promise<CronTaskResult> {
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const { data: docs } = await supabaseAdmin
    .from("employee_documents")
    .select(`
      id,
      title,
      expiry_date,
      employee_id,
      employee:employees(id, full_name, employee_no)
    `)
    .not("expiry_date", "is", null)
    .lte("expiry_date", in30Days)
    .order("expiry_date");

  const docList = docs ?? [];
  if (docList.length === 0) {
    return {
      task: "checkDocumentExpirations",
      success: true,
      message: "لا توجد وثائق أو عقود منتهية أو قريبة من الانتهاء خلال ٣٠ يوماً.",
      details: { count: 0 },
    };
  }

  const { data: hrUsers } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["executive_director", "hr"]);

  const notifications: Array<{ user_id: string; title: string; body: string; type: string }> = [];

  for (const doc of docList) {
    const empName = (doc.employee as unknown as { full_name?: string })?.full_name ?? "موظف";
    const isExpired = doc.expiry_date < today;
    const title = isExpired ? `⚠️ وثيقة منتهية: ${doc.title}` : `⏳ وثيقة تنتهي قريباً: ${doc.title}`;
    const body = `${title} للموظف ${empName} (تاريخ الانتهاء: ${doc.expiry_date})`;

    for (const u of hrUsers ?? []) {
      notifications.push({
        user_id: u.user_id,
        title,
        body,
        type: "document_expiry",
      });
    }
  }

  if (notifications.length > 0) {
    // تجنب التكرار المفرط لنفس اليوم
    await supabaseAdmin.from("notifications").insert(notifications.slice(0, 20));
  }

  return {
    task: "checkDocumentExpirations",
    success: true,
    message: `تم فحص الوثائق: تم العثور على ${docList.length} وثيقة/عقد تنتهي قريباً أو منتهية.`,
    details: { count: docList.length },
  };
}

/**
 * 3. ملخص الإنجاز الأسبوعي
 * يجمع نسب إنجاز الأقسام والمهام ومعدلات الالتزام ويرسل بريداً وإشعاراً للمدير التنفيذي
 */
export async function dispatchWeeklyPerformanceDigest(): Promise<CronTaskResult> {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const lastWeek = new Date(now.getTime() - 7 * 86400000);
  const start = lastWeek.toISOString().slice(0, 10);

  const { data: analytics } = await supabaseAdmin.rpc("get_dashboard_analytics", {
    p_start_date: start,
    p_end_date: end,
    p_is_org_wide: true,
  });

  const summary = (analytics as unknown as { summary?: { totalPeriodTasks: number; completedPeriodTasks: number; completionRate: number; avgCompliance: number } })?.summary;
  const deptScores = ((analytics as unknown as { deptScores?: Array<{ name: string; score: number; completedTasks: number }> })?.deptScores ?? []).slice(0, 5);

  const { data: directors } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "executive_director");

  const digestBody = `ملخص الأسبوع (${start} إلى ${end}):\n` +
    `• إجمالي المهام: ${summary?.totalPeriodTasks ?? 0} (أنجز منها ${summary?.completedPeriodTasks ?? 0} بنسبة ${summary?.completionRate ?? 0}%)\n` +
    `• متوسط الالتزام بالدوام: ${summary?.avgCompliance ?? 0}%\n` +
    `• أبرز الإدارات إنجازاً: ${deptScores.map((d) => `${d.name} (${d.score}%)`).join("، ") || "لا توجد بيانات"}`;

  const notifs = (directors ?? []).map((d) => ({
    user_id: d.user_id,
    title: `📊 تقرير الإنجاز الأسبوعي (${start} — ${end})`,
    body: digestBody,
    type: "weekly_digest",
  }));

  if (notifs.length > 0) {
    await supabaseAdmin.from("notifications").insert(notifs);
  }

  return {
    task: "dispatchWeeklyPerformanceDigest",
    success: true,
    message: `تم إنشاء وإرسال ملخص الإنجاز الأسبوعي للفترة (${start} — ${end}).`,
    details: { summary, deptScoresCount: deptScores.length },
  };
}

/** تشغيل كافة المهام المجدولة */
export async function runAllCronTasks(): Promise<CronTaskResult[]> {
  const r1 = await auditDailyAttendance();
  const r2 = await checkDocumentExpirations();
  const r3 = await dispatchWeeklyPerformanceDigest();
  return [r1, r2, r3];
}
