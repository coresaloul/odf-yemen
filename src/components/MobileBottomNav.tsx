import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListChecks,
  CalendarClock,
  CalendarDays,
  Menu,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { usePendingApprovals } from "@/components/approvals/useApprovals";

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();
  const { data: pendingApprovals = [] } = usePendingApprovals();

  const navItems = [
    {
      to: "/dashboard",
      label: "الرئيسية",
      icon: LayoutDashboard,
      active: pathname === "/dashboard" || pathname === "/",
    },
    {
      to: "/tasks",
      label: "المهام",
      icon: ListChecks,
      active: pathname.startsWith("/tasks"),
    },
    {
      to: "/attendance",
      label: "الدوام",
      icon: CalendarClock,
      active: pathname.startsWith("/attendance"),
    },
    {
      to: "/leaves",
      label: "الإجازات",
      icon: CalendarDays,
      active: pathname.startsWith("/leaves") || pathname.startsWith("/requests"),
    },
  ];

  return (
    <nav
      aria-label="شريط التنقل السريع للهاتف"
      className="no-print fixed inset-x-0 bottom-0 z-40 block border-t border-border/80 bg-card/95 shadow-lg backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium transition-colors select-none",
                item.active
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground active:scale-95",
              )}
            >
              {item.active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
              )}
              <div
                className={cn(
                  "grid size-7 place-items-center rounded-xl transition-all",
                  item.active && "bg-primary/10",
                )}
              >
                <Icon className={cn("size-4.5", item.active && "text-primary")} />
              </div>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* زر فتح القائمة الجانبية الكاملة للمزيد من الخيارات */}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95 select-none",
          )}
          aria-label="فتح القائمة الكاملة"
        >
          <div className="relative grid size-7 place-items-center rounded-xl">
            <Menu className="size-4.5" />
            {pendingApprovals.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive ring-2 ring-card" />
            )}
          </div>
          <span className="truncate">القائمة</span>
        </button>
      </div>
    </nav>
  );
}
