import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
export const notifyTaskAssigned = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ taskId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertTaskParticipant, sendTaskAssignedEmail } = await import('./task-emails.server')
    await assertTaskParticipant(context.userId, data.taskId)
    return sendTaskAssignedEmail(data.taskId)
  })

export const notifyTaskStatusChanged = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ taskId: z.string().uuid(), progress: z.number().min(0).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertTaskParticipant, sendTaskStatusEmail } = await import('./task-emails.server')
    await assertTaskParticipant(context.userId, data.taskId)
    return sendTaskStatusEmail(data.taskId, data.progress)
  })
