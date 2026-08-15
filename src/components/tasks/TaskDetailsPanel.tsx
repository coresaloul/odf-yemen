import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, Loader2, Pencil, Plus, Printer, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { exportPdf, exportWord } from "@/lib/report-export";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import { isOverdue, RECURRENCE_LABELS } from "./task-utils";
import type { TaskRow } from "./task-utils";

type TaskDetailsPanelProps = {
  task: TaskRow;
  assigneeName: string;
  assignerName: string;
  supervisorName: string | null;
  canManage: boolean;
  canUpdateProgress: boolean;
  onProgress: (progress: number) => void;
};

export function TaskDetailsPanel({
  task,
  assigneeName,
  assignerName,
  supervisorName,
  canManage,
  canUpdateProgress,
  onProgress,
}: TaskDetailsPanelProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const taskId = task.id;
  const [note, setNote] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editingUpdateText, setEditingUpdateText] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);

  const detail = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      const [updates, subtasks, attachments] = await Promise.all([
        supabase.from("task_updates").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
        supabase.from("task_subtasks").select("*").eq("task_id", taskId).order("position"),
        supabase.from("task_attachments").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
      ]);

      const rawSubtasks = (subtasks.data ?? []) as Array<{
        id: string;
        task_id: string;
        title: string;
        is_done: boolean;
        position: number;
        created_by?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;

      const creatorIds = [
        ...new Set([
          ...(updates.data ?? []).map((u) => u.created_by).filter(Boolean),
          ...rawSubtasks.map((s) => s.created_by).filter(Boolean),
        ]),
      ] as string[];

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
          if (row.user_id) {
            creatorMap[row.user_id] = row.full_name || creatorMap[row.user_id] || "مستخدم";
          }
        }
      }

      return {
        updates: (updates.data ?? []).map((u) => ({
          ...u,
          creator_name: u.created_by ? (creatorMap[u.created_by] ?? "مستخدم") : "النظام",
        })),
        subtasks: rawSubtasks.map((s) => ({
          ...s,
          creator_name: s.created_by ? (creatorMap[s.created_by] ?? "مستخدم") : "غير محدد",
        })),
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

  const updateNote = useMutation({
    mutationFn: async ({ id, noteText }: { id: string; noteText: string }) => {
      const trimmed = noteText.trim();
      if (!trimmed) throw new Error("نص الملاحظة مطلوب");

      const { error } = await supabase.from("task_updates").update({ note: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingUpdateId(null);
      setEditingUpdateText("");
      toast.success("تم تحديث الملاحظة");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_updates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الملاحظة");
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
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubtaskTitle("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSubtask = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const trimmed = title.trim();
      if (!trimmed) throw new Error("عنوان المهمة الفرعية مطلوب");

      const { error } = await supabase.from("task_subtasks").update({ title: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingSubtaskId(null);
      setEditingSubtaskTitle("");
      toast.success("تم تحديث المهمة الفرعية");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSubtask = useMutation({
    mutationFn: async (value: { id: string; is_done: boolean }) => {
      const { error } = await supabase
        .from("task_subtasks")
        .update({ is_done: value.is_done })
        .eq("id", value.id);
      if (error) throw error;

      const list = (detail.data?.subtasks ?? []).map((s) =>
        s.id === value.id ? { ...s, is_done: value.is_done } : s,
      );
      if (list.length > 0) {
        onProgress(Math.round((list.filter((s) => s.is_done).length / list.length) * 100));
      }
    },
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAttachment = useMutation({
    mutationFn: async (row: { id: string; file_path: string }) => {
      await supabase.storage.from("task-files").remove([row.file_path]);
      const { error } = await supabase.from("task_attachments").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => refresh(),
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

  const buildTaskReport = () => {
    const updates = (detail.data?.updates ?? []).map((u) => {
      const details = [u.note ? `ملاحظة: ${u.note}` : "تحديث النسبة"].join(" ");
      const progressSuffix = u.progress !== null ? ` | النسبة ${u.progress}%` : "";
      return `${new Date(u.created_at).toLocaleString("ar-EG-u-nu-latn")}${progressSuffix} — ${details}`;
    });

    const subtasks = (detail.data?.subtasks ?? []).map((s) => [s.title, s.is_done ? "مكتملة" : "قيد التنفيذ"]);
    const attachments = (detail.data?.attachments ?? []).map((a) => {
      const size = a.file_size ? `${Math.max(1, Math.round(a.file_size / 1024))} KB` : "غير محدد";
      return `${a.file_name} (${size})`;
    });

    return {
      title: `مهمة: ${task.title}`,
      subtitle: `الموظف المكلف: ${assigneeName} | المكلّف: ${assignerName}`,
      periodLabel: `التاريخ: ${formatDate(task.start_date)} - ${formatDate(task.due_date)}`,
      meta: [
        { label: "الحالة", value: TASK_STATUS_LABELS[task.status] ?? "غير محدد" },
        { label: "الأولوية", value: PRIORITY_LABELS[task.priority] ?? "غير محدد" },
        { label: "المشرف", value: supervisorName || "—" },
        { label: "نسبة الإنجاز", value: `${task.progress}%` },
        { label: "الوزن", value: String(task.weight ?? 0) },
        { label: "التكرار", value: RECURRENCE_LABELS[task.recurrence ?? "none"] ?? "بدون تكرار" },
      ],
      sections: [
        {
          heading: "الوصف",
          paragraphs: [task.description?.trim() || "لا يوجد وصف مضاف لهذه المهمة."],
        },
        {
          heading: "معلومات المهمة",
          paragraphs: [
            `تاريخ الإنشاء: ${formatDate(task.created_at)}`,
            `تاريخ البداية: ${formatDate(task.start_date)}`,
            `تاريخ الاستحقاق: ${formatDate(task.due_date)}`,
            `تاريخ الإكمال: ${formatDate(task.completed_at)}`,
          ],
        },
        {
          heading: "المهام الفرعية",
          table: {
            columns: ["العنوان", "الحالة"],
            rows: subtasks.length > 0 ? subtasks : [["—", "لا توجد مهام فرعية"]],
          },
        },
        {
          heading: "سجل المتابعة",
          paragraphs: updates.length > 0 ? updates : ["لا توجد تحديثات متاحة حتى الآن."],
        },
        {
          heading: "المرفقات",
          paragraphs: attachments.length > 0 ? attachments : ["لا توجد مرفقات مرتبطة بهذه المهمة."],
        },
      ],
    };
  };

  const exportTask = (type: "word" | "pdf") => {
    const doc = buildTaskReport();
    const fileName = `مهمة-${task.title}`.replace(/[^-\uFFFF\w\u0600-\u06FF\s-]/g, "").trim();
    if (type === "word") {
      exportWord(doc, fileName || "مهمة");
      return;
    }
    if (!exportPdf(doc)) toast.error("يرجى السماح بالنوافذ المنبثقة للطباعة");
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{PRIORITY_LABELS[task.priority]}</Badge>
          <Badge variant={task.status === "completed" ? "default" : "secondary"}>
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          {isOverdue(task) && <Badge variant="destructive">متأخرة</Badge>}
          {task.created_via_voice && <Badge variant="secondary">أُضيفت صوتياً</Badge>}
          <Badge variant="outline">{RECURRENCE_LABELS[task.recurrence ?? "none"] ?? "بدون تكرار"}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => exportTask("word")}>
            <FileDown className="size-4" /> Word
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportTask("pdf")}>
            <Printer className="size-4" /> PDF
          </Button>
        </div>
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

      <Tabs defaultValue="details" className="w-full" dir="rtl">
        <TabsList className="w-full" dir="rtl">
          <TabsTrigger value="details" className="flex-1">
            التفاصيل
          </TabsTrigger>
          <TabsTrigger value="updates" className="flex-1">
            سجل المتابعة
          </TabsTrigger>
          <TabsTrigger value="subtasks" className="flex-1">
            المهام الفرعية
          </TabsTrigger>
          <TabsTrigger value="files" className="flex-1">
            المرفقات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-3 pt-4 text-right" dir="rtl">
          {task.description && (
            <div className="rounded-md border bg-muted/30 p-3">
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

        <TabsContent value="updates" className="space-y-4 pt-4" dir="rtl">
          <div className="space-y-2 text-right">
            <Label>إضافة ملاحظة/تحديث</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="text-right" />
            <div className="flex justify-end">
              <Button size="sm" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()}>
                <Plus className="size-4" /> إضافة
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {(detail.data?.updates ?? []).map((u) => {
              const canManageUpdate = canManage || u.created_by === user?.id;
              const isEditingUpdate = editingUpdateId === u.id;

              return (
                <div key={u.id} className="rounded-md border p-3 text-sm text-right" dir="rtl">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{u.creator_name}</span>
                    {u.progress !== null && <span className="text-xs text-muted-foreground">{u.progress}%</span>}
                    {canManageUpdate && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingUpdateId(u.id);
                            setEditingUpdateText(u.note || "");
                          }}
                          aria-label="تعديل الملاحظة"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeNote.mutate(u.id)}
                          aria-label="حذف الملاحظة"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {isEditingUpdate ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={3}
                        value={editingUpdateText}
                        onChange={(e) => setEditingUpdateText(e.target.value)}
                        className="text-right"
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => updateNote.mutate({ id: u.id, noteText: editingUpdateText })}>
                          حفظ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingUpdateId(null);
                            setEditingUpdateText("");
                          }}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{u.note || "تحديث نسبة الإنجاز"}</p>
                  )}

                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleString("ar-EG-u-nu-latn")}
                  </p>
                </div>
              );
            })}
            {(detail.data?.updates.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد تحديثات بعد.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="subtasks" className="space-y-4 pt-4" dir="rtl">
          <div className="flex flex-row-reverse gap-2">
            <Input
              placeholder="عنوان المهمة الفرعية"
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              className="text-right"
            />
            <Button size="sm" disabled={!subtaskTitle.trim() || addSubtask.isPending} onClick={() => addSubtask.mutate()}>
              <Plus className="size-4" /> إضافة
            </Button>
          </div>

          <div className="space-y-2">
            {(detail.data?.subtasks ?? []).map((s) => {
              const canManageSubtask = canManage || s.created_by === user?.id;
              const isEditingSubtask = editingSubtaskId === s.id;

              return (
                <div key={s.id} className="rounded-md border p-2 text-right" dir="rtl">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{s.creator_name}</span>
                    {canManageSubtask && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingSubtaskId(s.id);
                            setEditingSubtaskTitle(s.title);
                          }}
                          aria-label="تعديل المهمة الفرعية"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeSubtask.mutate(s.id)}
                          aria-label="حذف المهمة الفرعية"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {isEditingSubtask ? (
                    <div className="space-y-2">
                      <Input
                        value={editingSubtaskTitle}
                        onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                        className="text-right"
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => updateSubtask.mutate({ id: s.id, title: editingSubtaskTitle })}>
                          حفظ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingSubtaskId(null);
                            setEditingSubtaskTitle("");
                          }}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-end gap-2 text-sm">
                      <span className={s.is_done ? "text-muted-foreground line-through" : ""}>{s.title}</span>
                      <Checkbox
                        checked={s.is_done}
                        onCheckedChange={(v) => toggleSubtask.mutate({ id: s.id, is_done: !!v })}
                      />
                    </label>
                  )}
                </div>
              );
            })}
            {(detail.data?.subtasks.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد مهام فرعية.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4 pt-4" dir="rtl">
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
              <div key={a.id} className="flex items-center justify-between rounded-md border p-2 text-sm" dir="rtl">
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

