export const APP_ROLES = [
  "executive_director",
  "manager",
  "hr",
  "secretariat",
  "employee",
] as const;
export type AppRoleValue = (typeof APP_ROLES)[number];

type RoleQueryClient = {
  from: (table: "user_roles") => {
    select: (cols: string) => {
      eq: (col: string, value: string) => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

/** يقرأ أدوار المستخدم الحالي من جدول الأدوار (لا يعتمد على دوال RPC عامة) */
export async function getRolesOf(supabase: unknown, userId: string): Promise<AppRoleValue[]> {
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
  secretariat: string;
  employee: string;
}[] = [
  {
    area: "الهيكل التنظيمي (الإدارات والأقسام)",
    executive_director: "إضافة وتعديل وحذف",
    hr: "إضافة وتعديل وحذف",
    manager: "اطلاع",
    secretariat: "اطلاع",
    employee: "اطلاع",
  },
  {
    area: "ملفات الموظفين والوثائق",
    executive_director: "كامل + البيانات المالية",
    hr: "إدارة كاملة والوثائق",
    manager: "موظفو وحدته",
    secretariat: "—",
    employee: "ملفه وبياناته الشخصية",
  },
  {
    area: "الدوام والبصمة والورديات",
    executive_director: "إشراف واعتماد كامل",
    hr: "إدارة الورديات والاستيراد والأجهزة",
    manager: "متابعة دوام فريقه",
    secretariat: "سجل دوامها",
    employee: "استعراض دوامه وتصحيح الحضور",
  },
  {
    area: "الإجازات والأذونات",
    executive_director: "الاعتماد النهائي",
    hr: "مراجعة واعتماد المرحلة 2",
    manager: "اعتماد أولي لفريقه",
    secretariat: "تقديم ومتابعة",
    employee: "تقديم ومتابعة رصيده",
  },
  {
    area: "المهام والتكليفات",
    executive_director: "تكليف ومتابعة الجميع",
    hr: "اطلاع ومتابعة",
    manager: "تكليف ومتابعة فريقه",
    secretariat: "مهام المعاملات ومتابعتها",
    employee: "تنفيذ وتحديث مهامه",
  },
  {
    area: "الصادر والوارد والمراسلات",
    executive_director: "اعتماد وتوجيه واطلاع كامل",
    hr: "معاملات الموارد البشرية",
    manager: "معاملات إدارته وتوجيهها",
    secretariat: "تسجيل وقيد وتوزيع وأرشفة",
    employee: "—",
  },
  {
    area: "التقييم والأداء",
    executive_director: "الاعتماد النهائي",
    hr: "اعتماد المرحلة 2 وضبط المعايير",
    manager: "إنشاء واعتماد أولي لفريقه",
    secretariat: "التقييم الذاتي والاطلاع",
    employee: "التقييم الذاتي والاطلاع",
  },
  {
    area: "الرواتب والمسيرات",
    executive_director: "الاعتماد النهائي والمالي",
    hr: "إعداد المسيرات والبدلات والسلف",
    manager: "قسائم راتبه",
    secretariat: "قسائم راتبها",
    employee: "استعراض وتحميل قسائم الراتب",
  },
  {
    area: "العهد والممتلكات",
    executive_director: "إشراف كامل",
    hr: "إدارة الأصول والتسليم والإرجاع",
    manager: "عهد موظفي فريقه",
    secretariat: "عهدها المستلمة",
    employee: "استعراض عهده وطلب الإرجاع",
  },
  {
    area: "المستخدمون والحسابات",
    executive_director: "إدارة كاملة + حذف",
    hr: "إنشاء وتفعيل ومطابقة الحسابات",
    manager: "—",
    secretariat: "—",
    employee: "—",
  },
  {
    area: "منح الأدوار والصلاحيات",
    executive_director: "تعديل ومنح وسحب الأدوار",
    hr: "—",
    manager: "—",
    secretariat: "—",
    employee: "—",
  },
  {
    area: "سجل التدقيق والتقارير العامة",
    executive_director: "اطلاع كامل وتصدير",
    hr: "اطلاع كامل وتصدير",
    manager: "تقارير فريقه وإدارته",
    secretariat: "تقارير المراسلات",
    employee: "—",
  },
];

