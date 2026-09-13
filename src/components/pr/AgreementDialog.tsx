import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AGREEMENT_STATUS_LABELS,
  AGREEMENT_TYPE_LABELS,
  type AgreementRow,
  type AgreementStatus,
  type AgreementType,
  type PartnerRow,
} from "@/lib/pr-crm";

export type AgreementFormValues = {
  partner_id: string;
  reference_no: string;
  title: string;
  agreement_type: AgreementType;
  start_date: string;
  end_date: string;
  total_value: number;
  currency: string;
  document_url: string;
  status: AgreementStatus;
  assigned_employee_id: string;
  notes: string;
};

export function AgreementDialog({
  open,
  onOpenChange,
  partners,
  employees,
  agreement,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: PartnerRow[];
  employees: { id: string; full_name: string }[];
  agreement?: AgreementRow | null;
  saving: boolean;
  onSubmit: (values: AgreementFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<AgreementFormValues>({
    partner_id: partners[0]?.id || "",
    reference_no: "",
    title: "",
    agreement_type: "mou",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    total_value: 0,
    currency: "USD",
    document_url: "",
    status: "active",
    assigned_employee_id: employees[0]?.id || "",
    notes: "",
  });

  useEffect(() => {
    if (agreement) {
      setForm({
        partner_id: agreement.partner_id,
        reference_no: agreement.reference_no || "",
        title: agreement.title,
        agreement_type: agreement.agreement_type,
        start_date: agreement.start_date,
        end_date: agreement.end_date || "",
        total_value: Number(agreement.total_value) || 0,
        currency: agreement.currency || "USD",
        document_url: agreement.document_url || "",
        status: agreement.status,
        assigned_employee_id: agreement.assigned_employee_id || employees[0]?.id || "",
        notes: agreement.notes || "",
      });
    } else if (open) {
      setForm({
        partner_id: partners[0]?.id || "",
        reference_no: `MOU-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        title: "",
        agreement_type: "mou",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        total_value: 0,
        currency: "USD",
        document_url: "",
        status: "active",
        assigned_employee_id: employees[0]?.id || "",
        notes: "",
      });
    }
  }, [agreement, open, partners, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partner_id || !form.title.trim()) return;
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {agreement ? "تعديل مذكرة التفاهم / الاتفاقية" : "إضافة مذكرة تفاهم أو اتفاقية شراكة"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>الطرف الشريك / المانح *</Label>
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

            <div className="space-y-1.5 md:col-span-2">
              <Label>عنوان الاتفاقية أو بروتوكول التعاون *</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: مذكرة تفاهم للتعاون في رعاية وتمكين أيتام محافظة صنعاء"
              />
            </div>

            <div className="space-y-1.5">
              <Label>رقم المرجع / الكود الأرشيفي</Label>
              <Input
                value={form.reference_no}
                onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                placeholder="MOU-2026-..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>نوع الوثيقة *</Label>
              <Select
                value={form.agreement_type}
                onValueChange={(val) =>
                  setForm({ ...form, agreement_type: val as AgreementType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AGREEMENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>تاريخ بدء السريان *</Label>
              <Input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>تاريخ الانتهاء</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>القيمة الإجمالية للاتفاقية (إن وجدت)</Label>
              <Input
                type="number"
                min={0}
                value={form.total_value}
                onChange={(e) => setForm({ ...form, total_value: Number(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>العملة</Label>
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

            <div className="space-y-1.5">
              <Label>حالة الاتفاقية</Label>
              <Select
                value={form.status}
                onValueChange={(val) => setForm({ ...form, status: val as AgreementStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AGREEMENT_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>مسؤول المتابعة في المؤسسة</Label>
              <Select
                value={form.assigned_employee_id}
                onValueChange={(val) => setForm({ ...form, assigned_employee_id: val })}
              >
                <SelectTrigger>
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

            <div className="space-y-1.5 md:col-span-2">
              <Label>رابط الوثيقة الرسمية المؤرشفة (PDF)</Label>
              <Input
                value={form.document_url}
                onChange={(e) => setForm({ ...form, document_url: e.target.value })}
                placeholder="رابط أو مسار الوثيقة الموقعة..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>بنود رئيسية وملاحظات</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="ملخص الالتزامات والشروط..."
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : agreement ? "تحديث الاتفاقية" : "حفظ الاتفاقية"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
