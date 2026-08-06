import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { saveHrRequestType } from "@/lib/hr-requests.functions";
import { FLOW_LABELS, type HrRequestType, type RequestFlowStep } from "@/lib/hr-requests";

const FLOW_STEPS: RequestFlowStep[] = ["manager", "hr", "director"];

type Draft = {
  id: string | null;
  code: string;
  name: string;
  category: string;
  approval_flow: RequestFlowStep[];
  is_confidential: boolean;
  active: boolean;
};

export function RequestTypesAdmin({ types }: { types: HrRequestType[] }) {
  const qc = useQueryClient();
  const save = useServerFn(saveHrRequestType);
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = types.find((t) => t.id === draft?.id);

  const mutation = useMutation({
    mutationFn: async (d: Draft) =>
      save({
        data: {
          id: d.id,
          code: d.code,
          name: d.name,
          category: d.category,
          fields: current?.fields ?? [],
          approval_flow: d.approval_flow,
          is_confidential: d.is_confidential,
          active: d.active,
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ نوع الطلب");
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["hr-request-types"] });
      void qc.invalidateQueries({ queryKey: ["hr-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (draft) {
    const toggleStep = (s: RequestFlowStep) =>
      setDraft({
        ...draft,
        approval_flow: draft.approval_flow.includes(s)
          ? draft.approval_flow.filter((x) => x !== s)
          : FLOW_STEPS.filter((x) => x === s || draft.approval_flow.includes(x)),
      });

    return (
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">اسم النوع</Label>
              <Input
                id="t-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-cat">المجموعة</Label>
              <Input
                id="t-cat"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-code">الرمز (إنجليزي)</Label>
              <Input
                id="t-code"
                dir="ltr"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>مسار الاعتماد</Label>
            <div className="flex flex-wrap gap-2">
              {FLOW_STEPS.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={draft.approval_flow.includes(s) ? "default" : "outline"}
                  onClick={() => toggleStep(s)}
                >
                  {FLOW_LABELS[s]}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="t-conf"
                checked={draft.is_confidential}
                onCheckedChange={(c) => setDraft({ ...draft, is_confidential: c })}
              />
              <Label htmlFor="t-conf">طلب سرّي</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="t-active"
                checked={draft.active}
                onCheckedChange={(c) => setDraft({ ...draft, active: c })}
              />
              <Label htmlFor="t-active">مفعّل</Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="gap-2"
              disabled={mutation.isPending || draft.approval_flow.length === 0}
              onClick={() => mutation.mutate(draft)}
            >
              <Save className="size-4" />
              حفظ
            </Button>
            <Button variant="ghost" className="gap-2" onClick={() => setDraft(null)}>
              <X className="size-4" />
              إلغاء
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        className="gap-2"
        onClick={() =>
          setDraft({
            id: null,
            code: "",
            name: "",
            category: "متفرقات",
            approval_flow: ["manager", "hr"],
            is_confidential: false,
            active: true,
          })
        }
      >
        <Plus className="size-4" />
        نوع طلب جديد
      </Button>

      <div className="grid gap-2 sm:grid-cols-2">
        {types.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-semibold">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.category} · {t.approval_flow.map((f) => FLOW_LABELS[f]).join(" ← ")}
                </p>
                <div className="flex gap-1.5">
                  {t.is_confidential && <Badge variant="outline">سرّي</Badge>}
                  {!t.active && <Badge variant="secondary">معطّل</Badge>}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={() =>
                  setDraft({
                    id: t.id,
                    code: t.code,
                    name: t.name,
                    category: t.category,
                    approval_flow: t.approval_flow,
                    is_confidential: t.is_confidential,
                    active: t.active,
                  })
                }
              >
                <Pencil className="size-3.5" />
                تعديل
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
