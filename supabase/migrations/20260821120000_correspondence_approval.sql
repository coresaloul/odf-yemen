ALTER TABLE public.correspondence
  ADD COLUMN IF NOT EXISTS approval_stage text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS return_reason text,
  ADD COLUMN IF NOT EXISTS manager_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS hr_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hr_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS director_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS director_approved_at timestamptz;

ALTER TABLE public.correspondence DROP CONSTRAINT IF EXISTS correspondence_status_check;
ALTER TABLE public.correspondence ADD CONSTRAINT correspondence_status_check
  CHECK (status IN ('draft', 'registered', 'pending_approval', 'in_progress', 'waiting_response', 'completed', 'closed', 'cancelled', 'returned'));

ALTER TABLE public.correspondence DROP CONSTRAINT IF EXISTS correspondence_approval_stage_check;
ALTER TABLE public.correspondence ADD CONSTRAINT correspondence_approval_stage_check
  CHECK (approval_stage IN ('draft', 'pending_manager', 'pending_hr', 'pending_director', 'approved', 'returned'));

CREATE TABLE IF NOT EXISTS public.correspondence_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondence_id uuid NOT NULL REFERENCES public.correspondence(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('pending_manager', 'pending_hr', 'pending_director')),
  action text NOT NULL CHECK (action IN ('submitted', 'approved', 'returned')),
  actor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS correspondence_approval_stage_idx ON public.correspondence(approval_stage);
CREATE INDEX IF NOT EXISTS correspondence_approvals_correspondence_idx ON public.correspondence_approvals(correspondence_id, created_at DESC);

GRANT SELECT, INSERT ON public.correspondence_approvals TO authenticated;
GRANT ALL ON public.correspondence_approvals TO service_role;
ALTER TABLE public.correspondence_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY correspondence_approvals_read ON public.correspondence_approvals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.correspondence c WHERE c.id = correspondence_id AND (
  private.is_director() OR private.is_hr() OR c.created_by = auth.uid()
  OR c.assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
)));

CREATE POLICY correspondence_approvals_insert ON public.correspondence_approvals FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.correspondence c WHERE c.id = correspondence_id));