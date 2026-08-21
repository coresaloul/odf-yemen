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
  Download,
  FileUp,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { buildStorageObjectKey } from "@/lib/storage-path";
import {
  type CorrespondenceAttachment,
  CORRESPONDENCE_PRIORITY_LABELS,
  CORRESPONDENCE_ACTION_LABELS,
  CORRESPONDENCE_STATUS_LABELS,
  type CorrespondenceAction,
  type CorrespondenceDirection,
  type CorrespondencePriority,
  type CorrespondenceRow,
} from "@/lib/correspondence";
import {
  deleteCorrespondence,
  deleteCorrespondenceAttachment,
  listCorrespondence,
  listCorrespondenceTrail,
  registerCorrespondenceAttachment,
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
type CorrespondenceFormState = {
  id: string;
  direction: CorrespondenceDirection;
  subject: string;
  body: string;
  sender_name: string;
  recipient_name: string;
  external_reference: string;
  correspondence_date: string;
  due_date: string;
  priority: CorrespondencePriority;
  confidentiality: string;
  assigned_to: string;
  notes: string;
};

const initialForm: CorrespondenceFormState = {
  id: "",
  direction: "incoming",
  subject: "",
  body: "",
  sender_name: "",
  recipient_name: "",
  external_reference: "",
  correspondence_date: today(),
  due_date: "",
  priority: "normal",
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
  const [trailFor, setTrailFor] = useState<CorrespondenceRow | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const load = useServerFn(listCorrespondence);
  const loadTrail = useServerFn(listCorrespondenceTrail);
  const save = useServerFn(saveCorrespondence);
  const submit = useServerFn(submitCorrespondence);
  const changeStatus = useServerFn(updateCorrespondenceStatus);
  const remove = useServerFn(deleteCorrespondence);
  const registerAttachment = useServerFn(registerCorrespondenceAttachment);
  const removeAttachment = useServerFn(deleteCorrespondenceAttachment);
  const query = useQuery({ queryKey: ["correspondence"], queryFn: () => load() });
  const trailQuery = useQuery({
    queryKey: ["correspondence-trail", trailFor?.id],
    enabled: Boolean(trailFor),
    queryFn: async () =>
      (await loadTrail({ data: { id: trailFor!.id } })) as CorrespondenceAction[],
  });
  const employees = query.data?.employees ?? [];
  const attachments = (query.data?.attachments ?? []) as CorrespondenceAttachment[];
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
    mutationFn: async () => {
      const saved = await save({
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
      });
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) throw new Error("حجم المرفق يتجاوز 50 ميجابايت");
        const path = buildStorageObjectKey(String(saved.id), file.name);
        const { error } = await supabase.storage.from("correspondence-files").upload(path, file);
        if (error) throw new Error(error.message);
        await registerAttachment({
          data: {
            correspondence_id: saved.id,
            file_path: path,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || null,
          },
        });
      }
      return saved;
    },
    onSuccess: () => {
      toast.success("تم حفظ المعاملة");
      setEditing(false);
      setForm(initialForm);
      setFiles([]);
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
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachment: CorrespondenceAttachment) => {
      const { error } = await supabase.storage
        .from("correspondence-files")
        .remove([attachment.file_path]);
      if (error) throw new Error(error.message);
      await removeAttachment({ data: { id: attachment.id } });
    },
    onSuccess: () => {
      toast.success("تم حذف المرفق");
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
        files={files}
        onFilesChange={setFiles}
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
                  setFiles([]);
                  setEditing(true);
                }}
                onSubmit={() => submitMutation.mutate(row.id)}
                onDelete={() => deleteMutation.mutate(row.id)}
                onTrail={() => setTrailFor(row)}
                attachments={attachments.filter(
                  (attachment) => attachment.correspondence_id === row.id,
                )}
                onAttachmentOpen={async (attachment) => {
                  const { data, error } = await supabase.storage
                    .from("correspondence-files")
                    .createSignedUrl(attachment.file_path, 60);
                  if (error || !data) {
                    toast.error("تعذر فتح المرفق");
                    return;
                  }
                  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                }}
                onAttachmentDelete={(attachment) => deleteAttachmentMutation.mutate(attachment)}
                onStatus={(status) => statusMutation.mutate({ id: row.id, status })}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={Boolean(trailFor)} onOpenChange={(open) => !open && setTrailFor(null)}>
        <DialogContent dir="rtl" className="max-h-[80vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>سجل إجراءات المعاملة</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(trailQuery.data ?? []).map((action) => (
              <div key={action.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">
                    {CORRESPONDENCE_ACTION_LABELS[action.action] ?? action.action}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(action.created_at).toLocaleString("ar")}
                  </span>
                </div>
                {action.note && <p className="mt-1 text-muted-foreground">{action.note}</p>}
              </div>
            ))}
            {!trailQuery.isLoading && (trailQuery.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد إجراءات مسجلة.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CorrespondenceForm({
  form,
  employees,
  files,
  onFilesChange,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  form: typeof initialForm;
  employees: { id: string; full_name: string }[];
  files: File[];
  onFilesChange: (files: File[]) => void;
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
          <div className="space-y-2">
            <Label htmlFor="correspondence-files">المرفقات</Label>
            <Input
              id="correspondence-files"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.png,.jpg,.jpeg,.webp,.gif"
              onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
            />
            {files.length > 0 && (
              <div className="space-y-1 rounded-lg border p-2 text-xs text-muted-foreground">
                {files.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center gap-2">
                    <FileUp className="size-3.5" /> {file.name}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">الحد الأقصى للمرفق الواحد 50 ميجابايت.</p>
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
  attachments,
  onEdit,
  onSubmit,
  onDelete,
  onTrail,
  onAttachmentOpen,
  onAttachmentDelete,
  onStatus,
}: {
  row: CorrespondenceRow;
  canManage: boolean;
  attachments: CorrespondenceAttachment[];
  onEdit: () => void;
  onSubmit: () => void;
  onDelete: () => void;
  onTrail: () => void;
  onAttachmentOpen: (attachment: CorrespondenceAttachment) => void;
  onAttachmentDelete: (attachment: CorrespondenceAttachment) => void;
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
        {attachments.length > 0 && (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-semibold">المرفقات ({attachments.length})</p>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate">{attachment.file_name}</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAttachmentOpen(attachment)}
                    aria-label="فتح المرفق"
                  >
                    <Download className="size-4" /> فتح
                  </Button>
                  {row.status === "draft" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => onAttachmentDelete(attachment)}
                    >
                      <Trash2 className="size-4" /> حذف
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
          <Button size="sm" variant="ghost" onClick={onTrail}>
            سجل الإجراءات
          </Button>
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
