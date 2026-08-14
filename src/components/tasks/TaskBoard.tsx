import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import { isOverdue, STATUS_ORDER, type TaskRow, type TaskStatus } from "./task-utils";

export function TaskBoard({
  tasks,
  nameOf,
  canManage,
  onStatusChange,
  onOpen,
}: {
  tasks: TaskRow[];
  nameOf: (id: string | null) => string;
  canManage: boolean;
  onStatusChange: (task: TaskRow, status: TaskStatus) => void;
  onOpen?: (task: TaskRow) => void;
}) {
  return (
    <div className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
      {STATUS_ORDER.map((status) => {
        const column = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            className="w-[78vw] shrink-0 snap-start rounded-lg border bg-muted/30 p-2 sm:w-64 md:w-auto md:shrink"
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
              {column.map((t) => {
                const supervisorName = t.supervisor_id ? nameOf(t.supervisor_id) : null;
                return (
                  <div
                    key={t.id}
                    draggable={canManage}
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                    onClick={() => onOpen?.(t)}
                    className={`cursor-pointer w-full rounded-md border bg-card p-2 text-right text-sm shadow-sm transition ${
                      isOverdue(t) ? "border-destructive/50" : ""
                    }`}
                  >
                    <span className="block font-medium">{t.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {nameOf(t.assignee_id)} — {formatDate(t.due_date)} — {t.progress}%
                    </span>
                    {supervisorName && (
                      <span className="mt-1 block text-[11px] font-medium text-primary">
                        المشرف: {supervisorName}
                      </span>
                    )}
                  </div>
                );
              })}
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
