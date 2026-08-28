import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { APPROVAL_KIND_LABELS, waitingLabel } from "@/lib/approvals";
import type { PendingApproval } from "@/lib/approvals";
import { usePendingApprovals } from "./useApprovals";
import { ApprovalDecisionDialog } from "./ApprovalDecisionDialog";

export function ApprovalsPopover() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PendingApproval | null>(null);
  const { data = [] } = usePendingApprovals();

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative shrink-0" aria-label="الموافقات">
            <ClipboardCheck className="size-5" />
            {data.length > 0 && (
              <span className="absolute -top-0.5 -left-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {data.length > 99 ? "99+" : data.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent dir="rtl" align="end" className="w-80 max-w-[calc(100vw-1.5rem)] p-0 shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">طلبات بانتظار قرارك</p>
            <Badge variant="secondary">{data.length}</Badge>
          </div>
          <ScrollArea className="max-h-80">
            {data.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                لا توجد طلبات معلّقة
              </p>
            ) : (
              <ul className="divide-y">
                {data.slice(0, 12).map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 text-right transition-colors hover:bg-muted/60"
                      onClick={() => {
                        setSelected(item);
                        setOpen(false);
                      }}
                    >
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.employeeName} — {APPROVAL_KIND_LABELS[item.kind]} · {waitingLabel(item.since)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
          <div className="border-t p-2">
            <Button asChild variant="secondary" size="sm" className="w-full">
              <Link to="/approvals" onClick={() => setOpen(false)}>
                فتح مركز الموافقات
              </Link>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ApprovalDecisionDialog item={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}
