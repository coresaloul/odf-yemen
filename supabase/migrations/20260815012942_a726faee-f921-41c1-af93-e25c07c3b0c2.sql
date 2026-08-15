ALTER TABLE public.task_subtasks ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE POLICY "task_updates_update" ON public.task_updates FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_updates.task_id AND private.can_supervise(t.assignee_id))
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_updates.task_id AND private.can_supervise(t.assignee_id))
);

CREATE POLICY "task_updates_delete" ON public.task_updates FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_updates.task_id AND private.can_supervise(t.assignee_id))
);

DROP POLICY IF EXISTS "task_subtasks_delete" ON public.task_subtasks;
CREATE POLICY "task_subtasks_delete" ON public.task_subtasks FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_subtasks.task_id AND private.can_supervise(t.assignee_id))
);