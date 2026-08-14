import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import { RECURRENCE_LABELS, isOverdue, type TaskRow } from "./task-utils";

export function TaskDetailsPanel({
  task,
  assigneeName,
  assignerName,
  supervisorName,
  canManage,
  canUpdateProgress,
  onProgress,
}: {
  task: TaskRow;
  assigneeName: string;
  assignerName: string;
  supervisorName?: string | null;
  canManage: boolean;
  canUpdateProgress: boolean;
  onProgress: (progress: number) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const taskId = task.id;
  const [note, setNote] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);

  const detail = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      const [updates, subtasks, attachments] = await Promise.all([
        supabase
          .from("task_updates")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: false }),
        supabase.from("task_subtasks").select("*").eq("task_id", taskId).order("position"),
        supabase
          .from("task_attachments")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: false }),
      ]);

      const creatorIds = [...new Set((updates.data ?? []).map((u) => u.created_by).filter(Boolean))] as string[];
      const creatorMap: Record<string, string> = {};

      if (creatorIds.length > 0) {
        const [{ data: profileRows }, { data: employeeRows }] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", creatorIds),
          supabase.from("employees").select("user_id, full_name").in("user_id", creatorIds),
        ]);

        for (const row of profileRows ?? []) {
          creatorMap[row.id] = row.full_name || "مستخدم";
        }
        for (const row of employeeRows ?? []) {
          creatorMap[row.user_id] = row.full_name || creatorMap[row.user_id] || "مستخدم";
        }
      }

      return {
        updates: (updates.data ?? []).map((u) => ({
          ...u,
          creator_name: u.created_by ? creatorMap[u.created_by] ?? "مستخدم" : "النظام",
        })),
        subtasks: subtasks.data ?? [],
        attachments: attachments.data ?? [],
      };
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["task-detail", taskId] });
    void qc.invalidateQueries({ queryKey: ["task-page", taskId] });
    void qc.invalidateQueries({ queryKey: ["tasks-page"] });
  };

  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("task_updates").insert({
        task_id: taskId,
        note: note.trim(),
        progress: task.progress ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      toast.success("تمت إضافة التحديث");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSubtask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("task_subtasks").insert({
        task_id: taskId,
        title: subtaskTitle.trim(),
        position: detail.data?.subtasks.length ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubtaskTitle("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSubtask = useMutation({
    mutationFn: async (v: { id: string; is_done: boolean }) => {
      const { error } = await supabase
        .from("task_subtasks")
        .update({ is_done: v.is_done })
        .eq("id", v.id);
      if (error) throw error;
      const list = (detail.data?.subtasks ?? []).map((s) =>
        s.id === v.id ? { ...s, is_done: v.is_done } : s,
      );
      if (list.length > 0) {
        const pct = Math.round((list.filter((s) => s.is_done).length / list.length) * 100);
        onProgress(pct);
      }
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${taskId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("task-files").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("تم رفع المرفق");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر رفع الملف");
    } finally {
      setUploading(false);
    }
  };

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("task-files").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("تعذر فتح الملف");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const removeAttachment = useMutation({
    mutationFn: async (row: { id: string; file_path: string }) => {
      await supabase.storage.from("task-files").remove([row.file_path]);
      const { error } = await supabase.from("task_attachments").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{PRIORITY_LABELS[task.priority]}</Badge>
        <Badge variant={task.status === "completed" ? "default" : "secondary"}>
          {TASK_STATUS_LABELS[task.status]}
        </Badge>
        {isOverdue(task) && <Badge variant="destructive">متأخرة</Badge>}
        {task.created_via_voice && <Badge variant="secondary">أُضيفت صوتياً</Badge>}
        <Badge variant="outline">{RECURRENCE_LABELS[task.recurrence ?? "none"] ?? "بدون تكرار"}</Badge>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <Progress value={task.progress} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">التقدم {draft ?? task.progress}%</span>
          {canUpdateProgress && (
            <>
              <Slider
                className="w-40"
                value={[draft ?? task.progress]}
                max={100}
                step={5}
                onValueChange={(v) => setDraft(v[0] ?? 0)}
                onValueCommit={(v) => {
                  onProgress(v[0] ?? 0);
                  setDraft(null);
                }}
              />
              {[25, 50, 75, 100].map((p) => (
                <Button key={p} size="sm" variant="outline" type="button" onClick={() => onProgress(p)}>
                  {p}%
                </Button>
              ))}
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" dir="rtl">
        <TabsList className="w-full" dir="rtl">
          <TabsTrigger value="details" className="flex-1">التفاصيل</TabsTrigger>
          <TabsTrigger value="updates" className="flex-1">سجل المتابعة</TabsTrigger>
          <TabsTrigger value="subtasks" className="flex-1">المهام الفرعية</TabsTrigger>
          <TabsTrigger value="files" className="flex-1">المرفقات</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-3 pt-4 text-right" dir="rtl">
          {task.description && (
            <div className="rounded-md border bg-muted/30 p-3 text-right">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">الوصف</p>
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{task.description}</p>
            </div>
          )}
          <dl className="grid gap-2 text-sm sm:grid-cols-2" dir="rtl">
            <Row label="الموظف المكلّف" value={assigneeName} />
            <Row label="المكلِّف" value={assignerName} />
            <Row label="المشرف على المهمة" value={supervisorName || "—"} />
            <Row label="تاريخ البدء" value={formatDate(task.start_date)} />
            <Row label="تاريخ الاستحقاق" value={formatDate(task.due_date)} />
            <Row label="وزن المهمة" value={String(task.weight)} />
            <Row label="نسبة الإنجاز" value={`${task.progress}%`} />
            <Row label="تاريخ الإنشاء" value={formatDate(task.created_at)} />
            <Row label="تاريخ الإكمال" value={formatDate(task.completed_at)} />
          </dl>
        </TabsContent>

        <TabsContent value="updates" className="space-y-4 pt-4 text-right" dir="rtl">
          <div className="space-y-2">
            <Label className="block text-right">إضافة ملاحظة/تحديث</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="text-right" />
            <div className="flex justify-end">
              <Button size="sm" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()}>
                <Plus className="size-4" /> إضافة
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {(detail.data?.updates ?? []).map((u) => (
              <div key={u.id} className="rounded-md border p-3 text-sm text-right" dir="rtl">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{u.creator_name}</span>
                  {u.progress !== null && <span className="text-xs text-muted-foreground">{u.progress}%</span>}
                </div>
                <p className="whitespace-pre-wrap">{u.note || "تحديث نسبة الإنجاز"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleString("ar-EG-u-nu-latn")}
                </p>
              </div>
            ))}
            {(detail.data?.updates.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد تحديثات بعد.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="subtasks" className="space-y-4 pt-4 text-right" dir="rtl">
          <div className="flex flex-row-reverse gap-2">
            <Input
              placeholder="عنوان المهمة الفرعية"
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              className="text-right"
            />
            <Button
              size="sm"
              disabled={!subtaskTitle.trim() || addSubtask.isPending}
              onClick={() => addSubtask.mutate()}
            >
              <Plus className="size-4" /> إضافة
            </Button>
          </div>
          <div className="space-y-2">
            {(detail.data?.subtasks ?? []).map((s) => (
              <div key={s.id} className="flex flex-row-reverse items-center justify-between rounded-md border p-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={s.is_done}
                    onCheckedChange={(v) => toggleSubtask.mutate({ id: s.id, is_done: !!v })}
                  />
                  <span className={s.is_done ? "text-muted-foreground line-through" : ""}>{s.title}</span>
                </label>
                {canManage && (
                  <Button size="icon" variant="ghost" onClick={() => removeSubtask.mutate(s.id)} aria-label="حذف">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {(detail.data?.subtasks.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد مهام فرعية.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4 pt-4 text-right" dir="rtl">
          <div className="flex flex-row-reverse items-center gap-2">
            <Input
              type="file"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          </div>
          <div className="space-y-2">
            {(detail.data?.attachments ?? []).map((a) => (
              <div key={a.id} className="flex flex-row-reverse items-center justify-between rounded-md border p-2 text-sm">
                <span className="truncate">{a.file_name}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => void download(a.file_path)} aria-label="تنزيل">
                    <Download className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeAttachment.mutate({ id: a.id, file_path: a.file_path })}
                    aria-label="حذف"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {(detail.data?.attachments.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد مرفقات.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-row-reverse items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-right" dir="rtl">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
