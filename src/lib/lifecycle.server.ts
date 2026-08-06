import { admin, loadActor, canSupervise, notifyInApp } from "@/lib/attendance.server";
import {
  PROBATION_DAYS,
  computeStage,
  daysBetween,
  type ChecklistItem,
  type ChecklistKind,
  type LifecycleEvent,
  type Movement,
  type Offboarding,
} from "@/lib/lifecycle";

function db() {
  return admin();
}

async function assertManage(userId: string, employeeId?: string) {
  const actor = await loadActor(userId);
  if (actor.isHr || actor.isDirector) return actor;
  if (employeeId && (await canSupervise(actor, employeeId))) return actor;
  throw new Error("لا تملك صلاحية إدارة دورة حياة هذا الموظف");
}

/** ملخص دورة الحياة لكل الموظفين ضمن صلاحية المستخدم */
export async function listLifecycle(userId: string) {
  const actor = await loadActor(userId);
  const [{ data: emps }, { data: deps }, { data: items }, { data: offs }] = await Promise.all([
    db()
      .from("employees")
      .select("id, full_name, employee_no, job_title, department_id, hire_date, status, manager_id"),
    db().from("departments").select("id, name"),
    db().from("lifecycle_checklist_items").select("employee_id, kind, is_done"),
    db().from("employee_offboarding").select("*").neq("status", "completed"),
  ]);
  const depMap = new Map((deps ?? []).map((d) => [d.id, d.name]));
  const offMap = new Map((offs ?? []).map((o) => [o.employee_id, o as unknown as Offboarding]));

  const openOnboarding = new Map<string, number>();
  for (const i of items ?? []) {
    if (i.kind !== "onboarding" || i.is_done) continue;
    openOnboarding.set(i.employee_id, (openOnboarding.get(i.employee_id) ?? 0) + 1);
  }

  const rows = [];
  for (const e of emps ?? []) {
    const visible =
      actor.isHr ||
      actor.isDirector ||
      actor.employeeId === e.id ||
      (await canSupervise(actor, e.id));
    if (!visible) continue;
    const offboarding = offMap.get(e.id) ?? null;
    const stage = computeStage({
      status: String(e.status),
      hire_date: e.hire_date,
      onboardingOpen: openOnboarding.get(e.id) ?? 0,
      offboarding,
    });
    const serviceDays = e.hire_date ? daysBetween(e.hire_date, new Date()) : 0;
    rows.push({
      id: e.id,
      name: e.full_name,
      employee_no: e.employee_no,
      job_title: e.job_title,
      department: e.department_id ? (depMap.get(e.department_id) ?? "—") : "—",
      hire_date: e.hire_date,
      status: String(e.status),
      stage,
      serviceDays,
      probationDaysLeft: Math.max(0, PROBATION_DAYS - serviceDays),
      openOnboarding: openOnboarding.get(e.id) ?? 0,
      lastWorkingDay: offboarding?.last_working_day ?? null,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return {
    rows,
    canManage: actor.isHr || actor.isDirector,
    myEmployeeId: actor.employeeId,
  };
}

/** تفاصيل دورة حياة موظف واحد */
export async function getEmployeeLifecycle(userId: string, employeeId: string) {
  const actor = await loadActor(userId);
  const allowed =
    actor.isHr ||
    actor.isDirector ||
    actor.employeeId === employeeId ||
    (await canSupervise(actor, employeeId));
  if (!allowed) throw new Error("لا تملك صلاحية الاطلاع على هذا السجل");

  const [{ data: events }, { data: items }, { data: movements }, { data: off }, { data: emp }] =
    await Promise.all([
      db()
        .from("employee_lifecycle_events")
        .select("*")
        .eq("employee_id", employeeId)
        .order("event_date", { ascending: false }),
      db()
        .from("lifecycle_checklist_items")
        .select("*")
        .eq("employee_id", employeeId)
        .order("sort_order", { ascending: true }),
      db()
        .from("employment_movements")
        .select("*")
        .eq("employee_id", employeeId)
        .order("effective_date", { ascending: false }),
      db()
        .from("employee_offboarding")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db()
        .from("employees")
        .select("id, full_name, employee_no, job_title, hire_date, status, basic_salary")
        .eq("id", employeeId)
        .maybeSingle(),
    ]);

  return {
    employee: emp,
    events: (events ?? []) as unknown as LifecycleEvent[],
    checklist: (items ?? []) as unknown as ChecklistItem[],
    movements: (movements ?? []) as unknown as Movement[],
    offboarding: (off ?? null) as unknown as Offboarding | null,
    canManage: actor.isHr || actor.isDirector,
  };
}

/** توليد قائمة مهام التهيئة أو إخلاء الطرف من القوالب */
export async function generateChecklist(userId: string, employeeId: string, kind: ChecklistKind) {
  await assertManage(userId, employeeId);
  const [{ data: templates }, { data: existing }, { data: emp }] = await Promise.all([
    db()
      .from("lifecycle_checklist_templates")
      .select("*")
      .eq("kind", kind)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    db().from("lifecycle_checklist_items").select("title").eq("employee_id", employeeId).eq("kind", kind),
    db().from("employees").select("hire_date, user_id").eq("id", employeeId).maybeSingle(),
  ]);
  const have = new Set((existing ?? []).map((i) => i.title));
  const base = emp?.hire_date ? new Date(emp.hire_date) : new Date();

  const toInsert = (templates ?? [])
    .filter((t) => !have.has(t.title))
    .map((t) => {
      const due = new Date(base);
      due.setDate(due.getDate() + Number(t.offset_days ?? 0));
      return {
        employee_id: employeeId,
        kind,
        title: t.title,
        owner_role: t.owner_role,
        due_date: due.toISOString().slice(0, 10),
        sort_order: t.sort_order,
      };
    });
  if (toInsert.length > 0) {
    const { error } = await db().from("lifecycle_checklist_items").insert(toInsert);
    if (error) throw new Error(error.message);
  }
  if (kind === "onboarding" && toInsert.length > 0) {
    await addEvent(userId, employeeId, "onboarding", "بدء إجراءات التهيئة والانضمام", null);
    await notifyInApp(emp?.user_id ?? null, {
      title: "بدأت إجراءات التهيئة الخاصة بك",
      body: `تم إنشاء ${toInsert.length} مهمة انضمام`,
    });
  }
  return { added: toInsert.length };
}

export async function toggleChecklistItem(userId: string, id: string, done: boolean, note?: string) {
  const { data: item } = await db()
    .from("lifecycle_checklist_items")
    .select("employee_id")
    .eq("id", id)
    .maybeSingle();
  if (!item) throw new Error("البند غير موجود");
  await assertManage(userId, String(item.employee_id));
  const { error } = await db()
    .from("lifecycle_checklist_items")
    .update({
      is_done: done,
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? userId : null,
      note: note ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function addChecklistItem(
  userId: string,
  input: {
    employee_id: string;
    kind: ChecklistKind;
    title: string;
    owner_role: string;
    due_date?: string | null | undefined;
  },
) {
  await assertManage(userId, input.employee_id);
  const { error } = await db().from("lifecycle_checklist_items").insert({
    employee_id: input.employee_id,
    kind: input.kind,
    title: input.title,
    owner_role: input.owner_role,
    due_date: input.due_date ?? null,
    sort_order: 999,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function addEvent(
  userId: string,
  employeeId: string,
  eventType: string,
  title: string,
  details: string | null,
  eventDate?: string,
) {
  const { error } = await db().from("employee_lifecycle_events").insert({
    employee_id: employeeId,
    event_type: eventType,
    title,
    details,
    event_date: eventDate ?? new Date().toISOString().slice(0, 10),
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export type MovementInput = {
  employee_id: string;
  movement_type: string;
  effective_date: string;
  from_value?: string | null | undefined;
  to_value?: string | null | undefined;
  note?: string | null | undefined;
  apply?: boolean | undefined;
};

/** تسجيل حركة وظيفية (ترقية/نقل/تعديل راتب) مع إمكانية تطبيقها على ملف الموظف */
export async function saveMovement(userId: string, input: MovementInput) {
  await assertManage(userId, input.employee_id);
  const { data: emp } = await db()
    .from("employees")
    .select("job_title, department_id, section_id, basic_salary, user_id")
    .eq("id", input.employee_id)
    .maybeSingle();
  if (!emp) throw new Error("الموظف غير موجود");

  const from =
    input.from_value ??
    (input.movement_type === "salary_change"
      ? String(emp.basic_salary ?? 0)
      : input.movement_type === "transfer"
        ? (emp.department_id ?? null)
        : (emp.job_title ?? null));

  const { data: row, error } = await db()
    .from("employment_movements")
    .insert({
      employee_id: input.employee_id,
      movement_type: input.movement_type,
      effective_date: input.effective_date,
      from_value: from,
      to_value: input.to_value ?? null,
      note: input.note ?? null,
      applied: false,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (input.apply && input.to_value) {
    const patch: Record<string, unknown> = {};
    if (input.movement_type === "salary_change") patch["basic_salary"] = Number(input.to_value);
    else if (input.movement_type === "transfer") patch["department_id"] = input.to_value;
    else if (input.movement_type === "promotion" || input.movement_type === "title_change")
      patch["job_title"] = input.to_value;
    if (Object.keys(patch).length > 0) {
      await db().from("employees").update(patch as never).eq("id", input.employee_id);
      await db().from("employment_movements").update({ applied: true }).eq("id", row.id);
    }
  }

  await addEvent(
    userId,
    input.employee_id,
    input.movement_type,
    `${input.movement_type === "salary_change" ? "تعديل راتب" : "حركة وظيفية"}: ${input.to_value ?? ""}`,
    input.note ?? null,
    input.effective_date,
  );
  await notifyInApp(emp.user_id ?? null, {
    title: "تحديث على ملفك الوظيفي",
    body: input.note ?? "تم تسجيل حركة وظيفية جديدة",
  });
  return { ok: true, id: row.id };
}

/** تثبيت الموظف بعد فترة التجربة */
export async function confirmProbation(userId: string, employeeId: string, note?: string) {
  await assertManage(userId, employeeId);
  await addEvent(userId, employeeId, "confirmation", "تثبيت بعد اجتياز فترة التجربة", note ?? null);
  const { data: emp } = await db()
    .from("employees")
    .select("user_id")
    .eq("id", employeeId)
    .maybeSingle();
  await notifyInApp(emp?.user_id ?? null, {
    title: "تهانينا — تم تثبيتك بعد فترة التجربة",
    body: note ?? null,
  });
  return { ok: true };
}

export type OffboardingInput = {
  employee_id: string;
  termination_type: string;
  notice_date?: string | null | undefined;
  last_working_day: string;
  reason?: string | null | undefined;
  settlement_amount?: number | undefined;
};

export async function startOffboarding(userId: string, input: OffboardingInput) {
  await assertManage(userId, input.employee_id);
  const { data: existing } = await db()
    .from("employee_offboarding")
    .select("id")
    .eq("employee_id", input.employee_id)
    .neq("status", "completed")
    .maybeSingle();
  if (existing) throw new Error("توجد إجراءات إنهاء خدمة جارية بالفعل");

  const { error } = await db().from("employee_offboarding").insert({
    employee_id: input.employee_id,
    termination_type: input.termination_type,
    notice_date: input.notice_date ?? null,
    last_working_day: input.last_working_day,
    reason: input.reason ?? null,
    settlement_amount: input.settlement_amount ?? 0,
    status: "in_progress",
    created_by: userId,
  });
  if (error) throw new Error(error.message);

  await generateChecklist(userId, input.employee_id, "offboarding");
  await addEvent(
    userId,
    input.employee_id,
    "offboarding",
    "بدء إجراءات إنهاء الخدمة",
    input.reason ?? null,
    input.last_working_day,
  );
  return { ok: true };
}

export async function completeOffboarding(userId: string, employeeId: string) {
  await assertManage(userId, employeeId);
  const { data: open } = await db()
    .from("lifecycle_checklist_items")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("kind", "offboarding")
    .eq("is_done", false);
  if ((open ?? []).length > 0)
    throw new Error(`لا يمكن الإنهاء قبل استكمال ${(open ?? []).length} بنداً من إخلاء الطرف`);

  const { data: off } = await db()
    .from("employee_offboarding")
    .select("id, last_working_day")
    .eq("employee_id", employeeId)
    .neq("status", "completed")
    .maybeSingle();
  if (!off) throw new Error("لا توجد إجراءات إنهاء خدمة جارية");

  await db()
    .from("employee_offboarding")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", off.id);
  await db().from("employees").update({ status: "terminated" }).eq("id", employeeId);
  await addEvent(
    userId,
    employeeId,
    "terminated",
    "انتهاء الخدمة واستكمال إخلاء الطرف",
    null,
    String(off.last_working_day),
  );
  return { ok: true };
}

/* ============ حذف/تعديل سجلات دورة الحياة (الموارد البشرية والمدير التنفيذي فقط) ============ */

async function assertAdmin(userId: string) {
  const actor = await loadActor(userId);
  if (!(actor.isHr || actor.isDirector))
    throw new Error("هذه العملية متاحة للموارد البشرية والمدير التنفيذي فقط");
  return actor;
}

export async function deleteLifecycleEvent(userId: string, id: string) {
  await assertAdmin(userId);
  const { error } = await db().from("employee_lifecycle_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function updateLifecycleEvent(
  userId: string,
  id: string,
  input: {
    title?: string | undefined;
    details?: string | null | undefined;
    event_date?: string | undefined;
    event_type?: string | undefined;
  },
) {
  await assertAdmin(userId);
  const patch: {
    title?: string;
    details?: string | null;
    event_date?: string;
    event_type?: string;
  } = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.details !== undefined) patch.details = input.details;
  if (input.event_date !== undefined) patch.event_date = input.event_date;
  if (input.event_type !== undefined) patch.event_type = input.event_type;
  const { error } = await db().from("employee_lifecycle_events").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteLifecycleItem(userId: string, id: string) {
  await assertAdmin(userId);
  const { error } = await db().from("lifecycle_checklist_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteMovement(userId: string, id: string) {
  await assertAdmin(userId);
  const { error } = await db().from("employment_movements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** إلغاء إجراءات إنهاء خدمة جارية وإعادة الموظف للحالة النشطة */
export async function cancelOffboarding(userId: string, employeeId: string) {
  await assertAdmin(userId);
  const { data: off } = await db()
    .from("employee_offboarding")
    .select("id")
    .eq("employee_id", employeeId)
    .neq("status", "completed")
    .maybeSingle();
  if (!off) throw new Error("لا توجد إجراءات إنهاء خدمة جارية");
  await db().from("employee_offboarding").delete().eq("id", off.id);
  await db()
    .from("lifecycle_checklist_items")
    .delete()
    .eq("employee_id", employeeId)
    .eq("kind", "offboarding");
  await db().from("employees").update({ status: "active" }).eq("id", employeeId);
  await addEvent(userId, employeeId, "note", "إلغاء إجراءات إنهاء الخدمة", null);
  return { ok: true };
}
