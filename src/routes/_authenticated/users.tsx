import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MailCheck, ShieldCheck, KeyRound, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listAppUsers,
  confirmUserEmail,
  setUserActive,
  setUserPassword,
  setUserRoles,
  type AdminUserRow,
} from "@/lib/admin-users.functions";
import { formatDate } from "@/lib/hr";
import { PasswordField } from "@/components/PasswordField";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersAdminPage,
  head: () => ({
    meta: [
      { title: "إدارة المستخدمين والصلاحيات | نظام الموارد البشرية" },
      {
        name: "description",
        content:
          "لوحة المدير التنفيذي لإدارة حسابات المستخدمين، تفعيل البريد يدوياً، تعطيل الحسابات، وتحديد الأدوار والصلاحيات.",
      },
      { property: "og:title", content: "إدارة المستخدمين والصلاحيات" },
      {
        property: "og:description",
        content: "تفعيل الحسابات غير المؤكدة وضبط أدوار المستخدمين في نظام الموارد البشرية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL_ROLES = [
  { value: "executive_director", label: "المدير التنفيذي" },
  { value: "manager", label: "مدير مباشر" },
  { value: "hr", label: "الموارد البشرية" },
  { value: "employee", label: "موظف" },
] as const;

type RoleValue = (typeof ALL_ROLES)[number]["value"];

function UsersAdminPage() {
  const { isDirector, isHR, loading: authLoading, refresh } = useAuth();
  const canManageUsers = isDirector || isHR;
  const fetchUsers = useServerFn(listAppUsers);
  const doConfirm = useServerFn(confirmUserEmail);
  const doActive = useServerFn(setUserActive);
  const doPassword = useServerFn(setUserPassword);
  const doRoles = useServerFn(setUserRoles);

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rolesTarget, setRolesTarget] = useState<AdminUserRow | null>(null);
  const [draftRoles, setDraftRoles] = useState<RoleValue[]>([]);
  const [pwTarget, setPwTarget] = useState<AdminUserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchUsers());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تحميل المستخدمين");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && canManageUsers) void load();
    else if (!authLoading) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canManageUsers]);

  if (authLoading) {
    return <div className="p-8 text-muted-foreground">جارٍ التحميل…</div>;
  }

  if (!canManageUsers) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>غير مصرح</CardTitle>
            <CardDescription>
              هذه الصفحة متاحة للمدير التنفيذي أو الموارد البشرية فقط.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const run = async (id: string, fn: () => Promise<unknown>, msg: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(msg);
      await load();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تنفيذ العملية");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">إدارة المستخدمين والصلاحيات</h1>
          <p className="text-sm text-muted-foreground">
            تفعيل البريد يدوياً، تعطيل/تفعيل الحسابات، وتحديد الأدوار.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="ml-2 size-4" />
          تحديث
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">الحسابات ({rows.length})</CardTitle>
          <CardDescription>كل الحسابات المسجّلة في النظام وحالتها.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد حسابات.</p>
          ) : (
            rows.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">{u.employee_name ?? u.full_name ?? "بدون اسم"}</p>
                  <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Badge variant={u.email_confirmed ? "secondary" : "destructive"}>
                      {u.email_confirmed ? "البريد مؤكَّد" : "بريد غير مؤكَّد"}
                    </Badge>
                    <Badge variant={u.banned ? "destructive" : "outline"}>
                      {u.banned ? "معطَّل" : "نشط"}
                    </Badge>
                    {u.roles.length === 0 ? (
                      <Badge variant="outline">بدون دور</Badge>
                    ) : (
                      u.roles.map((r) => (
                        <Badge key={r}>
                          {ALL_ROLES.find((x) => x.value === r)?.label ?? r}
                        </Badge>
                      ))
                    )}
                    <span className="text-xs text-muted-foreground">
                      أُنشئ: {formatDate(u.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!u.email_confirmed && (
                    <Button
                      size="sm"
                      disabled={busyId === u.id}
                      onClick={() =>
                        void run(u.id, () => doConfirm({ data: { userId: u.id } }), "تم تفعيل البريد")
                      }
                    >
                      <MailCheck className="ml-2 size-4" />
                      تفعيل البريد
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={u.banned ? "default" : "outline"}
                    disabled={busyId === u.id}
                    onClick={() =>
                      void run(
                        u.id,
                        () => doActive({ data: { userId: u.id, active: u.banned } }),
                        u.banned ? "تم تفعيل الحساب" : "تم تعطيل الحساب",
                      )
                    }
                  >
                    {u.banned ? "تفعيل الحساب" : "تعطيل الحساب"}
                  </Button>
                  {isDirector && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === u.id}
                      onClick={() => {
                        setRolesTarget(u);
                        setDraftRoles(u.roles as RoleValue[]);
                      }}
                    >
                      <ShieldCheck className="ml-2 size-4" />
                      الأدوار
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === u.id}
                    onClick={() => {
                      setPwTarget(u);
                      setNewPassword("");
                    }}
                  >
                    <KeyRound className="ml-2 size-4" />
                    كلمة المرور
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rolesTarget} onOpenChange={(o) => !o && setRolesTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>أدوار وصلاحيات المستخدم</DialogTitle>
            <DialogDescription>{rolesTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {ALL_ROLES.map((r) => (
              <label key={r.value} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                <Checkbox
                  checked={draftRoles.includes(r.value)}
                  onCheckedChange={(c) =>
                    setDraftRoles((prev) =>
                      c ? [...new Set([...prev, r.value])] : prev.filter((x) => x !== r.value),
                    )
                  }
                />
                {r.label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesTarget(null)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                const target = rolesTarget;
                if (!target) return;
                setRolesTarget(null);
                void run(
                  target.id,
                  () => doRoles({ data: { userId: target.id, roles: draftRoles } }),
                  "تم تحديث الأدوار",
                );
              }}
            >
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwTarget} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعيين كلمة مرور جديدة</DialogTitle>
            <DialogDescription>{pwTarget?.email}</DialogDescription>
          </DialogHeader>
          <PasswordField
            id="pw"
            label="كلمة المرور الجديدة"
            value={newPassword}
            onChange={setNewPassword}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwTarget(null)}>
              إلغاء
            </Button>
            <Button
              disabled={newPassword.length < 1}

              onClick={() => {
                const target = pwTarget;
                if (!target) return;
                const password = newPassword;
                setPwTarget(null);
                void run(
                  target.id,
                  () => doPassword({ data: { userId: target.id, password } }),
                  "تم تحديث كلمة المرور",
                );
              }}
            >
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
