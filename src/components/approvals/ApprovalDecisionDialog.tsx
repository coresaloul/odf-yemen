import { useState } from "react";
import { Check, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { PendingApproval } from "@/lib/approvals";
import { APPROVAL_KIND_LABELS, waitingLabel } from "@/lib/approvals";
import { STAGE_LABELS } from "@/lib/evaluation-approval";
import { useApprovalDecision } from "./useApprovals";

export function ApprovalDecisionDialog({
  item,
  onOpenChange,
}: {
  item: PendingApproval | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const decide = useApprovalDecision(() => {
    setNote("");
    onOpenChange(false);
  });

  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => {
        if (!o) setNote("");
        onOpenChange(o);
      }}
    >
      <DialogContent dir="rtl" className="max-w-lg">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base leading-relaxed">{item.title}</DialogTitle>
              <DialogDescription>
                {item.employeeName} — {item.departmentName}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{APPROVAL_KIND_LABELS[item.kind]}</Badge>
              <Badge variant="outline">{STAGE_LABELS[item.stage] ?? item.stage}</Badge>
              <span className="text-xs text-muted-foreground">{waitingLabel(item.since)}</span>
            </div>

            <dl className="divide-y rounded-lg border text-sm">
              {item.details.map((d) => (
                <div key={d.label} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2 px-3 py-2">
                  <dt className="text-muted-foreground">{d.label}</dt>
                  <dd className="min-w-0 break-words">{d.value || "—"}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-1.5">
              <Label htmlFor="approval-note">ملاحظة القرار (إلزامية عند الإعادة)</Label>
              <Textarea
                id="approval-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="اكتب ملاحظتك…"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1 gap-2"
                disabled={decide.isPending}
                onClick={() =>
                  decide.mutate({ item, action: "approved", ...(note.trim() ? { note: note.trim() } : {}) })
                }
              >
                <Check className="size-4" />
                اعتماد
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled={decide.isPending || !note.trim()}
                onClick={() =>
                  decide.mutate({ item, action: "returned", note: note.trim() })
                }
              >
                <Undo2 className="size-4" />
                إعادة للتعديل
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
