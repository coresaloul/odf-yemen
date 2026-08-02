export const PERIOD_LABELS: Record<string, string> = {
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semiannual: "نصف سنوي",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  new: "جديدة",
  in_progress: "قيد التنفيذ",
  completed: "منجزة",
  cancelled: "ملغاة",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  active: "على رأس العمل",
  on_leave: "في إجازة",
  terminated: "منتهي الخدمة",
};

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "حاضر",
  absent: "غائب",
  leave: "إجازة",
  holiday: "عطلة",
};

export const ROLE_LABELS: Record<string, string> = {
  executive_director: "المدير التنفيذي",
  manager: "مدير مباشر",
  employee: "موظف",
  hr: "الموارد البشرية",
};

export const ORG_NAME = "مؤسسة اليتيم التنموية";

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function gradeFor(score: number) {
  if (score >= 90) return "ممتاز";
  if (score >= 80) return "جيد جداً";
  if (score >= 70) return "جيد";
  if (score >= 60) return "مقبول";
  return "ضعيف";
}

export type PeriodKey = "daily" | "weekly" | "monthly" | "quarterly" | "semiannual";

export function periodRange(period: PeriodKey, reference = new Date()) {
  const end = new Date(reference);
  const start = new Date(reference);
  switch (period) {
    case "daily":
      break;
    case "weekly":
      start.setDate(start.getDate() - 6);
      break;
    case "monthly":
      start.setMonth(start.getMonth() - 1);
      start.setDate(start.getDate() + 1);
      break;
    case "quarterly":
      start.setMonth(start.getMonth() - 3);
      start.setDate(start.getDate() + 1);
      break;
    case "semiannual":
      start.setMonth(start.getMonth() - 6);
      start.setDate(start.getDate() + 1);
      break;
  }
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}
