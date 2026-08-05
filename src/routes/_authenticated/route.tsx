import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ORG_NAME } from "@/lib/hr";
import { NotificationsBell } from "@/components/NotificationsBell";
import { ApprovalsPopover } from "@/components/approvals/ApprovalsPopover";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, employee } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/auth", search: { next: pathname } });
    }
  }, [loading, user, navigate, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        جارٍ التحميل…
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-background">
        <AppSidebar />

        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur md:px-5">
            <SidebarTrigger className="size-9 shrink-0" aria-label="طيّ القائمة" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {employee?.full_name ?? user.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">{ORG_NAME}</p>
            </div>
            <ApprovalsPopover />
            <NotificationsBell />
          </header>

          <main className="flex-1 p-3 sm:p-5 md:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
