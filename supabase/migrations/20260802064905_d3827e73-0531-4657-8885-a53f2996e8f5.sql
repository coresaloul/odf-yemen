ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'pending_approval';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_for_approval_at timestamptz;

CREATE TABLE IF NOT EXISTS public.attendance_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  correction_type text NOT NULL DEFAULT 'missing_check_in',
  requested_check_in time,
  requested_check_out time,
  reason text,
  attachment_url text,
  stage public.approval_stage NOT NULL DEFAULT 'draft',
  return_reason text,
  submitted_at timestamptz,
  manager_approved_by uuid,
  manager_approved_at timestamptz,
  hr_approved_by uuid,
  hr_approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS acr_employee_idx ON public.attendance_correction_requests(employee_id, work_date);
CREATE INDEX IF NOT EXISTS acr_stage_idx ON public.attendance_correction_requests(stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_correction_requests TO authenticated;
GRANT ALL ON public.attendance_correction_requests TO service_role;
ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acr_select_scope" ON public.attendance_correction_requests
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'executive_director')
    OR private.has_role(auth.uid(), 'hr')
    OR employee_id = private.current_employee_id()
    OR private.can_supervise(employee_id)
  );

CREATE POLICY "acr_insert_own" ON public.attendance_correction_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'executive_director')
    OR private.has_role(auth.uid(), 'hr')
    OR employee_id = private.current_employee_id()
  );

CREATE POLICY "acr_update_own_draft" ON public.attendance_correction_requests
  FOR UPDATE TO authenticated
  USING (stage IN ('draft','returned') AND employee_id = private.current_employee_id())
  WITH CHECK (employee_id = private.current_employee_id());

CREATE POLICY "acr_delete_own_draft" ON public.attendance_correction_requests
  FOR DELETE TO authenticated
  USING (stage IN ('draft','returned') AND employee_id = private.current_employee_id());

CREATE TRIGGER acr_set_updated_at
  BEFORE UPDATE ON public.attendance_correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.attendance_correction_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.attendance_correction_requests(id) ON DELETE CASCADE,
  stage public.approval_stage NOT NULL,
  action text NOT NULL,
  note text,
  actor_id uuid NOT NULL,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS acr_appr_request_idx ON public.attendance_correction_approvals(request_id);

GRANT SELECT ON public.attendance_correction_approvals TO authenticated;
GRANT ALL ON public.attendance_correction_approvals TO service_role;
ALTER TABLE public.attendance_correction_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acr_appr_select_scope" ON public.attendance_correction_approvals
  FOR SELECT TO authenticated
  USING (request_id IN (SELECT id FROM public.attendance_correction_requests));