import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Loader2, UserPlus } from "lucide-react";
import { provisionEmployeeAccounts, type ProvisionResult } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STATUS_LABELS: Record<ProvisionResult["status"], string> = {
  created: "تم إنشاء حساب",
  linked: "تم الربط بحساب موجود",
  already_linked: "مرتبط مسبقاً",
  skipped_no_email: "بدون بريد إلكتروني",
  error: "خطأ",
};

type Props = {
  /** عند تمريره يتم ربط هؤلاء الموظفين فقط */
  employeeIds?: string[];
  triggerLabel?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
  onDone?: () => void;
};

export function EmployeeAccountsDialog({
  employeeIds,
  triggerLabel = "ربط الموظفين بالمستخدمين",
  variant = "outline",
  size = "default",
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ProvisionResult[] | null>(null);
  const provision = useServerFn(provisionEmployeeAccounts);

  const run = useMutation({
    mutationFn: async () => provision({ data: { employeeIds } }),
    onSuccess: (data) => {
      setResults(data);
      const created = data.filter((r) => r.status === "created").length;
      const linked = data.filter((r) => r.status === "linked").length;
      toast.success(`تم إنشاء ${created} حساب وربط ${linked} حساب موجود`);
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setResults(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-2">
          <UserPlus className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>ربط الموظفين بحسابات المستخدمين</DialogTitle>
          <DialogDescription>
            يتم إنشاء حساب مستخدم لكل موظف لديه بريد إلكتروني وغير مرتبط بحساب، بدور «موظف»
            افتراضياً مع تأكيد البريد تلقائياً. الموظفون الذين لديهم حساب بنفس البريد يتم ربطهم به.
          </DialogDescription>
        </DialogHeader>

        {results && (
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3">
            {results.length === 0 && (
              <p className="text-sm text-muted-foreground">لا يوجد موظفون بحاجة إلى ربط.</p>
            )}
            {results.map((r) => (
              <div key={r.employeeId} className="rounded-md bg-muted/40 p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.full_name}</span>
                  <Badge variant={r.status === "error" ? "destructive" : "secondary"}>
                    {STATUS_LABELS[r.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.email ?? "—"}</p>
                {r.password && (
                  <p className="mt-1 flex items-center gap-1 font-mono text-xs">
                    <KeyRound className="size-3" /> كلمة المرور المؤقتة: {r.password}
                  </p>
                )}
                {r.message && <p className="text-xs text-destructive">{r.message}</p>}
              </div>
            ))}
            {results.some((r) => r.password) && (
              <p className="text-xs text-muted-foreground">
                احفظ كلمات المرور المؤقتة الآن — لن تظهر مرة أخرى.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            إغلاق
          </Button>
          <Button onClick={() => run.mutate()} disabled={run.isPending} className="gap-2">
            {run.isPending && <Loader2 className="size-4 animate-spin" />}
            {results ? "تنفيذ مرة أخرى" : "تنفيذ الربط"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
