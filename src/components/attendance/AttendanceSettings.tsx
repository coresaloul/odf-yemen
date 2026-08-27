import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DAY_NAMES } from "@/lib/attendance";
import { saveWorkSettings, saveHoliday, deleteHoliday, saveLeaveType } from "@/lib/attendance.functions";
import { initLeaveBalances } from "@/lib/leave.functions";
import { CronAutomationPanel } from "@/components/settings/CronAutomationPanel";

export function AttendanceSettings() {
  const qc = useQueryClient();
  const saveSettingsFn = useServerFn(saveWorkSettings);
  const saveHolidayFn = useServerFn(saveHoliday);
  const deleteHolidayFn = useServerFn(deleteHoliday);
  const saveTypeFn = useServerFn(saveLeaveType);
  const initBalancesFn = useServerFn(initLeaveBalances);

  const { data } = useQuery({
    queryKey: ["attendance-config"],
    queryFn: async () => {
      const [s, h, t] = await Promise.all([
        supabase.from("work_settings").select("*").maybeSingle(),
        supabase.from("holidays").select("*").order("start_date"),
        supabase.from("leave_types").select("*").order("name"),
      ]);
      return { settings: s.data, holidays: h.data ?? [], types: t.data ?? [] };
    },
  });

  const [form, setForm] = useState<{
    work_days: number[];
    start_time: string;
    end_time: string;
    grace_minutes: number;
  } | null>(null);

  const current = form ?? {
    work_days: (data?.settings?.work_days as number[] | undefined) ?? [0, 1, 2, 3, 4],
    start_time: String(data?.settings?.start_time ?? "08:00").slice(0, 5),
    end_time: String(data?.settings?.end_time ?? "15:00").slice(0, 5),
    grace_minutes: data?.settings?.grace_minutes ?? 10,
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["attendance-config"] });
    void qc.invalidateQueries({ queryKey: ["attendance"] });
  };

  const settingsMut = useMutation({
    mutationFn: () => saveSettingsFn({ data: current }),
    onSuccess: () => {
      toast.success("تم حفظ إعدادات الدوام");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [holiday, setHoliday] = useState({
    name: "",
    start_date: "",
    end_date: "",
    recurring_annually: false,
  });

  const holidayMut = useMutation({
    mutationFn: () => saveHolidayFn({ data: { ...holiday, id: null } }),
    onSuccess: () => {
      toast.success("تمت إضافة العطلة");
      setHoliday({ name: "", start_date: "", end_date: "", recurring_annually: false });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteHolidayFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف العطلة");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const typeMut = useMutation({
    mutationFn: (v: { id: string; annual_days: number; active: boolean; requires_attachment: boolean }) =>
      saveTypeFn({ data: v }),
    onSuccess: () => {
      toast.success("تم تحديث نوع الإجازة");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balancesMut = useMutation({
    mutationFn: () => initBalancesFn({ data: { year: new Date().getFullYear() } }),
    onSuccess: (r) => toast.success(`تم إنشاء ${r.created} رصيد إجازات للسنة الحالية`),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDay = (day: number) =>
    setForm({
      ...current,
      work_days: current.work_days.includes(day)
        ? current.work_days.filter((d) => d !== day)
        : [...current.work_days, day].sort(),
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">أوقات الدوام وأيام العمل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>أيام العمل</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((name, i) => (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant={current.work_days.includes(i) ? "default" : "outline"}
                  onClick={() => toggleDay(i)}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>بداية الدوام</Label>
              <Input
                type="time"
                value={current.start_time}
                onChange={(e) => setForm({ ...current, start_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>نهاية الدوام</Label>
              <Input
                type="time"
                value={current.end_time}
                onChange={(e) => setForm({ ...current, end_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>سماحية التأخير (دقيقة)</Label>
              <Input
                type="number"
                min={0}
                value={current.grace_minutes}
                onChange={(e) => setForm({ ...current, grace_minutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <Button onClick={() => settingsMut.mutate()} disabled={settingsMut.isPending}>
            حفظ الإعدادات
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">العطل الرسمية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="اسم العطلة"
              value={holiday.name}
              onChange={(e) => setHoliday({ ...holiday, name: e.target.value })}
            />
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={holiday.recurring_annually}
                onCheckedChange={(v) => setHoliday({ ...holiday, recurring_annually: v })}
              />
              تتكرر سنوياً
            </div>
            <Input
              type="date"
              value={holiday.start_date}
              onChange={(e) => setHoliday({ ...holiday, start_date: e.target.value })}
            />
            <Input
              type="date"
              value={holiday.end_date}
              onChange={(e) => setHoliday({ ...holiday, end_date: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            onClick={() => holidayMut.mutate()}
            disabled={holidayMut.isPending || !holiday.name || !holiday.start_date || !holiday.end_date}
          >
            <Plus className="size-4" /> إضافة عطلة
          </Button>
          <div className="divide-y rounded-lg border text-sm">
            {(data?.holidays ?? []).map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.start_date} — {h.end_date} {h.recurring_annually ? "(سنوية)" : ""}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(h.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
            {(data?.holidays ?? []).length === 0 && (
              <p className="p-3 text-muted-foreground">لا توجد عطل مسجلة</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">أنواع الإجازات والأرصدة</CardTitle>
          <Button size="sm" variant="outline" onClick={() => balancesMut.mutate()} disabled={balancesMut.isPending}>
            توليد أرصدة {new Date().getFullYear()}
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/60 text-xs">
              <tr>
                <th className="p-3">النوع</th>
                <th className="p-3">الرصيد السنوي (يوم)</th>
                <th className="p-3">يتطلب مرفق</th>
                <th className="p-3">مفعّل</th>
              </tr>
            </thead>
            <tbody>
              {(data?.types ?? []).map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3 font-medium">
                    {t.name}
                    {t.is_hourly && <span className="mr-2 text-xs text-muted-foreground">(ساعي)</span>}
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      className="w-24"
                      defaultValue={Number(t.annual_days)}
                      onBlur={(e) =>
                        typeMut.mutate({
                          id: t.id,
                          annual_days: Number(e.target.value),
                          active: t.active,
                          requires_attachment: t.requires_attachment,
                        })
                      }
                    />
                  </td>
                  <td className="p-3">
                    <Switch
                      checked={t.requires_attachment}
                      onCheckedChange={(v) =>
                        typeMut.mutate({
                          id: t.id,
                          annual_days: Number(t.annual_days),
                          active: t.active,
                          requires_attachment: v,
                        })
                      }
                    />
                  </td>
                  <td className="p-3">
                    <Switch
                      checked={t.active}
                      onCheckedChange={(v) =>
                        typeMut.mutate({
                          id: t.id,
                          annual_days: Number(t.annual_days),
                          active: v,
                          requires_attachment: t.requires_attachment,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* لوحة التحكم بالمهام المجدولة والأتمتة */}
      <CronAutomationPanel />
    </div>
  );
}
