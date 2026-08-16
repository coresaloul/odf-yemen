import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { ListSkeleton } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ClipboardList } from "lucide-react";
import { TaskDetailsPanel } from "@/components/tasks/TaskDetailsPanel";
import { useApplyTaskProgress } from "@/components/tasks/use-task-progress";
import type { EmployeeLite, TaskRow } from "@/components/tasks/task-utils";

export const Route = createFileRoute("/_authenticated/tasks_/$taskId")({
  head: () => ({
    meta: [
      { title: "تفاصيل المهمة | الموارد البشرية" },
      {
        name: "description",
        content: "استعراض تفاصيل المهمة وسجل المتابعة والمهام الفرعية والمرفقات والمشرف عليها.",
      },
      { property: "og:title", content: "تفاصيل المهمة | الموارد البشرية" },
      {
        property: "og:description",
        content: "متابعة تفاصيل المهمة ونسبة الإنجاز والمشرف على التنفيذ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TaskDetailsPage,
});

function TaskDetailsPage() {
  const { taskId } = Route.useParams();
  const navigate = useNavigate();
  const { isManager, employee } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["task-page", taskId],
    queryFn: async () => {
      const [task, employees] = await Promise.all([
        supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
        supabase
          .from("employees")
          .select("id, full_name, department_id, section_id, phone")
          .order("full_name"),
      ]);
      return {
        task: (task.data ?? null) as TaskRow | null,
        employees: (employees.data ?? []) as EmployeeLite[],
      };
    },
  });

  const task = data?.task ?? null;
  const employees = data?.employees ?? [];
  const nameOf = (id: string | null) => employees.find((e) => e.id === id)?.full_name ?? "—";

  const applyProgress = useApplyTaskProgress(() => task ?? undefined);

  const canManage = !!task && (isManager || task.assigned_by === employee?.id);
  const canUpdateProgress = !!task && (canManage || task.assignee_id === employee?.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title={task?.title ?? "تفاصيل المهمة"}
        description="متابعة تفاصيل المهمة والمشرف عليها ونسبة الإنجاز."
        action={
          <Button variant="outline" onClick={() => void navigate({ to: "/tasks" })}>
            <ArrowRight className="size-4" /> رجوع إلى المهام
          </Button>
        }
      />

      {isLoading && <ListSkeleton rows={3} />}

      {!isLoading && !task && (
        <EmptyState
          icon={ClipboardList}
          title="المهمة غير موجودة"
          description="ربما تم حذف المهمة أو لا تملك صلاحية عرضها."
        />
      )}

      {task && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <TaskDetailsPanel
              task={task}
              assigneeName={nameOf(task.assignee_id)}
              assignerName={nameOf(task.assigned_by)}
              supervisorName={task.supervisor_id ? nameOf(task.supervisor_id) : null}
              canManage={canManage}
              canUpdateProgress={canUpdateProgress}
              onProgress={(progress) => applyProgress.mutate({ id: task.id, progress })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
