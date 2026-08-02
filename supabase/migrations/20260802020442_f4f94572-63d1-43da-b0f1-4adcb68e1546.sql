-- 1) employees: restrict SELECT
DROP POLICY IF EXISTS employees_select ON public.employees;
CREATE POLICY employees_select ON public.employees
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_self_employee(id)
  OR public.can_supervise(id)
  OR public.is_hr()
  OR public.is_director()
);

-- 2) evaluation_approvals: only for evaluations the user can see
DROP POLICY IF EXISTS "read approval trail for visible evaluations" ON public.evaluation_approvals;
CREATE POLICY "read approval trail for visible evaluations" ON public.evaluation_approvals
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.id = evaluation_approvals.evaluation_id
      AND (
        public.is_self_employee(e.employee_id)
        OR public.can_supervise(e.employee_id)
        OR public.is_hr()
      )
  )
);

-- 3) profiles: self, HR, director
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_own_or_staff ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_hr() OR public.is_director());

-- 4) departments / sections: only linked employees, HR, director
DROP POLICY IF EXISTS departments_select ON public.departments;
CREATE POLICY departments_select ON public.departments
FOR SELECT TO authenticated
USING (public.current_employee_id() IS NOT NULL OR public.is_hr() OR public.is_director());

DROP POLICY IF EXISTS sections_select ON public.sections;
CREATE POLICY sections_select ON public.sections
FOR SELECT TO authenticated
USING (public.current_employee_id() IS NOT NULL OR public.is_hr() OR public.is_director());

-- 5) SECURITY DEFINER function execution privileges
-- Trigger-only functions: never callable directly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_task_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_default_notification_preferences() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_notifications_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Helper functions used inside RLS policies: keep for authenticated, block anonymous
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_director() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_hr() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_self_employee(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_employee_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_supervise(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wants_notification(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_director() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_self_employee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_supervise(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wants_notification(uuid, text, text) TO authenticated;

-- Workflow RPCs: authenticated only (they enforce role checks internally)
REVOKE ALL ON FUNCTION public.submit_evaluation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_evaluation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_evaluation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_evaluation(uuid, text, text) TO authenticated;