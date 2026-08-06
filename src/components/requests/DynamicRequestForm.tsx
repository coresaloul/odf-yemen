import { useState } from "react";
import { Send, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FLOW_LABELS, type HrRequestType } from "@/lib/hr-requests";

export type RequestValues = Record<string, string | number | boolean | null>;

export function DynamicRequestForm({
  type,
  initialValues,
  saving,
  onCancel,
  onSave,
}: {
  type: HrRequestType;
  initialValues?: RequestValues;
  saving: boolean;
  onCancel: () => void;
  onSave: (values: RequestValues, submit: boolean) => void;
}) {
  const [values, setValues] = useState<RequestValues>(initialValues ?? {});
  const set = (key: string, v: string | number | boolean | null) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{type.name}</CardTitle>
        <p className="text-xs text-muted-foreground">
          مسار الاعتماد: {type.approval_flow.map((f) => FLOW_LABELS[f]).join(" ← ")}
          {type.is_confidential && " · طلب سرّي يُعرض على الموارد البشرية فقط"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {type.fields.map((f) => {
          const v = values[f.key];
          return (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`fld-${f.key}`}>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>

              {f.type === "textarea" && (
                <Textarea
                  id={`fld-${f.key}`}
                  rows={3}
                  value={String(v ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}

              {f.type === "select" && (
                <Select value={String(v ?? "")} onValueChange={(val) => set(f.key, val)}>
                  <SelectTrigger id={`fld-${f.key}`}>
                    <SelectValue placeholder="اختر…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {f.type === "boolean" && (
                <div className="flex items-center gap-2">
                  <Switch
                    id={`fld-${f.key}`}
                    checked={!!v}
                    onCheckedChange={(c) => set(f.key, c)}
                  />
                  <span className="text-sm text-muted-foreground">{v ? "نعم" : "لا"}</span>
                </div>
              )}

              {["text", "number", "date", "time"].includes(f.type) && (
                <Input
                  id={`fld-${f.key}`}
                  type={f.type === "text" ? "text" : f.type}
                  value={String(v ?? "")}
                  onChange={(e) =>
                    set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)
                  }
                />
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button className="gap-2" disabled={saving} onClick={() => onSave(values, true)}>
            <Send className="size-4" />
            إرسال الطلب
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={saving}
            onClick={() => onSave(values, false)}
          >
            <Save className="size-4" />
            حفظ كمسودة
          </Button>
          <Button variant="ghost" className="gap-2" onClick={onCancel}>
            <X className="size-4" />
            إلغاء
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
