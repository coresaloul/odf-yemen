import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Award,
  Bot,
  Check,
  Copy,
  FileText,
  Gavel,
  GraduationCap,
  Loader2,
  Sparkles,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  generateAiDocument,
  generateAiPerformanceSummary,
} from "@/lib/ai-hr.functions";
import type {
  DocumentType,
  DraftDocumentResult,
  PerformanceAnalysisResult,
} from "@/lib/ai-hr.server";

interface AiHrAssistantDialogProps {
  initialEmployeeId?: string;
  initialTab?: "draft" | "performance";
  trigger?: React.ReactNode;
}

const QUICK_PROMPTS: Record<DocumentType, string[]> = {
  notice: [
    "تكرار التأخر الصباحي لأكثر من ٣ مرات خلال هذا الشهر دون إذن مسبق",
    "عدم توثيق تقدم إنجاز المهام في النظام الإلكتروني في المواعيد المحددة",
    "مغادرة مقر العمل قبل موعد الانصراف دون إذن معتمد",
  ],
  warning: [
    "الغياب عن العمل لمدة يومين متتاليين دون تقديم عذر أو إشعار الإدارة",
    "عدم الالتزام بتعليمات المشرف المباشر وإهمال تسليم التقرير الأسبوعي",
    "مخالفة لائحة استخدام الأصول والممتلكات داخل المؤسسة",
  ],
  recognition: [
    "إنجاز وتجهيز التقارير السنوية قبل الموعد المحدد بجودة واحترافية استثنائية",
    "التميز في خدمة ورعاية المستفيدين وتقديم حلول مبدعة لتسريع الإجراءات",
    "التطوع والجهد المتميز في إنجاح فعاليات المؤسسة الموسمية",
  ],
  promotion: [
    "الترقية إلى مسمى أخصائي أول تقديراً للكفاءة القيادية والإنتاجية العالية",
    "تعديل الدرجة الوظيفية بعد اجتياز متطلبات التقييم السنوي بدرجة ممتاز",
  ],
  delegation: [
    "التكليف بالقيام بمهام مدير القسم بالإنابة خلال فترة إجازته السنوية",
    "التكليف بإدارة ومتابعة فريق مشروع أتمتة الإجراءات",
  ],
};

export function AiHrAssistantDialog({
  initialEmployeeId,
  initialTab = "draft",
  trigger,
}: AiHrAssistantDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // جلب قائمة الموظفين
  const { data: employeesData } = useQuery({
    queryKey: ["ai-hr-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, employee_no, job_title, department:departments(name), section:sections(name)")
        .eq("status", "active")
        .order("full_name");
      return data ?? [];
    },
    enabled: open,
  });

  const employees = employeesData ?? [];

  // ──── Form State: Draft Document ────
  const [selectedEmpId, setSelectedEmpId] = useState(initialEmployeeId ?? "");
  const [docType, setDocType] = useState<DocumentType>("notice");
  const [reason, setReason] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [draftResult, setDraftResult] = useState<DraftDocumentResult | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedEmp = employees.find((e) => e.id === (selectedEmpId || employees[0]?.id));

  const draftFn = useServerFn(generateAiDocument);
  const draftMut = useMutation({
    mutationFn: () =>
      draftFn({
        data: {
          docType,
          employeeName: selectedEmp?.full_name ?? "الموظف",
          jobTitle: selectedEmp?.job_title ?? null,
          departmentName: (selectedEmp?.department as unknown as { name?: string })?.name ?? null,
          reasonOrAchievement: reason,
          customNotes: customNotes || null,
        },
      }),
    onSuccess: (res) => {
      setDraftResult(res);
      toast.success("تمت صياغة المستند بالذكاء الاصطناعي بنجاح");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ──── Form State: Performance Analysis ────
  const [perfEmpId, setPerfEmpId] = useState(initialEmployeeId ?? "");
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [perfResult, setPerfResult] = useState<PerformanceAnalysisResult | null>(null);

  const perfFn = useServerFn(generateAiPerformanceSummary);
  const perfMut = useMutation({
    mutationFn: () =>
      perfFn({
        data: {
          employeeId: perfEmpId || employees[0]?.id || "",
          periodStart,
          periodEnd,
        },
      }),
    onSuccess: (res) => {
      setPerfResult(res);
      toast.success("تم توليد تحليل الأداء والتوصيات");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("تم نسخ النص إلى الحافظة");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10">
            <Sparkles className="size-4 text-primary" /> مساعد الموارد البشرية الذكي
          </Button>
        )}
      </DialogTrigger>

      <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            مساعد الذكاء الاصطناعي للموارد البشرية
            <Badge variant="secondary" className="mr-auto gap-1 text-[11px]">
              <Sparkles className="size-3 text-primary" /> AI Powered
            </Badge>
          </DialogTitle>
          <DialogDescription>
            صياغة الخطابات الرسمية والإنذارات وشهادات التكريم، وتحليل أداء الموظفين وتقديم توصيات التدريب والترقية.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="draft" className="gap-2 text-xs sm:text-sm">
              <FileText className="size-4" /> صياغة الخطابات والشهادات
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2 text-xs sm:text-sm">
              <TrendingUp className="size-4" /> تحليل الأداء والتوصيات
            </TabsTrigger>
          </TabsList>

          {/* ──── تبويب صياغة الخطابات ──── */}
          <TabsContent value="draft" className="space-y-4 pt-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>نوع المستند المطلوب</Label>
                <Select
                  value={docType}
                  onValueChange={(v) => {
                    setDocType(v as DocumentType);
                    setReason("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notice">لفت نظر إداري</SelectItem>
                    <SelectItem value="warning">إنذار تأديبي</SelectItem>
                    <SelectItem value="recognition">شهادة شكر وتكريم</SelectItem>
                    <SelectItem value="promotion">إشعار ترقية وتعديل مسمى</SelectItem>
                    <SelectItem value="delegation">قرار تكليف بمهام</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>الموظف المعني</Label>
                <Select
                  value={selectedEmpId || (employees[0]?.id ?? "")}
                  onValueChange={setSelectedEmpId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الموظف" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name} ({e.job_title || e.employee_no})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>سبب الخطاب أو تفاصيل الإنجاز / المخالفة</Label>
                <span className="text-xs text-muted-foreground">اكتب أو اختر من الاقتراحات السريعة</span>
              </div>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="صف المخالفة أو الإنجاز بالتفصيل..."
                className="resize-none"
              />

              {/* اقتراحات سريعة */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_PROMPTS[docType]?.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setReason(prompt)}
                    className="rounded-md border bg-muted/50 px-2 py-1 text-right text-[11px] text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                  >
                    💡 {prompt}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => draftMut.mutate()}
              disabled={!reason.trim() || draftMut.isPending}
              className="w-full gap-2"
            >
              {draftMut.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> جاري الصياغة بالذكاء الاصطناعي...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> صياغة المستند بالذكاء الاصطناعي
                </>
              )}
            </Button>

            {/* نتيجة الصياغة */}
            {draftResult && (
              <Card className="border-primary/20 bg-muted/20">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-sm font-bold">{draftResult.title}</CardTitle>
                    <CardDescription className="text-xs">
                      الرقم الإشاري: {draftResult.referenceNumber} | التاريخ: {draftResult.date}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(draftResult.body)}
                    className="gap-1.5 text-xs"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    {copied ? "تم النسخ" : "نسخ النص"}
                  </Button>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md bg-background p-4 text-xs font-sans leading-relaxed text-foreground shadow-2xs">
                    {draftResult.body}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ──── تبويب تحليل الأداء ──── */}
          <TabsContent value="performance" className="space-y-4 pt-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label>الموظف</Label>
                <Select
                  value={perfEmpId || (employees[0]?.id ?? "")}
                  onValueChange={setPerfEmpId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الموظف" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={() => perfMut.mutate()}
              disabled={perfMut.isPending}
              className="w-full gap-2"
            >
              {perfMut.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> جاري تحليل البيانات وسجلات الأداء...
                </>
              ) : (
                <>
                  <TrendingUp className="size-4" /> تحليل الأداء وتقديم التوصيات
                </>
              )}
            </Button>

            {/* نتيجة التحليل والتوصيات */}
            {perfResult && (
              <div className="space-y-4">
                {/* بطاقة المؤشرات الرئيسية */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border bg-background p-3 text-center">
                    <span className="text-[11px] text-muted-foreground">درجة الأداء</span>
                    <p className="font-display text-2xl font-bold text-primary">
                      {perfResult.kpis.performanceScore}%
                    </p>
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {perfResult.kpis.grade}
                    </Badge>
                  </div>
                  <div className="rounded-lg border bg-background p-3 text-center">
                    <span className="text-[11px] text-muted-foreground">نسبة إنجاز المهام</span>
                    <p className="font-display text-2xl font-bold text-emerald-600">
                      {perfResult.kpis.completionRate}%
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      ({perfResult.kpis.tasksCompleted} من {perfResult.kpis.tasksTotal})
                    </span>
                  </div>
                  <div className="rounded-lg border bg-background p-3 text-center">
                    <span className="text-[11px] text-muted-foreground">أيام الحضور</span>
                    <p className="font-display text-2xl font-bold text-foreground">
                      {perfResult.kpis.presentDays}
                    </p>
                    <span className="text-[10px] text-muted-foreground">يوم مسجّل</span>
                  </div>
                  <div className="rounded-lg border bg-background p-3 text-center">
                    <span className="text-[11px] text-muted-foreground">دقائق التأخير</span>
                    <p className={`font-display text-2xl font-bold ${perfResult.kpis.lateMinutes > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {perfResult.kpis.lateMinutes}
                    </p>
                    <span className="text-[10px] text-muted-foreground">دقيقة</span>
                  </div>
                </div>

                {/* الملخص التنفيذي */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">الملخص التنفيذي للأداء</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs leading-relaxed text-muted-foreground">
                    {perfResult.executiveSummary}
                  </CardContent>
                </Card>

                {/* نقاط القوة وفرص التحسين */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <UserCheck className="size-4" /> أبرز نقاط القوة
                    </h4>
                    <ul className="mt-2 space-y-1 text-xs text-emerald-900/90 dark:text-emerald-100/90">
                      {perfResult.strengths.map((s, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-600">•</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <Zap className="size-4" /> مجالات التطوير والتحسين
                    </h4>
                    <ul className="mt-2 space-y-1 text-xs text-amber-900/90 dark:text-amber-100/90">
                      {perfResult.areasForImprovement.map((a, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-600">•</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* التوصيات التدريبية والمسار المهني */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <GraduationCap className="size-4 text-primary" /> البرامج التدريبية الموصى بها
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {perfResult.trainingRecommendations.map((t, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{t.title}</p>
                          <p className="text-muted-foreground">{t.description}</p>
                        </div>
                        <Badge
                          variant={t.priority === "عالية" ? "destructive" : "secondary"}
                          className="shrink-0 text-[10px]"
                        >
                          أولوية {t.priority}
                        </Badge>
                      </div>
                    ))}

                    <div className="mt-3 rounded-md bg-primary/5 p-2.5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-primary">
                        <Award className="size-4" /> الجاهزية للترقية والمسار الوظيفي:
                        <Badge variant="outline" className="font-semibold">
                          {perfResult.careerPathAdvice.promotionReadiness}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {perfResult.careerPathAdvice.notes}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
