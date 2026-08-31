import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ORG_NAME } from "@/lib/hr";
import { PasswordField } from "@/components/PasswordField";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | مدير" },
      {
        name: "description",
        content: "تسجيل الدخول إلى مدير — نظام الموارد البشرية والتخطيط والتقارير.",
      },
      { property: "og:title", content: "تسجيل الدخول | مدير" },
      {
        property: "og:description",
        content: "بوابة دخول موظفي ومديري النظام إلى مدير — نظام الموارد البشرية والتخطيط والتقارير.",
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

  const target = next && next.startsWith("/") ? next : "/dashboard";

  useEffect(() => {
    if (!loading && user) void navigate({ to: target });
  }, [loading, user, navigate, target]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("تعذر تسجيل الدخول: " + error.message);
      return;
    }
    toast.success("مرحباً بك");
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="text-sm tracking-widest text-accent">HR SYSTEM</div>
        <div>
          <div className="mb-8 inline-flex rounded-2xl bg-background/95 p-5">
            <Logo className="h-32 w-auto" />
          </div>
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
          <CardHeader className="items-center text-center">
            <Logo className="mb-2 h-20 w-auto lg:hidden" />
            <CardTitle className="font-display text-2xl">مدير</CardTitle>
            <CardDescription>سجّل الدخول للمتابعة إلى لوحة العمل</CardDescription>
          </CardHeader>
          <CardContent>
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
              <PasswordField
                id="password"
                value={password}
                onChange={setPassword}
                required
                autoComplete="current-password"
                showGenerator={false}
                showMeter={false}
              />

              <Button type="submit" className="w-full" disabled={busy}>
                دخول
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              لا يوجد تسجيل ذاتي. تُنشأ الحسابات من قِبل الموارد البشرية أو المدير التنفيذي.
            </p>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              تبقى جلستك مفتوحة على هذا الجهاز حتى تسجّل الخروج.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
