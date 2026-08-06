import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  LayoutGrid,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Rows3,
  Search,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMPLOYEE_STATUS_LABELS, formatDate } from "@/lib/hr";
import { EmployeeDocuments } from "@/components/employees/EmployeeDocuments";
import { EmployeeAccountsDialog } from "@/components/EmployeeAccountsDialog";
import { useServerFn } from "@tanstack/react-start";
import { provisionEmployeeAccounts } from "@/lib/admin-users.functions";
import { deleteEmployee, setEmployeeStatus } from "@/lib/org.functions";
import { MoveEmployeesDialog } from "@/components/org/MoveEmployeesDialog";
import { EmployeeServiceLinks } from "@/components/employees/EmployeeServiceLinks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";


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

type Employee = {
  id: string;
  full_name: string;
  employee_no: string;
  status: keyof typeof EMPLOYEE_STATUS_LABELS;
  job_title?: string | null;
  email?: string | null;
  user_id?: string | null;
  phone?: string | null;
  hire_date?: string | null;
  department_id?: string | null;
  section_id?: string | null;
  manager_id?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  blood_type?: string | null;
  chronic_diseases?: string | null;
  allergies?: string | null;
  nationality?: string | null;
  national_id?: string | null;
  national_id_expiry?: string | null;
  passport_no?: string | null;
  passport_expiry?: string | null;
  address?: string | null;
  education_level?: string | null;
  specialization?: string | null;
  contract_type?: string | null;
  contract_end_date?: string | null;
  basic_salary?: number | null;
  iban?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  notes?: string | null;
};

const GENDERS = ["ذكر", "أنثى"];
const MARITAL = ["أعزب", "متزوج", "مطلق", "أرمل"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const EDUCATION = ["ثانوية", "دبلوم", "بكالوريوس", "ماجستير", "دكتوراه"];
const CONTRACTS = ["دوام كامل", "دوام جزئي", "مؤقت", "متعاون", "تحت التجربة"];

function EmployeesPage() {
  const { isManager, isDirector, isHR } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
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
        departments: departments.data ?? [],
        sections: sections.data ?? [],
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
              <EmployeeDialog
                departments={departments}
                sections={sections}
                managers={employees}
                onDone={refresh}
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="relative col-span-2 sm:min-w-56 sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم أو الرقم الوظيفي أو الهوية"
            className="pr-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
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
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="الحساب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="linked">لديه حساب مستخدم</SelectItem>
            <SelectItem value="unlinked">بلا حساب مستخدم</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <ListSkeleton rows={4} />}
      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={Users}
          title="لا يوجد موظفون مطابقون"
          description="عدّل معايير البحث أو الفلاتر، أو أضف موظفاً جديداً."
        />
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((e) => (
          <Card key={e.id} className="h-full">
            <CardContent className="flex h-full flex-col gap-2 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{e.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.job_title ?? "بدون مسمى"} — رقم {e.employee_no}
                  </p>
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
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <div className="truncate">
                  الإدارة: {departments.find((d) => d.id === e.department_id)?.name ?? "—"}
                </div>
                <div className="truncate">
                  القسم: {sections.find((s) => s.id === e.section_id)?.name ?? "—"}
                </div>
                <div className="truncate">التعيين: {formatDate(e.hire_date)}</div>
                <div className="truncate">الجوال: {e.phone ?? "—"}</div>
                <div className="truncate">
                  الميلاد: {e.birth_date ? formatDate(e.birth_date) : "—"}
                </div>
                <div className="truncate">فصيلة الدم: {e.blood_type ?? "—"}</div>
              </dl>
              <div className="mt-auto flex flex-wrap items-center gap-1 border-t pt-2">
                <Button variant="ghost" size="sm" onClick={() => setProfile(e)}>
                  <FileText className="size-4" /> الملف
                </Button>
                {isManager && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
                    <Pencil className="size-4" /> تعديل
                  </Button>
                )}
                {(isDirector || isHR) && !e.user_id && e.email && (
                  <EmployeeAccountsDialog
                    employeeIds={[e.id]}
                    triggerLabel="إنشاء حساب"
                    variant="secondary"
                    size="sm"
                    onDone={refresh}
                  />
                )}
                {(isDirector || isHR) && (
                  <Select
                    value={e.status}
                    onValueChange={(v) =>
                      changeStatus.mutate({
                        ids: [e.id],
                        status: v as "active" | "on_leave" | "terminated",
                      })
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
                    onClick={() => {
                      if (!confirm(`حذف الموظف «${e.full_name}»؟`)) return;
                      remove.mutate(e.id);
                    }}
                  >
                    <Trash2 className="size-4" /> حذف
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && (
        <EmployeeDialog
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

function EmployeeProfileDialog({
  employee,
  departments,
  sections,
  onOpenChange,
}: {
  employee: Employee;
  departments: { id: string; name: string }[];
  sections: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const { isDirector, isHR } = useAuth();
  const e = employee;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ملف الموظف — {e.full_name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="job" dir="rtl">
          <TabsList className="flex-wrap">
            <TabsTrigger value="job">بيانات وظيفية</TabsTrigger>
            <TabsTrigger value="personal">شخصية وصحية</TabsTrigger>
            <TabsTrigger value="docs">وثائق الموظف</TabsTrigger>
          </TabsList>

          <TabsContent value="job" className="grid gap-3 pt-4 sm:grid-cols-3">
            <Field label="الرقم الوظيفي" value={e.employee_no} />
            <Field label="المسمى الوظيفي" value={e.job_title} />
            <Field label="الحالة" value={EMPLOYEE_STATUS_LABELS[e.status]} />
            <Field
              label="الإدارة"
              value={departments.find((d) => d.id === e.department_id)?.name}
            />
            <Field label="القسم" value={sections.find((s) => s.id === e.section_id)?.name} />
            <Field label="تاريخ التعيين" value={e.hire_date ? formatDate(e.hire_date) : null} />
            <Field label="نوع العقد" value={e.contract_type} />
            <Field
              label="نهاية العقد"
              value={e.contract_end_date ? formatDate(e.contract_end_date) : null}
            />
            <Field label="المؤهل العلمي" value={e.education_level} />
            <Field label="التخصص" value={e.specialization} />
            {isDirector && (
              <Field
                label="الراتب الأساسي"
                value={e.basic_salary ? String(e.basic_salary) : null}
              />
            )}
            {isDirector && <Field label="الآيبان" value={e.iban} />}
          </TabsContent>

          <TabsContent value="personal" className="grid gap-3 pt-4 sm:grid-cols-3">
            <Field label="تاريخ الميلاد" value={e.birth_date ? formatDate(e.birth_date) : null} />
            <Field label="الجنس" value={e.gender} />
            <Field label="الحالة الاجتماعية" value={e.marital_status} />
            <Field label="فصيلة الدم" value={e.blood_type} />
            <Field label="الجنسية" value={e.nationality} />
            <Field label="الجوال" value={e.phone} />
            <Field label="البريد الإلكتروني" value={e.email} />
            <div className="sm:col-span-3">
              <Field label="الأمراض المزمنة" value={e.chronic_diseases} />
            </div>
            <div className="sm:col-span-3">
              <Field label="الحساسية" value={e.allergies} />
            </div>
            <div className="sm:col-span-3">
              <Field label="العنوان" value={e.address} />
            </div>
            <Separator className="sm:col-span-3" />
            <Field label="جهة الاتصال للطوارئ" value={e.emergency_contact_name} />
            <Field label="جوال الطوارئ" value={e.emergency_contact_phone} />
            <Field label="صلة القرابة" value={e.emergency_contact_relation} />
            <div className="sm:col-span-3">
              <Field label="ملاحظات" value={e.notes} />
            </div>
          </TabsContent>

          <TabsContent value="docs" className="pt-4">
            <EmployeeDocuments
              employeeId={e.id}
              national={{
                national_id: e.national_id,
                national_id_expiry: e.national_id_expiry,
                passport_no: e.passport_no,
                passport_expiry: e.passport_expiry,
              }}
              canUpload={isDirector || isHR}
              canDelete={isDirector || isHR}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeDialog({
  departments,
  sections,
  managers,
  employee,
  controlledOpen,
  onOpenChange,
  onDone,
}: {
  departments: { id: string; name: string }[];
  sections: { id: string; name: string; department_id: string }[];
  managers: { id: string; full_name: string }[];
  employee?: Employee;
  controlledOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDone: () => void;
}) {
  const { isDirector, isHR } = useAuth();
  const provision = useServerFn(provisionEmployeeAccounts);
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(employee);
  const s = (v: unknown) => (v == null ? "" : String(v));

  const [form, setForm] = useState({
    full_name: s(employee?.full_name),
    employee_no: s(employee?.employee_no),
    job_title: s(employee?.job_title),
    email: s(employee?.email),
    phone: s(employee?.phone),
    hire_date: s(employee?.hire_date),
    department_id: employee?.department_id ?? "none",
    section_id: employee?.section_id ?? "none",
    manager_id: employee?.manager_id ?? "none",
    status: s(employee?.status) || "active",
    birth_date: s(employee?.birth_date),
    gender: s(employee?.gender) || "none",
    marital_status: s(employee?.marital_status) || "none",
    blood_type: s(employee?.blood_type) || "none",
    chronic_diseases: s(employee?.chronic_diseases),
    allergies: s(employee?.allergies),
    nationality: s(employee?.nationality),
    national_id: s(employee?.national_id),
    national_id_expiry: s(employee?.national_id_expiry),
    passport_no: s(employee?.passport_no),
    passport_expiry: s(employee?.passport_expiry),
    address: s(employee?.address),
    education_level: s(employee?.education_level) || "none",
    specialization: s(employee?.specialization),
    contract_type: s(employee?.contract_type) || "none",
    contract_end_date: s(employee?.contract_end_date),
    basic_salary: s(employee?.basic_salary),
    iban: s(employee?.iban),
    emergency_contact_name: s(employee?.emergency_contact_name),
    emergency_contact_phone: s(employee?.emergency_contact_phone),
    emergency_contact_relation: s(employee?.emergency_contact_relation),
    notes: s(employee?.notes),
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const opt = (v: string) => (v === "none" || v === "" ? null : v);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        full_name: form.full_name,
        employee_no: form.employee_no,
        job_title: opt(form.job_title),
        email: opt(form.email),
        phone: opt(form.phone),
        hire_date: opt(form.hire_date),
        department_id: opt(form.department_id),
        section_id: opt(form.section_id),
        manager_id: opt(form.manager_id),
        status: form.status,
        birth_date: opt(form.birth_date),
        gender: opt(form.gender),
        marital_status: opt(form.marital_status),
        blood_type: opt(form.blood_type),
        chronic_diseases: opt(form.chronic_diseases),
        allergies: opt(form.allergies),
        nationality: opt(form.nationality),
        national_id: opt(form.national_id),
        national_id_expiry: opt(form.national_id_expiry),
        passport_no: opt(form.passport_no),
        passport_expiry: opt(form.passport_expiry),
        address: opt(form.address),
        education_level: opt(form.education_level),
        specialization: opt(form.specialization),
        contract_type: opt(form.contract_type),
        contract_end_date: opt(form.contract_end_date),
        emergency_contact_name: opt(form.emergency_contact_name),
        emergency_contact_phone: opt(form.emergency_contact_phone),
        emergency_contact_relation: opt(form.emergency_contact_relation),
        notes: opt(form.notes),
      };
      if (isDirector) {
        payload["basic_salary"] = form.basic_salary ? Number(form.basic_salary) : null;
        payload["iban"] = opt(form.iban);
      }
      if (isEdit) {
        const { error } = await supabase
          .from("employees")
          .update(payload as never)
          .eq("id", employee!.id);
        if (error) throw error;
        return { created: false as const };
      }
      const { data: inserted, error } = await supabase
        .from("employees")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw error;
      // كل موظف جديد يحصل تلقائياً على حساب مستخدم بدور «موظف»
      if (opt(form.email) && (isDirector || isHR)) {
        try {
          const res = await provision({ data: { employeeIds: [(inserted as { id: string }).id] } });
          const pwd = res.find((r) => r.password)?.password;
          if (pwd) toast.info(`كلمة المرور المؤقتة للحساب: ${pwd}`, { duration: 20000 });
        } catch (err) {
          toast.warning(`تعذر إنشاء حساب المستخدم: ${(err as Error).message}`);
        }
      }
      return { created: true as const };
    },
    onSuccess: () => {
      toast.success(isEdit ? "تم تحديث بيانات الموظف" : "تمت إضافة الموظف");
      setOpen(false);
      onOpenChange?.(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deptSections = sections.filter((sec) => sec.department_id === form.department_id);

  const body = (
    <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? "تعديل بيانات موظف" : "إضافة موظف"}</DialogTitle>
      </DialogHeader>

      <Tabs defaultValue="job" dir="rtl">
        <TabsList className="flex-wrap">
          <TabsTrigger value="job">وظيفية</TabsTrigger>
          <TabsTrigger value="personal">شخصية وصحية</TabsTrigger>
          <TabsTrigger value="official">وثائق الموظف</TabsTrigger>
          <TabsTrigger value="contract">تعاقد ومالية</TabsTrigger>
        </TabsList>

        <TabsContent value="job" className="grid gap-4 pt-4 sm:grid-cols-2">
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
                {deptSections.map((sec) => (
                  <SelectItem key={sec.id} value={sec.id}>
                    {sec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المدير المباشر</Label>
            <Select value={form.manager_id} onValueChange={(v) => set("manager_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون</SelectItem>
                {managers
                  .filter((m) => m.id !== employee?.id)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>حالة الموظف</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EMPLOYEE_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v as string}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="personal" className="grid gap-4 pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>تاريخ الميلاد</Label>
            <Input
              type="date"
              value={form.birth_date}
              onChange={(e) => set("birth_date", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>الجنس</Label>
            <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">غير محدد</SelectItem>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الحالة الاجتماعية</Label>
            <Select value={form.marital_status} onValueChange={(v) => set("marital_status", v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">غير محدد</SelectItem>
                {MARITAL.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>فصيلة الدم</Label>
            <Select value={form.blood_type} onValueChange={(v) => set("blood_type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">غير محدد</SelectItem>
                {BLOOD_TYPES.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الجنسية</Label>
            <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>المؤهل العلمي</Label>
            <Select value={form.education_level} onValueChange={(v) => set("education_level", v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">غير محدد</SelectItem>
                {EDUCATION.map((ed) => (
                  <SelectItem key={ed} value={ed}>
                    {ed}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>التخصص</Label>
            <Input
              value={form.specialization}
              onChange={(e) => set("specialization", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>الأمراض المزمنة</Label>
            <Textarea
              value={form.chronic_diseases}
              onChange={(e) => set("chronic_diseases", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>الحساسية</Label>
            <Input value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>العنوان</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>جهة الاتصال للطوارئ</Label>
            <Input
              value={form.emergency_contact_name}
              onChange={(e) => set("emergency_contact_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>جوال الطوارئ</Label>
            <Input
              value={form.emergency_contact_phone}
              onChange={(e) => set("emergency_contact_phone", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>صلة القرابة</Label>
            <Input
              value={form.emergency_contact_relation}
              onChange={(e) => set("emergency_contact_relation", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </TabsContent>

        <TabsContent value="official" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>رقم الهوية / الإقامة</Label>
              <Input
                value={form.national_id}
                onChange={(e) => set("national_id", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ انتهاء الهوية</Label>
              <Input
                type="date"
                value={form.national_id_expiry}
                onChange={(e) => set("national_id_expiry", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>رقم جواز السفر</Label>
              <Input
                value={form.passport_no}
                onChange={(e) => set("passport_no", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ انتهاء الجواز</Label>
              <Input
                type="date"
                value={form.passport_expiry}
                onChange={(e) => set("passport_expiry", e.target.value)}
              />
            </div>
          </div>

          {isEdit && employee ? (
            <>
              <Separator />
              <EmployeeDocuments
                employeeId={employee.id}
                national={{
                  national_id: form.national_id,
                  national_id_expiry: form.national_id_expiry,
                  passport_no: form.passport_no,
                  passport_expiry: form.passport_expiry,
                }}
                canUpload={isDirector || isHR}
                canDelete={isDirector || isHR}
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              رفع الوثائق وملفاتها يتاح بعد حفظ بيانات الموظف.
            </p>
          )}
        </TabsContent>

        <TabsContent value="contract" className="grid gap-4 pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>نوع العقد</Label>
            <Select value={form.contract_type} onValueChange={(v) => set("contract_type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">غير محدد</SelectItem>
                {CONTRACTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>تاريخ انتهاء العقد</Label>
            <Input
              type="date"
              value={form.contract_end_date}
              onChange={(e) => set("contract_end_date", e.target.value)}
            />
          </div>
          {isDirector && (
            <>
              <div className="space-y-2">
                <Label>الراتب الأساسي</Label>
                <Input
                  type="number"
                  value={form.basic_salary}
                  onChange={(e) => set("basic_salary", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الآيبان</Label>
                <Input value={form.iban} onChange={(e) => set("iban", e.target.value)} />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button
          onClick={() => save.mutate()}
          disabled={!form.full_name || !form.employee_no || save.isPending}
        >
          حفظ
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (controlledOpen) {
    return (
      <Dialog open onOpenChange={(o) => onOpenChange?.(o)}>
        {body}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> موظف جديد
        </Button>
      </DialogTrigger>
      {body}
    </Dialog>
  );
}
