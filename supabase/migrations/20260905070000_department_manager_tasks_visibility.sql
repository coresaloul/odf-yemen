-- Migration: 20260905070000_department_manager_tasks_visibility.sql
-- Description: Allow department managers to view and manage tasks for their supervised team and department

CREATE OR REPLACE FUNCTION private.can_supervise(_employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.has_role(auth.uid(), 'executive_director')
      OR private.has_role(auth.uid(), 'hr')
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = _employee_id
          AND (
            e.manager_id = private.current_employee_id()
            OR e.department_id IN (
              SELECT d.id FROM public.departments d 
              WHERE d.manager_id = private.current_employee_id()
                 OR (d.id = (SELECT e2.department_id FROM public.employees e2 WHERE e2.id = private.current_employee_id())
                     AND private.has_role(auth.uid(), 'manager'))
            )
            OR e.section_id IN (
              SELECT s.id FROM public.sections s 
              WHERE s.manager_id = private.current_employee_id()
            )
          )
      );
$$;

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    private.is_self_employee(assignee_id)
    OR private.can_supervise(assignee_id)
    OR supervisor_id = private.current_employee_id()
    OR assigned_by = private.current_employee_id()
    OR private.has_role(auth.uid(), 'executive_director')
    OR private.has_role(auth.uid(), 'hr')
  );

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (
    private.is_self_employee(assignee_id)
    OR private.can_supervise(assignee_id)
    OR supervisor_id = private.current_employee_id()
    OR assigned_by = private.current_employee_id()
    OR private.has_role(auth.uid(), 'executive_director')
    OR private.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    private.is_self_employee(assignee_id)
    OR private.can_supervise(assignee_id)
    OR supervisor_id = private.current_employee_id()
    OR assigned_by = private.current_employee_id()
    OR private.has_role(auth.uid(), 'executive_director')
    OR private.has_role(auth.uid(), 'hr')
  );

DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (
    private.can_supervise(assignee_id)
    OR assigned_by = private.current_employee_id()
    OR private.has_role(auth.uid(), 'executive_director')
    OR private.has_role(auth.uid(), 'hr')
  );
