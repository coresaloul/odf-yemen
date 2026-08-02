import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Network,
  Users,
  ListChecks,
  CalendarClock,
  CalendarDays,
  Star,
  FileBarChart,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ORG_NAME, ROLE_LABELS } from "@/lib/hr";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV: { to: string; label: string; icon: typeof Settings; directorOnly?: boolean; adminOnly?: boolean }[] = [
  { to: "/dashboard", label: "لوحة المعلومات", icon: LayoutDashboard },
  { to: "/org", label: "المخطط التنظيمي", icon: Network },
  { to: "/employees", label: "الموظفون", icon: Users },
  { to: "/tasks", label: "المهام", icon: ListChecks },
  { to: "/attendance", label: "الدوام", icon: CalendarClock },
  { to: "/leaves", label: "الإجازات", icon: CalendarDays },
  { to: "/evaluations", label: "التقييم", icon: Star },
  { to: "/reports", label: "التقارير", icon: FileBarChart },
  { to: "/settings", label: "الإشعارات", icon: Settings },
  { to: "/users", label: "المستخدمون", icon: ShieldCheck, adminOnly: true },
];

function AuthenticatedLayout() {
  const { user, loading, roles, employee, signOut, isDirector, isHR } = useAuth();
  const canSee = (i: { directorOnly?: boolean; adminOnly?: boolean }) =>
    (!i.directorOnly || isDirector) && (!i.adminOnly || isDirector || isHR);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/auth", search: { next: pathname } });
    }
  }, [loading, user, navigate, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جارٍ التحميل…
      </div>
    );
  }

  const roleLabel = roles.map((r) => ROLE_LABELS[r]).join(" / ") || "بدون صلاحية";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="rounded-lg bg-background/95 p-1.5">
            <Logo className="h-10 w-10" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-bold leading-tight">{ORG_NAME}</p>
            <p className="mt-1 text-xs text-accent">نظام الموارد البشرية</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.filter(canSee).map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs">
          <p className="font-semibold">{employee?.full_name ?? user.email}</p>
          <p className="text-sidebar-foreground/70">{roleLabel}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/auth", search: { next: undefined } });
            }}
          >
            <LogOut className="size-4" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b bg-card px-3 py-2 md:px-4">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 md:hidden" aria-label="القائمة">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              dir="rtl"
              className="flex w-[82vw] max-w-xs flex-col gap-0 bg-sidebar p-0 text-sidebar-foreground"
            >
              <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
                <div className="rounded-lg bg-background/95 p-1.5">
                  <Logo className="h-9 w-9" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold leading-tight">{ORG_NAME}</p>
                  <p className="mt-0.5 text-xs text-accent">نظام الموارد البشرية</p>
                </div>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {NAV.filter(canSee).map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-sidebar-border p-4 text-xs">
                <p className="truncate font-semibold">{employee?.full_name ?? user.email}</p>
                <p className="text-sidebar-foreground/70">{roleLabel}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={async () => {
                    setMenuOpen(false);
                    await signOut();
                    void navigate({ to: "/auth", search: { next: undefined } });
                  }}
                >
                  <LogOut className="size-4" />
                  تسجيل الخروج
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Logo className="h-8 w-8 shrink-0 md:hidden" />
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {employee?.full_name ?? user.email}
          </p>
          <NotificationsBell />
        </header>

        <main className="flex-1 p-3 sm:p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
