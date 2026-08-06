import type { ApprovalStage } from "@/lib/evaluation-approval";

export type RequestFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "select"
  | "boolean";

export type RequestField = {
  key: string;
  label: string;
  type: RequestFieldType;
  required?: boolean | undefined;
  options?: string[] | undefined;
};

export type RequestFlowStep = "manager" | "hr" | "director";

export type HrRequestType = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  fields: RequestField[];
  approval_flow: RequestFlowStep[];
  is_confidential: boolean;
  active: boolean;
  sort_order: number;
};

export type HrRequestRow = {
  id: string;
  employee_id: string;
  type_id: string;
  title: string;
  values: Record<string, string | number | boolean | null>;
  stage: ApprovalStage;
  return_reason: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  employee_name: string;
  department_name: string;
  type_name: string;
  type_category: string;
  fields: RequestField[];
};

export const FLOW_STAGE: Record<RequestFlowStep, ApprovalStage> = {
  manager: "pending_manager",
  hr: "pending_hr",
  director: "pending_director",
};

export const FLOW_LABELS: Record<RequestFlowStep, string> = {
  manager: "المدير المباشر",
  hr: "الموارد البشرية",
  director: "المدير التنفيذي",
};

export function nextStage(flow: RequestFlowStep[], current: ApprovalStage): ApprovalStage {
  const stages = flow.map((f) => FLOW_STAGE[f]);
  if (current === "draft" || current === "returned") return stages[0] ?? "approved";
  const idx = stages.indexOf(current);
  return stages[idx + 1] ?? "approved";
}

export function formatFieldValue(field: RequestField, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "boolean") return value ? "نعم" : "لا";
  return String(value);
}
