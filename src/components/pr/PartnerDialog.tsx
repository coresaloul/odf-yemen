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
import { Slider } from "@/components/ui/slider";
import {
  PARTNER_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  type PartnerRow,
  type PartnerStatus,
  type PartnerType,
} from "@/lib/pr-crm";

export type PartnerFormValues = {
  name: string;
  type: PartnerType;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  interest_level: number;
  influence_level: number;
  status: PartnerStatus;
  notes: string;
  assigned_employee_id: string;
};

export const EMPTY_PARTNER_FORM: PartnerFormValues = {
  name: "",
  type: "private_csr",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  website: "",
  interest_level: 3,
  influence_level: 3,
  status: "prospect",
  notes: "",
  assigned_employee_id: "none",
};

export function PartnerDialog({
  open,
  onOpenChange,
  partner,
  employees,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: PartnerRow | null;
  employees: { id: string; full_name: string }[];
  saving: boolean;
  onSubmit: (values: PartnerFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<PartnerFormValues>(EMPTY_PARTNER_FORM);

  useEffect(() => {
    if (partner) {
      setForm({
        name: partner.name,
        type: partner.type,
        contact_person: partner.contact_person || "",
        phone: partner.phone || "",
        email: partner.email || "",
        address: partner.address || "",
        website: partner.website || "",
        interest_level: partner.interest_level || 3,
        influence_level: partner.influence_level || 3,
        status: partner.status,
        notes: partner.notes || "",
        assigned_employee_id: partner.assigned_employee_id || "none",
      });
    } else {
      setForm(EMPTY_PARTNER_FORM);
    }
  }, [partner, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {partner ? "تعديل بيانات الشريك / المانح" : "إضافة شريك / مانح جديد"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>اسم الجهة أو الشخصية المانحة *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: مجموعة هائل سعيد أنعم / منظمة اليونيسف"
              />
            </div>

            <div className="space-y-1.5">
              <Label>تصنيف الجهة *</Label>
              <Select
                value={form.type}
                onValueChange={(val) => setForm({ ...form, type: val as PartnerType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PARTNER_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>حالة العلاقة *</Label>
              <Select
                value={form.status}
                onValueChange={(val) => setForm({ ...form, status: val as PartnerStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PARTNER_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>الشخص المسؤول / ضابط الاتصال</Label>
              <Input
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                placeholder="اسم ممثل الجهة"
              />
            </div>

            <div className="space-y-1.5">
              <Label>مسؤول الحساب من كوادر المؤسسة</Label>
              <Select
                value={form.assigned_employee_id}
                onValueChange={(val) => setForm({ ...form, assigned_employee_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموظف المختص" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">غير محدد</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>رقم الهاتف / الواتساب</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+967..."
                dir="ltr"
                className="text-right"
              />
            </div>

            <div className="space-y-1.5">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contact@partner.org"
                dir="ltr"
                className="text-right"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>العنوان / المقر الرئيسي</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="المدينة، الشارع، المبنى"
              />
            </div>
          </div>

          {/* مصفوفة التأثير والاهتمام (Power / Interest Matrix) */}
          <div className="p-4 bg-muted/40 rounded-xl space-y-4 border border-border">
            <h4 className="text-sm font-semibold text-foreground">
              مصفوفة وزن الشريك (توجيه استراتيجية التواصل)
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>مستوى الاهتمام برعاية الأيتام:</span>
                <span className="font-bold text-primary">{form.interest_level} من 5</span>
              </div>
              <Slider
                value={[form.interest_level]}
                min={1}
                max={5}
                step={1}
                onValueChange={([val]) => setForm({ ...form, interest_level: val ?? 3 })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>مستوى القدرة المالية والتأثير (Power):</span>
                <span className="font-bold text-primary">{form.influence_level} من 5</span>
              </div>
              <Slider
                value={[form.influence_level]}
                min={1}
                max={5}
                step={1}
                onValueChange={([val]) => setForm({ ...form, influence_level: val ?? 3 })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات استراتيجية واهتمامات المانح</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="مثال: يركز المانح على دعم التعليم التقني والورش الإنتاجية للأيتام..."
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : partner ? "تحديث الشريك" : "حفظ الشريك"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
