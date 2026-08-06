import { admin, loadActor, canSupervise, notifyInApp } from "@/lib/attendance.server";
import type { ApprovalStage } from "@/lib/evaluation-approval";
import {
  nextStage,
  type HrRequestRow,
  type HrRequestType,
  type RequestField,
  type RequestFlowStep,
} from "@/lib/hr-requests";

function db() {
  return admin();
}

type RawType = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  fields: unknown;
  approval_flow: string[];
  is_confidential: boolean;
  active: boolean;
  sort_order: number;
};

function mapType(t: RawType): HrRequestType {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    category: t.category,
    description: t.description,
    fields: (Array.isArray(t.fields) ? t.fields : []) as RequestField[],
    approval_flow: (t.approval_flow ?? []) as RequestFlowStep[],
    is_confidential: t.is_confidential,
    active: t.active,
    sort_order: t.sort_order,
  };
}

export async function listTypes(): Promise<HrRequestType[]> {
  const { data } = await db()
    .from("hr_request_types")
    .select("*")
    .order("sort_order", { ascending: true });
  return ((data ?? []) as RawType[]).map(mapType);
}

async function directory() {
  const [{ data: emps }, { data: deps }] = await Promise.all([
    db().from("employees").select("id, full_name, department_id, user_id"),
    db().from("departments").select("id, name"),
  ]);
  const departments = new Map((deps ?? []).map((d) => [d.id, d.name]));
  const employees = new Map(
    (emps ?? []).map((e) => [
      e.id,
      {
        name: e.full_name,
        userId: e.user_id as string | null,
        department: e.department_id ? (departments.get(e.department_id) ?? "—") : "—",
      },
    ]),
  );
  return employees;
}

export async function listRequests(userId: string) {
  const actor = await loadActor(userId);
  const [types, employees, { data }] = await Promise.all([
    listTypes(),
    directory(),
    db().from("hr_requests").select("*").order("created_at", { ascending: false }).limit(500),
  ]);
  const typeMap = new Map(types.map((t) => [t.id, t]));

  const rows: HrRequestRow[] = [];
  for (const r of data ?? []) {
    const type = typeMap.get(r.type_id);
    if (!type) continue;
    const mine = !!actor.employeeId && r.employee_id === actor.employeeId;
    const privileged = actor.isHr || actor.isDirector;
    let visible = mine || privileged;
    if (!visible && !type.is_confidential) visible = await canSupervise(actor, r.employee_id);
    if (!visible) continue;
    const emp = employees.get(r.employee_id);
    rows.push({
      id: r.id,
      employee_id: r.employee_id,
      type_id: r.type_id,
      title: r.title,
      values: (r.values ?? {}) as HrRequestRow["values"],
      stage: r.stage as ApprovalStage,
      return_reason: r.return_reason,
      submitted_at: r.submitted_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      employee_name: emp?.name ?? "—",
      department_name: emp?.department ?? "—",
      type_name: type.name,
      type_category: type.category,
      fields: type.fields,
    });
  }
  return { rows, myEmployeeId: actor.employeeId, canManageTypes: actor.isHr || actor.isDirector };
}

export type SaveRequestInput = {
  id?: string | null | undefined;
  type_id: string;
  values: Record<string, string | number | boolean | null>;
  submit?: boolean | undefined;
};

export async function saveRequest(userId: string, input: SaveRequestInput) {
  const actor = await loadActor(userId);
  if (!actor.employeeId) throw new Error("حسابك غير مرتبط بملف موظف");

  const { data: t } = await db()
    .from("hr_request_types")
    .select("*")
    .eq("id", input.type_id)
    .maybeSingle();
  if (!t) throw new Error("نوع الطلب غير موجود");
  const type = mapType(t as RawType);

  for (const f of type.fields) {
    const v = input.values[f.key];
    if (f.required && (v === null || v === undefined || v === "")) {
      throw new Error(`الحقل «${f.label}» مطلوب`);
    }
  }

  const stage: ApprovalStage = input.submit ? nextStage(type.approval_flow, "draft") : "draft";
  const payload = {
    employee_id: actor.employeeId,
    type_id: type.id,
    title: type.name,
    values: input.values,
    stage,
    return_reason: null,
    submitted_at: input.submit ? new Date().toISOString() : null,
    created_by: userId,
  };

  let id = input.id ?? null;
  if (id) {
    const { data: existing } = await db()
      .from("hr_requests")
      .select("employee_id, stage")
      .eq("id", id)
      .maybeSingle();
    if (!existing) throw new Error("الطلب غير موجود");
    if (existing.employee_id !== actor.employeeId) throw new Error("لا تملك صلاحية تعديل الطلب");
    if (!["draft", "returned"].includes(String(existing.stage)))
      throw new Error("لا يمكن تعديل طلب قيد الاعتماد");
    const { error } = await db().from("hr_requests").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await db()
      .from("hr_requests")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = created.id;
  }

  if (input.submit) await notifyApprovers(id, stage, type, actor.employeeId);
  return { ok: true, id };
}

export async function deleteRequest(userId: string, id: string) {
  const actor = await loadActor(userId);
  const { data: r } = await db()
    .from("hr_requests")
    .select("employee_id, stage")
    .eq("id", id)
    .maybeSingle();
  if (!r) throw new Error("الطلب غير موجود");
  const owner = !!actor.employeeId && r.employee_id === actor.employeeId;
  if (!owner && !actor.isHr && !actor.isDirector) throw new Error("لا تملك صلاحية الحذف");
  if (owner && !["draft", "returned"].includes(String(r.stage)))
    throw new Error("لا يمكن حذف طلب قيد الاعتماد");
  const { error } = await db().from("hr_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function notifyApprovers(
  requestId: string,
  stage: ApprovalStage,
  type: HrRequestType,
  employeeId: string,
) {
  const { data: emp } = await db()
    .from("employees")
    .select("full_name, manager_id, department_id")
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
    await notifyInApp(uid, {
      title: `طلب جديد بانتظار اعتمادك: ${type.name}`,
      body: `${emp?.full_name ?? ""} — رقم الطلب ${requestId.slice(0, 8)}`,
    });
  }
}

export async function decideRequest(
  userId: string,
  id: string,
  action: "approved" | "returned",
  note?: string,
) {
  const actor = await loadActor(userId);
  const { data: r } = await db().from("hr_requests").select("*").eq("id", id).maybeSingle();
  if (!r) throw new Error("الطلب غير موجود");
  const stage = String(r.stage) as ApprovalStage;

  const allowed =
    stage === "pending_manager"
      ? actor.isDirector || actor.isHr || (await canSupervise(actor, r.employee_id))
      : stage === "pending_hr"
        ? actor.isHr || actor.isDirector
        : stage === "pending_director"
          ? actor.isDirector
          : false;
  if (!allowed) throw new Error("لا تملك صلاحية اتخاذ القرار في هذه المرحلة");
  if (action === "returned" && !note?.trim()) throw new Error("يرجى كتابة سبب الإعادة");

  const { data: t } = await db()
    .from("hr_request_types")
    .select("*")
    .eq("id", r.type_id)
    .maybeSingle();
  const type = mapType(t as RawType);

  const now = new Date().toISOString();
  const patch: {
    stage: ApprovalStage;
    return_reason: string | null;
    manager_approved_by?: string;
    manager_approved_at?: string;
    hr_approved_by?: string;
    hr_approved_at?: string;
    director_approved_by?: string;
    director_approved_at?: string;
  } = { stage: "returned", return_reason: null };
  if (action === "returned") {
    patch.stage = "returned";
    patch.return_reason = note ?? null;
  } else {
    patch.stage = nextStage(type.approval_flow, stage);
    if (stage === "pending_manager") {
      patch.manager_approved_by = userId;
      patch.manager_approved_at = now;
    } else if (stage === "pending_hr") {
      patch.hr_approved_by = userId;
      patch.hr_approved_at = now;
    } else {
      patch.director_approved_by = userId;
      patch.director_approved_at = now;
    }
  }

  const { error } = await db().from("hr_requests").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  const { data: profile } = await db()
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  await db().from("hr_request_approvals").insert({
    request_id: id,
    stage,
    action,
    actor_id: userId,
    actor_name: profile?.full_name ?? null,
    note: note ?? null,
  });

  const { data: emp } = await db()
    .from("employees")
    .select("user_id")
    .eq("id", r.employee_id)
    .maybeSingle();
  const newStage = patch.stage;
  await notifyInApp(emp?.user_id ?? null, {
    title:
      action === "returned"
        ? `تمت إعادة طلبك للتعديل: ${type.name}`
        : newStage === "approved"
          ? `تم اعتماد طلبك: ${type.name}`
          : `تمت الموافقة على طلبك وانتقل للمرحلة التالية: ${type.name}`,
    body: note ?? null,
  });

  if (action === "approved" && newStage !== "approved") {
    await notifyApprovers(id, newStage as ApprovalStage, type, r.employee_id);
  }
  return { ok: true };
}

export async function saveType(
  userId: string,
  input: {
    id?: string | null | undefined;
    code: string;
    name: string;
    category: string;
    fields: RequestField[];
    approval_flow: RequestFlowStep[];
    is_confidential: boolean;
    active: boolean;
  },
) {
  const actor = await loadActor(userId);
  if (!actor.isHr && !actor.isDirector) throw new Error("لا تملك صلاحية إدارة أنواع الطلبات");
  const payload = {
    code: input.code,
    name: input.name,
    category: input.category,
    fields: input.fields,
    approval_flow: input.approval_flow,
    is_confidential: input.is_confidential,
    active: input.active,
  };
  if (input.id) {
    const { error } = await db().from("hr_request_types").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db().from("hr_request_types").insert(payload);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}
