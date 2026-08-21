CREATE TABLE IF NOT EXISTS public.correspondence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 2 AND 500),
  body text,
  sender_name text,
  recipient_name text,
  external_reference text,
  correspondence_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  confidentiality text NOT NULL DEFAULT 'internal' CHECK (confidentiality IN ('normal', 'internal', 'confidential', 'very_confidential')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registered', 'in_progress', 'waiting_response', 'completed', 'closed', 'cancelled')),
  assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.correspondence_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondence_id uuid NOT NULL REFERENCES public.correspondence(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'submitted', 'assigned', 'status_changed', 'closed', 'cancelled')),
  actor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  assignee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.correspondence_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondence_id uuid NOT NULL REFERENCES public.correspondence(id) ON DELETE CASCADE,
  file_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text,
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS correspondence_direction_status_idx ON public.correspondence(direction, status);
CREATE INDEX IF NOT EXISTS correspondence_due_date_idx ON public.correspondence(due_date);
CREATE INDEX IF NOT EXISTS correspondence_assigned_to_idx ON public.correspondence(assigned_to);
CREATE INDEX IF NOT EXISTS correspondence_actions_correspondence_idx ON public.correspondence_actions(correspondence_id, created_at DESC);
CREATE INDEX IF NOT EXISTS correspondence_attachments_correspondence_idx ON public.correspondence_attachments(correspondence_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.correspondence TO authenticated;
GRANT SELECT, INSERT ON public.correspondence_actions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.correspondence_attachments TO authenticated;
GRANT ALL ON public.correspondence, public.correspondence_actions TO service_role;
GRANT ALL ON public.correspondence_attachments TO service_role;
ALTER TABLE public.correspondence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correspondence_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correspondence_attachments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_correspondence_updated BEFORE UPDATE ON public.correspondence
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY correspondence_read ON public.correspondence FOR SELECT TO authenticated
USING (
  private.is_director() OR private.is_hr()
  OR created_by = auth.uid()
  OR assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

CREATE POLICY correspondence_insert ON public.correspondence FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY correspondence_update ON public.correspondence FOR UPDATE TO authenticated
USING (private.is_director() OR private.is_hr() OR created_by = auth.uid() OR assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
WITH CHECK (private.is_director() OR private.is_hr() OR created_by = auth.uid() OR assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY correspondence_delete ON public.correspondence FOR DELETE TO authenticated
USING (private.is_director() OR private.is_hr() OR (created_by = auth.uid() AND status = 'draft'));

CREATE POLICY correspondence_actions_read ON public.correspondence_actions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.correspondence c WHERE c.id = correspondence_id));

CREATE POLICY correspondence_actions_insert ON public.correspondence_actions FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

CREATE POLICY correspondence_attachments_read ON public.correspondence_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.correspondence c WHERE c.id = correspondence_id AND (
  private.is_director() OR private.is_hr() OR c.created_by = auth.uid()
  OR c.assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
)));

CREATE POLICY correspondence_attachments_insert ON public.correspondence_attachments FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.correspondence c WHERE c.id = correspondence_id AND (
  private.is_director() OR private.is_hr() OR c.created_by = auth.uid()
  OR c.assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
)));

CREATE POLICY correspondence_attachments_delete ON public.correspondence_attachments FOR DELETE TO authenticated
USING (uploaded_by = auth.uid() OR private.is_director() OR private.is_hr());

INSERT INTO storage.buckets (id, name, public)
VALUES ('correspondence-files', 'correspondence-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY correspondence_files_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'correspondence-files'
  AND EXISTS (
    SELECT 1 FROM public.correspondence c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND (private.is_director() OR private.is_hr() OR c.created_by = auth.uid()
      OR c.assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
  )
);

CREATE POLICY correspondence_files_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'correspondence-files'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.correspondence c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND (private.is_director() OR private.is_hr() OR c.created_by = auth.uid()
      OR c.assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
  )
);

CREATE POLICY correspondence_files_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'correspondence-files' AND (owner = auth.uid() OR private.is_director() OR private.is_hr()));