import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EVALUATION_PERIODS, EVALUATION_PERIOD_LABELS } from "@/lib/hr";

const KIND_LABELS: Record<string, string> = {
  tasks: "إنجاز المهام (تلقائي)",
  attendance: "الالتزام بالدوام (تلقائي)",
  behavior: "معيار سلوكي",
};

export function CriteriaTemplatesTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("5");
  const [maxScore, setMaxScore] = useState("100");

  const { data } = useQuery({
    queryKey: ["criteria-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("evaluation_criteria_templates")
        .select("*")
        .order("kind")
        .order("sort_order");
      return data ?? [];
    },
  });

  const templates = data ?? [];
  const totalWeight = templates
    .filter((t) => t.active)
    .reduce((s, t) => s + Number(t.weight), 0);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["criteria-templates"] });

  const update = useMutation({
    mutationFn: async (v: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("evaluation_criteria_templates")
        .update(v.patch as never)
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("evaluation_criteria_templates").insert({
        name: name.trim(),
        kind: "behavior",
        weight: Number(weight),
        max_score: Number(maxScore),
        sort_order: templates.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة المعيار");
      setName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("evaluation_criteria_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف المعيار");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          معايير التقييم
          <Badge variant={totalWeight === 100 ? "default" : "destructive"}>
            مجموع الأوزان الفعّالة: {totalWeight}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_110px_110px_100px_40px] sm:items-center"
          >
            <div>
              <Input
                value={t.name}
                disabled={!canEdit}
                onChange={(e) => update.mutate({ id: t.id, patch: { name: e.target.value } })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {KIND_LABELS[t.kind] ?? t.kind} — الفترات:{" "}
                {(t.applies_periods?.length ? t.applies_periods : EVALUATION_PERIODS)
                  .map((p: string) => EVALUATION_PERIOD_LABELS[p] ?? p)
                  .join("، ")}
              </p>
            </div>
            <div>
              <Label className="text-xs">الوزن %</Label>
              <Input
                type="number"
                defaultValue={String(t.weight)}
                disabled={!canEdit}
                onBlur={(e) => update.mutate({ id: t.id, patch: { weight: Number(e.target.value) } })}
              />
            </div>
            <div>
              <Label className="text-xs">الدرجة القصوى</Label>
              <Input
                type="number"
                defaultValue={String(t.max_score)}
                disabled={!canEdit || t.kind !== "behavior"}
                onBlur={(e) =>
                  update.mutate({ id: t.id, patch: { max_score: Number(e.target.value) } })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={t.active}
                disabled={!canEdit}
                onCheckedChange={(v) => update.mutate({ id: t.id, patch: { active: v } })}
              />
              <span className="text-xs">{t.active ? "مفعّل" : "معطّل"}</span>
            </div>
            {canEdit && t.kind === "behavior" && (
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(t.id)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}

        {canEdit && (
          <div className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[2fr_110px_110px_auto] sm:items-end">
            <div className="space-y-2">
              <Label>معيار سلوكي جديد</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المعيار" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">الوزن %</Label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">الدرجة القصوى</Label>
              <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
            <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
              <Plus className="size-4" /> إضافة
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
