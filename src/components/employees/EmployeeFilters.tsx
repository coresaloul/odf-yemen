import { Search, Rows3, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/hr";
import type { Department } from "./types";

interface EmployeeFiltersProps {
  q: string;
  onQChange: (val: string) => void;
  deptFilter: string;
  onDeptFilterChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  accountFilter: string;
  onAccountFilterChange: (val: string) => void;
  view: "cards" | "table";
  onViewChange: (val: "cards" | "table") => void;
  departments: Department[];
}

export function EmployeeFilters({
  q,
  onQChange,
  deptFilter,
  onDeptFilterChange,
  statusFilter,
  onStatusFilterChange,
  accountFilter,
  onAccountFilterChange,
  view,
  onViewChange,
  departments,
}: EmployeeFiltersProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
      <div className="relative col-span-2 sm:min-w-56 sm:max-w-sm sm:flex-1">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="بحث بالاسم أو الرقم الوظيفي أو الهوية"
          className="pr-9"
        />
      </div>

      <Select value={deptFilter} onValueChange={onDeptFilterChange}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="الإدارة" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل الإدارات</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="الحالة" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل الحالات</SelectItem>
          {Object.entries(EMPLOYEE_STATUS_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={accountFilter} onValueChange={onAccountFilterChange}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="الحساب" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">الكل</SelectItem>
          <SelectItem value="linked">لديه حساب مستخدم</SelectItem>
          <SelectItem value="unlinked">بلا حساب مستخدم</SelectItem>
        </SelectContent>
      </Select>

      <div className="col-span-2 sm:mr-auto">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && onViewChange(v as "cards" | "table")}
          variant="outline"
          className="w-full sm:w-auto"
        >
          <ToggleGroupItem value="table" aria-label="عرض جدول" className="gap-1.5 px-3">
            <Rows3 className="size-4" /> جدول
          </ToggleGroupItem>
          <ToggleGroupItem value="cards" aria-label="عرض بطاقات" className="gap-1.5 px-3">
            <LayoutGrid className="size-4" /> بطاقات
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
