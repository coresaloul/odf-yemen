import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Award, Gavel, Plus, Send, Trash2, ShieldAlert } from "lucide-react";
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
import { STAGE_LABELS } from "@/lib/evaluation-approval";
import {
  APPEAL_STATUS_LABELS,
  MONTHLY_DEDUCTION_DAYS_CAP,
  isActiveSanction,
  type DisciplinaryType,
  type DisciplineKind,
  type DisciplineRecord,
} from "@/lib/discipline";
import {
  decideDisciplineAppeal,
  decideDisciplineRecord,
  deleteDisciplineRecord,
  listDisciplineData,
  saveRecognitionFn,
  saveSanctionFn,
  submitDisciplineAppeal,
} from "@/lib/discipline.functions";

export const Route = createFileRoute("/_authenticated/discipline")({
  component: DisciplinePage,
  head: () => ({
    meta: [
      { title: "التكريم والجزاءات | نظام الموارد البشرية" },
      {
        name: "description",
        content:
          "إدارة التكريم والمكافآت والإنذارات والجزاءات التأديبية وفق قانون العمل اليمني مع مسار اعتماد وتظلّم ومحو تلقائي.",
      },
      { property: "og:title", content: "التكريم والجزاءات | نظام الموارد البشرية" },
      {
        property: "og:description",
        content: "سجل تأديبي متدرّج وتكريم للموظفين مع اعتماد إلكتروني وربط بالرواتب.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const today = () => new Date().toISOString().slice(0, 10);

type Employee = { id: string; name: string; employee_no: string; department: string };

type RecognitionInput = {
  id?: string | null;
  employee_id: string;
  type_id: string;
  title: string;
  reason: string | null;
  award_date: string;
  amount: number;
  submit: boolean;
};

type SanctionInput = {
  id?: string | null;
  employee_id: string;
  type_id: string;
  violation_date: string;
  discovered_date: string;
  violation_description: string;
  employee_statement: string | null;
  penalty_days: number;
  amount: number;
  submit: boolean;
};

function StageBadge({ stage }: { stage: DisciplineRecord["stage"] }) {
  const variant =
    stage === "approved" ? "default" : stage === "returned" ? "destructive" : "outline";
  return <Badge variant={variant}>{STAGE_LABELS[stage] ?? stage}</Badge>;
}

function DisciplinePage() {
  const qc = useQueryClient();
  const load = useServerFn(listDisciplineData);
  const { data, isLoading } = useQuery({ queryKey: ["discipline"], queryFn: () => load() });

  const [tab, setTab] = useState("sanctions");
  const [form, setForm] = useState<{ kind: DisciplineKind; record: DisciplineRecord | null } | null>(
    null,
  );

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["discipline"] });

  const saveRec = useServerFn(saveRecognitionFn);
  const saveSan = useServerFn(saveSanctionFn);
  const removeFn = useServerFn(deleteDisciplineRecord);
  const decideFn = useServerFn(decideDisciplineRecord);
  const appealFn = useServerFn(submitDisciplineAppeal);
  const appealDecideFn = useServerFn(decideDisciplineAppeal);

  const mutate = <T,>(fn: (v: T) => Promise<unknown>, okMsg: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        toast.success(okMsg);
        setForm(null);
        invalidate();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  /* eslint-disable react-hooks/rules-of-hooks */
  const saveRecM = mutate(
    (v: RecognitionInput) => saveRec({ data: v }),
    "تم حفظ سجل التكريم",
  );
  const saveSanM = mutate((v: SanctionInput) => saveSan({ data: v }), "تم حفظ الجزاء");

  const removeM = mutate(
    (v: { kind: DisciplineKind; id: string }) => removeFn({ data: v }),
    "تم الحذف",
  );
  const decideM = mutate(
    (v: { kind: DisciplineKind; id: string; action: "approved" | "returned"; note?: string }) =>
      decideFn({ data: v }),
    "تم تنفيذ القرار",
  );
  const appealM = mutate(
    (v: { id: string; note: string }) => appealFn({ data: v }),
    "تم إرسال التظلّم",
  );
  const appealDecideM = mutate(
    (v: { id: string; decision: "accepted" | "rejected"; note?: string }) =>
      appealDecideFn({ data: v }),
    "تم البت في التظلّم",
  );
  /* eslint-enable react-hooks/rules-of-hooks */

  const rows = data?.rows ?? [];
  const sanctions = rows.filter((r) => r.kind === "sanction");
  const recognitions = rows.filter((r) => r.kind === "recognition");
  const types = data?.types ?? [];
  const canManage = data?.canManage ?? false;

  if (isLoading) return <ListSkeleton />;

  if (form) {
    return form.kind === "recognition" ? (
      <RecognitionForm
        types={types.filter((t) => t.kind === "recognition" && t.active)}
        employees={data?.employees ?? []}
        record={form.record}
        busy={saveRecM.isPending}
        onCancel={() => setForm(null)}
        onSave={(v) => saveRecM.mutate(v)}
      />
    ) : (
      <SanctionForm
        types={types.filter((t) => t.kind === "sanction" && t.active)}
        employees={data?.employees ?? []}
        records={sanctions}
        record={form.record}
        busy={saveSanM.isPending}
        onCancel={() => setForm(null)}
        onSave={(v) => saveSanM.mutate(v)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="التكريم والجزاءات"
        description="سجل التكريم والمكافآت والإنذارات والجزاءات التأديبية وفق قانون العمل اليمني، بتدرّج ملزم وحق تظلّم ومحو تلقائي للجزاء بعد مدته."
        action={
          <>
            <Button variant="outline" onClick={() => setForm({ kind: "recognition", record: null })}>
              <Award className="ms-1 size-4" /> تكريم
            </Button>
            <Button onClick={() => setForm({ kind: "sanction", record: null })}>
              <Plus className="ms-1 size-4" /> جزاء
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sanctions">الجزاءات ({sanctions.length})</TabsTrigger>
          <TabsTrigger value="recognitions">التكريم ({recognitions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sanctions" className="mt-4 space-y-3">
          {sanctions.length === 0 ? (
            <EmptyState
              icon={Gavel}
              title="لا توجد جزاءات"
              description="السجل التأديبي نظيف — لا جزاءات مسجلة ضمن صلاحياتك."
            />
          ) : (
            sanctions.map((r) => (
              <RecordCard
                key={r.id}
                row={r}
                canManage={canManage}
                isMine={r.employee_id === data?.myEmployeeId}
                onEdit={() => setForm({ kind: r.kind, record: r })}
                onDelete={() => removeM.mutate({ kind: r.kind, id: r.id })}
                onDecide={(action, note) =>
                  decideM.mutate({ kind: r.kind, id: r.id, action, ...(note ? { note } : {}) })
                }
                onAppeal={(note) => appealM.mutate({ id: r.id, note })}
                onAppealDecision={(decision) => appealDecideM.mutate({ id: r.id, decision })}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="recognitions" className="mt-4 space-y-3">
          {recognitions.length === 0 ? (
            <EmptyState
              icon={Award}
              title="لا توجد سجلات تكريم"
              description="ابدأ بتكريم الموظفين المتميزين لتوثيق الأداء الإيجابي."
            />
          ) : (
            recognitions.map((r) => (
              <RecordCard
                key={r.id}
                row={r}
                canManage={canManage}
                isMine={r.employee_id === data?.myEmployeeId}
                onEdit={() => setForm({ kind: r.kind, record: r })}
                onDelete={() => removeM.mutate({ kind: r.kind, id: r.id })}
                onDecide={(action, note) =>
                  decideM.mutate({ kind: r.kind, id: r.id, action, ...(note ? { note } : {}) })
                }
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecordCard({
  row,
  canManage,
  isMine,
  onEdit,
  onDelete,
  onDecide,
  onAppeal,
  onAppealDecision,
}: {
  row: DisciplineRecord;
  canManage: boolean;
  isMine: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDecide: (action: "approved" | "returned", note?: string) => void;
  onAppeal?: (note: string) => void;
  onAppealDecision?: (decision: "accepted" | "rejected") => void;
}) {
  const [note, setNote] = useState("");
  const editable = row.stage === "draft" || row.stage === "returned";
  const pending = row.stage.startsWith("pending");
  const active = isActiveSanction(row);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">
              {row.title}
              {row.degree > 0 && (
                <span className="ms-2 text-xs text-muted-foreground">الدرجة {row.degree}</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {row.employee_name} — {row.department_name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {row.kind === "sanction" && (
              <Badge variant={active ? "destructive" : "secondary"}>
                {row.erased || row.appeal_status === "accepted"
                  ? "ممحو من السجل"
                  : active
                    ? "فعّال"
                    : "غير فعّال"}
              </Badge>
            )}
            <StageBadge stage={row.stage} />
          </div>
        </div>

        {row.reason && <p className="text-sm leading-relaxed">{row.reason}</p>}

        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          {row.violation_date && <span>تاريخ الواقعة: {row.violation_date}</span>}
          {row.discovered_date && <span>تاريخ الاكتشاف: {row.discovered_date}</span>}
          {row.award_date && <span>تاريخ التكريم: {row.award_date}</span>}
          {row.penalty_days > 0 && <span>الخصم: أجر {row.penalty_days} أيام</span>}
          {row.amount > 0 && <span>المبلغ: {row.amount.toLocaleString("ar")} </span>}
          {row.erase_at && <span>يُمحى في: {row.erase_at}</span>}
        </div>

        {row.employee_statement && (
          <p className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="font-semibold">إفادة الموظف: </span>
            {row.employee_statement}
          </p>
        )}

        {row.return_reason && (
          <p className="text-sm text-destructive">سبب الإعادة: {row.return_reason}</p>
        )}

        {row.kind === "sanction" && row.appeal_status !== "none" && (
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-semibold">{APPEAL_STATUS_LABELS[row.appeal_status]}</p>
            {row.appeal_note && <p className="text-muted-foreground">{row.appeal_note}</p>}
            {row.appeal_decision_note && <p>القرار: {row.appeal_decision_note}</p>}
            {canManage && row.appeal_status === "submitted" && onAppealDecision && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => onAppealDecision("accepted")}>
                  قبول التظلّم وإلغاء الجزاء
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAppealDecision("rejected")}>
                  رفض التظلّم
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {editable && canManage && (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Send className="ms-1 size-4" /> تعديل / رفع للاعتماد
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete}>
                <Trash2 className="ms-1 size-4" /> حذف
              </Button>
            </>
          )}
          {pending && canManage && (
            <>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ملاحظة القرار (مطلوبة عند الإعادة)"
                className="h-9 w-full sm:w-64"
              />
              <Button size="sm" onClick={() => onDecide("approved", note || undefined)}>
                اعتماد
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDecide("returned", note || undefined)}
              >
                إعادة
              </Button>
            </>
          )}
          {isMine && row.kind === "sanction" && row.stage === "approved" &&
            row.appeal_status === "none" &&
            onAppeal && (
              <>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="سبب التظلّم"
                  className="h-9 w-full sm:w-64"
                />
                <Button size="sm" variant="outline" onClick={() => note && onAppeal(note)}>
                  <ShieldAlert className="ms-1 size-4" /> تقديم تظلّم
                </Button>
              </>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeePicker({
  employees,
  value,
  onChange,
}: {
  employees: Employee[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>الموظف</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="اختر الموظف" />
        </SelectTrigger>
        <SelectContent>
          {employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name} — {e.employee_no}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RecognitionForm({
  types,
  employees,
  record,
  busy,
  onCancel,
  onSave,
}: {
  types: DisciplinaryType[];
  employees: Employee[];
  record: DisciplineRecord | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (v: {
    id?: string | null;
    employee_id: string;
    type_id: string;
    title: string;
    reason: string | null;
    award_date: string;
    amount: number;
    submit: boolean;
  }) => void;
}) {
  const [employeeId, setEmployeeId] = useState(record?.employee_id ?? "");
  const [typeId, setTypeId] = useState(record?.type_id ?? types[0]?.id ?? "");
  const [title, setTitle] = useState(record?.title ?? "");
  const [reason, setReason] = useState(record?.reason ?? "");
  const [awardDate, setAwardDate] = useState(record?.award_date ?? today());
  const [amount, setAmount] = useState(String(record?.amount ?? 0));

  const submit = (send: boolean) => {
    if (!employeeId || !typeId || title.trim().length < 2) {
      toast.error("أكمل الموظف ونوع التكريم والعنوان");
      return;
    }
    onSave({
      id: record?.id ?? null,
      employee_id: employeeId,
      type_id: typeId,
      title: title.trim(),
      reason: reason.trim() || null,
      award_date: awardDate,
      amount: Number(amount) || 0,
      submit: send,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={record ? "تعديل تكريم" : "تكريم موظف"} description="توثيق التميّز والمكافآت وربطها بالرواتب عند الاعتماد." />
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <EmployeePicker employees={employees} value={employeeId} onChange={setEmployeeId} />
          <div className="space-y-1.5">
            <Label>نوع التكريم</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ التكريم</Label>
            <Input type="date" value={awardDate} onChange={(e) => setAwardDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>المبلغ (إن وجد)</Label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>سبب التكريم</Label>
            <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => submit(true)}>
          حفظ ورفع للاعتماد
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => submit(false)}>
          حفظ كمسودة
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  );
}

function SanctionForm({
  types,
  employees,
  records,
  record,
  busy,
  onCancel,
  onSave,
}: {
  types: DisciplinaryType[];
  employees: Employee[];
  records: DisciplineRecord[];
  record: DisciplineRecord | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (v: {
    id?: string | null;
    employee_id: string;
    type_id: string;
    violation_date: string;
    discovered_date: string;
    violation_description: string;
    employee_statement: string | null;
    penalty_days: number;
    amount: number;
    submit: boolean;
  }) => void;
}) {
  const [employeeId, setEmployeeId] = useState(record?.employee_id ?? "");
  const [typeId, setTypeId] = useState(record?.type_id ?? "");
  const [violationDate, setViolationDate] = useState(record?.violation_date ?? today());
  const [discoveredDate, setDiscoveredDate] = useState(record?.discovered_date ?? today());
  const [description, setDescription] = useState(record?.reason ?? "");
  const [statement, setStatement] = useState(record?.employee_statement ?? "");
  const [days, setDays] = useState(String(record?.penalty_days ?? 0));
  const [amount, setAmount] = useState(String(record?.amount ?? 0));

  const history = useMemo(
    () => records.filter((r) => r.employee_id === employeeId && isActiveSanction(r)),
    [records, employeeId],
  );
  const selectedType = types.find((t) => t.id === typeId);
  const suggested = useMemo(
    () => Math.min(history.reduce((m, r) => Math.max(m, r.degree), 0) + 1, 7),
    [history],
  );

  const submit = (send: boolean) => {
    if (!employeeId || !typeId || description.trim().length < 3) {
      toast.error("أكمل الموظف ونوع الجزاء ووصف المخالفة");
      return;
    }
    onSave({
      id: record?.id ?? null,
      employee_id: employeeId,
      type_id: typeId,
      violation_date: violationDate,
      discovered_date: discoveredDate,
      violation_description: description.trim(),
      employee_statement: statement.trim() || null,
      penalty_days: Number(days) || 0,
      amount: Number(amount) || 0,
      submit: send,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={record ? "تعديل جزاء" : "توقيع جزاء تأديبي"}
        description={`التدرّج في الجزاء إلزامي، ولا يجوز أن يتجاوز مجموع الخصم الشهري أجر ${MONTHLY_DEDUCTION_DAYS_CAP} أيام، ولا بد من سماع أقوال الموظف قبل الاعتماد.`}
      />
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <EmployeePicker employees={employees} value={employeeId} onChange={setEmployeeId} />
          <div className="space-y-1.5">
            <Label>نوع الجزاء</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.degree}. {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {employeeId && (
              <p className="text-xs text-muted-foreground">
                السجل الفعّال: {history.length} جزاء — الدرجة المقترحة: {suggested}
              </p>
            )}
            {selectedType && selectedType.max_days > 0 && (
              <p className="text-xs text-muted-foreground">
                الحد الأقصى لهذا الجزاء: أجر {selectedType.max_days} أيام
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الواقعة</Label>
            <Input
              type="date"
              value={violationDate}
              onChange={(e) => setViolationDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الاكتشاف</Label>
            <Input
              type="date"
              value={discoveredDate}
              onChange={(e) => setDiscoveredDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>أيام الخصم</Label>
            <Input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>قيمة الخصم المالي (إن وجدت)</Label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>وصف المخالفة</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>إفادة الموظف (سماع الأقوال) — مطلوبة قبل الاعتماد</Label>
            <Textarea rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => submit(true)}>
          حفظ ورفع للاعتماد
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => submit(false)}>
          حفظ كمسودة
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  );
}
