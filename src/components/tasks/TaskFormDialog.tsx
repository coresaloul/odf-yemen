import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/hr";
import { RECURRENCE_LABELS, todayIso, type EmployeeLite, type TaskRow } from "./task-utils";

export type TaskFormValues = {
  title: string;
  description: string;
  assignee_ids: string[];
  priority: string;
  status: string;
  start_date: string;
  due_date: string;
  weight: string;
  recurrence: string;
  supervisor_id: string;
};

export const EMPTY_TASK_FORM: TaskFormValues = {
  title: "",
  description: "",
  assignee_ids: [],
  priority: "medium",
  status: "new",
  start_date: todayIso(),
  due_date: "",
  weight: "1",
  recurrence: "none",
  supervisor_id: "",
};

export const TASK_TEMPLATES: { label: string; values: Partial<TaskFormValues> }[] = [
  { label: "تقرير إنجاز أسبوعي", values: { title: "إعداد تقرير الإنجاز الأسبوعي", priority: "medium", recurrence: "weekly", weight: "2" } },
  { label: "اجتماع متابعة", values: { title: "حضور اجتماع المتابعة الدوري", priority: "medium", recurrence: "weekly", weight: "1" } },
  { label: "مهمة ميدانية عاجلة", values: { title: "زيارة ميدانية", priority: "urgent", weight: "3" } },
  { label: "أرشفة وثائق", values: { title: "أرشفة الوثائق والمستندات", priority: "low", weight: "1" } },
];

export function TaskFormDialog({
  open,
  onOpenChange,
  employees,
  editing,
  initial,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: EmployeeLite[];
  editing: TaskRow | null;
  initial?: Partial<TaskFormValues>;
  saving: boolean;
  onSubmit: (values: TaskFormValues) => void;
}) {
  const [form, setForm] = useState<TaskFormValues>({ ...EMPTY_TASK_FORM });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description ?? "",
        assignee_ids: [editing.assignee_id],
        priority: editing.priority,
        status: editing.status,
        start_date: editing.start_date,
        due_date: editing.due_date ?? "",
        weight: String(editing.weight ?? 1),
        recurrence: editing.recurrence ?? "none",
        supervisor_id: editing.supervisor_id ?? "",
      });
    } else {
      setForm({ ...EMPTY_TASK_FORM, ...initial });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const set = <K extends keyof TaskFormValues>(k: K, v: TaskFormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleAssignee = (id: string) =>
    setForm((f) => {
      const assignee_ids = f.assignee_ids.includes(id)
        ? f.assignee_ids.filter((x) => x !== id)
        : [...f.assignee_ids, id];
      return {
        ...f,
        assignee_ids,
        supervisor_id: assignee_ids.includes(f.supervisor_id) ? f.supervisor_id : "",
      };
    });

  const submit = () => {
    if (!form.title.trim()) return setError("عنوان المهمة مطلوب");
    if (form.assignee_ids.length === 0) return setError("اختر موظفاً واحداً على الأقل");
    if (form.due_date && form.start_date && form.due_date < form.start_date)
      return setError("تاريخ الاستحقاق يجب أن يكون بعد تاريخ البدء");
    setError(null);
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل المهمة" : "مهمة جديدة"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!editing && (
            <div className="flex flex-wrap gap-2">
              {TASK_TEMPLATES.map((t) => (
                <Button
                  key={t.label}
                  size="sm"
                  variant="secondary"
                  onClick={() => setForm((f) => ({ ...f, ...t.values }))}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>عنوان المهمة</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>الوصف</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{editing ? "الموظف المكلّف" : "الموظفون المكلّفون (يمكن اختيار أكثر من موظف)"}</Label>
            {editing ? (
              <Select
                value={form.assignee_ids[0] ?? ""}
                onValueChange={(v) => set("assignee_ids", [v])}
              >
                <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-3">
                {employees.map((e) => (
                  <label key={e.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.assignee_ids.includes(e.id)}
                      onCheckedChange={() => toggleAssignee(e.id)}
                    />
                    {e.full_name}
                  </label>
                ))}
                {employees.length === 0 && (
                  <p className="text-xs text-muted-foreground">لا يوجد موظفون.</p>
                )}
              </div>
            )}
          </div>

          {(form.assignee_ids.length > 1 || form.supervisor_id) && (
            <div className="space-y-2">
              <Label>المشرف على المهمة</Label>
              <Select
                value={form.supervisor_id || "none"}
                onValueChange={(v) => set("supervisor_id", v === "none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="اختر المشرف" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مشرف</SelectItem>
                  {employees
                    .filter((e) => form.assignee_ids.includes(e.id) || e.id === form.supervisor_id)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                عند تكليف أكثر من موظف بنفس المهمة، حدّد من يشرف على تنفيذها.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editing && (
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>تاريخ البدء</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>تاريخ الاستحقاق</Label>
              <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>وزن المهمة</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.weight}
                onChange={(e) => set("weight", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>التكرار</Label>
              <Select value={form.recurrence} onValueChange={(v) => set("recurrence", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {editing ? "حفظ التعديلات" : "حفظ المهمة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
