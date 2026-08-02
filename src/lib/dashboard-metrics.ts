/** حسابات لوحة المعلومات: درجات الأداء وترتيب الموظفين والوحدات */

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
  progress: number;
  due_date: string | null;
  completed_at: string | null;
};

export type MetricAttendance = {
  employee_id: string;
  work_date: string;
  status: string;
  late_minutes: number;
  early_leave_minutes: number;
  permission_minutes: number;
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
  eligible: boolean;
  memberCount: number;
};

const pct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** نسبة إنجاز المهام: متوسط التقدم مع وزن للمهام المنجزة */
function tasksScoreOf(tasks: MetricTask[]) {
  if (tasks.length === 0) return 0;
  const avgProgress = tasks.reduce((s, t) => s + (t.progress ?? 0), 0) / tasks.length;
  const completionRate =
    (tasks.filter((t) => t.status === "completed").length / tasks.length) * 100;
  return pct(avgProgress * 0.4 + completionRate * 0.6);
}

/** الالتزام بالمواعيد: نسبة المهام المنجزة في موعدها من المهام المستحقة */
function punctualityScoreOf(tasks: MetricTask[]) {
  const due = tasks.filter((t) => t.due_date);
  if (due.length === 0) return 100;
  const onTime = due.filter((t) => {
    if (t.status !== "completed") return false;
    const done = t.completed_at ? t.completed_at.slice(0, 10) : null;
    return !done || !t.due_date || done <= t.due_date;
  }).length;
  return pct((onTime / due.length) * 100);
}

function combine(tasksScore: number, attendanceScore: number, punctuality: number) {
  return pct(tasksScore * 0.5 + attendanceScore * 0.3 + punctuality * 0.2);
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
    const attendanceScore = att.length ? complianceScore(att) : 0;
    const punctualityScore = punctualityScoreOf(own);
    const presentDays = att.filter(
      (a) => a.status === "present" || a.status === "permission",
    ).length;
    const completedTasks = own.filter((t) => t.status === "completed").length;
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
      lateMinutes: att.reduce((s, a) => s + (a.late_minutes ?? 0), 0),
      presentDays,
      eligible: completedTasks >= 1 || presentDays >= 3,
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
      lateMinutes: members.reduce((s, m) => s + m.lateMinutes, 0),
      presentDays,
      eligible: members.length > 0 && (completedTasks >= 1 || presentDays >= 3),
      memberCount: members.length,
    };
  });
}

export function rank(scores: PerformerScore[]) {
  return [...scores]
    .filter((s) => s.eligible)
    .sort((a, b) => b.score - a.score || b.completedTasks - a.completedTasks);
}

export function topOf(scores: PerformerScore[]): PerformerScore | null {
  return rank(scores)[0] ?? null;
}
