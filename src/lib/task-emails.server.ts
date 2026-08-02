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

type EmployeeLite = { id: string; full_name: string; email: string | null }

async function loadEmployee(id: string | null): Promise<EmployeeLite | null> {
  if (!id) return null
  const { data } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, email')
    .eq('id', id)
    .maybeSingle()
  return (data as EmployeeLite | null) ?? null
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
