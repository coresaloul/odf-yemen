import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellRing, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeviceNotifications } from "@/hooks/useDeviceNotifications";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "تفضيلات الإشعارات | نظام الموارد البشرية" },
      {
        name: "description",
        content:
          "تحكّم في إشعارات النظام والبريد الإلكتروني لمهامك وتقييماتك في نظام الموارد البشرية لمؤسسة اليتيم التنموية.",
      },
      { property: "og:title", content: "تفضيلات الإشعارات | نظام الموارد البشرية" },
      {
        property: "og:description",
        content: "اختر أنواع الإشعارات التي تريد استلامها داخل النظام أو عبر البريد الإلكتروني.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Prefs = {
  inapp_enabled: boolean;
  email_enabled: boolean;
  inapp_task_assigned: boolean;
  email_task_assigned: boolean;
  inapp_task_status: boolean;
  email_task_status: boolean;
  inapp_task_progress: boolean;
  email_task_progress: boolean;
  inapp_evaluation: boolean;
  email_evaluation: boolean;
};

const DEFAULTS: Prefs = {
  inapp_enabled: true,
  email_enabled: true,
  inapp_task_assigned: true,
  email_task_assigned: true,
  inapp_task_status: true,
  email_task_status: true,
  inapp_task_progress: true,
  email_task_progress: true,
  inapp_evaluation: true,
  email_evaluation: true,
};

const TYPES: {
  label: string;
  hint: string;
  inapp: keyof Prefs;
  email: keyof Prefs;
}[] = [
  {
    label: "تكليف بمهمة جديدة",
    hint: "عند تكليفك بمهمة من المدير التنفيذي أو المدير المباشر",
    inapp: "inapp_task_assigned",
    email: "email_task_assigned",
  },
  {
    label: "تغيّر حالة مهامي",
    hint: "عند تعديل حالة مهمة مكلّف بها (قيد التنفيذ، مكتملة، …)",
    inapp: "inapp_task_status",
    email: "email_task_status",
  },
  {
    label: "تحديثات مهام الموظفين",
    hint: "للمدراء: عند تحديث موظف لحالة مهمة كلّفته بها",
    inapp: "inapp_task_progress",
    email: "email_task_progress",
  },
  {
    label: "التقييمات",
    hint: "عند اعتماد تقييم شهري أو ربعي يخصّك",
    inapp: "inapp_evaluation",
    email: "email_evaluation",
  },
];

function DeviceNotificationsCard() {
  const { permission, request, notify, isSupported } = useDeviceNotifications();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">إشعارات الجهاز (الموبايل والويب)</CardTitle>
        <CardDescription>
          تظهر التنبيهات على شاشة جهازك عند تكليفك بمهمة أو وجود طلب أو تعديل جديد.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isSupported ? (
          <p className="text-sm text-muted-foreground">متصفحك الحالي لا يدعم إشعارات الجهاز.</p>
        ) : permission === "granted" ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-primary">إشعارات الجهاز مفعّلة على هذا الجهاز ✓</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void notify("تجربة إشعار", {
                  body: "هكذا ستصلك تنبيهات النظام على هذا الجهاز.",
                })
              }
            >
              إرسال إشعار تجريبي
            </Button>
          </div>
        ) : permission === "denied" ? (
          <p className="text-sm text-muted-foreground">
            الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (إعدادات الموقع ← الإشعارات) ثم
            أعد تحميل الصفحة.
          </p>
        ) : (
          <Button onClick={() => void request()} className="gap-2">
            <BellRing className="size-4" />
            تفعيل إشعارات هذا الجهاز
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          على الهاتف: افتح النظام من المتصفح ثم اختر «إضافة إلى الشاشة الرئيسية» لتصلك الإشعارات
          بشكل أفضل.
        </p>
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select(
          "inapp_enabled, email_enabled, inapp_task_assigned, email_task_assigned, inapp_task_status, email_task_status, inapp_task_progress, email_task_progress, inapp_evaluation, email_evaluation",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (data) setPrefs({ ...DEFAULTS, ...(data as Partial<Prefs>) });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const set = (key: keyof Prefs, value: boolean) => setPrefs((p) => ({ ...p, [key]: value }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...prefs }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error("تعذّر حفظ التفضيلات");
    else toast.success("تم حفظ تفضيلات الإشعارات");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> جارٍ تحميل التفضيلات…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">تفضيلات الإشعارات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          اختر القنوات وأنواع الإشعارات التي تريد استلامها.
        </p>
      </div>

      <DeviceNotificationsCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">القنوات</CardTitle>
          <CardDescription>إيقاف القناة يوقف جميع إشعاراتها.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Bell className="size-4 text-primary" />
              <div>
                <p className="text-sm font-medium">إشعارات داخل النظام</p>
                <p className="text-xs text-muted-foreground">تظهر في جرس الإشعارات أعلى الصفحة</p>
              </div>
            </div>
            <Switch
              checked={prefs.inapp_enabled}
              onCheckedChange={(v) => set("inapp_enabled", v)}
              aria-label="إشعارات داخل النظام"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-primary" />
              <div>
                <p className="text-sm font-medium">البريد الإلكتروني</p>
                <p className="text-xs text-muted-foreground">تصل إلى بريدك المسجّل في ملف الموظف</p>
              </div>
            </div>
            <Switch
              checked={prefs.email_enabled}
              onCheckedChange={(v) => set("email_enabled", v)}
              aria-label="إشعارات البريد الإلكتروني"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">أنواع الإشعارات</CardTitle>
          <CardDescription>حدّد لكل نوع القناة التي تصلك عبرها.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {TYPES.map((t) => (
            <div key={t.label} className="space-y-3">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.hint}</p>
              </div>
              <div className="flex flex-wrap gap-6 ps-1">
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={prefs[t.inapp]}
                    disabled={!prefs.inapp_enabled}
                    onCheckedChange={(v) => set(t.inapp, v)}
                    aria-label={`${t.label} داخل النظام`}
                  />
                  <span className="flex items-center gap-1">
                    <Bell className="size-3.5" /> داخل النظام
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={prefs[t.email]}
                    disabled={!prefs.email_enabled}
                    onCheckedChange={(v) => set(t.email, v)}
                    aria-label={`${t.label} بالبريد`}
                  />
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" /> البريد
                  </span>
                </label>
              </div>
              <Separator />
            </div>
          ))}
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            حفظ التفضيلات
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
