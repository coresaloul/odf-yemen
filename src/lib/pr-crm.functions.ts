import { supabase } from "@/integrations/supabase/client";
import type {
  AgreementRow,
  DonationRow,
  EventRow,
  GrantOpportunityRow,
  InteractionRow,
  PartnerRow,
  PaymentTrancheRow,
} from "./pr-crm";
import {
  INTERACTION_TYPE_LABELS,
  PARTNER_TYPE_LABELS,
} from "./pr-crm";

export type CreateTaskPayload = {
  title: string;
  description?: string | null;
  assignee_id: string;
  priority?: "low" | "medium" | "high" | "urgent";
  start_date?: string;
  due_date?: string | null;
  weight?: number;
  supervisor_id?: string | null;
};

/**
 * دالة مركزية لإنشاء مهمة مرتبطة بحدث علاقات عامة في جدول المهام العام
 */
export async function createPrTask(payload: CreateTaskPayload): Promise<string> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: payload.title.trim(),
      description: payload.description || null,
      assignee_id: payload.assignee_id,
      priority: payload.priority || "medium",
      status: "new",
      start_date: payload.start_date || new Date().toISOString().slice(0, 10),
      due_date: payload.due_date || null,
      weight: payload.weight || 1,
      progress: 0,
      supervisor_id: payload.supervisor_id || null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * تسجيل تبرع جديد مع التوليد التلقائي لمهمة الشكر والإيصال
 */
export async function recordDonationWithSync(
  donation: Omit<DonationRow, "id" | "created_at" | "thank_you_task_id">,
  partnerName: string,
  autoCreateThankYouTask = true,
  responsibleEmployeeId?: string | null
): Promise<string> {
  let thankYouTaskId: string | null = null;

  if (autoCreateThankYouTask && responsibleEmployeeId) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2); // استحقاق خلال 48 ساعة

    const amountFormatted = donation.donation_type === "cash" 
      ? `${Number(donation.amount).toLocaleString()} ${donation.currency}`
      : `منحة عينية: ${donation.in_kind_description || ""}`;

    thankYouTaskId = await createPrTask({
      title: `إرسال رسالة شكر وإيصال رسمي للمتبرع: ${partnerName}`,
      description: `تم تسجيل تبرع جديد (${amountFormatted}) لصالح مشروع: "${donation.target_project}".\nيرجى تجهيز خطاب الشكر وسند الاستلام الرسمي وإرساله للمانح وتوثيق الأرشيف في النظام.`,
      assignee_id: responsibleEmployeeId,
      priority: "urgent",
      due_date: dueDate.toISOString().slice(0, 10),
      weight: 2,
    });
  }

  const { data, error } = await supabase
    .from("pr_donations")
    .insert({
      ...donation,
      thank_you_task_id: thankYouTaskId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * جدولة دفعة مانح مع التوليد التلقائي لمهمة إعداد التقرير المالي والفني
 */
export async function scheduleTrancheWithSync(
  tranche: Omit<PaymentTrancheRow, "id" | "created_at" | "report_task_id">,
  partnerName: string,
  autoCreateReportTask = true,
  responsibleEmployeeId?: string | null
): Promise<string> {
  let reportTaskId: string | null = null;

  if (autoCreateReportTask && responsibleEmployeeId && tranche.due_date) {
    // تاريخ استحقاق المهمة قبل موعد الدفعة بـ 7 أيام
    const trancheDate = new Date(tranche.due_date);
    trancheDate.setDate(trancheDate.getDate() - 7);
    const taskDueDate = trancheDate.toISOString().slice(0, 10);

    reportTaskId = await createPrTask({
      title: `إعداد التقرير المالي والفني للدفعة ${tranche.tranche_number} - الشريك: ${partnerName}`,
      description: `استحقاق الدفعة رقم (${tranche.tranche_number}) بقيمة (${Number(tranche.amount).toLocaleString()} ${tranche.currency}) بتاريخ ${tranche.due_date}.\nالشرط المرتبط: ${tranche.condition_milestone || "لا يوجد"}.\nيرجى تجهيز ورفع التقرير المالي والفني وتقرير الإنجاز للمانح لضمان تحويل الدفعة في موعدها.`,
      assignee_id: responsibleEmployeeId,
      priority: "high",
      due_date: taskDueDate,
      weight: 4,
    });
  }

  const { data, error } = await supabase
    .from("pr_payment_tranches")
    .insert({
      ...tranche,
      report_task_id: reportTaskId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * تسجيل تفاعل أو زيارة ميدانية لمراكز الأيتام مع إمكانية تحويلها لـ مهمة في التقويم ولوحة المهام
 */
export async function recordInteractionWithSync(
  interaction: Omit<InteractionRow, "id" | "created_at" | "task_id">,
  partnerName: string,
  createTask = false,
  assignedEmployeeId?: string | null
): Promise<string> {
  let taskId: string | null = null;

  if (createTask && assignedEmployeeId) {
    const typeLabel = INTERACTION_TYPE_LABELS[interaction.interaction_type] || "نشاط";
    taskId = await createPrTask({
      title: `${typeLabel}: ${interaction.title} - ${partnerName}`,
      description: `المكان: ${interaction.location || "مقر المؤسسة"}\nالتاريخ: ${interaction.interaction_date}\nالمشاركون: ${interaction.attendees || ""}\nالإجراء التالي المطلوب: ${interaction.next_action || ""}`,
      assignee_id: assignedEmployeeId,
      priority: interaction.interaction_type === "field_visit" ? "urgent" : "medium",
      start_date: interaction.interaction_date,
      due_date: interaction.interaction_date,
      weight: interaction.interaction_type === "field_visit" ? 3 : 1,
    });
  }

  const { data, error } = await supabase
    .from("pr_interactions")
    .insert({
      ...interaction,
      task_id: taskId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * فحص وتوليد مهام تجديد الاتفاقيات ومذكرات التفاهم التي تنتهي خلال 30 يوماً
 */
export async function checkAndSyncExpiringAgreements(
  unitHeadEmployeeId: string
): Promise<number> {
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in30DaysIso = in30Days.toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: expiring, error } = await supabase
    .from("pr_agreements")
    .select("id, title, partner_id, end_date, renewal_task_id, pr_partners(name)")
    .eq("status", "active")
    .is("renewal_task_id", null)
    .not("end_date", "is", null)
    .gte("end_date", todayIso)
    .lte("end_date", in30DaysIso);

  if (error || !expiring) return 0;

  let createdCount = 0;
  for (const ag of expiring as any[]) {
    const partnerName = ag.pr_partners?.name || "الجهة الشريكة";
    try {
      const taskId = await createPrTask({
        title: `تجديد ومراجعة مذكرة التفاهم مع الشريك: ${partnerName}`,
        description: `تنتهي الاتفاقية بعنوان "${ag.title}" بتاريخ ${ag.end_date}.\nيرجى إعداد تقرير ختامي للشراكة ومراجعة بنود التجديد والتواصل مع الشريك لرفع التوصية لمدير العلاقات العامة.`,
        assignee_id: unitHeadEmployeeId,
        priority: "high",
        due_date: ag.end_date,
        weight: 3,
      });

      await supabase
        .from("pr_agreements")
        .update({
          renewal_task_id: taskId,
          status: "expiring_soon",
        })
        .eq("id", ag.id);

      createdCount++;
    } catch {
      // استمرار لبقية الاتفاقيات
    }
  }

  return createdCount;
}
