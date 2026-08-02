import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import { isOverdue, STATUS_ORDER, type TaskRow, type TaskStatus } from "./task-utils";

export function TaskBoard({
  tasks,
  nameOf,
  canManage,
  onOpen,
  onStatusChange,
}: {
  tasks: TaskRow[];
  nameOf: (id: string | null) => string;
  canManage: boolean;
  onOpen: (task: TaskRow) => void;
  onStatusChange: (task: TaskRow, status: TaskStatus) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {STATUS_ORDER.map((status) => {
        const column = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            className="rounded-lg border bg-muted/30 p-2"
            onDragOver={(e) => {
              if (canManage) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/task-id");
              const task = tasks.find((t) => t.id === id);
              if (task && task.status !== status) onStatusChange(task, status);
            }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</span>
              <Badge variant="secondary">{column.length}</Badge>
            </div>
            <div className="space-y-2">
              {column.map((t) => (
                <button
                  key={t.id}
                  draggable={canManage}
                  onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                  onClick={() => onOpen(t)}
                  className={`w-full rounded-md border bg-card p-2 text-right text-sm shadow-sm transition hover:shadow ${
                    isOverdue(t) ? "border-destructive/50" : ""
                  }`}
                >
                  <span className="block font-medium">{t.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {nameOf(t.assignee_id)} — {formatDate(t.due_date)} — {t.progress}%
                  </span>
                </button>
              ))}
              {column.length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">لا توجد مهام</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
