import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarClock,
  Clock,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Building2,
  Layers,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DAY_NAMES, type ShiftRow } from "@/lib/attendance";
import { formatDate } from "@/lib/hr";
import {
  listShifts,
  saveShift,
  deleteShift,
  assignShift,
  deleteShiftAssignment,
} from "@/lib/shifts.functions";

interface ShiftManagementProps {
  employees: { id: string; full_name: string; employee_no: string }[];
  departments: { id: string; name: string }[];
  sections: { id: string; name: string; department_id: string }[];
}

const COLOR_PRESETS = [
  "#0284c7", // Sky Blue
  "#16a34a", // Emerald Green
  "#d97706", // Amber
  "#9333ea", // Purple
  "#dc2626", // Red
  "#4f46e5", // Indigo
  "#0d9488", // Teal
  "#e11d48", // Rose
];

export function ShiftManagement({
  employees,
  departments,
  sections,
}: ShiftManagementProps) {
  const qc = useQueryClient();
  const fetchShiftsFn = useServerFn(listShifts);
  const saveShiftFn = useServerFn(saveShift);
  const deleteShiftFn = useServerFn(deleteShift);
  const assignShiftFn = useServerFn(assignShift);
  const deleteAssignmentFn = useServerFn(deleteShiftAssignment);

  const { data, isLoading } = useQuery({
    queryKey: ["shifts-management"],
    queryFn: () => fetchShiftsFn(),
  });

  const shifts = (data?.shifts ?? []) as ShiftRow[];
  const assignments = (data?.assignments ?? []) as Array<{
    id: string;
    shift_id: string;
    employee_id: string | null;
    department_id: string | null;
    section_id: string | null;
    start_date: string;
    end_date: string | null;
    notes: string | null;
    shift?: { id: string; name: string; code: string; color: string; start_time: string; end_time: string } | null;
    employee?: { id: string; full_name: string; employee_no: string } | null;
    department?: { id: string; name: string } | null;
    section?: { id: string; name: string } | null;
  }>;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["shifts-management"] });
    void qc.invalidateQueries({ queryKey: ["attendance"] });
    void qc.invalidateQueries({ queryKey: ["attendance-config"] });
  };

  // ──── Shift Form State ────
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftRow | null>(null);
  const [shiftForm, setShiftForm] = useState({
    name: "",
    code: "",
    start_time: "08:00",
    end_time: "15:00",
    work_days: [0, 1, 2, 3, 4],
    grace_minutes: 10,
    is_night_shift: false,
    overtime_enabled: true,
    min_overtime_minutes: 30,
    color: "#0284c7",
    is_default: false,
    active: true,
    notes: "",
  });

  const openNewShift = () => {
    setEditingShift(null);
    setShiftForm({
      name: "",
      code: `shift-${Date.now().toString().slice(-4)}`,
      start_time: "08:00",
      end_time: "15:00",
      work_days: [0, 1, 2, 3, 4],
      grace_minutes: 10,
      is_night_shift: false,
      overtime_enabled: true,
      min_overtime_minutes: 30,
      color: "#0284c7",
      is_default: false,
      active: true,
      notes: "",
    });
    setShiftDialogOpen(true);
  };

  const openEditShift = (sh: ShiftRow) => {
    setEditingShift(sh);
    setShiftForm({
      name: sh.name,
      code: sh.code,
      start_time: sh.start_time,
      end_time: sh.end_time,
      work_days: sh.work_days ?? [0, 1, 2, 3, 4],
      grace_minutes: sh.grace_minutes ?? 10,
      is_night_shift: Boolean(sh.is_night_shift),
      overtime_enabled: Boolean(sh.overtime_enabled),
      min_overtime_minutes: sh.min_overtime_minutes ?? 30,
      color: sh.color || "#0284c7",
      is_default: Boolean(sh.is_default),
      active: Boolean(sh.active),
      notes: sh.notes ?? "",
    });
    setShiftDialogOpen(true);
  };

  const saveShiftMut = useMutation({
    mutationFn: () =>
      saveShiftFn({
        data: {
          ...shiftForm,
          id: editingShift ? editingShift.id : null,
        },
      }),
    onSuccess: () => {
      toast.success(editingShift ? "تم تحديث الوردية" : "تمت إضافة الوردية بنجاح");
      setShiftDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteShiftMut = useMutation({
    mutationFn: (id: string) => deleteShiftFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الوردية");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ──── Assignment Form State ────
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    shift_id: "",
    target_type: "employee" as "employee" | "department" | "section",
    target_id: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    notes: "",
  });

  const assignShiftMut = useMutation({
    mutationFn: () =>
      assignShiftFn({
        data: {
          shift_id: assignForm.shift_id,
          target_type: assignForm.target_type,
          target_id: assignForm.target_id,
          start_date: assignForm.start_date,
          end_date: assignForm.end_date || null,
          notes: assignForm.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("تم تعيين الوردية بنجاح");
      setAssignDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAssignMut = useMutation({
    mutationFn: (id: string) => deleteAssignmentFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم إلغاء تعيين الوردية");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDay = (dayIndex: number) => {
    setShiftForm((prev) => ({
      ...prev,
      work_days: prev.work_days.includes(dayIndex)
        ? prev.work_days.filter((d) => d !== dayIndex)
        : [...prev.work_days, dayIndex].sort(),
    }));
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="shifts" dir="rtl" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <TabsList>
            <TabsTrigger value="shifts" className="gap-2">
              <Clock className="size-4" /> تعريف الورديات ({shifts.length})
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2">
              <CalendarClock className="size-4" /> تعيينات الجداول والورديات ({assignments.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button size="sm" onClick={openNewShift} className="gap-1.5">
              <Plus className="size-4" /> وردية جديدة
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (shifts.length === 0) {
                  toast.error("يرجى إنشاء وردية أولاً");
                  return;
                }
                setAssignForm({
                  shift_id: shifts[0]?.id ?? "",
                  target_type: "employee",
                  target_id: employees[0]?.id ?? "",
                  start_date: new Date().toISOString().slice(0, 10),
                  end_date: "",
                  notes: "",
                });
                setAssignDialogOpen(true);
              }}
              className="gap-1.5"
            >
              <Users className="size-4" /> تعيين وردية
            </Button>
          </div>
        </div>

        {/* ──── تبويب الورديات ──── */}
        <TabsContent value="shifts" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shifts.map((sh) => (
              <Card key={sh.id} className="relative overflow-hidden transition-all hover:shadow-md">
                <div
                  className="absolute right-0 top-0 h-full w-2"
                  style={{ backgroundColor: sh.color || "#0284c7" }}
                />
                <CardHeader className="pb-2 pr-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base font-bold">
                        {sh.name}
                        {sh.is_default && (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <CheckCircle2 className="size-3 text-primary" /> الافتراضية
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">الرمز: {sh.code}</CardDescription>
                    </div>
                    {sh.is_night_shift ? (
                      <span className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                        <Moon className="size-3" /> نوبة ليلية
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        <Sun className="size-3" /> دوام نهاري
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pr-6 text-sm">
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">التوقيت:</span>{" "}
                      <span className="font-semibold">
                        {sh.start_time} — {sh.end_time}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">فترة السماح:</span>{" "}
                      <span className="font-semibold">{sh.grace_minutes} دقيقة</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">حساب الإضافي:</span>{" "}
                      <span className="font-semibold">
                        {sh.overtime_enabled ? `نعم (+${sh.min_overtime_minutes}د)` : "معطل"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الحالة:</span>{" "}
                      <span className={sh.active ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                        {sh.active ? "نشطة" : "متوقفة"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">أيام العمل:</p>
                    <div className="flex flex-wrap gap-1">
                      {DAY_NAMES.map((name, idx) => {
                        const active = (sh.work_days ?? []).includes(idx);
                        return (
                          <span
                            key={name}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              active
                                ? "bg-primary/15 text-primary font-bold"
                                : "bg-muted/40 text-muted-foreground opacity-50"
                            }`}
                          >
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {sh.notes && <p className="text-xs text-muted-foreground">{sh.notes}</p>}

                  <div className="flex items-center justify-end gap-2 border-t pt-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditShift(sh)}>
                      <Pencil className="size-3.5" /> تعديل
                    </Button>
                    {!sh.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف وردية «${sh.name}»؟`)) {
                            deleteShiftMut.mutate(sh.id);
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" /> حذف
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ──── تبويب تعيينات الورديات ──── */}
        <TabsContent value="assignments" className="space-y-4 pt-4">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">نوع التعيين</TableHead>
                    <TableHead className="text-right">الهدف / المعين له</TableHead>
                    <TableHead className="text-right">الوردية</TableHead>
                    <TableHead className="text-right">تاريخ البدء</TableHead>
                    <TableHead className="text-right">تاريخ الانتهاء</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-right">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        لا توجد تعيينات مخصصة، يتم تطبيق الوردية الافتراضية على الجميع.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignments.map((a) => (
                      <TableRow key={a.id} className="hover:bg-accent/40">
                        <TableCell>
                          {a.employee_id ? (
                            <Badge variant="outline" className="gap-1">
                              <Users className="size-3" /> موظف
                            </Badge>
                          ) : a.section_id ? (
                            <Badge variant="outline" className="gap-1">
                              <Layers className="size-3" /> قسم
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Building2 className="size-3" /> إدارة
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {a.employee
                            ? `${a.employee.full_name} (${a.employee.employee_no})`
                            : a.section
                              ? a.section.name
                              : a.department?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-xs"
                            style={{ backgroundColor: a.shift?.color || "#0284c7" }}
                          >
                            <Clock className="size-3" /> {a.shift?.name}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(a.start_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {a.end_date ? formatDate(a.end_date) : <span className="text-emerald-600 font-medium">مستمر / دائم</span>}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {a.notes || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("هل تريد إلغاء هذا التعيين؟")) {
                                deleteAssignMut.mutate(a.id);
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ──── نافذة إضافة / تعديل وردية ──── */}
      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingShift ? "تعديل الوردية" : "إضافة وردية جديدة"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>اسم الوردية</Label>
              <Input
                value={shiftForm.name}
                onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                placeholder="مثال: الوردية المسائية، نوبة الحراسة..."
              />
            </div>

            <div className="space-y-2">
              <Label>رمز الوردية (Code)</Label>
              <Input
                value={shiftForm.code}
                onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value })}
                placeholder="evening-shift"
              />
            </div>

            <div className="space-y-2">
              <Label>لون الوردية</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={shiftForm.color}
                  onChange={(e) => setShiftForm({ ...shiftForm, color: e.target.value })}
                  className="h-9 w-14 p-1"
                />
                <div className="flex flex-wrap gap-1">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="size-6 rounded-full border shadow-xs transition hover:scale-110"
                      style={{ backgroundColor: c }}
                      onClick={() => setShiftForm({ ...shiftForm, color: c })}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>وقت بدء الدوام (الحضور)</Label>
              <Input
                type="time"
                value={shiftForm.start_time}
                onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>وقت نهاية الدوام (الانصراف)</Label>
              <Input
                type="time"
                value={shiftForm.end_time}
                onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>فترة السماح بالتأخير (دقائق)</Label>
              <Input
                type="number"
                value={shiftForm.grace_minutes}
                onChange={(e) =>
                  setShiftForm({ ...shiftForm, grace_minutes: Number(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>الحد الأدنى لاحتساب الإضافي (دقائق)</Label>
              <Input
                type="number"
                value={shiftForm.min_overtime_minutes}
                onChange={(e) =>
                  setShiftForm({ ...shiftForm, min_overtime_minutes: Number(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>أيام عمل الوردية</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {DAY_NAMES.map((name, index) => {
                  const selected = shiftForm.work_days.includes(index);
                  return (
                    <Button
                      key={name}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => toggleDay(index)}
                      className="h-8 text-xs"
                    >
                      {name}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 sm:col-span-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>احتساب الساعات الإضافية (Overtime)</Label>
                  <p className="text-xs text-muted-foreground">
                    احتساب الدوام بعد وقت الانصراف أو في العطل كساعات عمل إضافي.
                  </p>
                </div>
                <Switch
                  checked={shiftForm.overtime_enabled}
                  onCheckedChange={(checked) =>
                    setShiftForm({ ...shiftForm, overtime_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>نوبة ليلية (Night Shift)</Label>
                  <p className="text-xs text-muted-foreground">
                    تفعيل هذا الخيار إذا كانت الوردية تبدأ مساءً وتنتهي في صباح اليوم التالي.
                  </p>
                </div>
                <Switch
                  checked={shiftForm.is_night_shift}
                  onCheckedChange={(checked) =>
                    setShiftForm({ ...shiftForm, is_night_shift: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>الوردية الافتراضية للنظام</Label>
                  <p className="text-xs text-muted-foreground">
                    تُطبق تلقائياً على أي موظف لم يُخصص له جدول وردية آخر.
                  </p>
                </div>
                <Switch
                  checked={shiftForm.is_default}
                  onCheckedChange={(checked) =>
                    setShiftForm({ ...shiftForm, is_default: checked })
                  }
                />
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Input
                value={shiftForm.notes}
                onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                placeholder="ملاحظات توضيحية حول الوردية..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => saveShiftMut.mutate()}
              disabled={!shiftForm.name || !shiftForm.code || saveShiftMut.isPending}
            >
              حفظ الوردية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──── نافذة تعيين وردية ──── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعيين وردية لموظف أو إدارة أو قسم</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>اختر الوردية</Label>
              <Select
                value={assignForm.shift_id}
                onValueChange={(v) => setAssignForm({ ...assignForm, shift_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الوردية" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((sh) => (
                    <SelectItem key={sh.id} value={sh.id}>
                      {sh.name} ({sh.start_time} - {sh.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>نطاق التعيين</Label>
              <Select
                value={assignForm.target_type}
                onValueChange={(v) =>
                  setAssignForm({
                    ...assignForm,
                    target_type: v as "employee" | "department" | "section",
                    target_id:
                      v === "employee"
                        ? employees[0]?.id ?? ""
                        : v === "department"
                          ? departments[0]?.id ?? ""
                          : sections[0]?.id ?? "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">موظف محدد</SelectItem>
                  <SelectItem value="department">إدارة كاملة</SelectItem>
                  <SelectItem value="section">قسم محدد</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {assignForm.target_type === "employee" && (
              <div className="space-y-2">
                <Label>الموظف</Label>
                <Select
                  value={assignForm.target_id}
                  onValueChange={(v) => setAssignForm({ ...assignForm, target_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الموظف" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name} ({e.employee_no})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {assignForm.target_type === "department" && (
              <div className="space-y-2">
                <Label>الإدارة</Label>
                <Select
                  value={assignForm.target_id}
                  onValueChange={(v) => setAssignForm({ ...assignForm, target_id: v })}
                >
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
              </div>
            )}

            {assignForm.target_type === "section" && (
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select
                  value={assignForm.target_id}
                  onValueChange={(v) => setAssignForm({ ...assignForm, target_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>تاريخ بدء السريان</Label>
                <Input
                  type="date"
                  value={assignForm.start_date}
                  onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>تاريخ الانتهاء (اختياري)</Label>
                <Input
                  type="date"
                  value={assignForm.end_date}
                  onChange={(e) => setAssignForm({ ...assignForm, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                placeholder="سبب التخصيص أو الملاحظات..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => assignShiftMut.mutate()}
              disabled={!assignForm.shift_id || !assignForm.target_id || assignShiftMut.isPending}
            >
              تأكيد التعيين
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
