import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Save, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttendanceSettings } from "@/components/attendance/AttendanceSettings";
import { BiometricDevices } from "@/components/attendance/BiometricDevices";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  complianceScore,
  formatMinutes,
} from "@/lib/attendance";
import {
  saveAttendanceRecord,
  importAttendance,
  fillMissingAttendance,
} from "@/lib/attendance.functions";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "الدوام والحضور | الموارد البشرية" },
      {
        name: "description",
        content: "متابعة الحضور والغياب والتأخير، استيراد سجلات البصمة، وإعدادات الدوام والعطل.",
      },
      { property: "og:title", content: "الدوام والحضور | الموارد البشرية" },
      {
        property: "og:description",
        content: "سجلات الدوام اليومية والشهرية لموظفي مؤسسة اليتيم التنموية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttendancePage,
});

type ParsedRow = {
  employee_no: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
};

function normalizeTime(v: string | undefined) {
  if (!v) return null;
  const m = /(\d{1,2}):(\d{2})/.exec(v);
  if (!m) return null;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0]!.split(/[,;\t]/).map((h) => h.trim().toLowerCase());
  const idx = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iNo = idx("employee_no", "الرقم", "رقم", "id", "no");
  const iDate = idx("date", "التاريخ", "يوم");
  const iIn = idx("check_in", "in", "حضور", "دخول");
  const iOut = idx("check_out", "out", "انصراف", "خروج");
  if (iNo < 0 || iDate < 0) return [];

  return lines.slice(1).flatMap((line) => {
    const cells = line.split(/[,;\t]/).map((c) => c.trim());
    const no = cells[iNo];
    const rawDate = cells[iDate];
    if (!no || !rawDate) return [];
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return [];
    return [
      {
        employee_no: no,
        work_date: d.toISOString().slice(0, 10),
        check_in: iIn >= 0 ? normalizeTime(cells[iIn]) : null,
        check_out: iOut >= 0 ? normalizeTime(cells[iOut]) : null,
      },
    ];
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m!, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
};

function AttendancePage() {
  const { isDirector, isHR } = useAuth();
  const isAdmin = isDirector || isHR;
  const qc = useQueryClient();

  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));

  const { data: employeesData } = useQuery({
    queryKey: ["attendance-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, employee_no, status")
        .eq("status", "active")
        .order("full_name");
      return data ?? [];
    },
  });
  const employees = employeesData ?? [];

  const { data: dayRecords } = useQuery({
    queryKey: ["attendance", "day", date],
    queryFn: async () => {
      const { data } = await supabase.from("attendance_records").select("*").eq("work_date", date);
      return data ?? [];
    },
  });

  const range = monthRange(month);
  const { data: monthRecords } = useQuery({
    queryKey: ["attendance", "month", month],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .gte("work_date", range.start)
        .lte("work_date", range.end);
      return data ?? [];
    },
  });

  const saveRecordFn = useServerFn(saveAttendanceRecord);
  const importFn = useServerFn(importAttendance);
  const fillFn = useServerFn(fillMissingAttendance);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["attendance"] });

  const saveMut = useMutation({
    mutationFn: (v: {
      employee_id: string;
      work_date: string;
      check_in: string | null;
      check_out: string | null;
      status: "present" | "absent" | "leave" | "holiday" | "permission";
    }) => saveRecordFn({ data: v }),
    onSuccess: () => {
      toast.success("تم حفظ سجل الدوام");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fillMut = useMutation({
    mutationFn: () => fillFn({ data: range }),
    onSuccess: (r) => {
      toast.success(`تم توليد ${r.created} سجل للأيام غير المسجلة`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── الاستيراد ── */
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);

  const matched = useMemo(() => {
    const map = new Map(employees.map((e) => [e.employee_no, e]));
    return preview.map((r) => ({ ...r, employee: map.get(r.employee_no) ?? null }));
  }, [preview, employees]);
  const validRows = matched.filter((r) => r.employee);

  const importMut = useMutation({
    mutationFn: () =>
      importFn({
        data: {
          rows: validRows.map((r) => ({
            employee_id: r.employee!.id,
            work_date: r.work_date,
            check_in: r.check_in,
            check_out: r.check_out,
          })),
        },
      }),
    onSuccess: (r) => {
      toast.success(`تم استيراد ${r.imported} سجل دوام`);
      setPreview([]);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── ملخص شهري ── */
  const monthly = useMemo(() => {
    const rows = monthRecords ?? [];
    return employees.map((e) => {
      const mine = rows.filter((r) => r.employee_id === e.id);
      const count = (s: string) => mine.filter((r) => r.status === s).length;
      return {
        employee: e,
        present: count("present") + count("permission"),
        absent: count("absent"),
        leave: count("leave"),
        late: mine.reduce((s, r) => s + (r.late_minutes ?? 0), 0),
        early: mine.reduce((s, r) => s + (r.early_leave_minutes ?? 0), 0),
        score: complianceScore(
          mine.map((r) => ({
            status: String(r.status),
            late_minutes: r.late_minutes ?? 0,
            early_leave_minutes: r.early_leave_minutes ?? 0,
          })),
        ),
      };
    });
  }, [monthRecords, employees]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة الدوام والحضور"
        description="سجلات الحضور اليومية والشهرية، استيراد البصمة، وإعدادات أيام العمل والعطل"
      />

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">اليومي</TabsTrigger>
          <TabsTrigger value="monthly">الملخص الشهري</TabsTrigger>
          {isAdmin && <TabsTrigger value="import">استيراد البصمة</TabsTrigger>}
          {isAdmin && <TabsTrigger value="settings">الإعدادات</TabsTrigger>}
        </TabsList>

        {/* اليومي */}
        <TabsContent value="daily" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            <div className="w-full space-y-2 sm:w-auto">
              <Label>اليوم</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full sm:w-48"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              الحاضرون:{" "}
              {(dayRecords ?? []).filter((r) => r.status === "present" || r.status === "permission").length} /{" "}
              {employees.length}
            </p>
          </div>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="p-3">الموظف</th>
                    <th className="p-3">الرقم</th>
                    <th className="p-3">الحضور</th>
                    <th className="p-3">الانصراف</th>
                    <th className="p-3">التأخير</th>
                    <th className="p-3">انصراف مبكر</th>
                    <th className="p-3">الحالة</th>
                    {isAdmin && <th className="p-3">حفظ</th>}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => {
                    const r = (dayRecords ?? []).find((x) => x.employee_id === e.id);
                    return (
                      <DayRow
                        key={e.id}
                        employee={e}
                        record={r ?? null}
                        editable={isAdmin}
                        saving={saveMut.isPending}
                        onSave={(v) => saveMut.mutate({ ...v, employee_id: e.id, work_date: date })}
                      />
                    );
                  })}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-muted-foreground">
                        لا يوجد موظفون نشطون
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* الشهري */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            <div className="w-full space-y-2 sm:w-auto">
              <Label>الشهر</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full sm:w-48"
              />
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => fillMut.mutate()} disabled={fillMut.isPending}>
                <Wand2 className="size-4" /> توليد الأيام غير المسجلة
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="p-3">الموظف</th>
                    <th className="p-3">أيام الحضور</th>
                    <th className="p-3">الغياب</th>
                    <th className="p-3">الإجازات</th>
                    <th className="p-3">إجمالي التأخير</th>
                    <th className="p-3">الانصراف المبكر</th>
                    <th className="p-3">نسبة الالتزام</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.employee.id} className="border-t">
                      <td className="p-3">{m.employee.full_name}</td>
                      <td className="p-3">{m.present}</td>
                      <td className="p-3">{m.absent}</td>
                      <td className="p-3">{m.leave}</td>
                      <td className="p-3">{formatMinutes(m.late)}</td>
                      <td className="p-3">{formatMinutes(m.early)}</td>
                      <td className="p-3">
                        <Badge variant={m.score >= 90 ? "default" : m.score >= 70 ? "secondary" : "destructive"}>
                          {m.score}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* الاستيراد */}
        {isAdmin && (
          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">صيغة الملف المتوقعة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground">
                <p>
                  أعمدة: الرقم الوظيفي (employee_no) — التاريخ (date) — الحضور (check_in) — الانصراف
                  (check_out). يقبل النظام الفواصل «,» أو «;» أو Tab.
                </p>
                <p>
                  يتم احتساب التأخير والانصراف المبكر تلقائياً حسب إعدادات الدوام، وتُحدَّد العطل
                  والإجازات المعتمدة تلقائياً.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    const rows = parseCsv(await f.text());
                    if (rows.length === 0) {
                      toast.error("تعذر قراءة الملف — تأكد من أعمدة الرقم الوظيفي والتاريخ");
                      return;
                    }
                    setPreview(rows);
                  }}
                />
                <Button size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" /> اختيار ملف CSV
                </Button>
              </CardContent>
            </Card>

            {preview.length > 0 && (
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-sm">
                    معاينة: {validRows.length} صف مطابق من {preview.length}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPreview([])}>
                      إلغاء
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => importMut.mutate()}
                      disabled={importMut.isPending || validRows.length === 0}
                    >
                      تأكيد الاستيراد
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="max-h-96 overflow-auto p-0">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-muted/60 text-xs">
                      <tr>
                        <th className="p-3">الرقم الوظيفي</th>
                        <th className="p-3">الموظف</th>
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">الحضور</th>
                        <th className="p-3">الانصراف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matched.slice(0, 300).map((r, i) => (
                        <tr key={`${r.employee_no}-${r.work_date}-${i}`} className="border-t">
                          <td className="p-3">{r.employee_no}</td>
                          <td className="p-3">
                            {r.employee?.full_name ?? (
                              <span className="text-destructive">غير مطابق — سيُتجاهل</span>
                            )}
                          </td>
                          <td className="p-3">{r.work_date}</td>
                          <td className="p-3">{r.check_in ?? "—"}</td>
                          <td className="p-3">{r.check_out ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="settings">
            <AttendanceSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

type DayRecord = {
  check_in: string | null;
  check_out: string | null;
  status: string;
  late_minutes: number | null;
  early_leave_minutes: number | null;
};

function DayRow({
  employee,
  record,
  editable,
  saving,
  onSave,
}: {
  employee: { id: string; full_name: string; employee_no: string };
  record: DayRecord | null;
  editable: boolean;
  saving: boolean;
  onSave: (v: {
    check_in: string | null;
    check_out: string | null;
    status: "present" | "absent" | "leave" | "holiday" | "permission";
  }) => void;
}) {
  const [checkIn, setCheckIn] = useState(record?.check_in?.slice(0, 5) ?? "");
  const [checkOut, setCheckOut] = useState(record?.check_out?.slice(0, 5) ?? "");
  const [status, setStatus] = useState(String(record?.status ?? "absent"));
  const key = `${record?.check_in ?? ""}|${record?.check_out ?? ""}|${record?.status ?? ""}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setCheckIn(record?.check_in?.slice(0, 5) ?? "");
    setCheckOut(record?.check_out?.slice(0, 5) ?? "");
    setStatus(String(record?.status ?? "absent"));
  }

  if (!editable) {
    return (
      <tr className="border-t">
        <td className="p-3">{employee.full_name}</td>
        <td className="p-3">{employee.employee_no}</td>
        <td className="p-3">{record?.check_in?.slice(0, 5) ?? "—"}</td>
        <td className="p-3">{record?.check_out?.slice(0, 5) ?? "—"}</td>
        <td className="p-3">{formatMinutes(record?.late_minutes ?? 0)}</td>
        <td className="p-3">{formatMinutes(record?.early_leave_minutes ?? 0)}</td>
        <td className="p-3">
          <Badge variant={record?.status === "present" ? "default" : "secondary"}>
            {ATTENDANCE_STATUS_LABELS[record?.status ?? "absent"]}
          </Badge>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t">
      <td className="p-3">{employee.full_name}</td>
      <td className="p-3">{employee.employee_no}</td>
      <td className="p-2">
        <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-32" />
      </td>
      <td className="p-2">
        <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-32" />
      </td>
      <td className="p-3">{formatMinutes(record?.late_minutes ?? 0)}</td>
      <td className="p-3">{formatMinutes(record?.early_leave_minutes ?? 0)}</td>
      <td className="p-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATTENDANCE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ATTENDANCE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <Button
          size="icon"
          variant="ghost"
          disabled={saving}
          onClick={() =>
            onSave({
              check_in: checkIn || null,
              check_out: checkOut || null,
              status: status as "present",
            })
          }
        >
          <Save className="size-4" />
        </Button>
      </td>
    </tr>
  );
}
