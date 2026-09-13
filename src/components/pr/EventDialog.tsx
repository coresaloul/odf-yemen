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
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  type EventRow,
  type EventStatus,
  type EventType,
} from "@/lib/pr-crm";

export type EventFormValues = {
  title: string;
  event_type: EventType;
  event_date: string;
  location: string;
  budget: number;
  target_audience: string;
  media_links: string;
  coordinator_id: string;
  status: EventStatus;
  notes: string;
  create_prep_task: boolean;
};

export function EventDialog({
  open,
  onOpenChange,
  employees,
  eventItem,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: { id: string; full_name: string }[];
  eventItem?: EventRow | null;
  saving: boolean;
  onSubmit: (values: EventFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<EventFormValues>({
    title: "",
    event_type: "workshop_exhibition",
    event_date: new Date().toISOString().split("T")[0],
    location: "قاعة مؤسسة اليتيم الكبرى",
    budget: 0,
    target_audience: "المانحون، ممثلو المنظمات، رجال الأعمال",
    media_links: "",
    coordinator_id: employees[0]?.id || "",
    status: "planned",
    notes: "",
    create_prep_task: true,
  });

  useEffect(() => {
    if (eventItem) {
      setForm({
        title: eventItem.title,
        event_type: eventItem.event_type,
        event_date: eventItem.event_date,
        location: eventItem.location || "",
        budget: Number(eventItem.budget) || 0,
        target_audience: eventItem.target_audience || "",
        media_links: eventItem.media_links || "",
        coordinator_id: eventItem.coordinator_id || employees[0]?.id || "",
        status: eventItem.status,
        notes: eventItem.notes || "",
        create_prep_task: false,
      });
    } else if (open) {
      setForm({
        title: "",
        event_type: "workshop_exhibition",
        event_date: new Date().toISOString().split("T")[0],
        location: "قاعة مؤسسة اليتيم الكبرى",
        budget: 0,
        target_audience: "المانحون، ممثلو المنظمات، رجال الأعمال",
        media_links: "",
        coordinator_id: employees[0]?.id || "",
        status: "planned",
        notes: "",
        create_prep_task: true,
      });
    }
  }, [eventItem, open, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {eventItem ? "تعديل بيانات الفعالية / التغطية" : "إضافة فعالية / تغطية إعلامية جديدة"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>عنوان الفعالية / التغطية *</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: حفل تخرج الدفعة 15 من طلاب التدريب المهني للأيتام والمعرض السنوي"
              />
            </div>

            <div className="space-y-1.5">
              <Label>نوع الفعالية *</Label>
              <Select
                value={form.event_type}
                onValueChange={(val) => setForm({ ...form, event_type: val as EventType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>تاريخ الفعالية *</Label>
              <Input
                type="date"
                required
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>الموقع / القاعة</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="مقر المؤسسة، فندق..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>الميزانية التقديرية (YER / USD)</Label>
              <Input
                type="number"
                min={0}
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: Number(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>منسق الفعالية من فريق العمل</Label>
              <Select
                value={form.coordinator_id}
                onValueChange={(val) => setForm({ ...form, coordinator_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر منسق الفعالية" />
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

            <div className="space-y-1.5">
              <Label>حالة الفعالية</Label>
              <Select
                value={form.status}
                onValueChange={(val) => setForm({ ...form, status: val as EventStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>الجمهور المستهدف والجهات المدعوة</Label>
              <Input
                value={form.target_audience}
                onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                placeholder="رجال الأعمال، المانحون، ممثلو الجمعيات الخيرية"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>روابط التغطيات الإعلامية والنشر الصحفي (إن وجدت)</Label>
              <Input
                value={form.media_links}
                onChange={(e) => setForm({ ...form, media_links: e.target.value })}
                placeholder="روابط التقارير الصحفية وقنوات التواصل..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات وخطة العمل</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="الترتيبات الفنية واللوجستية..."
            />
          </div>

          {!eventItem && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="create_prep_task"
                  checked={form.create_prep_task}
                  onCheckedChange={(c) => setForm({ ...form, create_prep_task: Boolean(c) })}
                />
                <Label
                  htmlFor="create_prep_task"
                  className="font-semibold text-primary cursor-pointer"
                >
                  توليد مهمة تجهيز وتنسيق الفعالية في لوحة مهام المنسق
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                سيتم إسناد مهمة للمنسق بعنوان: "تجهيز وتنظيم {form.title || 'الفعالية'}" تستحق قبل موعد الفعالية.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : eventItem ? "تحديث الفعالية" : "حفظ الفعالية وتكليف الفريق"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
