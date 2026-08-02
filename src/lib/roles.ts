export const APP_ROLES = ["executive_director", "manager", "hr", "employee"] as const;
export type AppRoleValue = (typeof APP_ROLES)[number];

type RoleQueryClient = {
  from: (table: "user_roles") => {
    select: (cols: string) => {
      eq: (col: string, value: string) => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

/** يقرأ أدوار المستخدم الحالي من جدول الأدوار (لا يعتمد على دوال RPC عامة) */
export async function getRolesOf(
  supabase: unknown,
  userId: string,
): Promise<AppRoleValue[]> {
  const client = supabase as RoleQueryClient;
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId);
  if (error) return [];
  return ((data ?? []) as { role: AppRoleValue }[]).map((r) => r.role);
}

export async function assertDirectorRole(supabase: unknown, userId: string) {
  const roles = await getRolesOf(supabase, userId);
  if (!roles.includes("executive_director")) {
    throw new Error("غير مصرح: هذا الإجراء للمدير التنفيذي فقط");
  }
  return roles;
}

/** المدير التنفيذي أو الموارد البشرية */
export async function assertAdminRole(supabase: unknown, userId: string) {
  const roles = await getRolesOf(supabase, userId);
  if (!roles.includes("executive_director") && !roles.includes("hr")) {
    throw new Error("غير مصرح: هذا الإجراء للمدير التنفيذي أو الموارد البشرية فقط");
  }
  return roles;
}

/** مصفوفة الصلاحيات المرجعية المعروضة في الواجهة */
export const PERMISSION_MATRIX: {
  area: string;
  executive_director: string;
  hr: string;
  manager: string;
  employee: string;
}[] = [
  {
    area: "الهيكل التنظيمي (الإدارات والأقسام)",
    executive_director: "إضافة وتعديل وحذف",
    hr: "إضافة وتعديل وحذف",
    manager: "اطلاع",
    employee: "اطلاع",
  },
  {
    area: "ملفات الموظفين",
    executive_director: "كامل + البيانات المالية",
    hr: "كامل عدا البيانات المالية",
    manager: "موظفو وحدته",
    employee: "ملفه فقط",
  },
  {
    area: "المستخدمون والحسابات",
    executive_director: "كامل",
    hr: "إنشاء وتفعيل وتعطيل",
    manager: "—",
    employee: "—",
  },
  {
    area: "منح الأدوار والصلاحيات",
    executive_director: "نعم",
    hr: "—",
    manager: "—",
    employee: "—",
  },
  {
    area: "المهام",
    executive_director: "تكليف الجميع",
    hr: "اطلاع",
    manager: "تكليف موظفي وحدته",
    employee: "مهامه فقط",
  },
  {
    area: "التقييم والاعتماد",
    executive_director: "الاعتماد النهائي",
    hr: "اعتماد المرحلة الثانية",
    manager: "إنشاء واعتماد أولي",
    employee: "اطلاع على تقييمه",
  },
  {
    area: "سجل التدقيق",
    executive_director: "اطلاع",
    hr: "اطلاع",
    manager: "—",
    employee: "—",
  },
];
