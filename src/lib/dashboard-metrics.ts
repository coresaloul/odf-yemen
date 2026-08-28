/** حسابات لوحة المعلومات: درجات الأداء وترتيب الموظفين والوحدات العادلة والمتكاملة */

import { complianceScore } from "./attendance";
import { gradeFor } from "./hr";

export type MetricEmployee = {
  id: string;
  full_name: string;
  job_title: string | null;
  department_id: string | null;
  section_id: string | null;
  status: string;
};

export type MetricTask = {
  id: string;
  assignee_id: string;
  status: string;
  priority?: "urgent" | "high" | "normal" | "low" | string;
  weight?: number;
  progress: number;
  due_date: string | null;
  completed_at: string | null;
  start_date?: string | null;
  created_at?: string | null;
};

export type MetricAttendance = {
  employee_id: string;
  work_date: string;
  status: string;
  late_minutes: number;
  early_leave_minutes: number;
  permission_minutes: number;
  overtime_minutes?: number;
};

export type PerformerScore = {
  id: string;
  name: string;
  subtitle: string;
  totalTasks: number;
  completedTasks: number;
  tasksScore: number;
  attendanceScore: number;
  punctualityScore: number;
  score: number;
  grade: string;
  lateMinutes: number;
  presentDays: number;
  overtimeMinutes?: number;
  recognitionCount?: number;
  sanctionCount?: number;
  eligible: boolean;
  memberCount: number;
};

const pct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const PRIORITY_FACTORS: Record<string, number> = {
  urgent: 1.5,
  high: 1.25,
  normal: 1.0,
  low: 0.8,
};

/** حساب درجة إنجاز المهام مع الأوزان والأولويات وحجم العمل */
function tasksScoreOf(tasks: MetricTask[]) {
  if (tasks.length === 0) return 0;

  let totalWeight = 0;
  let progressWeight = 0;
  let completedWeight = 0;
  let completedCount = 0;

  for (const t of tasks) {
    const factor = PRIORITY_FACTORS[t.priority ?? "normal"] ?? 1.0;
    const w = (Number(t.weight) || 1.0) * factor;
    totalWeight += w;

    const prog = Math.max(0, Math.min(100, t.progress ?? 0));
    progressWeight += (prog / 100) * w;

    if (t.status === "completed") {
      completedWeight += w;
      completedCount++;
    }
  }

  if (totalWeight <= 0) return 0;

  const avgProgress = (progressWeight / totalWeight) * 100;
  const completionRate = (completedWeight / totalWeight) * 100;

  // مكافأة حجم العمل للموظفين أصحاب الإنتاجية المرتفعة
  const volumeBonus = completedCount >= 10 ? 5 : completedCount >= 5 ? 3 : completedCount >= 2 ? 1 : 0;

  return pct((avgProgress * 0.4) + (completionRate * 0.6) + volumeBonus);
}

/** الالتزام بالمواعيد: نسبة المهام المنجزة في موعدها مع خصم للمهام المتأخرة */
function punctualityScoreOf(tasks: MetricTask[]) {
  const due = tasks.filter((t) => t.due_date);
  if (due.length === 0) {
    if (tasks.length > 0) {
      const allDone = tasks.every((t) => t.status === "completed");
      return allDone ? 100 : 85;
    }
    return 80;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  let onTime = 0;
  let overdue = 0;

  for (const t of due) {
    if (t.status === "completed") {
      const doneDate = t.completed_at ? t.completed_at.slice(0, 10) : null;
      if (!doneDate || !t.due_date || doneDate <= t.due_date) {
        onTime++;
      }
    } else if (t.status !== "cancelled" && t.due_date && t.due_date < todayStr) {
      overdue++;
    }
  }

  const onTimeRate = (onTime / due.length) * 100;
  const overduePenalty = overdue * 10;

  return pct(onTimeRate - overduePenalty);
}

/** احتساب درجة الحضور العادلة مع مهلة التأخير وحسم الغياب ومكافأة الإضافي */
function attendanceScoreOf(att: MetricAttendance[]) {
  if (att.length === 0) return 0;

  const presentOrPermission = att.filter((a) => a.status === "present" || a.status === "permission").length;
  const leaves = att.filter((a) => a.status === "leave").length;
  const absents = att.filter((a) => a.status === "absent").length;

  const totalLate = att.reduce((s, a) => s + (a.late_minutes ?? 0), 0);
  const totalEarly = att.reduce((s, a) => s + (a.early_leave_minutes ?? 0), 0);
  const totalOvertime = att.reduce((s, a) => s + (a.overtime_minutes ?? 0), 0);

  // نسبة الحضور الأساسية
  const baseRate = ((presentOrPermission + leaves) / att.length) * 100;

  // خصم التأخير بعد مهلة سماح 15 دقيقة
  const latePenalty = Math.max(0, totalLate - 15) / 25;
  const earlyPenalty = totalEarly / 25;

  // خصم الغياب غير المبرر (8 نقاط لكل يوم)
  const absentPenalty = absents * 8;

  // مكافأة الساعات الإضافية المعتمدة (حتى +5 نقاط)
  const overtimeBonus = Math.min(5, Math.floor(totalOvertime / 60) * 1);

  return pct(baseRate - latePenalty - earlyPenalty - absentPenalty + overtimeBonus);
}

/** الدمج النهائي لدرجة الأداء */
function combine(tasksScore: number, attendanceScore: number, punctuality: number) {
  return pct(tasksScore * 0.45 + attendanceScore * 0.35 + punctuality * 0.20);
}

export function scoreEmployees(
  employees: MetricEmployee[],
  tasks: MetricTask[],
  attendance: MetricAttendance[],
  unitNameOf: (e: MetricEmployee) => string,
): PerformerScore[] {
  return employees.map((e) => {
    const own = tasks.filter((t) => t.assignee_id === e.id);
    const att = attendance.filter((a) => a.employee_id === e.id);

    const tasksScore = tasksScoreOf(own);
    const attendanceScore = attendanceScoreOf(att);
    const punctualityScore = punctualityScoreOf(own);

    const presentDays = att.filter(
      (a) => a.status === "present" || a.status === "permission",
    ).length;
    const completedTasks = own.filter((t) => t.status === "completed").length;
    const lateMinutes = att.reduce((s, a) => s + (a.late_minutes ?? 0), 0);
    const overtimeMinutes = att.reduce((s, a) => s + (a.overtime_minutes ?? 0), 0);

    const score = combine(tasksScore, attendanceScore, punctualityScore);

    return {
      id: e.id,
      name: e.full_name,
      subtitle: [e.job_title, unitNameOf(e)].filter(Boolean).join(" — ") || "—",
      totalTasks: own.length,
      completedTasks,
      tasksScore,
      attendanceScore,
      punctualityScore,
      score,
      grade: gradeFor(score),
      lateMinutes,
      presentDays,
      overtimeMinutes,
      eligible: presentDays >= 2 && (completedTasks >= 1 || own.length >= 1) && attendanceScore >= 50,
      memberCount: 1,
    };
  });
}

/** تجميع درجات الموظفين على مستوى إدارة أو قسم */
export function groupScores(
  scores: PerformerScore[],
  units: { id: string; name: string; subtitle?: string }[],
  memberIdsOf: (unitId: string) => string[],
): PerformerScore[] {
  return units.map((u) => {
    const ids = new Set(memberIdsOf(u.id));
    const members = scores.filter((s) => ids.has(s.id));
    const avg = (pick: (s: PerformerScore) => number) =>
      members.length ? pct(members.reduce((sum, s) => sum + pick(s), 0) / members.length) : 0;

    const tasksScore = avg((s) => s.tasksScore);
    const attendanceScore = avg((s) => s.attendanceScore);
    const punctualityScore = avg((s) => s.punctualityScore);
    const score = combine(tasksScore, attendanceScore, punctualityScore);
    const completedTasks = members.reduce((s, m) => s + m.completedTasks, 0);
    const presentDays = members.reduce((s, m) => s + m.presentDays, 0);
    const lateMinutes = members.reduce((s, m) => s + m.lateMinutes, 0);
    const overtimeMinutes = members.reduce((s, m) => s + (m.overtimeMinutes ?? 0), 0);

    return {
      id: u.id,
      name: u.name,
      subtitle: u.subtitle ?? `${members.length} موظف`,
      totalTasks: members.reduce((s, m) => s + m.totalTasks, 0),
      completedTasks,
      tasksScore,
      attendanceScore,
      punctualityScore,
      score,
      grade: gradeFor(score),
      lateMinutes,
      presentDays,
      overtimeMinutes,
      eligible: members.length > 0 && completedTasks >= 1 && score >= 60,
      memberCount: members.length,
    };
  });
}

/** تراتبية فض التعادل الذكي واختيار أفضل أداء */
export function rank(scores: PerformerScore[]) {
  return [...scores]
    .filter((s) => s.eligible)
    .sort((a, b) => {
      // 1. الدرجة الإجمالية
      if (b.score !== a.score) return b.score - a.score;
      // 2. المهام المنجزة
      if (b.completedTasks !== a.completedTasks) return b.completedTasks - a.completedTasks;
      // 3. درجة جودة المهام الموزونة
      if (b.tasksScore !== a.tasksScore) return b.tasksScore - a.tasksScore;
      // 4. الالتزام بالمواعيد
      if (b.punctualityScore !== a.punctualityScore) return b.punctualityScore - a.punctualityScore;
      // 5. الانضباط والدوام
      if (b.attendanceScore !== a.attendanceScore) return b.attendanceScore - a.attendanceScore;
      // 6. الأقل تأخراً
      return a.lateMinutes - b.lateMinutes;
    });
}

export function topOf(scores: PerformerScore[]): PerformerScore | null {
  return rank(scores)[0] ?? null;
}
