import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MessageCircle } from "lucide-react";
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
import {
  getManagedDepartmentIds,
  getManagedSectionIds,
  getSupervisedEmployeeIds,
  isTaskSupervisedBy,
  type DepartmentLite,
  type EmployeeLite,
  type SectionLite,
  type TaskRow,
} from "@/components/tasks/task-utils";
import { PRIORITY_LABELS } from "@/lib/hr";
import { buildTaskAssignedMessage, waLink } from "@/lib/whatsapp";

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
  const { isManager, isHR, isDirector, employee } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["task-page", taskId],
    queryFn: async () => {
      const [taskRes, employeesRes, departmentsRes, sectionsRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
        supabase
          .from("employees")
          .select("id, full_name, department_id, section_id, phone, manager_id")
          .order("full_name"),
        supabase.from("departments").select("id, name, manager_id"),
        supabase.from("sections").select("id, name, department_id, manager_id"),
      ]);


      const currentTask = (taskRes.data ?? null) as TaskRow | null;
      let siblingTasks: TaskRow[] = [];

      if (currentTask) {
        const { data: siblings } = await supabase
          .from("tasks")
          .select("*")
          .eq("title", currentTask.title)
          .eq("start_date", currentTask.start_date);

        if (siblings && siblings.length > 1) {
          const currentPrefix = currentTask.created_at ? currentTask.created_at.slice(0, 16) : "";
          siblingTasks = siblings.filter((s) => {
            const sPrefix = s.created_at ? s.created_at.slice(0, 16) : "";
            return (
              (s.description || "").trim().toLowerCase() === (currentTask.description || "").trim().toLowerCase() &&
              s.supervisor_id === currentTask.supervisor_id &&
              s.assigned_by === currentTask.assigned_by &&
              sPrefix === currentPrefix
            );
          });
        }
      }

      return {
        task: currentTask,
        employees: (employeesRes.data ?? []) as EmployeeLite[],
        departments: (departmentsRes.data ?? []) as DepartmentLite[],
        sections: (sectionsRes.data ?? []) as SectionLite[],
        siblingTasks,
      };
    },
  });

  const task = data?.task ?? null;
  const employees = data?.employees ?? [];
  const departments = data?.departments ?? [];
  const sections = data?.sections ?? [];
  const siblingTasks = data?.siblingTasks ?? [];

  const managedDeptIds = useMemo(() => {
    return getManagedDepartmentIds(departments, employee, isManager, isDirector);
  }, [departments, employee, isManager, isDirector]);

  const managedSecIds = useMemo(() => {
    return getManagedSectionIds(sections, managedDeptIds, employee?.id, isDirector);
  }, [sections, managedDeptIds, employee?.id, isDirector]);

  const supervisedEmployeeIds = useMemo(() => {
    return getSupervisedEmployeeIds(
      employees,
      managedDeptIds,
      managedSecIds,
      employee?.id,
      isDirector,
      isHR,
    );
  }, [employees, managedDeptIds, managedSecIds, employee?.id, isDirector, isHR]);

  const isSupervised = useMemo(() => {
    if (!task) return false;
    return isTaskSupervisedBy(task, employee?.id, supervisedEmployeeIds);
  }, [task, employee?.id, supervisedEmployeeIds]);

  const nameOf = (id: string | null) => employees.find((e) => e.id === id)?.full_name ?? "—";

  const applyProgress = useApplyTaskProgress((id?: string) => {
    if (!id || id === task?.id) return task ?? undefined;
    return siblingTasks.find((s) => s.id === id);
  });

  const assigneePhone = employees.find((e) => e.id === task?.assignee_id)?.phone ?? null;
  const whatsappHref = task
    ? waLink(
        assigneePhone,
        buildTaskAssignedMessage({
          title: task.title,
          description: task.description,
          priority: PRIORITY_LABELS[task.priority] ?? task.priority,
          dueDate: task.due_date,
          assigneeName: nameOf(task.assignee_id),
          supervisorName: task.supervisor_id ? nameOf(task.supervisor_id) : null,
          taskId: task.id,
        }),
      )
    : null;

  const canManage =
    !!task &&
    (isManager || isDirector || isHR || task.assigned_by === employee?.id || isSupervised);
  const canUpdateProgress = !!task && (canManage || task.assignee_id === employee?.id);


  return (
    <div className="space-y-5">
      <PageHeader
        title={task?.title ?? "تفاصيل المهمة"}
        description="متابعة تفاصيل المهمة والمشرف عليها ونسبة الإنجاز."
        action={
          <>
            {whatsappHref && (
              <Button variant="outline" asChild>
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" /> إشعار واتساب
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={() => void navigate({ to: "/tasks" })}>
              <ArrowRight className="size-4" /> رجوع إلى المهام
            </Button>
          </>
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
              siblingTasks={siblingTasks}
              employees={employees}
              onSiblingProgress={(id, progress) => applyProgress.mutate({ id, progress })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
