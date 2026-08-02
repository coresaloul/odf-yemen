DROP POLICY IF EXISTS acr_appr_select_scope ON public.attendance_correction_approvals;
CREATE POLICY acr_appr_select_scope ON public.attendance_correction_approvals
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.attendance_correction_requests r
  WHERE r.id = attendance_correction_approvals.request_id
    AND (
      private.has_role(auth.uid(), 'executive_director'::app_role)
      OR private.has_role(auth.uid(), 'hr'::app_role)
      OR r.employee_id = private.current_employee_id()
      OR private.can_supervise(r.employee_id)
    )
));

DROP POLICY IF EXISTS installments_select ON public.contract_installments;
CREATE POLICY installments_select ON public.contract_installments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.consultant_contracts c
  WHERE c.id = contract_installments.contract_id
    AND (private.is_hr() OR private.is_director() OR private.is_self_employee(c.employee_id))
));

DROP POLICY IF EXISTS payroll_lines_select ON public.payroll_item_lines;
CREATE POLICY payroll_lines_select ON public.payroll_item_lines
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.payroll_items i
  WHERE i.id = payroll_item_lines.item_id
    AND (
      private.is_hr() OR private.is_director()
      OR (private.is_self_employee(i.employee_id) AND EXISTS (
        SELECT 1 FROM public.payroll_runs r
        WHERE r.id = i.run_id AND r.status IN ('approved','paid')
      ))
    )
));