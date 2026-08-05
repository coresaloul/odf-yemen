import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, KanbanSquare, List, Loader2, Mic, Plus, Printer, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { parseVoiceTask } from "@/lib/voice-task.functions";
import { notifyTaskAssigned, notifyTaskStatusChanged } from "@/lib/task-emails.functions";
import { submitTaskForApproval } from "@/lib/approvals.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import { exportPdf, exportWord, type ReportDoc } from "@/lib/report-export";
import { TaskFilters, EMPTY_FILTERS, type TaskFiltersState } from "@/components/tasks/TaskFilters";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskFormDialog, type TaskFormValues } from "@/components/tasks/TaskFormDialog";
import { TaskDetailsDialog } from "@/components/tasks/TaskDetailsDialog";
import {
  PRIORITY_RANK,
  isOverdue,
  nextRecurrenceDates,
  progressForStatus,
  statusForProgress,
  todayIso,
  type EmployeeLite,
  type TaskRow,
  type TaskStatus,
} from "@/components/tasks/task-utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "المهام | الموارد البشرية" },
      { name: "description", content: "تكليف الموظفين بالمهام ومتابعة نسب الإنجاز مع الإضافة الصوتية الذكية." },
      { property: "og:title", content: "المهام | الموارد البشرية" },
      { property: "og:description", content: "إدارة مهام الموظفين ومتابعة الإنجاز في مؤسسة اليتيم التنموية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const { isManager, employee, user } = useAuth();
  const requestApproval = useServerFn(submitTaskForApproval);
  /** المكلَّف نفسه لا يعتمد إنجازه — يُرسل للاعتماد */
  const needsApproval = (task?: TaskRow | null) =>
    !!task && !isManager && task.assigned_by !== employee?.id;
  const qc = useQueryClient();
  const sendAssignedEmail = useServerFn(notifyTaskAssigned);
  const sendStatusEmail = useServerFn(notifyTaskStatusChanged);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [initialForm, setInitialForm] = useState<Partial<TaskFormValues> | undefined>(undefined);
  const [viaVoice, setViaVoice] = useState(false);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [deleteTask, setDeleteTask] = useState<TaskRow | null>(null);
  const [filters, setFilters] = useState<TaskFiltersState>({ ...EMPTY_FILTERS });
  const [scope, setScope] = useState<"all" | "mine" | "assigned">("all");
  const [view, setView] = useState<"list" | "board">("list");

  const { data, isLoading } = useQuery({
    queryKey: ["tasks-page"],
    queryFn: async () => {
      const [tasks, employees, departments] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("employees").select("id, full_name, department_id, section_id").order("full_name"),
        supabase.from("departments").select("id, name").order("name"),
      ]);
      return {
        tasks: (tasks.data ?? []) as TaskRow[],
        employees: (employees.data ?? []) as EmployeeLite[],
        departments: departments.data ?? [],
      };
    },
  });

  const tasks = data?.tasks ?? [];
  const employees = data?.employees ?? [];
  const departments = data?.departments ?? [];
  const nameOf = (id: string | null) => employees.find((e) => e.id === id)?.full_name ?? "—";

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    let list = tasks.filter((t) => {
      if (scope === "mine" && t.assignee_id !== employee?.id) return false;
      if (scope === "assigned" && t.assigned_by !== employee?.id) return false;
      if (q && !(`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q))) return false;
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
        return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      }
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
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
        return;
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
        assigned_by: employee?.id ?? null,
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
    },
    onSuccess: () => {
      toast.success(editing ? "تم حفظ التعديلات" : "تم إنشاء المهمة");
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
        await supabase.from("task_updates").insert({ task_id: id, progress, created_by: user?.id ?? null });
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
      await supabase.from("task_updates").insert({ task_id: id, progress, created_by: user?.id ?? null });
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
    onSuccess: (result) => {
      toast.success(
        result === "pending" ? "أُرسلت المهمة لاعتماد المدير" : "تم تحديث الإنجاز",
      );
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
    onSuccess: (result) => {
      toast.success(
        result === "pending" ? "أُرسلت المهمة لاعتماد المدير" : "تم تغيير حالة المهمة",
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
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
          columns: ["العنوان", "المكلّف", "الأولوية", "الحالة", "الاستحقاق", "الإنجاز"],
          rows: filtered.map((t) => [
            t.title,
            nameOf(t.assignee_id),
            PRIORITY_LABELS[t.priority] ?? t.priority,
            TASK_STATUS_LABELS[t.status] ?? t.status,
            formatDate(t.due_date),
            `${t.progress}%`,
          ]),
        },
      },
    ],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="المهام"
        description="تكليف الموظفين، متابعة الإنجاز، المهام الفرعية والمرفقات"
        action={
          <>
            <Button size="sm" variant="outline" onClick={() => exportWord(reportDoc(), "تقرير-المهام")}>
              <FileText className="size-4" /> Word
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportPdf(reportDoc())}>
              <Printer className="size-4" /> PDF
            </Button>
            {isManager && (
              <>
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
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="إجمالي المهام" value={stats.total} />
        <StatCard label="قيد التنفيذ" value={stats.running} />
        <StatCard label="منجزة" value={stats.done} />
        <StatCard label="متأخرة" value={stats.late} tone="danger" />
        <StatCard label="متوسط الإنجاز" value={`${stats.avg}%`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <TabsList>
            <TabsTrigger value="all">كل المهام</TabsTrigger>
            <TabsTrigger value="mine">مهامي</TabsTrigger>
            <TabsTrigger value="assigned">كلّفت بها</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-1">
          <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>
            <List className="size-4" /> قائمة
          </Button>
          <Button size="sm" variant={view === "board" ? "default" : "outline"} onClick={() => setView("board")}>
            <KanbanSquare className="size-4" /> لوحة
          </Button>
        </div>
      </div>

      <TaskFilters value={filters} onChange={setFilters} employees={employees} departments={departments} />

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
          onOpen={setDetailTask}
          onStatusChange={(task, status) => changeStatus.mutate({ task, status })}
        />
      )}

      {view === "list" && (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              assigneeName={nameOf(t.assignee_id)}
              assignerName={nameOf(t.assigned_by)}
              canManage={canManageTask(t)}
              canUpdateProgress={canUpdateProgress(t)}
              onOpen={() => setDetailTask(t)}
              onEdit={() => {
                setEditing(t);
                setFormOpen(true);
              }}
              onDelete={() => setDeleteTask(t)}
              onProgress={(progress) => applyProgress.mutate({ id: t.id, progress })}
            />
          ))}
        </div>
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

      <TaskDetailsDialog
        task={detailTask}
        onOpenChange={(v) => !v && setDetailTask(null)}
        assigneeName={nameOf(detailTask?.assignee_id ?? null)}
        assignerName={nameOf(detailTask?.assigned_by ?? null)}
        canManage={detailTask ? canManageTask(detailTask) : false}
        onProgress={(progress) => detailTask && applyProgress.mutate({ id: detailTask.id, progress })}
      />

      <AlertDialog open={!!deleteTask} onOpenChange={(v) => !v && setDeleteTask(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المهمة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف «{deleteTask?.title}» مع كل تحديثاتها ومرفقاتها. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTask && remove.mutate(deleteTask.id)}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function VoiceTaskButton({
  employees,
  onParsed,
}: {
  employees: { id: string; full_name: string }[];
  onParsed: (p: {
    title: string;
    description: string | null;
    assignee_id: string | null;
    priority: string;
    due_date: string | null;
  }) => void;
}) {
  const { recording, start, stop } = useVoiceRecorder();
  const [busy, setBusy] = useState(false);
  const parse = useServerFn(parseVoiceTask);

  const handle = async () => {
    if (!recording) {
      try {
        await start();
        toast.info("جارٍ التسجيل… تحدث بالمهمة ثم اضغط إيقاف");
      } catch {
        toast.error("تعذر الوصول إلى الميكروفون");
      }
      return;
    }

    const blob = await stop();
    if (!blob) {
      toast.error("التسجيل فارغ، حاول مرة أخرى");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "recording.wav");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("انتهت الجلسة، سجّل الدخول مجدداً");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !json.text) throw new Error(json.error ?? "تعذر تفريغ التسجيل");

      const parsed = await parse({
        data: { transcript: json.text, employees: employees.map((e) => e.full_name) },
      });
      const match = employees.find((e) => e.full_name === parsed.assignee_name);
      onParsed({
        title: parsed.title,
        description: parsed.description,
        assignee_id: match?.id ?? null,
        priority: parsed.priority,
        due_date: parsed.due_date,
      });
      toast.success("تم استخراج بيانات المهمة، راجعها قبل الحفظ");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant={recording ? "destructive" : "outline"} onClick={handle} disabled={busy}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : recording ? (
        <Square className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
      {busy ? "جارٍ التحليل…" : recording ? "إيقاف التسجيل" : "مهمة بالصوت"}
    </Button>
  );
}
