import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminRole, assertDirectorRole } from "@/lib/roles";

const ROLES = ["executive_director", "manager", "hr", "employee"] as const;
type Role = (typeof ROLES)[number];


export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  banned: boolean;
  roles: Role[];
  employee_name: string | null;
};

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const ids = list.users.map((u) => u.id);
    const [{ data: roleRows }, { data: profileRows }, { data: employeeRows }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
      supabaseAdmin.from("employees").select("user_id, full_name").in("user_id", ids),
    ]);

    return list.users.map((u) => {
      const bannedUntil = (u as unknown as { banned_until?: string | null }).banned_until ?? null;
      return {
        id: u.id,
        email: u.email ?? null,
        full_name:
          (profileRows ?? []).find((p) => p.id === u.id)?.full_name ??
          ((u.user_metadata as { full_name?: string } | null)?.full_name ?? null),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed: Boolean(u.email_confirmed_at),
        banned: Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now()),
        roles: (roleRows ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as Role),
        employee_name: (employeeRows ?? []).find((e) => e.user_id === u.id)?.full_name ?? null,
      };
    });
  });

export const confirmUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    if (data.userId === context.userId && !data.active) {
      throw new Error("لا يمكنك تعطيل حسابك الخاص");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(1).max(72) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ userId: z.string().uuid(), roles: z.array(z.enum(ROLES)).max(4) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertDirectorRole(context.supabase, context.userId);
    if (data.userId === context.userId && !data.roles.includes("executive_director")) {
      throw new Error("لا يمكنك سحب دور المدير التنفيذي من حسابك");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("@/lib/org.server");

    const { data: directors } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "executive_director");
    const wasDirector = (directors ?? []).some((r) => r.user_id === data.userId);
    if (
      wasDirector &&
      !data.roles.includes("executive_director") &&
      (directors ?? []).length <= 1
    ) {
      throw new Error("لا يمكن سحب الدور من آخر مدير تنفيذي في النظام");
    }

    const { error: delError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delError) throw new Error(delError.message);
    if (data.roles.length > 0) {
      const { error: insError } = await supabaseAdmin
        .from("user_roles")
        .insert(data.roles.map((role) => ({ user_id: data.userId, role })));
      if (insError) throw new Error(insError.message);
    }
    await writeAudit(context.userId, {
      action: "تعديل الأدوار",
      entity: "مستخدم",
      entity_id: data.userId,
      details: { roles: data.roles },
    });
    return { ok: true };

  });

/* ─── ربط الموظفين بالمستخدمين (كل موظف = مستخدم بدور "موظف" افتراضياً) ─── */

export type ProvisionResult = {
  employeeId: string;
  full_name: string;
  email: string | null;
  status: "created" | "linked" | "already_linked" | "skipped_no_email" | "error";
  password?: string;
  message?: string;
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
  let out = "";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

export const provisionEmployeeAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ employeeIds: z.array(z.string().uuid()).max(500).optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<ProvisionResult[]> => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("employees")
      .select("id, full_name, email, user_id")
      .is("user_id", null);
    if (data.employeeIds?.length) query = query.in("id", data.employeeIds);
    const { data: employees, error } = await query;
    if (error) throw new Error(error.message);

    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) throw new Error(listErr.message);
    const byEmail = new Map(
      list.users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id]),
    );

    const results: ProvisionResult[] = [];
    for (const emp of employees ?? []) {
      const email = (emp.email ?? "").trim().toLowerCase();
      const base: ProvisionResult = {
        employeeId: emp.id,
        full_name: emp.full_name,
        email: email || null,
        status: "error",
      };
      if (!email) {
        results.push({ ...base, status: "skipped_no_email", message: "لا يوجد بريد إلكتروني" });
        continue;
      }
      try {
        let userId = byEmail.get(email);
        let password: string | undefined;
        if (!userId) {
          password = randomPassword();
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: emp.full_name },
          });
          if (createErr || !created.user) throw new Error(createErr?.message ?? "تعذر إنشاء الحساب");
          userId = created.user.id;
          byEmail.set(email, userId);
        }

        const { data: roleRows } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        if (!roleRows || roleRows.length === 0) {
          await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "employee" });
        }

        const { error: linkErr } = await supabaseAdmin
          .from("employees")
          .update({ user_id: userId })
          .eq("id", emp.id);
        if (linkErr) throw new Error(linkErr.message);

        results.push({
          ...base,
          status: password ? "created" : "linked",
          ...(password ? { password } : {}),
        });
      } catch (e) {
        results.push({ ...base, status: "error", message: (e as Error).message });
      }
    }
    return results;
  });

/** عدد الموظفين غير المرتبطين بحساب مستخدم */
export const countUnlinkedEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("employees")
      .select("id", { count: "exact", head: true })
      .is("user_id", null);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

/* ─── إدارة متكاملة للمستخدمين: دعوة، ربط بموظف، حذف ─── */

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email("بريد إلكتروني غير صحيح"),
        full_name: z.string().trim().min(2).max(120),
        password: z.string().min(1).max(72),
        role: z.enum(ROLES).default("employee"),
        employeeId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const roles = await assertAdminRole(context.supabase, context.userId);
    if (data.role !== "employee" && !roles.includes("executive_director")) {
      throw new Error("منح الأدوار الإدارية للمدير التنفيذي فقط");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("@/lib/org.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "تعذر إنشاء الحساب");

    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    if (data.employeeId) {
      await supabaseAdmin
        .from("employees")
        .update({ user_id: created.user.id })
        .eq("id", data.employeeId);
    }
    await writeAudit(context.userId, {
      action: "إنشاء مستخدم",
      entity: "مستخدم",
      entity_id: created.user.id,
      entity_label: data.email,
      details: { role: data.role },
    });
    return { id: created.user.id };
  });

export const linkUserToEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        employeeId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("@/lib/org.server");

    await supabaseAdmin.from("employees").update({ user_id: null }).eq("user_id", data.userId);
    if (data.employeeId) {
      const { error } = await supabaseAdmin
        .from("employees")
        .update({ user_id: data.userId })
        .eq("id", data.employeeId);
      if (error) throw new Error(error.message);
    }
    await writeAudit(context.userId, {
      action: data.employeeId ? "ربط بموظف" : "فك الربط",
      entity: "مستخدم",
      entity_id: data.userId,
      details: { employeeId: data.employeeId },
    });
    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertDirectorRole(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك الخاص");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("@/lib/org.server");

    const { data: directors } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "executive_director");
    const isTargetDirector = (directors ?? []).some((r) => r.user_id === data.userId);
    if (isTargetDirector && (directors ?? []).length <= 1) {
      throw new Error("لا يمكن حذف آخر مدير تنفيذي في النظام");
    }

    await supabaseAdmin.from("employees").update({ user_id: null }).eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await writeAudit(context.userId, {
      action: "حذف مستخدم",
      entity: "مستخدم",
      entity_id: data.userId,
    });
    return { ok: true };
  });

/** قائمة الموظفين للربط في لوحة المستخدمين */
export const listEmployeesForLinking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, employee_no, user_id")
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
