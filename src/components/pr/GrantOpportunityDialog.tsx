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
import {
  GRANT_SECTOR_LABELS,
  GRANT_STAGE_LABELS,
  type GrantOpportunityRow,
  type GrantSector,
  type GrantStage,
  type PartnerRow,
} from "@/lib/pr-crm";

export type GrantFormValues = {
  partner_id: string;
  project_title: string;
  target_sector: GrantSector;
  stage: GrantStage;
  estimated_amount: number;
  currency: string;
  submission_deadline: string;
  decision_date: string;
  lead_writer_id: string;
  concept_summary: string;
  notes: string;
  create_task: boolean;
};

export function GrantOpportunityDialog({
  open,
  onOpenChange,
  partners,
  employees,
  opportunity,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: PartnerRow[];
  employees: { id: string; full_name: string }[];
  opportunity?: GrantOpportunityRow | null;
  saving: boolean;
  onSubmit: (values: GrantFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<GrantFormValues>({
    partner_id: partners[0]?.id || "",
    project_title: "",
    target_sector: "vocational_training",
    stage: "opportunity",
    estimated_amount: 10000,
    currency: "USD",
    submission_deadline: "",
    decision_date: "",
    lead_writer_id: employees[0]?.id || "",
    concept_summary: "",
    notes: "",
    create_task: true,
  });

  useEffect(() => {
    if (opportunity) {
      setForm({
        partner_id: opportunity.partner_id,
        project_title: opportunity.project_title,
        target_sector: opportunity.target_sector,
        stage: opportunity.stage,
        estimated_amount: Number(opportunity.estimated_amount) || 0,
        currency: opportunity.currency || "USD",
        submission_deadline: opportunity.submission_deadline || "",
        decision_date: opportunity.decision_date || "",
        lead_writer_id: opportunity.lead_writer_id || employees[0]?.id || "",
        concept_summary: opportunity.concept_summary || "",
        notes: opportunity.notes || "",
        create_task: false,
      });
    } else if (open) {
      setForm({
        partner_id: partners[0]?.id || "",
        project_title: "",
        target_sector: "vocational_training",
        stage: "opportunity",
        estimated_amount: 10000,
        currency: "USD",
        submission_deadline: "",
        decision_date: "",
        lead_writer_id: employees[0]?.id || "",
        concept_summary: "",
        notes: "",
        create_task: true,
      });
    }
  }, [opportunity, open, partners, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partner_id || !form.project_title.trim()) return;
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {opportunity ? "تعديل فرصة التمويل / المقترح" : "تسجيل فرصة تمويل ومقترح جديد (Grant Pipeline)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-1.5 md:col-span-2">
              <Label>عنوان المشروع التنموي المقترح *</Label>
              <Input
                required
                value={form.project_title}
                onChange={(e) => setForm({ ...form, project_title: e.target.value })}
                placeholder="مثال: تمويل تجهيز ورش النجارة والألمنيوم وتدريب 80 يتيماً"
              />
            </div>

            <div className="space-y-1.5">
              <Label>القطاع التنموي للأيتام *</Label>
              <Select
                value={form.target_sector}
                onValueChange={(val) =>
                  setForm({ ...form, target_sector: val as GrantSector })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GRANT_SECTOR_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>مرحلة المقترح في القمع (Stage) *</Label>
              <Select
                value={form.stage}
                onValueChange={(val) => setForm({ ...form, stage: val as GrantStage })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GRANT_STAGE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>المبلغ التقديري المطلوب</Label>
              <Input
                type="number"
                min={0}
                value={form.estimated_amount}
                onChange={(e) =>
                  setForm({ ...form, estimated_amount: Number(e.target.value) || 0 })
                }
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
              <Label>الموعد النهائي للتقديم للمانح</Label>
              <Input
                type="date"
                value={form.submission_deadline}
                onChange={(e) => setForm({ ...form, submission_deadline: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>المسؤول عن كتابة المقترح</Label>
              <Select
                value={form.lead_writer_id}
                onValueChange={(val) => setForm({ ...form, lead_writer_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر كاتب المقترح" />
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
          </div>

          <div className="space-y-1.5">
            <Label>موجز الفكرة والمبررات (Concept Summary)</Label>
            <Textarea
              rows={3}
              value={form.concept_summary}
              onChange={(e) => setForm({ ...form, concept_summary: e.target.value })}
              placeholder="وصف المشكلة، الفئات المستهدفة من الأيتام، والمخرجات المتوقعة..."
            />
          </div>

          {!opportunity && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="create_grant_task"
                  checked={form.create_task}
                  onCheckedChange={(c) => setForm({ ...form, create_task: Boolean(c) })}
                />
                <Label
                  htmlFor="create_grant_task"
                  className="font-semibold text-primary cursor-pointer"
                >
                  إنشاء مهمة صياغة المقترح تلقائياً في لوحة مهام الموظف
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                سيتم إسناد مهمة بعنوان: "صياغة مقترح مشروع {form.project_title || '...'}" للموظف المحدد مع تحديد تاريخ الاستحقاق وفق الموعد النهائي.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : opportunity ? "تحديث المقترح" : "حفظ المقترح وإسناد المهام"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
