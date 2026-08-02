export type ApprovalStage =
  | "draft"
  | "pending_manager"
  | "pending_hr"
  | "pending_director"
  | "approved"
  | "returned";

export const STAGE_LABELS: Record<ApprovalStage, string> = {
  draft: "مسودة",
  pending_manager: "بانتظار المدير المباشر",
  pending_hr: "بانتظار الموارد البشرية",
  pending_director: "بانتظار المدير التنفيذي",
  approved: "معتمد نهائياً",
  returned: "مُعاد للتعديل",
};

export const STAGE_ORDER: ApprovalStage[] = [
  "pending_manager",
  "pending_hr",
  "pending_director",
  "approved",
];

export const STAGE_STEP_LABELS: { stage: ApprovalStage; label: string }[] = [
  { stage: "pending_manager", label: "المدير المباشر" },
  { stage: "pending_hr", label: "الموارد البشرية" },
  { stage: "pending_director", label: "المدير التنفيذي" },
];

/** Is the stage step already completed for an evaluation at `current` stage? */
export function stepDone(step: ApprovalStage, current: ApprovalStage) {
  if (current === "approved") return true;
  const ci = STAGE_ORDER.indexOf(current);
  const si = STAGE_ORDER.indexOf(step);
  return ci > -1 && si > -1 && si < ci;
}

export function canActOnStage(
  stage: ApprovalStage,
  actor: { isManager: boolean; isHR: boolean; isDirector: boolean },
) {
  if (stage === "pending_manager") return actor.isManager || actor.isDirector;
  if (stage === "pending_hr") return actor.isHR;
  if (stage === "pending_director") return actor.isDirector;
  return false;
}

export function stageBadgeVariant(stage: ApprovalStage): "default" | "secondary" | "outline" | "destructive" {
  if (stage === "approved") return "default";
  if (stage === "returned") return "destructive";
  if (stage === "draft") return "outline";
  return "secondary";
}
