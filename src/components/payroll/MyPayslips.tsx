import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportPdf, exportWord, type ReportDoc } from "@/lib/report-export";
import { getMyPayslips } from "@/lib/payroll.functions";
import { LINE_SOURCE_LABELS, formatMoney, monthLabel } from "@/lib/payroll";
import { useBranding } from "@/hooks/useBranding";

export function MyPayslips() {
  const branding = useBranding();
  const fetchFn = useServerFn(getMyPayslips);
  const { data, isLoading } = useQuery({ queryKey: ["my-payslips"], queryFn: () => fetchFn() });

  if (isLoading) return <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>;
  const items = data?.items ?? [];
  if (!items.length)
    return <p className="text-sm text-muted-foreground">لا توجد قسائم رواتب معتمدة حتى الآن.</p>;

  const doc = (itemId: string): ReportDoc | null => {
    const item = items.find((i) => i.id === itemId);
    const run = (data?.runs ?? []).find((r) => r.id === item?.run_id);
    if (!item) return null;
    const lines = (data?.lines ?? []).filter((l) => l.item_id === itemId);
    return {
      title: "قسيمة راتب",
      subtitle: `${item.employee_name} — ${run ? monthLabel(String(run.month)) : ""}`,
      meta: [{ label: "الصافي", value: formatMoney(item.net_amount) }],
      sections: [
        {
          table: {
            columns: ["البند", "النوع", "المصدر", "المبلغ"],
            rows: lines.map((l) => [
              l.label,
              l.line_type === "earning" ? "استحقاق" : "استقطاع",
              LINE_SOURCE_LABELS[String(l.source)] ?? "",
              formatMoney(l.amount),
            ]),
          },
        },
      ],
      branding: { org_name: branding.org_name, system_name: branding.system_name, logoUrl: branding.logoUrl },
    };
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => {
        const run = (data?.runs ?? []).find((r) => r.id === item.run_id);
        const lines = (data?.lines ?? []).filter((l) => l.item_id === item.id);
        return (
          <Card key={item.id}>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">
                {run ? monthLabel(String(run.month)) : "قسيمة"}
              </CardTitle>
              <Badge variant="outline">{formatMoney(item.net_amount)}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ul className="space-y-1 text-xs text-muted-foreground">
                {lines.map((l) => (
                  <li key={l.id} className="flex justify-between">
                    <span>{l.label}</span>
                    <span>
                      {l.line_type === "deduction" ? "-" : "+"}
                      {formatMoney(l.amount)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const d = doc(item.id);
                    if (d) exportWord(d, "payslip");
                  }}
                >
                  <FileText className="ms-1 size-4" /> Word
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const d = doc(item.id);
                    if (d) exportPdf(d);
                  }}
                >
                  <FileDown className="ms-1 size-4" /> PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
