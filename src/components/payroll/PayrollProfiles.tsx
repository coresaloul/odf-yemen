import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPayrollSetup,
  saveEmployeePayroll,
  saveEmployeeComponent,
  deleteEmployeeComponent,
} from "@/lib/payroll.functions";
import {
  PAYMENT_METHOD_LABELS,
  WORKER_TYPES,
  WORKER_TYPE_LABELS,
  formatMoney,
} from "@/lib/payroll";

type ProfileForm = {
  worker_type: (typeof WORKER_TYPES)[number];
  basic_salary: number;
  daily_rate: number;
  hourly_rate: number;
  stipend: number;
  payment_method: "cash" | "transfer" | "bank";
  bank_name: string;
  account_no: string;
  iban: string;
  active: boolean;
  notes: string;
};

const emptyProfile: ProfileForm = {
  worker_type: "employee",
  basic_salary: 0,
  daily_rate: 0,
  hourly_rate: 0,
  stipend: 0,
  payment_method: "bank",
  bank_name: "",
  account_no: "",
  iban: "",
  active: true,
  notes: "",
};

export function PayrollProfiles() {
  const qc = useQueryClient();
  const fetchSetup = useServerFn(getPayrollSetup);
  const saveProfileFn = useServerFn(saveEmployeePayroll);
  const saveEmpComponentFn = useServerFn(saveEmployeeComponent);
  const deleteEmpComponentFn = useServerFn(deleteEmployeeComponent);

  const { data } = useQuery({ queryKey: ["payroll-setup"], queryFn: () => fetchSetup() });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [compId, setCompId] = useState<string>("");
  const [compAmount, setCompAmount] = useState<number>(0);

  const currency = data?.settings.currency ?? "ر.ي";
  const employees = useMemo(() => {
    const q = search.trim();
    return (data?.employees ?? []).filter(
      (e) => !q || e.full_name.includes(q) || String(e.employee_no).includes(q),
    );
  }, [data?.employees, search]);

  const selectEmployee = (id: string) => {
    setSelectedId(id);
    const p = (data?.profiles ?? []).find((x) => x.employee_id === id);
    const emp = (data?.employees ?? []).find((x) => x.id === id);
    setForm(
      p
        ? {
            worker_type: (p.worker_type as ProfileForm["worker_type"]) ?? "employee",
            basic_salary: Number(p.basic_salary ?? 0),
            daily_rate: Number(p.daily_rate ?? 0),
            hourly_rate: Number(p.hourly_rate ?? 0),
            stipend: Number(p.stipend ?? 0),
            payment_method: (p.payment_method as ProfileForm["payment_method"]) ?? "bank",
            bank_name: p.bank_name ?? "",
            account_no: p.account_no ?? "",
            iban: p.iban ?? "",
            active: p.active,
            notes: p.notes ?? "",
          }
        : { ...emptyProfile, basic_salary: Number(emp?.basic_salary ?? 0), iban: emp?.iban ?? "" },
    );
  };

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      await saveProfileFn({
        data: {
          employee_id: selectedId,
          worker_type: form.worker_type,
          basic_salary: Number(form.basic_salary),
          daily_rate: Number(form.daily_rate),
          hourly_rate: Number(form.hourly_rate),
          stipend: Number(form.stipend),
          payment_method: form.payment_method,
          bank_name: form.bank_name || null,
          account_no: form.account_no || null,
          iban: form.iban || null,
          active: form.active,
          notes: form.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم حفظ ملف الأجر");
      void qc.invalidateQueries({ queryKey: ["payroll-setup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addComponent = useMutation({
    mutationFn: async () => {
      if (!selectedId || !compId) throw new Error("اختر البند");
      await saveEmpComponentFn({
        data: {
          employee_id: selectedId,
          component_id: compId,
          amount: Number(compAmount),
          active: true,
        },
      });
    },
    onSuccess: () => {
      toast.success("تمت إضافة البند للموظف");
      setCompAmount(0);
      void qc.invalidateQueries({ queryKey: ["payroll-setup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeComponent = useMutation({
    mutationFn: async (id: string) => deleteEmpComponentFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["payroll-setup"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const empComponents = (data?.empComponents ?? []).filter((c) => c.employee_id === selectedId);
  const componentName = (id: string) =>
    (data?.components ?? []).find((c) => c.id === id)?.name ?? "بند";

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">الموظفون والعاملون</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative">
            <Search className="absolute end-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الرقم"
            />
          </div>
          <div className="max-h-[420px] space-y-1 overflow-auto">
            {employees.map((e) => {
              const p = (data?.profiles ?? []).find((x) => x.employee_id === e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => selectEmployee(e.id)}
                  className={`w-full rounded-md border p-2 text-start text-sm ${
                    selectedId === e.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <span className="block font-medium">{e.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {WORKER_TYPE_LABELS[String(p?.worker_type ?? "employee")]} ·{" "}
                    {formatMoney(p?.basic_salary ?? e.basic_salary ?? 0, currency)}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {selectedId
              ? `ملف الأجر — ${(data?.employees ?? []).find((e) => e.id === selectedId)?.full_name ?? ""}`
              : "اختر موظفاً"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedId ? (
            <p className="text-sm text-muted-foreground">
              اختر موظفاً من القائمة لعرض وتعديل بيانات أجره.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label>نوع العامل</Label>
                  <Select
                    value={form.worker_type}
                    onValueChange={(v) =>
                      setForm({ ...form, worker_type: v as ProfileForm["worker_type"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKER_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {WORKER_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>الراتب الأساسي</Label>
                  <Input
                    type="number"
                    value={form.basic_salary}
                    onChange={(e) => setForm({ ...form, basic_salary: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>الأجر اليومي</Label>
                  <Input
                    type="number"
                    value={form.daily_rate}
                    onChange={(e) => setForm({ ...form, daily_rate: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>أجر الساعة</Label>
                  <Input
                    type="number"
                    value={form.hourly_rate}
                    onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>مكافأة التطوع</Label>
                  <Input
                    type="number"
                    value={form.stipend}
                    onChange={(e) => setForm({ ...form, stipend: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>طريقة الصرف</Label>
                  <Select
                    value={form.payment_method}
                    onValueChange={(v) =>
                      setForm({ ...form, payment_method: v as ProfileForm["payment_method"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>البنك</Label>
                  <Input
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>رقم الحساب</Label>
                  <Input
                    value={form.account_no}
                    onChange={(e) => setForm({ ...form, account_no: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>الآيبان</Label>
                  <Input
                    value={form.iban}
                    onChange={(e) => setForm({ ...form, iban: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                حفظ ملف الأجر
              </Button>

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">البدلات والاستقطاعات الخاصة بالموظف</p>
                <div className="flex flex-wrap gap-2">
                  <Select value={compId} onValueChange={setCompId}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="اختر البند" />
                    </SelectTrigger>
                    <SelectContent>
                      {(data?.components ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="w-32"
                    type="number"
                    value={compAmount}
                    onChange={(e) => setCompAmount(Number(e.target.value))}
                    placeholder="القيمة"
                  />
                  <Button size="sm" onClick={() => addComponent.mutate()}>
                    إضافة
                  </Button>
                </div>
                <div className="divide-y">
                  {empComponents.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                      <span>
                        {componentName(c.component_id)}{" "}
                        <Badge variant="secondary">{Number(c.amount)}</Badge>
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeComponent.mutate(c.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {empComponents.length === 0 && (
                    <p className="py-2 text-xs text-muted-foreground">
                      لا توجد بنود مخصصة لهذا الموظف.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
