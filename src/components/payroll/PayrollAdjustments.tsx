import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  listAdjustments,
  saveAdjustment,
  deleteAdjustment,
} from "@/lib/payroll.functions";
import {
  ADJUSTMENT_KIND_LABELS,
  ADJUSTMENT_REASONS,
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_STATUS_LABELS,
  formatMoney,
  monthLabel,
  monthValue,
} from "@/lib/payroll";

export function PayrollAdjustments() {
  const qc = useQueryClient();
  const fetchSetup = useServerFn(getPayrollSetup);
  const fetchList = useServerFn(listAdjustments);
  const saveFn = useServerFn(saveAdjustment);
  const deleteFn = useServerFn(deleteAdjustment);

  const [month, setMonth] = useState(monthValue());
  const [form, setForm] = useState({
    id: null as string | null,
    employee_id: "",
    kind: "addition" as "addition" | "deduction",
    reason_type: "salary_difference",
    amount: 0,
    original_month: "",
    reason: "",
  });

  const { data: setup } = useQuery({ queryKey: ["payroll-setup"], queryFn: () => fetchSetup() });
  const { data: rows } = useQuery({
    queryKey: ["payroll-adjustments", month],
    queryFn: () => fetchList({ data: { month } }),
  });
  const currency = setup?.settings.currency ?? "ر.ي";

  const save = useMutation({
    mutationFn: async () => {
      if (!form.employee_id) throw new Error("اختر الموظف");
      await saveFn({
        data: {
          id: form.id,
          employee_id: form.employee_id,
          target_month: month,
          original_month: form.original_month || null,
          kind: form.kind,
          reason_type: form.reason_type,
          amount: Number(form.amount),
          reason: form.reason || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم حفظ التعديل");
      setForm({ ...form, id: null, amount: 0, reason: "" });
      void qc.invalidateQueries({ queryKey: ["payroll-adjustments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف التعديل");
      void qc.invalidateQueries({ queryKey: ["payroll-adjustments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">إضافة تعديل على الراتب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>شهر الصرف</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>الموظف</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الموظف" />
              </SelectTrigger>
              <SelectContent>
                {(setup?.employees ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>النوع</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v as "addition" | "deduction" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ADJUSTMENT_KIND_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>المبلغ</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>سبب التعديل</Label>
            <Select value={form.reason_type} onValueChange={(v) => setForm({ ...form, reason_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>يخص شهراً سابقاً (اختياري)</Label>
            <Input
              type="month"
              value={form.original_month}
              onChange={(e) => setForm({ ...form, original_month: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>ملاحظة</Label>
            <Textarea
              rows={2}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {form.id ? "تحديث التعديل" : "حفظ التعديل"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">تعديلات {monthLabel(`${month}-01`)}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {(rows ?? []).map((r) => {
            const emp = r.employees as { full_name?: string } | null;
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">{emp?.full_name ?? "موظف"}</p>
                  <p className="text-xs text-muted-foreground">
                    {ADJUSTMENT_REASON_LABELS[r.reason_type] ?? r.reason_type}
                    {r.original_month ? ` — يخص ${String(r.original_month).slice(0, 7)}` : ""}
                    {r.reason ? ` — ${r.reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.kind === "deduction" ? "destructive" : "secondary"}>
                    {ADJUSTMENT_KIND_LABELS[r.kind]} {formatMoney(r.amount, currency)}
                  </Badge>
                  <Badge variant="outline">{ADJUSTMENT_STATUS_LABELS[r.status] ?? r.status}</Badge>
                  {r.status !== "applied" && (
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {(rows ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">لا توجد تعديلات لهذا الشهر.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
