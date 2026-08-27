import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/hr";
import { provisionEmployeeAccounts } from "@/lib/admin-users.functions";
import { EmployeeDocuments } from "./EmployeeDocuments";
import {
  GENDERS,
  MARITAL,
  BLOOD_TYPES,
  EDUCATION,
  CONTRACTS,
  type Employee,
  type Department,
  type Section,
} from "./types";

interface EmployeeFormDialogProps {
  departments: Department[];
  sections: Section[];
  managers: { id: string; full_name: string }[];
  employee?: Employee;
  controlledOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDone: () => void;
}

export function EmployeeFormDialog({
  departments,
  sections,
  managers,
  employee,
  controlledOpen,
  onOpenChange,
  onDone,
}: EmployeeFormDialogProps) {
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

      // كل موظف جديد يحصل تلقائياً على حساب مستخدم بدور «موظف» عند توفر البريد
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
