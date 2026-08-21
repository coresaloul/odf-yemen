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