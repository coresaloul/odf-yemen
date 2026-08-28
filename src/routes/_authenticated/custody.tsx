import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight,
  Banknote,
  FileDown,
  Package,
  Plus,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import {
  ASSET_STATUS_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  CUSTODY_KINDS,
  CUSTODY_KIND_LABELS,
  RETURN_STATE_LABELS,
  cashRemaining,
  isOpenAssignment,
  isOverdue,
  type CustodyAssignment,
  type CustodyKind,
} from "@/lib/custody";
import {
  addCustodyTransaction,
  decideCustodyAssignment,
  deleteCustodyAsset,
  deleteCustodyAssignment,
  handOverCustody,
  listCustodyAssets,
  listCustodyAssignments,
  listCustodyCategories,
  listCustodyRefs,
  returnCustodyItems,
  saveCustodyAsset,
  saveCustodyAssignment,
} from "@/lib/custody.functions";
import { exportPdf, exportWord, type ReportDoc } from "@/lib/report-export";
import { formatDate } from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/custody")({
  component: CustodyPage,
  head: () => ({
    meta: [
      { title: "إدارة العهد | نظام الموارد البشرية" },
      {
        name: "description",
        content:
          "إدارة تفصيلية لعهد الموظفين: الأصول والأجهزة والمركبات والوثائق والعهد المالية مع الاعتماد والتسليم والإرجاع.",
      },
      { property: "og:title", content: "إدارة العهد | نظام الموارد البشرية" },
      {
        property: "og:description",
        content: "سجل عهد الموظفين، اعتمادها، تسليمها وإرجاعها مع تقارير قابلة للتصدير.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const money = (n: number) => Number(n ?? 0).toLocaleString("ar-EG-u-nu-latn");

type ItemDraft = {
  asset_id: string;
  title: string;
  quantity: number;
  condition_out: string;
  odometer_out: string;
};

const emptyItem = (): ItemDraft => ({
  asset_id: "",
  title: "",
  quantity: 1,
  condition_out: "",
  odometer_out: "",
});

function CustodyPage() {
  const { employee, isDirector, isHR } = useAuth();
  const canManage = isDirector || isHR;
  const qc = useQueryClient();

  const fetchAssignments = useServerFn(listCustodyAssignments);
  const fetchAssets = useServerFn(listCustodyAssets);
  const fetchRefs = useServerFn(listCustodyRefs);
  const fetchCats = useServerFn(listCustodyCategories);

  const assignments = useQuery({
    queryKey: ["custody-assignments"],
    queryFn: async () => (await fetchAssignments()) as CustodyAssignment[],
  });
  const assets = useQuery({ queryKey: ["custody-assets"], queryFn: () => fetchAssets() });
  const refs = useQuery({ queryKey: ["custody-refs"], queryFn: () => fetchRefs() });
  const cats = useQuery({ queryKey: ["custody-categories"], queryFn: () => fetchCats() });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["custody-assignments"] });
    void qc.invalidateQueries({ queryKey: ["custody-assets"] });
    void qc.invalidateQueries({ queryKey: ["pending-approvals"] });
  };

  /* ── حالات النماذج المدمجة ── */
  const [view, setView] = useState<"list" | "assignment" | "asset" | "return" | "cash">("list");
  const [active, setActive] = useState<CustodyAssignment | null>(null);

  const rows = assignments.data ?? [];
  const openRows = rows.filter((r) => isOpenAssignment(r.status));
  const mineRows = useMemo(
    () => (employee?.id ? rows.filter((r) => r.employee_id === employee.id) : []),
    [rows, employee?.id],
  );
  const stats = useMemo(
    () => ({
      open: openRows.length,
      overdue: rows.filter(isOverdue).length,
      value: openRows.reduce((s, r) => s + (r.totalValue ?? 0), 0),
      cash: openRows.reduce((s, r) => s + cashRemaining(r), 0),
    }),
    [rows, openRows],
  );

  /* ── نموذج العهدة ── */
  const [form, setForm] = useState({
    id: "" as string,
    employee_id: "",
    kind: "asset" as CustodyKind,
    purpose: "",
    expected_return_date: "",
    cash_amount: "",
    notes: "",
  });
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);

  const openAssignmentForm = (a?: CustodyAssignment) => {
    if (a) {
      setForm({
        id: a.id,
        employee_id: a.employee_id,
        kind: a.kind,
        purpose: a.purpose ?? "",
        expected_return_date: a.expected_return_date ?? "",
        cash_amount: String(a.cash_amount || ""),
        notes: a.notes ?? "",
      });
      setItems(
        a.items.length
          ? a.items.map((i) => ({
              asset_id: i.asset_id ?? "",
              title: i.title,
              quantity: i.quantity,
              condition_out: i.condition_out ?? "",
              odometer_out: i.odometer_out ? String(i.odometer_out) : "",
            }))
          : [emptyItem()],
      );
    } else {
      setForm({
        id: "",
        employee_id: "",
        kind: "asset",
        purpose: "",
        expected_return_date: "",
        cash_amount: "",
        notes: "",
      });
      setItems([emptyItem()]);
    }
    setView("assignment");
  };

  const saveFn = useServerFn(saveCustodyAssignment);
  const save = useMutation({
    mutationFn: (submit: boolean) =>
      saveFn({
        data: {
          ...(form.id ? { id: form.id } : {}),
          employee_id: form.employee_id,
          kind: form.kind,
          purpose: form.purpose || null,
          expected_return_date: form.expected_return_date || null,
          cash_amount: form.kind === "cash" ? Number(form.cash_amount || 0) : 0,
          notes: form.notes || null,
          submit,
          items:
            form.kind === "cash"
              ? []
              : items
                  .filter((i) => i.title.trim())
                  .map((i) => ({
                    asset_id: i.asset_id || null,
                    title: i.title.trim(),
                    quantity: Number(i.quantity || 1),
                    condition_out: i.condition_out || null,
                    odometer_out: i.odometer_out ? Number(i.odometer_out) : null,
                  })),
        },
      }),
    onSuccess: (_d, submit) => {
      toast.success(submit ? "تم إرسال العهدة للاعتماد" : "تم حفظ المسودة");
      invalidate();
      setView("list");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFn = useServerFn(deleteCustodyAssignment);
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم الحذف");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handFn = useServerFn(handOverCustody);
  const hand = useMutation({
    mutationFn: (id: string) => handFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم تسجيل التسليم");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideFn = useServerFn(decideCustodyAssignment);
  const decide = useMutation({
    mutationFn: (v: { id: string; action: "approved" | "returned"; note?: string }) =>
      decideFn({ data: v }),
    onSuccess: () => {
      toast.success("تم تسجيل القرار");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── نموذج الإرجاع ── */
  const [returns, setReturns] = useState<
    Record<string, { return_state: "good" | "damaged" | "lost"; condition_in: string; odometer_in: string }>
  >({});
  const returnFn = useServerFn(returnCustodyItems);
  const doReturn = useMutation({
    mutationFn: () =>
      returnFn({
        data: {
          id: active!.id,
          items: Object.entries(returns).map(([id, v]) => ({
            id,
            return_state: v.return_state,
            condition_in: v.condition_in || null,
            odometer_in: v.odometer_in ? Number(v.odometer_in) : null,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("تم تسجيل الإرجاع");
      invalidate();
      setView("list");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── حركة مالية ── */
  const [tx, setTx] = useState({
    tx_date: new Date().toISOString().slice(0, 10),
    tx_type: "expense" as "disbursement" | "expense" | "settlement",
    amount: "",
    description: "",
  });
  const txFn = useServerFn(addCustodyTransaction);
  const addTx = useMutation({
    mutationFn: () =>
      txFn({
        data: {
          assignment_id: active!.id,
          tx_date: tx.tx_date,
          tx_type: tx.tx_type,
          amount: Number(tx.amount || 0),
          description: tx.description || null,
        },
      }),
    onSuccess: () => {
      toast.success("تمت إضافة الحركة");
      invalidate();
      setView("list");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── نموذج الأصل ── */
  const [asset, setAsset] = useState({
    id: "",
    code: "",
    name: "",
    kind: "asset" as CustodyKind,
    category_id: "",
    status: "available",
    serial_no: "",
    brand: "",
    model: "",
    value: "",
    location: "",
    plate_no: "",
    manufacture_year: "",
    insurance_expiry: "",
    license_expiry: "",
    odometer: "",
    document_no: "",
    document_expiry: "",
    notes: "",
  });
  const saveAssetFn = useServerFn(saveCustodyAsset);
  const storeAsset = useMutation({
    mutationFn: () =>
      saveAssetFn({
        data: {
          ...(asset.id ? { id: asset.id } : {}),
          code: asset.code,
          name: asset.name,
          kind: asset.kind,
          category_id: asset.category_id || null,
          status: asset.status,
          serial_no: asset.serial_no || null,
          brand: asset.brand || null,
          model: asset.model || null,
          value: Number(asset.value || 0),
          location: asset.location || null,
          plate_no: asset.plate_no || null,
          manufacture_year: asset.manufacture_year ? Number(asset.manufacture_year) : null,
          insurance_expiry: asset.insurance_expiry || null,
          license_expiry: asset.license_expiry || null,
          odometer: asset.odometer ? Number(asset.odometer) : null,
          document_no: asset.document_no || null,
          document_expiry: asset.document_expiry || null,
          notes: asset.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ الأصل");
      invalidate();
      setView("list");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteAssetFn = useServerFn(deleteCustodyAsset);
  const removeAsset = useMutation({
    mutationFn: (id: string) => deleteAssetFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الأصل");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── التقارير ── */
  const buildDoc = (): ReportDoc => ({
    title: "تقرير عهد الموظفين",
    subtitle: "سجل العهد النشطة والمتأخرة",
    meta: [
      { label: "عدد العهد النشطة", value: String(stats.open) },
      { label: "المتأخرة", value: String(stats.overdue) },
      { label: "القيمة التقديرية", value: money(stats.value) },
    ],
    sections: [
      {
        heading: "العهد النشطة",
        table: {
          columns: ["الموظف", "الإدارة", "النوع", "البنود", "الحالة", "الإرجاع المتوقع", "القيمة"],
          rows: openRows.map((r) => [
            r.employee_name ?? "—",
            r.department_name ?? "—",
            CUSTODY_KIND_LABELS[r.kind],
            r.kind === "cash"
              ? `${money(r.cash_amount)} (متبقٍ ${money(cashRemaining(r))})`
              : r.items.map((i) => `${i.title} ×${i.quantity}`).join("، ") || "—",
            ASSIGNMENT_STATUS_LABELS[r.status],
            r.expected_return_date ?? "—",
            money(r.totalValue ?? 0),
          ]),
        },
      },
    ],
  });

  const employees = refs.data?.employees ?? [];
  const assetList = (assets.data ?? []) as unknown as {
    id: string;
    code: string;
    name: string;
    kind: CustodyKind;
    status: string;
    serial_no: string | null;
    plate_no: string | null;
    value: number;
    location: string | null;
    custody_categories?: { name: string } | null;
  }[];

  /* ══════════════ نماذج مدمجة ══════════════ */

  if (view === "assignment") {
    return (
      <div className="space-y-4">
        <PageHeader
          title={form.id ? "تعديل عهدة" : "تسجيل عهدة جديدة"}
          description="حدد الموظف ونوع العهدة والبنود ثم أرسلها لمسار الاعتماد"
          action={
            <Button variant="outline" className="gap-2" onClick={() => setView("list")}>
              <ArrowRight className="size-4" />
              رجوع
            </Button>
          }
        />
        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>الموظف</Label>
              <Select
                value={form.employee_id}
                onValueChange={(v) => setForm({ ...form, employee_id: v })}
              >
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
            <div className="space-y-1.5">
              <Label>نوع العهدة</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v as CustodyKind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTODY_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {CUSTODY_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الإرجاع المتوقع</Label>
              <Input
                type="date"
                value={form.expected_return_date}
                onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })}
              />
            </div>
            {form.kind === "cash" && (
              <div className="space-y-1.5">
                <Label>مبلغ العهدة</Label>
                <Input
                  type="number"
                  value={form.cash_amount}
                  onChange={(e) => setForm({ ...form, cash_amount: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الغرض</Label>
              <Input
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="مثال: تجهيز مكتب الموظف / مهمة ميدانية"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {form.kind !== "cash" && (
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">بنود العهدة</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setItems([...items, emptyItem()])}
              >
                <Plus className="size-4" />
                بند
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-5">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">من سجل الأصول (اختياري)</Label>
                    <Select
                      value={it.asset_id || "none"}
                      onValueChange={(v) => {
                        const a = assetList.find((x) => x.id === v);
                        const next = [...items];
                        next[idx] = {
                          ...it,
                          asset_id: v === "none" ? "" : v,
                          title: a ? `${a.name} (${a.code})` : it.title,
                        };
                        setItems(next);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="بند حر" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بند حر</SelectItem>
                        {assetList
                          .filter((a) => a.status === "available" || a.id === it.asset_id)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">وصف البند</Label>
                    <Input
                      value={it.title}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...it, title: e.target.value };
                        setItems(next);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">الكمية</Label>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...it, quantity: Number(e.target.value) };
                        setItems(next);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label className="text-xs">الحالة عند التسليم</Label>
                    <Input
                      value={it.condition_out}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...it, condition_out: e.target.value };
                        setItems(next);
                      }}
                      placeholder="جديد / مستعمل بحالة جيدة…"
                    />
                  </div>
                  {form.kind === "vehicle" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">العداد</Label>
                      <Input
                        type="number"
                        value={it.odometer_out}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...it, odometer_out: e.target.value };
                          setItems(next);
                        }}
                      />
                    </div>
                  )}
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1 gap-2"
            disabled={save.isPending || !form.employee_id}
            onClick={() => save.mutate(true)}
          >
            <Send className="size-4" />
            إرسال للاعتماد
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={save.isPending || !form.employee_id}
            onClick={() => save.mutate(false)}
          >
            حفظ كمسودة
          </Button>
        </div>
      </div>
    );
  }

  if (view === "asset") {
    return (
      <div className="space-y-4">
        <PageHeader
          title={asset.id ? "تعديل أصل" : "إضافة أصل"}
          description="سجل الأصول والمركبات والوثائق القابلة للتسليم كعهدة"
          action={
            <Button variant="outline" className="gap-2" onClick={() => setView("list")}>
              <ArrowRight className="size-4" />
              رجوع
            </Button>
          }
        />
        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>رمز الأصل</Label>
              <Input value={asset.code} onChange={(e) => setAsset({ ...asset, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input value={asset.name} onChange={(e) => setAsset({ ...asset, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select
                value={asset.kind}
                onValueChange={(v) => setAsset({ ...asset, kind: v as CustodyKind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTODY_KINDS.filter((k) => k !== "cash").map((k) => (
                    <SelectItem key={k} value={k}>
                      {CUSTODY_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>التصنيف</Label>
              <Select
                value={asset.category_id || "none"}
                onValueChange={(v) => setAsset({ ...asset, category_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="بدون" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون</SelectItem>
                  {(cats.data ?? []).map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={asset.status} onValueChange={(v) => setAsset({ ...asset, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>القيمة</Label>
              <Input
                type="number"
                value={asset.value}
                onChange={(e) => setAsset({ ...asset, value: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>الرقم التسلسلي</Label>
              <Input
                value={asset.serial_no}
                onChange={(e) => setAsset({ ...asset, serial_no: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>الموقع</Label>
              <Input
                value={asset.location}
                onChange={(e) => setAsset({ ...asset, location: e.target.value })}
              />
            </div>
            {asset.kind === "vehicle" && (
              <>
                <div className="space-y-1.5">
                  <Label>رقم اللوحة</Label>
                  <Input
                    value={asset.plate_no}
                    onChange={(e) => setAsset({ ...asset, plate_no: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>سنة الصنع</Label>
                  <Input
                    type="number"
                    value={asset.manufacture_year}
                    onChange={(e) => setAsset({ ...asset, manufacture_year: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>انتهاء التأمين</Label>
                  <Input
                    type="date"
                    value={asset.insurance_expiry}
                    onChange={(e) => setAsset({ ...asset, insurance_expiry: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>انتهاء الترخيص</Label>
                  <Input
                    type="date"
                    value={asset.license_expiry}
                    onChange={(e) => setAsset({ ...asset, license_expiry: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>قراءة العداد</Label>
                  <Input
                    type="number"
                    value={asset.odometer}
                    onChange={(e) => setAsset({ ...asset, odometer: e.target.value })}
                  />
                </div>
              </>
            )}
            {asset.kind === "document" && (
              <>
                <div className="space-y-1.5">
                  <Label>رقم الوثيقة</Label>
                  <Input
                    value={asset.document_no}
                    onChange={(e) => setAsset({ ...asset, document_no: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>انتهاء الوثيقة</Label>
                  <Input
                    type="date"
                    value={asset.document_expiry}
                    onChange={(e) => setAsset({ ...asset, document_expiry: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea
                rows={2}
                value={asset.notes}
                onChange={(e) => setAsset({ ...asset, notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
        <Button
          disabled={storeAsset.isPending || !asset.code.trim() || !asset.name.trim()}
          onClick={() => storeAsset.mutate()}
        >
          حفظ الأصل
        </Button>
      </div>
    );
  }

  if (view === "return" && active) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={`إرجاع عهدة — ${active.employee_name}`}
          description="حدد حالة كل بند عند الاستلام"
          action={
            <Button variant="outline" className="gap-2" onClick={() => setView("list")}>
              <ArrowRight className="size-4" />
              رجوع
            </Button>
          }
        />
        <Card>
          <CardContent className="space-y-3 p-4">
            {active.items
              .filter((i) => !i.returned_at)
              .map((i) => {
                const v = returns[i.id];
                return (
                  <div key={i.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
                    <p className="self-center font-medium">
                      {i.title} ×{i.quantity}
                    </p>
                    <Select
                      value={v?.return_state ?? ""}
                      onValueChange={(s) =>
                        setReturns({
                          ...returns,
                          [i.id]: {
                            return_state: s as "good" | "damaged" | "lost",
                            condition_in: v?.condition_in ?? "",
                            odometer_in: v?.odometer_in ?? "",
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="حالة الإرجاع" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(RETURN_STATE_LABELS).map(([k, lbl]) => (
                          <SelectItem key={k} value={k}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="ملاحظة الحالة"
                      value={v?.condition_in ?? ""}
                      onChange={(e) =>
                        setReturns({
                          ...returns,
                          [i.id]: {
                            return_state: v?.return_state ?? "good",
                            condition_in: e.target.value,
                            odometer_in: v?.odometer_in ?? "",
                          },
                        })
                      }
                    />
                  </div>
                );
              })}
          </CardContent>
        </Card>
        <Button
          disabled={doReturn.isPending || Object.keys(returns).length === 0}
          onClick={() => doReturn.mutate()}
        >
          تسجيل الإرجاع
        </Button>
      </div>
    );
  }

  if (view === "cash" && active) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={`حركة عهدة مالية — ${active.employee_name}`}
          description={`المبلغ ${money(active.cash_amount)} — المتبقي ${money(cashRemaining(active))}`}
          action={
            <Button variant="outline" className="gap-2" onClick={() => setView("list")}>
              <ArrowRight className="size-4" />
              رجوع
            </Button>
          }
        />
        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={tx.tx_date}
                onChange={(e) => setTx({ ...tx, tx_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>نوع الحركة</Label>
              <Select
                value={tx.tx_type}
                onValueChange={(v) =>
                  setTx({ ...tx, tx_type: v as "disbursement" | "expense" | "settlement" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disbursement">صرف</SelectItem>
                  <SelectItem value="expense">مصروف مستند</SelectItem>
                  <SelectItem value="settlement">تسوية / إرجاع نقدي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ</Label>
              <Input
                type="number"
                value={tx.amount}
                onChange={(e) => setTx({ ...tx, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>البيان</Label>
              <Textarea
                rows={2}
                value={tx.description}
                onChange={(e) => setTx({ ...tx, description: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
        <Button disabled={addTx.isPending || !Number(tx.amount)} onClick={() => addTx.mutate()}>
          إضافة الحركة
        </Button>
      </div>
    );
  }

  /* ══════════════ القائمة ══════════════ */

  return (
    <div className="space-y-4">
      <PageHeader
        title="إدارة العهد"
        description="عهد الأصول والمركبات والوثائق والعهد المالية مع مسار اعتماد وتسليم وإرجاع"
        action={
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" onClick={() => openAssignmentForm()}>
              <Plus className="size-4" />
              عهدة جديدة
            </Button>
            {canManage && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setAsset({ ...asset, id: "", code: "", name: "" });
                  setView("asset");
                }}
              >
                <Package className="size-4" />
                أصل جديد
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "عهد نشطة", value: String(stats.open) },
          { label: "متأخرة عن الإرجاع", value: String(stats.overdue) },
          { label: "قيمة العهد", value: money(stats.value) },
          { label: "عهد مالية غير مسواة", value: money(stats.cash) },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue={canManage ? "active" : "mine"}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="mine">عهدي المستلمة</TabsTrigger>
          <TabsTrigger value="active">العهد النشطة</TabsTrigger>
          <TabsTrigger value="all">كل السجلات</TabsTrigger>
          {canManage && <TabsTrigger value="assets">سجل الأصول</TabsTrigger>}
          <TabsTrigger value="reports">التقارير</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="space-y-3">
          {assignments.isLoading ? (
            <ListSkeleton />
          ) : mineRows.length === 0 ? (
            <EmptyState
              icon={Package}
              title="لا توجد عهد مسجلة باسمك"
              description="لم يتم تسليم أي عهد أصول أو أجهزة أو عهد مالية لك حالياً."
            />
          ) : (
            mineRows.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{CUSTODY_KIND_LABELS[r.kind]}</Badge>
                    <Badge variant="outline">{ASSIGNMENT_STATUS_LABELS[r.status]}</Badge>
                    {isOverdue(r) && <Badge variant="destructive">تجاوزت تاريخ الإرجاع</Badge>}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {r.kind === "cash"
                        ? `عهدة مالية: مبلغ ${money(r.cash_amount)}`
                        : r.items.map((i) => `${i.title} ×${i.quantity}`).join("، ") || "عهدة ممتلكات"}
                    </p>
                    {r.kind === "cash" && (
                      <p className="text-sm text-muted-foreground">
                        المتبقي غير المسوى: {money(cashRemaining(r))}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      الغرض: {r.purpose ?? "—"} · تاريخ الاستلام: {r.handed_over_at ? formatDate(r.handed_over_at) : "قيد المعالجة"} · الإرجاع المتوقع: {r.expected_return_date ? formatDate(r.expected_return_date) : "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.status === "handed_over" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActive(r);
                          setReturns({});
                          setView("return");
                        }}
                      >
                        طلب إرجاع العهدة
                      </Button>
                    )}
                    {r.kind === "cash" && r.status === "handed_over" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActive(r);
                          setView("cash");
                        }}
                      >
                        إضافة بيان تسوية
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {(["active", "all"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-3">
            {assignments.isLoading ? (
              <ListSkeleton />
            ) : (tab === "active" ? openRows : rows).length === 0 ? (
              <EmptyState
                icon={Package}
                title="لا توجد عهد"
                description="ابدأ بتسجيل عهدة جديدة لموظف"
              />
            ) : (
              (tab === "active" ? openRows : rows).map((r) => (
                <Card key={r.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{CUSTODY_KIND_LABELS[r.kind]}</Badge>
                      <Badge variant="outline">{ASSIGNMENT_STATUS_LABELS[r.status]}</Badge>
                      {isOverdue(r) && <Badge variant="destructive">متأخرة عن الإرجاع</Badge>}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {r.employee_name} — {r.department_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {r.kind === "cash"
                          ? `مبلغ ${money(r.cash_amount)} — متبقٍ ${money(cashRemaining(r))}`
                          : r.items.map((i) => `${i.title} ×${i.quantity}`).join("، ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        الغرض: {r.purpose ?? "—"} · الإرجاع المتوقع: {r.expected_return_date ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["draft", "rejected"].includes(r.status) && (
                        <Button size="sm" variant="outline" onClick={() => openAssignmentForm(r)}>
                          تعديل
                        </Button>
                      )}
                      {canManage && r.status === "approved" && (
                        <Button size="sm" onClick={() => hand.mutate(r.id)}>
                          تسجيل التسليم
                        </Button>
                      )}
                      {canManage && r.status === "handed_over" && r.kind !== "cash" && (
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            setActive(r);
                            setReturns({});
                            setView("return");
                          }}
                        >
                          <Undo2 className="size-4" />
                          إرجاع
                        </Button>
                      )}
                      {r.kind === "cash" && isOpenAssignment(r.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => {
                            setActive(r);
                            setView("cash");
                          }}
                        >
                          <Banknote className="size-4" />
                          حركة مالية
                        </Button>
                      )}
                      {canManage &&
                        ["pending_manager", "pending_hr", "pending_director"].includes(r.status) && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => decide.mutate({ id: r.id, action: "approved" })}
                            >
                              اعتماد
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                decide.mutate({
                                  id: r.id,
                                  action: "returned",
                                  note: "أُعيد من إدارة العهد",
                                })
                              }
                            >
                              رفض
                            </Button>
                          </>
                        )}
                      {(canManage || r.status === "draft") && r.status !== "handed_over" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove.mutate(r.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}

        <TabsContent value="assets" className="space-y-3">
          {assetList.length === 0 ? (
            <EmptyState
              icon={Package}
              title="سجل الأصول فارغ"
              description="أضف الأصول والمركبات والوثائق ليمكن تسليمها كعهدة"
            />
          ) : (
            assetList.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {a.code} — {a.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {CUSTODY_KIND_LABELS[a.kind]} · {a.custody_categories?.name ?? "بدون تصنيف"} ·{" "}
                      {a.plate_no ?? a.serial_no ?? "—"} · القيمة {money(a.value)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {ASSET_STATUS_LABELS[a.status as keyof typeof ASSET_STATUS_LABELS] ?? a.status}
                    </Badge>
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAsset({
                              id: a.id,
                              code: a.code,
                              name: a.name,
                              kind: a.kind,
                              category_id: "",
                              status: a.status,
                              serial_no: a.serial_no ?? "",
                              brand: "",
                              model: "",
                              value: String(a.value ?? ""),
                              location: a.location ?? "",
                              plate_no: a.plate_no ?? "",
                              manufacture_year: "",
                              insurance_expiry: "",
                              license_expiry: "",
                              odometer: "",
                              document_no: "",
                              document_expiry: "",
                              notes: "",
                            });
                            setView("asset");
                          }}
                        >
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => removeAsset.mutate(a.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-3">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 p-4">
              <Button
                className="gap-2"
                onClick={() => exportWord(buildDoc(), "تقرير-العهد")}
                disabled={openRows.length === 0}
              >
                <FileDown className="size-4" />
                تصدير Word
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => exportPdf(buildDoc())}
                disabled={openRows.length === 0}
              >
                <FileDown className="size-4" />
                تصدير PDF
              </Button>
            </CardContent>
          </Card>
          {openRows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span className="font-medium">{r.employee_name}</span>
                <span className="text-muted-foreground">
                  {CUSTODY_KIND_LABELS[r.kind]} · {ASSIGNMENT_STATUS_LABELS[r.status]}
                </span>
                <span>{money(r.kind === "cash" ? r.cash_amount : (r.totalValue ?? 0))}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
