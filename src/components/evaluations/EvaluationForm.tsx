import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAutoScores, saveEvaluation } from "@/lib/evaluation.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  defaultCalendarPeriod,
  gradeFor,
  periodYears,
  type EvaluationPeriodKey,
} from "@/lib/hr";
import {
  attendanceDetailsLabel,
  taskDetailsLabel,
  weightedAverage,
  type AttendanceScoreDetails,
  type TaskScoreDetails,
} from "@/lib/evaluation-scoring";

type Template = { id: string; name: string; kind: string; weight: number; max_score: number };
type Auto = {
  tasks: { score: number; details: TaskScoreDetails };
  attendance: { score: number; details: AttendanceScoreDetails };
};
type Goal = { title: string; metric: string; targetDate: string };

export function EvaluationForm({
  employees,
  onSaved,
}: {
  employees: { id: string; full_name: string }[];
  onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState<EvaluationPeriodKey>("monthly");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [periodStart, setPeriodStart] = useState(
    defaultCalendarPeriod("monthly").option.value,
  );
  const [auto, setAuto] = useState<Auto | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [criteriaNotes, setCriteriaNotes] = useState<Record<string, string>>({});
  const [selfAssessment, setSelfAssessment] = useState<{
    scores: Record<string, number>;
    achievements: string | null;
    challenges: string | null;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);

  const options = calendarPeriodOptions(period, Number(year));
  const current = options.find((o) => o.value === periodStart) ?? options[0]!;

  const changePeriod = (value: EvaluationPeriodKey) => {
    setPeriod(value);
    const first = calendarPeriodOptions(value, Number(year));
    const today = new Date().toISOString().slice(0, 10);
    const started = first.filter((o) => o.start <= today);
    setPeriodStart((started[started.length - 1] ?? first[0]!).value);
    reset();
  };
  const changeYear = (value: string) => {
    setYear(value);
    setPeriodStart(calendarPeriodOptions(period, Number(value))[0]!.value);
    reset();
  };
  const reset = () => {
    setAuto(null);
    setTemplates([]);
    setScores({});
    setCriteriaNotes({});
    setSelfAssessment(null);
  };

  const autoFn = useServerFn(getAutoScores);
  const saveFn = useServerFn(saveEvaluation);

  const compute = useMutation({
    mutationFn: async () => {
      const res = await autoFn({
        data: { employeeId, period, start: current.start, end: current.end },
      });
      const { data: self } = await supabase
        .from("evaluation_self_assessments")
        .select("scores, achievements, challenges")
        .eq("employee_id", employeeId)
        .eq("period", period)
        .eq("period_start", current.start)
        .maybeSingle();
      return { res, self };
    },
    onSuccess: ({ res, self }) => {
      setAuto(res.auto as Auto);
      setTemplates(res.templates as Template[]);
      setScores(
        Object.fromEntries(
          (res.templates as Template[])
            .filter((t) => t.kind === "behavior")
            .map((t) => [t.id, String(Math.round(t.max_score * 0.8))]),
        ),
      );
      setSelfAssessment(
        self
          ? {
              scores: (self.scores ?? {}) as Record<string, number>,
              achievements: self.achievements,
              challenges: self.challenges,
            }
          : null,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const behaviorTemplates = templates.filter((t) => t.kind === "behavior");
  const tasksWeight = templates.filter((t) => t.kind === "tasks").reduce((s, t) => s + t.weight, 0);
  const attWeight = templates
    .filter((t) => t.kind === "attendance")
    .reduce((s, t) => s + t.weight, 0);
  const behWeight = behaviorTemplates.reduce((s, t) => s + t.weight, 0);
  const criteriaScore = weightedAverage(
    behaviorTemplates.map((t) => ({
      weight: t.weight,
      score: Number(scores[t.id] ?? 0),
      maxScore: t.max_score,
    })),
  );
  const totalWeight = tasksWeight + attWeight + behWeight || 100;
  const total = auto
    ? Math.round(
        (auto.tasks.score * tasksWeight +
          auto.attendance.score * attWeight +
          criteriaScore * behWeight) /
          totalWeight,
      )
    : 0;

  const save = useMutation({
    mutationFn: async () => {
      await saveFn({
        data: {
          employeeId,
          period,
          periodStart: current.start,
          periodEnd: current.end,
          behavior: behaviorTemplates.map((t) => ({
            templateId: t.id,
            score: Number(scores[t.id] ?? 0),
            ...(criteriaNotes[t.id] ? { note: criteriaNotes[t.id]! } : {}),
          })),
          ...(notes ? { notes } : {}),
          ...(strengths ? { strengths } : {}),
          ...(improvements ? { improvements } : {}),
          goals: goals
            .filter((g) => g.title.trim())
            .map((g) => ({
              title: g.title.trim(),
              ...(g.metric ? { metric: g.metric } : {}),
              ...(g.targetDate ? { targetDate: g.targetDate } : {}),
            })),
        },
      });
    },
    onSuccess: () => {
      toast.success("تم حفظ التقييم كمسودة");
      reset();
      setNotes("");
      setStrengths("");
      setImprovements("");
      setGoals([]);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">تقييم جديد</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label>الموظف</Label>
            <Select
              value={employeeId}
              onValueChange={(v) => {
                setEmployeeId(v);
                reset();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الموظف" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>نوع الفترة</Label>
            <Select value={period} onValueChange={(v) => changePeriod(v as EvaluationPeriodKey)}>
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
            <Select value={year} onValueChange={changeYear}>
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
            <Select
              value={current.value}
              onValueChange={(v) => {
                setPeriodStart(v);
                reset();
              }}
            >
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

        <Button
          variant="outline"
          onClick={() => compute.mutate()}
          disabled={!employeeId || compute.isPending}
        >
          <Sparkles className="size-4" /> احتساب المهام والدوام تلقائياً
        </Button>

        {auto && (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-4">
              <Metric label={`إنجاز المهام (${tasksWeight}%)`} value={auto.tasks.score} />
              <Metric label={`الالتزام بالدوام (${attWeight}%)`} value={auto.attendance.score} />
              <Metric label={`المعايير السلوكية (${behWeight}%)`} value={criteriaScore} />
              <Metric label="الدرجة النهائية" value={total} highlight />
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {taskDetailsLabel(auto.tasks.details)}
              </p>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {attendanceDetailsLabel(auto.attendance.details)}
              </p>
              <div className="sm:col-span-4">
                <Progress value={total} />
                <p className="mt-1 text-xs text-muted-foreground">
                  التقدير المتوقع: <Badge variant="outline">{gradeFor(total)}</Badge>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">المعايير السلوكية</Label>
              {behaviorTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  لا توجد معايير سلوكية مفعّلة لهذه الفترة.
                </p>
              )}
              {behaviorTemplates.map((t) => (
                <div key={t.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_120px]">
                  <div>
                    <p className="text-sm font-medium">
                      {t.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        (الوزن {t.weight}% — من {t.max_score})
                      </span>
                    </p>
                    {selfAssessment?.scores?.[t.id] !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        التقييم الذاتي للموظف: {selfAssessment.scores[t.id]}
                      </p>
                    )}
                    <Input
                      className="mt-2"
                      placeholder="ملاحظة على المعيار (اختياري)"
                      value={criteriaNotes[t.id] ?? ""}
                      onChange={(e) =>
                        setCriteriaNotes((s) => ({ ...s, [t.id]: e.target.value }))
                      }
                    />
                  </div>
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

            {selfAssessment && (
              <div className="rounded-lg border border-dashed p-3 text-sm">
                <p className="font-medium">التقييم الذاتي للموظف</p>
                {selfAssessment.achievements && <p>الإنجازات: {selfAssessment.achievements}</p>}
                {selfAssessment.challenges && <p>التحديات: {selfAssessment.challenges}</p>}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>نقاط القوة</Label>
                <Textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>مجالات التحسين</Label>
                <Textarea
                  rows={2}
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات عامة</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>خطة التحسين والأهداف</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setGoals((g) => [...g, { title: "", metric: "", targetDate: "" }])}
                >
                  <Plus className="size-4" /> هدف
                </Button>
              </div>
              {goals.map((g, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[2fr_2fr_150px_40px]">
                  <Input
                    placeholder="عنوان الهدف"
                    value={g.title}
                    onChange={(e) =>
                      setGoals((s) => s.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                    }
                  />
                  <Input
                    placeholder="مؤشر القياس"
                    value={g.metric}
                    onChange={(e) =>
                      setGoals((s) => s.map((x, j) => (j === i ? { ...x, metric: e.target.value } : x)))
                    }
                  />
                  <Input
                    type="date"
                    value={g.targetDate}
                    onChange={(e) =>
                      setGoals((s) =>
                        s.map((x, j) => (j === i ? { ...x, targetDate: e.target.value } : x)),
                      )
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setGoals((s) => s.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              حفظ التقييم كمسودة
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          highlight
            ? "font-display text-3xl font-bold text-primary"
            : "font-display text-2xl font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}
