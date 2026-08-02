/** ثوابت وأنواع إدارة الرواتب (آمنة للمتصفح) */

export const WORKER_TYPES = ["employee", "worker", "consultant", "volunteer"] as const;
export type WorkerType = (typeof WORKER_TYPES)[number];

export const WORKER_TYPE_LABELS: Record<string, string> = {
  employee: "موظف",
  worker: "عامل",
  consultant: "استشاري",
  volunteer: "متطوع",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  transfer: "حوالة",
  bank: "حساب بنكي",
};

export const COMPONENT_KIND_LABELS: Record<string, string> = {
  earning: "بدل / استحقاق",
  deduction: "استقطاع",
};

export const CALC_METHOD_LABELS: Record<string, string> = {
  fixed: "مبلغ ثابت",
  percent_basic: "نسبة من الأساسي (%)",
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  hr_review: "بانتظار الموارد البشرية",
  director_review: "بانتظار المدير التنفيذي",
  approved: "معتمدة",
  paid: "مصروفة",
};

export const RUN_STATUS_ORDER = ["draft", "hr_review", "director_review", "approved", "paid"];

export const ADJUSTMENT_KIND_LABELS: Record<string, string> = {
  addition: "إضافة",
  deduction: "خصم",
};

export const ADJUSTMENT_REASONS: { value: string; label: string; kind: "addition" | "deduction" }[] = [
  { value: "salary_difference", label: "فرق راتب", kind: "addition" },
  { value: "extra_allowance", label: "بدل إضافي", kind: "addition" },
  { value: "compensation", label: "تعويض", kind: "addition" },
  { value: "overtime", label: "ساعات عمل إضافية", kind: "addition" },
  { value: "recovery", label: "استرداد مبلغ", kind: "deduction" },
  { value: "penalty", label: "جزاء", kind: "deduction" },
  { value: "overpayment_fix", label: "تصحيح صرف زائد", kind: "deduction" },
  { value: "other", label: "أخرى", kind: "addition" },
];

export const ADJUSTMENT_REASON_LABELS: Record<string, string> = Object.fromEntries(
  ADJUSTMENT_REASONS.map((r) => [r.value, r.label]),
);

export const ADJUSTMENT_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  locked: "مقفلة",
  applied: "مُطبّقة",
};

export const LINE_SOURCE_LABELS: Record<string, string> = {
  basic: "الراتب الأساسي",
  component: "بند ثابت",
  attendance: "خصم دوام",
  incentive: "حافز أداء",
  advance: "قسط سلفة",
  adjustment: "تعديل",
  contract: "دفعة عقد",
  manual: "يدوي",
};

export type PayrollSettings = {
  id: string;
  currency: string;
  month_days: number;
  day_hours: number;
  deduct_absence: boolean;
  deduct_unpaid_leave: boolean;
  deduct_late: boolean;
  late_grace_minutes: number;
  incentive_tiers: { min_score: number; percent: number }[];
  manager_can_view: boolean;
};

export function formatMoney(value: number | string | null | undefined, currency = "ر.ي") {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("ar-EG-u-nu-latn", { maximumFractionDigits: 2 })} ${currency}`;
}

export function monthLabel(month: string) {
  const d = new Date(`${String(month).slice(0, 7)}-01T00:00:00`);
  return d.toLocaleDateString("ar-EG-u-nu-latn", { year: "numeric", month: "long" });
}

export function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthBounds(month: string) {
  const parts = String(month).slice(0, 7).split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end), firstDay: iso(start) };
}
