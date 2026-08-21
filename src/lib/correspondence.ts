export type CorrespondenceDirection = "incoming" | "outgoing";
export type CorrespondenceStatus =
  | "draft"
  | "registered"
  | "in_progress"
  | "waiting_response"
  | "completed"
  | "closed"
  | "cancelled";
export type CorrespondencePriority = "low" | "normal" | "high" | "urgent";

export type CorrespondenceRow = {
  id: string;
  reference_no: string | null;
  direction: CorrespondenceDirection;
  subject: string;
  body: string | null;
  sender_name: string | null;
  recipient_name: string | null;
  external_reference: string | null;
  correspondence_date: string;
  due_date: string | null;
  priority: CorrespondencePriority;
  confidentiality: string;
  status: CorrespondenceStatus;
  assigned_to: string | null;
  assigned_name?: string | null;
  creator_name?: string | null;
  created_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const CORRESPONDENCE_STATUS_LABELS: Record<CorrespondenceStatus, string> = {
  draft: "مسودة",
  registered: "مسجلة",
  in_progress: "قيد الإجراء",
  waiting_response: "بانتظار الرد",
  completed: "منجزة",
  closed: "مغلقة",
  cancelled: "ملغاة",
};

export const CORRESPONDENCE_PRIORITY_LABELS: Record<CorrespondencePriority, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};
