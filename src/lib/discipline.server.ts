import { admin, loadActor, canSupervise, notifyInApp } from "@/lib/attendance.server";
import type { ApprovalStage } from "@/lib/evaluation-approval";
import { nextStage, type RequestFlowStep } from "@/lib/hr-requests";
import {
  MONTHLY_DEDUCTION_DAYS_CAP,
  isActiveSanction,
  monthKey,
  type DisciplinaryType,
  type DisciplineKind,
  type DisciplineRecord,
} from "@/lib/discipline";

function db() {
  return admin();
}

type RawType = {
  id: string;
  code: string;
  name: string;
  kind: string;
  degree: number;
  description: string | null;
  max_days: number | string;
  requires_amount: boolean;
  erase_months: number;
  approval_flow: string[];
  active: boolean;
  sort_order: number;
};

function mapType(t: RawType): DisciplinaryType {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    kind: t.kind as DisciplineKind,
    degree: t.degree,
    description: t.description,
    max_days: Number(t.max_days ?? 0),
    requires_amount: t.requires_amount,
    erase_months: t.erase_months,
    approval_flow: (t.approval_flow ?? []) as RequestFlowStep[],
    active: t.active,
    sort_order: t.sort_order,
  };
}

export async function listTypes(): Promise<DisciplinaryType[]> {
  const { data } = await db()
    .from("disciplinary_types")
    .select("*")
    .order("sort_order", { ascending: true });
  return ((data ?? []) as RawType[]).map(mapType);
}

async function directory() {
  const [{ data: emps }, { data: deps }] = await Promise.all([
    db().from("employees").select("id, full_name, employee_no, department_id, user_id, status"),
    db().from("departments").select("id, name"),
  ]);
  const departments = new Map((deps ?? []).map((d) => [d.id, d.name]));
  const employees = new Map(
    (emps ?? []).map((e) => [
      e.id,
      {
        id: e.id,
        name: e.full_name,
        employee_no: e.employee_no,
        userId: (e.user_id as string | null) ?? null,
        status: String(e.status),
        department: e.department_id ? (departments.get(e.department_id) ?? "—") : "—",
      },
    ]),
  );
  return employees;
}

type EmployeeDir = Awaited<ReturnType<typeof directory>>;

function mapRecognition(r: Record<string, unknown>, type: DisciplinaryType, dir: EmployeeDir): DisciplineRecord {
  const emp = dir.get(String(r["employee_id"]));
  return {
    id: String(r["id"]),
    kind: "recognition",
    employee_id: String(r["employee_id"]),
    employee_name: emp?.name ?? "—",
    department_name: emp?.department ?? "—",
    type_id: type.id,
    type_name: type.name,
    degree: 0,
    title: String(r["title"] ?? type.name),
    reason: (r["reason"] as string | null) ?? null,
    violation_date: null,
    discovered_date: null,
    award_date: (r["award_date"] as string | null) ?? null,
    employee_statement: null,
    penalty_days: 0,
    amount: Number(r["amount"] ?? 0),
    target_month: (r["target_month"] as string | null) ?? null,
    attachment_url: (r["attachment_url"] as string | null) ?? null,
    stage: String(r["stage"]) as ApprovalStage,
    return_reason: (r["return_reason"] as string | null) ?? null,
    submitted_at: (r["submitted_at"] as string | null) ?? null,
    erase_at: null,
    erased: false,
    appeal_note: null,
    appeal_status: "none",
    appeal_decision_note: null,
    created_at: String(r["created_at"]),
  };
}

function mapSanction(r: Record<string, unknown>, type: DisciplinaryType, dir: EmployeeDir): DisciplineRecord {
  const emp = dir.get(String(r["employee_id"]));
  return {
    id: String(r["id"]),
    kind: "sanction",
    employee_id: String(r["employee_id"]),
    employee_name: emp?.name ?? "—",
    department_name: emp?.department ?? "—",
    type_id: type.id,
    type_name: type.name,
    degree: type.degree,
    title: type.name,
    reason: (r["violation_description"] as string | null) ?? null,
    violation_date: (r["violation_date"] as string | null) ?? null,
    discovered_date: (r["discovered_date"] as string | null) ?? null,
    award_date: null,
    employee_statement: (r["employee_statement"] as string | null) ?? null,
    penalty_days: Number(r["penalty_days"] ?? 0),
    amount: Number(r["amount"] ?? 0),
    target_month: (r["target_month"] as string | null) ?? null,
    attachment_url: (r["attachment_url"] as string | null) ?? null,
    stage: String(r["stage"]) as ApprovalStage,
    return_reason: (r["return_reason"] as string | null) ?? null,
    submitted_at: (r["submitted_at"] as string | null) ?? null,
    erase_at: (r["erase_at"] as string | null) ?? null,
    erased: Boolean(r["erased"]),
    appeal_note: (r["appeal_note"] as string | null) ?? null,
    appeal_status: (String(r["appeal_status"] ?? "none") as DisciplineRecord["appeal_status"]),
    appeal_decision_note: (r["appeal_decision_note"] as string | null) ?? null,
    created_at: String(r["created_at"]),
  };
}

export async function listDiscipline(userId: string) {
  const actor = await loadActor(userId);
  const [types, dir, { data: recogs }, { data: sanctions }] = await Promise.all([
    listTypes(),
    directory(),
    db().from("employee_recognitions").select("*").order("created_at", { ascending: false }).limit(500),
    db().from("disciplinary_actions").select("*").order("created_at", { ascending: false }).limit(500),
  ]);
  const typeMap = new Map(types.map((t) => [t.id, t]));

  const rows: DisciplineRecord[] = [];
  const visible = new Map<string, boolean>();
  const canSee = async (employeeId: string) => {
    if (actor.isHr || actor.isDirector) return true;
    if (actor.employeeId === employeeId) return true;
    if (!visible.has(employeeId)) visible.set(employeeId, await canSupervise(actor, employeeId));
    return visible.get(employeeId) ?? false;
  };

  for (const r of recogs ?? []) {
    const t = typeMap.get(r.type_id);
    if (!t) continue;
    if (!(await canSee(r.employee_id))) continue;
    rows.push(mapRecognition(r as Record<string, unknown>, t, dir));
  }
  for (const r of sanctions ?? []) {
    const t = typeMap.get(r.type_id);
    if (!t) continue;
    if (!(await canSee(r.employee_id))) continue;
    rows.push(mapSanction(r as Record<string, unknown>, t, dir));
  }
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const employees = [...dir.values()]
    .filter((e) => e.status !== "terminated")
    .map((e) => ({ id: e.id, name: e.name, employee_no: e.employee_no, department: e.department }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return {
    types,
    rows,
    employees,
    myEmployeeId: actor.employeeId,
    canManage: actor.isHr || actor.isDirector,
    isDirector: actor.isDirector,
    isHr: actor.isHr,
  };
}

/** السجل التأديبي الفعّال لموظف — للتدرج واقتراح الدرجة التالية */
export async function employeeSanctionHistory(employeeId: string) {
  const [types, dir, { data }] = await Promise.all([
    listTypes(),
    directory(),
    db().from("disciplinary_actions").select("*").eq("employee_id", employeeId),
  ]);
  const typeMap = new Map(types.map((t) => [t.id, t]));
  const rows: DisciplineRecord[] = [];
  for (const r of data ?? []) {
    const t = typeMap.get(r.type_id);
    if (t) rows.push(mapSanction(r as Record<string, unknown>, t, dir));
  }
  return rows.filter((r) => isActiveSanction(r));
}

export type SaveRecognitionInput = {
  id?: string | null | undefined;
  employee_id: string;
  type_id: string;
  title: string;
  reason?: string | null | undefined;
  award_date: string;
  amount: number;
  target_month?: string | null | undefined;
  attachment_url?: string | null | undefined;
  submit?: boolean | undefined;
};

export type SaveSanctionInput = {
  id?: string | null | undefined;
  employee_id: string;
  type_id: string;
  violation_date: string;
  discovered_date: string;
  violation_description: string;
  employee_statement?: string | null | undefined;
  penalty_days: number;
  amount: number;
  target_month?: string | null | undefined;
  attachment_url?: string | null | undefined;
  submit?: boolean | undefined;
};

async function assertCanAuthor(userId: string, employeeId: string) {
  const actor = await loadActor(userId);
  const allowed = actor.isHr || actor.isDirector || (await canSupervise(actor, employeeId));
  if (!allowed) throw new Error("لا تملك صلاحية إنشاء سجل لهذا الموظف");
  return actor;
}

async function getType(typeId: string) {
  const { data } = await db().from("disciplinary_types").select("*").eq("id", typeId).maybeSingle();
  if (!data) throw new Error("النوع غير موجود");
  return mapType(data as RawType);
}

export async function saveRecognition(userId: string, input: SaveRecognitionInput) {
  await assertCanAuthor(userId, input.employee_id);
  const type = await getType(input.type_id);
  if (type.kind !== "recognition") throw new Error("النوع المختار ليس تكريماً");
  if (type.requires_amount && input.amount <= 0) throw new Error("المبلغ مطلوب لهذا النوع");

  const stage: ApprovalStage = input.submit ? nextStage(type.approval_flow, "draft") : "draft";
  const payload = {
    employee_id: input.employee_id,
    type_id: type.id,
    title: input.title,
    reason: input.reason ?? null,
    award_date: input.award_date,
    amount: input.amount,
    target_month: input.target_month ?? null,
    attachment_url: input.attachment_url ?? null,
    stage,
    return_reason: null,
    submitted_at: input.submit ? new Date().toISOString() : null,
    created_by: userId,
  };
  const id = await upsert("employee_recognitions", input.id ?? null, payload);
  if (input.submit) await notifyStage(stage, input.employee_id, `تكريم: ${type.name}`);
  return { ok: true, id };
}

export async function saveSanction(userId: string, input: SaveSanctionInput) {
  await assertCanAuthor(userId, input.employee_id);
  const type = await getType(input.type_id);
  if (type.kind !== "sanction") throw new Error("النوع المختار ليس جزاءً");
  if (input.violation_date > input.discovered_date)
    throw new Error("تاريخ الاكتشاف يجب ألا يسبق تاريخ الواقعة");
  if (type.max_days > 0 && input.penalty_days > type.max_days)
    throw new Error(`الحد الأقصى لهذا الجزاء هو أجر ${type.max_days} أيام عن المخالفة الواحدة`);
  if (input.submit && !input.employee_statement?.trim())
    throw new Error("يجب تسجيل إفادة الموظف (سماع أقواله) قبل رفع الجزاء للاعتماد");

  const targetMonth = input.target_month ?? monthKey(input.discovered_date);
  if (input.penalty_days > 0) {
    const { data: others } = await db()
      .from("disciplinary_actions")
      .select("id, penalty_days")
      .eq("employee_id", input.employee_id)
      .eq("target_month", targetMonth)
      .neq("stage", "returned");
    const total = (others ?? [])
      .filter((o) => o.id !== input.id)
      .reduce((s, o) => s + Number(o.penalty_days ?? 0), 0);
    if (total + input.penalty_days > MONTHLY_DEDUCTION_DAYS_CAP)
      throw new Error(
        `مجموع الخصم التأديبي في الشهر لا يجوز أن يتجاوز أجر ${MONTHLY_DEDUCTION_DAYS_CAP} أيام (المسجل حالياً ${total})`,
      );
  }

  const stage: ApprovalStage = input.submit ? nextStage(type.approval_flow, "draft") : "draft";
  const payload = {
    employee_id: input.employee_id,
    type_id: type.id,
    violation_date: input.violation_date,
    discovered_date: input.discovered_date,
    violation_description: input.violation_description,
    employee_statement: input.employee_statement ?? null,
    statement_date: input.employee_statement ? input.discovered_date : null,
    penalty_days: input.penalty_days,
    amount: input.amount,
    target_month: targetMonth,
    attachment_url: input.attachment_url ?? null,
    stage,
    return_reason: null,
    submitted_at: input.submit ? new Date().toISOString() : null,
    created_by: userId,
  };
  const id = await upsert("disciplinary_actions", input.id ?? null, payload);
  if (input.submit) await notifyStage(stage, input.employee_id, `جزاء: ${type.name}`);
  return { ok: true, id };
}

async function upsert(
  table: "employee_recognitions" | "disciplinary_actions",
  id: string | null,
  payload: Record<string, unknown>,
) {
  if (id) {
    const { data: existing } = await db().from(table).select("stage").eq("id", id).maybeSingle();
    if (!existing) throw new Error("السجل غير موجود");
    if (!["draft", "returned"].includes(String(existing.stage)))
      throw new Error("لا يمكن تعديل سجل قيد الاعتماد أو معتمد");
    const { error } = await db().from(table).update(payload as never).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await db().from(table).insert(payload as never).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteRecord(userId: string, kind: DisciplineKind, id: string) {
  const actor = await loadActor(userId);
  const table = kind === "recognition" ? "employee_recognitions" : "disciplinary_actions";
  const { data: r } = await db().from(table).select("employee_id, stage").eq("id", id).maybeSingle();
  if (!r) throw new Error("السجل غير موجود");
  const allowed =
    actor.isHr || actor.isDirector || (await canSupervise(actor, String(r.employee_id)));
  if (!allowed) throw new Error("لا تملك صلاحية الحذف");
  if (!["draft", "returned"].includes(String(r.stage)) && !actor.isDirector)
    throw new Error("لا يمكن حذف سجل قيد الاعتماد");
  const { error } = await db().from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function notifyStage(stage: ApprovalStage, employeeId: string, label: string) {
  const { data: emp } = await db()
    .from("employees")
    .select("full_name, manager_id")
    .eq("id", employeeId)
    .maybeSingle();
  const targets: string[] = [];
  if (stage === "pending_manager" && emp?.manager_id) {
    const { data: mgr } = await db()
      .from("employees")
      .select("user_id")
      .eq("id", emp.manager_id)
      .maybeSingle();
    if (mgr?.user_id) targets.push(mgr.user_id);
  }
  if (stage === "pending_hr" || stage === "pending_director") {
    const role = stage === "pending_hr" ? "hr" : "executive_director";
    const { data: roles } = await db().from("user_roles").select("user_id").eq("role", role);
    for (const r of roles ?? []) targets.push(r.user_id);
  }
  for (const uid of [...new Set(targets)]) {
    await notifyInApp(uid, { title: `بانتظار اعتمادك — ${label}`, body: emp?.full_name ?? "" });
  }
}

export async function decideRecord(
  userId: string,
  kind: DisciplineKind,
  id: string,
  action: "approved" | "returned",
  note?: string,
) {
  const actor = await loadActor(userId);
  const table = kind === "recognition" ? "employee_recognitions" : "disciplinary_actions";
  const { data: r } = await db().from(table).select("*").eq("id", id).maybeSingle();
  if (!r) throw new Error("السجل غير موجود");
  const stage = String(r.stage) as ApprovalStage;
  const allowed =
    stage === "pending_manager"
      ? actor.isDirector || actor.isHr || (await canSupervise(actor, String(r.employee_id)))
      : stage === "pending_hr"
        ? actor.isHr || actor.isDirector
        : stage === "pending_director"
          ? actor.isDirector
          : false;
  if (!allowed) throw new Error("لا تملك صلاحية اتخاذ القرار في هذه المرحلة");
  if (action === "returned" && !note?.trim()) throw new Error("يرجى كتابة سبب الإعادة");

  const type = await getType(String(r.type_id));
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (action === "returned") {
    patch["stage"] = "returned";
    patch["return_reason"] = note ?? null;
  } else {
    patch["stage"] = nextStage(type.approval_flow, stage);
    patch["return_reason"] = null;
    if (stage === "pending_manager") {
      patch["manager_approved_by"] = userId;
      patch["manager_approved_at"] = now;
    } else if (stage === "pending_hr") {
      patch["hr_approved_by"] = userId;
      patch["hr_approved_at"] = now;
    } else {
      patch["director_approved_by"] = userId;
      patch["director_approved_at"] = now;
    }
  }

  const finalApproved = patch["stage"] === "approved";
  if (finalApproved && kind === "sanction" && type.erase_months > 0) {
    const d = new Date();
    d.setMonth(d.getMonth() + type.erase_months);
    patch["erase_at"] = d.toISOString().slice(0, 10);
  }

  const { error } = await db().from(table).update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);

  const { data: profile } = await db()
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  await db().from("discipline_approvals").insert({
    record_kind: kind,
    record_id: id,
    stage,
    action,
    actor_id: userId,
    actor_name: profile?.full_name ?? null,
    note: note ?? null,
  });

  if (finalApproved) await applyApproved(userId, kind, id, type, r as Record<string, unknown>);

  const { data: emp } = await db()
    .from("employees")
    .select("user_id")
    .eq("id", String(r.employee_id))
    .maybeSingle();
  await notifyInApp(emp?.user_id ?? null, {
    title:
      action === "returned"
        ? `أُعيد سجل ${type.name} للتعديل`
        : finalApproved
          ? kind === "recognition"
            ? `تهانينا — تم اعتماد تكريمك: ${type.name}`
            : `تم توقيع جزاء بحقك: ${type.name}`
          : `تقدّم سجل ${type.name} إلى المرحلة التالية`,
    body: note ?? null,
  });

  return { ok: true };
}

/** عند الاعتماد النهائي: بند رواتب + حدث في دورة حياة الموظف */
async function applyApproved(
  userId: string,
  kind: DisciplineKind,
  id: string,
  type: DisciplinaryType,
  row: Record<string, unknown>,
) {
  const employeeId = String(row["employee_id"]);
  const amount = Number(row["amount"] ?? 0);
  const targetMonth = (row["target_month"] as string | null) ?? monthKey();

  if (amount > 0) {
    const { data: adj } = await db()
      .from("payroll_adjustments")
      .insert({
        employee_id: employeeId,
        target_month: targetMonth,
        kind: kind === "recognition" ? "addition" : "deduction",
        reason_type: kind === "recognition" ? "compensation" : "penalty",
        amount,
        reason: type.name,
        status: "draft",
        created_by: userId,
      })
      .select("id")
      .single();
    if (adj?.id) {
      const table = kind === "recognition" ? "employee_recognitions" : "disciplinary_actions";
      await db().from(table).update({ payroll_adjustment_id: adj.id }).eq("id", id);
    }
  }

  await db().from("employee_lifecycle_events").insert({
    employee_id: employeeId,
    event_type: kind === "recognition" ? "recognition" : "sanction",
    title: type.name,
    details:
      kind === "recognition"
        ? ((row["reason"] as string | null) ?? null)
        : ((row["violation_description"] as string | null) ?? null),
    event_date:
      (row["award_date"] as string | null) ??
      (row["violation_date"] as string | null) ??
      new Date().toISOString().slice(0, 10),
    ref_table: kind === "recognition" ? "employee_recognitions" : "disciplinary_actions",
    ref_id: id,
    created_by: userId,
  });

  if (kind === "sanction" && type.code === "dismissal") {
    await db().from("employees").update({ status: "terminated" }).eq("id", employeeId);
  }
}

/** تظلّم الموظف على جزاء معتمد */
export async function submitAppeal(userId: string, id: string, note: string) {
  const actor = await loadActor(userId);
  const { data: r } = await db()
    .from("disciplinary_actions")
    .select("employee_id, stage, appeal_status")
    .eq("id", id)
    .maybeSingle();
  if (!r) throw new Error("الجزاء غير موجود");
  if (r.employee_id !== actor.employeeId) throw new Error("التظلّم يقدَّم من صاحب الجزاء فقط");
  if (String(r.stage) !== "approved") throw new Error("لا يمكن التظلّم إلا على جزاء معتمد");
  if (String(r.appeal_status) !== "none") throw new Error("سبق تقديم تظلّم على هذا الجزاء");

  const { error } = await db()
    .from("disciplinary_actions")
    .update({ appeal_note: note, appeal_at: new Date().toISOString(), appeal_status: "submitted" })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { data: roles } = await db().from("user_roles").select("user_id").in("role", ["hr", "executive_director"]);
  for (const rr of roles ?? []) {
    await notifyInApp(rr.user_id, { title: "تظلّم جديد على جزاء تأديبي", body: note.slice(0, 200) });
  }
  return { ok: true };
}

export async function decideAppeal(
  userId: string,
  id: string,
  decision: "accepted" | "rejected",
  note?: string,
) {
  const actor = await loadActor(userId);
  if (!actor.isHr && !actor.isDirector) throw new Error("البت في التظلّم للموارد البشرية أو المدير التنفيذي");
  const { data: r } = await db()
    .from("disciplinary_actions")
    .select("employee_id, appeal_status, payroll_adjustment_id")
    .eq("id", id)
    .maybeSingle();
  if (!r) throw new Error("الجزاء غير موجود");
  if (String(r.appeal_status) !== "submitted") throw new Error("لا يوجد تظلّم قيد النظر");

  const patch: Record<string, unknown> = {
    appeal_status: decision,
    appeal_decision_note: note ?? null,
    appeal_decided_by: userId,
    appeal_decided_at: new Date().toISOString(),
  };
  if (decision === "accepted") patch["erased"] = true;
  const { error } = await db().from("disciplinary_actions").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);

  if (decision === "accepted" && r.payroll_adjustment_id) {
    await db()
      .from("payroll_adjustments")
      .delete()
      .eq("id", String(r.payroll_adjustment_id))
      .eq("status", "draft");
  }

  const { data: emp } = await db()
    .from("employees")
    .select("user_id")
    .eq("id", String(r.employee_id))
    .maybeSingle();
  await notifyInApp(emp?.user_id ?? null, {
    title: decision === "accepted" ? "تم قبول تظلّمك وإلغاء الجزاء" : "تم رفض تظلّمك",
    body: note ?? null,
  });
  return { ok: true };
}

/** محو الجزاءات منتهية المدة من السجل الفعّال */
export async function eraseExpired() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db()
    .from("disciplinary_actions")
    .update({ erased: true })
    .lt("erase_at", today)
    .eq("erased", false)
    .eq("stage", "approved")
    .select("id");
  return { erased: (data ?? []).length };
}
