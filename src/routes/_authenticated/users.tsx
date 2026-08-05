import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton, LoadingState } from "@/components/LoadingState";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  MailCheck,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  UserPlus,
  Link2,
  Trash2,
  Search,
  History,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  inviteUser,
  linkUserToEmployee,
  deleteAppUser,
  listEmployeesForLinking,
  type AdminUserRow,
} from "@/lib/admin-users.functions";
import { listAuditLog, type AuditRow } from "@/lib/org.functions";
import { formatDate } from "@/lib/hr";
import { PasswordField } from "@/components/PasswordField";
import { UserEmployeeMatchDialog } from "@/components/UserEmployeeMatchDialog";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersAdminPage,
  head: () => ({
    meta: [
      { title: "إدارة المستخدمين والصلاحيات | نظام الموارد البشرية" },
      {
        name: "description",
        content:
          "لوحة إدارة حسابات المستخدمين: إنشاء حساب، ربطه بموظف، تفعيل البريد، تعطيل الحساب، وتحديد الأدوار والصلاحيات.",
      },
      { property: "og:title", content: "إدارة المستخدمين والصلاحيات" },
      {
        property: "og:description",
        content: "إنشاء الحسابات وربطها بالموظفين وضبط الأدوار مع سجل تدقيق كامل.",
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
type EmployeeOption = {
  id: string;
  full_name: string;
  employee_no: string;
  user_id: string | null;
};

const ROLE_MATRIX: { role: string; scope: string; abilities: string }[] = [
  {
    role: "المدير التنفيذي",
    scope: "كامل النظام",
    abilities:
      "كل العمليات: الهيكل، الموظفون، المستخدمون والأدوار، المهام، التقييم والاعتماد النهائي",
  },
  {
    role: "الموارد البشرية",
    scope: "كل الموظفين",
    abilities:
      "الموظفون والوثائق والدوام، إنشاء الحسابات وربطها، اعتماد التقييم في مرحلة الموارد البشرية",
  },
  {
    role: "مدير مباشر",
    scope: "إدارته/قسمه",
    abilities: "تكليف المهام ومتابعتها، تقييم موظفيه واعتماده في المرحلة الأولى",
  },
  { role: "موظف", scope: "بياناته فقط", abilities: "مهامه، تحديث الإنجاز، بياناته وتقييمه" },
];

function UsersAdminPage() {
  const { isDirector, isHR, loading: authLoading, refresh } = useAuth();
  const canManageUsers = isDirector || isHR;
  const fetchUsers = useServerFn(listAppUsers);
  const doConfirm = useServerFn(confirmUserEmail);
  const doActive = useServerFn(setUserActive);
  const doPassword = useServerFn(setUserPassword);
  const doRoles = useServerFn(setUserRoles);
  const doInvite = useServerFn(inviteUser);
  const doLink = useServerFn(linkUserToEmployee);
  const doDelete = useServerFn(deleteAppUser);
  const fetchEmployees = useServerFn(listEmployeesForLinking);
  const fetchAudit = useServerFn(listAuditLog);

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [rolesTarget, setRolesTarget] = useState<AdminUserRow | null>(null);
  const [draftRoles, setDraftRoles] = useState<RoleValue[]>([]);
  const [pwTarget, setPwTarget] = useState<AdminUserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [linkTarget, setLinkTarget] = useState<AdminUserRow | null>(null);
  const [linkEmployee, setLinkEmployee] = useState("none");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invPassword, setInvPassword] = useState("");
  const [invRole, setInvRole] = useState<RoleValue>("employee");
  const [invEmployee, setInvEmployee] = useState("none");

  const load = async () => {
    setLoading(true);
    try {
      const [users, emps] = await Promise.all([fetchUsers(), fetchEmployees()]);
      setRows(users);
      setEmployees(emps as EmployeeOption[]);
      try {
        setAudit(await fetchAudit());
      } catch {
        setAudit([]);
      }
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

  const filtered = useMemo(() => {
    const q = query.trim();
    return rows.filter((u) => {
      const matchQ =
        !q ||
        (u.email ?? "").includes(q) ||
        (u.full_name ?? "").includes(q) ||
        (u.employee_name ?? "").includes(q);
      const matchRole =
        roleFilter === "all"
          ? true
          : roleFilter === "none"
            ? u.roles.length === 0
            : u.roles.includes(roleFilter as RoleValue);
      return matchQ && matchRole;
    });
  }, [rows, query, roleFilter]);

  if (authLoading) {
    return <LoadingState className="p-8" />;
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

  const unlinkedEmployees = employees.filter((e) => !e.user_id);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">إدارة المستخدمين والصلاحيات</h1>
          <p className="text-sm text-muted-foreground">
            إنشاء الحسابات وربطها بالموظفين، تفعيل البريد، تعطيل الحسابات، وتحديد الأدوار.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="ml-2 size-4" /> تحديث
          </Button>
          <UserEmployeeMatchDialog onDone={() => void load()} />

          <Button
            size="sm"
            onClick={() => {
              setInvEmail("");
              setInvName("");
              setInvPassword("");
              setInvRole("employee");
              setInvEmployee("none");
              setInviteOpen(true);
            }}
          >
            <UserPlus className="ml-2 size-4" /> مستخدم جديد
          </Button>
        </div>
      </header>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">الحسابات</TabsTrigger>
          <TabsTrigger value="matrix">مصفوفة الصلاحيات</TabsTrigger>
          <TabsTrigger value="audit">سجل التدقيق</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث بالاسم أو البريد"
                className="pr-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأدوار</SelectItem>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
                <SelectItem value="none">بدون دور</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">الحسابات ({filtered.length})</CardTitle>
              <CardDescription>
                {rows.filter((r) => !r.employee_id).length} حساب غير مرتبط بموظف ·{" "}
                {unlinkedEmployees.length} موظف بلا حساب
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <ListSkeleton rows={4} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="لا توجد حسابات مطابقة"
                  description="عدّل البحث أو فلتر الأدوار."
                />
              ) : (
                filtered.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold">
                        {u.employee_name ?? u.full_name ?? "بدون اسم"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <Badge variant={u.email_confirmed ? "secondary" : "destructive"}>
                          {u.email_confirmed ? "البريد مؤكَّد" : "بريد غير مؤكَّد"}
                        </Badge>
                        <Badge variant={u.banned ? "destructive" : "outline"}>
                          {u.banned ? "معطَّل" : "نشط"}
                        </Badge>
                        <Badge variant={u.employee_id ? "outline" : "destructive"}>
                          {u.employee_id ? "مرتبط بموظف" : "غير مرتبط بموظف"}
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
                          {u.last_sign_in_at
                            ? ` · آخر دخول: ${formatDate(u.last_sign_in_at)}`
                            : " · لم يسجّل الدخول بعد"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!u.email_confirmed && (
                        <Button
                          size="sm"
                          disabled={busyId === u.id}
                          onClick={() =>
                            void run(
                              u.id,
                              () => doConfirm({ data: { userId: u.id } }),
                              "تم تفعيل البريد",
                            )
                          }
                        >
                          <MailCheck className="ml-2 size-4" /> تفعيل البريد
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
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === u.id}
                        onClick={() => {
                          setLinkTarget(u);
                          setLinkEmployee(u.employee_id ?? "none");
                        }}
                      >
                        <Link2 className="ml-2 size-4" /> الربط بموظف
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
                          <ShieldCheck className="ml-2 size-4" /> الأدوار
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
                        <KeyRound className="ml-2 size-4" /> كلمة المرور
                      </Button>
                      {isDirector && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === u.id}
                          onClick={() => {
                            if (!confirm(`حذف حساب ${u.email}؟ لا يمكن التراجع.`)) return;
                            void run(
                              u.id,
                              () => doDelete({ data: { userId: u.id } }),
                              "تم حذف الحساب",
                            );
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">مصفوفة الأدوار والصلاحيات</CardTitle>
              <CardDescription>الصلاحيات مطبَّقة على مستوى قاعدة البيانات أيضاً.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ROLE_MATRIX.map((r) => (
                <div key={r.role} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{r.role}</p>
                    <Badge variant="secondary">{r.scope}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.abilities}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4" /> آخر العمليات الإدارية
              </CardTitle>
              <CardDescription>سجل غير قابل للتعديل لأهم عمليات النظام.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد عمليات مسجّلة بعد.</p>
              ) : (
                audit.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <span>
                      <strong>{a.actor_name ?? "مستخدم"}</strong> — {a.action} {a.entity}
                      {a.entity_label ? ` «${a.entity_label}»` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(a.created_at)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* إنشاء مستخدم */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء مستخدم جديد</DialogTitle>
            <DialogDescription>يمكن ربط الحساب مباشرة بسجل موظف قائم.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input value={invName} onChange={(e) => setInvName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                dir="ltr"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
              />
            </div>
            <PasswordField
              id="invite-pw"
              label="كلمة المرور"
              value={invPassword}
              onChange={setInvPassword}
            />
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={invRole} onValueChange={(v) => setInvRole(v as RoleValue)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.filter((r) => isDirector || r.value === "employee").map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ربط بموظف (اختياري)</Label>
              <Select value={invEmployee} onValueChange={setInvEmployee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون ربط</SelectItem>
                  {unlinkedEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_no})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              إلغاء
            </Button>
            <Button
              disabled={!invEmail || invName.trim().length < 2 || invPassword.length < 1}
              onClick={() => {
                setInviteOpen(false);
                void run(
                  "invite",
                  () =>
                    doInvite({
                      data: {
                        email: invEmail.trim(),
                        full_name: invName.trim(),
                        password: invPassword,
                        role: invRole,
                        employeeId: invEmployee === "none" ? null : invEmployee,
                      },
                    }),
                  "تم إنشاء الحساب",
                );
              }}
            >
              إنشاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ربط بموظف */}
      <Dialog open={!!linkTarget} onOpenChange={(o) => !o && setLinkTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ربط الحساب بموظف</DialogTitle>
            <DialogDescription>{linkTarget?.email}</DialogDescription>
          </DialogHeader>
          <Select value={linkEmployee} onValueChange={setLinkEmployee}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون ربط</SelectItem>
              {employees
                .filter((e) => !e.user_id || e.id === linkTarget?.employee_id)
                .map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name} ({e.employee_no})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkTarget(null)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                const target = linkTarget;
                if (!target) return;
                const employeeId = linkEmployee === "none" ? null : linkEmployee;
                setLinkTarget(null);
                void run(
                  target.id,
                  () => doLink({ data: { userId: target.id, employeeId } }),
                  "تم تحديث الربط",
                );
              }}
            >
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* الأدوار */}
      <Dialog open={!!rolesTarget} onOpenChange={(o) => !o && setRolesTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>أدوار وصلاحيات المستخدم</DialogTitle>
            <DialogDescription>{rolesTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {ALL_ROLES.map((r) => (
              <label
                key={r.value}
                className="flex items-center gap-3 rounded-md border p-3 text-sm"
              >
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

      {/* كلمة المرور */}
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
