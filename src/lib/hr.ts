export const PERIOD_LABELS: Record<string, string> = {
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semiannual: "نصف سنوي",
  annual: "سنوي",
};

/** فترات التقييم المعتمدة فقط (لا يوجد تقييم يومي أو أسبوعي) */
export const EVALUATION_PERIOD_LABELS: Record<string, string> = {
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semiannual: "نصف سنوي",
  annual: "سنوي",
};


export const TASK_STATUS_LABELS: Record<string, string> = {
  new: "جديدة",
  in_progress: "قيد التنفيذ",
  pending_approval: "بانتظار الاعتماد",
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

/* ===================== فترات التقييم التقويمية ===================== */

export type EvaluationPeriodKey = "monthly" | "quarterly" | "semiannual" | "annual";

export const EVALUATION_PERIODS: EvaluationPeriodKey[] = [
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
];

const MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const pad = (n: number) => String(n).padStart(2, "0");
const dayISO = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export type CalendarPeriodOption = {
  value: string; // period_start
  label: string;
  start: string;
  end: string;
};

/** كل خيارات الفترة التقويمية لسنة معينة */
export function calendarPeriodOptions(
  period: EvaluationPeriodKey,
  year: number,
): CalendarPeriodOption[] {
  if (period === "monthly") {
    return MONTH_NAMES.map((name, i) => {
      const m = i + 1;
      return {
        value: dayISO(year, m, 1),
        label: `${name} ${year}`,
        start: dayISO(year, m, 1),
        end: dayISO(year, m, lastDay(year, m)),
      };
    });
  }
  if (period === "quarterly") {
    return [1, 2, 3, 4].map((q) => {
      const sm = (q - 1) * 3 + 1;
      const em = sm + 2;
      const names = ["الربع الأول", "الربع الثاني", "الربع الثالث", "الربع الرابع"];
      return {
        value: dayISO(year, sm, 1),
        label: `${names[q - 1]} ${year}`,
        start: dayISO(year, sm, 1),
        end: dayISO(year, em, lastDay(year, em)),
      };
    });
  }
  if (period === "semiannual") {
    return [1, 2].map((h) => {
      const sm = h === 1 ? 1 : 7;
      const em = h === 1 ? 6 : 12;
      return {
        value: dayISO(year, sm, 1),
        label: `${h === 1 ? "النصف الأول" : "النصف الثاني"} ${year}`,
        start: dayISO(year, sm, 1),
        end: dayISO(year, em, lastDay(year, em)),
      };
    });
  }
  return [
    {
      value: dayISO(year, 1, 1),
      label: `سنة ${year}`,
      start: dayISO(year, 1, 1),
      end: dayISO(year, 12, 31),
    },
  ];
}

/** نطاق فترة تقويمية انطلاقاً من تاريخ بدايتها */
export function calendarPeriodRange(period: EvaluationPeriodKey, periodStart: string) {
  const year = Number(periodStart.slice(0, 4));
  const found = calendarPeriodOptions(period, year).find((o) => o.value === periodStart);
  if (found) return { start: found.start, end: found.end, label: found.label };
  return { start: periodStart, end: periodStart, label: periodStart };
}

/** الفترة التقويمية المكتملة الأحدث (الافتراضية عند فتح النموذج) */
export function defaultCalendarPeriod(period: EvaluationPeriodKey, reference = new Date()) {
  const year = reference.getFullYear();
  const options = calendarPeriodOptions(period, year);
  const today = reference.toISOString().slice(0, 10);
  const started = options.filter((o) => o.start <= today);
  const current = started[started.length - 1] ?? options[0]!;
  return { year, option: current };
}

export function periodYears(reference = new Date()) {
  const y = reference.getFullYear();
  return [y + 1, y, y - 1, y - 2, y - 3];
}

export function acknowledgementLabel(status: string) {
  if (status === "acknowledged") return "تم الاطلاع";
  if (status === "disputed") return "تظلم مسجل";
  return "بانتظار اطلاع الموظف";
}
