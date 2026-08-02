import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/hr";
import type { EmployeeLite } from "./task-utils";

export type TaskFiltersState = {
  search: string;
  status: string;
  priority: string;
  assignee: string;
  department: string;
  from: string;
  to: string;
  overdueOnly: boolean;
  sort: "recent" | "due" | "priority";
};

export const EMPTY_FILTERS: TaskFiltersState = {
  search: "",
  status: "all",
  priority: "all",
  assignee: "all",
  department: "all",
  from: "",
  to: "",
  overdueOnly: false,
  sort: "recent",
};

export function TaskFilters({
  value,
  onChange,
  employees,
  departments,
}: {
  value: TaskFiltersState;
  onChange: (v: TaskFiltersState) => void;
  employees: EmployeeLite[];
  departments: { id: string; name: string }[];
}) {
  const set = <K extends keyof TaskFiltersState>(k: K, v: TaskFiltersState[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pr-9"
          placeholder="بحث في العنوان أو الوصف…"
          value={value.search}
          onChange={(e) => set("search", e.target.value)}
        />
      </div>

      <details className="group md:open" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="cursor-pointer list-none text-xs font-medium text-primary md:hidden">
          {open ? "إخفاء الفلاتر" : "عرض المزيد من الفلاتر"}
        </summary>

        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
            <Select value={value.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={value.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="الأولوية" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأولويات</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={value.assignee} onValueChange={(v) => set("assignee", v)}>
              <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="الموظف" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموظفين</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={value.department} onValueChange={(v) => set("department", v)}>
              <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="الإدارة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الإدارات</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">الاستحقاق من</span>
              <Input type="date" className="w-full md:w-40" value={value.from} onChange={(e) => set("from", e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">إلى</span>
              <Input type="date" className="w-full md:w-40" value={value.to} onChange={(e) => set("to", e.target.value)} />
            </div>

            <Select value={value.sort} onValueChange={(v) => set("sort", v as TaskFiltersState["sort"])}>
              <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">الأحدث إنشاءً</SelectItem>
                <SelectItem value="due">الاستحقاق الأقرب</SelectItem>
                <SelectItem value="priority">الأولوية الأعلى</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="w-full md:w-auto"
              variant={value.overdueOnly ? "destructive" : "outline"}
              onClick={() => set("overdueOnly", !value.overdueOnly)}
            >
              المتأخرة فقط
            </Button>

            <Button size="sm" variant="ghost" className="col-span-2 md:col-auto" onClick={() => onChange({ ...EMPTY_FILTERS })}>
              <X className="size-4" /> مسح الفلاتر
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
