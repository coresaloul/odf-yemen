import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Loader2, Wand2 } from "lucide-react";
import { matchUsersToEmployees, type MatchResult } from "@/lib/admin-users.functions";
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

export function UserEmployeeMatchDialog({ onDone }: { onDone?: () => void }) {
  const run = useServerFn(matchUsersToEmployees);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [busy, setBusy] = useState(false);

  const execute = async (apply: boolean) => {
    setBusy(true);
    try {
      const data = await run({ data: { apply } });
      setResult(data);
      if (apply) {
        toast.success(`تم ربط ${data.applied} حساب بموظفيهم`);
        onDone?.();
      } else {
        toast.info(`تم العثور على ${data.matches.length} تطابق`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Wand2 className="size-4" /> مطابقة تلقائية
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>مطابقة المستخدمين بالموظفين</DialogTitle>
          <DialogDescription>
            يتم الربط بمطابقة البريد الإلكتروني أولاً، ثم رقم الموظف (من بيانات الحساب أو مقطع البريد
            قبل @). الحسابات المرتبطة مسبقاً لا تتأثر، والحسابات بلا دور تُمنح دور «موظف».
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
            {result.matches.length === 0 && (
              <p className="text-muted-foreground">لا توجد تطابقات جديدة.</p>
            )}
            {result.matches.map((m) => (
              <div
                key={m.employeeId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2"
              >
                <div>
                  <p className="font-medium">
                    {m.full_name} <span className="text-xs text-muted-foreground">({m.employee_no})</span>
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Link2 className="size-3" /> {m.userEmail ?? "—"}
                  </p>
                </div>
                <Badge variant="secondary">
                  {m.matchedBy === "email" ? "بالبريد" : "برقم الموظف"}
                </Badge>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              بلا تطابق: {result.unmatchedEmployees.length} موظف · {result.unmatchedUsers.length}{" "}
              حساب مستخدم
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            إغلاق
          </Button>
          <Button variant="outline" onClick={() => void execute(false)} disabled={busy}>
            {busy && <Loader2 className="ml-2 size-4 animate-spin" />}
            معاينة
          </Button>
          <Button onClick={() => void execute(true)} disabled={busy}>
            تنفيذ الربط
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
