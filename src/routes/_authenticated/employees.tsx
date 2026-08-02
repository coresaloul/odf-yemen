import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEE_STATUS_LABELS, formatDate } from "@/lib/hr";
import { EmployeeAccountsDialog } from "@/components/EmployeeAccountsDialog";
import { useServerFn } from "@tanstack/react-start";
import { provisionEmployeeAccounts } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "الموظفون | الموارد البشرية" },
      { name: "description", content: "سجل الموظفين وبياناتهم الشخصية والصحية والوثائق الرسمية والبيانات التعاقدية." },
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

type EmployeeDoc = {
  id: string;
  doc_type: string;
  title: string;
  issuer?: string | null;
  doc_number?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  file_url?: string | null;
  notes?: string | null;
};

const GENDERS = ["ذكر", "أنثى"];
const MARITAL = ["أعزب", "متزوج", "مطلق", "أرمل"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const EDUCATION = ["ثانوية", "دبلوم", "بكالوريوس", "ماجستير", "دكتوراه"];
const CONTRACTS = ["دوام كامل", "دوام جزئي", "مؤقت", "متعاون", "تحت التجربة"];
const DOC_TYPES = ["شهادة علمية", "دورة تدريبية", "عقد عمل", "هوية/إقامة", "جواز سفر", "شهادة خبرة", "تقرير طبي", "أخرى"];

function EmployeesPage() {
  const { isManager, isDirector, isHR } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [profile, setProfile] = useState<Employee | null>(null);

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
        accountFilter === "all" ||
        (accountFilter === "linked" ? Boolean(e.user_id) : !e.user_id);
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

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1 max-w-sm">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم أو الرقم الوظيفي أو الهوية"
            className="pr-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-44">
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
          <SelectTrigger className="w-40">
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
          <SelectTrigger className="w-44">
            <SelectValue placeholder="الحساب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="linked">لديه حساب مستخدم</SelectItem>
            <SelectItem value="unlinked">بلا حساب مستخدم</SelectItem>
          </SelectContent>
        </Select>
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
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={e.status === "active" ? "default" : "secondary"}>
                    {EMPLOYEE_STATUS_LABELS[e.status]}
                  </Badge>
                  {!e.user_id && (
                    <Badge variant="outline" className="text-[10px]">بلا حساب مستخدم</Badge>
                  )}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <div>الإدارة: {departments.find((d) => d.id === e.department_id)?.name ?? "—"}</div>
                <div>القسم: {sections.find((s) => s.id === e.section_id)?.name ?? "—"}</div>
                <div>التعيين: {formatDate(e.hire_date)}</div>
                <div>الجوال: {e.phone ?? "—"}</div>
                <div>الميلاد: {e.birth_date ? formatDate(e.birth_date) : "—"}</div>
                <div>فصيلة الدم: {e.blood_type ?? "—"}</div>
              </dl>
              <div className="flex flex-wrap gap-1 pt-1">
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
  const { isDirector } = useAuth();
  const qc = useQueryClient();
  const e = employee;

  const { data: docs = [] as EmployeeDoc[] } = useQuery({
    queryKey: ["employee-documents", e.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", e.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmployeeDoc[];
    },
  });

  const emptyDoc = {
    doc_type: "شهادة علمية",
    title: "",
    issuer: "",
    doc_number: "",
    issue_date: "",
    expiry_date: "",
    file_url: "",
    notes: "",
  };
  const [doc, setDoc] = useState(emptyDoc);
  const setD = (k: keyof typeof emptyDoc, v: string) => setDoc((d) => ({ ...d, [k]: v }));

  const addDoc = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employee_documents").insert({
        employee_id: e.id,
        doc_type: doc.doc_type,
        title: doc.title,
        issuer: doc.issuer || null,
        doc_number: doc.doc_number || null,
        issue_date: doc.issue_date || null,
        expiry_date: doc.expiry_date || null,
        file_url: doc.file_url || null,
        notes: doc.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الوثيقة");
      setDoc(emptyDoc);
      void qc.invalidateQueries({ queryKey: ["employee-documents", e.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const delDoc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الوثيقة");
      void qc.invalidateQueries({ queryKey: ["employee-documents", e.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
            <TabsTrigger value="official">وثائق رسمية</TabsTrigger>
            <TabsTrigger value="docs">الشهادات والوثائق</TabsTrigger>
          </TabsList>

          <TabsContent value="job" className="grid gap-3 pt-4 sm:grid-cols-3">
            <Field label="الرقم الوظيفي" value={e.employee_no} />
            <Field label="المسمى الوظيفي" value={e.job_title} />
            <Field label="الحالة" value={EMPLOYEE_STATUS_LABELS[e.status]} />
            <Field label="الإدارة" value={departments.find((d) => d.id === e.department_id)?.name} />
            <Field label="القسم" value={sections.find((s) => s.id === e.section_id)?.name} />
            <Field label="تاريخ التعيين" value={e.hire_date ? formatDate(e.hire_date) : null} />
            <Field label="نوع العقد" value={e.contract_type} />
            <Field label="نهاية العقد" value={e.contract_end_date ? formatDate(e.contract_end_date) : null} />
            <Field label="المؤهل العلمي" value={e.education_level} />
            <Field label="التخصص" value={e.specialization} />
            {isDirector && <Field label="الراتب الأساسي" value={e.basic_salary ? String(e.basic_salary) : null} />}
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

          <TabsContent value="official" className="grid gap-3 pt-4 sm:grid-cols-2">
            <Field label="رقم الهوية / الإقامة" value={e.national_id} />
            <Field label="انتهاء الهوية" value={e.national_id_expiry ? formatDate(e.national_id_expiry) : null} />
            <Field label="رقم جواز السفر" value={e.passport_no} />
            <Field label="انتهاء الجواز" value={e.passport_expiry ? formatDate(e.passport_expiry) : null} />
          </TabsContent>

          <TabsContent value="docs" className="space-y-4 pt-4">
            {docs.length === 0 && <p className="text-sm text-muted-foreground">لا توجد وثائق مسجّلة.</p>}
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.doc_type}
                        {d.issuer ? ` — ${d.issuer}` : ""}
                        {d.doc_number ? ` — رقم ${d.doc_number}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        الإصدار: {d.issue_date ? formatDate(d.issue_date) : "—"} · الانتهاء:{" "}
                        {d.expiry_date ? formatDate(d.expiry_date) : "—"}
                      </p>
                      {d.file_url && (
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline"
                        >
                          فتح الملف
                        </a>
                      )}
                      {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                    </div>
                    {isDirector && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => delDoc.mutate(d.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isDirector && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">إضافة وثيقة</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>النوع</Label>
                    <Select value={doc.doc_type} onValueChange={(v) => setD("doc_type", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOC_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>العنوان</Label>
                    <Input value={doc.title} onChange={(ev) => setD("title", ev.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>الجهة المُصدرة</Label>
                    <Input value={doc.issuer} onChange={(ev) => setD("issuer", ev.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الوثيقة</Label>
                    <Input value={doc.doc_number} onChange={(ev) => setD("doc_number", ev.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الإصدار</Label>
                    <Input type="date" value={doc.issue_date} onChange={(ev) => setD("issue_date", ev.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الانتهاء</Label>
                    <Input type="date" value={doc.expiry_date} onChange={(ev) => setD("expiry_date", ev.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>رابط الملف</Label>
                    <Input value={doc.file_url} onChange={(ev) => setD("file_url", ev.target.value)} placeholder="https://" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>ملاحظات</Label>
                    <Textarea value={doc.notes} onChange={(ev) => setD("notes", ev.target.value)} />
                  </div>
                </div>
                <Button size="sm" disabled={!doc.title || addDoc.isPending} onClick={() => addDoc.mutate()}>
                  <Plus className="size-4" /> إضافة
                </Button>
              </div>
            )}
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
        payload['basic_salary'] = form.basic_salary ? Number(form.basic_salary) : null;
        payload['iban'] = opt(form.iban);
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
          <TabsTrigger value="official">وثائق رسمية</TabsTrigger>
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
            <Input type="date" value={form.hire_date} onChange={(e) => set("hire_date", e.target.value)} />
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
            <Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
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
            <Input value={form.specialization} onChange={(e) => set("specialization", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>الأمراض المزمنة</Label>
            <Textarea value={form.chronic_diseases} onChange={(e) => set("chronic_diseases", e.target.value)} />
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

        <TabsContent value="official" className="grid gap-4 pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>رقم الهوية / الإقامة</Label>
            <Input value={form.national_id} onChange={(e) => set("national_id", e.target.value)} />
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
            <Input value={form.passport_no} onChange={(e) => set("passport_no", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>تاريخ انتهاء الجواز</Label>
            <Input
              type="date"
              value={form.passport_expiry}
              onChange={(e) => set("passport_expiry", e.target.value)}
            />
          </div>
          {isEdit && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              الشهادات والوثائق تُدار من زر «الملف» في بطاقة الموظف.
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
