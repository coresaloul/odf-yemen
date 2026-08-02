import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ id: z.string().uuid() });

/* ───────────────── إنشاء وتعديل الطلب ───────────────── */

export const saveLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        employee_id: z.string().uuid(),
        leave_type_id: z.string().uuid(),
        kind: z.enum(["leave", "permission"]),
        start_date: z.string(),
        end_date: z.string(),
        start_time: z.string().nullable().optional(),
        end_time: z.string().nullable().optional(),
        reason: z.string().trim().max(1000).nullable().optional(),
        attachment_url: z.string().trim().max(500).nullable().optional(),
      })
      .refine((v) => v.end_date >= v.start_date, "تاريخ النهاية قبل تاريخ البداية")
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, canSupervise, admin, loadWorkContext } = await import(
      "@/lib/attendance.server"
    );
    const { countWorkingDays, toMinutes } = await import("@/lib/attendance");

    const actor = await loadActor(context.userId);
    const isSelf = actor.employeeId === data.employee_id;
    if (!isSelf && !(await canSupervise(actor, data.employee_id)))
      throw new Error("لا تملك صلاحية تقديم طلب لهذا الموظف");

    const { settings, holidays } = await loadWorkContext();
    const { data: type } = await admin()
      .from("leave_types")
      .select("id, name, requires_attachment, is_hourly")
      .eq("id", data.leave_type_id)
      .maybeSingle();
    if (!type) throw new Error("نوع الإجازة غير موجود");
    if (type.requires_attachment && !data.attachment_url)
      throw new Error(`نوع «${type.name}» يتطلب إرفاق مستند`);

    let days = 0;
    let hours = 0;
    if (data.kind === "permission") {
      const from = toMinutes(data.start_time ?? null);
      const to = toMinutes(data.end_time ?? null);
      if (from == null || to == null || to <= from)
        throw new Error("حدد وقت بداية ونهاية صحيحين للإذن");
      hours = Number(((to - from) / 60).toFixed(2));
    } else {
      days = countWorkingDays(data.start_date, data.end_date, settings, holidays);
      if (days === 0) throw new Error("الفترة المحددة كلها عطل رسمية أو نهاية أسبوع");
    }

    const payload = {
      employee_id: data.employee_id,
      leave_type_id: data.leave_type_id,
      kind: data.kind,
      start_date: data.start_date,
      end_date: data.kind === "permission" ? data.start_date : data.end_date,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      days,
      hours,
      reason: data.reason ?? null,
      attachment_url: data.attachment_url ?? null,
    };

    if (data.id) {
      const { data: current } = await admin()
        .from("leave_requests")
        .select("stage")
        .eq("id", data.id)
        .maybeSingle();
      if (!current) throw new Error("الطلب غير موجود");
      if (!["draft", "returned"].includes(String(current.stage)))
        throw new Error("لا يمكن تعديل طلب قيد الاعتماد");
      const { error } = await admin().from("leave_requests").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await admin()
      .from("leave_requests")
      .insert({ ...payload, created_by: context.userId, stage: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, canSupervise, admin } = await import("@/lib/attendance.server");
    const actor = await loadActor(context.userId);
    const { data: req } = await admin()
      .from("leave_requests")
      .select("id, employee_id, stage")
      .eq("id", data.id)
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
    const { error } = await admin().from("leave_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ───────────────── الإرسال للاعتماد ───────────────── */

export const submitLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, canSupervise, admin, notifyInApp } = await import(
      "@/lib/attendance.server"
    );
    const actor = await loadActor(context.userId);
    const { data: req } = await admin()
      .from("leave_requests")
      .select("id, employee_id, leave_type_id, kind, stage, days, start_date, end_date")
      .eq("id", data.id)
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

    // منع تداخل الطلبات
    const { data: overlaps } = await admin()
      .from("leave_requests")
      .select("id, start_date, end_date, stage")
      .eq("employee_id", req.employee_id)
      .neq("id", req.id)
      .in("stage", ["pending_manager", "pending_hr", "pending_director", "approved"])
      .lte("start_date", req.end_date)
      .gte("end_date", req.start_date);
    if ((overlaps ?? []).length > 0)
      throw new Error("يوجد طلب إجازة آخر لنفس الموظف في نفس الفترة");

    // التحقق من الرصيد
    if (req.kind === "leave") {
      const year = Number(req.start_date.slice(0, 4));
      const [{ data: balance }, { data: type }] = await Promise.all([
        admin()
          .from("leave_balances")
          .select("entitled, carried, used")
          .eq("employee_id", req.employee_id)
          .eq("leave_type_id", req.leave_type_id)
          .eq("year", year)
          .maybeSingle(),
        admin()
          .from("leave_types")
          .select("name, annual_days")
          .eq("id", req.leave_type_id)
          .maybeSingle(),
      ]);
      const entitled = balance
        ? Number(balance.entitled) + Number(balance.carried)
        : Number(type?.annual_days ?? 0);
      const used = balance ? Number(balance.used) : 0;
      if (entitled > 0 && used + Number(req.days) > entitled && !actor.isHr && !actor.isDirector)
        throw new Error(
          `الرصيد المتاح من «${type?.name ?? "هذا النوع"}» ${entitled - used} يوم فقط`,
        );
    }

    const now = new Date().toISOString();
    const { error } = await admin()
      .from("leave_requests")
      .update({ stage: "pending_manager", submitted_at: now, return_reason: null })
      .eq("id", req.id);
    if (error) throw new Error(error.message);
    await admin().from("leave_approvals").insert({
      request_id: req.id,
      stage: "pending_manager",
      action: "submitted",
      actor_id: context.userId,
    });

    // إشعار المدير المباشر
    const { data: emp } = await admin()
      .from("employees")
      .select("full_name, manager_id")
      .eq("id", req.employee_id)
      .maybeSingle();
    if (emp?.manager_id) {
      const { data: mgr } = await admin()
        .from("employees")
        .select("user_id")
        .eq("id", emp.manager_id)
        .maybeSingle();
      await notifyInApp(mgr?.user_id ?? null, {
        title: "طلب إجازة بانتظار اعتمادك",
        body: `${emp.full_name}: ${req.start_date} — ${req.end_date}`,
      });
    }
    return { ok: true };
  });

/* ───────────────── الاعتماد والإعادة ───────────────── */

export const decideLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approved", "returned"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, canSupervise, admin, notifyInApp, wantsLeaveEmail, sendLeaveEmail } =
      await import("@/lib/attendance.server");
    const { listDates, isOffDay, computeAttendance } = await import("@/lib/attendance");
    const { loadWorkContext } = await import("@/lib/attendance.server");
    const { writeAudit, actorName } = await import("@/lib/org.server");

    const actor = await loadActor(context.userId);
    const { data: req } = await admin()
      .from("leave_requests")
      .select(
        "id, employee_id, leave_type_id, kind, stage, days, hours, start_date, end_date, start_time, end_time",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!req) throw new Error("الطلب غير موجود");

    const stage = String(req.stage);
    let allowed = false;
    let nextStage: "pending_hr" | "pending_director" | "approved";
    if (stage === "pending_manager") {
      allowed = actor.isDirector || (await canSupervise(actor, req.employee_id));
      nextStage = "pending_hr";
    } else if (stage === "pending_hr") {
      allowed = actor.isHr || actor.isDirector;
      nextStage = "pending_director";
    } else if (stage === "pending_director") {
      allowed = actor.isDirector;
      nextStage = "approved";
    } else {
      throw new Error("لا توجد مرحلة اعتماد قائمة لهذا الطلب");
    }
    if (!allowed) throw new Error("لا تملك صلاحية الاعتماد في هذه المرحلة");

    const name = await actorName(context.userId);
    await admin().from("leave_approvals").insert({
      request_id: req.id,
      stage: stage as never,
      action: data.action,
      note: data.note ?? null,
      actor_id: context.userId,
      actor_name: name,
    });

    const now = new Date().toISOString();
    const [{ data: emp }, { data: type }] = await Promise.all([
      admin()
        .from("employees")
        .select("full_name, email, user_id")
        .eq("id", req.employee_id)
        .maybeSingle(),
      admin().from("leave_types").select("name").eq("id", req.leave_type_id).maybeSingle(),
    ]);
    const period =
      req.kind === "permission"
        ? `${req.start_date} (${String(req.start_time).slice(0, 5)} — ${String(req.end_time).slice(0, 5)})`
        : `${req.start_date} — ${req.end_date}`;

    if (data.action === "returned") {
      const { error } = await admin()
        .from("leave_requests")
        .update({ stage: "returned", return_reason: data.note ?? null })
        .eq("id", req.id);
      if (error) throw new Error(error.message);
      await notifyInApp(emp?.user_id ?? null, {
        title: "تمت إعادة طلب إجازتك للتعديل",
        body: data.note ?? period,
      });
      if (await wantsLeaveEmail(emp?.user_id ?? null))
        await sendLeaveEmail(
          emp?.email ?? null,
          {
            recipientName: emp?.full_name ?? "",
            leaveType: type?.name ?? "",
            period,
            status: "مُعادة للتعديل",
            note: data.note ?? null,
          },
          `leave-returned-${req.id}-${now}`,
        );
      return { ok: true };
    }

    const stamp =
      stage === "pending_manager"
        ? { manager_approved_by: context.userId, manager_approved_at: now }
        : stage === "pending_hr"
          ? { hr_approved_by: context.userId, hr_approved_at: now }
          : { director_approved_by: context.userId, director_approved_at: now };

    const { error } = await admin()
      .from("leave_requests")
      .update({ ...stamp, stage: nextStage, return_reason: null })
      .eq("id", req.id);
    if (error) throw new Error(error.message);

    if (nextStage === "approved") {
      const year = Number(req.start_date.slice(0, 4));
      // تحديث الرصيد
      if (req.kind === "leave") {
        const { data: balance } = await admin()
          .from("leave_balances")
          .select("id, used")
          .eq("employee_id", req.employee_id)
          .eq("leave_type_id", req.leave_type_id)
          .eq("year", year)
          .maybeSingle();
        const { data: lt } = await admin()
          .from("leave_types")
          .select("annual_days")
          .eq("id", req.leave_type_id)
          .maybeSingle();
        if (balance) {
          await admin()
            .from("leave_balances")
            .update({ used: Number(balance.used) + Number(req.days) })
            .eq("id", balance.id);
        } else {
          await admin().from("leave_balances").insert({
            employee_id: req.employee_id,
            leave_type_id: req.leave_type_id,
            year,
            entitled: Number(lt?.annual_days ?? 0),
            used: Number(req.days),
          });
        }
      }

      // انعكاس الإجازة على سجل الحضور
      const { settings, holidays } = await loadWorkContext();
      if (req.kind === "leave") {
        const rows = listDates(req.start_date, req.end_date)
          .filter((d) => !isOffDay(d, settings, holidays))
          .map((d) => ({
            employee_id: req.employee_id,
            work_date: d,
            status: "leave" as const,
            late_minutes: 0,
            early_leave_minutes: 0,
            worked_minutes: 0,
            source: "leave",
          }));
        if (rows.length)
          await admin()
            .from("attendance_records")
            .upsert(rows, { onConflict: "employee_id,work_date" });
      } else {
        const minutes = Math.round(Number(req.hours) * 60);
        const { data: rec } = await admin()
          .from("attendance_records")
          .select("id, check_in, check_out")
          .eq("employee_id", req.employee_id)
          .eq("work_date", req.start_date)
          .maybeSingle();
        const calc = computeAttendance(
          {
            check_in: rec?.check_in ?? null,
            check_out: rec?.check_out ?? null,
            permission_minutes: minutes,
          },
          settings,
        );
        await admin().from("attendance_records").upsert(
          {
            employee_id: req.employee_id,
            work_date: req.start_date,
            check_in: rec?.check_in ?? null,
            check_out: rec?.check_out ?? null,
            status: "permission" as const,
            permission_minutes: minutes,
            source: "leave",
            ...calc,
          },
          { onConflict: "employee_id,work_date" },
        );
      }

      await notifyInApp(emp?.user_id ?? null, {
        title: "تم اعتماد طلب إجازتك",
        body: period,
      });
      if (await wantsLeaveEmail(emp?.user_id ?? null))
        await sendLeaveEmail(
          emp?.email ?? null,
          {
            recipientName: emp?.full_name ?? "",
            leaveType: type?.name ?? "",
            period,
            status: "معتمدة نهائياً",
            note: data.note ?? null,
          },
          `leave-approved-${req.id}`,
        );
      await writeAudit(context.userId, {
        action: "اعتماد نهائي",
        entity: "طلب إجازة",
        entity_id: req.id,
        entity_label: `${emp?.full_name ?? ""} — ${period}`,
      });
    } else {
      await notifyInApp(emp?.user_id ?? null, {
        title: "تقدّم طلب إجازتك في مسار الاعتماد",
        body: period,
      });
    }
    return { ok: true };
  });

/* ───────────────── الأرصدة ───────────────── */

export const saveLeaveBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        employee_id: z.string().uuid(),
        leave_type_id: z.string().uuid(),
        year: z.number().int().min(2000).max(2100),
        entitled: z.number().min(0).max(400),
        carried: z.number().min(0).max(400),
        used: z.number().min(0).max(400),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    const { writeAudit } = await import("@/lib/org.server");
    assertAdmin(await loadActor(context.userId));
    const { error } = await admin()
      .from("leave_balances")
      .upsert(data, { onConflict: "employee_id,leave_type_id,year" });
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, { action: "تعديل", entity: "رصيد إجازات" });
    return { ok: true };
  });

/** إنشاء أرصدة السنة لجميع الموظفين النشطين حسب الأنواع المفعّلة */
export const initLeaveBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ year: z.number().int().min(2000).max(2100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadActor, assertAdmin, admin } = await import("@/lib/attendance.server");
    assertAdmin(await loadActor(context.userId));
    const [{ data: employees }, { data: types }, { data: existing }] = await Promise.all([
      admin().from("employees").select("id").eq("status", "active"),
      admin().from("leave_types").select("id, annual_days").eq("active", true).eq("is_hourly", false),
      admin().from("leave_balances").select("employee_id, leave_type_id").eq("year", data.year),
    ]);
    const have = new Set((existing ?? []).map((b) => `${b.employee_id}|${b.leave_type_id}`));
    const rows = (employees ?? []).flatMap((e) =>
      (types ?? [])
        .filter((t) => !have.has(`${e.id}|${t.id}`))
        .map((t) => ({
          employee_id: e.id,
          leave_type_id: t.id,
          year: data.year,
          entitled: Number(t.annual_days),
          carried: 0,
          used: 0,
        })),
    );
    if (rows.length === 0) return { created: 0 };
    const { error } = await admin().from("leave_balances").insert(rows);
    if (error) throw new Error(error.message);
    return { created: rows.length };
  });
