import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Fingerprint, Plus, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  saveBiometricDevice,
  deleteBiometricDevice,
  regenerateDeviceKey,
  linkEmployeeDevice,
  regenerateDeviceAttendance,
} from "@/lib/biometric.functions";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;

export function BiometricDevices() {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveBiometricDevice);
  const deleteFn = useServerFn(deleteBiometricDevice);
  const keyFn = useServerFn(regenerateDeviceKey);
  const linkFn = useServerFn(linkEmployeeDevice);
  const genFn = useServerFn(regenerateDeviceAttendance);

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const { data } = useQuery({
    queryKey: ["biometric"],
    queryFn: async () => {
      const [d, e, p] = await Promise.all([
        supabase.from("biometric_devices").select("*").order("created_at"),
        supabase
          .from("employees")
          .select("id, employee_no, full_name, device_user_id")
          .eq("status", "active")
          .order("full_name"),
        supabase
          .from("biometric_punches")
          .select("id, device_serial, device_user_id, employee_id, punched_at, processed")
          .order("punched_at", { ascending: false })
          .limit(100),
      ]);
      return { devices: d.data ?? [], employees: e.data ?? [], punches: p.data ?? [] };
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["biometric"] });
    void qc.invalidateQueries({ queryKey: ["attendance"] });
  };

  const [form, setForm] = useState({ name: "", serial_number: "", location: "" });
  const [range, setRange] = useState({ from: monthStart(), to: today() });

  const addMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: null,
          name: form.name,
          serial_number: form.serial_number,
          location: form.location || null,
          active: true,
          auto_generate: true,
        },
      }),
    onSuccess: () => {
      toast.success("تمت إضافة الجهاز");
      setForm({ name: "", serial_number: "", location: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: {
      id: string;
      name: string;
      serial_number: string;
      location: string | null;
      active: boolean;
      auto_generate: boolean;
    }) => saveFn({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الجهاز");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const keyMut = useMutation({
    mutationFn: (id: string) => keyFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم توليد مفتاح ربط جديد");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMut = useMutation({
    mutationFn: (v: { employee_id: string; device_user_id: string | null }) => linkFn({ data: v }),
    onSuccess: () => {
      toast.success("تم حفظ الربط");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const genMut = useMutation({
    mutationFn: () => genFn({ data: range }),
    onSuccess: (r) => {
      toast.success(`تم توليد/تحديث ${r.generated} سجل حضور`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (v: string) => {
    void navigator.clipboard.writeText(v);
    toast.success("تم النسخ");
  };

  const empName = (id: string | null) =>
    data?.employees.find((e) => e.id === id)?.full_name ?? null;

  const unmatched = (data?.punches ?? []).filter((p) => !p.employee_id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="size-4" /> أجهزة البصمة (ZKTeco)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>اسم الجهاز</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الرقم التسلسلي (SN)</Label>
              <Input
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>الموقع</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => addMut.mutate()}
            disabled={addMut.isPending || !form.name || !form.serial_number}
          >
            <Plus className="size-4" /> إضافة جهاز
          </Button>

          <div className="space-y-4">
            {(data?.devices ?? []).map((d) => {
              const online =
                !!d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 15 * 60 * 1000;
              const pushUrl = `${origin}/api/public/zkteco/${d.auth_key}/iclock`;
              return (
                <div key={d.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {d.name}{" "}
                        <span className="text-xs text-muted-foreground">({d.serial_number})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.location ?? "—"} • آخر اتصال:{" "}
                        {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString("ar") : "لا يوجد"} •{" "}
                        {d.punches_count} بصمة
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={online ? "default" : "secondary"}>
                        {online ? "متصل" : "غير متصل"}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => keyMut.mutate(d.id)}>
                        <RefreshCw className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(d.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={d.active}
                        onCheckedChange={(v) =>
                          toggleMut.mutate({
                            id: d.id,
                            name: d.name,
                            serial_number: d.serial_number,
                            location: d.location,
                            active: v,
                            auto_generate: d.auto_generate,
                          })
                        }
                      />
                      مفعّل
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={d.auto_generate}
                        onCheckedChange={(v) =>
                          toggleMut.mutate({
                            id: d.id,
                            name: d.name,
                            serial_number: d.serial_number,
                            location: d.location,
                            active: d.active,
                            auto_generate: v,
                          })
                        }
                      />
                      توليد الحضور تلقائياً
                    </label>
                  </div>

                  <div className="space-y-2 rounded-md bg-muted/50 p-3 text-xs">
                    <p className="font-medium">إعداد الجهاز (Comm / Cloud Server):</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all">{pushUrl}</code>
                      <Button size="icon" variant="ghost" onClick={() => copy(pushUrl)}>
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    <p className="text-muted-foreground">
                      إن كان الجهاز لا يقبل سوى العنوان والمنفذ، استخدم {origin} على المنفذ 443 مع
                      المسار الافتراضي /iclock، وتأكد من تفعيل خيار ADMS/Cloud Server وإدخال الرقم
                      التسلسلي أعلاه بالضبط.
                    </p>
                  </div>
                </div>
              );
            })}
            {(data?.devices ?? []).length === 0 && (
              <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                لا توجد أجهزة مسجلة
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">إعادة توليد الحضور من البصمات</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>من</Label>
            <Input
              type="date"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>إلى</Label>
            <Input
              type="date"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </div>
          <Button onClick={() => genMut.mutate()} disabled={genMut.isPending}>
            توليد الحضور
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ربط الموظفين بأرقام المستخدمين في الجهاز</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/60 text-xs">
              <tr>
                <th className="p-3">الرقم الوظيفي</th>
                <th className="p-3">الموظف</th>
                <th className="p-3">رقم المستخدم في الجهاز</th>
              </tr>
            </thead>
            <tbody>
              {(data?.employees ?? []).map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">{e.employee_no}</td>
                  <td className="p-3 font-medium">{e.full_name}</td>
                  <td className="p-3">
                    <Input
                      className="w-32"
                      defaultValue={e.device_user_id ?? ""}
                      onBlur={(ev) => {
                        const v = ev.target.value.trim();
                        if (v !== (e.device_user_id ?? ""))
                          linkMut.mutate({ employee_id: e.id, device_user_id: v || null });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            آخر البصمات المستلمة
            {unmatched.length > 0 && (
              <span className="mr-2 text-xs text-destructive">
                ({unmatched.length} بصمة غير مطابقة)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/60 text-xs">
              <tr>
                <th className="p-3">الوقت</th>
                <th className="p-3">الجهاز</th>
                <th className="p-3">رقم المستخدم</th>
                <th className="p-3">الموظف</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {(data?.punches ?? []).map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">{new Date(p.punched_at).toLocaleString("ar")}</td>
                  <td className="p-3">{p.device_serial ?? "—"}</td>
                  <td className="p-3">{p.device_user_id}</td>
                  <td className="p-3">
                    {empName(p.employee_id) ?? (
                      <span className="text-destructive">غير مطابق</span>
                    )}
                  </td>
                  <td className="p-3">{p.processed ? "معالجة" : "بانتظار المعالجة"}</td>
                </tr>
              ))}
              {(data?.punches ?? []).length === 0 && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={5}>
                    لم تصل أي بصمات بعد
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
