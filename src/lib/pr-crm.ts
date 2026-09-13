export type PartnerType =
  | "international_ngo"
  | "private_csr"
  | "business_merchant"
  | "government"
  | "individual_donor";

export type PartnerStatus = "prospect" | "active" | "dormant" | "inactive";

export type PartnerRow = {
  id: string;
  name: string;
  type: PartnerType;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  interest_level: number;
  influence_level: number;
  status: PartnerStatus;
  notes: string | null;
  assigned_employee_id: string | null;
  assigned_employee_name?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InteractionType =
  | "meeting"
  | "field_visit"
  | "phone_call"
  | "email"
  | "event";

export type InteractionRow = {
  id: string;
  partner_id: string;
  partner_name?: string;
  interaction_type: InteractionType;
  title: string;
  interaction_date: string;
  location: string | null;
  summary: string | null;
  minutes: string | null;
  attendees: string | null;
  next_action: string | null;
  task_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type AgreementType =
  | "mou"
  | "partnership_contract"
  | "grant_agreement"
  | "sponsorship";

export type AgreementStatus =
  | "draft"
  | "active"
  | "expiring_soon"
  | "expired"
  | "renewed";

export type AgreementRow = {
  id: string;
  partner_id: string;
  partner_name?: string;
  reference_no: string | null;
  title: string;
  agreement_type: AgreementType;
  start_date: string;
  end_date: string | null;
  total_value: number;
  currency: string;
  document_url: string | null;
  status: AgreementStatus;
  renewal_task_id: string | null;
  assigned_employee_id: string | null;
  assigned_employee_name?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GrantSector =
  | "education"
  | "vocational_training"
  | "healthcare"
  | "social_sponsorship"
  | "relief"
  | "infrastructure";

export type GrantStage =
  | "opportunity"
  | "concept_note"
  | "full_proposal"
  | "under_review"
  | "awarded"
  | "rejected";

export type GrantOpportunityRow = {
  id: string;
  partner_id: string;
  partner_name?: string;
  project_title: string;
  target_sector: GrantSector;
  stage: GrantStage;
  estimated_amount: number;
  currency: string;
  submission_deadline: string | null;
  decision_date: string | null;
  lead_writer_id: string | null;
  lead_writer_name?: string | null;
  task_id: string | null;
  concept_summary: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DonationType =
  | "cash"
  | "in_kind_equipment"
  | "in_kind_materials"
  | "services";

export type DonationRow = {
  id: string;
  partner_id: string;
  partner_name?: string;
  grant_opportunity_id: string | null;
  donation_type: DonationType;
  amount: number;
  currency: string;
  in_kind_description: string | null;
  target_project: string;
  received_date: string;
  receipt_no: string | null;
  thank_you_task_id: string | null;
  notes: string | null;
  created_at: string;
};

export type TrancheStatus = "scheduled" | "due_soon" | "received" | "overdue";

export type PaymentTrancheRow = {
  id: string;
  agreement_id: string | null;
  partner_id: string;
  partner_name?: string;
  agreement_title?: string;
  tranche_number: number;
  due_date: string;
  amount: number;
  currency: string;
  condition_milestone: string | null;
  status: TrancheStatus;
  report_task_id: string | null;
  notes: string | null;
  created_at: string;
};

export type EventType =
  | "graduation"
  | "workshop_exhibition"
  | "annual_bazaar"
  | "press_conference"
  | "success_story_coverage"
  | "general_event";

export type EventStatus = "planned" | "in_progress" | "completed" | "cancelled";

export type EventRow = {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string;
  location: string | null;
  budget: number;
  target_audience: string | null;
  media_links: string | null;
  coordinator_id: string | null;
  coordinator_name?: string | null;
  status: EventStatus;
  notes: string | null;
  created_at: string;
};

/* ────────────────────────── التسميات والخيارات ────────────────────────── */

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  international_ngo: "منظمة دولية / أممية",
  private_csr: "قطاع خاص / مسؤولية مجتمعية",
  business_merchant: "تجار ورجال أعمال",
  government: "جهة حكومية / رسمية",
  individual_donor: "متبرع فردي / فاعل خير",
};

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  prospect: "مستكشف / محتمل",
  active: "نشط وداعم",
  dormant: "خامل / يحتاج تواصل",
  inactive: "متوقف",
};

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  meeting: "اجتماع رسمي",
  field_visit: "زيارة ميدانية للمراكز والورش",
  phone_call: "مكالمة هاتفية",
  email: "مراسلة بريدية",
  event: "حضور فعالية / مؤتمر",
};

export const AGREEMENT_TYPE_LABELS: Record<AgreementType, string> = {
  mou: "مذكرة تفاهم (MoU)",
  partnership_contract: "عقد شراكة تنفيذية",
  grant_agreement: "اتفاقية منحة وتمويل",
  sponsorship: "بروتوكول رعاية وكفالات",
};

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  draft: "مسودة",
  active: "سارية",
  expiring_soon: "تنتهي قريباً (أقل من 30 يوماً)",
  expired: "منتهية",
  renewed: "تم التجديد",
};

export const GRANT_SECTOR_LABELS: Record<GrantSector, string> = {
  education: "التعليم ورعاية الطلاب الأيتام",
  vocational_training: "التدريب المهني والحرفي",
  healthcare: "الرعاية الصحية والعلاج",
  social_sponsorship: "الكفالات النقدية ورعاية الأسر",
  relief: "الإغاثة والمساعدات الغذائية",
  infrastructure: "تجهيز الورش والمعامل الحرفية",
};

export const GRANT_STAGE_LABELS: Record<GrantStage, string> = {
  opportunity: "فرصة جديدة (Opportunity)",
  concept_note: "ورقة مفاهيم (Concept Note)",
  full_proposal: "مقترح كامل (Full Proposal)",
  under_review: "قيد المراجعة لدى المانح",
  awarded: "تمويل معتمد (Awarded)",
  rejected: "غير معتمد (Rejected)",
};

export const GRANT_STAGES: GrantStage[] = [
  "opportunity",
  "concept_note",
  "full_proposal",
  "under_review",
  "awarded",
  "rejected",
];

export const DONATION_TYPE_LABELS: Record<DonationType, string> = {
  cash: "تبرع نقدي",
  in_kind_equipment: "أجهزة ومعدات ورش ومعامل",
  in_kind_materials: "مواد خام ومستلزمات تدريب",
  services: "رعاية خدماتية وتدريب",
};

export const TRANCHE_STATUS_LABELS: Record<TrancheStatus, string> = {
  scheduled: "مجدولة",
  due_soon: "تستحق قريباً",
  received: "مستلمة",
  overdue: "متأخرة",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  graduation: "حفل تخرج وتكريم الأيتام",
  workshop_exhibition: "معرض منتجات الورش الحرفية",
  annual_bazaar: "البازار الخيري السنوي",
  press_conference: "مؤتمر صحفي وإعلامي",
  success_story_coverage: "تغطية قصة نجاح خريج",
  general_event: "فعالية / لقاء عام",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  planned: "مخططة",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة وموثقة",
  cancelled: "ملغاة",
};

/* ────────────────────────── دوال مساعدة لحساب المؤشرات ────────────────────────── */

/**
 * حساب مؤشر تفاعل المانح (Donor Engagement Health Score)
 * من 0 إلى 100 بناءً على:
 * - مستوى التأثير والاهتمام
 * - حداثة آخر تواصل
 * - وجود تبرعات أو اتفاقيات سارية
 */
export function calculateDonorHealth(partner: PartnerRow, lastInteractionDate?: string | null): {
  score: number;
  level: "strong" | "warm" | "cold" | "at_risk";
  label: string;
  color: string;
} {
  let score = 50;
  // إضافة وزن التأثير والاهتمام
  score += (partner.interest_level + partner.influence_level) * 3;

  if (partner.status === "active") score += 15;
  else if (partner.status === "dormant") score -= 15;
  else if (partner.status === "inactive") score -= 30;

  if (lastInteractionDate) {
    const days = Math.floor((Date.now() - new Date(lastInteractionDate).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 30) score += 15;
    else if (days > 90) score -= 20;
    else if (days > 180) score -= 35;
  } else {
    score -= 10;
  }

  score = Math.max(10, Math.min(100, score));

  if (score >= 75) {
    return { score, level: "strong", label: "علاقة قوية ومستدامة", color: "text-emerald-600 dark:text-emerald-400" };
  } else if (score >= 50) {
    return { score, level: "warm", label: "علاقة نشطة / دافئة", color: "text-blue-600 dark:text-blue-400" };
  } else if (score >= 35) {
    return { score, level: "cold", label: "علاقة باردة (تحتاج تواصل)", color: "text-amber-600 dark:text-amber-400" };
  } else {
    return { score, level: "at_risk", label: "في خطر الفقدان", color: "text-rose-600 dark:text-rose-400" };
  }
}
