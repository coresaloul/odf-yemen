/** حسابات لوحة المعلومات: درجات الأداء وترتيب الموظفين ولوحة الشرف معتمدة حصرياً على المهام بنسبة 100% */

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

/**
 * احتساب درجة المهام والإنتاجية (المعيار النهائي والحصري بنسبة 100%)
 * يراعي: أوزان المهام، الأولويات، نسبة الإنجاز، وحجم الإنتاجية الفعلي
 */
export function tasksScoreOf(tasks: MetricTask[]) {
  if (!tasks || tasks.length === 0) return 0;

  let totalWeight = 0;
  let progressWeight = 0;
  let completedWeight = 0;
  let completedCount = 0;

  for (const t of tasks) {
    const factor = PRIORITY_FACTORS[t.priority ?? "normal"] ?? 1.0;
    const w = Math.max(0.5, Number(t.weight) || 1.0) * factor;
    totalWeight += w;

    const prog = Math.max(0, Math.min(100, t.progress ?? 0));
    progressWeight += (prog / 100) * w;

    if (t.status === "completed") {
      completedWeight += w;
      completedCount++;
    }
  }

  if (totalWeight <= 0) return 0;

  const weightedProgressRate = (progressWeight / totalWeight) * 100;
  const weightedCompletionRate = (completedWeight / totalWeight) * 100;

  // بونص تصاعدي لحجم الإنتاجية الفعلي للموظفين الأكثر إنجازاً
  const volumeBonus =
    completedCount >= 15 ? 10 :
    completedCount >= 10 ? 7 :
    completedCount >= 5 ? 4 :
    completedCount >= 2 ? 2 : 0;

  return pct((weightedCompletionRate * 0.70) + (weightedProgressRate * 0.30) + volumeBonus);
}

/**
 * احتساب درجة الانضباط وساعات العمل (لأغراض الإحصاءات العامة فقط)
 */
function attendanceScoreOf(att: MetricAttendance[], totalPeriodDays: number = 0) {
  if (!att || att.length === 0) return 0;

  const presentDays = att.filter((a) => a.status === "present" || a.status === "permission").length;
  const leaveDays = att.filter((a) => a.status === "leave").length;
  const absentDays = att.filter((a) => a.status === "absent").length;

  const totalLate = att.reduce((s, a) => s + (a.late_minutes ?? 0), 0);
  const totalEarly = att.reduce((s, a) => s + (a.early_leave_minutes ?? 0), 0);
  const totalOvertime = att.reduce((s, a) => s + (a.overtime_minutes ?? 0), 0);

  const recordedDays = Math.max(att.length, totalPeriodDays || 1);
  const presenceRatio = ((presentDays + leaveDays) / recordedDays) * 100;

  const latePenalty = Math.max(0, totalLate - 15) / 20;
  const earlyPenalty = totalEarly / 20;
  const absentPenalty = absentDays * 10;
  const overtimeBonus = Math.min(5, Math.floor(totalOvertime / 60) * 1);

  return pct(presenceRatio - latePenalty - earlyPenalty - absentPenalty + overtimeBonus);
}

/**
 * احتساب درجة الالتزام بالمواعيد النهائية للمهام
 */
function punctualityScoreOf(tasks: MetricTask[]) {
  if (!tasks || tasks.length === 0) return 0;

  const dueTasks = tasks.filter((t) => t.due_date);
  if (dueTasks.length === 0) {
    const allCompleted = tasks.every((t) => t.status === "completed");
    return allCompleted ? 100 : 80;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  let onTimeCount = 0;
  let overdueCount = 0;

  for (const t of dueTasks) {
    if (t.status === "completed") {
      const doneDate = t.completed_at ? t.completed_at.slice(0, 10) : null;
      if (!doneDate || !t.due_date || doneDate <= t.due_date) {
        onTimeCount++;
      }
    } else if (t.status !== "cancelled" && t.due_date && t.due_date < todayStr) {
      overdueCount++;
    }
  }

  const onTimeRate = (onTimeCount / dueTasks.length) * 100;
  const overduePenalty = overdueCount * 10;

  return pct(onTimeRate - overduePenalty);
}

/**
 * دمج الدرجات: اعتماد معيار المهام بنسبة 100% للوحة الشرف وأفضل موظف
 */
function combine(tasksScore: number, _attendanceScore: number, _punctualityScore: number, _completedTasksCount: number) {
  return tasksScore;
}

/**
 * حساب درجات وأهلية الموظفين للوحة الشرف (بحسب المهام فقط)
 */
export function scoreEmployees(
  employees: MetricEmployee[],
  tasks: MetricTask[],
  attendance: MetricAttendance[],
  unitNameOf: (e: MetricEmployee) => string,
): PerformerScore[] {
  const maxRecordedDays = Math.max(
    1,
    ...employees.map((e) => attendance.filter((a) => a.employee_id === e.id).length),
  );

  return employees.map((e) => {
    const ownTasks = tasks.filter((t) => t.assignee_id === e.id);
    const ownAtt = attendance.filter((a) => a.employee_id === e.id);

    const completedTasks = ownTasks.filter((t) => t.status === "completed").length;
    const tasksScore = tasksScoreOf(ownTasks);
    const attendanceScore = attendanceScoreOf(ownAtt, maxRecordedDays);
    const punctualityScore = punctualityScoreOf(ownTasks);

    const presentDays = ownAtt.filter(
      (a) => a.status === "present" || a.status === "permission",
    ).length;
    const lateMinutes = ownAtt.reduce((s, a) => s + (a.late_minutes ?? 0), 0);
    const overtimeMinutes = ownAtt.reduce((s, a) => s + (a.overtime_minutes ?? 0), 0);

    // الدرجة الإجمالية = درجة المهام 100%
    const score = tasksScore;

    /**
     * شروط الأهلية الصارمة للمنافسة على أفضل موظف ولوحة الشرف (بحسب المهام فقط):
     * 1. إنجاز مهمة فعلية واحدة على الأقل (completedTasks >= 1)
     * 2. تحقيق درجة مهام لا تقل عن 60%
     */
    const isStrictlyEligible = completedTasks >= 1 && score >= 60;

    return {
      id: e.id,
      name: e.full_name,
      subtitle: [e.job_title, unitNameOf(e)].filter(Boolean).join(" — ") || "—",
      totalTasks: ownTasks.length,
      completedTasks,
      tasksScore,
      attendanceScore,
      punctualityScore,
      score,
      grade: gradeFor(score),
      lateMinutes,
      presentDays,
      overtimeMinutes,
      eligible: isStrictlyEligible,
      memberCount: 1,
    };
  });
}

/**
 * تجميع درجات الأداء على مستوى الإدارات والأقسام (بحسب المهام فقط)
 */
export function groupScores(
  scores: PerformerScore[],
  units: { id: string; name: string; subtitle?: string }[],
  memberIdsOf: (unitId: string) => string[],
): PerformerScore[] {
  return units.map((u) => {
    const ids = new Set(memberIdsOf(u.id));
    const members = scores.filter((s) => ids.has(s.id));

    const totalTasks = members.reduce((s, m) => s + m.totalTasks, 0);
    const completedTasks = members.reduce((s, m) => s + m.completedTasks, 0);
    const presentDays = members.reduce((s, m) => s + m.presentDays, 0);
    const lateMinutes = members.reduce((s, m) => s + m.lateMinutes, 0);
    const overtimeMinutes = members.reduce((s, m) => s + (m.overtimeMinutes ?? 0), 0);

    const avg = (pick: (s: PerformerScore) => number) =>
      members.length ? pct(members.reduce((sum, s) => sum + pick(s), 0) / members.length) : 0;

    const tasksScore = avg((s) => s.tasksScore);
    const attendanceScore = avg((s) => s.attendanceScore);
    const punctualityScore = avg((s) => s.punctualityScore);
    const score = tasksScore;

    const isEligible = members.length > 0 && completedTasks >= 1 && score >= 50;

    return {
      id: u.id,
      name: u.name,
      subtitle: u.subtitle ?? `${members.length} موظف`,
      totalTasks,
      completedTasks,
      tasksScore,
      attendanceScore,
      punctualityScore,
      score,
      grade: gradeFor(score),
      lateMinutes,
      presentDays,
      overtimeMinutes,
      eligible: isEligible,
      memberCount: members.length,
    };
  });
}

/**
 * ترتيب المرشحين للوحة الشرف وأفضل موظف (بحسب المهام فقط)
 * التراتبية:
 * 1. عدد المهام المنجزة الفعلية
 * 2. في حال التساوي، يتصدر الموظف بناءً على نسبة إنجاز المهام (نسبة الإتمام من إجمالي المكلف به)
 * 3. درجة جودة وإنجاز المهام الإجمالية
 */
export function rank(scores: PerformerScore[]) {
  if (!scores || scores.length === 0) return [];

  // إعطاء الأولوية التامة للمؤهلين الذين حققوا شروط المهام
  const eligibleScores = scores.filter((s) => s.eligible);
  const pool = eligibleScores.length > 0 ? eligibleScores : scores.filter((s) => s.completedTasks >= 1);
  const targetList = pool.length > 0 ? pool : scores;

  return [...targetList].sort((a, b) => {
    // 1. الأهلية (إنجاز مهام مستوفية للشروط أولاً)
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;

    // 2. عدد المهام المنجزة الفعلية
    if (b.completedTasks !== a.completedTasks) return b.completedTasks - a.completedTasks;

    // 3. في حال تساوي عدد المهام المنجزة، يتصدر الموظف بناءً على نسبة إنجاز المهام
    const rateA = a.totalTasks > 0 ? (a.completedTasks / a.totalTasks) * 100 : 0;
    const rateB = b.totalTasks > 0 ? (b.completedTasks / b.totalTasks) * 100 : 0;
    if (rateB !== rateA) return rateB - rateA;

    // 4. درجة إنجاز المهام الإجمالية
    if (b.score !== a.score) return b.score - a.score;

    // 5. إجمالي المهام المسندة
    return b.totalTasks - a.totalTasks;
  });
}

/**
 * اختيار الفائز بلقب أفضل موظف / إدارة / قسم (بحسب المهام فقط)
 * يشترط أن يكون لديه مهام منجزة فعلية
 */
export function topOf(scores: PerformerScore[]): PerformerScore | null {
  if (!scores || scores.length === 0) return null;
  const ranked = rank(scores);
  const first = ranked[0];
  if (!first || first.completedTasks === 0) {
    const withCompleted = ranked.find((s) => s.completedTasks >= 1);
    return withCompleted ?? null;
  }
  return first;
}
