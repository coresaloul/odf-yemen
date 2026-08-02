-- 1) new role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';

-- 2) approval stage enum
DO $$ BEGIN
  CREATE TYPE public.approval_stage AS ENUM ('draft','pending_manager','pending_hr','pending_director','approved','returned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) evaluation columns
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS approval_stage public.approval_stage NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_approved_by uuid,
  ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS hr_approved_by uuid,
  ADD COLUMN IF NOT EXISTS hr_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS director_approved_by uuid,
  ADD COLUMN IF NOT EXISTS director_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_reason text;

UPDATE public.evaluations SET approval_stage = 'approved' WHERE approved = true AND approval_stage = 'draft';

-- 4) audit log table
CREATE TABLE IF NOT EXISTS public.evaluation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  stage public.approval_stage NOT NULL,
  action text NOT NULL CHECK (action IN ('submitted','approved','returned')),
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.evaluation_approvals TO authenticated;
GRANT ALL ON public.evaluation_approvals TO service_role;
ALTER TABLE public.evaluation_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read approval trail for visible evaluations"
ON public.evaluation_approvals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_id));

-- 5) helper: is hr
CREATE OR REPLACE FUNCTION public.is_hr()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'hr');
END; $$;

-- 6) submit for approval
CREATE OR REPLACE FUNCTION public.submit_evaluation(_evaluation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev public.evaluations%ROWTYPE;
BEGIN
  SELECT * INTO ev FROM public.evaluations WHERE id = _evaluation_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'التقييم غير موجود'; END IF;
  IF ev.approval_stage NOT IN ('draft','returned') THEN RAISE EXCEPTION 'التقييم مُرسل للاعتماد بالفعل'; END IF;
  IF NOT (public.can_supervise(ev.employee_id) OR public.is_hr() OR public.is_director()) THEN
    RAISE EXCEPTION 'لا تملك صلاحية إرسال هذا التقييم';
  END IF;
  UPDATE public.evaluations
     SET approval_stage = 'pending_manager', submitted_at = now(), return_reason = NULL, updated_at = now()
   WHERE id = _evaluation_id;
  INSERT INTO public.evaluation_approvals (evaluation_id, stage, action) VALUES (_evaluation_id, 'pending_manager', 'submitted');
END; $$;

-- 7) decide (approve / return)
CREATE OR REPLACE FUNCTION public.decide_evaluation(_evaluation_id uuid, _action text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev public.evaluations%ROWTYPE; allowed boolean := false; next_stage public.approval_stage;
BEGIN
  IF _action NOT IN ('approved','returned') THEN RAISE EXCEPTION 'إجراء غير صالح'; END IF;
  SELECT * INTO ev FROM public.evaluations WHERE id = _evaluation_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'التقييم غير موجود'; END IF;

  IF ev.approval_stage = 'pending_manager' THEN
    allowed := public.can_supervise(ev.employee_id) OR public.is_director();
    next_stage := 'pending_hr';
  ELSIF ev.approval_stage = 'pending_hr' THEN
    allowed := public.is_hr();
    next_stage := 'pending_director';
  ELSIF ev.approval_stage = 'pending_director' THEN
    allowed := public.is_director();
    next_stage := 'approved';
  ELSE
    RAISE EXCEPTION 'لا توجد مرحلة اعتماد قائمة لهذا التقييم';
  END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'لا تملك صلاحية الاعتماد في هذه المرحلة'; END IF;

  INSERT INTO public.evaluation_approvals (evaluation_id, stage, action, note)
  VALUES (_evaluation_id, ev.approval_stage, _action, _note);

  IF _action = 'returned' THEN
    UPDATE public.evaluations
       SET approval_stage = 'returned', approved = false, return_reason = _note, updated_at = now()
     WHERE id = _evaluation_id;
    RETURN;
  END IF;

  IF ev.approval_stage = 'pending_manager' THEN
    UPDATE public.evaluations SET manager_approved_by = auth.uid(), manager_approved_at = now() WHERE id = _evaluation_id;
  ELSIF ev.approval_stage = 'pending_hr' THEN
    UPDATE public.evaluations SET hr_approved_by = auth.uid(), hr_approved_at = now() WHERE id = _evaluation_id;
  ELSE
    UPDATE public.evaluations SET director_approved_by = auth.uid(), director_approved_at = now() WHERE id = _evaluation_id;
  END IF;

  UPDATE public.evaluations
     SET approval_stage = next_stage,
         approved = (next_stage = 'approved'),
         return_reason = NULL,
         updated_at = now()
   WHERE id = _evaluation_id;
END; $$;

REVOKE ALL ON FUNCTION public.submit_evaluation(uuid) FROM public;
REVOKE ALL ON FUNCTION public.decide_evaluation(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_evaluation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_evaluation(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hr() TO authenticated;

-- 8) HR can view all evaluations
DROP POLICY IF EXISTS "hr can view all evaluations" ON public.evaluations;
CREATE POLICY "hr can view all evaluations"
ON public.evaluations FOR SELECT TO authenticated
USING (public.is_hr());