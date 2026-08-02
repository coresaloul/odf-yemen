import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { saveDepartment, saveSection } from "@/lib/org.functions";

export type UnitRecord = {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  department_id?: string | null;
};

export function UnitDialog({
  kind,
  unit,
  departments,
  employees,
  open,
  onOpenChange,
  onDone,
}: {
  kind: "department" | "section";
  unit?: UnitRecord | null;
  departments: { id: string; name: string }[];
  employees: { id: string; full_name: string }[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const isEdit = Boolean(unit?.id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState("none");
  const [departmentId, setDepartmentId] = useState("");

  const saveDept = useServerFn(saveDepartment);
  const saveSec = useServerFn(saveSection);

  useEffect(() => {
    if (!open) return;
    setName(unit?.name ?? "");
    setDescription(unit?.description ?? "");
    setManagerId(unit?.manager_id ?? "none");
    setDepartmentId(unit?.department_id ?? departments[0]?.id ?? "");
  }, [open, unit, departments]);

  const save = useMutation({
    mutationFn: async () => {
      const manager_id = managerId === "none" ? null : managerId;
      if (kind === "department") {
        await saveDept({
          data: { id: unit?.id ?? null, name, description: description || null, manager_id },
        });
      } else {
        if (!departmentId) throw new Error("اختر الإدارة التابع لها القسم");
        await saveSec({
          data: {
            id: unit?.id ?? null,
            department_id: departmentId,
            name,
            description: description || null,
            manager_id,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "تم حفظ التعديلات" : "تمت الإضافة");
      onOpenChange(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const title = `${isEdit ? "تعديل" : "إضافة"} ${kind === "department" ? "إدارة" : "قسم"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {kind === "section" && (
            <div className="space-y-2">
              <Label>الإدارة</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الإدارة" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  تغيير الإدارة ينقل القسم وجميع موظفيه إلى الإدارة الجديدة.
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{kind === "department" ? "مدير الإدارة" : "رئيس القسم"}</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
