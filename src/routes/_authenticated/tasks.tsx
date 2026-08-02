import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mic, Plus, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { parseVoiceTask } from "@/lib/voice-task.functions";
import { notifyTaskAssigned, notifyTaskStatusChanged } from "@/lib/task-emails.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "المهام | الموارد البشرية" },
      { name: "description", content: "تكليف الموظفين بالمهام ومتابعة نسب الإنجاز مع الإضافة الصوتية الذكية." },
      { property: "og:title", content: "المهام | الموارد البشرية" },
      { property: "og:description", content: "إدارة مهام الموظفين ومتابعة الإنجاز في مؤسسة اليتيم التنموية." },
    ],
  }),
  component: TasksPage,
});

const EMPTY_FORM = {
  title: "",
  description: "",
  assignee_id: "",
  priority: "medium",
  due_date: "",
  weight: "1",
};

function TasksPage() {
  const { isManager, employee } = useAuth();
  const qc = useQueryClient();
  const sendAssignedEmail = useServerFn(notifyTaskAssigned);
  const sendStatusEmail = useServerFn(notifyTaskStatusChanged);
  const [open, setOpen] = useState(false);
  const [viaVoice, setViaVoice] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [statusFilter, setStatusFilter] = useState("all");

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery({
    queryKey: ["tasks-page"],
    queryFn: async () => {
      const [tasks, employees] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("employees").select("id, full_name").order("full_name"),
      ]);
      return { tasks: tasks.data ?? [], employees: employees.data ?? [] };
    },
  });

  const tasks = data?.tasks ?? [];
  const employees = data?.employees ?? [];
  const nameOf = (id: string | null) => employees.find((e) => e.id === id)?.full_name ?? "—";

  const filtered = useMemo(
    () => (statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter)),
    [tasks, statusFilter],
  );

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tasks-page"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: inserted, error } = await supabase
        .from("tasks")
        .insert({
          title: form.title,
          description: form.description || null,
          assignee_id: form.assignee_id,
          priority: form.priority as "low" | "medium" | "high" | "urgent",
          due_date: form.due_date || null,
          weight: Number(form.weight) || 1,
          assigned_by: employee?.id ?? null,
          created_via_voice: viaVoice,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (inserted?.id) {
        try {
          await sendAssignedEmail({ data: { taskId: inserted.id } });
        } catch {
          // الإشعار داخل النظام يبقى فعّالاً حتى لو تعذّر إرسال البريد
        }
      }
    },
    onSuccess: () => {
      toast.success("تم إنشاء المهمة");
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setViaVoice(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const completed = progress >= 100;
      const { error } = await supabase
        .from("tasks")
        .update({
          progress,
          status: completed ? "completed" : progress > 0 ? "in_progress" : "new",
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("task_updates").insert({ task_id: id, progress, created_by: employee?.id ?? null });
      try {
        await sendStatusEmail({ data: { taskId: id, progress } });
      } catch {
        // تجاهل أخطاء البريد
      }
    },
    onSuccess: () => {
      toast.success("تم تحديث الإنجاز");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="المهام"
        description="تكليف الموظفين ومتابعة نسب الإنجاز"
        action={
          isManager && (
            <>
              <VoiceTaskButton
                employees={employees}
                onParsed={(p) => {
                  setForm({
                    title: p.title,
                    description: p.description ?? "",
                    assignee_id: p.assignee_id ?? "",
                    priority: p.priority,
                    due_date: p.due_date ?? "",
                    weight: "1",
                  });
                  setViaVoice(true);
                  setOpen(true);
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  setForm({ ...EMPTY_FORM });
                  setViaVoice(false);
                  setOpen(true);
                }}
              >
                <Plus className="size-4" /> مهمة جديدة
              </Button>
            </>
          )
        }
      />

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل الحالات</SelectItem>
          {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">لا توجد مهام.</p>
      )}

      <div className="space-y-3">
        {filtered.map((t) => (
          <Card key={t.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {t.title}
                    {t.created_via_voice && (
                      <Mic className="mr-2 inline size-3.5 text-accent" aria-label="أُضيفت صوتياً" />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    المكلّف: {nameOf(t.assignee_id)} — المكلِّف: {nameOf(t.assigned_by)} — الاستحقاق:{" "}
                    {formatDate(t.due_date)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{PRIORITY_LABELS[t.priority]}</Badge>
                  <Badge variant={t.status === "completed" ? "default" : "secondary"}>
                    {TASK_STATUS_LABELS[t.status]}
                  </Badge>
                </div>
              </div>
              {t.description && <p className="text-sm text-foreground/80">{t.description}</p>}
              <Progress value={t.progress} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">التقدم {t.progress}%</span>
                {[25, 50, 75, 100].map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant="outline"
                    onClick={() => updateProgress.mutate({ id: t.id, progress: p })}
                  >
                    {p}%
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viaVoice ? "مهمة من التسجيل الصوتي" : "مهمة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان المهمة</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>الموظف المكلّف</Label>
                <Select value={form.assignee_id} onValueChange={(v) => set("assignee_id", v)}>
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
                <Label>الأولوية</Label>
                <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>تاريخ الاستحقاق</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => set("due_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>وزن المهمة</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.weight}
                  onChange={(e) => set("weight", e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={!form.title || !form.assignee_id || save.isPending}
            >
              حفظ المهمة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VoiceTaskButton({
  employees,
  onParsed,
}: {
  employees: { id: string; full_name: string }[];
  onParsed: (p: {
    title: string;
    description: string | null;
    assignee_id: string | null;
    priority: string;
    due_date: string | null;
  }) => void;
}) {
  const { recording, start, stop } = useVoiceRecorder();
  const [busy, setBusy] = useState(false);
  const parse = useServerFn(parseVoiceTask);

  const handle = async () => {
    if (!recording) {
      try {
        await start();
        toast.info("جارٍ التسجيل… تحدث بالمهمة ثم اضغط إيقاف");
      } catch {
        toast.error("تعذر الوصول إلى الميكروفون");
      }
      return;
    }

    const blob = await stop();
    if (!blob) {
      toast.error("التسجيل فارغ، حاول مرة أخرى");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "recording.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !json.text) throw new Error(json.error ?? "تعذر تفريغ التسجيل");

      const parsed = await parse({
        data: { transcript: json.text, employees: employees.map((e) => e.full_name) },
      });
      const match = employees.find((e) => e.full_name === parsed.assignee_name);
      onParsed({
        title: parsed.title,
        description: parsed.description,
        assignee_id: match?.id ?? null,
        priority: parsed.priority,
        due_date: parsed.due_date,
      });
      toast.success("تم استخراج بيانات المهمة، راجعها قبل الحفظ");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant={recording ? "destructive" : "outline"} onClick={handle} disabled={busy}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : recording ? (
        <Square className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
      {busy ? "جارٍ التحليل…" : recording ? "إيقاف التسجيل" : "مهمة بالصوت"}
    </Button>
  );
}
