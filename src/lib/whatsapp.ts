/** إعدادات مرسل رسائل واتساب الخاصة بالنظام */
export const WHATSAPP_SENDER_NAME = "نظام ادارة الموارد والمهام";
export const WHATSAPP_SENDER_PHONE = "+967774240056";

/** ينظّف الرقم من المسافات والرموز مع إبقائه كما هو (بدون إضافة مفتاح دولة) */
export function normalizeWhatsAppPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 8 ? digits : null;
}

export function buildTaskDetailsUrl(taskId?: string | null | undefined) {
  if (!taskId) return null;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/tasks/${taskId}`.replace(/\/+$/, "");
}

function signature(taskId?: string | null | undefined) {
  const taskUrl = buildTaskDetailsUrl(taskId);
  if (!taskUrl) return `\n\n— ${WHATSAPP_SENDER_NAME}`;
  return `\n\n— ${WHATSAPP_SENDER_NAME}\nرابط المهمة: ${taskUrl}`;
}

export type TaskMessageInput = {
  title: string;
  description?: string | null | undefined;
  priority?: string | null | undefined;
  dueDate?: string | null | undefined;
  assigneeName?: string | null | undefined;
  supervisorName?: string | null | undefined;
  statusLabel?: string | null | undefined;
  progress?: number | null | undefined;
  taskId?: string | null | undefined;
};

export function buildTaskAssignedMessage(t: TaskMessageInput) {
  const lines = [
    `مرحباً ${t.assigneeName ?? ""}`.trim(),
    "تم تكليفك بمهمة جديدة:",
    `• المهمة: ${t.title}`,
  ];
  if (t.description) lines.push(`• الوصف: ${t.description}`);
  if (t.priority) lines.push(`• الأولوية: ${t.priority}`);
  if (t.dueDate) lines.push(`• تاريخ الاستحقاق: ${t.dueDate}`);
  if (t.supervisorName) lines.push(`• المشرف على المهمة: ${t.supervisorName}`);
  return lines.join("\n") + signature(t.taskId);
}

export function buildTaskUpdatedMessage(t: TaskMessageInput) {
  const lines = [
    `مرحباً ${t.assigneeName ?? ""}`.trim(),
    "تم تحديث بيانات مهمتك:",
    `• المهمة: ${t.title}`,
  ];
  if (t.statusLabel) lines.push(`• الحالة: ${t.statusLabel}`);
  if (typeof t.progress === "number") lines.push(`• نسبة الإنجاز: ${t.progress}%`);
  if (t.dueDate) lines.push(`• تاريخ الاستحقاق: ${t.dueDate}`);
  if (t.supervisorName) lines.push(`• المشرف على المهمة: ${t.supervisorName}`);
  return lines.join("\n") + signature(t.taskId);
}

export function waLink(phone: string | null | undefined, message: string) {
  const to = normalizeWhatsAppPhone(phone);
  if (!to) return null;
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

/** يفتح محادثات واتساب للأرقام المحددة (نافذة لكل رقم) */
export function openWhatsApp(targets: { phone: string | null | undefined; message: string }[]) {
  const links = targets
    .map((t) => waLink(t.phone, t.message))
    .filter((l): l is string => Boolean(l));
  for (const link of links) window.open(link, "_blank", "noopener,noreferrer");
  return links.length;
}
