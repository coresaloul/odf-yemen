DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_self_employee(assignee_id) 
    OR public.can_supervise(assignee_id)
  );
