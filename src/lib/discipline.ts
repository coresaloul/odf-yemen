import type { ApprovalStage } from "@/lib/evaluation-approval";
import type { RequestFlowStep } from "@/lib/hr-requests";

export type DisciplineKind = "recognition" | "sanction";

export const DISCIPLINE_KIND_LABELS: Record<DisciplineKind, string> = {
  recognition: "تكريم ومكافأة",
  sanction: "جزاء تأديبي",
};

export type DisciplinaryType = {
  id: string;
  code: string;
  name: string;
  kind: DisciplineKind;
  degree: number;
  description: string | null;
  max_days: number;
  requires_amount: boolean;
  erase_months: number;
  approval_flow: RequestFlowStep[];
  active: boolean;
  sort_order: number;
};

export type DisciplineRecord = {
  id: string;
  kind: DisciplineKind;
  employee_id: string;
  employee_name: string;
  department_name: string;
  type_id: string;
  type_name: string;
  degree: number;
  title: string;
  /** الجزاءات: وصف المخالفة — التكريم: سبب التكريم */
  reason: string | null;
  violation_date: string | null;
  discovered_date: string | null;
  award_date: string | null;
  employee_statement: string | null;
  penalty_days: number;
  amount: number;
  target_month: string | null;
  attachment_url: string | null;
  stage: ApprovalStage;
  return_reason: string | null;
  submitted_at: string | null;
  erase_at: string | null;
  erased: boolean;
  appeal_note: string | null;
  appeal_status: "none" | "submitted" | "accepted" | "rejected";
  appeal_decision_note: string | null;
  created_at: string;
};

export const APPEAL_STATUS_LABELS: Record<string, string> = {
  none: "لا يوجد تظلّم",
  submitted: "تظلّم قيد النظر",
  accepted: "تظلّم مقبول",
  rejected: "تظلّم مرفوض",
};

/** الحد الشهري للخصم التأديبي وفق قانون العمل: أجر خمسة أيام */
export const MONTHLY_DEDUCTION_DAYS_CAP = 5;

export function monthKey(value: string | Date = new Date()) {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function isActiveSanction(r: DisciplineRecord, today = new Date()) {
  if (r.kind !== "sanction" || r.stage !== "approved" || r.erased) return false;
  if (r.appeal_status === "accepted") return false;
  if (!r.erase_at) return true;
  return new Date(r.erase_at) >= today;
}

/** الدرجة التالية المقترحة حسب السجل الفعّال للموظف */
export function suggestNextDegree(activeSanctions: DisciplineRecord[]) {
  const max = activeSanctions.reduce((m, r) => Math.max(m, r.degree), 0);
  return Math.min(max + 1, 7);
}
