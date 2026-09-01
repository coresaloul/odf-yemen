import type { Database } from "@/integrations/supabase/types";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];

export interface GroupedTask extends TaskRow {
  isShared: boolean;
  assignee_ids: string[];
  siblingTasks: TaskRow[];
  averageProgress: number;
}

export type SubtaskLite = {
  is_done?: boolean | null;
};

export type SubtaskItem = {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean | null;
};

/** ملخص المهام الفرعية لمجموعة مهام (تشمل الأشقاء في المهمة المشتركة) */
export function subtasksForTask(
  subtasks: SubtaskItem[],
  taskIds: string[],
): { items: SubtaskItem[]; done: number; total: number } {
  const ids = new Set(taskIds);
  const items = subtasks.filter((s) => ids.has(s.task_id));
  const done = items.filter((s) => s.is_done).length;
  return { items, done, total: items.length };
}

export type EmployeeLite = {
  id: string;
  full_name: string;
  department_id: string | null;
  section_id: string | null;
  manager_id?: string | null;
  phone?: string | null;
};

export const STATUS_ORDER: TaskStatus[] = [
  "new",
  "in_progress",
  "pending_approval",
  "completed",
  "cancelled",
];

export const RECURRENCE_LABELS: Record<string, string> = {
  none: "بدون تكرار",
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
};

export const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function isOverdue(t: Pick<TaskRow, "due_date" | "status">) {
  if (!t.due_date) return false;
  if (t.status === "completed" || t.status === "cancelled" || t.status === "pending_approval")
    return false;
  const today = new Date().toISOString().slice(0, 10);
  return t.due_date < today;
}

export function progressFromSubtasks(subtasks: SubtaskLite[]) {
  if (!subtasks.length) return 0;
  const done = subtasks.filter((subtask) => subtask.is_done).length;
  return Math.round((done / subtasks.length) * 100);
}

export function statusFromSubtasks(progress: number): TaskStatus {
  if (progress >= 100) return "pending_approval";
  if (progress > 0) return "in_progress";
  return "new";
}

export function statusForProgress(progress: number): TaskStatus {
  if (progress >= 100) return "completed";
  if (progress > 0) return "in_progress";
  return "new";
}

export function progressForStatus(status: TaskStatus, current: number) {
  if (status === "completed") return 100;
  if (status === "new") return 0;
  if (status === "in_progress" && (current === 0 || current >= 100)) return current >= 100 ? 90 : 10;
  return current;
}

export function nextRecurrenceDates(
  recurrence: string,
  startDate: string,
  dueDate: string | null,
): { start_date: string; due_date: string | null } | null {
  const step = (iso: string) => {
    const d = new Date(iso);
    if (recurrence === "daily") d.setDate(d.getDate() + 1);
    else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
    else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
    else return null;
    return d.toISOString().slice(0, 10);
  };
  const nextStart = step(startDate);
  if (!nextStart) return null;
  return { start_date: nextStart, due_date: dueDate ? step(dueDate) : null };
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function groupSharedTasks(tasks: TaskRow[]): GroupedTask[] {
  const groups: Map<string, TaskRow[]> = new Map();

  for (const task of tasks) {
    const createdPrefix = task.created_at ? task.created_at.slice(0, 16) : "";
    const key = [
      (task.title || "").trim().toLowerCase(),
      (task.description || "").trim().toLowerCase(),
      task.start_date || "",
      task.due_date || "",
      task.assigned_by || "",
      task.supervisor_id || "",
      createdPrefix,
    ].join("||");

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(task);
  }

  const result: GroupedTask[] = [];

  for (const [, group] of groups.entries()) {
    if (group.length === 1) {
      const single = group[0]!;
      result.push({
        ...single,
        isShared: false,
        assignee_ids: [single.assignee_id],
        siblingTasks: group,
        averageProgress: Number(single.progress ?? 0),
      });
    } else {
      const primary = group[0]!;
      const totalProgress = group.reduce((acc, t) => acc + (Number(t.progress) || 0), 0);
      const averageProgress = Math.round(totalProgress / group.length);
      const assignee_ids = Array.from(new Set(group.map((t) => t.assignee_id)));

      let overallStatus: TaskStatus = primary.status;
      if (group.every((t) => t.status === "completed")) {
        overallStatus = "completed";
      } else if (group.some((t) => t.status === "in_progress" || t.status === "pending_approval")) {
        overallStatus = "in_progress";
      }

      result.push({
        ...primary,
        status: overallStatus,
        progress: averageProgress,
        isShared: true,
        assignee_ids,
        siblingTasks: group,
        averageProgress,
      });
    }
  }

  return result;
}
