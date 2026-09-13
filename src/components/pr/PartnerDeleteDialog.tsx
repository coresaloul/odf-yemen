import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import type { PartnerRow } from "@/lib/pr-crm";

export function PartnerDeleteDialog({
  open,
  onOpenChange,
  partner,
  isDeleting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: PartnerRow | null;
  isDeleting: boolean;
  onConfirm: () => Promise<void>;
}) {
  if (!partner) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <AlertDialogTitle>حذف الشريك / المانح</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2 text-right pt-2">
            <div>
              هل أنت متأكد من رغبتك في حذف الشريك:{" "}
              <span className="font-bold text-foreground">{partner.name}</span>؟
            </div>
            <div className="text-xs text-muted-foreground p-3 rounded-lg bg-destructive/5 border border-destructive/20 leading-relaxed">
              ⚠️ تنبيه: سيؤدي حذف هذا الشريك إلى حذف كافة التفاعلات واللقاءات والمقترحات ومذكرات التفاهم المرتبطة به تلقائياً. لا يمكن التراجع عن هذا الإجراء.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isDeleting ? "جاري الحذف..." : "تأكيد الحذف"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
