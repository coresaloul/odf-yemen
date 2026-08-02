import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, FolderTree, Plus, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORG_NAME } from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/org")({
  head: () => ({
    meta: [
      { title: "المخطط التنظيمي | الموارد البشرية" },
      { name: "description", content: "إدارة الهيكل التنظيمي والإدارات والأقسام في مؤسسة اليتيم التنموية." },
      { property: "og:title", content: "المخطط التنظيمي | الموارد البشرية" },
      { property: "og:description", content: "شجرة الإدارات والأقسام والموظفين التابعين لكل وحدة." },
    ],
  }),
  component: OrgPage,
});

function useOrgData() {
  return useQuery({
    queryKey: ["org"],
    queryFn: async () => {
      const [departments, sections, employees] = await Promise.all([
        supabase.from("departments").select("*").order("name"),
        supabase.from("sections").select("*").order("name"),
        supabase.from("employees").select("*").order("full_name"),
      ]);
      return {
        departments: departments.data ?? [],
        sections: sections.data ?? [],
        employees: employees.data ?? [],
      };
    },
  });
}

function OrgPage() {
  const { isDirector } = useAuth();
  const { data, isLoading } = useOrgData();
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["org"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const departments = data?.departments ?? [];
  const sections = data?.sections ?? [];
  const employees = data?.employees ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="المخطط التنظيمي"
        description={`الهيكل الإداري لـ${ORG_NAME}`}
        action={
          isDirector && (
            <>
              <DepartmentDialog employees={employees} onDone={invalidate} />
              <SectionDialog departments={departments} employees={employees} onDone={invalidate} />
            </>
          )
        }
      />

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">الشجرة</TabsTrigger>
          <TabsTrigger value="departments">الإدارات</TabsTrigger>
          <TabsTrigger value="sections">الأقسام</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="mt-4">
          {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
          <div className="space-y-4">
            <div className="rounded-xl bg-primary px-5 py-4 text-center font-display text-lg font-bold text-primary-foreground">
              {ORG_NAME}
            </div>
            {departments.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground">لم تُضف أي إدارة بعد.</p>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {departments.map((d) => {
                const deptSections = sections.filter((s) => s.department_id === d.id);
                const deptEmployees = employees.filter((e) => e.department_id === d.id);
                const manager = employees.find((e) => e.id === d.manager_id);
                return (
                  <Card key={d.id} className="border-r-4 border-r-primary">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="size-4 text-primary" />
                        {d.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        المدير: {manager?.full_name ?? "غير محدد"} — {deptEmployees.length} موظف
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {deptSections.length === 0 && (
                        <p className="text-xs text-muted-foreground">لا توجد أقسام.</p>
                      )}
                      {deptSections.map((s) => {
                        const secEmployees = employees.filter((e) => e.section_id === s.id);
                        const secManager = employees.find((e) => e.id === s.manager_id);
                        return (
                          <div key={s.id} className="rounded-lg bg-muted/60 p-3">
                            <p className="flex items-center gap-2 text-sm font-semibold">
                              <FolderTree className="size-4 text-accent" />
                              {s.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              رئيس القسم: {secManager?.full_name ?? "غير محدد"}
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
                            </ul>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <UnitList
            rows={departments.map((d) => ({
              id: d.id,
              name: d.name,
              description: d.description,
              extra: employees.find((e) => e.id === d.manager_id)?.full_name ?? "بدون مدير",
            }))}
            canDelete={isDirector}
            onDelete={async (id) => {
              const { error } = await supabase.from("departments").delete().eq("id", id);
              if (error) toast.error(error.message);
              else {
                toast.success("تم الحذف");
                invalidate();
              }
            }}
          />
        </TabsContent>

        <TabsContent value="sections" className="mt-4">
          <UnitList
            rows={sections.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              extra: departments.find((d) => d.id === s.department_id)?.name ?? "—",
            }))}
            canDelete={isDirector}
            onDelete={async (id) => {
              const { error } = await supabase.from("sections").delete().eq("id", id);
              if (error) toast.error(error.message);
              else {
                toast.success("تم الحذف");
                invalidate();
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UnitList({
  rows,
  canDelete,
  onDelete,
}: {
  rows: { id: string; name: string; description: string | null; extra: string }[];
  canDelete: boolean;
  onDelete: (id: string) => void;
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
            {canDelete && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type EmployeeRow = { id: string; full_name: string };

function DepartmentDialog({
  employees,
  onDone,
}: {
  employees: EmployeeRow[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState<string>("none");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("departments").insert({
        name,
        description: description || null,
        manager_id: managerId === "none" ? null : managerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الإدارة");
      setOpen(false);
      setName("");
      setDescription("");
      setManagerId("none");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> إدارة جديدة
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة إدارة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>اسم الإدارة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>المدير المسؤول</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionDialog({
  departments,
  employees,
  onDone,
}: {
  departments: { id: string; name: string }[];
  employees: EmployeeRow[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [managerId, setManagerId] = useState("none");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sections").insert({
        name,
        department_id: departmentId,
        manager_id: managerId === "none" ? null : managerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة القسم");
      setOpen(false);
      setName("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" /> قسم جديد
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة قسم</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>الإدارة</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الإدارة" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>اسم القسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>رئيس القسم</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!name || !departmentId || save.isPending}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
