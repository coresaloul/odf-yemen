import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { saveSelfAssessment } from "@/lib/evaluation.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EVALUATION_PERIODS,
  EVALUATION_PERIOD_LABELS,
  calendarPeriodOptions,
  periodYears,
  type EvaluationPeriodKey,
} from "@/lib/hr";

export function SelfAssessmentTab({ employeeId }: { employeeId: string | null }) {
  const [period, setPeriod] = useState<EvaluationPeriodKey>("monthly");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const options = calendarPeriodOptions(period, Number(year));
  const today = new Date().toISOString().slice(0, 10);
  const started = options.filter((o) => o.start <= today);
  const [periodStart, setPeriodStart] = useState(
    (started[started.length - 1] ?? options[0]!).value,
  );
  const current = options.find((o) => o.value === periodStart) ?? options[0]!;
  const [scores, setScores] = useState<Record<string, string>>({});
  const [achievements, setAchievements] = useState("");
  const [challenges, setChallenges] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["self-assessment", employeeId, period, current.start],
    enabled: !!employeeId,
    queryFn: async () => {
      const [templates, existing] = await Promise.all([
        supabase
          .from("evaluation_criteria_templates")
          .select("id, name, kind, max_score, applies_periods, active")
          .eq("active", true)
          .eq("kind", "behavior")
          .order("sort_order"),
        supabase
          .from("evaluation_self_assessments")
          .select("scores, achievements, challenges")
          .eq("employee_id", employeeId!)
          .eq("period", period)
          .eq("period_start", current.start)
          .maybeSingle(),
      ]);
      const list = (templates.data ?? []).filter(
        (t) => !t.applies_periods?.length || t.applies_periods.includes(period),
      );
      const saved = (existing.data?.scores ?? {}) as Record<string, number>;
      setScores(Object.fromEntries(list.map((t) => [t.id, String(saved[t.id] ?? "")])));
      setAchievements(existing.data?.achievements ?? "");
      setChallenges(existing.data?.challenges ?? "");
      return { templates: list };
    },
  });

  const saveFn = useServerFn(saveSelfAssessment);
  const save = useMutation({
    mutationFn: async () => {
      await saveFn({
        data: {
          period,
          periodStart: current.start,
          periodEnd: current.end,
          scores: Object.fromEntries(
            Object.entries(scores)
              .filter(([, v]) => v !== "")
              .map(([k, v]) => [k, Number(v)]),
          ),
          ...(achievements ? { achievements } : {}),
          ...(challenges ? { challenges } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("تم حفظ تقييمك الذاتي");
      void refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!employeeId) {
    return <p className="text-sm text-muted-foreground">حسابك غير مرتبط بسجل موظف.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">التقييم الذاتي</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>نوع الفترة</Label>
            <Select
              value={period}
              onValueChange={(v) => {
                setPeriod(v as EvaluationPeriodKey);
                setPeriodStart(calendarPeriodOptions(v as EvaluationPeriodKey, Number(year))[0]!.value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVALUATION_PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {EVALUATION_PERIOD_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>السنة</Label>
            <Select
              value={year}
              onValueChange={(v) => {
                setYear(v);
                setPeriodStart(calendarPeriodOptions(period, Number(v))[0]!.value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodYears().map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الفترة</Label>
            <Select value={current.value} onValueChange={setPeriodStart}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          {(data?.templates ?? []).map((t) => (
            <div key={t.id} className="grid gap-2 sm:grid-cols-[1fr_120px] sm:items-center">
              <Label>
                {t.name} <span className="text-xs text-muted-foreground">(من {t.max_score})</span>
              </Label>
              <Input
                type="number"
                min={0}
                max={t.max_score}
                value={scores[t.id] ?? ""}
                onChange={(e) => setScores((s) => ({ ...s, [t.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>أبرز إنجازاتي</Label>
            <Textarea
              rows={3}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>التحديات والاحتياجات</Label>
            <Textarea rows={3} value={challenges} onChange={(e) => setChallenges(e.target.value)} />
          </div>
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          حفظ التقييم الذاتي
        </Button>
      </CardContent>
    </Card>
  );
}
