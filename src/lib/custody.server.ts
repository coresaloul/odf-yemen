import { admin, loadActor, canSupervise, notifyInApp } from "@/lib/attendance.server";
import {
  CUSTODY_KIND_LABELS,
  OPEN_ASSIGNMENT_STATUSES,
  type CustodyAssignment,
  type CustodyAssignmentStatus,
  type CustodyItem,
  type CustodyKind,
} from "@/lib/custody";

function db() {
  return admin();
}

/* ═════════ التصنيفات ═════════ */

export async function listCategories() {
  const { data } = await db()
    .from("custody_categories")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

/* ═════════ الأصول ═════════ */

export type AssetInput = {
  id?: string | null | undefined;
  code: string;
  name: string;
  kind: CustodyKind;
  category_id?: string | null | undefined;
  status?: string | null | undefined;
  serial_no?: string | null | undefined;
  brand?: string | null | undefined;
  model?: string | null | undefined;
  purchase_date?: string | null | undefined;
  value?: number | null | undefined;
  department_id?: string | null | undefined;
  location?: string | null | undefined;
  plate_no?: string | null | undefined;
  manufacture_year?: number | null | undefined;
  insurance_expiry?: string | null | undefined;
  license_expiry?: string | null | undefined;
  odometer?: number | null | undefined;
  document_no?: string | null | undefined;
  document_expiry?: string | null | undefined;
  notes?: string | null | undefined;
};

async function assertHr(userId: string) {
  const actor = await loadActor(userId);
  if (!actor.isHr && !actor.isDirector)
    throw new Error("هذه العملية مقصورة على الموارد البشرية والمدير التنفيذي");
  return actor;
}

export async function listAssets() {
  const { data } = await db()
    .from("custody_assets")
    .select("*, custody_categories(name), departments(name)")
    .order("created_at", { ascending: false })
    .limit(1000);
  return data ?? [];
}

export async function saveAsset(userId: string, input: AssetInput) {
  await assertHr(userId);
  const payload = {
    code: input.code.trim(),
    name: input.name.trim(),
    kind: input.kind,
    category_id: input.category_id || null,
    status: (input.status || "available") as never,
    serial_no: input.serial_no || null,
    brand: input.brand || null,
    model: input.model || null,
    purchase_date: input.purchase_date || null,
    value: Number(input.value ?? 0),
    department_id: input.department_id || null,
    location: input.location || null,
    plate_no: input.plate_no || null,
    manufacture_year: input.manufacture_year ?? null,
    insurance_expiry: input.insurance_expiry || null,
    license_expiry: input.license_expiry || null,
    odometer: input.odometer ?? null,
    document_no: input.document_no || null,
    document_expiry: input.document_expiry || null,
    notes: input.notes || null,
  };

  if (input.id) {
    const { error } = await db().from("custody_assets").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await db()
    .from("custody_assets")
    .insert({ ...payload, created_by: userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function deleteAsset(userId: string, id: string) {
  await assertHr(userId);
  const { data: used } = await db()
    .from("custody_assignment_items")
    .select("id, custody_assignments!inner(status)")
    .eq("asset_id", id)
    .in("custody_assignments.status", OPEN_ASSIGNMENT_STATUSES)
    .limit(1);
  if (used && used.length) throw new Error("لا يمكن حذف أصل مرتبط بعهدة نشطة");
  const { error } = await db().from("custody_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ═════════ العهد ═════════ */

type RawItem = {
  id: string;
  assignment_id: string;
  asset_id: string | null;
  title: string;
  quantity: number;
  condition_out: string | null;
  condition_in: string | null;
  odometer_out: number | null;
  odometer_in: number | null;
  returned_at: string | null;
  return_state: string | null;
  notes: string | null;
  custody_assets?: { value: number | null } | null;
};

export async function listAssignments(userId: string) {
  const actor = await loadActor(userId);
  const { data } = await db()
    .from("custody_assignments")
    .select(
      "*, employees:employee_id(full_name, department_id), custody_assignment_items(*, custody_assets(value, code, name))",
    )
    .order("requested_at", { ascending: false })
    .limit(500);

  const { data: deps } = await db().from("departments").select("id, name");
  const depMap = new Map((deps ?? []).map((d) => [d.id, d.name]));

  const rows = data ?? [];
  const out: CustodyAssignment[] = [];
  for (const r of rows) {
    const emp = r.employees as unknown as { full_name: string; department_id: string | null } | null;
    const visible =
      actor.isDirector ||
      actor.isHr ||
      r.employee_id === actor.employeeId ||
      (await canSupervise(actor, r.employee_id));
    if (!visible) continue;
    const items = ((r.custody_assignment_items ?? []) as RawItem[]).map(
      (i): CustodyItem => ({
        id: i.id,
        assignment_id: i.assignment_id,
        asset_id: i.asset_id,
        title: i.title,
        quantity: i.quantity,
        condition_out: i.condition_out,
        condition_in: i.condition_in,
        odometer_out: i.odometer_out,
        odometer_in: i.odometer_in,
        returned_at: i.returned_at,
        return_state: i.return_state,
        notes: i.notes,
      }),
    );
    const totalValue = ((r.custody_assignment_items ?? []) as RawItem[]).reduce(
      (s, i) => s + Number(i.custody_assets?.value ?? 0) * Number(i.quantity ?? 1),
      0,
    );
    out.push({
      id: r.id,
      employee_id: r.employee_id,
      employee_name: emp?.full_name ?? "—",
      department_name: emp?.department_id ? (depMap.get(emp.department_id) ?? "—") : "—",
      kind: r.kind as CustodyKind,
      status: r.status as CustodyAssignmentStatus,
      purpose: r.purpose,
      requested_at: r.requested_at,
      expected_return_date: r.expected_return_date,
      handed_over_at: r.handed_over_at,
      returned_at: r.returned_at,
      cash_amount: Number(r.cash_amount ?? 0),
      cash_settled: Number(r.cash_settled ?? 0),
      acknowledged_at: r.acknowledged_at,
      notes: r.notes,
      items,
      totalValue,
    });
  }
  return out;
}

export type AssignmentInput = {
  id?: string | null | undefined;
  employee_id: string;
  kind: CustodyKind;
  purpose?: string | null | undefined;
  expected_return_date?: string | null | undefined;
  cash_amount?: number | null | undefined;
  notes?: string | null | undefined;
  items: {
    asset_id?: string | null | undefined;
    title: string;
    quantity?: number | null | undefined;
    condition_out?: string | null | undefined;
    odometer_out?: number | null | undefined;
    notes?: string | null | undefined;
  }[];
  submit?: boolean | undefined;
};

export async function saveAssignment(userId: string, input: AssignmentInput) {
  const actor = await loadActor(userId);
  const isSelf = actor.employeeId === input.employee_id;
  if (!isSelf && !actor.isHr && !actor.isDirector && !(await canSupervise(actor, input.employee_id)))
    throw new Error("لا تملك صلاحية تسجيل عهدة لهذا الموظف");
  if (input.kind !== "cash" && input.items.length === 0)
    throw new Error("أضف بنداً واحداً على الأقل للعهدة");
  if (input.kind === "cash" && !Number(input.cash_amount))
    throw new Error("حدد مبلغ العهدة المالية");

  const head = {
    employee_id: input.employee_id,
    kind: input.kind,
    purpose: input.purpose || null,
    expected_return_date: input.expected_return_date || null,
    cash_amount: Number(input.cash_amount ?? 0),
    notes: input.notes || null,
    status: (input.submit ? "pending_manager" : "draft") as never,
  };

  let assignmentId = input.id ?? null;
  if (assignmentId) {
    const { data: cur } = await db()
      .from("custody_assignments")
      .select("status")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!cur) throw new Error("سجل العهدة غير موجود");
    if (!["draft", "rejected"].includes(String(cur.status)))
      throw new Error("لا يمكن تعديل عهدة قيد الاعتماد أو نشطة");
    const { error } = await db().from("custody_assignments").update(head).eq("id", assignmentId);
    if (error) throw new Error(error.message);
    await db().from("custody_assignment_items").delete().eq("assignment_id", assignmentId);
  } else {
    const { data, error } = await db()
      .from("custody_assignments")
      .insert({ ...head, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    assignmentId = data.id;
  }

  if (input.items.length) {
    const { error } = await db().from("custody_assignment_items").insert(
      input.items.map((i) => ({
        assignment_id: assignmentId,
        asset_id: i.asset_id || null,
        title: i.title.trim(),
        quantity: Number(i.quantity ?? 1),
        condition_out: i.condition_out || null,
        odometer_out: i.odometer_out ?? null,
        notes: i.notes || null,
      })),
    );
    if (error) throw new Error(error.message);
  }

  if (input.submit) {
    const { data: emp } = await db()
      .from("employees")
      .select("full_name, manager_id")
      .eq("id", input.employee_id)
      .maybeSingle();
    if (emp?.manager_id) {
      const { data: mgr } = await db()
        .from("employees")
        .select("user_id")
        .eq("id", emp.manager_id)
        .maybeSingle();
      await notifyInApp(mgr?.user_id ?? null, {
        title: "طلب عهدة بانتظار اعتمادك",
        body: `${emp.full_name} — ${CUSTODY_KIND_LABELS[input.kind]}`,
      });
    }
  }

  return { id: assignmentId! };
}

export async function deleteAssignment(userId: string, id: string) {
  const actor = await loadActor(userId);
  const { data: cur } = await db()
    .from("custody_assignments")
    .select("status, employee_id")
    .eq("id", id)
    .maybeSingle();
  if (!cur) throw new Error("سجل العهدة غير موجود");
  const allowed =
    actor.isHr || actor.isDirector || (cur.employee_id === actor.employeeId && cur.status === "draft");
  if (!allowed) throw new Error("لا تملك صلاحية الحذف");
  if (["handed_over"].includes(String(cur.status)))
    throw new Error("لا يمكن حذف عهدة نشطة — سجّل الإرجاع أولاً");
  const { error } = await db().from("custody_assignments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ═════════ قرارات الاعتماد ═════════ */

const NEXT: Record<string, CustodyAssignmentStatus> = {
  pending_manager: "pending_hr",
  pending_hr: "pending_director",
  pending_director: "approved",
};

export async function decideAssignment(
  userId: string,
  id: string,
  action: "approved" | "returned",
  note?: string,
) {
  const actor = await loadActor(userId);
  const { data: r } = await db()
    .from("custody_assignments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!r) throw new Error("سجل العهدة غير موجود");
  const stage = String(r.status);
  const allowed =
    stage === "pending_manager"
      ? actor.isDirector || actor.isHr || (await canSupervise(actor, r.employee_id))
      : stage === "pending_hr"
        ? actor.isHr || actor.isDirector
        : stage === "pending_director"
          ? actor.isDirector
          : false;
  if (!allowed) throw new Error("لا تملك صلاحية اتخاذ القرار في هذه المرحلة");
  if (action === "returned" && !note?.trim()) throw new Error("يرجى كتابة سبب الرفض/الإعادة");

  const nextStatus: CustodyAssignmentStatus =
    action === "returned" ? "rejected" : (NEXT[stage] ?? "approved");
  const { error } = await db()
    .from("custody_assignments")
    .update({ status: nextStatus as never })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await db().from("custody_approvals").insert({
    assignment_id: id,
    stage,
    decision: action,
    note: note ?? null,
    actor_id: userId,
  });

  const { data: emp } = await db()
    .from("employees")
    .select("user_id, full_name")
    .eq("id", r.employee_id)
    .maybeSingle();
  await notifyInApp(emp?.user_id ?? null, {
    title: action === "approved" ? "تقدّم طلب العهدة" : "رُفض طلب العهدة",
    body:
      action === "approved"
        ? `الحالة الحالية: ${nextStatus}`
        : `السبب: ${note ?? ""}`,
  });
  return { ok: true };
}

export async function listApprovalTrail(id: string) {
  const { data } = await db()
    .from("custody_approvals")
    .select("*")
    .eq("assignment_id", id)
    .order("created_at");
  return data ?? [];
}

/* ═════════ التسليم والإرجاع ═════════ */

export async function handOver(userId: string, id: string) {
  await assertHr(userId);
  const { data: r } = await db()
    .from("custody_assignments")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!r) throw new Error("سجل العهدة غير موجود");
  if (String(r.status) !== "approved") throw new Error("لا يمكن التسليم قبل اكتمال الاعتماد");
  const now = new Date().toISOString();
  const { error } = await db()
    .from("custody_assignments")
    .update({ status: "handed_over" as never, handed_over_at: now, acknowledged_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const { data: items } = await db()
    .from("custody_assignment_items")
    .select("asset_id")
    .eq("assignment_id", id);
  const assetIds = (items ?? []).map((i) => i.asset_id).filter(Boolean) as string[];
  if (assetIds.length)
    await db()
      .from("custody_assets")
      .update({ status: "assigned" as never })
      .in("id", assetIds);
  return { ok: true };
}

export async function returnItems(
  userId: string,
  id: string,
  items: {
    id: string;
    return_state: "good" | "damaged" | "lost";
    condition_in?: string | null | undefined;
    odometer_in?: number | null | undefined;
  }[],
) {
  await assertHr(userId);
  const now = new Date().toISOString();
  for (const it of items) {
    await db()
      .from("custody_assignment_items")
      .update({
        returned_at: now,
        return_state: it.return_state,
        condition_in: it.condition_in ?? null,
        odometer_in: it.odometer_in ?? null,
      })
      .eq("id", it.id)
      .eq("assignment_id", id);

    const { data: row } = await db()
      .from("custody_assignment_items")
      .select("asset_id, odometer_in")
      .eq("id", it.id)
      .maybeSingle();
    if (row?.asset_id) {
      const status =
        it.return_state === "good" ? "available" : it.return_state === "damaged" ? "damaged" : "lost";
      await db()
        .from("custody_assets")
        .update({
          status: status as never,
          ...(row.odometer_in ? { odometer: row.odometer_in } : {}),
        })
        .eq("id", row.asset_id);
    }
  }

  const { data: remaining } = await db()
    .from("custody_assignment_items")
    .select("id")
    .eq("assignment_id", id)
    .is("returned_at", null);
  if (!remaining || remaining.length === 0) {
    await db()
      .from("custody_assignments")
      .update({ status: "returned" as never, returned_at: now })
      .eq("id", id);
  }
  return { ok: true };
}

/* ═════════ حركات العهدة المالية ═════════ */

export async function addTransaction(
  userId: string,
  input: {
    assignment_id: string;
    tx_date: string;
    tx_type: "disbursement" | "expense" | "settlement";
    amount: number;
    description?: string | null | undefined;
  },
) {
  const actor = await loadActor(userId);
  const { data: r } = await db()
    .from("custody_assignments")
    .select("employee_id, cash_settled, cash_amount, status")
    .eq("id", input.assignment_id)
    .maybeSingle();
  if (!r) throw new Error("سجل العهدة غير موجود");
  const allowed =
    actor.isHr ||
    actor.isDirector ||
    r.employee_id === actor.employeeId ||
    (await canSupervise(actor, r.employee_id));
  if (!allowed) throw new Error("لا تملك صلاحية إضافة حركة");

  const { error } = await db().from("custody_transactions").insert({
    assignment_id: input.assignment_id,
    tx_date: input.tx_date,
    tx_type: input.tx_type,
    amount: Number(input.amount),
    description: input.description ?? null,
    created_by: userId,
  });
  if (error) throw new Error(error.message);

  if (input.tx_type !== "disbursement") {
    const settled = Number(r.cash_settled ?? 0) + Number(input.amount);
    const done = settled >= Number(r.cash_amount ?? 0);
    await db()
      .from("custody_assignments")
      .update({
        cash_settled: settled,
        ...(done && String(r.status) === "handed_over"
          ? { status: "returned" as never, returned_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", input.assignment_id);
  }
  return { ok: true };
}

export async function listTransactions(assignmentId: string) {
  const { data } = await db()
    .from("custody_transactions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("tx_date");
  return data ?? [];
}

/* ═════════ فحص إخلاء الطرف ═════════ */

export async function openCustodyForEmployee(employeeId: string) {
  const { data } = await db()
    .from("custody_assignments")
    .select("id, kind, status, expected_return_date, cash_amount, cash_settled")
    .eq("employee_id", employeeId)
    .in("status", OPEN_ASSIGNMENT_STATUSES);
  return data ?? [];
}
