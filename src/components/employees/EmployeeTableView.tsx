import { FileText, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EMPLOYEE_STATUS_LABELS, formatDate } from "@/lib/hr";
import { EmployeeAvatar } from "./EmployeeAvatar";
import type { Employee, Department, Section } from "./types";

interface EmployeeTableViewProps {
  employees: Employee[];
  departments: Department[];
  sections: Section[];
  isManager: boolean;
  isDirector: boolean;
  onViewProfile: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

export function EmployeeTableView({
  employees,
  departments,
  sections,
  isManager,
  isDirector,
  onViewProfile,
  onEdit,
  onDelete,
}: EmployeeTableViewProps) {
  const deptName = (id?: string | null) => departments.find((d) => d.id === id)?.name ?? "—";
  const secName = (id?: string | null) => sections.find((s) => s.id === id)?.name ?? "—";

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">الموظف</TableHead>
              <TableHead className="text-right">الرقم</TableHead>
              <TableHead className="hidden text-right md:table-cell">الإدارة / القسم</TableHead>
              <TableHead className="hidden text-right lg:table-cell">التعيين</TableHead>
              <TableHead className="hidden text-right lg:table-cell">الجوال</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((e) => (
              <TableRow key={e.id} className="hover:bg-accent/40">
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <EmployeeAvatar name={e.full_name} className="size-8 text-xs" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.job_title ?? "بدون مسمى"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">{e.employee_no}</TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {deptName(e.department_id)}
                  {e.section_id ? ` / ${secName(e.section_id)}` : ""}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-xs lg:table-cell">
                  {formatDate(e.hire_date)}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-xs lg:table-cell">
                  {e.phone ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={e.status === "active" ? "default" : "secondary"}>
                      {EMPLOYEE_STATUS_LABELS[e.status]}
                    </Badge>
                    {!e.user_id && (
                      <Badge variant="outline" className="text-[10px]">
                        بلا حساب
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="ملف الموظف"
                      onClick={() => onViewProfile(e)}
                    >
                      <FileText className="size-4" />
                    </Button>
                    {isManager && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="تعديل"
                        onClick={() => onEdit(e)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {isDirector && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="حذف"
                        className="text-destructive"
                        onClick={() => onDelete(e)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
