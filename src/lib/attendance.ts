/** أدوات مشتركة (نقية) لحسابات الدوام والعطل والإجازات والورديات والساعات الإضافية */

export type WorkSettings = {
  work_days: number[];
  start_time: string;
  end_time: string;
  grace_minutes: number;
};

export type ShiftRow = {
  id: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  work_days: number[];
  grace_minutes: number;
  is_night_shift: boolean;
  overtime_enabled: boolean;
  min_overtime_minutes: number;
  color: string;
  is_default: boolean;
  active: boolean;
  notes?: string | null;
};

export type ShiftAssignmentRow = {
  id: string;
  shift_id: string;
  employee_id?: string | null;
  department_id?: string | null;
  section_id?: string | null;
  start_date: string;
  end_date?: string | null;
  notes?: string | null;
  shift?: ShiftRow | null;
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

export const DEFAULT_SHIFT: ShiftRow = {
  id: "default",
  name: "الوردية الصباحية القياسية",
  code: "default-morning",
  start_time: "08:00",
  end_time: "15:00",
  work_days: [0, 1, 2, 3, 4],
  grace_minutes: 10,
  is_night_shift: false,
  overtime_enabled: true,
  min_overtime_minutes: 30,
  color: "#0284c7",
  is_default: true,
  active: true,
  notes: "الوردية الافتراضية العامة",
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

export function isWeekendDay(dateStr: string, settings: WorkSettings | ShiftRow) {
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

export function isOffDay(
  dateStr: string,
  settings: WorkSettings | ShiftRow,
  holidays: HolidayRow[],
) {
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
  settings: WorkSettings | ShiftRow,
  holidays: HolidayRow[],
) {
  return listDates(start, end).filter((d) => !isOffDay(d, settings, holidays)).length;
}

export type AttendanceComputation = {
  late_minutes: number;
  early_leave_minutes: number;
  worked_minutes: number;
  overtime_minutes: number;
};

/**
 * حساب التأخير، الانصراف المبكر، ساعات العمل الفعلية، وساعات العمل الإضافي (Overtime)
 * وفق الوردية المحددة أو إعدادات العمل العامة.
 */
export function computeAttendance(
  input: { check_in?: string | null; check_out?: string | null; permission_minutes?: number },
  settings: WorkSettings | ShiftRow,
  options?: { isOffDay?: boolean },
): AttendanceComputation {
  const start = toMinutes(settings.start_time) ?? 480;
  const end = toMinutes(settings.end_time) ?? 900;
  const grace = settings.grace_minutes ?? 0;
  const permission = input.permission_minutes ?? 0;
  const isNight = "is_night_shift" in settings ? Boolean(settings.is_night_shift) : false;
  const overtimeEnabled = "overtime_enabled" in settings ? Boolean(settings.overtime_enabled) : true;
  const minOvertime = "min_overtime_minutes" in settings ? Number(settings.min_overtime_minutes) : 30;

  const inMin = toMinutes(input.check_in);
  const outMin = toMinutes(input.check_out);

  if (inMin == null && outMin == null) {
    return { late_minutes: 0, early_leave_minutes: 0, worked_minutes: 0, overtime_minutes: 0 };
  }

  // إذا كان الحضور في يوم عطلة أو إجازة، فكل ساعات العمل تحتسب إضافي
  if (options?.isOffDay && inMin != null && outMin != null) {
    const rawWorked = outMin >= inMin ? outMin - inMin : 1440 - inMin + outMin;
    return {
      late_minutes: 0,
      early_leave_minutes: 0,
      worked_minutes: Math.max(0, Math.round(rawWorked)),
      overtime_minutes: overtimeEnabled ? Math.max(0, Math.round(rawWorked)) : 0,
    };
  }

  let late = 0;
  let early = 0;
  let worked = 0;
  let overtime = 0;

  if (inMin != null) {
    if (inMin > start + grace) {
      late = inMin - start - grace;
    }
  }

  if (outMin != null) {
    if (!isNight) {
      if (outMin < end) {
        early = end - outMin;
      } else if (overtimeEnabled && outMin >= end + minOvertime) {
        overtime = outMin - end;
      }
    } else {
      // نوبة ليلية تعبر منتصف الليل
      if (outMin < end) {
        early = end - outMin;
      } else if (overtimeEnabled && outMin >= end + minOvertime) {
        overtime = outMin - end;
      }
    }
  }

  // خصم الإذن الساعي المعتمد من التأخير ثم من الانصراف المبكر
  let credit = permission;
  const usedOnLate = Math.min(credit, late);
  late -= usedOnLate;
  credit -= usedOnLate;
  early -= Math.min(credit, early);

  if (inMin != null && outMin != null) {
    worked = outMin >= inMin ? outMin - inMin : 1440 - inMin + outMin;
  }

  return {
    late_minutes: Math.max(0, Math.round(late)),
    early_leave_minutes: Math.max(0, Math.round(early)),
    worked_minutes: Math.max(0, Math.round(worked)),
    overtime_minutes: Math.max(0, Math.round(overtime)),
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
