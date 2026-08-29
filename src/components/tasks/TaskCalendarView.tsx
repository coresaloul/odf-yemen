import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import {
  PRIORITY_RANK,
  isOverdue,
  type GroupedTask,
  type TaskRow,
} from "@/components/tasks/task-utils";

interface TaskCalendarViewProps {
  tasks: (TaskRow | GroupedTask)[];
  onOpenTask: (task: TaskRow) => void;
}

const sortTasksByPriorityThenDue = (a: TaskRow, b: TaskRow) => {
  const priorityDelta = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
  if (priorityDelta !== 0) return priorityDelta;
  return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
};

const taskCalendarTone = (task: TaskRow) => {
  if (isOverdue(task)) {
    return "border-red-600/40 bg-red-500/10 text-red-800 dark:text-red-200";
  }

  switch (task.status) {
    case "completed":
      return "border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
    case "pending_approval":
      return "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
    case "in_progress":
      return "border-sky-600/40 bg-sky-500/10 text-sky-800 dark:text-sky-200";
    case "cancelled":
      return "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-200";
    default:
      return "border-violet-600/40 bg-violet-500/10 text-violet-800 dark:text-violet-200";
  }
};

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function TaskCalendarView({ tasks, onOpenTask }: TaskCalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(start.getDate() - firstDay.getDay());
    const cells: Date[] = [];
    for (let index = 0; index < 42; index += 1) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + index);
      cells.push(cell);
    }
    return cells;
  }, [calendarMonth]);

  const tasksForDay = (day: Date) => {
    const target = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    return tasks
      .filter((task) => {
        const taskStart = task.start_date
          ? new Date(`${task.start_date}T00:00:00`)
          : new Date(task.created_at);
        const taskEnd = task.due_date ? new Date(`${task.due_date}T00:00:00`) : taskStart;
        return target >= taskStart && target <= taskEnd;
      })
      .sort((a, b) => sortTasksByPriorityThenDue(a, b));
  };

  return (
    <>
      <div className="space-y-4 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setCalendarMonth(
                new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1),
              )
            }
          >
            السابق
          </Button>
          <div className="text-sm font-semibold text-foreground">
            {new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(
              calendarMonth,
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setCalendarMonth(
                new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1),
              )
            }
          >
            التالي
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="rounded-md bg-muted/60 px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground"
            >
              {weekday}
            </div>
          ))}

          {calendarDays.map((day) => {
            const dayTasks = tasksForDay(day);
            const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <div
                key={day.toISOString()}
                className={[
                  "min-h-[150px] rounded-lg border p-2 text-right transition-colors",
                  isCurrentMonth ? "border-border bg-background" : "border-muted bg-muted/20",
                  isToday ? "ring-2 ring-primary/70 ring-offset-1 ring-offset-background" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={[
                    "mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition hover:scale-105",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {day.getDate()}
                </button>

                <div className="space-y-1.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onOpenTask(task)}
                      className={[
                        "w-full rounded-md border px-2 py-1.5 text-right text-[10px] shadow-sm transition hover:opacity-90",
                        taskCalendarTone(task),
                      ].join(" ")}
                      title={`${task.title} (${formatDate(task.start_date)} - ${formatDate(task.due_date)})`}
                    >
                      <div className="truncate font-medium">{task.title}</div>
                      <div className="mt-0.5 text-[9px] opacity-80">
                        {formatDate(task.start_date)} → {formatDate(task.due_date)}
                      </div>
                    </button>
                  ))}

                  {dayTasks.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className="w-full rounded-md px-1 py-1 text-right text-[10px] text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                    >
                      +{dayTasks.length - 3} مهام إضافية
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent dir="rtl" className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDay
                ? `المهام في ${new Intl.DateTimeFormat("ar-EG", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(selectedDay)}`
                : "المهام"}
            </DialogTitle>
            <DialogDescription>
              جميع المهام المرتبطة بهذا اليوم، مع حالة كل مهمة وتاريخها.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {selectedDay && tasksForDay(selectedDay).length > 0 ? (
              tasksForDay(selectedDay).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    setSelectedDay(null);
                    onOpenTask(task);
                  }}
                  className={[
                    "flex w-full flex-col rounded-md border px-3 py-2 text-right transition hover:bg-muted/50",
                    taskCalendarTone(task),
                  ].join(" ")}
                >
                  <span className="font-medium">{task.title}</span>
                  <span className="mt-1 text-[10px] opacity-80">
                    {TASK_STATUS_LABELS[task.status] ?? task.status} • {formatDate(task.start_date)} →{" "}
                    {formatDate(task.due_date)}
                  </span>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد مهام لهذا اليوم.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
