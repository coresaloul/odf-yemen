import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** الحقول التي يُسمح للموظف بتعديلها بنفسه */
const selfSchema = z.object({
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  birth_date: z.string().trim().nullable().optional(),
  gender: z.string().trim().max(20).nullable().optional(),
  marital_status: z.string().trim().max(30).nullable().optional(),
  blood_type: z.string().trim().max(10).nullable().optional(),
  chronic_diseases: z.string().trim().max(1000).nullable().optional(),
  allergies: z.string().trim().max(1000).nullable().optional(),
  nationality: z.string().trim().max(60).nullable().optional(),
  national_id: z.string().trim().max(40).nullable().optional(),
  national_id_expiry: z.string().trim().nullable().optional(),
  passport_no: z.string().trim().max(40).nullable().optional(),
  passport_expiry: z.string().trim().nullable().optional(),
  education_level: z.string().trim().max(60).nullable().optional(),
  specialization: z.string().trim().max(120).nullable().optional(),
  emergency_contact_name: z.string().trim().max(120).nullable().optional(),
  emergency_contact_phone: z.string().trim().max(40).nullable().optional(),
  emergency_contact_relation: z.string().trim().max(60).nullable().optional(),
});

export type SelfProfileInput = z.infer<typeof selfSchema>;

export type MyProfile = {
  id: string;
  employee_no: string;
  full_name: string;
  job_title: string | null;
  email: string | null;
  status: string;
  hire_date: string | null;
  department_name: string | null;
  section_name: string | null;
  manager_name: string | null;
} & SelfProfileInput;

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile | null> => {
    const { data, error } = await context.supabase
      .from("employees")
      .select(
        "id, employee_no, full_name, job_title, email, status, hire_date, phone, address, birth_date, gender, marital_status, blood_type, chronic_diseases, allergies, nationality, national_id, national_id_expiry, passport_no, passport_expiry, education_level, specialization, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, department_id, section_id, manager_id",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    const [dept, sect, mgr] = await Promise.all([
      data.department_id
        ? context.supabase.from("departments").select("name").eq("id", data.department_id).maybeSingle()
        : Promise.resolve({ data: null }),
      data.section_id
        ? context.supabase.from("sections").select("name").eq("id", data.section_id).maybeSingle()
        : Promise.resolve({ data: null }),
      data.manager_id
        ? context.supabase.from("employees").select("full_name").eq("id", data.manager_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const { department_id: _d, section_id: _s, manager_id: _m, ...rest } = data;
    return {
      ...(rest as MyProfile),
      department_name: (dept.data as { name?: string } | null)?.name ?? null,
      section_name: (sect.data as { name?: string } | null)?.name ?? null,
      manager_name: (mgr.data as { full_name?: string } | null)?.full_name ?? null,
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => selfSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: me, error: meErr } = await context.supabase
      .from("employees")
      .select("id, full_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (meErr) throw new Error(meErr.message);
    if (!me) throw new Error("لا يوجد ملف موظف مرتبط بحسابك");

    const patch: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      patch[key] = typeof value === "string" && value.trim() === "" ? null : (value as string | null);
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    // يتم التحديث بهوية المستخدم نفسه (RLS + مُشغِّل الحماية يمنعان تعديل الحقول الحساسة)
    const { error } = await context.supabase
      .from("employees")
      .update(patch as never)
      .eq("id", me.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);

    const { writeAudit } = await import("@/lib/org.server");
    await writeAudit(context.userId, {
      action: "تحديث البيانات الشخصية",
      entity: "موظف",
      entity_id: me.id,
      entity_label: me.full_name,
      details: { fields: Object.keys(patch) },
    });
    return { ok: true };
  });
