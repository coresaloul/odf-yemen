import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ATTENDANCE_STATUS_LABELS, formatDate } from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "الدوام | الموارد البشرية" },
      { name: "description", content: "استيراد سجلات البصمة ومتابعة الحضور والتأخير والانصراف المبكر." },
      { property: "og:title", content: "الدوام | الموارد البشرية" },
      { property: "og:description", content: "سجلات الدوام اليومية للموظفين في مؤسسة اليتيم التنموية." },
    ],
  }),
  component: AttendancePage,
});

type Parsed = {
  employee_no: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
};

function parseCsv(text: string): Parsed[] {
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
        check_in: iIn >= 0 ? cells[iIn] || null : null,
        check_out: iOut >= 0 ? cells[iOut] || null : null,
      },
    ];
  });
}

const WORK_START = 8 * 60;
const WORK_END = 15 * 60;

function minutesOf(time: string | null) {
  if (!time) return null;
  const m = /(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function AttendancePage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => {
      const [records, employees] = await Promise.all([
        supabase.from("attendance_records").select("*").eq("work_date", date),
        supabase.from("employees").select("id, full_name, employee_no").order("full_name"),
      ]);
      return { records: records.data ?? [], employees: employees.data ?? [] };
    },
  });

  const records = data?.records ?? [];
  const employees = data?.employees ?? [];

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const rows = parseCsv(await file.text());
      if (rows.length === 0) throw new Error("تعذر قراءة الملف — تأكد من وجود أعمدة الرقم الوظيفي والتاريخ");

      const { data: emps } = await supabase.from("employees").select("id, employee_no");
      const map = new Map((emps ?? []).map((e) => [e.employee_no, e.id]));

      const payload = rows.flatMap((r) => {
        const employeeId = map.get(r.employee_no);
        if (!employeeId) return [];
        const inMin = minutesOf(r.check_in);
        const outMin = minutesOf(r.check_out);
        return [
          {
            employee_id: employeeId,
            work_date: r.work_date,
            check_in: r.check_in,
            check_out: r.check_out,
            late_minutes: inMin && inMin > WORK_START ? inMin - WORK_START : 0,
            early_leave_minutes: outMin && outMin < WORK_END ? WORK_END - outMin : 0,
            status: (inMin ? "present" : "absent") as "present" | "absent",
          },
        ];
      });

      if (payload.length === 0) throw new Error("لا توجد أرقام وظيفية مطابقة للموظفين المسجلين");

      const { error } = await supabase
        .from("attendance_records")
        .upsert(payload, { onConflict: "employee_id,work_date" });
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (count) => {
      toast.success(`تم استيراد ${count} سجل دوام`);
      void qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalLate = records.reduce((s, r) => s + r.late_minutes, 0);
  const present = records.filter((r) => r.status === "present").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة الدوام"
        description="استيراد سجلات جهاز البصمة (CSV) ومتابعة الالتزام"
        action={
          isManager && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCsv.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}>
                <Upload className="size-4" /> استيراد ملف البصمة
              </Button>
            </>
          )
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">صيغة الملف المتوقعة</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          أعمدة: الرقم الوظيفي (employee_no) — التاريخ (date) — الحضور (check_in) — الانصراف (check_out).
          يقبل النظام الفواصل «,» أو «;» أو Tab. الدوام الرسمي 08:00 — 15:00.
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>اليوم</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
        </div>
        <div className="text-sm text-muted-foreground">
          حضور: {present} / {employees.length} — إجمالي دقائق التأخير: {totalLate}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/60 text-xs">
              <tr>
                <th className="p-3">الموظف</th>
                <th className="p-3">الرقم</th>
                <th className="p-3">الحضور</th>
                <th className="p-3">الانصراف</th>
                <th className="p-3">تأخير (د)</th>
                <th className="p-3">انصراف مبكر (د)</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const r = records.find((x) => x.employee_id === e.id);
                return (
                  <tr key={e.id} className="border-t">
                    <td className="p-3">{e.full_name}</td>
                    <td className="p-3">{e.employee_no}</td>
                    <td className="p-3">{r?.check_in ?? "—"}</td>
                    <td className="p-3">{r?.check_out ?? "—"}</td>
                    <td className="p-3">{r?.late_minutes ?? 0}</td>
                    <td className="p-3">{r?.early_leave_minutes ?? 0}</td>
                    <td className="p-3">
                      <Badge variant={r?.status === "present" ? "default" : "secondary"}>
                        {ATTENDANCE_STATUS_LABELS[r?.status ?? "absent"]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    لا يوجد موظفون — أضف الموظفين أولاً. ({formatDate(date)})
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
