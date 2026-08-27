import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { parseVoiceTask } from "@/lib/voice-task.functions";
import { supabase } from "@/integrations/supabase/client";

interface VoiceTaskButtonProps {
  employees: { id: string; full_name: string }[];
  onParsed: (p: {
    title: string;
    description: string | null;
    assignee_id: string | null;
    priority: string;
    due_date: string | null;
  }) => void;
}

export function VoiceTaskButton({ employees, onParsed }: VoiceTaskButtonProps) {
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("انتهت الجلسة، سجّل الدخول مجدداً");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
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
    <Button
      size="sm"
      variant={recording ? "destructive" : "outline"}
      onClick={handle}
      disabled={busy}
    >
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
