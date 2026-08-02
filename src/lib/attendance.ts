/** أدوات مشتركة (نقية) لحسابات الدوام والعطل والإجازات */

export type WorkSettings = {
  work_days: number[];
  start_time: string;
  end_time: string;
  grace_minutes: number;
};

export type HolidayRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  recurring_annually: boolean;
};

export type LeaveTypeRow = {
  id: string;
  code: string;
  name: string;
  annual_days: number;
  is_paid: boolean;
  requires_attachment: boolean;
  is_hourly: boolean;
  active: boolean;
  position: number;
};

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  work_days: [0, 1, 2, 3, 4],
  start_time: "08:00",
  end_time: "15:00",
  grace_minutes: 10,
};

export const DAY_NAMES = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "حاضر",
  absent: "غائب",
  leave: "إجازة",
  holiday: "عطلة",
  permission: "إذن",
};

export const ATTENDANCE_STATUSES = ["present", "absent", "leave", "holiday", "permission"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function toMinutes(time?: string | null): number | null {
  if (!time) return null;
  const m = /(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fromMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMinutes(total: number) {
  if (!total) return "—";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} س ${m} د`;
  if (h) return `${h} ساعة`;
  return `${m} دقيقة`;
}

export function dayOf(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

export function isWeekendDay(dateStr: string, settings: WorkSettings) {
  return !settings.work_days.includes(dayOf(dateStr));
}

const md = (d: string) => d.slice(5, 10);

export function holidayOn(dateStr: string, holidays: HolidayRow[]): HolidayRow | null {
  for (const h of holidays) {
    if (h.recurring_annually) {
      const from = md(h.start_date);
      const to = md(h.end_date);
      const cur = md(dateStr);
      if (from <= to ? cur >= from && cur <= to : cur >= from || cur <= to) return h;
    } else if (dateStr >= h.start_date && dateStr <= h.end_date) {
      return h;
    }
  }
  return null;
}

export function isOffDay(dateStr: string, settings: WorkSettings, holidays: HolidayRow[]) {
  return isWeekendDay(dateStr, settings) || !!holidayOn(dateStr, holidays);
}

export function listDates(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  let guard = 0;
  while (d <= last && guard++ < 2000) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function countWorkingDays(
  start: string,
  end: string,
  settings: WorkSettings,
  holidays: HolidayRow[],
) {
  return listDates(start, end).filter((d) => !isOffDay(d, settings, holidays)).length;
}

export type AttendanceComputation = {
  late_minutes: number;
  early_leave_minutes: number;
  worked_minutes: number;
};

export function computeAttendance(
  input: { check_in?: string | null; check_out?: string | null; permission_minutes?: number },
  settings: WorkSettings,
): AttendanceComputation {
  const start = toMinutes(settings.start_time) ?? 480;
  const end = toMinutes(settings.end_time) ?? 900;
  const grace = settings.grace_minutes ?? 0;
  const permission = input.permission_minutes ?? 0;

  const inMin = toMinutes(input.check_in);
  const outMin = toMinutes(input.check_out);

  let late = inMin != null && inMin > start + grace ? inMin - start - grace : 0;
  let early = outMin != null && outMin < end ? end - outMin : 0;

  // خصم الإذن الساعي المعتمد من التأخير ثم من الانصراف المبكر
  let credit = permission;
  const usedOnLate = Math.min(credit, late);
  late -= usedOnLate;
  credit -= usedOnLate;
  early -= Math.min(credit, early);

  const worked = inMin != null && outMin != null && outMin > inMin ? outMin - inMin : 0;
  return {
    late_minutes: Math.max(0, Math.round(late)),
    early_leave_minutes: Math.max(0, Math.round(early)),
    worked_minutes: Math.max(0, Math.round(worked)),
  };
}

/** نسبة الالتزام بالدوام (0-100) لفترة محددة */
export function complianceScore(rows: {
  status: string;
  late_minutes: number;
  early_leave_minutes: number;
}[]) {
  const countable = rows.filter((r) => r.status !== "holiday" && r.status !== "leave");
  if (countable.length === 0) return 100;
  const present = countable.filter((r) => r.status === "present" || r.status === "permission").length;
  const penaltyMinutes = countable.reduce(
    (s, r) => s + r.late_minutes + r.early_leave_minutes,
    0,
  );
  const rate = (present / countable.length) * 100;
  return Math.max(0, Math.min(100, Math.round(rate - penaltyMinutes / 30)));
}

export const LEAVE_STAGE_STEPS = [
  { stage: "pending_manager", label: "المدير المباشر" },
  { stage: "pending_hr", label: "الموارد البشرية" },
  { stage: "pending_director", label: "المدير التنفيذي" },
] as const;
