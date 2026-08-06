export type CustodyKind = "asset" | "vehicle" | "document" | "cash";

export const CUSTODY_KIND_LABELS: Record<CustodyKind, string> = {
  asset: "أصول وأجهزة",
  vehicle: "مركبات",
  document: "وثائق وبطاقات",
  cash: "عهدة مالية",
};

export const CUSTODY_KINDS = Object.keys(CUSTODY_KIND_LABELS) as CustodyKind[];

export type CustodyAssetStatus =
  | "available"
  | "assigned"
  | "maintenance"
  | "damaged"
  | "written_off"
  | "lost";

export const ASSET_STATUS_LABELS: Record<CustodyAssetStatus, string> = {
  available: "متاحة",
  assigned: "مُسلَّمة",
  maintenance: "تحت الصيانة",
  damaged: "تالفة",
  written_off: "مشطوبة",
  lost: "مفقودة",
};

export type CustodyAssignmentStatus =
  | "draft"
  | "pending_manager"
  | "pending_hr"
  | "pending_director"
  | "approved"
  | "handed_over"
  | "returned"
  | "rejected"
  | "cancelled";

export const ASSIGNMENT_STATUS_LABELS: Record<CustodyAssignmentStatus, string> = {
  draft: "مسودة",
  pending_manager: "بانتظار المدير المباشر",
  pending_hr: "بانتظار الموارد البشرية",
  pending_director: "بانتظار المدير التنفيذي",
  approved: "معتمدة — بانتظار التسليم",
  handed_over: "عهدة نشطة",
  returned: "مُرجعة",
  rejected: "مرفوضة",
  cancelled: "ملغاة",
};

export const RETURN_STATE_LABELS: Record<string, string> = {
  good: "سليم",
  damaged: "تالف",
  lost: "مفقود",
};

export const OPEN_ASSIGNMENT_STATUSES: CustodyAssignmentStatus[] = [
  "pending_manager",
  "pending_hr",
  "pending_director",
  "approved",
  "handed_over",
];

export type CustodyAsset = {
  id: string;
  code: string;
  name: string;
  kind: CustodyKind;
  category_id: string | null;
  status: CustodyAssetStatus;
  serial_no: string | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  value: number;
  department_id: string | null;
  location: string | null;
  plate_no: string | null;
  manufacture_year: number | null;
  insurance_expiry: string | null;
  license_expiry: string | null;
  odometer: number | null;
  document_no: string | null;
  document_expiry: string | null;
  notes: string | null;
};

export type CustodyItem = {
  id: string;
  assignment_id: string;
  asset_id: string | null;
  title: string;
  quantity: number;
  condition_out: string | null;
  condition_in: string | null;
  odometer_out: number | null;
  odometer_in: number | null;
  returned_at: string | null;
  return_state: string | null;
  notes: string | null;
};

export type CustodyAssignment = {
  id: string;
  employee_id: string;
  employee_name?: string;
  department_name?: string;
  kind: CustodyKind;
  status: CustodyAssignmentStatus;
  purpose: string | null;
  requested_at: string;
  expected_return_date: string | null;
  handed_over_at: string | null;
  returned_at: string | null;
  cash_amount: number;
  cash_settled: number;
  acknowledged_at: string | null;
  notes: string | null;
  items: CustodyItem[];
  totalValue?: number;
};

export function isOpenAssignment(status: string) {
  return OPEN_ASSIGNMENT_STATUSES.includes(status as CustodyAssignmentStatus);
}

export function isOverdue(a: { expected_return_date: string | null; status: string }) {
  if (!a.expected_return_date || !isOpenAssignment(a.status)) return false;
  return new Date(a.expected_return_date) < new Date(new Date().toDateString());
}

export function daysUntil(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export function cashRemaining(a: { cash_amount: number; cash_settled: number }) {
  return Math.max(0, Number(a.cash_amount) - Number(a.cash_settled));
}
