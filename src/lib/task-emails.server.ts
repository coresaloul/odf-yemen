import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'

const PRIORITY_AR: Record<string, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجلة',
}

const STATUS_AR: Record<string, string> = {
  new: 'جديدة',
  pending: 'جديدة',
  in_progress: 'قيد التنفيذ',
  completed: 'منجزة',
  overdue: 'متأخرة',
  cancelled: 'ملغاة',
}

type EmployeeLite = {
  id: string
  full_name: string
  email: string | null
  user_id: string | null
}

async function loadEmployee(id: string | null): Promise<EmployeeLite | null> {
  if (!id) return null
  const { data } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, email, user_id')
    .eq('id', id)
    .maybeSingle()
  return (data as EmployeeLite | null) ?? null
}

type EmailPrefKey =
  | 'email_task_assigned'
  | 'email_task_status'
  | 'email_task_progress'
  | 'email_evaluation'

async function wantsEmail(userId: string | null, key: EmailPrefKey) {
  if (!userId) return true
  const { data } = await supabaseAdmin
    .from('notification_preferences')
    .select(`email_enabled, ${key}`)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return true
  const row = data as Record<string, boolean>
  return Boolean(row['email_enabled']) && row[key] !== false
}

export async function sendTaskAssignedEmail(taskId: string) {
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('id, title, description, priority, due_date, assignee_id, assigned_by')
    .eq('id', taskId)
    .maybeSingle()
  if (!task) return { sent: false as const, reason: 'task_not_found' }

  const [assignee, assigner] = await Promise.all([
    loadEmployee(task.assignee_id),
    loadEmployee(task.assigned_by),
  ])
  if (!assignee?.email) return { sent: false as const, reason: 'no_recipient_email' }
  if (!(await wantsEmail(assignee.user_id, 'email_task_assigned')))
    return { sent: false as const, reason: 'opted_out' }

  return sendTemplateEmail('task-assigned', assignee.email, {
    templateData: {
      employeeName: assignee.full_name,
      taskTitle: task.title,
      taskDescription: task.description ?? undefined,
      priority: PRIORITY_AR[task.priority ?? 'medium'] ?? 'متوسطة',
      dueDate: task.due_date ?? 'غير محدد',
      assignedBy: assigner?.full_name ?? 'الإدارة',
    },
    idempotencyKey: `task-assigned-${task.id}`,
  })
}

export async function sendTaskStatusEmail(taskId: string, progress: number) {
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('id, title, status, progress, assignee_id, assigned_by')
    .eq('id', taskId)
    .maybeSingle()
  if (!task) return { sent: false as const, reason: 'task_not_found' }

  const [assignee, assigner] = await Promise.all([
    loadEmployee(task.assignee_id),
    loadEmployee(task.assigned_by),
  ])
  if (!assigner?.email) return { sent: false as const, reason: 'no_recipient_email' }
  if (!(await wantsEmail(assigner.user_id, 'email_task_progress')))
    return { sent: false as const, reason: 'opted_out' }

  return sendTemplateEmail('task-status-changed', assigner.email, {
    templateData: {
      recipientName: assigner.full_name,
      taskTitle: task.title,
      status: STATUS_AR[task.status ?? ''] ?? task.status,
      progress,
      updatedBy: assignee?.full_name ?? '—',
    },
    idempotencyKey: `task-status-${task.id}-${progress}`,
  })
}

/** يتحقق أن المستخدم طرف في المهمة (مكلَّف/مكلِّف) أو يشرف على المكلَّف */
export async function assertTaskParticipant(userId: string, taskId: string) {
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('id, assignee_id, assigned_by')
    .eq('id', taskId)
    .maybeSingle()
  if (!task) throw new Error('المهمة غير موجودة')

  const { loadActor, canSupervise } = await import('@/lib/attendance.server')
  const ctx = await loadActor(userId)
  if (!ctx.employeeId) throw new Error('غير مصرح: لا يوجد سجل موظف مرتبط بحسابك')
  if (task.assignee_id === ctx.employeeId || task.assigned_by === ctx.employeeId) return
  if (task.assignee_id && (await canSupervise(ctx, task.assignee_id))) return
  throw new Error('غير مصرح: لا تملك صلاحية على هذه المهمة')
}
