import { PersistentTabs } from "@/components/PersistentTabs";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PasswordField } from "@/components/PasswordField";
import { getMyProfile, updateMyProfile, type MyProfile } from "@/lib/self-profile.functions";
import { EmployeeDocuments } from "@/components/employees/EmployeeDocuments";
import { EmployeeServiceLinks } from "@/components/employees/EmployeeServiceLinks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/profile")({
  component: MyProfilePage,
  head: () => ({
    meta: [
      { title: "ملفي الشخصي | مدير" },
      {
        name: "description",
        content:
          "اطّلع على بياناتك الوظيفية وحدّث بياناتك الشخصية والصحية وبيانات الطوارئ في مدير — نظام الموارد البشرية والتخطيط والتقارير.",
      },
      { property: "og:title", content: "ملفي الشخصي | مدير" },
      {
        property: "og:description",
        content: "تحديث البيانات الشخصية والصحية وجهة الاتصال في حالات الطوارئ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Field = { key: keyof MyProfile; label: string; type?: string; area?: boolean };

const PERSONAL: Field[] = [
  { key: "phone", label: "رقم الجوال" },
  { key: "birth_date", label: "تاريخ الميلاد", type: "date" },
  { key: "gender", label: "الجنس" },
  { key: "marital_status", label: "الحالة الاجتماعية" },
  { key: "nationality", label: "الجنسية" },
  { key: "address", label: "العنوان", area: true },
];

const DOCS: Field[] = [
  { key: "national_id", label: "رقم الهوية" },
  { key: "national_id_expiry", label: "تاريخ انتهاء الهوية", type: "date" },
  { key: "passport_no", label: "رقم الجواز" },
  { key: "passport_expiry", label: "تاريخ انتهاء الجواز", type: "date" },
  { key: "education_level", label: "المؤهل العلمي" },
  { key: "specialization", label: "التخصص" },
];

const HEALTH: Field[] = [
  { key: "blood_type", label: "فصيلة الدم" },
  { key: "chronic_diseases", label: "أمراض مزمنة", area: true },
  { key: "allergies", label: "حساسية", area: true },
];

const EMERGENCY: Field[] = [
  { key: "emergency_contact_name", label: "اسم جهة الاتصال" },
  { key: "emergency_contact_phone", label: "هاتف جهة الاتصال" },
  { key: "emergency_contact_relation", label: "صلة القرابة" },
];

function MyProfilePage() {
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await fetchProfile({});
        if (!active) return;
        setProfile(data);
        if (data) {
          const initial: Record<string, string> = {};
          for (const f of [...PERSONAL, ...DOCS, ...HEALTH, ...EMERGENCY]) {
            initial[f.key as string] = (data[f.key] as string | null) ?? "";
          }
          setForm(initial);
        }
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchProfile]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await saveProfile({ data: form as never });
      toast.success("تم حفظ بياناتك");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> جارٍ تحميل ملفك…
      </div>
    );
  }

  if (!profile) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">لا يوجد ملف موظف مرتبط بحسابك</CardTitle>
          <CardDescription>
            يرجى التواصل مع الموارد البشرية لربط حسابك بملف الموظف الخاص بك.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const renderFields = (fields: Field[]) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key as string} className={f.area ? "sm:col-span-2" : ""}>
          <Label htmlFor={f.key as string} className="mb-1.5 block text-xs">
            {f.label}
          </Label>
          {f.area ? (
            <Textarea
              id={f.key as string}
              value={form[f.key as string] ?? ""}
              onChange={(e) => set(f.key as string, e.target.value)}
              rows={2}
            />
          ) : (
            <Input
              id={f.key as string}
              type={f.type ?? "text"}
              value={form[f.key as string] ?? ""}
              onChange={(e) => set(f.key as string, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );

  const nameInitials = profile.full_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-l from-primary/10 to-card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:flex sm:flex-wrap sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-lg font-bold text-primary">
              {nameInitials}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-bold sm:text-2xl">
                {profile.full_name}
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {profile.job_title ?? "—"} · رقم الموظف {profile.employee_no}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{profile.department_name ?? "بدون إدارة"}</Badge>
                {profile.section_name && <Badge variant="outline">{profile.section_name}</Badge>}
              </div>
            </div>
          </div>
          <Button onClick={() => void save()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span className="hidden sm:inline">حفظ التعديلات</span>
          </Button>
        </div>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">البيانات الوظيفية</CardTitle>
          <CardDescription>تُدار من قبل الموارد البشرية ولا يمكن تعديلها ذاتياً.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
            <p className="font-medium">{profile.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الإدارة</p>
            <p className="font-medium">{profile.department_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">القسم</p>
            <p className="font-medium">{profile.section_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">المدير المباشر</p>
            <p className="font-medium">{profile.manager_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">تاريخ التعيين</p>
            <p className="font-medium">{profile.hire_date ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الحالة</p>
            <Badge variant="secondary">{profile.status}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">بياناتي القابلة للتعديل</CardTitle>
          <CardDescription>حدّث بياناتك ثم اضغط «حفظ التعديلات».</CardDescription>
        </CardHeader>
        <CardContent>
          <PersistentTabs storageKey="profile" defaultValue="personal">
            <TabsList className="flex-wrap">
              <TabsTrigger value="personal">شخصية</TabsTrigger>
              <TabsTrigger value="docs">الوثائق والمؤهلات</TabsTrigger>
              <TabsTrigger value="health">صحية</TabsTrigger>
              <TabsTrigger value="emergency">الطوارئ</TabsTrigger>
              <TabsTrigger value="files">وثائق الموظف</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="mt-4">
              {renderFields(PERSONAL)}
            </TabsContent>
            <TabsContent value="docs" className="mt-4">
              {renderFields(DOCS)}
            </TabsContent>
            <TabsContent value="health" className="mt-4">
              {renderFields(HEALTH)}
            </TabsContent>
            <TabsContent value="emergency" className="mt-4">
              {renderFields(EMERGENCY)}
            </TabsContent>
            <TabsContent value="files" className="mt-4">
              <EmployeeDocuments
                employeeId={profile.id}
                national={{
                  national_id: form["national_id"] ?? profile.national_id,
                  national_id_expiry: form["national_id_expiry"] ?? profile.national_id_expiry,
                  passport_no: form["passport_no"] ?? profile.passport_no,
                  passport_expiry: form["passport_expiry"] ?? profile.passport_expiry,
                }}
                canUpload
              />
            </TabsContent>
          </PersistentTabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">خدماتي في النظام</CardTitle>
          <CardDescription>انتقل مباشرة إلى مهامك ودوامك وإجازاتك وطلباتك.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeServiceLinks
            only={["/tasks", "/attendance", "/leaves", "/requests", "/evaluations", "/custody"]}
          />
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pw) {
      toast.error("أدخل كلمة المرور الجديدة");
      return;
    }
    if (pw !== confirmPw) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw new Error(error.message);
      setPw("");
      setConfirmPw("");
      toast.success("تم تغيير كلمة المرور");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">تغيير كلمة المرور</CardTitle>
        <CardDescription>اختر كلمة مرور جديدة لحسابك، ثم اضغط «تحديث كلمة المرور».</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            id="new-password"
            label="كلمة المرور الجديدة"
            value={pw}
            onChange={setPw}
            autoComplete="new-password"
          />
          <PasswordField
            id="confirm-password"
            label="تأكيد كلمة المرور"
            value={confirmPw}
            onChange={setConfirmPw}
            autoComplete="new-password"
            showGenerator={false}
            showMeter={false}
          />
        </div>
        <Button onClick={() => void submit()} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          تحديث كلمة المرور
        </Button>
      </CardContent>
    </Card>
  );
}
