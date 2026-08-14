import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { submitTaskForApproval } from "@/lib/approvals.functions";
import { notifyTaskStatusChanged } from "@/lib/task-emails.functions";
import { nextRecurrenceDates, statusForProgress, type TaskRow } from "./task-utils";

/** تحديث نسبة الإنجاز مع مراعاة الاعتماد والتكرار — مشترك بين قائمة المهام وصفحة التفاصيل */
export function useApplyTaskProgress(getTask: (id: string) => TaskRow | undefined) {
  const { isManager, employee, user } = useAuth();
  const qc = useQueryClient();
  const requestApproval = useServerFn(submitTaskForApproval);
  const sendStatusEmail = useServerFn(notifyTaskStatusChanged);

  const needsApproval = (task?: TaskRow | null) =>
    !!task && !isManager && task.assigned_by !== employee?.id;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tasks-page"] });
    void qc.invalidateQueries({ queryKey: ["task-page"] });
    void qc.invalidateQueries({ queryKey: ["task-detail"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["pending-approvals"] });
  };

  return useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const task = getTask(id);
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
            supervisor_id: task.supervisor_id,
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
      toast.success(result === "pending" ? "أُرسلت المهمة لاعتماد المدير" : "تم تحديث الإنجاز");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
