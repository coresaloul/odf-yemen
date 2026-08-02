import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEE_STATUS_LABELS, formatDate } from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "الموظفون | الموارد البشرية" },
      { name: "description", content: "سجل الموظفين وبياناتهم الوظيفية وارتباطهم بالإدارات والأقسام." },
      { property: "og:title", content: "الموظفون | الموارد البشرية" },
      { property: "og:description", content: "إدارة ملفات الموظفين في مؤسسة اليتيم التنموية." },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { isManager, isDirector } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["employees-page"],
    queryFn: async () => {
      const [employees, departments, sections] = await Promise.all([
        supabase.from("employees").select("*").order("full_name"),
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("sections").select("id, name, department_id").order("name"),
      ]);
      return {
        employees: employees.data ?? [],
        departments: departments.data ?? [],
        sections: sections.data ?? [],
      };
    },
  });

  const employees = data?.employees ?? [];
  const departments = data?.departments ?? [];
  const sections = data?.sections ?? [];

  const filtered = useMemo(() => {
    const term = q.trim();
    if (!term) return employees;
    return employees.filter(
      (e) =>
        e.full_name.includes(term) ||
        e.employee_no.includes(term) ||
        (e.job_title ?? "").includes(term),
    );
  }, [employees, q]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الموظف");
      void qc.invalidateQueries({ queryKey: ["employees-page"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="الموظفون"
        description="ملفات الموظفين وبياناتهم التنظيمية"
        action={
          isManagerOrAbove && (
            <EmployeeDialog
              departments={departments}
              sections={sections}
              managers={employees}
              onDone={() => qc.invalidateQueries({ queryKey: ["employees-page"] })}
            />
          )
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالاسم أو الرقم الوظيفي"
          className="pr-9"
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">لا يوجد موظفون مطابقون.</p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((e) => (
          <Card key={e.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{e.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.job_title ?? "بدون مسمى"} — رقم {e.employee_no}
                  </p>
                </div>
                <Badge variant={e.status === "active" ? "default" : "secondary"}>
                  {EMPLOYEE_STATUS_LABELS[e.status]}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <div>الإدارة: {departments.find((d) => d.id === e.department_id)?.name ?? "—"}</div>
                <div>القسم: {sections.find((s) => s.id === e.section_id)?.name ?? "—"}</div>
                <div>التعيين: {formatDate(e.hire_date)}</div>
                <div>الجوال: {e.phone ?? "—"}</div>
              </dl>
              {isDirector && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove.mutate(e.id)}
                >
                  <Trash2 className="size-4" /> حذف
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmployeeDialog({
  departments,
  sections,
  managers,
  onDone,
}: {
  departments: { id: string; name: string }[];
  sections: { id: string; name: string; department_id: string }[];
  managers: { id: string; full_name: string }[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    employee_no: "",
    job_title: "",
    email: "",
    phone: "",
    hire_date: "",
    department_id: "none",
    section_id: "none",
    manager_id: "none",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").insert({
        full_name: form.full_name,
        employee_no: form.employee_no,
        job_title: form.job_title || null,
        email: form.email || null,
        phone: form.phone || null,
        hire_date: form.hire_date || null,
        department_id: form.department_id === "none" ? null : form.department_id,
        section_id: form.section_id === "none" ? null : form.section_id,
        manager_id: form.manager_id === "none" ? null : form.manager_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الموظف");
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deptSections = sections.filter((s) => s.department_id === form.department_id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> موظف جديد
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة موظف</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>الاسم الكامل</Label>
            <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>الرقم الوظيفي</Label>
            <Input value={form.employee_no} onChange={(e) => set("employee_no", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>المسمى الوظيفي</Label>
            <Input value={form.job_title} onChange={(e) => set("job_title", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>تاريخ التعيين</Label>
            <Input
              type="date"
              value={form.hire_date}
              onChange={(e) => set("hire_date", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>الجوال</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>الإدارة</Label>
            <Select value={form.department_id} onValueChange={(v) => set("department_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>القسم</Label>
            <Select value={form.section_id} onValueChange={(v) => set("section_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون</SelectItem>
                {deptSections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>المدير المباشر</Label>
            <Select value={form.manager_id} onValueChange={(v) => set("manager_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={!form.full_name || !form.employee_no || save.isPending}
          >
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
