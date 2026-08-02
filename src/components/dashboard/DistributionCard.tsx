import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Slice = { label: string; value: number; className: string };

export function DistributionCard({
  title,
  total,
  slices,
  footer,
}: {
  title: string;
  total: number;
  slices: Slice[];
  footer?: string | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات خلال الفترة.</p>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {slices.map((s) => (
                <div
                  key={s.label}
                  className={s.className}
                  style={{ width: `${(s.value / total) * 100}%` }}
                />
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {slices.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-sm">
                  <span className={`size-3 rounded-full ${s.className}`} />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="ms-auto font-medium">
                    {s.value} ({Math.round((s.value / total) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {footer && <p className="text-xs text-muted-foreground">{footer}</p>}
      </CardContent>
    </Card>
  );
}
