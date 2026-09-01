import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, ImageUp, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranding, useRefreshBranding } from "@/hooks/useBranding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function BrandingSettings() {
  const { user, isDirector, isHR } = useAuth();
  const branding = useBranding();
  const refreshBranding = useRefreshBranding();
  const fileRef = useRef<HTMLInputElement>(null);

  const [orgName, setOrgName] = useState(branding.org_name);
  const [systemName, setSystemName] = useState(branding.system_name);
  const [copyright, setCopyright] = useState(branding.copyright);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setOrgName(branding.org_name);
    setSystemName(branding.system_name);
    setCopyright(branding.copyright);
  }, [branding.org_name, branding.system_name, branding.copyright]);

  const canEdit = isDirector || isHR;
  if (!canEdit) return null;

  const save = async () => {
    if (!orgName.trim() || !systemName.trim()) {
      toast.error("اسم المؤسسة واسم النظام مطلوبان");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("org_branding").upsert(
      {
        id: true,
        org_name: orgName.trim(),
        system_name: systemName.trim(),
        copyright: copyright.trim(),
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      },
      { onConflict: "id" },
    );
    setSaving(false);
    if (error) {
      toast.error("تعذّر حفظ بيانات الهوية");
      return;
    }
    await refreshBranding();
    toast.success("تم حفظ هوية المؤسسة");
  };

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("يُسمح بملفات الصور فقط");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الشعار يجب ألا يتجاوز 5 ميجابايت");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("branding")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error("تعذّر رفع الشعار");
      return;
    }
    const { error } = await supabase.from("org_branding").upsert(
      {
        id: true,
        org_name: orgName.trim(),
        system_name: systemName.trim(),
        copyright: copyright.trim(),
        logo_path: path,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      },
      { onConflict: "id" },
    );
    setUploading(false);
    if (error) {
      toast.error("تم الرفع لكن تعذّر حفظ الشعار");
      return;
    }
    await refreshBranding();
    toast.success("تم تحديث شعار المؤسسة");
  };

  const removeLogo = async () => {
    setUploading(true);
    const { error } = await supabase
      .from("org_branding")
      .update({ logo_path: null, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
      .eq("id", true);
    setUploading(false);
    if (error) {
      toast.error("تعذّر إزالة الشعار");
      return;
    }
    await refreshBranding();
    toast.success("تمت العودة للشعار الافتراضي");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 text-primary" /> هوية المؤسسة والنظام
        </CardTitle>
        <CardDescription>
          تعديل اسم المؤسسة، شعارها، اسم النظام، ونص حقوق الملكية الظاهر في الواجهات والتقارير.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org-name">اسم المؤسسة</Label>
            <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="system-name">اسم النظام</Label>
            <Input
              id="system-name"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="copyright">حقوق الملكية</Label>
            <Input
              id="copyright"
              value={copyright}
              onChange={(e) => setCopyright(e.target.value)}
              placeholder="© 2026 جميع الحقوق محفوظة"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>شعار المؤسسة</Label>
          <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
            <img
              src={branding.logoUrl ?? "/favicon.png"}
              alt={`شعار ${branding.org_name}`}
              className="h-16 w-auto rounded-md object-contain"
            />
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadLogo(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="gap-2"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImageUp className="size-4" />
                )}
                رفع شعار جديد
              </Button>
              {branding.logo_path ? (
                <Button variant="ghost" size="sm" disabled={uploading} onClick={() => void removeLogo()}>
                  إزالة الشعار
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            يُفضّل صورة PNG بخلفية شفافة، بحد أقصى 5 ميجابايت.
          </p>
        </div>

        <Button onClick={() => void save()} disabled={saving} className="w-full gap-2 sm:w-auto">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ بيانات الهوية
        </Button>
      </CardContent>
    </Card>
  );
}
