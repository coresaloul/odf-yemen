import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DONATION_TYPE_LABELS,
  type AgreementRow,
  type DonationType,
  type PartnerRow,
} from "@/lib/pr-crm";

export type DonationFormValues = {
  kind: "donation" | "tranche";
  partner_id: string;
  agreement_id: string;
  // Donation fields
  donation_type: DonationType;
  amount: number;
  currency: string;
  in_kind_description: string;
  target_project: string;
  received_date: string;
  receipt_no: string;
  auto_thank_you_task: boolean;
  responsible_employee_id: string;
  // Tranche fields
  tranche_number: number;
  due_date: string;
  condition_milestone: string;
  auto_report_task: boolean;
};

export function DonationTrancheDialog({
  open,
  onOpenChange,
  partners,
  agreements,
  employees,
  preselectedPartnerId,
  initialKind = "donation",
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: PartnerRow[];
  agreements: AgreementRow[];
  employees: { id: string; full_name: string }[];
  preselectedPartnerId?: string;
  initialKind?: "donation" | "tranche";
  saving: boolean;
  onSubmit: (values: DonationFormValues) => Promise<void>;
}) {
  const [kind, setKind] = useState<"donation" | "tranche">(initialKind);
  const [form, setForm] = useState<DonationFormValues>({
    kind: initialKind,
    partner_id: preselectedPartnerId || partners[0]?.id || "",
    agreement_id: agreements[0]?.id || "",
    donation_type: "cash",
    amount: 5000,
    currency: "USD",
    in_kind_description: "",
    target_project: "كفالة ورعاية وتعليم الأيتام",
    received_date: new Date().toISOString().slice(0, 10),
    receipt_no: "",
    auto_thank_you_task: true,
    responsible_employee_id: employees[0]?.id || "",
    tranche_number: 1,
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    condition_milestone: "إنجاز المرحلة الأولى ورفع التقرير الفني",
    auto_report_task: true,
  });

  useEffect(() => {
    setKind(initialKind);
  }, [initialKind, open]);

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        kind,
        partner_id: preselectedPartnerId || partners[0]?.id || "",
      }));
    }
  }, [open, preselectedPartnerId, partners, kind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partner_id) return;
    await onSubmit({ ...form, kind });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {kind === "donation" ? "تسجيل تبرع / مساهمة جديدة" : "جدولة دفعة مالية والتزام (Tranche)"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={kind} onValueChange={(k) => setKind(k as any)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="donation">تسجيل تبرع ومساهمة</TabsTrigger>
            <TabsTrigger value="tranche">جدولة دفعة مانح</TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>الجهة المانحة *</Label>
              <Select
                value={form.partner_id}
                onValueChange={(val) => setForm({ ...form, partner_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الشريك أو المانح" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {kind === "donation" ? (
              <>
                <div className="space-y-1.5">
                  <Label>نوع التبرع *</Label>
                  <Select
                    value={form.donation_type}
                    onValueChange={(val) =>
                      setForm({ ...form, donation_type: val as DonationType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DONATION_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>تاريخ الاستلام *</Label>
                  <Input
                    type="date"
                    required
                    value={form.received_date}
                    onChange={(e) => setForm({ ...form, received_date: e.target.value })}
                  />
                </div>

                {form.donation_type === "cash" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>المبلغ المالي *</Label>
                      <Input
                        type="number"
                        min={0}
                        required
                        value={form.amount}
                        onChange={(e) =>
                          setForm({ ...form, amount: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>العملة *</Label>
                      <Select
                        value={form.currency}
                        onValueChange={(val) => setForm({ ...form, currency: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                          <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                          <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                          <SelectItem value="EUR">يورو (EUR)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>تفاصيل المنحة العينية (المعدات / المواد) *</Label>
                    <Textarea
                      required
                      rows={2}
                      value={form.in_kind_description}
                      onChange={(e) => setForm({ ...form, in_kind_description: e.target.value })}
                      placeholder="مثال: 15 ماكينة خياطة صناعية + أقمشة لورشة تدريب بنات الأيتام"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>المشروع المستهدف *</Label>
                  <Input
                    required
                    value={form.target_project}
                    onChange={(e) => setForm({ ...form, target_project: e.target.value })}
                    placeholder="مثال: كفالة الأيتام / تشغيل ورش النجارة"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>رقم الإيصال / السند المالي</Label>
                  <Input
                    value={form.receipt_no}
                    onChange={(e) => setForm({ ...form, receipt_no: e.target.value })}
                    placeholder="REC-2026-..."
                  />
                </div>

                {/* محرك التزامن: مهمة شكر */}
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-3 md:col-span-2">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id="auto_thank_you"
                      checked={form.auto_thank_you_task}
                      onCheckedChange={(c) =>
                        setForm({ ...form, auto_thank_you_task: Boolean(c) })
                      }
                    />
                    <Label
                      htmlFor="auto_thank_you"
                      className="font-semibold text-primary cursor-pointer"
                    >
                      توليد مهمة تلقائية: "إرسال رسالة شكر وإيصال رسمي للمتبرع" (خلال 48 ساعة)
                    </Label>
                  </div>
                  {form.auto_thank_you_task && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs">الموظف المكلف بإرسال الشكر:</Label>
                      <Select
                        value={form.responsible_employee_id}
                        onValueChange={(val) =>
                          setForm({ ...form, responsible_employee_id: val })
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="اختر الموظف" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>الاتفاقية أو العقد المرتبط</Label>
                  <Select
                    value={form.agreement_id}
                    onValueChange={(val) => setForm({ ...form, agreement_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الاتفاقية (اختياري)" />
                    </SelectTrigger>
                    <SelectContent>
                      {agreements
                        .filter((a) => a.partner_id === form.partner_id)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.title} ({Number(a.total_value).toLocaleString()} {a.currency})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>رقم الدفعة *</Label>
                  <Input
                    type="number"
                    min={1}
                    required
                    value={form.tranche_number}
                    onChange={(e) =>
                      setForm({ ...form, tranche_number: Number(e.target.value) || 1 })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>تاريخ استحقاق الدفعة *</Label>
                  <Input
                    type="date"
                    required
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>مبلغ الدفعة *</Label>
                  <Input
                    type="number"
                    min={0}
                    required
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: Number(e.target.value) || 0 })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>العملة *</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(val) => setForm({ ...form, currency: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                      <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                      <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                      <SelectItem value="EUR">يورو (EUR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label>الشرط أو الإنجاز المرتبط بصرف الدفعة (Milestone)</Label>
                  <Input
                    value={form.condition_milestone}
                    onChange={(e) =>
                      setForm({ ...form, condition_milestone: e.target.value })
                    }
                    placeholder="مثال: تقديم التقرير المالي والفني للربع الثاني"
                  />
                </div>

                {/* محرك التزامن: تقرير الدفعة */}
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-3 md:col-span-2">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id="auto_report_task"
                      checked={form.auto_report_task}
                      onCheckedChange={(c) =>
                        setForm({ ...form, auto_report_task: Boolean(c) })
                      }
                    />
                    <Label
                      htmlFor="auto_report_task"
                      className="font-semibold text-primary cursor-pointer"
                    >
                      توليد مهمة: "إعداد التقرير المالي والفني للدفعة" (تستحق قبل الدفعة بـ 7 أيام)
                    </Label>
                  </div>
                  {form.auto_report_task && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs">الموظف المسؤول عن إعداد التقرير:</Label>
                      <Select
                        value={form.responsible_employee_id}
                        onValueChange={(val) =>
                          setForm({ ...form, responsible_employee_id: val })
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="اختر الموظف" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "جاري الحفظ..."
                : kind === "donation"
                ? "تسجيل التبرع وتوليد المهام"
                : "جدولة الدفعة وتوليد مهام التقارير"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
