import { PersistentTabs } from "@/components/PersistentTabs";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  Download,
  FileText,
  FolderTree,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ORG_NAME } from "@/lib/hr";
import { UnitDialog, type UnitRecord } from "@/components/org/UnitDialog";
import { MoveEmployeesDialog } from "@/components/org/MoveEmployeesDialog";
import { deleteDepartment, deleteSection, getOrgStats } from "@/lib/org.functions";
import { STAGE_LABELS, type ApprovalStage } from "@/lib/evaluation-approval";
import { useBranding } from "@/hooks/useBranding";
import { exportPdf, exportWord, type ReportDoc } from "@/lib/report-export";

export const Route = createFileRoute("/_authenticated/org")({
  head: () => ({
    meta: [
      { title: "المخطط التنظيمي | الموارد البشرية" },
      {
        name: "description",
        content: "إدارة الهيكل التنظيمي والإدارات والأقسام في نظام مدير.",
      },
      { property: "og:title", content: "المخطط التنظيمي | الموارد البشرية" },
      {
        property: "og:description",
        content: "شجرة الإدارات والأقسام والموظفين التابعين لكل وحدة مع مؤشرات الأداء.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrgPage,
});

type Dept = { id: string; name: string; description: string | null; manager_id: string | null };
type Sec = Dept & { department_id: string };
type Emp = {
  id: string;
  full_name: string;
  job_title: string | null;
  status: string;
  department_id: string | null;
  section_id: string | null;
};

function OrgPage() {
  const branding = useBranding();
  const { isDirector, isHR, roles } = useAuth();
  const canManage = isDirector || isHR;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [deptDialog, setDeptDialog] = useState<{ open: boolean; unit: UnitRecord | null }>({
    open: false,
    unit: null,
  });
  const [secDialog, setSecDialog] = useState<{ open: boolean; unit: UnitRecord | null }>({
    open: false,
    unit: null,
  });

  const delDept = useServerFn(deleteDepartment);
  const delSec = useServerFn(deleteSection);
  const fetchStats = useServerFn(getOrgStats);

  const { data, isLoading } = useQuery({
    queryKey: ["org"],
    queryFn: async () => {
      const [departments, sections, employees] = await Promise.all([
        supabase.from("departments").select("*").order("name"),
        supabase.from("sections").select("*").order("name"),
        supabase
          .from("employees")
          .select("id, full_name, job_title, status, department_id, section_id")
          .order("full_name"),
      ]);
      return {
        departments: (departments.data ?? []) as Dept[],
        sections: (sections.data ?? []) as Sec[],
        employees: (employees.data ?? []) as Emp[],
      };
    },
  });

  const { data: stats } = useQuery({ queryKey: ["org-stats"], queryFn: () => fetchStats({}) });

  const departments = data?.departments ?? [];
  const sections = data?.sections ?? [];
  const employees = data?.employees ?? [];

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["org"] });
    void qc.invalidateQueries({ queryKey: ["org-stats"] });
    void qc.invalidateQueries({ queryKey: ["employees-page"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const statOf = (kind: "departments" | "sections", id: string) =>
    stats?.[kind].find((s) => s.id === id);

  const term = search.trim();
  const matchDept = (d: Dept) => {
    if (!term) return true;
    if (d.name.includes(term)) return true;
    if (sections.some((s) => s.department_id === d.id && s.name.includes(term))) return true;
    return employees.some((e) => e.department_id === d.id && e.full_name.includes(term));
  };

  const removeDept = async (id: string, name: string) => {
    if (!confirm(`حذف الإدارة «${name}»؟`)) return;
    try {
      await delDept({ data: { id } });
      toast.success("تم حذف الإدارة");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeSec = async (id: string, name: string) => {
    if (!confirm(`حذف القسم «${name}»؟`)) return;
    try {
      await delSec({ data: { id } });
      toast.success("تم حذف القسم");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const buildDoc = (): ReportDoc => ({
    title: "المخطط التنظيمي",
    subtitle: branding.org_name,
    branding: { org_name: branding.org_name, system_name: branding.system_name, logoUrl: branding.logoUrl },
    meta: [
      { label: "عدد الإدارات", value: String(departments.length) },
      { label: "عدد الأقسام", value: String(sections.length) },
      { label: "عدد الموظفين", value: String(employees.length) },
    ],
    sections: departments.map((d) => ({
      heading: `إدارة: ${d.name}`,
      paragraphs: [
        `المدير: ${employees.find((e) => e.id === d.manager_id)?.full_name ?? "غير محدد"}`,
        d.description ?? "",
      ].filter(Boolean),
      table: {
        columns: ["القسم", "رئيس القسم", "الموظف", "المسمى الوظيفي"],
        rows: employees
          .filter((e) => e.department_id === d.id)
          .map((e) => {
            const sec = sections.find((s) => s.id === e.section_id);
            return [
              sec?.name ?? "—",
              employees.find((m) => m.id === sec?.manager_id)?.full_name ?? "—",
              e.full_name,
              e.job_title ?? "—",
            ];
          }),
      },
    })),
  });

  const toggle = (id: string) =>
    setCollapsed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="المخطط التنظيمي"
        description={`الهيكل الإداري لـ${branding.org_name}`}
        action={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportWord(buildDoc(), "المخطط-التنظيمي")}
            >
              <Download className="size-4" /> Word
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportPdf(buildDoc())}>
              <FileText className="size-4" /> PDF
            </Button>
            {canManage && (
              <>
                <MoveEmployeesDialog
                  employees={employees}
                  departments={departments}
                  sections={sections}
                  onDone={invalidate}
                />
                <Button size="sm" onClick={() => setDeptDialog({ open: true, unit: null })}>
                  <Plus className="size-4" /> إدارة جديدة
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSecDialog({ open: true, unit: null })}
                  disabled={departments.length === 0}
                >
                  <Plus className="size-4" /> قسم جديد
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="الإدارات"
          value={departments.length}
          icon={<Building2 className="size-4" />}
        />
        <StatCard
          label="الأقسام"
          value={sections.length}
          icon={<FolderTree className="size-4" />}
        />
        <StatCard
          label="الموظفون على رأس العمل"
          value={employees.filter((e) => e.status === "active").length}
          icon={<Users className="size-4" />}
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث في الإدارات والأقسام والموظفين"
          className="pr-9"
        />
      </div>

      <PersistentTabs storageKey="org" defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">الشجرة</TabsTrigger>
          <TabsTrigger value="departments">الإدارات</TabsTrigger>
          <TabsTrigger value="sections">الأقسام</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="mt-4 space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
          <div className="rounded-xl bg-primary px-5 py-4 text-center font-display text-lg font-bold text-primary-foreground">
            {ORG_NAME}
          </div>
          {departments.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">لم تُضف أي إدارة بعد.</p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {departments.filter(matchDept).map((d) => {
              const deptSections = sections.filter((s) => s.department_id === d.id);
              const st = statOf("departments", d.id);
              const isCollapsed = collapsed.includes(d.id);
              const unassigned = employees.filter((e) => e.department_id === d.id && !e.section_id);
              return (
                <Card key={d.id} className="border-r-4 border-r-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-right"
                        onClick={() => toggle(d.id)}
                      >
                        {isCollapsed ? (
                          <ChevronLeft className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                        <Building2 className="size-4 text-primary" />
                        {d.name}
                      </button>
                      {canManage && (
                        <span className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeptDialog({ open: true, unit: d })}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void removeDept(d.id, d.name)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      المدير:{" "}
                      {employees.find((e) => e.id === d.manager_id)?.full_name ?? "غير محدد"}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      <Badge variant="secondary">{st?.employees ?? 0} موظف</Badge>
                      <Badge variant="outline">{deptSections.length} قسم</Badge>
                      <Badge variant="outline">{st?.openTasks ?? 0} مهمة مفتوحة</Badge>
                      <Badge variant="outline">إنجاز {st?.avgProgress ?? 0}%</Badge>
                    </div>
                  </CardHeader>
                  {!isCollapsed && (
                    <CardContent className="space-y-2">
                      {deptSections.length === 0 && (
                        <p className="text-xs text-muted-foreground">لا توجد أقسام.</p>
                      )}
                      {deptSections.map((s) => {
                        const secEmployees = employees.filter((e) => e.section_id === s.id);
                        const ss = statOf("sections", s.id);
                        return (
                          <div key={s.id} className="rounded-lg bg-muted/60 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="flex items-center gap-2 text-sm font-semibold">
                                <FolderTree className="size-4 text-accent" />
                                {s.name}
                              </p>
                              {canManage && (
                                <span className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSecDialog({ open: true, unit: s })}
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => void removeSec(s.id, s.name)}
                                  >
                                    <Trash2 className="size-3.5 text-destructive" />
                                  </Button>
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              رئيس القسم:{" "}
                              {employees.find((e) => e.id === s.manager_id)?.full_name ??
                                "غير محدد"}
                              {" · "}
                              {ss?.openTasks ?? 0} مهمة مفتوحة · إنجاز {ss?.avgProgress ?? 0}%
                            </p>
                            <ul className="mt-2 space-y-1">
                              {secEmployees.map((e) => (
                                <li
                                  key={e.id}
                                  className="flex items-center gap-2 text-xs text-foreground/80"
                                >
                                  <Users className="size-3" />
                                  {e.full_name}
                                  <span className="text-muted-foreground">
                                    {e.job_title ? `— ${e.job_title}` : ""}
                                  </span>
                                </li>
                              ))}
                              {secEmployees.length === 0 && (
                                <li className="text-xs text-muted-foreground">لا يوجد موظفون.</li>
                              )}
                            </ul>
                          </div>
                        );
                      })}
                      {unassigned.length > 0 && (
                        <div className="rounded-lg border border-dashed p-3">
                          <p className="text-xs font-semibold text-muted-foreground">
                            موظفون بالإدارة بدون قسم ({unassigned.length})
                          </p>
                          <ul className="mt-1 space-y-1">
                            {unassigned.map((e) => (
                              <li key={e.id} className="text-xs">
                                {e.full_name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <UnitTable
            rows={departments.map((d) => ({
              id: d.id,
              name: d.name,
              description: d.description,
              extra: `المدير: ${employees.find((e) => e.id === d.manager_id)?.full_name ?? "بدون"} · ${
                statOf("departments", d.id)?.employees ?? 0
              } موظف`,
            }))}
            canManage={canManage}
            onEdit={(id) =>
              setDeptDialog({ open: true, unit: departments.find((d) => d.id === id) ?? null })
            }
            onDelete={(id, name) => void removeDept(id, name)}
          />
        </TabsContent>

        <TabsContent value="sections" className="mt-4">
          <UnitTable
            rows={sections.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              extra: `${departments.find((d) => d.id === s.department_id)?.name ?? "—"} · ${
                statOf("sections", s.id)?.employees ?? 0
              } موظف`,
            }))}
            canManage={canManage}
            onEdit={(id) =>
              setSecDialog({ open: true, unit: sections.find((s) => s.id === id) ?? null })
            }
            onDelete={(id, name) => void removeSec(id, name)}
          />
        </TabsContent>
      </PersistentTabs>

      <UnitDialog
        kind="department"
        unit={deptDialog.unit}
        departments={departments}
        employees={employees}
        open={deptDialog.open}
        onOpenChange={(o) => setDeptDialog({ open: o, unit: o ? deptDialog.unit : null })}
        onDone={invalidate}
      />
      <UnitDialog
        kind="section"
        unit={secDialog.unit}
        departments={departments}
        employees={employees}
        open={secDialog.open}
        onOpenChange={(o) => setSecDialog({ open: o, unit: o ? secDialog.unit : null })}
        onDone={invalidate}
      />
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold">{value}</p>
        </div>
        <span className="rounded-lg bg-muted p-2 text-primary">{icon}</span>
      </CardContent>
    </Card>
  );
}

function UnitTable({
  rows,
  canManage,
  onEdit,
  onDelete,
}: {
  rows: { id: string; name: string; description: string | null; extra: string }[];
  canManage: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.extra}</p>
              {r.description && <p className="mt-1 text-xs">{r.description}</p>}
            </div>
            {canManage && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(r.id)}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(r.id, r.name)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
