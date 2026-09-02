DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    private.is_self_employee(assignee_id) 
    OR private.can_supervise(assignee_id)
  );