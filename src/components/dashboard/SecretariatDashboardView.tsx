import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  FileText,
  ListChecks,
  Plus,
  Send,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/hr";
import type { EmployeeLite } from "@/hooks/useAuth";

type SecretariatDashboardProps = {
  employee: EmployeeLite;
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    progress: number | null;
    due_date: string | null;
    created_at: string;
  }>;
};

export function SecretariatDashboardView({
  employee,
  recentTasks,
}: SecretariatDashboardProps) {
  const { data: correspondenceData } = useQuery({
    queryKey: ["secretariat-dashboard-stats"],
    queryFn: async () => {
      const [
        { data: incoming },
        { data: outgoing },
        { data: urgent },
        { data: pending },
        { data: recentRows },
      ] = await Promise.all([
        supabase.from("correspondence").select("id", { count: "exact" }).eq("direction", "incoming"),
        supabase.from("correspondence").select("id", { count: "exact" }).eq("direction", "outgoing"),
        supabase.from("correspondence").select("id", { count: "exact" }).in("priority", ["urgent", "very_urgent"]).neq("status", "archived"),
        supabase.from("correspondence").select("id", { count: "exact" }).eq("status", "draft"),
        supabase
          .from("correspondence")
          .select("id, reference_no, subject, direction, priority, status, correspondence_date, sender_name, recipient_name")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      return {
        incomingCount: incoming?.length ?? 0,
        outgoingCount: outgoing?.length ?? 0,
        urgentCount: urgent?.length ?? 0,
        pendingCount: pending?.length ?? 0,
        recentRows: recentRows ?? [],
      };
    },
  });

  const stats = correspondenceData ?? {
    incomingCount: 0,
    outgoingCount: 0,
    urgentCount: 0,
    pendingCount: 0,
    recentRows: [],
  };

  return (
    <div className="space-y-6">
      {/* بطاقة الترحيب للسكرتارية */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-900 p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-200 backdrop-blur-md">
              <Archive className="size-3.5 text-purple-300" />
              <span>لوحة السكرتارية والمراسلات الرسمية</span>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              مكتب السكرتارية — {employee?.full_name ?? "السكرتارية"}
            </h2>
            <p className="text-sm text-purple-200/80">
              إدارة وقيد وتوزيع وأرشفة المراسلات الصادرة والواردة وتتبع مسار المعاملات
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700">
              <Link to="/correspondence">
                <Plus className="size-4" />
                <span>تسجيل معاملة جديدة</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20">
              <Link to="/tasks">
                <ListChecks className="size-4" />
                <span>مهامي</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* بطاقات الإحصاءات السريعة للمعاملات */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="border-purple-200/50 dark:border-purple-900/40">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">الوارد الإجمالي</p>
              <ArrowDownToLine className="size-4 text-purple-500" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-purple-600 dark:text-purple-400 sm:text-3xl">
              {stats.incomingCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">معاملات واردة مسجلة</p>
          </CardContent>
        </Card>

        <Card className="border-indigo-200/50 dark:border-indigo-900/40">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">الصادر الإجمالي</p>
              <ArrowUpFromLine className="size-4 text-indigo-500" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-indigo-600 dark:text-indigo-400 sm:text-3xl">
              {stats.outgoingCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">معاملات صادرة مسجلة</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200/50 dark:border-amber-900/40">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">معاملات عاجلة</p>
              <AlertCircle className="size-4 text-amber-500" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-amber-600 dark:text-amber-400 sm:text-3xl">
              {stats.urgentCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">تتطلب متابعة فورية</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">مسودات قيد المعالجة</p>
              <Clock className="size-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {stats.pendingCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">بانتظار الإرسال أو الاعتماد</p>
          </CardContent>
        </Card>
      </div>

      {/* أحدث المعاملات المسجلة */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">أحدث المعاملات الصادرة والواردة</CardTitle>
            <CardDescription className="text-xs">
              سجل آخر المراسلات المقيدة في النظام
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
            <Link to="/correspondence">
              <span>عرض سجل المراسلات الكامل</span>
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.recentRows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Archive className="mx-auto size-8 opacity-40" />
              <p className="mt-2 text-sm font-medium">لا توجد مراسلات مسجلة بعد</p>
            </div>
          ) : (
            stats.recentRows.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.direction === "incoming" ? "default" : "secondary"}>
                      {r.direction === "incoming" ? "وارد" : "صادر"}
                    </Badge>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {r.reference_no ?? "بدون رقم قيد"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(r.correspondence_date)}
                    </span>
                  </div>
                  <p className="font-medium text-foreground">{r.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.direction === "incoming"
                      ? `المرسل: ${r.sender_name ?? "—"}`
                      : `المرسل إليه: ${r.recipient_name ?? "—"}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.priority === "urgent" || r.priority === "very_urgent" ? "destructive" : "outline"}>
                    {r.priority === "urgent" ? "عاجل" : r.priority === "very_urgent" ? "عاجل جداً" : "عادي"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
