import { TaskCard } from "./TaskCard";
import type {
  DepartmentLite,
  EmployeeLite,
  GroupedTask,
  SectionLite,
  SubtaskItem,
  TaskRow,
} from "./task-utils";

interface TaskListViewProps {
  tasks: (TaskRow | GroupedTask)[];
  employees: EmployeeLite[];
  departments?: DepartmentLite[] | undefined;
  sections?: SectionLite[] | undefined;
  subtasks?: SubtaskItem[] | undefined;
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
  departments,
  sections,
  subtasks = [],
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
        const taskIds =
          isGrouped && "siblingTasks" in t
            ? (t as GroupedTask).siblingTasks.map((s) => s.id)
            : [t.id];
        const taskSubtasks = subtasks.filter((s) => taskIds.includes(s.task_id));
        const primaryAssignee = employees.find((e) => e.id === t.assignee_id);
        const deptName = departments?.find((d) => d.id === primaryAssignee?.department_id)?.name;
        const secName = sections?.find((s) => s.id === primaryAssignee?.section_id)?.name;
        const unitLabel = deptName && secName ? `${deptName} • ${secName}` : (deptName || secName || null);

        return (
          <TaskCard
            key={t.id}
            task={t}
            subtasks={taskSubtasks}
            assigneeName={nameOf(t.assignee_id)}
            assigneeNames={assigneeNames}
            assignerName={nameOf(t.assigned_by)}
            supervisorName={t.supervisor_id ? nameOf(t.supervisor_id) : null}
            unitLabel={unitLabel}
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
