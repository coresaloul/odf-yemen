import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { PendingApproval } from "@/lib/approvals";
import { listPendingApprovals, decideTaskApproval, decideCorrectionRequest } from "@/lib/approvals.functions";
import { decideLeaveRequest } from "@/lib/leave.functions";
import { decideEvaluation } from "@/lib/evaluation-approval.functions";
import { decideHrRequest } from "@/lib/hr-requests.functions";
import { decideCustodyAssignment } from "@/lib/custody.functions";

export const APPROVALS_KEY = ["pending-approvals"];

export function usePendingApprovals(enabled = true) {
  const fetchFn = useServerFn(listPendingApprovals);
  return useQuery({
    queryKey: APPROVALS_KEY,
    queryFn: async () => (await fetchFn()) as PendingApproval[],
    enabled,
    refetchInterval: 60_000,
  });
}

export type DecisionAction = "approved" | "returned";

export function useApprovalDecision(onDone?: () => void) {
  const qc = useQueryClient();
  const task = useServerFn(decideTaskApproval);
  const correction = useServerFn(decideCorrectionRequest);
  const leave = useServerFn(decideLeaveRequest);
  const evaluation = useServerFn(decideEvaluation);
  const hrRequest = useServerFn(decideHrRequest);
  const custody = useServerFn(decideCustodyAssignment);

  return useMutation({
    mutationFn: async ({
      item,
      action,
      note,
    }: {
      item: PendingApproval;
      action: DecisionAction;
      note?: string;
    }) => {
      const payload = note ? { note } : {};
      switch (item.kind) {
        case "task":
          return task({ data: { taskId: item.id, action, ...payload } });
        case "attendance_correction":
          return correction({ data: { id: item.id, action, ...payload } });
        case "leave":
          return leave({ data: { id: item.id, action, ...payload } });
        case "evaluation":
          return evaluation({ data: { evaluationId: item.id, action, ...payload } });
        case "hr_request":
          return hrRequest({ data: { id: item.id, action, ...payload } });
        case "custody":
          return custody({ data: { id: item.id, action, ...payload } });
      }
    },
    onSuccess: (_r, v) => {
      toast.success(v.action === "approved" ? "تم الاعتماد" : "تمت الإعادة للتعديل");
      void qc.invalidateQueries({ queryKey: APPROVALS_KEY });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["leave-requests"] });
      void qc.invalidateQueries({ queryKey: ["evaluations"] });
      void qc.invalidateQueries({ queryKey: ["correction-requests"] });
      void qc.invalidateQueries({ queryKey: ["hr-requests"] });
      void qc.invalidateQueries({ queryKey: ["custody-assignments"] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
