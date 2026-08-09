-- Explicit, stage-scoped INSERT policies on approval trail tables (defense in depth).

-- 1) attendance correction approvals
DROP POLICY IF EXISTS acr_appr_insert_scope ON public.attendance_correction_approvals;
CREATE POLICY acr_appr_insert_scope ON public.attendance_correction_approvals
FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.attendance_correction_requests r
    WHERE r.id = request_id
      AND (
        (stage = 'pending_manager' AND (private.is_director() OR private.can_supervise(r.employee_id) OR r.employee_id = private.current_employee_id()))
        OR (stage = 'pending_hr' AND (private.is_hr() OR private.is_director()))
        OR (stage = 'pending_director' AND private.is_director())
      )
  )
);

-- 2) discipline approvals
DROP POLICY IF EXISTS disc_appr_insert ON public.discipline_approvals;
CREATE POLICY disc_appr_insert ON public.discipline_approvals
FOR INSERT TO authenticated
WITH CHECK (private.is_hr() OR private.is_director());

-- 3) evaluation approvals
DROP POLICY IF EXISTS eval_appr_insert ON public.evaluation_approvals;
CREATE POLICY eval_appr_insert ON public.evaluation_approvals
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.id = evaluation_id
      AND (
        (stage = 'pending_manager' AND (private.is_director() OR private.can_supervise(e.employee_id)))
        OR (stage = 'pending_hr' AND (private.is_hr() OR private.is_director()))
        OR (stage = 'pending_director' AND private.is_director())
        OR (stage = 'draft' AND (private.can_supervise(e.employee_id) OR private.is_hr() OR private.is_director()))
      )
  )
);

-- 4) hr request approvals
DROP POLICY IF EXISTS hr_request_approvals_insert ON public.hr_request_approvals;
CREATE POLICY hr_request_approvals_insert ON public.hr_request_approvals
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hr_requests r
    WHERE r.id = request_id
      AND (
        (stage = 'pending_manager' AND (private.is_director() OR private.can_supervise(r.employee_id) OR private.is_self_employee(r.employee_id)))
        OR (stage = 'pending_hr' AND (private.is_hr() OR private.is_director()))
        OR (stage = 'pending_director' AND private.is_director())
      )
  )
);

-- 5) payroll approvals
DROP POLICY IF EXISTS payroll_approvals_insert ON public.payroll_approvals;
CREATE POLICY payroll_approvals_insert ON public.payroll_approvals
FOR INSERT TO authenticated
WITH CHECK (private.is_hr() OR private.is_director());

-- Approval trails are append-only: block updates/deletes for app clients.
DROP POLICY IF EXISTS acr_appr_no_update ON public.attendance_correction_approvals;
CREATE POLICY acr_appr_no_update ON public.attendance_correction_approvals AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS acr_appr_no_delete ON public.attendance_correction_approvals;
CREATE POLICY acr_appr_no_delete ON public.attendance_correction_approvals AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS disc_appr_no_update ON public.discipline_approvals;
CREATE POLICY disc_appr_no_update ON public.discipline_approvals AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS disc_appr_no_delete ON public.discipline_approvals;
CREATE POLICY disc_appr_no_delete ON public.discipline_approvals AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS eval_appr_no_update ON public.evaluation_approvals;
CREATE POLICY eval_appr_no_update ON public.evaluation_approvals AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS eval_appr_no_delete ON public.evaluation_approvals;
CREATE POLICY eval_appr_no_delete ON public.evaluation_approvals AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS hr_request_approvals_no_update ON public.hr_request_approvals;
CREATE POLICY hr_request_approvals_no_update ON public.hr_request_approvals AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS hr_request_approvals_no_delete ON public.hr_request_approvals;
CREATE POLICY hr_request_approvals_no_delete ON public.hr_request_approvals AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS payroll_approvals_no_update ON public.payroll_approvals;
CREATE POLICY payroll_approvals_no_update ON public.payroll_approvals AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS payroll_approvals_no_delete ON public.payroll_approvals;
CREATE POLICY payroll_approvals_no_delete ON public.payroll_approvals AS RESTRICTIVE FOR DELETE TO authenticated USING (false);