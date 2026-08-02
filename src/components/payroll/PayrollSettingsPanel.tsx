import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPayrollSetup,
  savePayrollSettings,
  savePayrollComponent,
  deletePayrollComponent,
} from "@/lib/payroll.functions";
import {
  CALC_METHOD_LABELS,
  COMPONENT_KIND_LABELS,
  type PayrollSettings,
} from "@/lib/payroll";

type ComponentForm = {
  id: string | null;
  name: string;
  kind: "earning" | "deduction";
  calc_method: "fixed" | "percent_basic";
  default_amount: number;
  active: boolean;
  sort_order: number;
};

const emptyComponent: ComponentForm = {
  id: null,
  name: "",
  kind: "earning",
  calc_method: "fixed",
  default_amount: 0,
  active: true,
  sort_order: 0,
};

export function PayrollSettingsPanel() {
  const qc = useQueryClient();
  const fetchSetup = useServerFn(getPayrollSetup);
  const saveSettingsFn = useServerFn(savePayrollSettings);
  const saveComponentFn = useServerFn(savePayrollComponent);
  const deleteComponentFn = useServerFn(deletePayrollComponent);

  const { data, isLoading } = useQuery({ queryKey: ["payroll-setup"], queryFn: () => fetchSetup() });
  const [draft, setDraft] = useState<PayrollSettings | null>(null);
  const [form, setForm] = useState<ComponentForm>(emptyComponent);

  const settings = draft ?? data?.settings ?? null;

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      await saveSettingsFn({
        data: {
          id: settings.id,
          currency: settings.currency,
          month_days: Number(settings.month_days),
          day_hours: Number(settings.day_hours),
          deduct_absence: settings.deduct_absence,
          deduct_unpaid_leave: settings.deduct_unpaid_leave,
          deduct_late: settings.deduct_late,
          late_grace_minutes: Number(settings.late_grace_minutes),
          manager_can_view: settings.manager_can_view,
          incentive_tiers: settings.incentive_tiers.map((t) => ({
            min_score: Number(t.min_score),
            percent: Number(t.percent),
          })),
        },
      });
    },
    onSuccess: () => {
      toast.success("تم حفظ إعدادات الرواتب");
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["payroll-setup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveComponent = useMutation({
    mutationFn: async () =>
      saveComponentFn({
        data: {
          id: form.id,
          name: form.name,
          kind: form.kind,
          calc_method: form.calc_method,
          default_amount: Number(form.default_amount),
          active: form.active,
          sort_order: Number(form.sort_order),
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ البند");
      setForm(emptyComponent);
      void qc.invalidateQueries({ queryKey: ["payroll-setup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeComponent = useMutation({
    mutationFn: async (id: string) => deleteComponentFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف البند");
      void qc.invalidateQueries({ queryKey: ["payroll-setup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !settings) return <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>;

  const update = (patch: Partial<PayrollSettings>) => setDraft({ ...settings, ...patch });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إعدادات الاحتساب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>العملة</Label>
              <Input value={settings.currency} onChange={(e) => update({ currency: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>أيام الشهر</Label>
              <Input
                type="number"
                value={settings.month_days}
                onChange={(e) => update({ month_days: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>ساعات اليوم</Label>
              <Input
                type="number"
                value={settings.day_hours}
                onChange={(e) => update({ day_hours: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-2">
            {[
              { key: "deduct_absence" as const, label: "خصم أيام الغياب" },
              { key: "deduct_unpaid_leave" as const, label: "خصم الإجازات بدون راتب" },
              { key: "deduct_late" as const, label: "خصم دقائق التأخير" },
              { key: "manager_can_view" as const, label: "السماح للمدير المباشر بالاطلاع" },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-md border p-3">
                <Label className="text-sm">{row.label}</Label>
                <Switch
                  checked={Boolean(settings[row.key])}
                  onCheckedChange={(v) => update({ [row.key]: v } as Partial<PayrollSettings>)}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label>سماح التأخير الشهري (دقيقة)</Label>
            <Input
              type="number"
              value={settings.late_grace_minutes}
              onChange={(e) => update({ late_grace_minutes: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label>شرائح حافز الأداء</Label>
            {settings.incentive_tiers.map((tier, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="number"
                  value={tier.min_score}
                  onChange={(e) => {
                    const tiers = [...settings.incentive_tiers];
                    tiers[idx] = { ...tier, min_score: Number(e.target.value) };
                    update({ incentive_tiers: tiers });
                  }}
                  placeholder="الدرجة من"
                />
                <Input
                  type="number"
                  value={tier.percent}
                  onChange={(e) => {
                    const tiers = [...settings.incentive_tiers];
                    tiers[idx] = { ...tier, percent: Number(e.target.value) };
                    update({ incentive_tiers: tiers });
                  }}
                  placeholder="النسبة %"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    update({ incentive_tiers: settings.incentive_tiers.filter((_, i) => i !== idx) })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update({ incentive_tiers: [...settings.incentive_tiers, { min_score: 80, percent: 5 }] })
              }
            >
              <Plus className="ms-1 size-4" /> إضافة شريحة
            </Button>
          </div>

          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            حفظ الإعدادات
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">بنود البدلات والاستقطاعات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="اسم البند"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Select
              value={form.kind}
              onValueChange={(v) => setForm({ ...form, kind: v as ComponentForm["kind"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COMPONENT_KIND_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={form.calc_method}
              onValueChange={(v) => setForm({ ...form, calc_method: v as ComponentForm["calc_method"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CALC_METHOD_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="القيمة الافتراضية"
              value={form.default_amount}
              onChange={(e) => setForm({ ...form, default_amount: Number(e.target.value) })}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveComponent.mutate()} disabled={!form.name.trim()}>
              {form.id ? "تحديث البند" : "إضافة بند"}
            </Button>
            {form.id && (
              <Button size="sm" variant="ghost" onClick={() => setForm(emptyComponent)}>
                إلغاء
              </Button>
            )}
          </div>

          <div className="divide-y rounded-md border">
            {(data?.components ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {COMPONENT_KIND_LABELS[c.kind]} — {CALC_METHOD_LABELS[c.calc_method]} (
                    {Number(c.default_amount)})
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setForm({
                        id: c.id,
                        name: c.name,
                        kind: c.kind as ComponentForm["kind"],
                        calc_method: c.calc_method as ComponentForm["calc_method"],
                        default_amount: Number(c.default_amount),
                        active: c.active,
                        sort_order: c.sort_order,
                      })
                    }
                  >
                    تعديل
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => removeComponent.mutate(c.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
