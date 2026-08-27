import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmployeeAccountsDialog } from "@/components/EmployeeAccountsDialog";
import { MoveEmployeesDialog } from "@/components/org/MoveEmployeesDialog";
import { deleteEmployee, setEmployeeStatus } from "@/lib/org.functions";
import { EmployeeStats } from "@/components/employees/EmployeeStats";
import { EmployeeFilters } from "@/components/employees/EmployeeFilters";
import { EmployeeTableView } from "@/components/employees/EmployeeTableView";
import { EmployeeCardsView } from "@/components/employees/EmployeeCardsView";
import { EmployeeProfileDialog } from "@/components/employees/EmployeeProfileDialog";
import { EmployeeFormDialog } from "@/components/employees/EmployeeFormDialog";
import type { Employee, Department, Section } from "@/components/employees/types";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "الموظفون | الموارد البشرية" },
      {
        name: "description",
        content: "سجل الموظفين وبياناتهم الشخصية والصحية والوثائق الرسمية والبيانات التعاقدية.",
      },
      { property: "og:title", content: "الموظفون | الموارد البشرية" },
      { property: "og:description", content: "إدارة ملفات الموظفين في مؤسسة اليتيم التنموية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { isManager, isDirector, isHR } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [view, setView] = useState<"cards" | "table">("table");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [profile, setProfile] = useState<Employee | null>(null);

  const removeEmployee = useServerFn(deleteEmployee);
  const updateEmployeeStatus = useServerFn(setEmployeeStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["employees-page"],
    queryFn: async () => {
      const [employees, departments, sections] = await Promise.all([
        supabase.from("employees").select("*").order("full_name"),
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("sections").select("id, name, department_id").order("name"),
      ]);
      return {
        employees: (employees.data ?? []) as unknown as Employee[],
        departments: (departments.data ?? []) as Department[],
        sections: (sections.data ?? []) as Section[],
      };
    },
  });

  const employees = data?.employees ?? [];
  const departments = data?.departments ?? [];
  const sections = data?.sections ?? [];
  const refresh = () => void qc.invalidateQueries({ queryKey: ["employees-page"] });

  const filtered = useMemo(() => {
    const term = q.trim();
    return employees.filter((e) => {
      const matchTerm =
        !term ||
        e.full_name.includes(term) ||
        e.employee_no.includes(term) ||
        (e.job_title ?? "").includes(term) ||
        (e.national_id ?? "").includes(term);
      const matchDept = deptFilter === "all" || e.department_id === deptFilter;
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      const matchAccount =
        accountFilter === "all" || (accountFilter === "linked" ? Boolean(e.user_id) : !e.user_id);
      return matchTerm && matchDept && matchStatus && matchAccount;
    });
  }, [employees, q, deptFilter, statusFilter, accountFilter]);

  const stats = useMemo(
    () => ({
      active: employees.filter((e) => e.status === "active").length,
      onLeave: employees.filter((e) => e.status === "on_leave").length,
      noAccount: employees.filter((e) => !e.user_id).length,
    }),
    [employees],
  );

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await removeEmployee({ data: { id } });
    },
    onSuccess: () => {
      toast.success("تم حذف الموظف");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async (vars: { ids: string[]; status: "active" | "on_leave" | "terminated" }) => {
      await updateEmployeeStatus({ data: { employeeIds: vars.ids, status: vars.status } });
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة الموظف");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDelete = (e: Employee) => {
    if (!confirm(`حذف الموظف «${e.full_name}»؟`)) return;
    remove.mutate(e.id);
  };

  const handleStatusChange = (id: string, status: "active" | "on_leave" | "terminated") => {
    changeStatus.mutate({ ids: [id], status });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="الموظفون"
        description="ملفات الموظفين: البيانات التنظيمية والشخصية والصحية والوثائق"
        action={
          <div className="flex flex-wrap gap-2">
            {(isDirector || isHR) && (
              <>
                <EmployeeAccountsDialog onDone={refresh} />
                <MoveEmployeesDialog
                  employees={employees}
                  departments={departments}
                  sections={sections}
                  onDone={refresh}
                />
              </>
            )}
            {isManager && (
              <EmployeeFormDialog
                departments={departments}
                sections={sections}
                managers={employees}
                onDone={refresh}
              />
            )}
          </div>
        }
      />

      <EmployeeFilters
        q={q}
        onQChange={setQ}
        deptFilter={deptFilter}
        onDeptFilterChange={setDeptFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        accountFilter={accountFilter}
        onAccountFilterChange={setAccountFilter}
        view={view}
        onViewChange={setView}
        departments={departments}
      />

      <EmployeeStats
        filteredCount={filtered.length}
        activeCount={stats.active}
        onLeaveCount={stats.onLeave}
        noAccountCount={stats.noAccount}
      />

      {isLoading && <ListSkeleton rows={4} />}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={Users}
          title="لا يوجد موظفون مطابقون"
          description="عدّل معايير البحث أو الفلاتر، أو أضف موظفاً جديداً."
        />
      )}

      {!isLoading && filtered.length > 0 && view === "table" && (
        <EmployeeTableView
          employees={filtered}
          departments={departments}
          sections={sections}
          isManager={isManager}
          isDirector={isDirector}
          onViewProfile={setProfile}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      )}

      {!isLoading && filtered.length > 0 && view === "cards" && (
        <EmployeeCardsView
          employees={filtered}
          departments={departments}
          sections={sections}
          isManager={isManager}
          isDirector={isDirector}
          isHR={isHR}
          onViewProfile={setProfile}
          onEdit={setEditing}
          onChangeStatus={handleStatusChange}
          onDelete={handleDelete}
          onDone={refresh}
        />
      )}

      {editing && (
        <EmployeeFormDialog
          departments={departments}
          sections={sections}
          managers={employees}
          employee={editing}
          controlledOpen
          onOpenChange={(o) => !o && setEditing(null)}
          onDone={refresh}
        />
      )}

      {profile && (
        <EmployeeProfileDialog
          employee={profile}
          departments={departments}
          sections={sections}
          onOpenChange={(o) => !o && setProfile(null)}
        />
      )}
    </div>
  );
}
