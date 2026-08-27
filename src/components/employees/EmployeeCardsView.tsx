import { FileText, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMPLOYEE_STATUS_LABELS, formatDate } from "@/lib/hr";
import { EmployeeAccountsDialog } from "@/components/EmployeeAccountsDialog";
import { EmployeeAvatar } from "./EmployeeAvatar";
import type { Employee, Department, Section } from "./types";

interface EmployeeCardsViewProps {
  employees: Employee[];
  departments: Department[];
  sections: Section[];
  isManager: boolean;
  isDirector: boolean;
  isHR: boolean;
  onViewProfile: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onChangeStatus: (id: string, status: "active" | "on_leave" | "terminated") => void;
  onDelete: (employee: Employee) => void;
  onDone: () => void;
}

export function EmployeeCardsView({
  employees,
  departments,
  sections,
  isManager,
  isDirector,
  isHR,
  onViewProfile,
  onEdit,
  onChangeStatus,
  onDelete,
  onDone,
}: EmployeeCardsViewProps) {
  const deptName = (id?: string | null) => departments.find((d) => d.id === id)?.name ?? "—";
  const secName = (id?: string | null) => sections.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {employees.map((e) => (
        <Card key={e.id} className="h-full transition-shadow hover:shadow-md">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <EmployeeAvatar name={e.full_name} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{e.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.job_title ?? "بدون مسمى"} — رقم {e.employee_no}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={e.status === "active" ? "default" : "secondary"}>
                  {EMPLOYEE_STATUS_LABELS[e.status]}
                </Badge>
                {!e.user_id && (
                  <Badge variant="outline" className="text-[10px]">
                    بلا حساب مستخدم
                  </Badge>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <div className="truncate">الإدارة: {deptName(e.department_id)}</div>
              <div className="truncate">القسم: {secName(e.section_id)}</div>
              <div className="truncate">التعيين: {formatDate(e.hire_date)}</div>
              <div className="truncate">الجوال: {e.phone ?? "—"}</div>
              <div className="truncate">
                الميلاد: {e.birth_date ? formatDate(e.birth_date) : "—"}
              </div>
              <div className="truncate">فصيلة الدم: {e.blood_type ?? "—"}</div>
            </dl>

            <div className="mt-auto flex flex-wrap items-center gap-1 border-t pt-2">
              <Button variant="ghost" size="sm" onClick={() => onViewProfile(e)}>
                <FileText className="size-4" /> الملف
              </Button>
              {isManager && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(e)}>
                  <Pencil className="size-4" /> تعديل
                </Button>
              )}
              {(isDirector || isHR) && !e.user_id && e.email && (
                <EmployeeAccountsDialog
                  employeeIds={[e.id]}
                  triggerLabel="إنشاء حساب"
                  variant="secondary"
                  size="sm"
                  onDone={onDone}
                />
              )}
              {(isDirector || isHR) && (
                <Select
                  value={e.status}
                  onValueChange={(v) =>
                    onChangeStatus(e.id, v as "active" | "on_leave" | "terminated")
                  }
                >
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMPLOYEE_STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isDirector && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => onDelete(e)}
                >
                  <Trash2 className="size-4" /> حذف
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
