/** حساب درجات التقييم التلقائية (مهام/دوام) — منطق خالص قابل للاستخدام في الخادم والمتصفح */

export type ScoredTask = {
  status: string;
  progress: number | null;
  weight: number | null;
  due_date: string | null;
  completed_at: string | null;
};

export type ScoredAttendance = {
  status: string;
  late_minutes: number | null;
  early_leave_minutes: number | null;
};

export type TaskScoreDetails = {
  total: number;
  completed: number;
  late: number;
  cancelled: number;
  inProgress: number;
  avgProgress: number;
};

export type AttendanceScoreDetails = {
  workDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  presenceRate: number;
};

export function scoreTasks(tasks: ScoredTask[]): { score: number; details: TaskScoreDetails } {
  const active = tasks.filter((t) => t.status !== "cancelled");
  const cancelled = tasks.length - active.length;
  const completed = active.filter((t) => t.status === "completed").length;
  const inProgress = active.filter((t) => t.status === "in_progress").length;
  const isLate = (t: ScoredTask) =>
    t.status === "completed" && !!t.due_date && !!t.completed_at
      ? t.completed_at.slice(0, 10) > t.due_date
      : false;
  const late = active.filter(isLate).length;

  const totalWeight = active.reduce((s, t) => s + (t.weight || 1), 0);
  const earned = active.reduce((s, t) => {
    const base = (t.progress ?? 0) * (t.weight || 1);
    return s + (isLate(t) ? base * 0.85 : base);
  }, 0);

  const score = totalWeight ? Math.min(100, Math.round(earned / totalWeight)) : 0;
  const avgProgress = active.length
    ? Math.round(active.reduce((s, t) => s + (t.progress ?? 0), 0) / active.length)
    : 0;

  return {
    score,
    details: { total: active.length, completed, late, cancelled, inProgress, avgProgress },
  };
}

export function scoreAttendance(
  records: ScoredAttendance[],
): { score: number; details: AttendanceScoreDetails } {
  const counted = records.filter((r) => r.status !== "holiday");
  const presentDays = counted.filter((r) => r.status === "present").length;
  const absentDays = counted.filter((r) => r.status === "absent").length;
  const leaveDays = counted.filter((r) => r.status === "leave").length;
  const lateMinutes = counted.reduce((s, r) => s + (r.late_minutes ?? 0), 0);
  const earlyLeaveMinutes = counted.reduce((s, r) => s + (r.early_leave_minutes ?? 0), 0);
  const workDays = counted.length;
  const presenceRate = workDays ? ((presentDays + leaveDays) / workDays) * 100 : 0;
  const penalty = (lateMinutes + earlyLeaveMinutes) / 30;
  const score = workDays ? Math.max(0, Math.min(100, Math.round(presenceRate - penalty))) : 0;

  return {
    score,
    details: {
      workDays,
      presentDays,
      absentDays,
      leaveDays,
      lateMinutes,
      earlyLeaveMinutes,
      presenceRate: Math.round(presenceRate),
    },
  };
}

export type WeightedItem = { weight: number; score: number; maxScore: number };

/** المتوسط المرجّح لمعايير سلوكية (0-100) */
export function weightedAverage(items: WeightedItem[]) {
  const totalWeight = items.reduce((s, i) => s + (i.weight || 0), 0);
  if (!totalWeight) return 0;
  const sum = items.reduce(
    (s, i) => s + (i.maxScore ? (i.score / i.maxScore) * 100 : 0) * (i.weight || 0),
    0,
  );
  return Math.round(sum / totalWeight);
}

export function taskDetailsLabel(d: TaskScoreDetails) {
  return `المهام: ${d.total} — منجزة: ${d.completed} — متأخرة: ${d.late} — قيد التنفيذ: ${d.inProgress} — ملغاة: ${d.cancelled} — متوسط الإنجاز: ${d.avgProgress}%`;
}

export function attendanceDetailsLabel(d: AttendanceScoreDetails) {
  return `أيام العمل: ${d.workDays} — حضور: ${d.presentDays} — غياب: ${d.absentDays} — إجازة: ${d.leaveDays} — تأخير: ${d.lateMinutes} د — خروج مبكر: ${d.earlyLeaveMinutes} د`;
}
