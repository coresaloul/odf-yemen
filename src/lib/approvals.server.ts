import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadActor, canSupervise, notifyInApp, type ActorContext } from "@/lib/attendance.server";
import type { ApprovalStage } from "@/lib/evaluation-approval";
import type { PendingApproval } from "@/lib/approvals";
import { APPROVAL_KIND_LABELS, CORRECTION_TYPE_LABELS } from "@/lib/approvals";
import { formatMinutes } from "@/lib/attendance";

function db() {
  return supabaseAdmin;
}

const PENDING_STAGES: ("pending_manager" | "pending_hr" | "pending_director")[] = [
  "pending_manager",
  "pending_hr",
  "pending_director",
];

type EmployeeInfo = {
  id: string;
  full_name: string;
  department_id: string | null;
  user_id: string | null;
  manager_id: string | null;
};

async function loadDirectory() {
  const [{ data: emps }, { data: deps }] = await Promise.all([
    db().from("employees").select("id, full_name, department_id, user_id, manager_id"),
    db().from("departments").select("id, name"),
  ]);
  const employees = new Map<string, EmployeeInfo>();
  for (const e of emps ?? []) employees.set(e.id, e as EmployeeInfo);
  const departments = new Map<string, string>();
  for (const d of deps ?? []) departments.set(d.id, d.name);
  return { employees, departments };
}

/** هل يستطيع هذا المستخدم اتخاذ القرار في المرحلة الحالية لهذا الموظف؟ */
async function canDecide(actor: ActorContext, stage: string, employeeId: string | null) {
  if (stage === "pending_manager")
    return actor.isDirector || (!!employeeId && (await canSupervise(actor, employeeId)));
  if (stage === "pending_hr") return actor.isHr || actor.isDirector;
  if (stage === "pending_director") return actor.isDirector;
  return false;
}

export async function listPending(userId: string): Promise<PendingApproval[]> {
  const actor = await loadActor(userId);
  const { employees, departments } = await loadDirectory();

  const info = (id: string | null) => (id ? (employees.get(id) ?? null) : null);
  const base = (employeeId: string | null) => {
    const emp = info(employeeId);
    return {
      employeeId,
      employeeName: emp?.full_name ?? "—",
      departmentId: emp?.department_id ?? null,
      departmentName: emp?.department_id
        ? (departments.get(emp.department_id) ?? "—")
        : "—",
    };
  };

  const items: PendingApproval[] = [];

  /* الإجازات */
  const [{ data: leaves }, { data: leaveTypes }] = await Promise.all([
    db()
      .from("leave_requests")
      .select(
        "id, employee_id, leave_type_id, kind, stage, days, hours, start_date, end_date, start_time, end_time, reason, submitted_at, created_at",
      )
      .in("stage", PENDING_STAGES),
    db().from("leave_types").select("id, name"),
  ]);
  const typeName = new Map((leaveTypes ?? []).map((t) => [t.id, t.name]));
  for (const r of leaves ?? []) {
    if (!(await canDecide(actor, String(r.stage), r.employee_id))) continue;
    const period =
      r.kind === "permission"
        ? `${r.start_date} (${String(r.start_time ?? "").slice(0, 5)} — ${String(r.end_time ?? "").slice(0, 5)})`
        : `${r.start_date} — ${r.end_date}`;
    items.push({
      kind: "leave",
      id: r.id,
      stage: String(r.stage) as ApprovalStage,
      title: `${APPROVAL_KIND_LABELS.leave}: ${typeName.get(r.leave_type_id) ?? ""}`,
      summary: period,
      ...base(r.employee_id),
      since: r.submitted_at ?? r.created_at,
      details: [
        { label: "النوع", value: r.kind === "permission" ? "إذن ساعي" : "إجازة" },
        { label: "الفترة", value: period },
        {
          label: "المدة",
          value: r.kind === "permission" ? `${r.hours} ساعة` : `${r.days} يوم`,
        },
        { label: "السبب", value: r.reason ?? "—" },
      ],
    });
  }

  /* تقارير التقييم */
  const { data: evals } = await db()
    .from("evaluations")
    .select(
      "id, employee_id, approval_stage, period, period_start, period_end, total_score, submitted_at, created_at",
    )
    .in("approval_stage", PENDING_STAGES);
  for (const e of evals ?? []) {
    if (!(await canDecide(actor, String(e.approval_stage), e.employee_id))) continue;
    items.push({
      kind: "evaluation",
      id: e.id,
      stage: String(e.approval_stage) as ApprovalStage,
      title: `${APPROVAL_KIND_LABELS.evaluation}`,
      summary: `${e.period_start} — ${e.period_end}`,
      ...base(e.employee_id),
      since: e.submitted_at ?? e.created_at,
      details: [
        { label: "الفترة", value: `${e.period_start} — ${e.period_end}` },
        { label: "الدرجة الكلية", value: `${Number(e.total_score ?? 0).toFixed(1)}%` },
      ],
    });
  }

  /* المهام المنجزة بانتظار الاعتماد */
  const { data: tasks } = await db()
    .from("tasks")
    .select(
      "id, title, description, assignee_id, assigned_by, due_date, weight, priority, submitted_for_approval_at, updated_at",
    )
    .eq("status", "pending_approval");
  for (const t of tasks ?? []) {
    const allowed =
      actor.isDirector ||
      actor.isHr ||
      (!!actor.employeeId && t.assigned_by === actor.employeeId) ||
      (await canSupervise(actor, t.assignee_id));
    if (!allowed) continue;
    items.push({
      kind: "task",
      id: t.id,
      stage: "pending_manager",
      title: `${APPROVAL_KIND_LABELS.task}: ${t.title}`,
      summary: t.description ?? "بانتظار اعتماد إنجاز المهمة",
      ...base(t.assignee_id),
      since: t.submitted_for_approval_at ?? t.updated_at,
      details: [
        { label: "المكلِّف", value: info(t.assigned_by)?.full_name ?? "—" },
        { label: "تاريخ الاستحقاق", value: t.due_date ?? "—" },
        { label: "الوزن", value: String(t.weight ?? 1) },
      ],
    });
  }

  /* تصحيحات الحضور */
  const { data: corrections } = await db()
    .from("attendance_correction_requests")
    .select(
      "id, employee_id, work_date, correction_type, requested_check_in, requested_check_out, reason, stage, submitted_at, created_at",
    )
    .in("stage", ["pending_manager", "pending_hr"]);
  for (const c of corrections ?? []) {
    if (!(await canDecide(actor, String(c.stage), c.employee_id))) continue;
    items.push({
      kind: "attendance_correction",
      id: c.id,
      stage: String(c.stage) as ApprovalStage,
      title: `${APPROVAL_KIND_LABELS.attendance_correction}: ${CORRECTION_TYPE_LABELS[c.correction_type] ?? c.correction_type}`,
      summary: `يوم ${c.work_date}`,
      ...base(c.employee_id),
      since: c.submitted_at ?? c.created_at,
      details: [
        { label: "اليوم", value: c.work_date },
        { label: "حضور مقترح", value: String(c.requested_check_in ?? "—").slice(0, 5) },
        { label: "انصراف مقترح", value: String(c.requested_check_out ?? "—").slice(0, 5) },
        { label: "السبب", value: c.reason ?? "—" },
      ],
    });
  }

  /* طلبات ونماذج الموارد البشرية */
  const { data: hrRequests } = await db()
    .from("hr_requests")
    .select(
      "id, employee_id, stage, values, submitted_at, created_at, hr_request_types(name, category, fields, is_confidential)",
    )
    .in("stage", PENDING_STAGES);
  for (const r of hrRequests ?? []) {
    const type = r.hr_request_types as unknown as {
      name: string;
      category: string;
      fields: { key: string; label: string; type: string }[];
      is_confidential: boolean;
    } | null;
    if (!type) continue;
    if (type.is_confidential && !(actor.isHr || actor.isDirector)) continue;
    if (!(await canDecide(actor, String(r.stage), r.employee_id))) continue;
    const values = (r.values ?? {}) as Record<string, unknown>;
    items.push({
      kind: "hr_request",
      id: r.id,
      stage: String(r.stage) as ApprovalStage,
      title: `${APPROVAL_KIND_LABELS.hr_request}: ${type.name}`,
      summary: type.category,
      ...base(r.employee_id),
      since: r.submitted_at ?? r.created_at,
      details: (type.fields ?? []).map((f) => ({
        label: f.label,
        value:
          f.type === "boolean"
            ? values[f.key]
              ? "نعم"
              : "لا"
            : String(values[f.key] ?? "—"),
      })),
    });
  }

  return items.sort((a, b) => a.since.localeCompare(b.since));
}

/* ───────────────── المهام ───────────────── */

export async function submitTask(userId: string, taskId: string) {
  const actor = await loadActor(userId);
  const { data: task } = await db()
    .from("tasks")
    .select("id, title, assignee_id, assigned_by, status")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) throw new Error("المهمة غير موجودة");
  const allowed =
    actor.employeeId === task.assignee_id ||
    actor.isDirector ||
    actor.isHr ||
    (await canSupervise(actor, task.assignee_id));
  if (!allowed) throw new Error("لا تملك صلاحية إنهاء هذه المهمة");

  const now = new Date().toISOString();
  const { error } = await db()
    .from("tasks")
    .update({
      status: "pending_approval",
      progress: 100,
      completed_at: null,
      approval_note: null,
      submitted_for_approval_at: now,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  const approver = task.assigned_by
    ? await db().from("employees").select("user_id").eq("id", task.assigned_by).maybeSingle()
    : null;
  await notifyInApp(approver?.data?.user_id ?? null, {
    title: "مهمة منجزة بانتظار اعتمادك",
    body: task.title,
  });
  return { ok: true };
}

export async function decideTask(
  userId: string,
  taskId: string,
  action: "approved" | "returned",
  note?: string,
) {
  const actor = await loadActor(userId);
  const { data: task } = await db().from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (!task) throw new Error("المهمة غير موجودة");
  if (String(task.status) !== "pending_approval")
    throw new Error("هذه المهمة ليست بانتظار الاعتماد");
  const allowed =
    actor.isDirector ||
    actor.isHr ||
    (!!actor.employeeId && task.assigned_by === actor.employeeId) ||
    (await canSupervise(actor, task.assignee_id));
  if (!allowed) throw new Error("لا تملك صلاحية اعتماد هذه المهمة");

  const now = new Date().toISOString();
  const { data: assignee } = await db()
    .from("employees")
    .select("user_id, full_name")
    .eq("id", task.assignee_id)
    .maybeSingle();

  if (action === "returned") {
    const { error } = await db()
      .from("tasks")
      .update({
        status: "in_progress",
        progress: 90,
        approval_note: note ?? null,
        submitted_for_approval_at: null,
      })
      .eq("id", taskId);
    if (error) throw new Error(error.message);
    await notifyInApp(assignee?.user_id ?? null, {
      title: "أُعيدت مهمتك للتعديل",
      body: `${task.title}${note ? ` — ${note}` : ""}`,
    });
    return { ok: true };
  }

  const { error } = await db()
    .from("tasks")
    .update({
      status: "completed",
      progress: 100,
      completed_at: now,
      approved_by: userId,
      approved_at: now,
      approval_note: note ?? null,
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  if (task.recurrence && task.recurrence !== "none") {
    const { nextRecurrenceDates } = await import("@/components/tasks/task-utils");
    const next = nextRecurrenceDates(task.recurrence, task.start_date, task.due_date);
    if (next) {
      await db().from("tasks").insert({
        title: task.title,
        description: task.description,
        assignee_id: task.assignee_id,
        assigned_by: task.assigned_by,
        priority: task.priority,
        weight: task.weight,
        recurrence: task.recurrence,
        parent_task_id: task.id,
        start_date: next.start_date,
        due_date: next.due_date,
      });
    }
  }

  await notifyInApp(assignee?.user_id ?? null, {
    title: "تم اعتماد إنجاز مهمتك",
    body: task.title,
  });
  const { writeAudit } = await import("@/lib/org.server");
  await writeAudit(userId, {
    action: "اعتماد إنجاز مهمة",
    entity: "مهمة",
    entity_id: task.id,
    entity_label: `${assignee?.full_name ?? ""} — ${task.title}`,
  });
  return { ok: true };
}

/* ───────────────── تصحيح الحضور ───────────────── */

export type CorrectionInput = {
  id?: string | null | undefined;
  employee_id: string;
  work_date: string;
  correction_type: string;
  requested_check_in?: string | null | undefined;
  requested_check_out?: string | null | undefined;
  reason?: string | null | undefined;
  attachment_url?: string | null | undefined;
};

export async function saveCorrection(userId: string, input: CorrectionInput) {
  const actor = await loadActor(userId);
  const isSelf = actor.employeeId === input.employee_id;
  if (!isSelf && !(await canSupervise(actor, input.employee_id)))
    throw new Error("لا تملك صلاحية تقديم طلب لهذا الموظف");
  if (!input.requested_check_in && !input.requested_check_out)
    throw new Error("حدد وقت الحضور أو الانصراف المقترح على الأقل");

  const payload = {
    employee_id: input.employee_id,
    work_date: input.work_date,
    correction_type: input.correction_type,
    requested_check_in: input.requested_check_in || null,
    requested_check_out: input.requested_check_out || null,
    reason: input.reason ?? null,
    attachment_url: input.attachment_url ?? null,
  };

  if (input.id) {
    const { data: current } = await db()
      .from("attendance_correction_requests")
      .select("stage")
      .eq("id", input.id)
      .maybeSingle();
    if (!current) throw new Error("الطلب غير موجود");
    if (!["draft", "returned"].includes(String(current.stage)))
      throw new Error("لا يمكن تعديل طلب قيد الاعتماد");
    const { error } = await db()
      .from("attendance_correction_requests")
      .update(payload)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }

  const { data: row, error } = await db()
    .from("attendance_correction_requests")
    .insert({ ...payload, created_by: userId, stage: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: row.id };
}

export async function submitCorrection(userId: string, id: string) {
  const actor = await loadActor(userId);
  const { data: req } = await db()
    .from("attendance_correction_requests")
    .select("id, employee_id, stage, work_date")
    .eq("id", id)
    .maybeSingle();
  if (!req) throw new Error("الطلب غير موجود");
  if (!["draft", "returned"].includes(String(req.stage)))
    throw new Error("الطلب مُرسل للاعتماد بالفعل");
  const allowed =
    actor.employeeId === req.employee_id ||
    actor.isDirector ||
    actor.isHr ||
    (await canSupervise(actor, req.employee_id));
  if (!allowed) throw new Error("لا تملك صلاحية إرسال هذا الطلب");

  const now = new Date().toISOString();
  const { error } = await db()
    .from("attendance_correction_requests")
    .update({ stage: "pending_manager", submitted_at: now, return_reason: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await db().from("attendance_correction_approvals").insert({
    request_id: id,
    stage: "pending_manager",
    action: "submitted",
    actor_id: userId,
  });

  const { data: emp } = await db()
    .from("employees")
    .select("full_name, manager_id")
    .eq("id", req.employee_id)
    .maybeSingle();
  if (emp?.manager_id) {
    const { data: mgr } = await db()
      .from("employees")
      .select("user_id")
      .eq("id", emp.manager_id)
      .maybeSingle();
    await notifyInApp(mgr?.user_id ?? null, {
      title: "طلب تصحيح حضور بانتظار اعتمادك",
      body: `${emp.full_name}: ${req.work_date}`,
    });
  }
  return { ok: true };
}

export async function deleteCorrection(userId: string, id: string) {
  const actor = await loadActor(userId);
  const { data: req } = await db()
    .from("attendance_correction_requests")
    .select("id, employee_id, stage")
    .eq("id", id)
    .maybeSingle();
  if (!req) throw new Error("الطلب غير موجود");
  const allowed =
    actor.isDirector ||
    actor.isHr ||
    actor.employeeId === req.employee_id ||
    (await canSupervise(actor, req.employee_id));
  if (!allowed) throw new Error("لا تملك صلاحية حذف هذا الطلب");
  if (String(req.stage) === "approved" && !actor.isDirector)
    throw new Error("لا يمكن حذف طلب معتمد نهائياً");
  const { error } = await db().from("attendance_correction_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function decideCorrection(
  userId: string,
  id: string,
  action: "approved" | "returned",
  note?: string,
) {
  const actor = await loadActor(userId);
  const { data: req } = await db()
    .from("attendance_correction_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!req) throw new Error("الطلب غير موجود");

  const stage = String(req.stage);
  let allowed = false;
  let nextStage: "pending_hr" | "approved";
  if (stage === "pending_manager") {
    allowed = actor.isDirector || (await canSupervise(actor, req.employee_id));
    nextStage = "pending_hr";
  } else if (stage === "pending_hr") {
    allowed = actor.isHr || actor.isDirector;
    nextStage = "approved";
  } else {
    throw new Error("لا توجد مرحلة اعتماد قائمة لهذا الطلب");
  }
  if (!allowed) throw new Error("لا تملك صلاحية الاعتماد في هذه المرحلة");

  const { actorName, writeAudit } = await import("@/lib/org.server");
  const name = await actorName(userId);
  await db().from("attendance_correction_approvals").insert({
    request_id: req.id,
    stage: stage as never,
    action,
    note: note ?? null,
    actor_id: userId,
    actor_name: name,
  });

  const now = new Date().toISOString();
  const { data: emp } = await db()
    .from("employees")
    .select("full_name, user_id")
    .eq("id", req.employee_id)
    .maybeSingle();

  if (action === "returned") {
    const { error } = await db()
      .from("attendance_correction_requests")
      .update({ stage: "returned", return_reason: note ?? null })
      .eq("id", req.id);
    if (error) throw new Error(error.message);
    await notifyInApp(emp?.user_id ?? null, {
      title: "أُعيد طلب تصحيح الحضور للتعديل",
      body: note ?? req.work_date,
    });
    return { ok: true };
  }

  const stamp =
    stage === "pending_manager"
      ? { manager_approved_by: userId, manager_approved_at: now }
      : { hr_approved_by: userId, hr_approved_at: now };

  const { error } = await db()
    .from("attendance_correction_requests")
    .update({ ...stamp, stage: nextStage, return_reason: null })
    .eq("id", req.id);
  if (error) throw new Error(error.message);

  if (nextStage === "approved") {
    const { loadWorkContext } = await import("@/lib/attendance.server");
    const { computeAttendance } = await import("@/lib/attendance");
    const { settings } = await loadWorkContext();
    const { data: rec } = await db()
      .from("attendance_records")
      .select("check_in, check_out, permission_minutes")
      .eq("employee_id", req.employee_id)
      .eq("work_date", req.work_date)
      .maybeSingle();

    const check_in = req.requested_check_in ?? rec?.check_in ?? null;
    const check_out = req.requested_check_out ?? rec?.check_out ?? null;
    const calc = computeAttendance(
      { check_in, check_out, permission_minutes: rec?.permission_minutes ?? 0 },
      settings,
    );
    await db().from("attendance_records").upsert(
      {
        employee_id: req.employee_id,
        work_date: req.work_date,
        check_in,
        check_out,
        status: "present" as const,
        permission_minutes: rec?.permission_minutes ?? 0,
        source: "correction",
        ...calc,
      },
      { onConflict: "employee_id,work_date" },
    );

    await notifyInApp(emp?.user_id ?? null, {
      title: "تم اعتماد تصحيح الحضور",
      body: `${req.work_date} — تأخير ${formatMinutes(calc.late_minutes)}`,
    });
    await writeAudit(userId, {
      action: "اعتماد تصحيح حضور",
      entity: "تصحيح حضور",
      entity_id: req.id,
      entity_label: `${emp?.full_name ?? ""} — ${req.work_date}`,
    });
  } else {
    await notifyInApp(emp?.user_id ?? null, {
      title: "تقدّم طلب تصحيح الحضور في مسار الاعتماد",
      body: req.work_date,
    });
  }
  return { ok: true };
}
