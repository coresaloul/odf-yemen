import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const monthStr = z.string().regex(/^\d{4}-\d{2}$/);
const firstOfMonth = (m: string) => `${m}-01`;
/** يزيل الحقول غير المعرفة قبل الإرسال لقاعدة البيانات */
const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as never;

/* ───────────────── البيانات المرجعية ───────────────── */

export const getPayrollSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPayrollAdmin, admin, loadPayrollSettings } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const db = admin();
    const [settings, components, profiles, employees, empComponents, advances, contracts, installments] =
      await Promise.all([
        loadPayrollSettings(),
        db.from("payroll_components").select("*").order("sort_order"),
        db.from("employee_payroll_profiles").select("*"),
        db
          .from("employees")
          .select("id, full_name, employee_no, job_title, department_id, basic_salary, contract_type, iban, status")
          .eq("status", "active")
          .order("full_name"),
        db.from("employee_payroll_components").select("*"),
        db.from("employee_advances").select("*").order("created_at", { ascending: false }),
        db.from("consultant_contracts").select("*").order("created_at", { ascending: false }),
        db.from("contract_installments").select("*").order("seq"),
      ]);
    return {
      settings,
      components: components.data ?? [],
      profiles: profiles.data ?? [],
      employees: employees.data ?? [],
      empComponents: empComponents.data ?? [],
      advances: advances.data ?? [],
      contracts: contracts.data ?? [],
      installments: installments.data ?? [],
    };
  });

export const savePayrollSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid,
        currency: z.string().trim().min(1).max(10),
        month_days: z.number().int().min(20).max(31),
        day_hours: z.number().min(1).max(24),
        deduct_absence: z.boolean(),
        deduct_unpaid_leave: z.boolean(),
        deduct_late: z.boolean(),
        late_grace_minutes: z.number().int().min(0).max(600),
        manager_can_view: z.boolean(),
        incentive_tiers: z.array(
          z.object({ min_score: z.number().min(0).max(100), percent: z.number().min(0).max(100) }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { id, ...rest } = data;
    const { error } = await admin().from("payroll_settings").update(clean(rest)).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ───────────────── بنود الرواتب ───────────────── */

export const savePayrollComponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.nullable().optional(),
        name: z.string().trim().min(2, "اسم البند قصير جداً").max(80),
        kind: z.enum(["earning", "deduction"]),
        calc_method: z.enum(["fixed", "percent_basic"]),
        default_amount: z.number().min(0),
        active: z.boolean().default(true),
        sort_order: z.number().int().min(0).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { id, ...rest } = data;
    const q = id
      ? admin().from("payroll_components").update(clean(rest)).eq("id", id)
      : admin().from("payroll_components").insert(clean(rest));
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePayrollComponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { error } = await admin().from("payroll_components").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ───────────────── ملف أجر الموظف ───────────────── */

export const saveEmployeePayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        employee_id: uuid,
        worker_type: z.enum(["employee", "worker", "consultant", "volunteer"]),
        basic_salary: z.number().min(0).default(0),
        daily_rate: z.number().min(0).default(0),
        hourly_rate: z.number().min(0).default(0),
        stipend: z.number().min(0).default(0),
        payment_method: z.enum(["cash", "transfer", "bank"]),
        bank_name: z.string().trim().max(120).nullable().optional(),
        account_no: z.string().trim().max(60).nullable().optional(),
        iban: z.string().trim().max(60).nullable().optional(),
        active: z.boolean().default(true),
        notes: z.string().trim().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { error } = await admin()
      .from("employee_payroll_profiles")
      .upsert(clean(data), { onConflict: "employee_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveEmployeeComponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.nullable().optional(),
        employee_id: uuid,
        component_id: uuid,
        amount: z.number().min(0),
        start_date: z.string().nullable().optional(),
        end_date: z.string().nullable().optional(),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { id, ...rest } = data;
    const q = id
      ? admin().from("employee_payroll_components").update(clean(rest)).eq("id", id)
      : admin().from("employee_payroll_components").insert(clean(rest));
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmployeeComponent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { error } = await admin().from("employee_payroll_components").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ───────────────── التعديلات ───────────────── */

export const listAdjustments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ month: monthStr }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { data: rows, error } = await admin()
      .from("payroll_adjustments")
      .select("*, employees:employee_id (full_name, employee_no)")
      .eq("target_month", firstOfMonth(data.month))
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.nullable().optional(),
        employee_id: uuid,
        target_month: monthStr,
        original_month: monthStr.nullable().optional(),
        kind: z.enum(["addition", "deduction"]),
        reason_type: z.string().trim().min(1).max(40),
        amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
        reason: z.string().trim().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { id, target_month, original_month, ...rest } = data;
    const payload = {
      ...rest,
      target_month: firstOfMonth(target_month),
      original_month: original_month ? firstOfMonth(original_month) : null,
      created_by: context.userId,
    };
    const q = id
      ? admin().from("payroll_adjustments").update(clean(payload)).eq("id", id).neq("status", "applied")
      : admin().from("payroll_adjustments").insert(clean(payload));
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { error } = await admin()
      .from("payroll_adjustments")
      .delete()
      .eq("id", data.id)
      .neq("status", "applied");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ───────────────── السلف ───────────────── */

export const saveAdvance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.nullable().optional(),
        employee_id: uuid,
        total_amount: z.number().positive(),
        installment_amount: z.number().positive(),
        installments_count: z.number().int().min(1).max(60),
        start_month: monthStr,
        status: z.enum(["active", "settled", "cancelled"]).default("active"),
        notes: z.string().trim().max(400).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { id, start_month, ...rest } = data;
    const payload = { ...rest, start_month: firstOfMonth(start_month), created_by: context.userId };
    const q = id
      ? admin().from("employee_advances").update(clean(payload)).eq("id", id)
      : admin().from("employee_advances").insert(clean(payload));
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ───────────────── عقود الاستشاريين ───────────────── */

export const saveContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.nullable().optional(),
        employee_id: uuid,
        title: z.string().trim().min(2).max(160),
        total_amount: z.number().min(0),
        start_date: z.string().nullable().optional(),
        end_date: z.string().nullable().optional(),
        status: z.enum(["active", "completed", "cancelled"]).default("active"),
        notes: z.string().trim().max(500).nullable().optional(),
        installments: z
          .array(
            z.object({
              seq: z.number().int().min(1),
              amount: z.number().min(0),
              due_date: z.string().nullable().optional(),
              note: z.string().trim().max(200).nullable().optional(),
            }),
          )
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const db = admin();
    const { id, installments, ...rest } = data;
    let contractId = id ?? null;
    if (contractId) {
      const { error } = await db.from("consultant_contracts").update(clean(rest)).eq("id", contractId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await db
        .from("consultant_contracts")
        .insert(clean(rest))
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      contractId = created.id;
    }
    if (installments.length) {
      await db.from("contract_installments").delete().eq("contract_id", contractId).eq("status", "pending");
      const { error } = await db
        .from("contract_installments")
        .insert(installments.map((i) => clean({ ...i, contract_id: contractId! })));
      if (error) throw new Error(error.message);
    }
    return { ok: true, id: contractId };
  });

/* ───────────────── دورات الرواتب ───────────────── */

export const listRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { data, error } = await admin()
      .from("payroll_runs")
      .select("*")
      .order("month", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getRunDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin, loadPayrollSettings } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const db = admin();
    const [{ data: run }, { data: items }, { data: approvals }, settings] = await Promise.all([
      db.from("payroll_runs").select("*").eq("id", data.runId).maybeSingle(),
      db.from("payroll_items").select("*").eq("run_id", data.runId).order("employee_name"),
      db.from("payroll_approvals").select("*").eq("run_id", data.runId).order("created_at"),
      loadPayrollSettings(),
    ]);
    const itemIds = (items ?? []).map((i) => i.id);
    const { data: lines } = itemIds.length
      ? await db.from("payroll_item_lines").select("*").in("item_id", itemIds)
      : { data: [] as never[] };
    return { run, items: items ?? [], lines: lines ?? [], approvals: approvals ?? [], settings };
  });

export const createRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        month: monthStr,
        title: z.string().trim().max(160).nullable().optional(),
        categories: z.array(z.enum(["employee", "worker", "consultant", "volunteer"])).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin, computePayrollRun } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { data: created, error } = await admin()
      .from("payroll_runs")
      .insert({
        month: firstOfMonth(data.month),
        title: data.title ?? null,
        categories: data.categories,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const result = await computePayrollRun(created.id);
    return { id: created.id, ...result };
  });

export const recomputeRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, computePayrollRun } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    return computePayrollRun(data.runId);
  });

export const deleteRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin } = await import("@/lib/payroll.server");
    await assertPayrollAdmin(context.userId);
    const { error } = await admin()
      .from("payroll_runs")
      .delete()
      .eq("id", data.runId)
      .in("status", ["draft", "hr_review"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        runId: uuid,
        action: z.enum(["submit", "hr_approve", "director_approve", "return", "mark_paid"]),
        note: z.string().trim().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertPayrollAdmin, admin, actorName, applyRunEffects } = await import(
      "@/lib/payroll.server"
    );
    const { isDirector, isHr } = await assertPayrollAdmin(context.userId);
    const db = admin();
    const { data: run } = await db
      .from("payroll_runs")
      .select("id, status")
      .eq("id", data.runId)
      .maybeSingle();
    if (!run) throw new Error("دورة الرواتب غير موجودة");

    const patch: Record<string, unknown> = { return_reason: null };
    const now = new Date().toISOString();

    if (data.action === "submit") {
      if (run.status !== "draft") throw new Error("الدورة ليست في حالة مسودة");
      patch["status"] = "hr_review";
    } else if (data.action === "hr_approve") {
      if (!isHr && !isDirector) throw new Error("غير مصرح");
      if (run.status !== "hr_review") throw new Error("الدورة ليست بانتظار الموارد البشرية");
      patch["status"] = "director_review";
      patch["hr_approved_by"] = context.userId;
      patch["hr_approved_at"] = now;
    } else if (data.action === "director_approve") {
      if (!isDirector) throw new Error("الاعتماد النهائي للمدير التنفيذي فقط");
      if (run.status !== "director_review") throw new Error("الدورة ليست بانتظار المدير التنفيذي");
      patch["status"] = "approved";
      patch["director_approved_by"] = context.userId;
      patch["director_approved_at"] = now;
    } else if (data.action === "return") {
      if (!data.note) throw new Error("يرجى كتابة سبب الإعادة");
      if (["approved", "paid"].includes(String(run.status))) throw new Error("لا يمكن إعادة دورة معتمدة");
      patch["status"] = "draft";
      patch["return_reason"] = data.note;
    } else if (data.action === "mark_paid") {
      if (!isDirector && !isHr) throw new Error("غير مصرح");
      if (run.status !== "approved") throw new Error("يجب اعتماد الدورة أولاً");
      patch["status"] = "paid";
      patch["paid_at"] = now;
    }

    const { error } = await db.from("payroll_runs").update(clean(patch)).eq("id", data.runId);
    if (error) throw new Error(error.message);

    if (data.action === "director_approve") await applyRunEffects(data.runId);

    await db.from("payroll_approvals").insert({
      run_id: data.runId,
      stage: String(patch["status"] ?? run.status),
      action: data.action,
      actor_id: context.userId,
      actor_name: await actorName(context.userId),
      note: data.note ?? null,
    });
    return { ok: true, status: String(patch["status"] ?? run.status) };
  });

/* ───────────────── قسائم الموظف ───────────────── */

export const getMyPayslips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await import("@/lib/payroll.server");
    const db = admin();
    const { data: emp } = await db
      .from("employees")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!emp) return { items: [], lines: [], runs: [] };
    const { data: runs } = await db
      .from("payroll_runs")
      .select("id, month, status")
      .in("status", ["approved", "paid"]);
    const runIds = (runs ?? []).map((r) => r.id);
    if (!runIds.length) return { items: [], lines: [], runs: [] };
    const { data: items } = await db
      .from("payroll_items")
      .select("*")
      .eq("employee_id", emp.id)
      .in("run_id", runIds);
    const itemIds = (items ?? []).map((i) => i.id);
    const { data: lines } = itemIds.length
      ? await db.from("payroll_item_lines").select("*").in("item_id", itemIds)
      : { data: [] as never[] };
    return { items: items ?? [], lines: lines ?? [], runs: runs ?? [] };
  });
