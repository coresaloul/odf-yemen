import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { monthBounds, type PayrollSettings } from "@/lib/payroll";

export function admin() {
  return supabaseAdmin;
}

export async function loadPayrollSettings(): Promise<PayrollSettings> {
  const { data } = await supabaseAdmin
    .from("payroll_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) {
    const { data: created } = await supabaseAdmin
      .from("payroll_settings")
      .insert({})
      .select("*")
      .single();
    return normalizeSettings(created);
  }
  return normalizeSettings(data);
}

function normalizeSettings(row: Record<string, unknown> | null): PayrollSettings {
  const r = (row ?? {}) as Record<string, unknown>;
  const tiers = Array.isArray(r["incentive_tiers"])
    ? (r["incentive_tiers"] as { min_score: number; percent: number }[])
    : [];
  return {
    id: String(r["id"] ?? ""),
    currency: String(r["currency"] ?? "YER"),
    month_days: Number(r["month_days"] ?? 30),
    day_hours: Number(r["day_hours"] ?? 8),
    deduct_absence: Boolean(r["deduct_absence"] ?? true),
    deduct_unpaid_leave: Boolean(r["deduct_unpaid_leave"] ?? true),
    deduct_late: Boolean(r["deduct_late"] ?? true),
    late_grace_minutes: Number(r["late_grace_minutes"] ?? 0),
    incentive_tiers: [...tiers].sort((a, b) => b.min_score - a.min_score),
    manager_can_view: Boolean(r["manager_can_view"] ?? false),
  };
}

export async function assertPayrollAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => String(r.role));
  const isDirector = roles.includes("executive_director");
  const isHr = roles.includes("hr");
  if (!isDirector && !isHr) {
    throw new Error("غير مصرح: إدارة الرواتب للموارد البشرية والمدير التنفيذي فقط");
  }
  return { isDirector, isHr };
}

export async function actorName(userId: string) {
  const { data } = await supabaseAdmin
    .from("employees")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.full_name ?? "مستخدم";
}

type Line = {
  line_type: "earning" | "deduction";
  source: "basic" | "component" | "attendance" | "incentive" | "advance" | "adjustment" | "contract" | "manual";
  label: string;
  amount: number;
  ref_id?: string | null;
  note?: string | null;
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** يحسب دورة رواتب لشهر معين ويكتب البنود والأسطر */
export async function computePayrollRun(runId: string) {
  const settings = await loadPayrollSettings();
  const { data: run } = await supabaseAdmin
    .from("payroll_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (!run) throw new Error("دورة الرواتب غير موجودة");
  if (["approved", "paid"].includes(String(run.status))) {
    throw new Error("لا يمكن إعادة احتساب دورة معتمدة أو مصروفة");
  }
  const month = String(run.month).slice(0, 10);
  const { start, end, firstDay } = monthBounds(month);
  const categories = (run.categories ?? ["employee"]) as string[];

  const [
    { data: employees },
    { data: profiles },
    { data: components },
    { data: empComponents },
    { data: attendance },
    { data: leaves },
    { data: leaveTypes },
    { data: adjustments },
    { data: advances },
    { data: contracts },
    { data: installments },
    { data: evaluations },
    { data: departments },
  ] = await Promise.all([
    supabaseAdmin
      .from("employees")
      .select("id, full_name, employee_no, department_id, basic_salary, contract_type, iban, status")
      .eq("status", "active"),
    supabaseAdmin.from("employee_payroll_profiles").select("*").eq("active", true),
    supabaseAdmin.from("payroll_components").select("*").eq("active", true),
    supabaseAdmin.from("employee_payroll_components").select("*").eq("active", true),
    supabaseAdmin
      .from("attendance_records")
      .select("employee_id, work_date, status, late_minutes, worked_minutes")
      .gte("work_date", start)
      .lte("work_date", end),
    supabaseAdmin
      .from("leave_requests")
      .select("employee_id, leave_type_id, days, stage, start_date, end_date")
      .eq("stage", "approved")
      .lte("start_date", end)
      .gte("end_date", start),
    supabaseAdmin.from("leave_types").select("id, name, is_paid"),
    supabaseAdmin
      .from("payroll_adjustments")
      .select("*")
      .eq("target_month", firstDay)
      .neq("status", "applied"),
    supabaseAdmin.from("employee_advances").select("*").eq("status", "active"),
    supabaseAdmin.from("consultant_contracts").select("*").eq("status", "active"),
    supabaseAdmin.from("contract_installments").select("*").eq("status", "pending"),
    supabaseAdmin
      .from("evaluations")
      .select("employee_id, total_score, period_start, period_end, approval_stage")
      .eq("approval_stage", "approved")
      .lte("period_start", end)
      .gte("period_end", start),
    supabaseAdmin.from("departments").select("id, name"),
  ]);

  const depName = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const profileByEmp = new Map((profiles ?? []).map((p) => [p.employee_id, p]));
  const componentById = new Map((components ?? []).map((c) => [c.id, c]));
  const paidTypeIds = new Set((leaveTypes ?? []).filter((t) => t.is_paid).map((t) => t.id));

  await supabaseAdmin.from("payroll_items").delete().eq("run_id", runId);

  const items: Record<string, unknown>[] = [];
  const linesByEmployee = new Map<string, Line[]>();

  for (const emp of employees ?? []) {
    const profile = profileByEmp.get(emp.id);
    const workerType = String(
      profile?.worker_type ?? (emp.contract_type === "consultant" ? "consultant" : "employee"),
    );
    if (!categories.includes(workerType)) continue;

    const lines: Line[] = [];
    const basic = Number(profile?.basic_salary ?? emp.basic_salary ?? 0);
    const dailyRate = Number(profile?.daily_rate ?? 0);
    const hourlyRate = Number(profile?.hourly_rate ?? 0);
    const stipend = Number(profile?.stipend ?? 0);

    const att = (attendance ?? []).filter((a) => a.employee_id === emp.id);
    const daysPresent = att.filter((a) => a.status === "present").length;
    const daysAbsent = att.filter((a) => a.status === "absent").length;
    const lateMinutes = att.reduce((s, a) => s + Number(a.late_minutes ?? 0), 0);
    const workedHours = round2(att.reduce((s, a) => s + Number(a.worked_minutes ?? 0), 0) / 60);

    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    for (const lv of leaves ?? []) {
      if (lv.employee_id !== emp.id) continue;
      const d = Number(lv.days ?? 0);
      if (paidTypeIds.has(lv.leave_type_id)) paidLeaveDays += d;
      else unpaidLeaveDays += d;
    }

    // ── الاستحقاق الأساسي حسب نوع العامل ──
    let baseAmount = 0;
    if (workerType === "employee") {
      baseAmount = basic;
      if (basic > 0) lines.push({ line_type: "earning", source: "basic", label: "الراتب الأساسي", amount: basic });
    } else if (workerType === "worker") {
      const byDays = dailyRate > 0 ? dailyRate * daysPresent : 0;
      const byHours = dailyRate > 0 ? 0 : hourlyRate * workedHours;
      baseAmount = round2(byDays + byHours);
      if (baseAmount > 0) {
        lines.push({
          line_type: "earning",
          source: "basic",
          label: dailyRate > 0 ? `أجر ${daysPresent} يوم عمل` : `أجر ${workedHours} ساعة عمل`,
          amount: baseAmount,
        });
      }
    } else if (workerType === "volunteer") {
      baseAmount = stipend;
      if (stipend > 0)
        lines.push({ line_type: "earning", source: "basic", label: "مكافأة تطوع", amount: stipend });
    } else if (workerType === "consultant") {
      const empContracts = (contracts ?? []).filter((c) => c.employee_id === emp.id);
      const ids = new Set(empContracts.map((c) => c.id));
      const due = (installments ?? []).filter(
        (i) => ids.has(i.contract_id) && i.due_date && String(i.due_date) >= start && String(i.due_date) <= end,
      );
      for (const inst of due) {
        const contract = empContracts.find((c) => c.id === inst.contract_id);
        baseAmount += Number(inst.amount ?? 0);
        lines.push({
          line_type: "earning",
          source: "contract",
          label: `دفعة ${inst.seq} — ${contract?.title ?? "عقد استشاري"}`,
          amount: Number(inst.amount ?? 0),
          ref_id: inst.id,
        });
      }
      baseAmount = round2(baseAmount);
    }

    // ── البنود الثابتة (للموظفين فقط) ──
    if (workerType === "employee") {
      for (const ec of (empComponents ?? []).filter((c) => c.employee_id === emp.id)) {
        const comp = componentById.get(ec.component_id);
        if (!comp) continue;
        if (ec.start_date && String(ec.start_date) > end) continue;
        if (ec.end_date && String(ec.end_date) < start) continue;
        const raw = Number(ec.amount ?? comp.default_amount ?? 0);
        const amount = round2(comp.calc_method === "percent_basic" ? (basic * raw) / 100 : raw);
        if (amount === 0) continue;
        lines.push({
          line_type: comp.kind === "deduction" ? "deduction" : "earning",
          source: "component",
          label: comp.name,
          amount,
          ref_id: comp.id,
        });
      }
    }

    // ── خصومات الدوام ──
    const dayValue = workerType === "employee" && settings.month_days > 0 ? basic / settings.month_days : 0;
    if (dayValue > 0) {
      if (settings.deduct_absence && daysAbsent > 0) {
        lines.push({
          line_type: "deduction",
          source: "attendance",
          label: `خصم غياب (${daysAbsent} يوم)`,
          amount: round2(dayValue * daysAbsent),
        });
      }
      if (settings.deduct_unpaid_leave && unpaidLeaveDays > 0) {
        lines.push({
          line_type: "deduction",
          source: "attendance",
          label: `خصم إجازة بدون راتب (${unpaidLeaveDays} يوم)`,
          amount: round2(dayValue * unpaidLeaveDays),
        });
      }
      const billableLate = Math.max(0, lateMinutes - settings.late_grace_minutes);
      if (settings.deduct_late && billableLate > 0 && settings.day_hours > 0) {
        const minuteValue = dayValue / (settings.day_hours * 60);
        lines.push({
          line_type: "deduction",
          source: "attendance",
          label: `خصم تأخير (${billableLate} دقيقة)`,
          amount: round2(minuteValue * billableLate),
        });
      }
    }

    // ── حافز الأداء ──
    if (workerType === "employee" && settings.incentive_tiers.length && basic > 0) {
      const scores = (evaluations ?? [])
        .filter((e) => e.employee_id === emp.id)
        .map((e) => Number(e.total_score ?? 0));
      if (scores.length) {
        const best = Math.max(...scores);
        const tier = settings.incentive_tiers.find((t) => best >= Number(t.min_score));
        if (tier && Number(tier.percent) > 0) {
          lines.push({
            line_type: "earning",
            source: "incentive",
            label: `حافز أداء (${tier.percent}% — درجة ${round2(best)})`,
            amount: round2((basic * Number(tier.percent)) / 100),
          });
        }
      }
    }

    // ── التعديلات ──
    for (const adj of (adjustments ?? []).filter((a) => a.employee_id === emp.id)) {
      const amount = round2(Number(adj.amount ?? 0));
      if (amount === 0) continue;
      lines.push({
        line_type: adj.kind === "deduction" ? "deduction" : "earning",
        source: "adjustment",
        label: adj.reason ? `تعديل: ${adj.reason}` : "تعديل على الراتب",
        amount,
        ref_id: adj.id,
        note: adj.original_month ? `يخص شهر ${String(adj.original_month).slice(0, 7)}` : null,
      });
    }

    // ── أقساط السلف ──
    for (const adv of (advances ?? []).filter((a) => a.employee_id === emp.id)) {
      if (String(adv.start_month).slice(0, 10) > firstDay) continue;
      const remaining = round2(Number(adv.total_amount ?? 0) - Number(adv.paid_amount ?? 0));
      if (remaining <= 0) continue;
      const amount = round2(Math.min(Number(adv.installment_amount ?? 0), remaining));
      if (amount <= 0) continue;
      lines.push({
        line_type: "deduction",
        source: "advance",
        label: "قسط سلفة",
        amount,
        ref_id: adv.id,
      });
    }

    const gross = round2(lines.filter((l) => l.line_type === "earning").reduce((s, l) => s + l.amount, 0));
    const deductions = round2(
      lines.filter((l) => l.line_type === "deduction").reduce((s, l) => s + l.amount, 0),
    );
    if (lines.length === 0) continue;

    items.push({
      run_id: runId,
      employee_id: emp.id,
      employee_name: emp.full_name,
      department_name: emp.department_id ? (depName.get(emp.department_id) ?? null) : null,
      worker_type: workerType,
      basic_amount: round2(baseAmount),
      gross_earnings: gross,
      total_deductions: deductions,
      net_amount: round2(gross - deductions),
      days_present: daysPresent,
      days_absent: daysAbsent,
      paid_leave_days: paidLeaveDays,
      unpaid_leave_days: unpaidLeaveDays,
      late_minutes: lateMinutes,
      worked_hours: workedHours,
      payment_method: profile?.payment_method ?? "bank",
      iban: profile?.iban ?? emp.iban ?? null,
    });
    linesByEmployee.set(emp.id, lines);
  }

  if (items.length) {
    const { data: inserted, error } = await supabaseAdmin
      .from("payroll_items")
      .insert(items as never)
      .select("id, employee_id");
    if (error) throw new Error(error.message);
    const lineRows = (inserted ?? []).flatMap((it) =>
      (linesByEmployee.get(it.employee_id) ?? []).map((l) => ({ ...l, item_id: it.id })),
    );
    if (lineRows.length) {
      const { error: lineError } = await supabaseAdmin
        .from("payroll_item_lines")
        .insert(lineRows as never);
      if (lineError) throw new Error(lineError.message);
    }
  }

  const totals = items.reduce(
    (acc: { earnings: number; deductions: number; net: number }, it) => ({
      earnings: acc.earnings + Number(it["gross_earnings"] ?? 0),
      deductions: acc.deductions + Number(it["total_deductions"] ?? 0),
      net: acc.net + Number(it["net_amount"] ?? 0),
    }),
    { earnings: 0, deductions: 0, net: 0 },
  );

  await supabaseAdmin
    .from("payroll_runs")
    .update({
      total_earnings: round2(totals.earnings),
      total_deductions: round2(totals.deductions),
      total_net: round2(totals.net),
      status: "draft",
    })
    .eq("id", runId);

  return { count: items.length, ...totals };
}

/** يُطبّق آثار الاعتماد النهائي: السلف، التعديلات، دفعات العقود */
export async function applyRunEffects(runId: string) {
  const { data: items } = await supabaseAdmin
    .from("payroll_items")
    .select("id")
    .eq("run_id", runId);
  const itemIds = (items ?? []).map((i) => i.id);
  if (!itemIds.length) return;
  const { data: lines } = await supabaseAdmin
    .from("payroll_item_lines")
    .select("source, amount, ref_id")
    .in("item_id", itemIds);

  for (const line of lines ?? []) {
    if (!line.ref_id) continue;
    if (line.source === "advance") {
      const { data: adv } = await supabaseAdmin
        .from("employee_advances")
        .select("total_amount, paid_amount")
        .eq("id", line.ref_id)
        .maybeSingle();
      if (!adv) continue;
      const paid = round2(Number(adv.paid_amount ?? 0) + Number(line.amount ?? 0));
      await supabaseAdmin
        .from("employee_advances")
        .update({
          paid_amount: paid,
          status: paid >= Number(adv.total_amount ?? 0) ? "settled" : "active",
        })
        .eq("id", line.ref_id);
    } else if (line.source === "adjustment") {
      await supabaseAdmin
        .from("payroll_adjustments")
        .update({ status: "applied", run_id: runId })
        .eq("id", line.ref_id);
    } else if (line.source === "contract") {
      await supabaseAdmin
        .from("contract_installments")
        .update({ status: "paid", paid_run_id: runId })
        .eq("id", line.ref_id);
    }
  }
}
