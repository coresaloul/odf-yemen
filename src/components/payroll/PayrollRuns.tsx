import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileDown, FileText, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { exportPdf, exportWord, type ReportDoc } from "@/lib/report-export";
import {
  createRun,
  decideRun,
  deleteRun,
  getRunDetail,
  listRuns,
  recomputeRun,
} from "@/lib/payroll.functions";
import {
  LINE_SOURCE_LABELS,
  RUN_STATUS_LABELS,
  WORKER_TYPES,
  WORKER_TYPE_LABELS,
  formatMoney,
  monthLabel,
  monthValue,
} from "@/lib/payroll";

export function PayrollRuns() {
  const qc = useQueryClient();
  const { isDirector, isHR } = useAuth();
  const listRunsFn = useServerFn(listRuns);
  const detailFn = useServerFn(getRunDetail);
  const createFn = useServerFn(createRun);
  const recomputeFn = useServerFn(recomputeRun);
  const decideFn = useServerFn(decideRun);
  const deleteFn = useServerFn(deleteRun);

  const [month, setMonth] = useState(monthValue());
  const [categories, setCategories] = useState<string[]>([...WORKER_TYPES]);
  const [selected, setSelected] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [note, setNote] = useState("");

  const { data: runs } = useQuery({ queryKey: ["payroll-runs"], queryFn: () => listRunsFn() });
  const { data: detail } = useQuery({
    queryKey: ["payroll-run", selected],
    queryFn: () => detailFn({ data: { runId: selected! } }),
    enabled: !!selected,
  });

  const currency = detail?.settings.currency ?? "ر.ي";

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["payroll-runs"] });
    void qc.invalidateQueries({ queryKey: ["payroll-run"] });
  };

  const create = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          month,
          title: null,
          categories: categories as ("employee" | "worker" | "consultant" | "volunteer")[],
        },
      }),
    onSuccess: (res) => {
      toast.success(`تم احتساب ${res.count} مسير راتب`);
      setSelected(res.id);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recompute = useMutation({
    mutationFn: async () => recomputeFn({ data: { runId: selected! } }),
    onSuccess: () => {
      toast.success("تمت إعادة الاحتساب");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (vars: {
      action: "submit" | "hr_approve" | "director_approve" | "return" | "mark_paid";
      note?: string;
    }) => decideFn({ data: { runId: selected!, action: vars.action, note: vars.note ?? null } }),
    onSuccess: () => {
      toast.success("تم تنفيذ الإجراء");
      setReturnOpen(false);
      setNote("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRun = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { runId: id } }),
    onSuccess: () => {
      toast.success("تم حذف الدورة");
      setSelected(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linesOf = (itemId: string) => (detail?.lines ?? []).filter((l) => l.item_id === itemId);

  const masterDoc = useMemo<ReportDoc | null>(() => {
    if (!detail?.run) return null;
    return {
      title: "كشف الرواتب",
      subtitle: monthLabel(String(detail.run.month)),
      meta: [
        { label: "الحالة", value: RUN_STATUS_LABELS[String(detail.run.status)] ?? "" },
        { label: "عدد المستفيدين", value: String(detail.items.length) },
        { label: "صافي الإجمالي", value: formatMoney(detail.run.total_net, currency) },
      ],
      sections: [
        {
          table: {
            columns: ["الموظف", "الإدارة", "الفئة", "الاستحقاق", "الاستقطاع", "الصافي"],
            rows: detail.items.map((i) => [
              i.employee_name,
              i.department_name ?? "—",
              WORKER_TYPE_LABELS[String(i.worker_type)] ?? "",
              formatMoney(i.gross_earnings, currency),
              formatMoney(i.total_deductions, currency),
              formatMoney(i.net_amount, currency),
            ]),
          },
        },
      ],
    };
  }, [detail, currency]);

  const payslipDoc = (itemId: string): ReportDoc | null => {
    const item = (detail?.items ?? []).find((i) => i.id === itemId);
    if (!item || !detail?.run) return null;
    const lines = linesOf(itemId);
    return {
      title: "قسيمة راتب",
      subtitle: `${item.employee_name} — ${monthLabel(String(detail.run.month))}`,
      meta: [
        { label: "الفئة", value: WORKER_TYPE_LABELS[String(item.worker_type)] ?? "" },
        { label: "الإدارة", value: item.department_name ?? "—" },
        { label: "الصافي", value: formatMoney(item.net_amount, currency) },
      ],
      sections: [
        {
          heading: "تفاصيل الاستحقاقات والاستقطاعات",
          table: {
            columns: ["البند", "النوع", "المصدر", "المبلغ"],
            rows: lines.map((l) => [
              l.label,
              l.line_type === "earning" ? "استحقاق" : "استقطاع",
              LINE_SOURCE_LABELS[String(l.source)] ?? "",
              formatMoney(l.amount, currency),
            ]),
          },
        },
        {
          heading: "بيانات الدوام",
          paragraphs: [
            `أيام الحضور: ${item.days_present} — أيام الغياب: ${item.days_absent} — دقائق التأخير: ${item.late_minutes}`,
            `إجازات مدفوعة: ${item.paid_leave_days} — إجازات بدون راتب: ${item.unpaid_leave_days}`,
          ],
        },
      ],
    };
  };

  const status = String(detail?.run?.status ?? "");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">إنشاء دورة رواتب</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>الشهر</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label>الفئات المشمولة</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {WORKER_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-1 text-sm">
                  <Checkbox
                    checked={categories.includes(t)}
                    onCheckedChange={(v) =>
                      setCategories(v ? [...categories, t] : categories.filter((c) => c !== t))
                    }
                  />
                  {WORKER_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !categories.length}>
            احتساب الرواتب
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">الدورات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(runs ?? []).map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`w-full rounded-md border p-2 text-start text-sm ${
                  selected === r.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <span className="block font-medium">{monthLabel(String(r.month))}</span>
                <span className="text-xs text-muted-foreground">
                  {RUN_STATUS_LABELS[String(r.status)]} · {formatMoney(r.total_net, currency)}
                </span>
              </button>
            ))}
            {(runs ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد دورات بعد.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base">
              {detail?.run ? `مسير ${monthLabel(String(detail.run.month))}` : "تفاصيل الدورة"}
            </CardTitle>
            {detail?.run && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{RUN_STATUS_LABELS[status]}</Badge>
                {["draft"].includes(status) && (
                  <Button size="sm" variant="outline" onClick={() => recompute.mutate()}>
                    <RefreshCw className="ms-1 size-4" /> إعادة الاحتساب
                  </Button>
                )}
                {status === "draft" && (
                  <Button size="sm" onClick={() => decide.mutate({ action: "submit" })}>
                    رفع للموارد البشرية
                  </Button>
                )}
                {status === "hr_review" && (isHR || isDirector) && (
                  <Button size="sm" onClick={() => decide.mutate({ action: "hr_approve" })}>
                    اعتماد الموارد البشرية
                  </Button>
                )}
                {status === "director_review" && isDirector && (
                  <Button size="sm" onClick={() => decide.mutate({ action: "director_approve" })}>
                    الاعتماد النهائي
                  </Button>
                )}
                {status === "approved" && (
                  <Button size="sm" onClick={() => decide.mutate({ action: "mark_paid" })}>
                    تأكيد الصرف
                  </Button>
                )}
                {!["approved", "paid"].includes(status) && (
                  <Button size="sm" variant="outline" onClick={() => setReturnOpen(true)}>
                    إعادة للتعديل
                  </Button>
                )}
                {masterDoc && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportWord(masterDoc, "payroll")}
                    >
                      <FileText className="ms-1 size-4" /> Word
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportPdf(masterDoc)}>
                      <FileDown className="ms-1 size-4" /> PDF
                    </Button>
                  </>
                )}
                {["draft", "hr_review"].includes(status) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeRun.mutate(detail.run!.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!detail?.run ? (
              <p className="text-sm text-muted-foreground">اختر دورة لعرض تفاصيلها.</p>
            ) : (
              <div className="space-y-3">
                {detail.run.return_reason && (
                  <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                    سبب الإعادة: {detail.run.return_reason}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { label: "إجمالي الاستحقاقات", value: detail.run.total_earnings },
                    { label: "إجمالي الاستقطاعات", value: detail.run.total_deductions },
                    { label: "صافي المسير", value: detail.run.total_net },
                  ].map((s) => (
                    <div key={s.label} className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="font-semibold">{formatMoney(s.value, currency)}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-muted/50 text-xs">
                      <tr>
                        <th className="p-2 text-start">الموظف</th>
                        <th className="p-2 text-start">الفئة</th>
                        <th className="p-2 text-start">الاستحقاق</th>
                        <th className="p-2 text-start">الاستقطاع</th>
                        <th className="p-2 text-start">الصافي</th>
                        <th className="p-2 text-start">القسيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((i) => (
                        <tr key={i.id} className="border-t">
                          <td className="p-2">
                            <span className="font-medium">{i.employee_name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {linesOf(i.id)
                                .map((l) => `${l.label} (${Number(l.amount)})`)
                                .join(" · ")}
                            </span>
                          </td>
                          <td className="p-2">{WORKER_TYPE_LABELS[String(i.worker_type)]}</td>
                          <td className="p-2">{formatMoney(i.gross_earnings, currency)}</td>
                          <td className="p-2">{formatMoney(i.total_deductions, currency)}</td>
                          <td className="p-2 font-semibold">
                            {formatMoney(i.net_amount, currency)}
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const doc = payslipDoc(i.id);
                                  if (doc) exportWord(doc, `payslip-${i.employee_name}`);
                                }}
                              >
                                Word
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const doc = payslipDoc(i.id);
                                  if (doc) exportPdf(doc);
                                }}
                              >
                                PDF
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {detail.approvals.length > 0 && (
                  <div className="rounded-md border p-3 text-xs text-muted-foreground">
                    <p className="mb-1 font-medium text-foreground">سجل الاعتمادات</p>
                    {detail.approvals.map((a) => (
                      <p key={a.id}>
                        {a.actor_name} — {RUN_STATUS_LABELS[String(a.stage)] ?? a.stage}
                        {a.note ? ` — ${a.note}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إعادة المسير للتعديل</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="سبب الإعادة"
          />
          <DialogFooter>
            <Button
              onClick={() => decide.mutate({ action: "return", note })}
              disabled={!note.trim()}
            >
              إرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
