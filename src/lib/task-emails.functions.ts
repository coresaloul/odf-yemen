import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { sendTaskAssignedEmail, sendTaskStatusEmail } from './task-emails.server'

export const notifyTaskAssigned = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ taskId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => sendTaskAssignedEmail(data.taskId))

export const notifyTaskStatusChanged = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ taskId: z.string().uuid(), progress: z.number().min(0).max(100) }).parse(data),
  )
  .handler(async ({ data }) => sendTaskStatusEmail(data.taskId, data.progress))
