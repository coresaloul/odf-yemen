import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import { isOverdue, STATUS_ORDER, type GroupedTask, type TaskRow, type TaskStatus } from "./task-utils";
import { Users, ShieldCheck } from "lucide-react";

export function TaskBoard({
  tasks,
  nameOf,
  canManage,
  onStatusChange,
  onOpen,
}: {
  tasks: (TaskRow | GroupedTask)[];
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
                const isGrouped = "isShared" in t && (t as GroupedTask).isShared;
                const assigneeIds = "assignee_ids" in t && (t as GroupedTask).assignee_ids
                  ? (t as GroupedTask).assignee_ids
                  : [t.assignee_id];
                const assigneeNames = assigneeIds.map(nameOf);
                const supervisorName = t.supervisor_id ? nameOf(t.supervisor_id) : null;

                return (
                  <div
                    key={t.id}
                    draggable={canManage}
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                    onClick={() => onOpen?.(t)}
                    className={`cursor-pointer w-full rounded-md border bg-card p-2.5 text-right text-sm shadow-xs transition hover:border-primary/40 ${
                      isOverdue(t) ? "border-destructive/50" : isGrouped ? "border-primary/30 bg-primary/[0.01]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="block font-medium truncate">{t.title}</span>
                      {isGrouped && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-primary/10 text-primary shrink-0">
                          <Users className="size-2.5 mr-0.5" /> {assigneeNames.length}
                        </Badge>
                      )}
                    </div>
                    
                    <span className="mt-1 block text-xs text-muted-foreground truncate">
                      {assigneeNames.join("، ")} — {formatDate(t.due_date)}
                    </span>
                    
                    {supervisorName && (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
                        <ShieldCheck className="size-3" />
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
