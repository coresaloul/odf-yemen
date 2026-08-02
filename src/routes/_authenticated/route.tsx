import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Network,
  Users,
  ListChecks,
  CalendarClock,
  Star,
  FileBarChart,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ORG_NAME, ROLE_LABELS } from "@/lib/hr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", label: "لوحة المعلومات", icon: LayoutDashboard },
  { to: "/org", label: "المخطط التنظيمي", icon: Network },
  { to: "/employees", label: "الموظفون", icon: Users },
  { to: "/tasks", label: "المهام", icon: ListChecks },
  { to: "/attendance", label: "الدوام", icon: CalendarClock },
  { to: "/evaluations", label: "التقييم", icon: Star },
  { to: "/reports", label: "التقارير", icon: FileBarChart },
] as const;

function AuthenticatedLayout() {
  const { user, loading, roles, employee, signOut } = useAuth();
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
        <div className="border-b border-sidebar-border px-5 py-6">
          <p className="font-display text-lg font-bold leading-tight">{ORG_NAME}</p>
          <p className="mt-1 text-xs text-accent">نظام الموارد البشرية</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
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
        <header className="no-print flex items-center gap-2 border-b bg-card px-4 py-2">
          <div className="flex flex-1 items-center gap-2 overflow-x-auto md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-xs",
                  pathname.startsWith(item.to) ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <p className="hidden flex-1 text-sm text-muted-foreground md:block">
            {employee?.full_name ?? user.email}
          </p>
          <NotificationsBell />
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
