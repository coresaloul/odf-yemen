import { usePersistentState } from "@/hooks/usePersistentState";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useBranding } from "@/hooks/useBranding";
import { toast } from "sonner";
import {
  CalendarRange,
  ClipboardList,
  FileText,
  KanbanSquare,
  List,
  Plus,
  Printer,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notifyTaskAssigned, notifyTaskStatusChanged } from "@/lib/task-emails.functions";
import { submitTaskForApproval } from "@/lib/approvals.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import { exportPdf, exportWord, type ReportDoc } from "@/lib/report-export";
import {
  buildTaskAssignedMessage,
  buildTaskUpdatedMessage,
  openWhatsApp,
} from "@/lib/whatsapp";
import { TaskFilters, EMPTY_FILTERS, type TaskFiltersState } from "@/components/tasks/TaskFilters";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskFormDialog, type TaskFormValues } from "@/components/tasks/TaskFormDialog";
import { TaskStats } from "@/components/tasks/TaskStats";
import { VoiceTaskButton } from "@/components/tasks/VoiceTaskButton";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskDeleteDialog } from "@/components/tasks/TaskDeleteDialog";
import {
  PRIORITY_RANK,
  isOverdue,
  nextRecurrenceDates,
  progressForStatus,
  statusForProgress,
  todayIso,
  groupSharedTasks,
  type EmployeeLite,
  type GroupedTask,
  type SubtaskItem,
  type TaskRow,
  type TaskStatus,
} from "@/components/tasks/task-utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "المهام | الموارد البشرية" },
      {
        name: "description",
        content: "تكليف الموظفين بالمهام ومتابعة نسب الإنجاز مع الإضافة الصوتية الذكية.",
      },
      { property: "og:title", content: "المهام | الموارد البشرية" },
      {
        property: "og:description",
        content: "إدارة مهام الموظفين ومتابعة الإنجاز في نظام مدير.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const branding = useBranding();
  const { isManager, isHR, isDirector, employee, user } = useAuth();
  const requestApproval = useServerFn(submitTaskForApproval);
  const needsApproval = (task?: TaskRow | null) =>
    !!task && !isManager && task.assigned_by !== employee?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const openTask = (t: TaskRow) => void navigate({ to: "/tasks/$taskId", params: { taskId: t.id } });
  const sendAssignedEmail = useServerFn(notifyTaskAssigned);
  const sendStatusEmail = useServerFn(notifyTaskStatusChanged);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [initialForm, setInitialForm] = useState<Partial<TaskFormValues> | undefined>(undefined);
  const [viaVoice, setViaVoice] = useState(false);
  const [deleteTask, setDeleteTask] = useState<TaskRow | null>(null);
  const [filters, setFilters] = usePersistentState<TaskFiltersState>("filters", {
    ...EMPTY_FILTERS,
  });
  const [scope, setScope] = usePersistentState<"all" | "mine" | "supervised" | "assigned">(
    "scope",
    "all",
  );
  const [view, setView] = usePersistentState<"list" | "board" | "calendar">("view", "list");

  const { data, isLoading } = useQuery({
    queryKey: ["tasks-page"],
    queryFn: async () => {
      const [tasks, employees, departments, subtasks] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase
          .from("employees")
          .select("id, full_name, department_id, section_id, phone, manager_id")
          .order("full_name"),
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("task_subtasks").select("id, task_id, title, is_done").order("created_at"),
      ]);
      return {
        tasks: (tasks.data ?? []) as TaskRow[],
        employees: (employees.data ?? []) as EmployeeLite[],
        departments: departments.data ?? [],
        subtasks: (subtasks.data ?? []) as SubtaskItem[],
      };
    },
  });

  const tasks = data?.tasks ?? [];
  const employees = data?.employees ?? [];
  const departments = data?.departments ?? [];

  const isDirectManager = employees.some((e) => e.manager_id === employee?.id);
  const canAssignToOthers = isManager || isHR || isDirector || isDirectManager;

  const nameOf = (id: string | null) => employees.find((e) => e.id === id)?.full_name ?? "—";
  const phoneOf = (id: string | null) => employees.find((e) => e.id === id)?.phone ?? null;

  type WaTarget = { phone: string | null; message: string };
  const notifyWhatsApp = (targets: WaTarget[]) => {
    const valid = targets.filter((t) => t.phone);
    if (valid.length === 0) return;
    const opened = openWhatsApp(valid);
    if (opened === 0) {
      toast.info("اسمح بالنوافذ المنبثقة لإرسال إشعار واتساب", {
        action: { label: "إرسال واتساب", onClick: () => openWhatsApp(valid) },
      });
    }
  };

  const sortTasksByPriorityThenDue = (a: TaskRow, b: TaskRow) => {
    const priorityDelta = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    if (priorityDelta !== 0) return priorityDelta;
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  };

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    let list = tasks.filter((t) => {
      if (scope === "mine" && t.assignee_id !== employee?.id) return false;
      if (scope === "supervised" && t.supervisor_id !== employee?.id) return false;
      if (scope === "assigned" && t.assigned_by !== employee?.id) return false;
      if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q)) return false;
      if (filters.status !== "all" && t.status !== filters.status) return false;
      if (filters.priority !== "all" && t.priority !== filters.priority) return false;
      if (filters.assignee !== "all" && t.assignee_id !== filters.assignee) return false;
      if (filters.department !== "all") {
        const emp = employees.find((e) => e.id === t.assignee_id);
        if (emp?.department_id !== filters.department) return false;
      }
      if (filters.from && (!t.due_date || t.due_date < filters.from)) return false;
      if (filters.to && (!t.due_date || t.due_date > filters.to)) return false;
      if (filters.overdueOnly && !isOverdue(t)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (filters.sort === "due") {
        return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
      }
      if (filters.sort === "priority") {
        return sortTasksByPriorityThenDue(a, b);
      }
      return b.created_at.localeCompare(a.created_at);
    });
    return groupSharedTasks(list);
  }, [tasks, employees, filters, scope, employee?.id]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter((t) => t.status === "completed").length;
    const running = filtered.filter((t) => t.status === "in_progress").length;
    const late = filtered.filter(isOverdue).length;
    const avg = total ? Math.round(filtered.reduce((s, t) => s + (t.progress ?? 0), 0) / total) : 0;
    return { total, done, running, late, avg };
  }, [filtered]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tasks-page"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["pending-approvals"] });
  };

  const canManageTask = (t: TaskRow) => isManager || t.assigned_by === employee?.id;
  const canUpdateProgress = (t: TaskRow) => canManageTask(t) || t.assignee_id === employee?.id;

  const save = useMutation({
    mutationFn: async (v: TaskFormValues) => {
      if (editing) {
        const { error } = await supabase
          .from("tasks")
          .update({
            title: v.title.trim(),
            description: v.description || null,
            assignee_id: v.assignee_ids[0]!,
            priority: v.priority as TaskRow["priority"],
            status: v.status as TaskStatus,
            progress: progressForStatus(v.status as TaskStatus, editing.progress),
            start_date: v.start_date || todayIso(),
            due_date: v.due_date || null,
            weight: Number(v.weight) || 1,
            recurrence: v.recurrence === "none" ? null : v.recurrence,
            supervisor_id: v.supervisor_id || null,
            completed_at: v.status === "completed" ? new Date().toISOString() : null,
          })
          .eq("id", editing.id);
        if (error) throw error;
        if (v.assignee_ids[0] !== editing.assignee_id) {
          try {
            await sendAssignedEmail({ data: { taskId: editing.id } });
          } catch {
            /* الإشعار داخل النظام يبقى فعّالاً */
          }
        }
        const assigneeId = v.assignee_ids[0]!;
        const reassigned = assigneeId !== editing.assignee_id;
        const base = {
          title: v.title.trim(),
          description: v.description || null,
          priority: PRIORITY_LABELS[v.priority as TaskRow["priority"]] ?? v.priority,
          dueDate: v.due_date || null,
          assigneeName: nameOf(assigneeId),
          supervisorName: v.supervisor_id ? nameOf(v.supervisor_id) : null,
          statusLabel: TASK_STATUS_LABELS[v.status as TaskStatus] ?? v.status,
        };
        return [
          {
            phone: phoneOf(assigneeId),
            message: reassigned
              ? buildTaskAssignedMessage({ ...base, taskId: editing.id })
              : buildTaskUpdatedMessage({ ...base, taskId: editing.id }),
          },
        ];
      }

      const rows = v.assignee_ids.map((assignee_id) => ({
        title: v.title.trim(),
        description: v.description || null,
        assignee_id,
        priority: v.priority as TaskRow["priority"],
        start_date: v.start_date || todayIso(),
        due_date: v.due_date || null,
        weight: Number(v.weight) || 1,
        recurrence: v.recurrence === "none" ? null : v.recurrence,
        assigned_by: (!canAssignToOthers && employee?.manager_id) ? employee.manager_id : (employee?.id ?? null),
        supervisor_id: v.supervisor_id || null,
        created_via_voice: viaVoice,
      }));
      const { data: inserted, error } = await supabase.from("tasks").insert(rows).select("id");
      if (error) throw error;
      for (const row of inserted ?? []) {
        try {
          await sendAssignedEmail({ data: { taskId: row.id } });
        } catch {
          /* تجاهل أخطاء البريد */
        }
      }
      return v.assignee_ids.map((id, index) => ({
        phone: phoneOf(id),
        message: buildTaskAssignedMessage({
          title: v.title.trim(),
          description: v.description || null,
          priority: PRIORITY_LABELS[v.priority as TaskRow["priority"]] ?? v.priority,
          dueDate: v.due_date || null,
          assigneeName: nameOf(id),
          supervisorName: v.supervisor_id ? nameOf(v.supervisor_id) : null,
          taskId: inserted?.[index]?.id ?? undefined,
        }),
      }));
    },
    onSuccess: (targets) => {
      toast.success(editing ? "تم حفظ التعديلات" : "تم إنشاء المهمة");
      notifyWhatsApp(targets ?? []);
      setFormOpen(false);
      setEditing(null);
      setInitialForm(undefined);
      setViaVoice(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyProgress = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const task = tasks.find((t) => t.id === id);
      if (progress >= 100 && needsApproval(task)) {
        await requestApproval({ data: { taskId: id } });
        await supabase
          .from("task_updates")
          .insert({ task_id: id, progress, created_by: user?.id ?? null });
        return "pending" as const;
      }
      const status = statusForProgress(progress);
      const { error } = await supabase
        .from("tasks")
        .update({
          progress,
          status,
          completed_at: progress >= 100 ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
      await supabase
        .from("task_updates")
        .insert({ task_id: id, progress, created_by: user?.id ?? null });
      if (task && progress >= 100 && task.recurrence && task.recurrence !== "none") {
        const next = nextRecurrenceDates(task.recurrence, task.start_date, task.due_date);
        if (next) {
          await supabase.from("tasks").insert({
            title: task.title,
            description: task.description,
            assignee_id: task.assignee_id,
            assigned_by: task.assigned_by,
            priority: task.priority,
            weight: task.weight,
            recurrence: task.recurrence,
            parent_task_id: task.id,
            start_date: next.start_date,
            due_date: next.due_date,
          });
        }
      }
      try {
        await sendStatusEmail({ data: { taskId: id, progress } });
      } catch {
        /* تجاهل أخطاء البريد */
      }
      return "done" as const;
    },
    onSuccess: (result, vars) => {
      toast.success(result === "pending" ? "أُرسلت المهمة لاعتماد المدير" : "تم تحديث الإنجاز");
      const task = tasks.find((t) => t.id === vars.id);
      if (task && result === "done") {
        notifyWhatsApp([
          {
            phone: phoneOf(task.assignee_id),
            message: buildTaskUpdatedMessage({
              title: task.title,
              dueDate: task.due_date,
              assigneeName: nameOf(task.assignee_id),
              supervisorName: task.supervisor_id ? nameOf(task.supervisor_id) : null,
              statusLabel: TASK_STATUS_LABELS[statusForProgress(vars.progress)],
              progress: vars.progress,
              taskId: task.id,
            }),
          },
        ]);
      }
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ task, status }: { task: TaskRow; status: TaskStatus }) => {
      const progress = progressForStatus(status, task.progress);
      if (status === "completed" && needsApproval(task)) {
        await requestApproval({ data: { taskId: task.id } });
        return "pending" as const;
      }
      const { error } = await supabase
        .from("tasks")
        .update({
          status,
          progress,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", task.id);
      if (error) throw error;
      try {
        await sendStatusEmail({ data: { taskId: task.id, progress } });
      } catch {
        /* تجاهل أخطاء البريد */
      }
      return "done" as const;
    },
    onSuccess: (result, vars) => {
      toast.success(result === "pending" ? "أُرسلت المهمة لاعتماد المدير" : "تم تغيير حالة المهمة");
      if (result === "done") {
        notifyWhatsApp([
          {
            phone: phoneOf(vars.task.assignee_id),
            message: buildTaskUpdatedMessage({
              title: vars.task.title,
              dueDate: vars.task.due_date,
              assigneeName: nameOf(vars.task.assignee_id),
              supervisorName: vars.task.supervisor_id ? nameOf(vars.task.supervisor_id) : null,
              statusLabel: TASK_STATUS_LABELS[vars.status],
              progress: progressForStatus(vars.status, vars.task.progress),
              taskId: vars.task.id,
            }),
          },
        ]);
      }
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (taskOrId: string | TaskRow | GroupedTask) => {
      let ids: string[] = [];
      if (typeof taskOrId === "string") {
        ids = [taskOrId];
      } else if ("siblingTasks" in taskOrId && taskOrId.siblingTasks?.length) {
        ids = taskOrId.siblingTasks.map((t) => t.id);
      } else {
        ids = [taskOrId.id];
      }
      const { error } = await supabase.from("tasks").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف المهمة");
      setDeleteTask(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reportDoc = (): ReportDoc => ({
    title: "تقرير المهام",
    subtitle: "قائمة المهام حسب الفلاتر المحددة",
    meta: [
      { label: "عدد المهام", value: String(stats.total) },
      { label: "المنجزة", value: String(stats.done) },
      { label: "المتأخرة", value: String(stats.late) },
      { label: "متوسط الإنجاز", value: `${stats.avg}%` },
    ],
    sections: [
      {
        table: {
          columns: ["العنوان", "المكلّفون", "المشرف", "الأولوية", "الحالة", "الاستحقاق", "الإنجاز"],
          rows: filtered.map((t) => {
            const isGrouped = "isShared" in t && (t as GroupedTask).isShared;
            const assigneeIds = "assignee_ids" in t && (t as GroupedTask).assignee_ids
              ? (t as GroupedTask).assignee_ids
              : [t.assignee_id];
            const assigneeNames = assigneeIds.map(nameOf).join("، ");
            return [
              t.title + (isGrouped ? " (مشتركة)" : ""),
              assigneeNames,
              t.supervisor_id ? nameOf(t.supervisor_id) : "—",
              PRIORITY_LABELS[t.priority] ?? t.priority,
              TASK_STATUS_LABELS[t.status] ?? t.status,
              formatDate(t.due_date),
              `${t.progress}%`,
            ];
          }),
        },
      },
    ],
    branding: { org_name: branding.org_name, system_name: branding.system_name, logoUrl: branding.logoUrl },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="المهام"
        description="تكليف الموظفين، متابعة الإنجاز، المهام الفرعية والمرفقات"
        action={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportWord(reportDoc(), "تقرير-المهام")}
            >
              <FileText className="size-4" /> Word
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportPdf(reportDoc())}>
              <Printer className="size-4" /> PDF
            </Button>
            {isManager && (
              <VoiceTaskButton
                employees={employees}
                onParsed={(p) => {
                  setEditing(null);
                  setInitialForm({
                    title: p.title,
                    description: p.description ?? "",
                    assignee_ids: p.assignee_id ? [p.assignee_id] : [],
                    priority: p.priority,
                    due_date: p.due_date ?? "",
                  });
                  setViaVoice(true);
                  setFormOpen(true);
                }}
              />
            )}
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setInitialForm(undefined);
                setViaVoice(false);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> مهمة جديدة
            </Button>
          </>
        }
      />

      <TaskStats
        total={stats.total}
        running={stats.running}
        done={stats.done}
        late={stats.late}
        avg={stats.avg}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <TabsList>
            <TabsTrigger value="all">كل المهام</TabsTrigger>
            <TabsTrigger value="mine">مهامي</TabsTrigger>
            <TabsTrigger value="supervised">تحت إشرافي</TabsTrigger>
            <TabsTrigger value="assigned">كلّفت بها</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={view === "list" ? "default" : "outline"}
            onClick={() => setView("list")}
          >
            <List className="size-4" /> قائمة
          </Button>
          <Button
            size="sm"
            variant={view === "board" ? "default" : "outline"}
            onClick={() => setView("board")}
          >
            <KanbanSquare className="size-4" /> لوحة
          </Button>
          <Button
            size="sm"
            variant={view === "calendar" ? "default" : "outline"}
            onClick={() => setView("calendar")}
          >
            <CalendarRange className="size-4" /> تقويم
          </Button>
        </div>
      </div>

      <TaskFilters
        value={filters}
        onChange={setFilters}
        employees={employees}
        departments={departments}
      />

      {isLoading && <ListSkeleton rows={4} />}
      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="لا توجد مهام مطابقة"
          description="جرّب تعديل الفلاتر أو أنشئ مهمة جديدة لبدء المتابعة."
        />
      )}

      {!isLoading && filtered.length > 0 && view === "board" && (
        <TaskBoard
          tasks={filtered}
          nameOf={nameOf}
          canManage={isManager}
          onOpen={openTask}
          onStatusChange={(task, status) => changeStatus.mutate({ task, status })}
        />
      )}

      {!isLoading && filtered.length > 0 && view === "calendar" && (
        <TaskCalendarView tasks={filtered} onOpenTask={openTask} />
      )}

      {view === "list" && (
        <TaskListView
          tasks={filtered}
          employees={employees}
          subtasks={data?.subtasks ?? []}
          canManageTask={canManageTask}
          canUpdateProgress={canUpdateProgress}
          onOpen={openTask}
          onEdit={(t) => {
            setEditing(t);
            setFormOpen(true);
          }}
          onDelete={setDeleteTask}
          onProgress={(id, progress) => applyProgress.mutate({ id, progress })}
        />
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
        employees={employees}
        editing={editing}
        {...(initialForm ? { initial: initialForm } : {})}
        saving={save.isPending}
        onSubmit={(values) => save.mutate(values)}
      />

      <TaskDeleteDialog
        task={deleteTask}
        open={!!deleteTask}
        onOpenChange={(v) => !v && setDeleteTask(null)}
        onConfirm={() => deleteTask && remove.mutate(deleteTask.id)}
      />
    </div>
  );
}
