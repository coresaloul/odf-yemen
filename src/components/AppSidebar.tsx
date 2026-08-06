import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  FileText,
  LayoutDashboard,
  Network,
  Users,
  ListChecks,
  CalendarClock,
  CalendarDays,
  Star,
  FileBarChart,
  Settings,
  UserRound,
  ShieldCheck,
  ClipboardCheck,
  Wallet,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ORG_NAME, ROLE_LABELS } from "@/lib/hr";
import { Logo } from "@/components/Logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Settings;
  adminOnly?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "العمل اليومي",
    items: [
      { to: "/dashboard", label: "لوحة المعلومات", icon: LayoutDashboard },
      { to: "/tasks", label: "المهام", icon: ListChecks },
      { to: "/attendance", label: "الدوام", icon: CalendarClock },
      { to: "/leaves", label: "الإجازات", icon: CalendarDays },
      { to: "/requests", label: "الطلبات والنماذج", icon: FileText },
    ],
  },
  {
    label: "الموارد البشرية",
    items: [
      { to: "/employees", label: "الموظفون", icon: Users },
      { to: "/org", label: "المخطط التنظيمي", icon: Network },
      { to: "/evaluations", label: "التقييم", icon: Star },
      { to: "/payroll", label: "الرواتب", icon: Wallet },
    ],
  },
  {
    label: "الإدارة والمتابعة",
    items: [
      { to: "/approvals", label: "الموافقات", icon: ClipboardCheck },
      { to: "/reports", label: "التقارير", icon: FileBarChart },
      { to: "/users", label: "المستخدمون", icon: ShieldCheck, adminOnly: true },
    ],
  },
  {
    label: "حسابي",
    items: [
      { to: "/profile", label: "ملفي الشخصي", icon: UserRound },
      { to: "/settings", label: "الإشعارات", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { user, roles, employee, signOut, isDirector, isHR } = useAuth();
  const navigate = useNavigate();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const canSee = (i: NavItem) => !i.adminOnly || isDirector || isHR;
  const roleLabel = roles.map((r) => ROLE_LABELS[r]).join(" / ") || "بدون صلاحية";

  return (
    <Sidebar side="right" collapsible="icon" className="no-print border-l border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-xl bg-background/95 p-1.5">
            <Logo className="size-8" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold leading-tight text-sidebar-foreground">
                {ORG_NAME}
              </p>
              <p className="mt-0.5 truncate text-xs text-sidebar-primary">نظام الموارد البشرية</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(canSee);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              {!collapsed && (
                <SidebarGroupLabel className="text-sidebar-foreground/60">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = pathname.startsWith(item.to);
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link to={item.to} onClick={() => setOpenMobile(false)}>
                            <item.icon className="size-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-2 pb-1 text-xs">
            <p className="truncate font-semibold text-sidebar-foreground">
              {employee?.full_name ?? user?.email}
            </p>
            <p className="truncate text-sidebar-foreground/70">{roleLabel}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          aria-label="تسجيل الخروج"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={async () => {
            setOpenMobile(false);
            await signOut();
            void navigate({ to: "/auth", search: { next: undefined } });
          }}
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && "تسجيل الخروج"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
