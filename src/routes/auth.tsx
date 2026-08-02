import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ORG_NAME } from "@/lib/hr";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | نظام الموارد البشرية" },
      {
        name: "description",
        content: "تسجيل الدخول إلى نظام إدارة الموارد البشرية الخاص بمؤسسة اليتيم التنموية.",
      },
      { property: "og:title", content: "تسجيل الدخول | نظام الموارد البشرية" },
      {
        property: "og:description",
        content: "بوابة دخول موظفي ومديري مؤسسة اليتيم التنموية إلى نظام الموارد البشرية.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search['next'] === "string" ? (search['next'] as string) : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const target = next && next.startsWith("/") ? next : "/dashboard";

  useEffect(() => {
    if (!loading && user) void navigate({ to: target });
  }, [loading, user, navigate, target]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error("تعذر تسجيل الدخول: " + error.message);
    toast.success("مرحباً بك");
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + target,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) return toast.error("تعذر إنشاء الحساب: " + error.message);
    toast.success("تم إنشاء الحساب، يمكنك الدخول الآن");
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) return toast.error("تعذر الدخول عبر Google");
    if (result.redirected) return;
    void navigate({ to: target });
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="text-sm tracking-widest text-accent">HR SYSTEM</div>
        <div>
          <h1 className="font-display text-4xl leading-snug font-bold">{ORG_NAME}</h1>
          <p className="mt-4 max-w-md text-sidebar-foreground/80">
            منصة موحّدة لإدارة الهيكل التنظيمي والموظفين والمهام والدوام والتقييم، مع تقارير إنجاز
            قابلة للتصدير.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/60">نظام داخلي — الدخول للمخوّلين فقط</div>
      </section>

      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-display text-2xl">نظام الموارد البشرية</CardTitle>
            <CardDescription>سجّل الدخول للمتابعة إلى لوحة العمل</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">دخول</TabsTrigger>
                <TabsTrigger value="signup">حساب جديد</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form className="space-y-4" onSubmit={signIn}>
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      dir="ltr"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Input
                      id="password"
                      type="password"
                      dir="ltr"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    دخول
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-4" onSubmit={signUp}>
                  <div className="space-y-2">
                    <Label htmlFor="name">الاسم الكامل</Label>
                    <Input
                      id="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">البريد الإلكتروني</Label>
                    <Input
                      id="email2"
                      type="email"
                      dir="ltr"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password2">كلمة المرور</Label>
                    <Input
                      id="password2"
                      type="password"
                      dir="ltr"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    إنشاء الحساب
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              أو
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google}>
              المتابعة عبر حساب Google
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
