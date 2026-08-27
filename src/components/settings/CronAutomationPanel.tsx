import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileSearch,
  Loader2,
  Play,
  RotateCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { triggerCronTask } from "@/lib/cron.functions";

type CronTaskKey = "audit_attendance" | "check_documents" | "weekly_digest" | "all";

export function CronAutomationPanel() {
  const triggerFn = useServerFn(triggerCronTask);
  const [lastResults, setLastResults] = useState<Array<{ task: string; message: string; timestamp: string }>>([]);

  const runMut = useMutation({
    mutationFn: (task: CronTaskKey) => triggerFn({ data: { task } }),
    onSuccess: (data, taskKey) => {
      toast.success("تم تنفيذ المهمة المجدولة بنجاح");
      const res = Array.isArray(data.result) ? data.result : [data.result];
      const items = res.map((r) => ({
        task: r?.task ?? taskKey,
        message: r?.message ?? "تم التنفيذ بنجاح",
        timestamp: new Date().toLocaleTimeString("ar-YE"),
      }));
      setLastResults((prev) => [...items, ...prev].slice(0, 8));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const TASKS: Array<{
    key: CronTaskKey;
    title: string;
    description: string;
    schedule: string;
    icon: React.ReactNode;
  }> = [
    {
      key: "audit_attendance",
      title: "معالجة الغياب والتأخير اليومية",
      description: "فحص حضور الموظفين ومطابقتها مع الإجازات والورديات وتسجيل الغياب آلياً وإرسال إشعار للمديرين.",
      schedule: "يومياً عند الساعة ٠٥:٠٠ مساءً",
      icon: <CalendarCheck className="size-5 text-sky-600" />,
    },
    {
      key: "check_documents",
      title: "تنبيهات انتهاء العقود والوثائق",
      description: "فحص الوثائق والهويات وعقود العمل التي تنتهي خلال ٣٠ و ١٥ و ٧ أيام وإرسال تنبيهات للموارد البشرية.",
      schedule: "يومياً عند الساعة ٠٨:٠٠ صباحاً",
      icon: <FileSearch className="size-5 text-amber-600" />,
    },
    {
      key: "weekly_digest",
      title: "ملخص الإنجاز الأسبوعي للإدارة",
      description: "تجميع نسب إنجاز الأقسام والالتزام بالدوام وإرسال ملخص تنفيذي للمدير التنفيذي.",
      schedule: "أسبوعياً كل يوم خميس ٠٤:٠٠ مساءً",
      icon: <TrendingUp className="size-5 text-emerald-600" />,
    },
  ];

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <RotateCw className="size-5 text-primary" /> خادم المهام المجدولة والأتمتة (Automated Cron Engine)
          </CardTitle>
          <CardDescription className="text-xs">
            أتمتة الفحص اليومي للدوام، مراقبة العقود والوثائق، والتقارير الأسبوعية التنفيذية.
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => runMut.mutate("all")}
          disabled={runMut.isPending}
          className="gap-1.5 shadow-xs"
        >
          {runMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          تشغيل كافة المهام الآن
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {TASKS.map((t) => (
            <div
              key={t.key}
              className="flex flex-col justify-between rounded-lg border bg-background p-4 shadow-2xs transition hover:border-primary/40"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                    {t.icon}
                  </div>
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Clock className="size-3 text-muted-foreground" /> {t.schedule}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-bold">{t.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {t.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runMut.mutate(t.key)}
                  disabled={runMut.isPending}
                  className="w-full gap-1.5 text-xs"
                >
                  <Play className="size-3.5" /> تشغيل يدوي الآن
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* سجل آخر العمليات المنفذة */}
        {lastResults.length > 0 && (
          <div className="rounded-lg bg-muted/40 p-3 text-xs">
            <h5 className="mb-2 flex items-center gap-1.5 font-bold text-foreground">
              <CheckCircle2 className="size-4 text-emerald-600" /> نتائج آخر عمليات التشغيل:
            </h5>
            <div className="space-y-1.5">
              {lastResults.map((res, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded bg-background px-3 py-1.5 border"
                >
                  <span className="font-medium text-foreground">{res.message}</span>
                  <span className="text-[10px] text-muted-foreground">{res.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
