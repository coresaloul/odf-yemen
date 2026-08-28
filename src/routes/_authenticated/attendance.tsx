import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Save, Wand2, Clock, Sparkles } from "lucide-react";
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
import { ShiftManagement } from "@/components/attendance/ShiftManagement";
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
        content: "متابعة الحضور والغياب والتأخير والورديات، استيراد سجلات البصمة، وحساب الساعات الإضافية.",
      },
      { property: "og:title", content: "الدوام والحضور | الموارد البشرية" },
      {
        property: "og:description",
        content: "سجلات الدوام اليومية والشهرية وإدارة الورديات لموظفي مؤسسة اليتيم التنموية.",
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
  const { employee, isDirector, isHR } = useAuth();
  const isAdmin = isDirector || isHR;
  const qc = useQueryClient();

  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));

  const { data: baseData } = useQuery({
    queryKey: ["attendance-base-data"],
    queryFn: async () => {
      const [{ data: emps }, { data: depts }, { data: secs }, { data: shifts }] = await Promise.all([
        supabase
          .from("employees")
          .select("id, full_name, employee_no, status, department_id, section_id")
          .eq("status", "active")
          .order("full_name"),
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("sections").select("id, name, department_id").order("name"),
        supabase.from("work_shifts").select("id, name, code, color, start_time, end_time"),
      ]);
      return {
        employees: emps ?? [],
        departments: depts ?? [],
        sections: secs ?? [],
        shifts: shifts ?? [],
      };
    },
  });

  const employees = baseData?.employees ?? [];
  const departments = baseData?.departments ?? [];
  const sections = baseData?.sections ?? [];
  const shifts = baseData?.shifts ?? [];
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));

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
        overtime: mine.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0),
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

  /* ── سجلات الموظف الشخصية ── */
  const myAttendanceRows = useMemo(() => {
    if (!employee?.id) return [];
    return (monthRecords ?? [])
      .filter((r) => r.employee_id === employee.id)
      .sort((a, b) => b.work_date.localeCompare(a.work_date));
  }, [monthRecords, employee?.id]);

  const myMonthlyStats = useMemo(() => {
    const count = (s: string) => myAttendanceRows.filter((r) => r.status === s).length;
    return {
      present: count("present") + count("permission"),
      absent: count("absent"),
      leave: count("leave"),
      late: myAttendanceRows.reduce((s, r) => s + (r.late_minutes ?? 0), 0),
      early: myAttendanceRows.reduce((s, r) => s + (r.early_leave_minutes ?? 0), 0),
      overtime: myAttendanceRows.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0),
      score: complianceScore(
        myAttendanceRows.map((r) => ({
          status: String(r.status),
          late_minutes: r.late_minutes ?? 0,
          early_leave_minutes: r.early_leave_minutes ?? 0,
        })),
      ),
    };
  }, [myAttendanceRows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة الدوام والورديات"
        description="سجلات الحضور اليومية والشهرية، إدارة الورديات والجداول المرنة، استيراد البصمة، وحساب الإضافي"
      />

      <Tabs defaultValue={isAdmin ? "daily" : "my-attendance"} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="my-attendance">دوامي الشخصي</TabsTrigger>
          <TabsTrigger value="daily">اليومي</TabsTrigger>
          <TabsTrigger value="monthly">الملخص الشهري</TabsTrigger>
          {isAdmin && <TabsTrigger value="shifts">إدارة الورديات</TabsTrigger>}
          {isAdmin && <TabsTrigger value="import">استيراد البصمة</TabsTrigger>}
          {isAdmin && <TabsTrigger value="devices">أجهزة البصمة</TabsTrigger>}
          {isAdmin && <TabsTrigger value="settings">الإعدادات</TabsTrigger>}
        </TabsList>

        {/* دوامي الشخصي */}
        <TabsContent value="my-attendance" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
            <div className="w-full space-y-2 sm:w-auto">
              <Label>الشهر</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full sm:w-48"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              متابعة حضورك الشخصي والتأخيرات وساعات العمل الإضافية
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs text-muted-foreground">أيام الحضور المسجلة</p>
                <p className="mt-1 font-display text-2xl font-bold text-primary sm:text-3xl">
                  {myMonthlyStats.present}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">خلال شهر {month}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs text-muted-foreground">نسبة الالتزام والانضباط</p>
                <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                  {myMonthlyStats.score}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">معدل الانضباط التراكمي</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs text-muted-foreground">إجمالي التأخير المسجل</p>
                <p className="mt-1 font-display text-2xl font-bold text-amber-600 sm:text-3xl">
                  {formatMinutes(myMonthlyStats.late)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">انصراف مبكر: {formatMinutes(myMonthlyStats.early)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs text-muted-foreground">الساعات الإضافية</p>
                <p className="mt-1 font-display text-2xl font-bold text-indigo-600 sm:text-3xl">
                  +{formatMinutes(myMonthlyStats.overtime)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">إضافي معتمد</p>
              </CardContent>
            </Card>
          </div>

          {myAttendanceRows.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                لا توجد سجلات دوام مسجلة لك في هذا الشهر ({month}).
              </CardContent>
            </Card>
          ) : (
            <>
              {/* عرض البطاقات على الهواتف */}
              <div className="space-y-3 sm:hidden">
                {myAttendanceRows.map((r) => {
                  const shiftObj = r.shift_id ? shiftMap.get(r.shift_id) : null;
                  return (
                    <Card key={r.id} className="overflow-hidden border-border/80">
                      <CardContent className="space-y-2.5 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{r.work_date}</span>
                            {shiftObj && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: shiftObj.color || "#0284c7" }}
                              >
                                <Clock className="size-2.5" /> {shiftObj.name}
                              </span>
                            )}
                          </div>
                          <Badge variant={r.status === "present" ? "default" : "secondary"}>
                            {ATTENDANCE_STATUS_LABELS[r.status ?? "absent"]}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                          <div>
                            <span className="text-muted-foreground">الحضور: </span>
                            <span className="font-mono font-medium text-foreground">{r.check_in?.slice(0, 5) ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">الانصراف: </span>
                            <span className="font-mono font-medium text-foreground">{r.check_out?.slice(0, 5) ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">التأخير: </span>
                            <span className={(r.late_minutes ?? 0) > 0 ? "font-semibold text-amber-600" : "text-muted-foreground"}>
                              {formatMinutes(r.late_minutes ?? 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">الإضافي: </span>
                            <span className={(r.overtime_minutes ?? 0) > 0 ? "font-semibold text-emerald-600" : "text-muted-foreground"}>
                              {(r.overtime_minutes ?? 0) > 0 ? `+${formatMinutes(r.overtime_minutes ?? 0)}` : "—"}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* عرض الجدول على الشاشات المتوسطة والكبيرة */}
              <Card className="hidden sm:block">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">سجل بصمات وحضور الشهر</CardTitle>
                </CardHeader>
                <CardContent className="touch-scroll overflow-x-auto p-0">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-muted/60 text-xs">
                      <tr>
                        <th className="p-3">تاريخ اليوم</th>
                        <th className="p-3">الوردية</th>
                        <th className="p-3">وقت الحضور</th>
                        <th className="p-3">وقت الانصراف</th>
                        <th className="p-3">التأخير</th>
                        <th className="p-3">انصراف مبكر</th>
                        <th className="p-3">ساعات إضافية</th>
                        <th className="p-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myAttendanceRows.map((r) => {
                        const shiftObj = r.shift_id ? shiftMap.get(r.shift_id) : null;
                        return (
                          <tr key={r.id} className="border-t transition-colors hover:bg-muted/30">
                            <td className="p-3 font-medium">{r.work_date}</td>
                            <td className="p-3">
                              {shiftObj ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                  style={{ backgroundColor: shiftObj.color || "#0284c7" }}
                                >
                                  <Clock className="size-2.5" /> {shiftObj.name}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">الافتراضية</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-xs">{r.check_in?.slice(0, 5) ?? "—"}</td>
                            <td className="p-3 font-mono text-xs">{r.check_out?.slice(0, 5) ?? "—"}</td>
                            <td className="p-3 text-xs">{formatMinutes(r.late_minutes ?? 0)}</td>
                            <td className="p-3 text-xs">{formatMinutes(r.early_leave_minutes ?? 0)}</td>
                            <td className="p-3 text-xs">
                              {(r.overtime_minutes ?? 0) > 0 ? (
                                <span className="font-semibold text-emerald-600">+{formatMinutes(r.overtime_minutes ?? 0)}</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-3">
                              <Badge variant={r.status === "present" ? "default" : "secondary"}>
                                {ATTENDANCE_STATUS_LABELS[r.status ?? "absent"]}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

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
              {
                (dayRecords ?? []).filter(
                  (r) => r.status === "present" || r.status === "permission",
                ).length
              }{" "}
              / {employees.length}
            </p>
          </div>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="p-3">الموظف</th>
                    <th className="p-3">الرقم</th>
                    <th className="p-3">الوردية</th>
                    <th className="p-3">الحضور</th>
                    <th className="p-3">الانصراف</th>
                    <th className="p-3">التأخير</th>
                    <th className="p-3">انصراف مبكر</th>
                    <th className="p-3">إضافي (Overtime)</th>
                    <th className="p-3">الحالة</th>
                    {isAdmin && <th className="p-3">حفظ</th>}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => {
                    const r = (dayRecords ?? []).find((x) => x.employee_id === e.id);
                    const shiftObj = r?.shift_id ? shiftMap.get(r.shift_id) : null;
                    return (
                      <DayRow
                        key={e.id}
                        employee={e}
                        record={r ?? null}
                        shift={shiftObj ?? null}
                        editable={isAdmin}
                        saving={saveMut.isPending}
                        onSave={(v) => saveMut.mutate({ ...v, employee_id: e.id, work_date: date })}
                      />
                    );
                  })}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-4 text-center text-muted-foreground">
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => fillMut.mutate()}
                disabled={fillMut.isPending}
              >
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
                    <th className="p-3">الساعات الإضافية</th>
                    <th className="p-3">نسبة الالتزام</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.employee.id} className="border-t">
                      <td className="p-3 font-medium">{m.employee.full_name}</td>
                      <td className="p-3">{m.present}</td>
                      <td className="p-3">{m.absent}</td>
                      <td className="p-3">{m.leave}</td>
                      <td className="p-3">{formatMinutes(m.late)}</td>
                      <td className="p-3">{formatMinutes(m.early)}</td>
                      <td className="p-3">
                        {m.overtime > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <Sparkles className="size-3" /> {formatMinutes(m.overtime)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            m.score >= 90 ? "default" : m.score >= 70 ? "secondary" : "destructive"
                          }
                        >
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

        {/* إدارة الورديات */}
        {isAdmin && (
          <TabsContent value="shifts">
            <ShiftManagement
              employees={employees}
              departments={departments}
              sections={sections}
            />
          </TabsContent>
        )}

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
                  يتم احتساب التأخير والانصراف المبكر والساعات الإضافية تلقائياً وفق وردية كل موظف،
                  وتُحدَّد العطل والإجازات المعتمدة تلقائياً.
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

        {/* أجهزة البصمة */}
        {isAdmin && (
          <TabsContent value="devices">
            <BiometricDevices />
          </TabsContent>
        )}

        {/* الإعدادات */}
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
  overtime_minutes?: number | null;
  shift_id?: string | null;
};

function DayRow({
  employee,
  record,
  shift,
  editable,
  saving,
  onSave,
}: {
  employee: { id: string; full_name: string; employee_no: string };
  record: DayRecord | null;
  shift?: { id: string; name: string; color: string } | null;
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

  const overtime = record?.overtime_minutes ?? 0;

  if (!editable) {
    return (
      <tr className="border-t">
        <td className="p-3">{employee.full_name}</td>
        <td className="p-3">{employee.employee_no}</td>
        <td className="p-3">
          {shift ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: shift.color || "#0284c7" }}
            >
              <Clock className="size-2.5" /> {shift.name}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="p-3">{record?.check_in?.slice(0, 5) ?? "—"}</td>
        <td className="p-3">{record?.check_out?.slice(0, 5) ?? "—"}</td>
        <td className="p-3">{formatMinutes(record?.late_minutes ?? 0)}</td>
        <td className="p-3">{formatMinutes(record?.early_leave_minutes ?? 0)}</td>
        <td className="p-3">
          {overtime > 0 ? (
            <span className="font-semibold text-emerald-600">+{formatMinutes(overtime)}</span>
          ) : (
            "—"
          )}
        </td>
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
      <td className="p-3 font-medium">{employee.full_name}</td>
      <td className="p-3 text-xs text-muted-foreground">{employee.employee_no}</td>
      <td className="p-3">
        {shift ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-2xs"
            style={{ backgroundColor: shift.color || "#0284c7" }}
          >
            <Clock className="size-2.5" /> {shift.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">الافتراضية</span>
        )}
      </td>
      <td className="p-2">
        <Input
          type="time"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="w-28 text-xs"
        />
      </td>
      <td className="p-2">
        <Input
          type="time"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="w-28 text-xs"
        />
      </td>
      <td className="p-3 text-xs">{formatMinutes(record?.late_minutes ?? 0)}</td>
      <td className="p-3 text-xs">{formatMinutes(record?.early_leave_minutes ?? 0)}</td>
      <td className="p-3 text-xs">
        {overtime > 0 ? (
          <span className="font-semibold text-emerald-600">+{formatMinutes(overtime)}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="p-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-28 text-xs">
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
