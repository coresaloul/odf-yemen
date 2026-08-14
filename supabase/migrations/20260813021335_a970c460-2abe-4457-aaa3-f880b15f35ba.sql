DROP POLICY IF EXISTS acr_update_own_draft ON public.attendance_correction_requests;
CREATE POLICY acr_update_own_draft ON public.attendance_correction_requests
FOR UPDATE TO authenticated
USING (stage = ANY (ARRAY['draft'::approval_stage,'returned'::approval_stage]) AND employee_id = private.current_employee_id())
WITH CHECK (stage = ANY (ARRAY['draft'::approval_stage,'returned'::approval_stage]) AND employee_id = private.current_employee_id());

DROP POLICY IF EXISTS hr_requests_update_own_draft ON public.hr_requests;
CREATE POLICY hr_requests_update_own_draft ON public.hr_requests
FOR UPDATE TO authenticated
USING (private.is_self_employee(employee_id) AND stage = ANY (ARRAY['draft'::approval_stage,'returned'::approval_stage]))
WITH CHECK (private.is_self_employee(employee_id) AND stage = ANY (ARRAY['draft'::approval_stage,'returned'::approval_stage]));

DROP POLICY IF EXISTS hr_requests_select ON public.hr_requests;
CREATE POLICY hr_requests_select ON public.hr_requests
FOR SELECT TO authenticated
USING (
  private.is_self_employee(employee_id)
  OR private.is_hr()
  OR private.is_director()
  OR (
    private.can_supervise(employee_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.hr_request_types t
      WHERE t.id = hr_requests.type_id AND t.is_confidential
    )
  )
);

CREATE OR REPLACE FUNCTION private.prevent_employee_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'لا يمكن تغيير الموظف صاحب الطلب';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leave_requests_no_reassign ON public.leave_requests;
CREATE TRIGGER leave_requests_no_reassign BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION private.prevent_employee_reassignment();

DROP TRIGGER IF EXISTS hr_requests_no_reassign ON public.hr_requests;
CREATE TRIGGER hr_requests_no_reassign BEFORE UPDATE ON public.hr_requests
FOR EACH ROW EXECUTE FUNCTION private.prevent_employee_reassignment();

DROP TRIGGER IF EXISTS acr_no_reassign ON public.attendance_correction_requests;
CREATE TRIGGER acr_no_reassign BEFORE UPDATE ON public.attendance_correction_requests
FOR EACH ROW EXECUTE FUNCTION private.prevent_employee_reassignment();