import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPayrollSetup, saveAdvance, saveContract } from "@/lib/payroll.functions";
import { formatMoney, monthValue } from "@/lib/payroll";

type Installment = { seq: number; amount: number; due_date: string; note: string };

export function PayrollAdvances() {
  const qc = useQueryClient();
  const fetchSetup = useServerFn(getPayrollSetup);
  const saveAdvanceFn = useServerFn(saveAdvance);
  const saveContractFn = useServerFn(saveContract);

  const { data } = useQuery({ queryKey: ["payroll-setup"], queryFn: () => fetchSetup() });
  const currency = data?.settings.currency ?? "ر.ي";

  const [adv, setAdv] = useState({
    employee_id: "",
    total_amount: 0,
    installment_amount: 0,
    installments_count: 1,
    start_month: monthValue(),
    notes: "",
  });

  const [contract, setContract] = useState({
    employee_id: "",
    title: "",
    total_amount: 0,
    start_date: "",
    end_date: "",
    notes: "",
  });
  const [installments, setInstallments] = useState<Installment[]>([
    { seq: 1, amount: 0, due_date: "", note: "" },
  ]);

  const addAdvance = useMutation({
    mutationFn: async () => {
      if (!adv.employee_id) throw new Error("اختر الموظف");
      await saveAdvanceFn({
        data: {
          employee_id: adv.employee_id,
          total_amount: Number(adv.total_amount),
          installment_amount: Number(adv.installment_amount),
          installments_count: Number(adv.installments_count),
          start_month: adv.start_month,
          status: "active",
          notes: adv.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم تسجيل السلفة");
      setAdv({ ...adv, total_amount: 0, installment_amount: 0, notes: "" });
      void qc.invalidateQueries({ queryKey: ["payroll-setup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addContract = useMutation({
    mutationFn: async () => {
      if (!contract.employee_id || !contract.title.trim()) throw new Error("أكمل بيانات العقد");
      await saveContractFn({
        data: {
          employee_id: contract.employee_id,
          title: contract.title,
          total_amount: Number(contract.total_amount),
          start_date: contract.start_date || null,
          end_date: contract.end_date || null,
          status: "active",
          notes: contract.notes || null,
          installments: installments
            .filter((i) => Number(i.amount) > 0)
            .map((i, idx) => ({
              seq: idx + 1,
              amount: Number(i.amount),
              due_date: i.due_date || null,
              note: i.note || null,
            })),
        },
      });
    },
    onSuccess: () => {
      toast.success("تم حفظ العقد ودفعاته");
      setContract({ ...contract, title: "", total_amount: 0, notes: "" });
      setInstallments([{ seq: 1, amount: 0, due_date: "", note: "" }]);
      void qc.invalidateQueries({ queryKey: ["payroll-setup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const empName = (id: string) => (data?.employees ?? []).find((e) => e.id === id)?.full_name ?? "موظف";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">تسجيل سلفة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={adv.employee_id} onValueChange={(v) => setAdv({ ...adv, employee_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الموظف" />
              </SelectTrigger>
              <SelectContent>
                {(data?.employees ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>إجمالي السلفة</Label>
                <Input
                  type="number"
                  value={adv.total_amount}
                  onChange={(e) => setAdv({ ...adv, total_amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>القسط الشهري</Label>
                <Input
                  type="number"
                  value={adv.installment_amount}
                  onChange={(e) => setAdv({ ...adv, installment_amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>عدد الأقساط</Label>
                <Input
                  type="number"
                  value={adv.installments_count}
                  onChange={(e) => setAdv({ ...adv, installments_count: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>يبدأ من شهر</Label>
                <Input
                  type="month"
                  value={adv.start_month}
                  onChange={(e) => setAdv({ ...adv, start_month: e.target.value })}
                />
              </div>
            </div>
            <Textarea
              rows={2}
              placeholder="ملاحظات"
              value={adv.notes}
              onChange={(e) => setAdv({ ...adv, notes: e.target.value })}
            />
            <Button onClick={() => addAdvance.mutate()} disabled={addAdvance.isPending}>
              حفظ السلفة
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">السلف القائمة</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {(data?.advances ?? []).map((a) => {
              const total = Number(a.total_amount ?? 0);
              const paid = Number(a.paid_amount ?? 0);
              return (
                <div key={a.id} className="space-y-1 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{empName(a.employee_id)}</span>
                    <Badge variant={a.status === "settled" ? "secondary" : "outline"}>
                      {a.status === "settled" ? "مسددة" : "قائمة"}
                    </Badge>
                  </div>
                  <Progress value={total > 0 ? (paid / total) * 100 : 0} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    سُدد {formatMoney(paid, currency)} من {formatMoney(total, currency)} — القسط{" "}
                    {formatMoney(a.installment_amount, currency)}
                  </p>
                </div>
              );
            })}
            {(data?.advances ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">لا توجد سلف مسجلة.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">عقد استشاري</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={contract.employee_id}
              onValueChange={(v) => setContract({ ...contract, employee_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الاستشاري" />
              </SelectTrigger>
              <SelectContent>
                {(data?.employees ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="عنوان العقد"
              value={contract.title}
              onChange={(e) => setContract({ ...contract, title: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>القيمة</Label>
                <Input
                  type="number"
                  value={contract.total_amount}
                  onChange={(e) => setContract({ ...contract, total_amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>من</Label>
                <Input
                  type="date"
                  value={contract.start_date}
                  onChange={(e) => setContract({ ...contract, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>إلى</Label>
                <Input
                  type="date"
                  value={contract.end_date}
                  onChange={(e) => setContract({ ...contract, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>الدفعات</Label>
              {installments.map((inst, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="المبلغ"
                    value={inst.amount}
                    onChange={(e) => {
                      const next = [...installments];
                      next[idx] = { ...inst, amount: Number(e.target.value) };
                      setInstallments(next);
                    }}
                  />
                  <Input
                    type="date"
                    value={inst.due_date}
                    onChange={(e) => {
                      const next = [...installments];
                      next[idx] = { ...inst, due_date: e.target.value };
                      setInstallments(next);
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setInstallments(installments.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setInstallments([
                    ...installments,
                    { seq: installments.length + 1, amount: 0, due_date: "", note: "" },
                  ])
                }
              >
                <Plus className="ms-1 size-4" /> إضافة دفعة
              </Button>
            </div>

            <Button onClick={() => addContract.mutate()} disabled={addContract.isPending}>
              حفظ العقد
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">العقود ودفعاتها</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {(data?.contracts ?? []).map((c) => {
              const rows = (data?.installments ?? []).filter((i) => i.contract_id === c.id);
              return (
                <div key={c.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {c.title} — {empName(c.employee_id)}
                    </span>
                    <Badge variant="outline">{formatMoney(c.total_amount, currency)}</Badge>
                  </div>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {rows.map((i) => (
                      <li key={i.id}>
                        دفعة {i.seq}: {formatMoney(i.amount, currency)}{" "}
                        {i.due_date ? `— استحقاق ${i.due_date}` : ""} —{" "}
                        {i.status === "paid" ? "مصروفة" : "قيد الاستحقاق"}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {(data?.contracts ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">لا توجد عقود.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
