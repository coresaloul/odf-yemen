import { TaskCard } from "./TaskCard";
import type { EmployeeLite, GroupedTask, TaskRow } from "./task-utils";

interface TaskListViewProps {
  tasks: (TaskRow | GroupedTask)[];
  employees: EmployeeLite[];
  canManageTask: (t: TaskRow) => boolean;
  canUpdateProgress: (t: TaskRow) => boolean;
  onOpen: (t: TaskRow) => void;
  onEdit: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
  onProgress: (id: string, progress: number) => void;
}

export function TaskListView({
  tasks,
  employees,
  canManageTask,
  canUpdateProgress,
  onOpen,
  onEdit,
  onDelete,
  onProgress,
}: TaskListViewProps) {
  const nameOf = (id: string | null) => employees.find((e) => e.id === id)?.full_name ?? "—";
  const phoneOf = (id: string | null) => employees.find((e) => e.id === id)?.phone ?? null;

  return (
    <div className="space-y-3">
      {tasks.map((t) => {
        const isGrouped = "isShared" in t && (t as GroupedTask).isShared;
        const assigneeIds = "assignee_ids" in t && (t as GroupedTask).assignee_ids
          ? (t as GroupedTask).assignee_ids
          : [t.assignee_id];
        const assigneeNames = assigneeIds.map(nameOf);

        return (
          <TaskCard
            key={t.id}
            task={t}
            assigneeName={nameOf(t.assignee_id)}
            assigneeNames={assigneeNames}
            assignerName={nameOf(t.assigned_by)}
            supervisorName={t.supervisor_id ? nameOf(t.supervisor_id) : null}
            isShared={isGrouped}
            canManage={canManageTask(t)}
            canUpdateProgress={canUpdateProgress(t)}
            assigneePhone={phoneOf(t.assignee_id)}
            onOpen={() => onOpen(t)}
            onEdit={() => onEdit(t)}
            onDelete={() => onDelete(t)}
            onProgress={(progress) => onProgress(t.id, progress)}
          />
        );
      })}
    </div>
  );
}
