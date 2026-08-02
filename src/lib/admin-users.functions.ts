import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["executive_director", "manager", "hr", "employee"] as const;
type Role = (typeof ROLES)[number];

async function assertDirector(supabase: {
  rpc: (fn: "is_director") => Promise<{ data: unknown; error: unknown }>;
}) {
  const { data, error } = await supabase.rpc("is_director");
  if (error || data !== true) {
    throw new Error("غير مصرح: هذه الصفحة للمدير التنفيذي فقط");
  }
}

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
    await assertDirector(context.supabase as never);
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
    await assertDirector(context.supabase as never);
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
    await assertDirector(context.supabase as never);
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
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertDirector(context.supabase as never);
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
    await assertDirector(context.supabase as never);
    if (data.userId === context.userId && !data.roles.includes("executive_director")) {
      throw new Error("لا يمكنك سحب دور المدير التنفيذي من حسابك");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    return { ok: true };
  });
