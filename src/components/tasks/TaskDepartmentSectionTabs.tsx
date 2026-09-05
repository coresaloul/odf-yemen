import { useMemo, useState } from "react";
import {
  Building2,
  Layers,
  Sparkles,
  X,
  ChevronLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  DepartmentLite,
  EmployeeLite,
  GroupedTask,
  SectionLite,
  TaskRow,
} from "./task-utils";

interface TaskDepartmentSectionTabsProps {
  departments: DepartmentLite[];
  sections: SectionLite[];
  employees: EmployeeLite[];
  tasks: (TaskRow | GroupedTask)[];
  selectedDepartment: string;
  onSelectDepartment: (deptId: string) => void;
  selectedSection: string;
  onSelectSection: (secId: string) => void;
  managedDepartmentIds?: string[] | undefined;
  currentEmployeeDepartmentId?: string | null | undefined;
}

export function TaskDepartmentSectionTabs({
  departments,
  sections,
  employees,
  tasks,
  selectedDepartment,
  onSelectDepartment,
  selectedSection,
  onSelectSection,
  managedDepartmentIds = [],
  currentEmployeeDepartmentId,
}: TaskDepartmentSectionTabsProps) {
  const [tabMode, setTabMode] = useState<"departments" | "sections">("departments");

  // خريطة موظف -> (إدارة، قسم) لحساب العدادات بسرعة
  const employeeMap = useMemo(() => {
    return new Map(employees.map((e) => [e.id, { deptId: e.department_id, secId: e.section_id }]));
  }, [employees]);

  // عدادات المهام لكل إدارة
  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const ids = "assignee_ids" in t && Array.isArray(t.assignee_ids) ? t.assignee_ids : [t.assignee_id];
      const matchedDepts = new Set<string>();
      for (const id of ids) {
        const info = employeeMap.get(id);
        if (info?.deptId) matchedDepts.add(info.deptId);
      }
      for (const dId of matchedDepts) {
        counts.set(dId, (counts.get(dId) ?? 0) + 1);
      }
    }
    return counts;
  }, [tasks, employeeMap]);

  // عدادات المهام لكل قسم
  const sectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const ids = "assignee_ids" in t && Array.isArray(t.assignee_ids) ? t.assignee_ids : [t.assignee_id];
      const matchedSecs = new Set<string>();
      for (const id of ids) {
        const info = employeeMap.get(id);
        if (info?.secId) matchedSecs.add(info.secId);
      }
      for (const sId of matchedSecs) {
        counts.set(sId, (counts.get(sId) ?? 0) + 1);
      }
    }
    return counts;
  }, [tasks, employeeMap]);

  // الأقسام التابعة للإدارة المحددة حالياً
  const currentDeptSections = useMemo(() => {
    if (selectedDepartment === "all") return [];
    return sections.filter((s) => s.department_id === selectedDepartment);
  }, [sections, selectedDepartment]);

  const activeDeptObj = departments.find((d) => d.id === selectedDepartment);
  const activeSecObj = sections.find((s) => s.id === selectedSection);

  const hasActiveFilter = selectedDepartment !== "all" || selectedSection !== "all";

  return (
    <div className="space-y-3 rounded-xl border bg-card/60 p-3.5 shadow-xs backdrop-blur-xs">
      {/* الرأس: نمط التبويب وزر التصفية السريعة */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <Tabs
            value={tabMode}
            onValueChange={(v) => {
              setTabMode(v as typeof tabMode);
              if (v === "sections" && selectedDepartment !== "all") {
                // نبقي القسم أو نعرض الكل
              }
            }}
          >
            <TabsList className="h-8 bg-muted/70">
              <TabsTrigger value="departments" className="gap-1.5 px-3 text-xs font-medium">
                <Building2 className="size-3.5" />
                <span>تبويب الإدارات</span>
              </TabsTrigger>
              <TabsTrigger value="sections" className="gap-1.5 px-3 text-xs font-medium">
                <Layers className="size-3.5" />
                <span>تبويب الأقسام</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <span className="hidden sm:inline text-xs text-muted-foreground">
            تصفح المهام بحسب التوزيع الإداري
          </span>
        </div>

        {hasActiveFilter && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1">
              <span>المعروض:</span>
              {activeDeptObj && (
                <span className="font-semibold text-primary">{activeDeptObj.name}</span>
              )}
              {activeSecObj && (
                <>
                  <ChevronLeft className="size-3 text-muted-foreground" />
                  <span className="font-semibold text-primary">{activeSecObj.name}</span>
                </>
              )}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                onSelectDepartment("all");
                onSelectSection("all");
              }}
            >
              <X className="size-3" />
              إلغاء التصفية
            </Button>
          </div>
        )}
      </div>

      {/* تبويبات الإدارات */}
      {tabMode === "departments" && (
        <div className="space-y-2.5">
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                onSelectDepartment("all");
                onSelectSection("all");
              }}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                selectedDepartment === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Building2 className="size-3.5" />
              <span>كل الإدارات</span>
              <Badge
                variant={selectedDepartment === "all" ? "secondary" : "outline"}
                className="h-4.5 px-1.5 text-[10px]"
              >
                {tasks.length}
              </Badge>
            </button>

            {departments.map((dept) => {
              const isManaged =
                managedDepartmentIds.includes(dept.id) ||
                dept.id === currentEmployeeDepartmentId;
              const count = departmentCounts.get(dept.id) ?? 0;
              const isSelected = selectedDepartment === dept.id;

              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => {
                    onSelectDepartment(dept.id);
                    onSelectSection("all");
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : isManaged
                        ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Building2 className="size-3.5" />
                  <span>{dept.name}</span>
                  {isManaged && (
                    <span
                      title="الإدارة المشرف عليها"
                      className={`inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-semibold ${
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary/20 text-primary"
                      }`}
                    >
                      <Sparkles className="size-2.5" />
                      إدارتك
                    </span>
                  )}
                  <Badge
                    variant={isSelected ? "secondary" : "outline"}
                    className="h-4.5 px-1.5 text-[10px]"
                  >
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* شريط فرعي لأقسام الإدارة المحددة */}
          {selectedDepartment !== "all" && currentDeptSections.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/40 p-2 border border-muted-foreground/15">
              <span className="text-[11px] font-medium text-muted-foreground pe-1.5">
                أقسام {activeDeptObj?.name}:
              </span>

              <button
                type="button"
                onClick={() => onSelectSection("all")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  selectedSection === "all"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                كل أقسام الإدارة
                <span className="ms-1.5 text-[10px] text-muted-foreground">
                  ({departmentCounts.get(selectedDepartment) ?? 0})
                </span>
              </button>

              {currentDeptSections.map((sec) => {
                const count = sectionCounts.get(sec.id) ?? 0;
                const isSecSelected = selectedSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => onSelectSection(sec.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      isSecSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    }`}
                  >
                    {sec.name}
                    <Badge
                      variant={isSecSelected ? "secondary" : "outline"}
                      className="ms-1.5 h-4 px-1 text-[9px]"
                    >
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* تبويبات الأقسام (عرض شامل لكافة الأقسام) */}
      {tabMode === "sections" && (
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              onSelectDepartment("all");
              onSelectSection("all");
            }}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedSection === "all" && selectedDepartment === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Layers className="size-3.5" />
            <span>كل الأقسام</span>
            <Badge
              variant={
                selectedSection === "all" && selectedDepartment === "all"
                  ? "secondary"
                  : "outline"
              }
              className="h-4.5 px-1.5 text-[10px]"
            >
              {tasks.length}
            </Badge>
          </button>

          {sections.map((sec) => {
            const count = sectionCounts.get(sec.id) ?? 0;
            const isSelected = selectedSection === sec.id;
            const parentDept = departments.find((d) => d.id === sec.department_id);

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  onSelectDepartment(sec.department_id);
                  onSelectSection(sec.id);
                }}
                className={`flex shrink-0 flex-col items-start rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Layers className="size-3.5" />
                  <span>{sec.name}</span>
                  <Badge
                    variant={isSelected ? "secondary" : "outline"}
                    className="h-4 px-1 text-[9px]"
                  >
                    {count}
                  </Badge>
                </div>
                {parentDept && (
                  <span
                    className={`text-[9px] ${
                      isSelected ? "text-primary-foreground/80" : "text-muted-foreground/70"
                    }`}
                  >
                    {parentDept.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
