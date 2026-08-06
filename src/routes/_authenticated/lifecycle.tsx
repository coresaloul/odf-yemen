import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Circle, ListChecks, LogOut, Route as RouteIcon, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import {
  CHECKLIST_KIND_LABELS,
  LIFECYCLE_EVENT_LABELS,
  MOVEMENT_LABELS,
  OWNER_ROLE_LABELS,
  STAGE_LABELS_LIFECYCLE,
  TERMINATION_TYPES,
  type LifecycleStage,
} from "@/lib/lifecycle";
import {
  completeEmployeeOffboarding,
  confirmEmployeeProbation,
  generateLifecycleChecklist,
  getLifecycleDetails,
  listLifecycleData,
  saveEmploymentMovement,
  startEmployeeOffboarding,
  toggleLifecycleItem,
} from "@/lib/lifecycle.functions";

export const Route = createFileRoute("/_authenticated/lifecycle")({
  component: LifecyclePage,
  head: () => ({
    meta: [
      { title: "دورة حياة الموظف | نظام الموارد البشرية" },
      {
        name: "description",
        content:
          "متابعة رحلة الموظف من التعيين والتهيئة وفترة التجربة والحركات الوظيفية حتى إنهاء الخدمة وإخلاء الطرف.",
      },
      { property: "og:title", content: "دورة حياة الموظف | نظام الموارد البشرية" },
      {
        property: "og:description",
        content: "قوائم تهيئة وإخلاء طرف، حركات وظيفية، وخط زمني كامل لكل موظف.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const today = () => new Date().toISOString().slice(0, 10);

function StageBadge({ stage }: { stage: LifecycleStage }) {
  const variant =
    stage === "terminated"
      ? "destructive"
      : stage === "active"
        ? "default"
        : ("secondary" as const);
  return <Badge variant={variant}>{STAGE_LABELS_LIFECYCLE[stage]}</Badge>;
}

function LifecyclePage() {
  const load = useServerFn(listLifecycleData);
  const { data, isLoading } = useQuery({ queryKey: ["lifecycle"], queryFn: () => load() });
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  if (isLoading) return <ListSkeleton />;
  if (selected)
    return (
      <EmployeeLifecycle
        employeeId={selected}
        onBack={() => setSelected(null)}
        canManage={data?.canManage ?? false}
      />
    );

  const rows = (data?.rows ?? []).filter((r) => filter === "all" || r.stage === filter);
  const counts = (data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.stage] = (acc[r.stage] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="دورة حياة الموظف"
        description="رحلة الموظف الكاملة: التعيين، التهيئة، فترة التجربة، الحركات الوظيفية، وإنهاء الخدمة وإخلاء الطرف."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(Object.keys(STAGE_LABELS_LIFECYCLE) as LifecycleStage[]).map((s) => (
          <Card
            key={s}
            className={`cursor-pointer transition-colors ${filter === s ? "border-primary" : ""}`}
            onClick={() => setFilter(filter === s ? "all" : s)}
          >
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{STAGE_LABELS_LIFECYCLE[s]}</p>
              <p className="font-display text-2xl font-bold">{counts[s] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={RouteIcon} title="لا يوجد موظفون" description="لا سجلات ضمن هذا التصنيف." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(r.id)}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.job_title ?? "—"} — {r.department}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {r.hire_date && <span>التعيين: {r.hire_date}</span>}
                  {r.stage === "probation" && <span>باقي على التثبيت: {r.probationDaysLeft} يوم</span>}
                  {r.openOnboarding > 0 && <span>بنود تهيئة مفتوحة: {r.openOnboarding}</span>}
                  <StageBadge stage={r.stage as LifecycleStage} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeLifecycle({
  employeeId,
  onBack,
  canManage,
}: {
  employeeId: string;
  onBack: () => void;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getLifecycleDetails);
  const { data, isLoading } = useQuery({
    queryKey: ["lifecycle", employeeId],
    queryFn: () => load({ data: { employee_id: employeeId } }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["lifecycle"] });
  };
  const run = <T,>(fn: (v: T) => Promise<unknown>, msg: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        toast.success(msg);
        invalidate();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  const genFn = useServerFn(generateLifecycleChecklist);
  const toggleFn = useServerFn(toggleLifecycleItem);
  const moveFn = useServerFn(saveEmploymentMovement);
  const confirmFn = useServerFn(confirmEmployeeProbation);
  const offStartFn = useServerFn(startEmployeeOffboarding);
  const offDoneFn = useServerFn(completeEmployeeOffboarding);

  /* eslint-disable react-hooks/rules-of-hooks */
  const genM = run(
    (v: { employee_id: string; kind: "onboarding" | "offboarding" }) => genFn({ data: v }),
    "تم توليد القائمة",
  );
  const toggleM = run((v: { id: string; done: boolean }) => toggleFn({ data: v }), "تم التحديث");
  const moveM = run(
    (v: {
      employee_id: string;
      movement_type: "promotion" | "transfer" | "salary_change" | "title_change" | "contract_renewal";
      effective_date: string;
      to_value: string;
      note: string | null;
      apply: boolean;
    }) => moveFn({ data: v }),
    "تم تسجيل الحركة الوظيفية",
  );
  const confirmM = run(
    (v: { employee_id: string }) => confirmFn({ data: v }),
    "تم تثبيت الموظف",
  );
  const offStartM = run(
    (v: {
      employee_id: string;
      termination_type: string;
      last_working_day: string;
      notice_date: string | null;
      reason: string | null;
      settlement_amount: number;
    }) => offStartFn({ data: v }),
    "تم فتح إجراءات إنهاء الخدمة",
  );
  const offDoneM = run(
    (v: { employee_id: string }) => offDoneFn({ data: v }),
    "تم إنهاء الخدمة واستكمال إخلاء الطرف",
  );
  /* eslint-enable react-hooks/rules-of-hooks */

  const [moveType, setMoveType] = useState("promotion");
  const [moveDate, setMoveDate] = useState(today());
  const [moveTo, setMoveTo] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [termType, setTermType] = useState("resignation");
  const [lastDay, setLastDay] = useState(today());
  const [termReason, setTermReason] = useState("");
  const [settlement, setSettlement] = useState("0");

  if (isLoading) return <ListSkeleton />;

  const checklist = data?.checklist ?? [];
  const onboarding = checklist.filter((i) => i.kind === "onboarding");
  const offboardingItems = checklist.filter((i) => i.kind === "offboarding");
  const manage = canManage && (data?.canManage ?? false);

  return (
    <div className="space-y-6">
      <PageHeader
        title={data?.employee?.full_name ?? "دورة حياة الموظف"}
        description={`${data?.employee?.job_title ?? "—"} — تاريخ التعيين: ${data?.employee?.hire_date ?? "—"}`}
        action={
          <Button variant="outline" onClick={onBack}>
            رجوع للقائمة
          </Button>
        }
      />

      <Tabs defaultValue="timeline">
        <TabsList className="flex-wrap">
          <TabsTrigger value="timeline">الخط الزمني</TabsTrigger>
          <TabsTrigger value="onboarding">التهيئة</TabsTrigger>
          <TabsTrigger value="movements">الحركات الوظيفية</TabsTrigger>
          <TabsTrigger value="offboarding">إنهاء الخدمة</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4 space-y-3">
          {(data?.events ?? []).length === 0 ? (
            <EmptyState icon={RouteIcon} title="لا أحداث" description="لم تُسجّل أحداث بعد لهذا الموظف." />
          ) : (
            <div className="space-y-2 border-s ps-4">
              {(data?.events ?? []).map((e) => (
                <div key={e.id} className="relative rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{e.title}</p>
                    <Badge variant="outline">
                      {LIFECYCLE_EVENT_LABELS[e.event_type] ?? e.event_type}
                    </Badge>
                  </div>
                  {e.details && <p className="mt-1 text-sm text-muted-foreground">{e.details}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{e.event_date}</p>
                </div>
              ))}
            </div>
          )}
          {manage && (
            <Button variant="outline" onClick={() => confirmM.mutate({ employee_id: employeeId })}>
              <CheckCircle2 className="ms-1 size-4" /> تثبيت بعد فترة التجربة
            </Button>
          )}
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4 space-y-3">
          <ChecklistBlock
            kind="onboarding"
            items={onboarding}
            manage={manage}
            onGenerate={() => genM.mutate({ employee_id: employeeId, kind: "onboarding" })}
            onToggle={(id, done) => toggleM.mutate({ id, done })}
          />
        </TabsContent>

        <TabsContent value="movements" className="mt-4 space-y-4">
          {manage && (
            <Card>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>نوع الحركة</Label>
                  <Select value={moveType} onValueChange={setMoveType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MOVEMENT_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ النفاذ</Label>
                  <Input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>القيمة الجديدة</Label>
                  <Input
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value)}
                    placeholder={moveType === "salary_change" ? "الراتب الجديد" : "المسمى/الوحدة الجديدة"}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>ملاحظة</Label>
                  <Textarea rows={2} value={moveNote} onChange={(e) => setMoveNote(e.target.value)} />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button
                    onClick={() =>
                      moveM.mutate({
                        employee_id: employeeId,
                        movement_type: moveType as "promotion",
                        effective_date: moveDate,
                        to_value: moveTo,
                        note: moveNote || null,
                        apply: true,
                      })
                    }
                  >
                    <Plus className="ms-1 size-4" /> تسجيل وتطبيق
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      moveM.mutate({
                        employee_id: employeeId,
                        movement_type: moveType as "promotion",
                        effective_date: moveDate,
                        to_value: moveTo,
                        note: moveNote || null,
                        apply: false,
                      })
                    }
                  >
                    تسجيل فقط
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {(data?.movements ?? []).map((m) => (
            <Card key={m.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-semibold">
                    {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    من {m.from_value ?? "—"} إلى {m.to_value ?? "—"} — نفاذاً من {m.effective_date}
                  </p>
                </div>
                <Badge variant={m.applied ? "default" : "outline"}>
                  {m.applied ? "مطبّقة" : "مسجّلة"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="offboarding" className="mt-4 space-y-4">
          {!data?.offboarding && manage && (
            <Card>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>نوع إنهاء الخدمة</Label>
                  <Select value={termType} onValueChange={setTermType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINATION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>آخر يوم عمل</Label>
                  <Input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>مستحقات نهاية الخدمة</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settlement}
                    onChange={(e) => setSettlement(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>السبب</Label>
                  <Textarea rows={2} value={termReason} onChange={(e) => setTermReason(e.target.value)} />
                </div>
                <Button
                  className="sm:col-span-2"
                  onClick={() =>
                    offStartM.mutate({
                      employee_id: employeeId,
                      termination_type: termType,
                      last_working_day: lastDay,
                      notice_date: today(),
                      reason: termReason || null,
                      settlement_amount: Number(settlement) || 0,
                    })
                  }
                >
                  <LogOut className="ms-1 size-4" /> بدء إجراءات إنهاء الخدمة
                </Button>
              </CardContent>
            </Card>
          )}

          {data?.offboarding && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="font-semibold">
                  {TERMINATION_TYPES.find((t) => t.value === data.offboarding?.termination_type)
                    ?.label ?? data.offboarding.termination_type}
                </p>
                <p className="text-sm text-muted-foreground">
                  آخر يوم عمل: {data.offboarding.last_working_day} — المستحقات:{" "}
                  {Number(data.offboarding.settlement_amount).toLocaleString("ar")}
                </p>
                {data.offboarding.reason && <p className="text-sm">{data.offboarding.reason}</p>}
                {manage && data.offboarding.status !== "completed" && (
                  <Button onClick={() => offDoneM.mutate({ employee_id: employeeId })}>
                    إنهاء الخدمة بعد اكتمال إخلاء الطرف
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <ChecklistBlock
            kind="offboarding"
            items={offboardingItems}
            manage={manage}
            onGenerate={() => genM.mutate({ employee_id: employeeId, kind: "offboarding" })}
            onToggle={(id, done) => toggleM.mutate({ id, done })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChecklistBlock({
  kind,
  items,
  manage,
  onGenerate,
  onToggle,
}: {
  kind: "onboarding" | "offboarding";
  items: { id: string; title: string; owner_role: string; due_date: string | null; is_done: boolean }[];
  manage: boolean;
  onGenerate: () => void;
  onToggle: (id: string, done: boolean) => void;
}) {
  const done = items.filter((i) => i.is_done).length;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">
            {CHECKLIST_KIND_LABELS[kind]} — {done}/{items.length}
          </p>
          {manage && (
            <Button size="sm" variant="outline" onClick={onGenerate}>
              <ListChecks className="ms-1 size-4" /> توليد من القوالب
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بنود بعد — استخدم التوليد من القوالب.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-lg border p-3">
                <button
                  type="button"
                  disabled={!manage}
                  aria-label={i.is_done ? "إلغاء الإنجاز" : "تحديد كمنجز"}
                  onClick={() => onToggle(i.id, !i.is_done)}
                  className="text-primary disabled:opacity-50"
                >
                  {i.is_done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${i.is_done ? "line-through text-muted-foreground" : ""}`}>
                    {i.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    المسؤول: {OWNER_ROLE_LABELS[i.owner_role] ?? i.owner_role}
                    {i.due_date ? ` — الاستحقاق: ${i.due_date}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
