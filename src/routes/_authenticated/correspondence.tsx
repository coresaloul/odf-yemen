import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Clock3,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import {
  CORRESPONDENCE_PRIORITY_LABELS,
  CORRESPONDENCE_STATUS_LABELS,
  type CorrespondenceDirection,
  type CorrespondenceRow,
} from "@/lib/correspondence";
import {
  deleteCorrespondence,
  listCorrespondence,
  saveCorrespondence,
  submitCorrespondence,
  updateCorrespondenceStatus,
} from "@/lib/correspondence.functions";

export const Route = createFileRoute("/_authenticated/correspondence")({
  component: CorrespondencePage,
  head: () => ({
    meta: [
      { title: "الصادر والوارد | نظام الموارد البشرية" },
      { name: "description", content: "تسجيل ومتابعة وأرشفة المراسلات الواردة والصادرة." },
    ],
  }),
});

const today = () => new Date().toISOString().slice(0, 10);
const initialForm = {
  id: "",
  direction: "incoming" as CorrespondenceDirection,
  subject: "",
  body: "",
  sender_name: "",
  recipient_name: "",
  external_reference: "",
  correspondence_date: today(),
  due_date: "",
  priority: "normal" as const,
  confidentiality: "internal",
  assigned_to: "",
  notes: "",
};

function CorrespondencePage() {
  const { isDirector, isHR } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<CorrespondenceDirection>("incoming");
  const load = useServerFn(listCorrespondence);
  const save = useServerFn(saveCorrespondence);
  const submit = useServerFn(submitCorrespondence);
  const changeStatus = useServerFn(updateCorrespondenceStatus);
  const remove = useServerFn(deleteCorrespondence);
  const query = useQuery({ queryKey: ["correspondence"], queryFn: () => load() });
  const employees = query.data?.employees ?? [];
  const filtered = useMemo(() => {
    const rows = (query.data?.rows ?? []) as CorrespondenceRow[];
    return rows.filter(
      (r) =>
        r.direction === tab &&
        `${r.subject} ${r.reference_no ?? ""} ${r.sender_name ?? ""} ${r.recipient_name ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    );
  }, [query.data?.rows, tab, search]);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["correspondence"] });
  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...form,
          id: form.id || null,
          body: form.body || null,
          sender_name: form.sender_name || null,
          recipient_name: form.recipient_name || null,
          external_reference: form.external_reference || null,
          due_date: form.due_date || null,
          assigned_to: form.assigned_to || null,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ المعاملة");
      setEditing(false);
      setForm(initialForm);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const submitMutation = useMutation({
    mutationFn: (id: string) => submit({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`تم التسجيل بالرقم ${r.referenceNo}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMutation = useMutation({
    mutationFn: (v: {
      id: string;
      status: "in_progress" | "waiting_response" | "completed" | "closed" | "cancelled";
    }) => changeStatus({ data: { ...v, note: null } }),
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف المسودة");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (key: keyof typeof initialForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (editing)
    return (
      <CorrespondenceForm
        form={form}
        employees={employees}
        busy={mutation.isPending}
        onChange={set}
        onCancel={() => setEditing(false)}
        onSave={() => mutation.mutate()}
      />
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title="الصادر والوارد"
        description="تسجيل المراسلات ومتابعة إحالتها وحالتها حتى الإغلاق"
        action={
          <>
            <Button variant="outline" className="gap-2" onClick={() => void query.refetch()}>
              <RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} /> تحديث
            </Button>
            <Button
              className="gap-2"
              onClick={() => {
                setForm({ ...initialForm, direction: tab });
                setEditing(true);
              }}
            >
              <Plus className="size-4" /> معاملة جديدة
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="بحث بالموضوع أو الرقم أو الجهة"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          <Badge variant="secondary" className="px-3 py-2">
            الإجمالي: {filtered.length}
          </Badge>
          <Badge variant="outline" className="px-3 py-2">
            متأخر:{" "}
            {
              filtered.filter(
                (r) =>
                  r.due_date &&
                  r.due_date < today() &&
                  !["completed", "closed", "cancelled"].includes(r.status),
              ).length
            }
          </Badge>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as CorrespondenceDirection)}>
        <TabsList>
          <TabsTrigger value="incoming" className="gap-2">
            <ArrowDownToLine className="size-4" /> الوارد
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="gap-2">
            <ArrowUpFromLine className="size-4" /> الصادر
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {query.isLoading ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="لا توجد معاملات"
              description="ابدأ بتسجيل معاملة جديدة من الأعلى"
            />
          ) : (
            filtered.map((row) => (
              <CorrespondenceCard
                key={row.id}
                row={row}
                canManage={isDirector || isHR}
                onEdit={() => {
                  setForm({
                    ...initialForm,
                    ...row,
                    id: row.id,
                    body: row.body ?? "",
                    sender_name: row.sender_name ?? "",
                    recipient_name: row.recipient_name ?? "",
                    external_reference: row.external_reference ?? "",
                    due_date: row.due_date ?? "",
                    assigned_to: row.assigned_to ?? "",
                    notes: row.notes ?? "",
                  });
                  setEditing(true);
                }}
                onSubmit={() => submitMutation.mutate(row.id)}
                onDelete={() => deleteMutation.mutate(row.id)}
                onStatus={(status) => statusMutation.mutate({ id: row.id, status })}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CorrespondenceForm({
  form,
  employees,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  form: typeof initialForm;
  employees: { id: string; full_name: string }[];
  busy: boolean;
  onChange: (key: keyof typeof initialForm, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={form.id ? "تعديل المعاملة" : "معاملة جديدة"}
        description="أدخل بيانات المراسلة ثم احفظها كمسودة"
      />
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>نوع المعاملة</Label>
              <Select value={form.direction} onValueChange={(v) => onChange("direction", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incoming">وارد</SelectItem>
                  <SelectItem value="outgoing">صادر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select value={form.priority} onValueChange={(v) => onChange("priority", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CORRESPONDENCE_PRIORITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>الموضوع</Label>
              <Input value={form.subject} onChange={(e) => onChange("subject", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الجهة المرسلة</Label>
              <Input
                value={form.sender_name}
                onChange={(e) => onChange("sender_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>الجهة المستلمة</Label>
              <Input
                value={form.recipient_name}
                onChange={(e) => onChange("recipient_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>رقم خطاب الجهة</Label>
              <Input
                value={form.external_reference}
                onChange={(e) => onChange("external_reference", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ المعاملة</Label>
              <Input
                type="date"
                value={form.correspondence_date}
                onChange={(e) => onChange("correspondence_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>آخر موعد للإجراء</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => onChange("due_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>المحال إليه</Label>
              <Select
                value={form.assigned_to || "none"}
                onValueChange={(v) => onChange("assigned_to", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر موظفاً" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون إحالة</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>محتوى أو ملخص المراسلة</Label>
            <Textarea
              rows={5}
              value={form.body}
              onChange={(e) => onChange("body", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>ملاحظات داخلية</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => onChange("notes", e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={onSave} disabled={busy || !form.subject.trim()}>
              <Check className="size-4" /> حفظ المسودة
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              إلغاء
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CorrespondenceCard({
  row,
  canManage,
  onEdit,
  onSubmit,
  onDelete,
  onStatus,
}: {
  row: CorrespondenceRow;
  canManage: boolean;
  onEdit: () => void;
  onSubmit: () => void;
  onDelete: () => void;
  onStatus: (
    status: "in_progress" | "waiting_response" | "completed" | "closed" | "cancelled",
  ) => void;
}) {
  const overdue =
    row.due_date &&
    row.due_date < today() &&
    !["completed", "closed", "cancelled"].includes(row.status);
  return (
    <Card className={overdue ? "border-destructive/50" : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  row.status === "completed" || row.status === "closed"
                    ? "default"
                    : row.status === "cancelled"
                      ? "destructive"
                      : "secondary"
                }
              >
                {CORRESPONDENCE_STATUS_LABELS[row.status]}
              </Badge>
              <Badge variant="outline">{CORRESPONDENCE_PRIORITY_LABELS[row.priority]}</Badge>
              {overdue && (
                <Badge variant="destructive" className="gap-1">
                  <Clock3 className="size-3" /> متأخرة
                </Badge>
              )}
            </div>
            <h2 className="mt-2 font-semibold">{row.subject}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.reference_no ?? "بدون رقم"} ·{" "}
              {row.direction === "incoming"
                ? `من: ${row.sender_name ?? "غير محدد"}`
                : `إلى: ${row.recipient_name ?? "غير محدد"}`}{" "}
              · {new Date(row.correspondence_date).toLocaleDateString("ar")}
            </p>
          </div>
        </div>
        {row.body && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{row.body}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {row.status === "draft" && (
            <Button size="sm" className="gap-1.5" onClick={onSubmit}>
              <Send className="size-3.5" /> تسجيل وإصدار الرقم
            </Button>
          )}
          {row.status === "registered" && (
            <Button size="sm" variant="outline" onClick={() => onStatus("in_progress")}>
              بدء الإجراء
            </Button>
          )}
          {["registered", "in_progress", "waiting_response"].includes(row.status) && (
            <Button size="sm" variant="outline" onClick={() => onStatus("completed")}>
              إنجاز
            </Button>
          )}
          {canManage && row.status !== "closed" && (
            <Button size="sm" variant="outline" onClick={() => onStatus("closed")}>
              إغلاق
            </Button>
          )}
          {(row.status === "draft" || row.status === "registered") && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              تعديل
            </Button>
          )}
          {row.status === "draft" && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" /> حذف
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
