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
  INTERACTION_TYPE_LABELS,
  type InteractionRow,
  type InteractionType,
  type PartnerRow,
} from "@/lib/pr-crm";

export type InteractionFormValues = {
  partner_id: string;
  interaction_type: InteractionType;
  title: string;
  interaction_date: string;
  location: string;
  summary: string;
  minutes: string;
  attendees: string;
  next_action: string;
  create_task: boolean;
  assigned_employee_id: string;
};

export function InteractionDialog({
  open,
  onOpenChange,
  partners,
  employees,
  preselectedPartnerId,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: PartnerRow[];
  employees: { id: string; full_name: string }[];
  preselectedPartnerId?: string;
  saving: boolean;
  onSubmit: (values: InteractionFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<InteractionFormValues>({
    partner_id: preselectedPartnerId || "",
    interaction_type: "meeting",
    title: "",
    interaction_date: new Date().toISOString().split("T")[0],
    location: "مقر المؤسسة ومراكز التدريب",
    summary: "",
    minutes: "",
    attendees: "",
    next_action: "",
    create_task: true,
    assigned_employee_id: employees[0]?.id || "",
  });

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        partner_id: preselectedPartnerId || partners[0]?.id || "",
        interaction_date: new Date().toISOString().split("T")[0],
      }));
    }
  }, [open, preselectedPartnerId, partners]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partner_id || !form.title.trim()) return;
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>توثيق تواصل / زيارة ميدانية جديدة</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>الجهة أو المانح *</Label>
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

            <div className="space-y-1.5">
              <Label>نوع التفاعل *</Label>
              <Select
                value={form.interaction_type}
                onValueChange={(val) =>
                  setForm({ ...form, interaction_type: val as InteractionType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INTERACTION_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>تاريخ التفاعل *</Label>
              <Input
                type="date"
                required
                value={form.interaction_date}
                onChange={(e) => setForm({ ...form, interaction_date: e.target.value })}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>عنوان اللقاء / الزيارة *</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: زيارة وفد المانح لمعامل التدريب المهني وقسم الأيتام"
              />
            </div>

            <div className="space-y-1.5">
              <Label>المكان</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="مقر المؤسسة، قاعة الاجتماعات، ميداني"
              />
            </div>

            <div className="space-y-1.5">
              <Label>المشاركون والوفد الحاضر</Label>
              <Input
                value={form.attendees}
                onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                placeholder="الأسماء والصفات"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>ملخص اللقاء وأبرز النقاشات</Label>
            <Textarea
              rows={2}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="ملخص موجز حول ما دار في اللقاء..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>محضر الاتفاق / المخرجات</Label>
            <Textarea
              rows={3}
              value={form.minutes}
              onChange={(e) => setForm({ ...form, minutes: e.target.value })}
              placeholder="النقاط المتفق عليها..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>الإجراء التالي المطلوب (Next Action)</Label>
            <Input
              value={form.next_action}
              onChange={(e) => setForm({ ...form, next_action: e.target.value })}
              placeholder="مثال: إرسال دراسة التكلفة لمشروع ورشة الخياطة"
            />
          </div>

          {/* محرك التزامن مع نظام المهام */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="create_task"
                checked={form.create_task}
                onCheckedChange={(c) => setForm({ ...form, create_task: Boolean(c) })}
              />
              <Label htmlFor="create_task" className="font-semibold text-primary cursor-pointer">
                توليد مهمة متابعة تلقائياً في لوحة المهام والتقويم (Event-Driven Task)
              </Label>
            </div>

            {form.create_task && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs">الموظف المكلف بتنفيذ المتابعة:</Label>
                <Select
                  value={form.assigned_employee_id}
                  onValueChange={(val) => setForm({ ...form, assigned_employee_id: val })}
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

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ التفاعل والمهام"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
