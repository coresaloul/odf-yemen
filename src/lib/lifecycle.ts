export type LifecycleEventType =
  | "hired"
  | "onboarding"
  | "probation"
  | "confirmation"
  | "promotion"
  | "transfer"
  | "salary_change"
  | "title_change"
  | "contract_renewal"
  | "recognition"
  | "sanction"
  | "leave_long"
  | "offboarding"
  | "terminated"
  | "other";

export const LIFECYCLE_EVENT_LABELS: Record<string, string> = {
  hired: "التعيين",
  onboarding: "التهيئة والانضمام",
  probation: "فترة التجربة",
  confirmation: "تثبيت بعد التجربة",
  promotion: "ترقية",
  transfer: "نقل",
  salary_change: "تعديل راتب",
  title_change: "تغيير مسمى وظيفي",
  contract_renewal: "تجديد عقد",
  recognition: "تكريم",
  sanction: "جزاء",
  leave_long: "إجازة طويلة",
  offboarding: "إجراءات إنهاء الخدمة",
  terminated: "انتهاء الخدمة",
  other: "حدث آخر",
};

export type MovementType =
  | "promotion"
  | "transfer"
  | "salary_change"
  | "title_change"
  | "contract_renewal";

export const MOVEMENT_LABELS: Record<string, string> = {
  promotion: "ترقية",
  transfer: "نقل",
  salary_change: "تعديل راتب",
  title_change: "تغيير مسمى وظيفي",
  contract_renewal: "تجديد عقد",
};

export type ChecklistKind = "onboarding" | "offboarding";

export const CHECKLIST_KIND_LABELS: Record<ChecklistKind, string> = {
  onboarding: "قائمة التهيئة والانضمام",
  offboarding: "قائمة إخلاء الطرف",
};

export const OWNER_ROLE_LABELS: Record<string, string> = {
  hr: "الموارد البشرية",
  manager: "المدير المباشر",
  it: "تقنية المعلومات",
  finance: "المالية",
  employee: "الموظف",
};

export const TERMINATION_TYPES: { value: string; label: string }[] = [
  { value: "resignation", label: "استقالة" },
  { value: "contract_end", label: "انتهاء عقد" },
  { value: "dismissal", label: "فصل تأديبي" },
  { value: "retirement", label: "تقاعد" },
  { value: "other", label: "أخرى" },
];

export const TERMINATION_LABELS: Record<string, string> = Object.fromEntries(
  TERMINATION_TYPES.map((t) => [t.value, t.label]),
);

export type LifecycleEvent = {
  id: string;
  employee_id: string;
  event_type: string;
  title: string;
  details: string | null;
  event_date: string;
  created_at: string;
};

export type ChecklistItem = {
  id: string;
  employee_id: string;
  kind: ChecklistKind;
  title: string;
  owner_role: string;
  due_date: string | null;
  is_done: boolean;
  done_at: string | null;
  note: string | null;
  sort_order: number;
};

export type Movement = {
  id: string;
  employee_id: string;
  movement_type: string;
  effective_date: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  applied: boolean;
};

export type Offboarding = {
  id: string;
  employee_id: string;
  termination_type: string;
  notice_date: string | null;
  last_working_day: string;
  reason: string | null;
  settlement_amount: number;
  status: string;
  completed_at: string | null;
};

export type LifecycleStage =
  | "onboarding"
  | "probation"
  | "active"
  | "offboarding"
  | "terminated";

export const STAGE_LABELS_LIFECYCLE: Record<LifecycleStage, string> = {
  onboarding: "قيد التهيئة",
  probation: "تحت التجربة",
  active: "على رأس العمل",
  offboarding: "إجراءات إنهاء خدمة",
  terminated: "انتهت خدمته",
};

export const PROBATION_DAYS = 90;

export function daysBetween(a: string | Date, b: string | Date) {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.round((d2 - d1) / 86400000);
}

export function computeStage(input: {
  status: string;
  hire_date: string | null;
  onboardingOpen: number;
  offboarding: Offboarding | null;
}): LifecycleStage {
  if (input.status === "terminated" || input.offboarding?.status === "completed")
    return "terminated";
  if (input.offboarding) return "offboarding";
  if (input.onboardingOpen > 0) return "onboarding";
  if (input.hire_date && daysBetween(input.hire_date, new Date()) < PROBATION_DAYS)
    return "probation";
  return "active";
}
