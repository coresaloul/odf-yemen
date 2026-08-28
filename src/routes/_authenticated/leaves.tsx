import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Check, Undo2, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_STAGE_STEPS } from "@/lib/attendance";
import {
  saveLeaveRequest,
  submitLeaveRequest,
  decideLeaveRequest,
  deleteLeaveRequest,
} from "@/lib/leave.functions";

export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({
    meta: [
      { title: "الإجازات والأذونات | الموارد البشرية" },
      {
        name: "description",
        content: "تقديم طلبات الإجازات والأذونات الساعية ومتابعة مسار اعتمادها وأرصدة كل موظف.",
      },
      { property: "og:title", content: "الإجازات والأذونات | الموارد البشرية" },
      {
        property: "og:description",
        content: "إدارة إجازات موظفي مؤسسة اليتيم التنموية واعتمادها على ثلاث مراحل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeavesPage,
});

const STAGE_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending_manager: "بانتظار المدير المباشر",
  pending_hr: "بانتظار الموارد البشرية",
  pending_director: "بانتظار المدير التنفيذي",
  approved: "معتمدة",
  returned: "مُعادة للتعديل",
};

const stageVariant = (stage: string) =>
  stage === "approved" ? "default" : stage === "returned" ? "destructive" : "secondary";

const today = () => new Date().toISOString().slice(0, 10);

function LeavesPage() {
  const { employee, isDirector, isHR } = useAuth();
  const isAdmin = isDirector || isHR;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const [requests, types, employees, balances] = await Promise.all([
        supabase
          .from("leave_requests")
          .select("*, employees(id, full_name, manager_id), leave_types(name, is_hourly)")
          .order("created_at", { ascending: false }),
        supabase.from("leave_types").select("*").eq("active", true).order("name"),
        supabase
          .from("employees")
          .select("id, full_name, manager_id")
          .eq("status", "active")
          .order("full_name"),
        supabase
          .from("leave_balances")
          .select("*, leave_types(name)")
          .eq("year", new Date().getFullYear()),
      ]);
      return {
        requests: requests.data ?? [],
        types: types.data ?? [],
        employees: employees.data ?? [],
        balances: balances.data ?? [],
      };
    },
  });

  const requests = data?.requests ?? [];
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["leaves"] });
    void qc.invalidateQueries({ queryKey: ["attendance"] });
  };

  const submitFn = useServerFn(submitLeaveRequest);
  const decideFn = useServerFn(decideLeaveRequest);
  const deleteFn = useServerFn(deleteLeaveRequest);

  const submitMut = useMutation({
    mutationFn: (id: string) => submitFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم إرسال الطلب للاعتماد");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideMut = useMutation({
    mutationFn: (v: { id: string; action: "approved" | "returned"; note?: string }) =>
      decideFn({ data: v }),
    onSuccess: () => {
      toast.success("تم تسجيل القرار");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الطلب");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mine = requests.filter((r) => r.employee_id === employee?.id);
  const pendingForMe = useMemo(
    () =>
      requests.filter((r) => {
        const stage = String(r.stage);
        if (stage === "pending_manager")
          return isDirector || (employee?.id && r.employees?.manager_id === employee.id);
        if (stage === "pending_hr") return isHR || isDirector;
        if (stage === "pending_director") return isDirector;
        return false;
      }),
    [requests, employee, isDirector, isHR],
  );

  const myBalances = (data?.balances ?? []).filter((b) => b.employee_id === employee?.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإجازات والأذونات"
        description="تقديم الطلبات ومتابعة الاعتماد: المدير المباشر ← الموارد البشرية ← المدير التنفيذي"
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> طلب جديد
          </Button>
        }
      />

      <Tabs defaultValue="mine" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mine">طلباتي</TabsTrigger>
          <TabsTrigger value="pending">
            بانتظار اعتمادي {pendingForMe.length > 0 && `(${pendingForMe.length})`}
          </TabsTrigger>
          <TabsTrigger value="balances">أرصدتي</TabsTrigger>
          {isAdmin && <TabsTrigger value="all">جميع الطلبات</TabsTrigger>}
        </TabsList>

        <TabsContent value="mine">
          <RequestsTable
            rows={mine}
            emptyText="لم تقدّم أي طلب بعد"
            onSubmit={(id) => submitMut.mutate(id)}
            onDelete={(id) => deleteMut.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="pending">
          <RequestsTable
            rows={pendingForMe}
            emptyText="لا توجد طلبات بانتظار اعتمادك"
            onDecide={(id, action, note) =>
              decideMut.mutate(note ? { id, action, note } : { id, action })
            }
          />
        </TabsContent>

        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">أرصدة سنة {new Date().getFullYear()}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="p-3">نوع الإجازة</th>
                    <th className="p-3">المستحق</th>
                    <th className="p-3">مُرحّل</th>
                    <th className="p-3">المستخدم</th>
                    <th className="p-3">المتبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {myBalances.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="p-3">{b.leave_types?.name}</td>
                      <td className="p-3">{Number(b.entitled)}</td>
                      <td className="p-3">{Number(b.carried)}</td>
                      <td className="p-3">{Number(b.used)}</td>
                      <td className="p-3 font-semibold">
                        {Number(b.entitled) + Number(b.carried) - Number(b.used)}
                      </td>
                    </tr>
                  ))}
                  {myBalances.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        لا توجد أرصدة مسجلة — يمكن للموارد البشرية توليدها من إعدادات الدوام
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="all">
            <RequestsTable
              rows={requests}
              emptyText="لا توجد طلبات"
              onDelete={(id) => deleteMut.mutate(id)}
            />
          </TabsContent>
        )}
      </Tabs>

      <RequestDialog
        open={open}
        onOpenChange={setOpen}
        types={data?.types ?? []}
        employees={data?.employees ?? []}
        defaultEmployeeId={employee?.id ?? null}
        canPickEmployee={isAdmin}
        onSaved={invalidate}
      />
    </div>
  );
}

type RequestRow = {
  id: string;
  employee_id: string;
  kind: string;
  stage: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  days: number;
  hours: number;
  reason: string | null;
  return_reason: string | null;
  employees?: { full_name: string } | null;
  leave_types?: { name: string } | null;
};

function RequestsTable({
  rows,
  emptyText,
  onSubmit,
  onDecide,
  onDelete,
}: {
  rows: RequestRow[];
  emptyText: string;
  onSubmit?: (id: string) => void;
  onDecide?: (id: string, action: "approved" | "returned", note?: string) => void;
  onDelete?: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* عرض البطاقات على شاشات الهواتف */}
      <div className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <Card key={r.id} className="overflow-hidden border-border/80">
            <CardContent className="space-y-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{r.employees?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.leave_types?.name ?? "—"} · {r.kind === "permission" ? "إذن ساعي" : "إجازة"}
                  </p>
                </div>
                <Badge variant={stageVariant(String(r.stage))}>
                  {STAGE_LABELS[String(r.stage)]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                <div>
                  <span className="text-muted-foreground">الفترة: </span>
                  <span className="font-medium text-foreground">
                    {r.kind === "permission"
                      ? `${r.start_date} (${String(r.start_time ?? "").slice(0, 5)} - ${String(r.end_time ?? "").slice(0, 5)})`
                      : `${r.start_date} — ${r.end_date}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">المدة: </span>
                  <span className="font-medium text-foreground">
                    {r.kind === "permission" ? `${Number(r.hours)} ساعة` : `${Number(r.days)} يوم`}
                  </span>
                </div>
              </div>

              {r.return_reason && (
                <p className="text-xs text-destructive">سبب الإعادة: {r.return_reason}</p>
              )}

              {/* أزرار الإجراءات على الموبايل */}
              {(onSubmit || onDecide || (onDelete && String(r.stage) !== "approved")) && (
                <div className="flex flex-wrap items-center gap-1.5 border-t pt-2.5">
                  {onSubmit && ["draft", "returned"].includes(String(r.stage)) && (
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => onSubmit(r.id)}>
                      <Send className="size-3.5" /> إرسال للاعتماد
                    </Button>
                  )}
                  {onDecide && (
                    <>
                      <Button size="sm" className="flex-1 gap-1" onClick={() => onDecide(r.id, "approved")}>
                        <Check className="size-3.5" /> اعتماد
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1"
                        onClick={() => {
                          const note = window.prompt("سبب الإعادة للتعديل");
                          if (note) onDecide(r.id, "returned", note);
                        }}
                      >
                        <Undo2 className="size-3.5" /> إعادة للتعديل
                      </Button>
                    </>
                  )}
                  {onDelete && String(r.stage) !== "approved" && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(r.id)}>
                      <Trash2 className="size-4" /> حذف
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* عرض الجدول على الشاشات المتوسطة والكبيرة */}
      <Card className="hidden sm:block">
        <CardContent className="touch-scroll overflow-x-auto p-0">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/60 text-xs">
              <tr>
                <th className="p-3">الموظف</th>
                <th className="p-3">النوع</th>
                <th className="p-3">الفترة</th>
                <th className="p-3">المدة</th>
                <th className="p-3">المرحلة</th>
                <th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top hover:bg-muted/30">
                  <td className="p-3 font-medium">{r.employees?.full_name ?? "—"}</td>
                  <td className="p-3">
                    {r.leave_types?.name ?? "—"}
                    <span className="block text-xs text-muted-foreground">
                      {r.kind === "permission" ? "إذن ساعي" : "إجازة"}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {r.kind === "permission"
                      ? `${r.start_date} (${String(r.start_time ?? "").slice(0, 5)} — ${String(r.end_time ?? "").slice(0, 5)})`
                      : `${r.start_date} — ${r.end_date}`}
                  </td>
                  <td className="p-3 text-xs font-semibold">
                    {r.kind === "permission" ? `${Number(r.hours)} ساعة` : `${Number(r.days)} يوم`}
                  </td>
                  <td className="p-3">
                    <Badge variant={stageVariant(String(r.stage))}>
                      {STAGE_LABELS[String(r.stage)]}
                    </Badge>
                    {r.return_reason && (
                      <p className="mt-1 text-xs text-destructive">{r.return_reason}</p>
                    )}
                    {!["draft", "approved", "returned"].includes(String(r.stage)) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {LEAVE_STAGE_STEPS.findIndex((s) => s.stage === r.stage) + 1} من{" "}
                        {LEAVE_STAGE_STEPS.length}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {onSubmit && ["draft", "returned"].includes(String(r.stage)) && (
                        <Button size="sm" variant="outline" onClick={() => onSubmit(r.id)}>
                          <Send className="size-3.5" /> إرسال
                        </Button>
                      )}
                      {onDecide && (
                        <>
                          <Button size="sm" onClick={() => onDecide(r.id, "approved")}>
                            <Check className="size-3.5" /> اعتماد
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const note = window.prompt("سبب الإعادة للتعديل");
                              if (note) onDecide(r.id, "returned", note);
                            }}
                          >
                            <Undo2 className="size-3.5" /> إعادة
                          </Button>
                        </>
                      )}
                      {onDelete && String(r.stage) !== "approved" && (
                        <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function RequestDialog({
  open,
  onOpenChange,
  types,
  employees,
  defaultEmployeeId,
  canPickEmployee,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  types: { id: string; name: string; is_hourly: boolean; requires_attachment: boolean }[];
  employees: { id: string; full_name: string }[];
  defaultEmployeeId: string | null;
  canPickEmployee: boolean;
  onSaved: () => void;
}) {
  const saveFn = useServerFn(saveLeaveRequest);
  const submitFn = useServerFn(submitLeaveRequest);
  const [form, setForm] = useState({
    employee_id: defaultEmployeeId ?? "",
    leave_type_id: "",
    start_date: today(),
    end_date: today(),
    start_time: "",
    end_time: "",
    reason: "",
    attachment_url: "",
  });

  const type = types.find((t) => t.id === form.leave_type_id);
  const kind: "leave" | "permission" = type?.is_hourly ? "permission" : "leave";

  const mut = useMutation({
    mutationFn: async () => {
      const res = await saveFn({
        data: {
          id: null,
          employee_id: form.employee_id,
          leave_type_id: form.leave_type_id,
          kind,
          start_date: form.start_date,
          end_date: kind === "permission" ? form.start_date : form.end_date,
          start_time: kind === "permission" ? form.start_time : null,
          end_time: kind === "permission" ? form.end_time : null,
          reason: form.reason || null,
          attachment_url: form.attachment_url || null,
        },
      });
      await submitFn({ data: { id: res.id } });
    },
    onSuccess: () => {
      toast.success("تم إنشاء الطلب وإرساله للاعتماد");
      onOpenChange(false);
      setForm({ ...form, reason: "", attachment_url: "" });
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>طلب إجازة / إذن</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {canPickEmployee && (
            <div className="space-y-2">
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
          )}
          <div className="space-y-2">
            <Label>نوع الإجازة</Label>
            <Select
              value={form.leave_type_id}
              onValueChange={(v) => setForm({ ...form, leave_type_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.is_hourly ? " (ساعي)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{kind === "permission" ? "التاريخ" : "من تاريخ"}</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            {kind === "leave" ? (
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>من الساعة</Label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>إلى الساعة</Label>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          {type?.requires_attachment && (
            <div className="space-y-2">
              <Label>رابط المستند المرفق</Label>
              <Input
                value={form.attachment_url}
                onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>السبب</Label>
            <Textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.employee_id || !form.leave_type_id}
          >
            إرسال الطلب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
