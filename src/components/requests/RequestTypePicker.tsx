import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FLOW_LABELS, type HrRequestType } from "@/lib/hr-requests";

export function RequestTypePicker({
  types,
  onPick,
}: {
  types: HrRequestType[];
  onPick: (t: HrRequestType) => void;
}) {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const term = q.trim();
    const map = new Map<string, HrRequestType[]>();
    for (const t of types) {
      if (!t.active) continue;
      if (term && !t.name.includes(term) && !t.category.includes(term)) continue;
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return [...map.entries()];
  }, [types, q]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pr-9"
          placeholder="ابحث عن نوع الطلب…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {groups.map(([category, list]) => (
        <div key={category} className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">{category}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t) => (
              <Card
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => onPick(t)}
                onKeyDown={(e) => e.key === "Enter" && onPick(t)}
                className="cursor-pointer transition-shadow hover:shadow-md"
              >
                <CardContent className="space-y-1.5 p-4">
                  <p className="font-semibold leading-tight">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.approval_flow.map((f) => FLOW_LABELS[f]).join(" ← ")}
                  </p>
                  {t.is_confidential && (
                    <Badge variant="outline" className="text-xs">
                      سرّي
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">لا توجد أنواع مطابقة</p>
      )}
    </div>
  );
}
