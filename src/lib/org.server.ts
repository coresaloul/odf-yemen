import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminClient = typeof supabaseAdmin;

export function getAdmin(): AdminClient {
  return supabaseAdmin;
}

export async function actorName(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name ?? null;
}

export async function writeAudit(
  actorId: string,
  entry: {
    action: string;
    entity: string;
    entity_id?: string | null;
    entity_label?: string | null;
    details?: Record<string, unknown> | null;
  },
) {
  await supabaseAdmin.from("audit_log").insert({
    actor_id: actorId,
    actor_name: await actorName(actorId),
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entity_id ?? null,
    entity_label: entry.entity_label ?? null,
    details: (entry.details ?? null) as never,
  });
}

export function mapDbError(message: string) {
  if (message.includes("departments_name_unique_idx")) return "يوجد إدارة بنفس الاسم بالفعل";
  if (message.includes("sections_dept_name_unique_idx"))
    return "يوجد قسم بنفس الاسم داخل هذه الإدارة";
  if (message.includes("employees_employee_no_unique_idx")) return "الرقم الوظيفي مستخدم مسبقاً";
  if (message.includes("violates foreign key")) return "لا يمكن تنفيذ العملية لوجود سجلات مرتبطة";
  return message;
}
