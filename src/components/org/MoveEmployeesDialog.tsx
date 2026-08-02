import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveEmployees } from "@/lib/org.functions";

type Emp = {
  id: string;
  full_name: string;
  department_id?: string | null;
  section_id?: string | null;
};

export function MoveEmployeesDialog({
  employees,
  departments,
  sections,
  onDone,
  preselected,
  triggerLabel = "نقل موظفين",
}: {
  employees: Emp[];
  departments: { id: string; name: string }[];
  sections: { id: string; name: string; department_id: string }[];
  onDone: () => void;
  preselected?: string[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [ids, setIds] = useState<string[]>(preselected ?? []);
  const [deptId, setDeptId] = useState("none");
  const [secId, setSecId] = useState("none");
  const move = useServerFn(moveEmployees);

  const filtered = useMemo(
    () => (q.trim() ? employees.filter((e) => e.full_name.includes(q.trim())) : employees),
    [employees, q],
  );
  const deptSections = sections.filter((s) => s.department_id === deptId);

  const run = useMutation({
    mutationFn: async () => {
      if (ids.length === 0) throw new Error("اختر موظفاً واحداً على الأقل");
      await move({
        data: {
          employeeIds: ids,
          department_id: deptId === "none" ? null : deptId,
          section_id: secId === "none" ? null : secId,
        },
      });
    },
    onSuccess: () => {
      toast.success(`تم نقل ${ids.length} موظف`);
      setOpen(false);
      setIds([]);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowLeftRight className="size-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>نقل موظفين بين الوحدات</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>الإدارة الجديدة</Label>
              <Select
                value={deptId}
                onValueChange={(v) => {
                  setDeptId(v);
                  setSecId("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون إدارة</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>القسم الجديد</Label>
              <Select value={secId} onValueChange={setSecId} disabled={deptId === "none"}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون قسم</SelectItem>
                  {deptSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Input placeholder="بحث عن موظف" value={q} onChange={(e) => setQ(e.target.value)} />

          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
            {filtered.map((e) => (
              <label key={e.id} className="flex items-center gap-2 rounded p-1 text-sm hover:bg-muted">
                <Checkbox
                  checked={ids.includes(e.id)}
                  onCheckedChange={(c) =>
                    setIds((prev) => (c ? [...prev, e.id] : prev.filter((x) => x !== e.id)))
                  }
                />
                {e.full_name}
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">لا نتائج.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">المحددون: {ids.length}</p>
        </div>

        <DialogFooter>
          <Button onClick={() => run.mutate()} disabled={run.isPending || ids.length === 0}>
            تنفيذ النقل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
