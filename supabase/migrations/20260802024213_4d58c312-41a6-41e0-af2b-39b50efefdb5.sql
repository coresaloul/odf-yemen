-- ===== columns on tasks =====
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence text,
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

-- ===== subtasks =====
CREATE TABLE IF NOT EXISTS public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_subtasks TO authenticated;
GRANT ALL ON public.task_subtasks TO service_role;

ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_subtasks_select ON public.task_subtasks FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
  AND (private.is_self_employee(t.assignee_id) OR private.can_supervise(t.assignee_id))));

CREATE POLICY task_subtasks_insert ON public.task_subtasks FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
  AND (private.is_self_employee(t.assignee_id) OR private.can_supervise(t.assignee_id))));

CREATE POLICY task_subtasks_update ON public.task_subtasks FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
  AND (private.is_self_employee(t.assignee_id) OR private.can_supervise(t.assignee_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
  AND (private.is_self_employee(t.assignee_id) OR private.can_supervise(t.assignee_id))));

CREATE POLICY task_subtasks_delete ON public.task_subtasks FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
  AND private.can_supervise(t.assignee_id)));

CREATE TRIGGER update_task_subtasks_updated_at BEFORE UPDATE ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== attachments =====
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_attachments_select ON public.task_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
  AND (private.is_self_employee(t.assignee_id) OR private.can_supervise(t.assignee_id))));

CREATE POLICY task_attachments_insert ON public.task_attachments FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
  AND (private.is_self_employee(t.assignee_id) OR private.can_supervise(t.assignee_id))));

CREATE POLICY task_attachments_delete ON public.task_attachments FOR DELETE TO authenticated
USING (uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
  AND private.can_supervise(t.assignee_id)));

CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON public.task_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);