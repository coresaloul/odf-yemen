ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretariat';

ALTER TABLE public.correspondence
  ADD COLUMN IF NOT EXISTS secretariat_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS secretariat_approved_at timestamptz;

ALTER TABLE public.correspondence DROP CONSTRAINT IF EXISTS correspondence_approval_stage_check;
ALTER TABLE public.correspondence ADD CONSTRAINT correspondence_approval_stage_check
  CHECK (approval_stage IN ('draft', 'pending_manager', 'pending_secretariat', 'pending_director', 'approved', 'returned'));

ALTER TABLE public.correspondence_approvals DROP CONSTRAINT IF EXISTS correspondence_approvals_stage_check;
ALTER TABLE public.correspondence_approvals ADD CONSTRAINT correspondence_approvals_stage_check
  CHECK (stage IN ('pending_manager', 'pending_secretariat', 'pending_director'));
DROP POLICY IF EXISTS correspondence_actions_read ON public.correspondence_actions;
CREATE POLICY correspondence_actions_read ON public.correspondence_actions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.correspondence c WHERE c.id = correspondence_id AND (
  private.is_director() OR private.is_hr() OR c.created_by = auth.uid()
  OR c.assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
)));

DROP POLICY IF EXISTS correspondence_actions_insert ON public.correspondence_actions;
CREATE POLICY correspondence_actions_insert ON public.correspondence_actions FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.correspondence c WHERE c.id = correspondence_id AND (
  private.is_director() OR private.is_hr() OR c.created_by = auth.uid()
  OR c.assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
)));

DROP POLICY IF EXISTS correspondence_approvals_insert ON public.correspondence_approvals;
CREATE POLICY correspondence_approvals_insert ON public.correspondence_approvals FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.correspondence c WHERE c.id = correspondence_id AND (
  private.is_director() OR private.is_hr() OR c.created_by = auth.uid()
  OR c.assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
)));
