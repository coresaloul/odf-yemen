import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeviceNotifications } from "@/hooks/useDeviceNotifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const TYPE_URL: Record<string, string> = {
  task: "/tasks",
  leave: "/leaves",
  attendance: "/attendance",
  evaluation: "/evaluations",
  approval: "/approvals",
  request: "/requests",
  payroll: "/payroll",
  custody: "/custody",
  discipline: "/discipline",
  lifecycle: "/lifecycle",
};

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ar", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, type, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as NotificationRow[]);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => [row, ...prev].slice(0, 30));
          toast(row.title, { description: row.body ?? undefined });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const unread = items.filter((i) => !i.is_read).length;

  const markAllRead = async () => {
    const ids = items.filter((i) => !i.is_read).map((i) => i.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
  };

  const markOneRead = async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="الإشعارات">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" dir="rtl">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">الإشعارات</p>
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={markAllRead}>
            <CheckCheck className="size-3.5" />
            تعليم الكل كمقروء
          </Button>
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">لا توجد إشعارات بعد</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void markOneRead(n.id)}
                    className={cn(
                      "w-full px-3 py-2.5 text-start transition-colors hover:bg-muted/60",
                      !n.is_read && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">{formatWhen(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
