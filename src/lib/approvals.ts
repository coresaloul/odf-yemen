import type { ApprovalStage } from "@/lib/evaluation-approval";

export type ApprovalKind =
  | "leave"
  | "evaluation"
  | "task"
  | "attendance_correction"
  | "hr_request"
  | "custody";

export const APPROVAL_KIND_LABELS: Record<ApprovalKind, string> = {
  leave: "طلب إجازة",
  evaluation: "تقرير تقييم أداء",
  task: "مهمة منجزة",
  attendance_correction: "تصحيح حضور",
  hr_request: "طلب موارد بشرية",
  custody: "عهدة",
};


export const CORRECTION_TYPE_LABELS: Record<string, string> = {
  missing_check_in: "نسيان بصمة الدخول",
  missing_check_out: "نسيان بصمة الخروج",
  device_error: "خطأ في جهاز البصمة",
  permission: "إذن مسبق",
  field_work: "مهمة خارجية / عمل ميداني",
};

export const CORRECTION_TYPES = Object.keys(CORRECTION_TYPE_LABELS);

export type PendingApproval = {
  kind: ApprovalKind;
  id: string;
  stage: ApprovalStage;
  title: string;
  summary: string;
  employeeId: string | null;
  employeeName: string;
  departmentId: string | null;
  departmentName: string;
  since: string;
  details: { label: string; value: string }[];
};

export function waitingDays(since: string) {
  const ms = Date.now() - new Date(since).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function waitingLabel(since: string) {
  const days = waitingDays(since);
  if (days === 0) return "اليوم";
  if (days === 1) return "منذ يوم";
  if (days === 2) return "منذ يومين";
  if (days <= 10) return `منذ ${days} أيام`;
  return `منذ ${days} يوماً`;
}
